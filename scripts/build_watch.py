#!/usr/bin/env python3
"""OSO PIT THEATER v3 · generator for /watch/ (Season 1 · The Proposal Circles).

Authoring-time only — the site still has no runtime build step. Python 3 standard library only.

    python3 scripts/build_watch.py            # build everything from data/season1/*.json
    python3 scripts/build_watch.py --check    # exit 1 if any generated file would change

Reads   data/season1/season.json (the show), <ep>.words.json (the written words), garden.json, live.json,
        every public transcript (meetings/N/transcript/transcript.json · data/transcripts/*.json),
        optional whisper drafts  /workspace/theater-v3/transcripts/meet{N}-whisper.json  {segments:[{start,end,text}]}
        optional finished words  /workspace/theater-v3/words/<ep>.words.json  (copied into data/season1/ when valid)
Writes  watch/index.html · watch/<ep>/index.html · watch/search/ · watch/garden/ · watch/live/ · watch/embed/<ep>/
        watch/feed.xml · data/search-index.json · sitemap.xml (merged)

Consent is decided in ONE place (`visible()`): only `published_with_consent` episodes get pages, media, transcripts,
search lines and feed items. `pending_confirmation` is listed with title and speakers, nothing else.
`gated` never appears (no title, no speakers). Code GPL-3.0 · words CC BY-SA 4.0 · built by the ʻohana (machines).
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOST = "https://osodaomeet.opensourceorchestra.org"
PUBLISHED, PENDING, GATED = "published_with_consent", "pending_confirmation", "gated"
PRIVATE = re.compile(r"meet\.google|zoom\.us|drive\.google|@gmail|@[a-z0-9.-]+\.(com|org|net)\b|\+?\d[\d\s().-]{8,}\d|NavPoint|\bKEW\b|\bBrent\b|\bBlake\b|Ham Agents|BEGIN PRIVATE KEY", re.I)
SHIELD = ("Brent", "Blake")

E = html.escape


# ───────────────────────────── helpers ─────────────────────────────
def clock(seconds: float) -> str:
    s = max(0, int(seconds or 0))
    h, m, r = s // 3600, (s % 3600) // 60, s % 60
    return (f"{h}:{m:02d}" if h else f"{m}") + f":{r:02d}"


def vtt_time(seconds: float) -> str:
    ms = int(round((seconds or 0) * 1000))
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def read_json(path: Path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def local(path: str) -> Path:
    return ROOT / path.lstrip("/")


def visible(ep: dict) -> str:
    """The one consent gate. Returns 'published' | 'pending' | 'hidden'."""
    status = (ep.get("consent") or {}).get("status")
    if status == PUBLISHED:
        return "published"
    if status == PENDING:
        return "pending"
    return "hidden"


def has_film(ep: dict) -> bool:
    video = (ep.get("media") or {}).get("video") or {}
    return visible(ep) == "published" and bool(video.get("url")) and not video.get("arriving")


def has_audio(ep: dict) -> bool:
    audio = (ep.get("media") or {}).get("audio") or {}
    return visible(ep) == "published" and bool(audio.get("url")) and not audio.get("arriving") and bool(audio.get("bytes"))


def episode_label(ep: dict) -> str:
    return "Pilot" if ep["id"] == "pilot" else f"Episode {ep['number']}"


def short_label(ep: dict) -> str:
    return "Pilot" if ep["id"] == "pilot" else f"E{ep['number']}"


# ───────────────────────────── transcripts ─────────────────────────────
def cues_from(transcript: dict) -> list[dict]:
    if isinstance(transcript.get("cues"), list):
        return [{"start": float(c["start"]), "end": float(c.get("end", c["start"])), "who": c.get("speaker", ""), "text": c.get("text", "")} for c in transcript["cues"]]
    if isinstance(transcript.get("turns"), list):
        names = transcript.get("speakers") or {}
        cues = []
        for turn in transcript["turns"]:
            who = (names.get(turn.get("speaker")) or {}).get("name") or turn.get("speaker") or ""
            for seg in turn.get("segments") or []:
                cues.append({"start": float(seg["start"]), "end": float(seg.get("end", seg["start"])), "who": who, "text": seg.get("text", "")})
        return sorted(cues, key=lambda c: c["start"])
    if isinstance(transcript.get("segments"), list):
        return [{"start": float(s["start"]), "end": float(s.get("end", s["start"])), "who": s.get("speaker", ""), "text": (s.get("text") or "").strip()} for s in transcript["segments"]]
    return []


def privacy_hits(cues: list[dict]) -> list[str]:
    hits = []
    for cue in cues:
        if PRIVATE.search(cue["text"] or ""):
            hits.append(f"{clock(cue['start'])} {cue['text'][:80]}")
    return hits


def load_transcript(ep: dict, whisper_dir: Path, problems: list[str]) -> tuple[list[dict], str]:
    """Returns (cues, provenance). Public transcript first; whisper draft second (privacy-scanned, fail closed)."""
    if visible(ep) != "published":
        return [], "none"
    path = (ep.get("media") or {}).get("transcript")
    if path and local(path).exists():
        return cues_from(read_json(local(path))), "public"
    draft = whisper_dir / f"meet{ep['number']}-whisper.json"
    if draft.exists() and draft.stat().st_size > 0:
        try:
            cues = cues_from(read_json(draft))
        except (json.JSONDecodeError, KeyError, TypeError) as error:
            problems.append(f"{ep['id']}: whisper draft unreadable ({error}) — skipped")
            return [], "none"
        hits = privacy_hits(cues)
        if hits:
            problems.append(f"{ep['id']}: whisper draft REFUSED — {len(hits)} possible private detail(s), e.g. {hits[0]!r}; run the editorial pass first")
            return [], "none"
        out_json = ROOT / "data" / "season1" / f"{ep['id']}.transcript.json"
        out_vtt = ROOT / "data" / "season1" / f"{ep['id']}.vtt"
        payload = {
            "schema": "oso-pit-theater-transcript-v1",
            "episode": ep["id"],
            "source": "automatic transcript (local faster-whisper on the ʻohana's machine; media never uploaded to a transcription service)",
            "editorial": "pending — speaker labels not yet assigned; wording may be imperfect; first names only; takedown first",
            "takedown": "https://opensourceorchestra.org/takedown/",
            "cues": [{"start": round(c["start"], 2), "end": round(c["end"], 2), "speaker": c["who"], "text": c["text"]} for c in cues],
        }
        write(out_json, json.dumps(payload, ensure_ascii=False, indent=1) + "\n")
        vtt = ["WEBVTT", "", "NOTE", f"Open Source Orchestra DAO Meet · {ep['title']} · automatic captions, editorial pass pending.", "Takedown first: https://opensourceorchestra.org/takedown/", ""]
        for i, c in enumerate(cues, 1):
            vtt += [str(i), f"{vtt_time(c['start'])} --> {vtt_time(max(c['end'], c['start'] + 0.4))}", c["text"], ""]
        write(out_vtt, "\n".join(vtt))
        ep.setdefault("media", {})["captions"] = f"/data/season1/{ep['id']}.vtt"
        ep["media"]["transcript"] = f"/data/season1/{ep['id']}.transcript.json"
        return cues, "whisper"
    return [], "none"


def normalize_words(data: dict, ep: dict) -> dict:
    """Accept both the words.schema.json shape and the writer lane's shape
    ({ep,draft,title,blurb,recap:str,quotes,chapters,whyItMatters:str,glossary:[{term,plain}],seeds,credit})."""
    paragraphs = lambda value: [p.strip() for p in re.split(r"\n\s*\n", value)] if isinstance(value, str) else list(value or [])
    out = {
        "schema": "oso-pit-theater-words-v1",
        "episode": data.get("episode") or data.get("ep") or ep["id"],
        "draft": bool(data.get("draft", False)),
        "writtenBy": data.get("writtenBy") or data.get("credit") or "written by the AI ʻohana from the public transcripts · CC BY-SA 4.0",
        "sourceTranscript": data.get("sourceTranscript") or ep["media"].get("transcript"),
        "title": data.get("title") or ep["title"],
        "blurb": data.get("blurb") or ep["lede"],
        "recap": [p for p in paragraphs(data.get("recap")) if p],
        "quotes": [{"t": float(q["t"]), "who": q["who"], "text": q["text"]} for q in data.get("quotes", [])],
        "chapters": [{"t": float(c.get("t", c.get("start", 0))), "title": c["title"]} for c in data.get("chapters", [])],
        "whyItMatters": [p for p in paragraphs(data.get("whyItMatters")) if p],
        "glossary": [{"term": g["term"], "meaning": g.get("meaning") or g.get("plain") or ""} for g in data.get("glossary", [])],
        "seeds": [{"t": float(x["t"]), "who": x["who"], "text": x["text"]} for x in data.get("seeds", [])],
        "license": "CC BY-SA 4.0",
    }
    return out


def verbatim(text: str, cues: list[dict], t: float, window: float = 150.0) -> bool:
    """The quote's words must appear in order inside the transcript from t to t+window (fillers may be dropped)."""
    words = re.findall(r"[a-z0-9']+", text.lower().replace("…", " "))
    haystack = " ".join(c["text"] for c in cues if t - 1 <= c["start"] <= t + window).lower()
    pos = 0
    for word in words:
        found = re.search(r"\b" + re.escape(word) + r"\b", haystack[pos:])
        if not found:
            return False
        pos += found.end()
    return bool(words)


# ───────────────────────────── output ─────────────────────────────
WRITTEN: dict[Path, str] = {}


def write(path: Path, content: str) -> None:
    WRITTEN[path] = content


def flush(check: bool) -> int:
    changed = 0
    for path, content in WRITTEN.items():
        old = path.read_text(encoding="utf-8") if path.exists() else None
        stamp = lambda text: re.sub(r'"built":"[^"]+"|<lastBuildDate>[^<]+</lastBuildDate>', "", text or "")
        if old == content or (check and stamp(old) == stamp(content)):
            continue
        changed += 1
        if check:
            print(f"  would change: {path.relative_to(ROOT)}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            print(f"  wrote {path.relative_to(ROOT)} ({len(content.encode('utf-8')):,} bytes)")
    return changed


# ───────────────────────────── chrome ─────────────────────────────
def chrome(show: dict, *, title: str, description: str, path: str, body: str, module: str, image: str | None = None, current: str = "", extra_head: str = "", body_class: str = "", noindex: bool = False) -> str:
    canonical = f"{HOST}{path}"
    og_image = f"{HOST}{image or show['og']}"
    nav_items = [("/watch/", "Episodes", "tv"), ("/watch/search/", "Search", "search"), ("/watch/garden/", "Garden", "garden"), ("/watch/live/", "Live", "live"), ("/watch/feed.xml", "Podcast", "feed"), ("/meetings/", "Ledger", "ledger"), ("/", "The Hall", "hall")]
    nav = "".join(f'<a href="{href}"' + (' aria-current="page"' if key == current else "") + f'>{label}</a>' for href, label, key in nav_items)
    values = (f'<p class="values"><strong>CROPS values</strong> — consent asked out loud · receipts, not claims · open by default (GPL-3.0 code · CC BY-SA 4.0 words) · '
              f'protect the people in the room (first names, takedown first) · share-alike, fork us like crazy. <b>Infinite Garden</b> — we leave every circle more open, more musical and more alive than we found it.</p>')
    foot = (f'<footer class="w-foot wrap"><p class="machines">{E(show["machines"])} The Open Source Orchestra DAO remains a proposal and public community ledger, not an on-chain or adopted DAO.</p>'
            f'<p>Code GPL-3.0 · words, films and art CC BY-SA 4.0 · first names only · <a href="{show["takedown"]}">takedown first</a> · recorded the <a href="{show["protocol"]["url"]}">{E(show["protocol"]["name"])}</a> way.</p>'
            f'<nav aria-label="Open Source Orchestra"><a href="{show["join"]}">Join the circle</a><a href="https://opensourceorchestra.org/">Open Source Orchestra</a><a href="https://opensourceorchestra.org/dao/">Community ledger</a><a href="https://github.com/Open-Source-Orchestra/oso-dao-meet">Open code</a><a href="/watch/feed.xml">Podcast feed</a><a href="/channels/">Readable channels</a></nav></footer>')
    robots = '<meta name="robots" content="noindex">' if noindex else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0c0812">
<title>{E(title)}</title>
<meta name="description" content="{E(description)}">
<link rel="canonical" href="{canonical}">{robots}
<meta property="og:type" content="video.other"><meta property="og:site_name" content="OSO PIT THEATER · Open Source Orchestra DAO Meet">
<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(description)}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{og_image}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='43' fill='%23110b17' stroke='%23dfbb73' stroke-width='4'/%3E%3Cpath d='M28 61V37l10 12 12-20 12 20 10-12v24' fill='none' stroke='%23f8edda' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<link rel="alternate" type="application/rss+xml" title="OSO PIT THEATER · Season 1 (podcast)" href="/watch/feed.xml">
<link rel="stylesheet" href="/css/watch.css">
<script>document.documentElement.classList.add('has-js')</script>{extra_head}
</head>
<body class="{body_class}">
<a class="skip-link" href="#main">Skip to content</a>
<header class="w-top wrap"><nav aria-label="OSO PIT THEATER"><a class="brand" href="/watch/">OSO PIT THEATER<small>Season 1 · The Proposal Circles</small></a>{nav}</nav>{values}</header>
<main id="main" class="wrap">
{body}
</main>
{foot}
<script src="/lang.js" async></script>
<script type="module" src="/js/watch/{module}.js"></script>
</body>
</html>
"""


def consent_chip(ep: dict) -> str:
    state = visible(ep)
    if state == "published":
        film = "" if has_film(ep) else " · film arriving"
        return f'<li class="chip-ok">published with consent{film}</li>'
    if state == "pending":
        return '<li class="chip-wait">publishing after Shaka confirms consent</li>'
    return ""


def speaker_chips(ep: dict) -> str:
    chips = "".join(f"<li>{E(name)}</li>" for name in ep.get("speakers", []))
    chips += "".join(f'<li class="chip-machine">{E(m)}</li>' for m in ep.get("machines", []))
    return chips


# ───────────────────────────── the player ─────────────────────────────
def player_html(ep: dict, next_ep: dict | None, *, embed: bool = False) -> str:
    media = ep["media"]
    video, audio = media["video"], media.get("audio") or {}
    arriving = not has_film(ep)
    poster = media.get("poster") or ""
    chapters_json = json.dumps([{"start": c["start"], "title": c["title"]} for c in ep.get("chapters", [])], ensure_ascii=False)
    track = f'<track kind="captions" src="{E(media["captions"])}" srclang="en" label="English captions · editorial speaker labels" default>' if media.get("captions") and local(media["captions"]).exists() else ""
    if arriving:
        screen = (f'<div class="screen" style="background-image:url({E(poster)})"><img src="{E(poster)}" alt="Poster for {E(ep["title"])}" width="1280" height="720" style="opacity:.0001;position:absolute">'
                  f'<div class="arriving"><strong>Film arriving</strong><span>The 720p encode and upload for this circle are in progress on the ʻohana\'s own machine. The transcript, the written words and the ledger are already here; the film and the mono MP3 appear the moment they are verified (bytes and SHA-256 in the ledger).</span></div></div>')
    else:
        audio_tag = f'<audio controls preload="none" data-src="{E(audio["url"])}" aria-label="Audio only · {E(ep["title"])}"></audio>' if audio.get("url") and not audio.get("arriving") else ""
        screen = (f'<div class="screen"><video controls playsinline preload="none" poster="{E(poster)}" crossorigin="anonymous" src="{E(video["url"])}" aria-label="{E(ep["title"])}. Nothing plays until you press Play.">{track}'
                  f'Your browser cannot play this film here. <a href="{E(video["url"])}">Open the MP4 directly</a>' + (f' or <a href="{E(audio["url"])}">listen to the audio</a>' if audio.get("url") and not audio.get("arriving") else "") + '.</video>'
                  f'{audio_tag}<div class="audio-face" aria-hidden="true">♪ audio only · {E(ep["title"])}</div></div>')
    downloads = []
    if has_film(ep):
        bytes_note = f" · {video['bytes']:,} bytes" if video.get("bytes") else ""
        sha_note = f"<br><code>sha256 {video['sha256']}</code>" if video.get("sha256") else ""
        downloads.append(f'<li>Film · 720p H.264 · <a href="{E(video["url"])}" download>{E(video["url"].rsplit("/", 1)[-1])}</a>{bytes_note}{sha_note}</li>')
    elif visible(ep) == "published":
        downloads.append(f'<li>Film · arriving at <code>{E(video["url"])}</code> (bytes + SHA-256 in <a href="{E(ep["ledger"])}status.json">status.json</a> once uploaded)</li>')
    if has_audio(ep):
        downloads.append(f'<li>Audio · mono MP3 · <a href="{E(audio["url"])}" download>{E(audio["url"].rsplit("/", 1)[-1])}</a> · {audio["bytes"]:,} bytes</li>')
    if media.get("captions") and local(media["captions"]).exists():
        downloads.append(f'<li>Captions · <a href="{E(media["captions"])}">WebVTT</a></li>')
    if media.get("transcript") and local(media["transcript"]).exists():
        downloads.append(f'<li>Transcript · <a href="{E(media["transcript"])}">JSON</a>' + (f' · <a href="{E(ep["ledger"])}transcript/">readable</a>' if ep["id"] != "pilot" else "") + "</li>")
    if media.get("archive"):
        downloads.append(f'<li>Mirror · <a href="{E(media["archive"])}">archive.org ↗</a></li>')
    downloads.append(f'<li>Ledger · <a href="{E(ep["ledger"])}">{E(ep["ledgerTitle"])}</a></li>')
    dl = f'<details class="dl"><summary>Download · mirror · verify</summary><ul>{"".join(downloads)}</ul></details>' if not embed else ""
    return (f'<div class="player" data-player data-ep="{E(ep["id"])}" data-title="{E(ep["title"])}" data-duration="{ep.get("durationSeconds") or 0}" data-next="{E(next_ep["id"]) if next_ep else ""}" data-arriving="{1 if arriving else 0}">'
            f'{screen}<script type="application/json" data-chapters>{chapters_json}</script>'
            f'<ol class="chapters-bar js-only" aria-label="Chapters"></ol><p class="chapter-now js-only" aria-live="off"></p>'
            f'<div class="ctl js-only"></div><p class="player-status" aria-live="polite"></p><p class="keys js-only"></p>{dl}</div>')


# ───────────────────────────── pages ─────────────────────────────
def guide_card(ep: dict) -> str:
    state = visible(ep)
    poster = ep["media"].get("poster") or "/assets/watch/season1-og.jpg"
    wait = "" if has_film(ep) else '<span class="wait">film arriving</span>'
    href = f"./{ep['id']}/" if state == "published" else ep["ledger"]
    title = ep["title"] if state == "published" else f"{ep['title']}"
    body_links = (f'<a href="./{ep["id"]}/">Watch</a><a href="./{ep["id"]}/#transcript">Transcript</a><a href="{E(ep["ledger"])}">Ledger</a>' if state == "published" else f'<a href="{E(ep["ledger"])}">Ledger</a>')
    return (f'<li class="ep" data-ep="{E(ep["id"])}"><a class="poster" href="{href}" aria-hidden="true" tabindex="-1"><img src="{E(poster)}" alt="" loading="lazy" width="1280" height="720"><span class="num">{E(episode_label(ep)).upper()}</span><span class="len">{E(ep["durationLabel"])}</span>{wait}</a>'
            f'<div class="body"><span class="date">{E(ep["dateLabel"].split(" · ")[0])}</span><h3><a href="{href}">{E(title)}</a></h3><p>{E(ep["lede"])}</p>'
            f'<ul class="chips">{speaker_chips(ep)}{consent_chip(ep)}</ul><div class="links">{body_links}</div></div></li>')


def build_tv(season: dict, listed: list[dict]) -> str:
    show = season["show"]
    published = [ep for ep in listed if visible(ep) == "published"]
    with_film = [ep for ep in published if has_film(ep)]
    now = (with_film or published)[-1] if (with_film or published) else None
    rest = [ep for ep in published if ep is not now]
    up_next = rest[rest.index(now) + 1 if now in rest else 0:] + rest[: rest.index(now) + 1 if now in rest else 0] if rest else []
    # up next = the published episodes after "now" in season order, then wrap
    order = [ep for ep in published]
    if now in order:
        i = order.index(now)
        up_next = order[i + 1:] + order[:i]
    hero = ""
    if now:
        hero = (f'<section class="hero" aria-labelledby="now-title"><div><div class="now-head"><p class="kicker">Now playing · {E(episode_label(now))} · {E(now["dateLabel"].split(" · ")[0])}</p><h2 id="now-title"><a href="./{now["id"]}/">{E(now["title"])}</a></h2></div>'
                f'{player_html(now, up_next[0] if up_next else None)}<p class="keys">Open the <a href="./{now["id"]}/">episode page</a> for the karaoke transcript, the written words and the highlight reel.</p></div>'
                f'<aside><div id="continue" class="continue" hidden></div><p class="kicker">Up next</p><ol class="rail">' + "".join(f'<li><a href="./{E(ep["id"])}/"><img src="{E(ep["media"].get("poster") or "")}" alt="" loading="lazy" width="320" height="180"><b>{E(ep["title"])}</b><small>{E(episode_label(ep))} · {E(ep["durationLabel"])}{"" if has_film(ep) else " · film arriving"}</small></a></li>' for ep in up_next) + '</ol>'
                f'<p id="prefs" class="keys js-only"></p></aside></section>')
    guide = f'<section id="guide" aria-labelledby="guide-title"><p class="kicker">Episode guide</p><h2 id="guide-title">Season 1 · The Proposal Circles</h2><p class="lede">{E(show["synopsis"])}</p><ol class="guide">' + "".join(guide_card(ep) for ep in listed) + "</ol></section>"
    sw = show.get("words") or {}
    if sw.get("fieldGuide"):
        paras = lambda v: "".join(f"<p>{E(p.strip())}</p>" for p in re.split(r"\n\s*\n", v) if p.strip())
        field = (f'<section class="grid-2 field-guide" aria-label="Field guide"><div class="card"><h2>A field guide for new viewers</h2>{paras(sw["fieldGuide"])}<p class="keys">{E(sw.get("credit") or "")}</p></div>'
                 f'<div class="card"><h2>Join · listen · record your own</h2>{paras(sw.get("howToJoin") or "")}<p>Listen in any podcast app: <a href="/watch/feed.xml">/watch/feed.xml</a> (the mono MP3s, CC BY-SA 4.0).</p>'
                 f'<p>Record your circle the same way and add it to the ledger: <a href="{show["protocol"]["url"]}">{E(show["protocol"]["name"])}</a> · <a href="/watch/live/">the circle clock</a>.</p>'
                 '<p>Walk into <a href="/">the Hall</a> — the Three.js theater where these films shine on the projector — or read the <a href="/channels/">readable channels edition</a>.</p></div></section>')
        synopsis = sw.get("synopsis") or show["synopsis"]
        guide = guide.replace(f'<p class="lede">{E(show["synopsis"])}</p>', paras(synopsis).replace("<p>", '<p class="lede">', 1))
        return chrome(show, title="OSO PIT THEATER · Season 1 · The Proposal Circles — Open Source Orchestra DAO Meet", description="Every Open Source Orchestra DAO proposal circle as an episode: films with karaoke transcripts, written words, the Memory Garden and a podcast feed. Recorded with consent, first names only, free to fork. Still a proposal, not an on-chain DAO.", path="/watch/", body=f'<p class="kicker">Open Source Orchestra DAO Meet · the TV</p><h1>Season 1 · <em>The Proposal Circles.</em></h1><p class="lede">Watch the circles the way you would watch a show — then open the transcript, read the words, plant a seed in the garden. Still a proposal, not an on-chain DAO.</p>{hero}{guide}{field}', module="tv", current="tv")
    field = ('<section class="grid-2 field-guide" aria-label="Field guide"><div class="card"><h2>A field guide for new viewers</h2><ol>'
             '<li><strong>What you are watching.</strong> Real meetings, recorded on Google Meet, in which people talk through a <em>proposal</em> for an Open Source Orchestra DAO. Nothing is decided on camera; nothing here is on-chain.</li>'
             '<li><strong>How it was recorded.</strong> Notetakers enter first, consent is asked out loud on the recording, the host hits record last, nothing is cut, and nothing goes public until everyone has said yes and the transcript has been checked.</li>'
             '<li><strong>Who is who.</strong> First names or chosen display names only. Speaker labels are editorial, not voice identification, and can be imperfect. Machines in the room (transcription bots, this site) say they are machines.</li>'
             '<li><strong>What you can do with it.</strong> Download, mirror, quote, remix, subtitle, teach with it — share-alike (CC BY-SA 4.0 words and films, GPL-3.0 code). Credit the Open Source Orchestra and keep the takedown door open.</li></ol></div>'
             f'<div class="card"><h2>Join · listen · record your own</h2><p>Come as you are: the one public door is <a href="{show["join"]}">opensourceorchestra.org/join/</a>. No ticket, no conductor, every voice counts.</p>'
             '<p>Listen in any podcast app: <a href="/watch/feed.xml">/watch/feed.xml</a> (the mono MP3s, CC BY-SA 4.0).</p>'
             f'<p>Record your circle the same way and add it to the ledger: <a href="{show["protocol"]["url"]}">{E(show["protocol"]["name"])}</a> · <a href="/watch/live/">the circle clock</a>.</p>'
             '<p>Walk into <a href="/">the Hall</a> — the Three.js theater where these films shine on the projector — or read the <a href="/channels/">readable channels edition</a>.</p></div></section>')
    return chrome(show, title="OSO PIT THEATER · Season 1 · The Proposal Circles — Open Source Orchestra DAO Meet", description="Every Open Source Orchestra DAO proposal circle as an episode: films with karaoke transcripts, written words, the Memory Garden and a podcast feed. Recorded with consent, first names only, free to fork. Still a proposal, not an on-chain DAO.", path="/watch/", body=f'<p class="kicker">Open Source Orchestra DAO Meet · the TV</p><h1>Season 1 · <em>The Proposal Circles.</em></h1><p class="lede">Watch the circles the way you would watch a show — then open the transcript, read the words, plant a seed in the garden. Still a proposal, not an on-chain DAO.</p>{hero}{guide}{field}', module="tv", current="tv")


def words_html(ep: dict, words: dict) -> str:
    draft = words.get("draft") is True
    draft_note = ('<p class="note draft"><strong>Words in progress.</strong> The ʻohana is writing this episode\'s recap, quotes, chapters and glossary from the public transcript. What you see here is a placeholder; the full transcript below is the record.</p>' if draft else "")
    recap = "".join(f"<p>{E(p)}</p>" for p in words.get("recap", []))
    quotes = "".join(f'<li><q>{E(q["text"])}</q><small><a class="t" data-seek="{q["t"]}" href="?t={int(q["t"])}">{E(clock(q["t"]))}</a> · {E(q["who"])}</small></li>' for q in words.get("quotes", []))
    chapters = "".join(f'<li><a data-seek="{c["t"]}" href="?t={int(c["t"])}"><time>{E(clock(c["t"]))}</time><span>{E(c["title"])}</span></a></li>' for c in words.get("chapters", []))
    why = "".join(f"<li>{E(p)}</li>" for p in words.get("whyItMatters", []))
    glossary = "".join(f"<dt>{E(g['term'])}</dt><dd>{E(g['meaning'])}</dd>" for g in words.get("glossary", []))
    return (f'<section class="words" id="words" aria-labelledby="words-title"><div><p class="kicker">The written words · by the AI ʻohana · CC BY-SA 4.0</p><h2 id="words-title">What this circle talked about</h2>{draft_note}<p class="lede">{E(words.get("blurb", ep["lede"]))}</p></div>'
            + (f'<div class="card"><h3>Chapters</h3><ol class="chapter-list">{chapters}</ol></div>' if chapters else "")
            + (f'<div class="card"><h3>Recap</h3>{recap}</div>' if recap else "")
            + (f'<div class="card"><h3>Moments, in their own words</h3><ul class="quotes">{quotes}</ul></div>' if quotes else "")
            + (f'<div class="card"><h3>Why this matters</h3><ul>{why}</ul></div>' if why else "")
            + (f'<div class="card"><h3>Glossary for newcomers</h3><dl class="glossary">{glossary}</dl></div>' if glossary else "")
            + "</section>")


def transcript_html(ep: dict, cues: list[dict], provenance: str) -> str:
    if not cues:
        return (f'<section class="transcript" id="transcript" aria-labelledby="t-title"><p class="kicker">Karaoke transcript</p><h2 id="t-title">Transcript arriving</h2>'
                f'<p class="note soft">The public-safe transcript for this circle is being prepared: automatic transcription on the ʻohana\'s own machine, then an editorial pass (first-name speaker labels, surnames and contact details removed). It appears here and in <a href="{E(ep["ledger"])}transcript/">the ledger</a> the moment it is checked.</p></section>')
    lines = []
    for c in cues:
        who = f'<b class="who">{E(c["who"])}</b>' if c["who"] else '<b class="who">—</b>'
        lines.append(f'<li data-start="{c["start"]:.2f}" data-end="{c["end"]:.2f}"><a class="t" href="?t={int(c["start"])}" title="Play from {E(clock(c["start"]))}">{E(clock(c["start"]))}</a>{who}<span class="txt">{E(c["text"])}</span></li>')
    prov = ("Automatic transcript · editorial pass pending (speaker labels not yet assigned; wording may be imperfect)." if provenance == "whisper" else f"{E(ep.get('speakersNote') or 'first names only')}.")
    return (f'<section class="transcript" id="transcript" aria-labelledby="t-title"><p class="kicker">Karaoke transcript · {len(cues):,} lines</p><h2 id="t-title">Every word, with its moment</h2>'
            f'<p class="note soft">{prov} Click a time to play from there; the lit line follows playback. Without JavaScript the whole transcript is simply here to read. Double-click a line to copy it.</p>'
            f'<div class="t-tools js-only"><label class="sr-only" for="t-search">Search this transcript</label><input id="t-search" type="search" placeholder="Search this transcript…" autocomplete="off"><span class="count"></span></div>'
            f'<ol class="lines" aria-label="Transcript lines">{"".join(lines)}</ol></section>')


def reel_html(ep: dict) -> str:
    hl = ep["media"].get("highlight") or {}
    wide = f'<video controls preload="none" playsinline src="{E(hl["wide"])}" poster="{E(ep["media"].get("poster") or "")}"></video>' if hl.get("wide") else f'<div class="slot wide">16:9 highlight reel<br><small>{E(hl.get("note") or "arriving")}</small></div>'
    tall = f'<video controls preload="none" playsinline src="{E(hl["tall"])}"></video>' if hl.get("tall") else f'<div class="slot tall">9:16 cut<br><small>for phones and stories</small></div>'
    return f'<section class="reel-wrap" aria-labelledby="reel-title"><p class="kicker">Highlight reel · 60–120 s · cut from the public transcript</p><h2 id="reel-title">The reel</h2><div class="reel">{wide}{tall}</div><p class="keys">Reels are cut by the ʻohana from consented moments only, with burned captions, a credit card and a license card; Shaka can refine any cut in DaVinci Resolve from the exported timeline. CC BY-SA 4.0.</p></section>'


def build_episode(season: dict, listed: list[dict], ep: dict, words: dict, cues: list[dict], provenance: str) -> str:
    show = season["show"]
    published = [e for e in listed if visible(e) == "published"]
    idx = published.index(ep)
    next_ep = published[idx + 1] if idx + 1 < len(published) else None
    prev_ep = published[idx - 1] if idx > 0 else None
    consent = ep["consent"]
    rail = "".join(f'<li><a href="../{E(e["id"])}/"><img src="{E(e["media"].get("poster") or "")}" alt="" loading="lazy" width="320" height="180"><b>{E(e["title"])}</b><small>{E(episode_label(e))} · {E(e["durationLabel"])}</small></a></li>' for e in published if e is not ep)
    credits = (f'<section class="credits" aria-labelledby="credits-title"><p class="kicker">Credits · consent · takedown</p><h2 id="credits-title">Who made this</h2>'
               f'<p><strong>In the circle:</strong> {E(", ".join(ep["speakers"]))}{" · machines in the room: " + E(", ".join(ep["machines"])) if ep.get("machines") else ""}. {E(ep.get("speakersNote") or "")}</p>'
               f'<p><strong>Consent:</strong> {E(consent["line"])}</p>'
               f'<p><strong>Recording:</strong> {E(ep["dateLabel"])} · {E(ep["durationLabel"])}. The raw original stays private; the public 720p film streams from {E(ep["media"]["video"].get("host") or "the theater host")}.</p>'
               f'<p><strong>Words, posters and reels:</strong> the AI ʻohana — machines, labelled as machines — from the public transcript, at Shaka\'s direction. Poster art made by the ʻohana, CC BY-SA 4.0. Nothing here is a decision, a membership list or legal advice.</p>'
               f'<p><strong>Takedown first:</strong> if you are in this recording and want anything removed or corrected, <a href="{show["takedown"]}">opensourceorchestra.org/takedown/</a> wins before any question is asked.</p>'
               f'<div class="links"><a href="{E(ep["ledger"])}">Ledger entry</a>' + "".join(f'<a href="{E(l["url"])}">{E(l["label"])}</a>' for l in ep.get("links", [])[:4]) + f'<a href="/watch/embed/{E(ep["id"])}/">Embed this episode</a><a href="/?channel={E(ep["channel"])}">Watch in the Hall</a></div></section>')
    prev_link = f'<a href="../{E(prev_ep["id"])}/">← {E(prev_ep["title"])}</a>' if prev_ep else ""
    next_link = f'<a href="../{E(next_ep["id"])}/">Up next: {E(next_ep["title"])} →</a>' if next_ep else ""
    nav = f'<nav class="links" aria-label="Episodes">{prev_link}<a href="../">All episodes</a>{next_link}</nav>'
    head = (f'<header class="ep-head"><p class="kicker">Season 1 · {E(episode_label(ep))} · {E(ep["dateLabel"])}</p><h1>{E(ep["title"])}</h1><p class="lede">{E(ep["tagline"])}</p>'
            f'<ul class="chips"><li>{E(ep["durationLabel"])}</li>{speaker_chips(ep)}{consent_chip(ep)}<li>still a proposal</li></ul></header>')
    body = (head + f'<div class="layout"><div>{player_html(ep, next_ep)}{nav}{words_html(ep, words)}{reel_html(ep)}{credits}</div>'
            f'<div class="sticky">{transcript_html(ep, cues, provenance)}<p class="kicker" style="margin-top:18px">More episodes</p><ol class="rail">{rail}</ol></div></div>')
    desc = f"{ep['title']} — {ep['lede'][:150].rstrip()}… Recorded {ep['dateLabel'].split(' · ')[0]} with consent, first names only. Film, karaoke transcript and written words. Still a proposal, not an on-chain DAO."
    extra = f'<link rel="prev" href="../{prev_ep["id"]}/">' if prev_ep else ""
    extra += f'<link rel="next" href="../{next_ep["id"]}/">' if next_ep else ""
    return chrome(show, title=f"{ep['title']} · {episode_label(ep)} · OSO PIT THEATER", description=desc, path=f"/watch/{ep['id']}/", body=body, module="episode", image=ep["media"].get("poster"), extra_head=extra)


def build_embed(season: dict, listed: list[dict], ep: dict) -> str:
    show = season["show"]
    published = [e for e in listed if visible(e) == "published"]
    idx = published.index(ep)
    next_ep = published[idx + 1] if idx + 1 < len(published) else None
    body = player_html(ep, next_ep, embed=True) + f'<div class="embed-foot"><a href="/watch/{E(ep["id"])}/" target="_top">{E(ep["title"])} · OSO PIT THEATER ↗</a><span>recorded with consent · first names only · CC BY-SA 4.0</span><a href="{show["takedown"]}" target="_top">takedown first</a></div>'
    page = chrome(show, title=f"{ep['title']} · embed · OSO PIT THEATER", description=ep["lede"][:160], path=f"/watch/embed/{ep['id']}/", body=body, module="embed", image=ep["media"].get("poster"), body_class="embed", noindex=True)
    # the embed keeps the chrome minimal: strip header/footer but keep lang.js and the values line in a tooltip-free footer
    page = re.sub(r'<header class="w-top wrap">.*?</header>\n', "", page, flags=re.S)
    page = re.sub(r'<footer class="w-foot wrap">.*?</footer>\n', "", page, flags=re.S)
    return page


def build_search(season: dict, listed: list[dict]) -> str:
    show = season["show"]
    published = [e for e in listed if visible(e) == "published" and (e["media"].get("transcript") and local(e["media"]["transcript"]).exists())]
    fallback = "".join(f'<li><a href="{E(e["ledger"])}transcript/">{E(e["title"])} · full transcript</a></li>' if e["id"] != "pilot" else f'<li><a href="{E(e["media"]["transcript"])}">{E(e["title"])} · transcript JSON</a> · <a href="https://archive.org/download/oso-weekly-call-2-2026-10-27/weekly-call-2-2026-10-27-transcript.txt">plain text ↗</a></li>' for e in published)
    body = (f'<p class="kicker">Search</p><h1>Every public <em>transcript</em>, one box.</h1><p class="lede">Type a word, a first name, a place or an instrument. Each result opens the film at that exact moment. The index is built from consented transcripts only and searched entirely in your browser.</p>'
            f'<form id="search-form" class="search-box js-only" role="search" action="./"><label class="sr-only" for="q">Search the transcripts</label><input id="q" name="q" type="search" placeholder="e.g. Lisbon · backline · consent · Ben" autocomplete="off"><div id="filters" class="filters" aria-label="Episodes to search"></div></form>'
            f'<p class="results-status" aria-live="polite"></p><ol id="results" class="results" aria-label="Results"></ol>'
            f'<section class="no-js-only"><h2>Read the transcripts</h2><p class="lede">Search needs JavaScript; the transcripts never do.</p><ul>{fallback}</ul></section>'
            f'<section class="card"><h2>How the index is made</h2><p><code>scripts/build_watch.py</code> reads every published transcript (<code>meetings/N/transcript/transcript.json</code>, <code>data/transcripts/*.json</code>, and checked whisper drafts) and writes <a href="/data/search-index.json">data/search-index.json</a>. Gated or pending circles are never indexed. Takedown first: <a href="{show["takedown"]}">opensourceorchestra.org/takedown/</a>.</p></section>')
    return chrome(show, title="Search every transcript · OSO PIT THEATER", description="Search every public Open Source Orchestra DAO Meet transcript in your browser; each result opens the film at that moment. Consented transcripts only, first names only.", path="/watch/search/", body=body, module="search", current="search")


def garden_svg(seeds: list[dict], pending: int) -> str:
    width, height = 1200, 520
    n = len(seeds)
    ground = 440
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" aria-labelledby="garden-svg-title garden-svg-desc" focusable="false">',
             f'<title id="garden-svg-title">The Memory Garden — {n} seeds</title><desc id="garden-svg-desc">A night garden. Each plant is one real sentence from a public circle about a moment of music that made someone feel they belonged. {pending} plots wait for the next circles.</desc>',
             '<defs><radialGradient id="g-moon" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f6daa0" stop-opacity=".9"/><stop offset="1" stop-color="#f6daa0" stop-opacity="0"/></radialGradient><linearGradient id="g-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2230"/><stop offset="1" stop-color="#1a1022"/></linearGradient></defs>']
    rnd = hashlib.sha256
    for i in range(70 + n * 6):
        h = int(rnd(f"star{i}".encode()).hexdigest()[:8], 16)
        parts.append(f'<circle cx="{h % width}" cy="{(h >> 8) % (ground - 60)}" r="{0.6 + ((h >> 16) % 10) / 10:.1f}" fill="#f6daa0" opacity="{0.25 + ((h >> 20) % 50) / 100:.2f}"/>')
    parts.append(f'<circle cx="{width - 160}" cy="90" r="70" fill="url(#g-moon)"/><circle cx="{width - 160}" cy="90" r="26" fill="#f6daa0" opacity=".85"/>')
    parts.append(f'<path d="M0 {ground} Q {width / 2} {ground - 40} {width} {ground} L {width} {height} L 0 {height} Z" fill="url(#g-ground)"/>')
    parts.append(f'<path d="M0 {ground} Q {width / 2} {ground - 40} {width} {ground}" fill="none" stroke="#e5c17b" stroke-opacity=".5" stroke-width="2"/>')
    palette = {"first time": "#f6daa0", "together": "#f0a9b8", "heartbeat": "#e5c17b", "jam": "#bfe5cf", "received": "#f0a9b8", "warm": "#e5c17b"}
    total_slots = max(n + pending, 1)
    for i, seed in enumerate(seeds):
        x = 90 + (width - 180) * (i + 0.5) / total_slots
        h = int(rnd(seed["id"].encode()).hexdigest()[:8], 16)
        tall = 120 + (h % 90)
        y0 = ground - 12 + ((h >> 8) % 18)
        colour = palette.get(seed.get("kind", ""), "#f6daa0")
        lean = -14 + (h >> 12) % 28
        label = f"Seed from {seed['who']}, episode {seed['episode'].upper()} at {clock(seed['t'])}: {seed['text'][:90]}…"
        parts.append(f'<g class="seed-plant" data-seed="{E(seed["id"])}" tabindex="0" role="button" aria-label="{E(label)}"><title>{E(seed["who"])} · {E(seed["episode"].upper())} · {E(clock(seed["t"]))}</title>'
                     f'<path d="M{x:.0f} {y0} Q {x + lean:.0f} {y0 - tall * 0.5:.0f} {x + lean * 0.6:.0f} {y0 - tall:.0f}" fill="none" stroke="#9fc9a8" stroke-width="3" stroke-linecap="round"/>'
                     f'<path d="M{x + lean * 0.3:.0f} {y0 - tall * 0.45:.0f} q -26 -6 -30 -30 q 24 2 30 30z" fill="#7fb38a" opacity=".9"/><path d="M{x + lean * 0.45:.0f} {y0 - tall * 0.7:.0f} q 26 -8 32 -30 q -26 0 -32 30z" fill="#7fb38a" opacity=".9"/>')
        cx, cy = x + lean * 0.6, y0 - tall
        parts.append(f'<g class="bloom">' + "".join(f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="7" ry="16" fill="{colour}" opacity=".92" transform="rotate({k * 45} {cx:.0f} {cy:.0f}) translate(0 -12)"/>' for k in range(8)) + f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="7" fill="#f7eedc"/></g>')
        parts.append(f'<text x="{cx:.0f}" y="{y0 + 26}" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="#e5c17b">{E(seed["who"])}</text><text x="{cx:.0f}" y="{y0 + 44}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#c4b6c5" letter-spacing="1">{E(seed["episode"].upper())} · {E(clock(seed["t"]))}</text></g>')
    for j in range(pending):
        x = 90 + (width - 180) * (n + j + 0.5) / total_slots
        parts.append(f'<g aria-hidden="true"><ellipse cx="{x:.0f}" cy="{ground + 2}" rx="26" ry="7" fill="none" stroke="#e5c17b" stroke-opacity=".5" stroke-dasharray="4 4"/><circle cx="{x:.0f}" cy="{ground - 2}" r="4" fill="#e5c17b" opacity=".7"/><text x="{x:.0f}" y="{ground + 30}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#8f8392" letter-spacing="1">NEXT CIRCLE</text></g>')
    parts.append("</svg>")
    return "".join(parts)


def build_garden(season: dict, listed: list[dict], garden: dict) -> str:
    show = season["show"]
    by_id = {e["id"]: e for e in listed}
    seeds = [s for s in garden.get("seeds", []) if visible(by_id.get(s["episode"], {})) == "published"]
    pending = [p for p in garden.get("pending", []) if by_id.get(p["episode"])]
    cards = "".join(f'<li class="seed" id="{E(s["id"])}"><q>{E(s["text"])}</q><div class="who"><span>{E(s["who"])}</span><a href="../{E(s["episode"])}/?t={int(s["t"])}">{E(by_id[s["episode"]]["title"])} · {E(clock(s["t"]))}</a></div><small>{E(s.get("place") or "")}{" · " + E(s["note"]) if s.get("note") else ""}</small></li>' for s in seeds)
    pend = "".join(f'<li><strong>{E(by_id[p["episode"]]["title"])}</strong> — {E(p["note"])}</li>' for p in pending)
    body = (f'<p class="kicker">The Memory Garden · {len(seeds)} seeds</p><h1>One beautiful moment of music that made you feel <em>you belonged.</em></h1><p class="lede">{E(garden["framing"])}</p>'
            f'<div class="garden-stage" role="group" aria-label="The garden">{garden_svg(seeds, len(pending))}</div>'
            f'<p class="garden-count"><b>{len(seeds)}</b> seeds from {len({s["episode"] for s in seeds})} circles · {len(pending)} plots waiting · tap a plant to read its seed · <a href="{show["join"]}">plant yours by joining the next circle</a></p>'
            f'<section aria-labelledby="seeds-title"><h2 id="seeds-title">The seeds, in their own words</h2><ol class="seeds">{cards}</ol></section>'
            f'<section class="grid-2"><div class="card"><h2>Waiting to be planted</h2><ul>{pend}</ul></div><div class="card"><h2>About this garden</h2><p>{E(garden["tribute"]["note"])} <a href="{E(garden["tribute"]["url"])}">Read about the Infinite Garden ↗</a></p><p>{E(garden["consent"])}</p><p>{E(garden["license"])}</p></div></section>')
    return chrome(show, title="The Memory Garden · OSO PIT THEATER", description="Every answer to “one beautiful moment of music that made you feel you belonged” becomes a seed. Real sentences from consented transcripts, first names only, timestamped. A tribute to the Infinite Garden idea; it grows with every circle.", path="/watch/garden/", body=body, module="garden", current="garden")


def build_live(season: dict, listed: list[dict], live: dict) -> str:
    show = season["show"]
    by_id = {e["id"]: e for e in listed}
    nxt = live.get("next")
    clock_html = (f'<div id="clock" class="clock" data-next="{E(nxt)}"><p class="kicker">Next circle</p><p class="big"><span>—</span></p><small id="clock-local"><time datetime="{E(nxt)}">{E(nxt)}</time></small></div>' if nxt else
                  f'<div id="clock" class="clock"><p class="kicker">Next circle</p><p class="big">{E(live.get("nextLabel") or "to be announced")}</p><small>{E(live.get("cadence") or "")}</small></div>')
    steps = "".join(f"<li>{E(s)}</li>" for s in live["record"]["steps"])
    past = "".join(f'<li><time datetime="{E(p["at"])}">{E(p["at"].replace("T", " ").replace("Z", " UTC"))}</time><span class="local"></span>' + (f' <a href="../{E(p["episode"])}/">{E(by_id[p["episode"]]["title"])}</a>' if visible(by_id.get(p["episode"], {})) == "published" else f' <span>{E(by_id[p["episode"]]["title"]) if visible(by_id.get(p["episode"], {})) == "pending" else "a circle was held · consent being confirmed"}</span>') + "</li>" for p in live.get("past", []) if p["episode"] in by_id and visible(by_id[p["episode"]]) != "hidden")
    body = (f'<p class="kicker">Live · the circle clock</p><h1>When is the next <em>circle?</em></h1><p class="lede">{E(live.get("timezoneNote") or "")} The join page is the only door — no meeting link is ever published here.</p>{clock_html}'
            f'<section class="grid-2"><div class="card"><h2>Join</h2><p>{E(live["join"]["note"])}</p><p><a class="btn primary" href="{E(live["join"]["url"])}">{E(live["join"]["label"])}</a></p></div>'
            f'<div class="card"><h2>Record your circle the same way</h2><ol class="steps">{steps}</ol><p><a class="btn" href="{E(live["record"]["url"])}">{E(live["record"]["label"])}</a></p></div></section>'
            f'<section><h2>Circles so far</h2><ol class="past">{past}</ol></section>')
    return chrome(show, title="Live · the circle clock · OSO PIT THEATER", description="When the next Open Source Orchestra DAO proposal circle meets, the one public way to join, and how to record your own circle the consent-first way.", path="/watch/live/", body=body, module="live", current="live")


def build_feed(season: dict, listed: list[dict]) -> str:
    show = season["show"]
    items = []
    for ep in listed:
        if not has_audio(ep):
            continue
        audio = ep["media"]["audio"]
        url = audio["url"] if audio["url"].startswith("http") else HOST + audio["url"]
        pub = dt.datetime.fromisoformat(ep["recordedAt"].replace("Z", "+00:00")).strftime("%a, %d %b %Y %H:%M:%S +0000")
        page = f"{HOST}/watch/{ep['id']}/"
        items.append(f"""    <item>
      <title>{E(episode_label(ep))} · {E(ep['title'])}</title>
      <link>{page}</link>
      <guid isPermaLink="true">{page}</guid>
      <pubDate>{pub}</pubDate>
      <description>{E(ep['lede'])} Recorded {E(ep['dateLabel'])} with consent asked out loud; first names only. {E(ep['consent']['line'])} Still a proposal, not an on-chain DAO. CC BY-SA 4.0.</description>
      <enclosure url="{E(url)}" length="{audio['bytes']}" type="audio/mpeg"/>
      <itunes:duration>{E(clock(ep['durationSeconds']))}</itunes:duration>
      <itunes:episode>{ep['number'] if ep['id'] != 'pilot' else 0}</itunes:episode>
      <itunes:season>1</itunes:season>
      <itunes:explicit>false</itunes:explicit>
      <itunes:image href="{HOST}{E(ep['media'].get('poster') or show['artwork'])}"/>
    </item>""")
    built = dt.datetime.now(dt.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:cc="http://web.resource.org/cc/">
  <channel>
    <title>OSO PIT THEATER · Season 1 · The Proposal Circles</title>
    <link>{HOST}/watch/</link>
    <atom:link href="{HOST}/watch/feed.xml" rel="self" type="application/rss+xml"/>
    <language>en</language>
    <description>{E(show['synopsis'])} Audio of every consented Open Source Orchestra DAO proposal circle (mono MP3). First names only; takedown first. Made by Shaka's AI ʻohana — machines, labelled as machines.</description>
    <copyright>CC BY-SA 4.0 · Open Source Orchestra and the people in each circle · share-alike</copyright>
    <cc:license>https://creativecommons.org/licenses/by-sa/4.0/</cc:license>
    <lastBuildDate>{built}</lastBuildDate>
    <itunes:author>Open Source Orchestra</itunes:author>
    <itunes:summary>{E(show['synopsis'])}</itunes:summary>
    <itunes:type>serial</itunes:type>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="Music"><itunes:category text="Music Commentary"/></itunes:category>
    <itunes:category text="Society &amp; Culture"/>
    <itunes:image href="{HOST}{show['artwork']}"/>
    <image><url>{HOST}{show['artwork']}</url><title>OSO PIT THEATER · Season 1</title><link>{HOST}/watch/</link></image>
{chr(10).join(items)}
  </channel>
</rss>
"""


def merge_sitemap(urls: list[tuple[str, str]]) -> str:
    path = ROOT / "sitemap.xml"
    existing = path.read_text(encoding="utf-8") if path.exists() else '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n'
    entries = dict(re.findall(r"<url><loc>([^<]+)</loc><lastmod>([^<]+)</lastmod></url>", existing))
    for loc, lastmod in urls:
        entries[loc] = lastmod
    body = "".join(f"  <url><loc>{loc}</loc><lastmod>{mod}</lastmod></url>\n" for loc, mod in entries.items())
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}</urlset>\n'


# ───────────────────────────── main ─────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="report what would change; write nothing")
    parser.add_argument("--whisper-dir", default="/workspace/theater-v3/transcripts", help="where meet{N}-whisper.json drafts may appear")
    parser.add_argument("--words-dir", default="/workspace/theater-v3/words", help="where finished <ep>.words.json may appear (copied into data/season1/)")
    args = parser.parse_args()
    problems: list[str] = []
    today = dt.date.today().isoformat()

    season = read_json(ROOT / "data/season1/season.json")
    garden = read_json(ROOT / "data/season1/garden.json")
    live = read_json(ROOT / "data/season1/live.json")
    show = season["show"]
    episodes = season["episodes"]
    for ep in episodes:
        for origin_key in ("video", "audio"):
            url = (ep.get("media") or {}).get(origin_key, {}).get("url") or ""
            if url.startswith("http") and not any(url.startswith(o) for o in season["mediaOrigins"]):
                problems.append(f"{ep['id']}: {origin_key} origin not allowed: {url}")
    listed = [ep for ep in episodes if visible(ep) != "hidden"]
    hidden = [ep["id"] for ep in episodes if visible(ep) == "hidden"]
    if hidden:
        print(f"  gated / hidden (no title, no speakers rendered): {', '.join(hidden)}")

    # transcripts (public first, whisper drafts second)
    transcripts: dict[str, tuple[list[dict], str]] = {}
    for ep in listed:
        transcripts[ep["id"]] = load_transcript(ep, Path(args.whisper_dir), problems)

    # finished words from the words lane → data/season1/ (normalized; quotes/seeds verified verbatim against the transcript; draft flag respected)
    words_dir = Path(args.words_dir)
    words: dict[str, dict] = {}
    lane_seeds: list[dict] = []
    for ep in listed:
        target = local(ep["words"])
        candidate = words_dir / f"{ep['id']}.words.json"
        cues, _prov = transcripts[ep["id"]]
        if candidate.exists():
            try:
                data = normalize_words(read_json(candidate), ep)
                assert data["episode"] == ep["id"], f"episode mismatch {data['episode']}"
                for q in data["quotes"] + data["seeds"]:
                    assert not PRIVATE.search(q["text"]), f"private detail in quote at {q['t']}"
                    assert re.match(r"^[A-Z][A-Za-z' -]{0,30}( \((bot|machine|transcription bot)\))?$", q["who"]), f"speaker label not a first name (or a labelled machine): {q['who']}"
                    if cues:
                        assert verbatim(q["text"], cues, q["t"]), f"quote at {clock(q['t'])} is not verbatim in the transcript: {q['text'][:50]}"
                        near = [c for c in cues if abs(c["start"] - q["t"]) < 0.6]
                        assert near, f"no transcript line starts at {q['t']}"
                write(target, json.dumps(data, ensure_ascii=False, indent=2) + "\n")
                words[ep["id"]] = data
                for seed in data["seeds"]:
                    lane_seeds.append({"id": f"{ep['id']}-{int(seed['t'])}", "episode": ep["id"], "who": seed["who"], "t": seed["t"], "text": seed["text"], "kind": "together", "source": "words lane · verified verbatim against the public transcript"})
                print(f"  words: {ep['id']} ← {candidate} ({len(data['recap'])} recap paragraphs · {len(data['quotes'])} quotes · {len(data['seeds'])} seeds)")
                continue
            except (AssertionError, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
                problems.append(f"{ep['id']}: words file in {words_dir} rejected ({error}); keeping the current one")
        words[ep["id"]] = normalize_words(read_json(target), ep) if target.exists() else normalize_words({"draft": True}, ep)
    season_words = None
    if (words_dir / "season.words.json").exists():
        try:
            season_words = read_json(words_dir / "season.words.json")
            write(ROOT / "data/season1/season.words.json", json.dumps(season_words, ensure_ascii=False, indent=2) + "\n")
        except json.JSONDecodeError as error:
            problems.append(f"season.words.json rejected ({error})")
    elif (ROOT / "data/season1/season.words.json").exists():
        season_words = read_json(ROOT / "data/season1/season.words.json")
    show["words"] = season_words or {}
    # garden: hand-mined seeds + the words lane's seeds (deduplicated by episode+time; all verbatim-checked above or in garden.json)
    known = {(x["episode"], int(x["t"])) for x in garden.get("seeds", [])}
    for seed in lane_seeds:
        if (seed["episode"], int(seed["t"])) not in known:
            garden.setdefault("seeds", []).append(seed)
            known.add((seed["episode"], int(seed["t"])))
    garden["seeds"].sort(key=lambda x: (listed.index(next(e for e in listed if e["id"] == x["episode"])), x["t"]))
    garden["updated"] = today
    write(ROOT / "data/season1/garden.json", json.dumps(garden, ensure_ascii=False, indent=2) + "\n")

    # search index — published episodes only
    index_lines = []
    index_eps = {}
    for ep in listed:
        cues, provenance = transcripts[ep["id"]]
        if visible(ep) != "published" or not cues:
            continue
        index_eps[ep["id"]] = {"title": ep["title"], "short": f"{short_label(ep)} · {ep['title']}", "url": f"/watch/{ep['id']}/", "poster": ep["media"].get("poster"), "provenance": provenance}
        for c in cues:
            if c["text"].strip():
                index_lines.append([ep["id"], round(c["start"], 1), round(c["end"], 1), c["who"], c["text"].strip()])
    write(ROOT / "data/search-index.json", json.dumps({"schema": "oso-pit-theater-search-index-v1", "built": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "license": "CC BY-SA 4.0", "takedown": show["takedown"], "episodes": index_eps, "lines": index_lines}, ensure_ascii=False, separators=(",", ":")) + "\n")

    # pages
    write(ROOT / "watch/index.html", build_tv(season, listed))
    write(ROOT / "watch/search/index.html", build_search(season, listed))
    write(ROOT / "watch/garden/index.html", build_garden(season, listed, garden))
    write(ROOT / "watch/live/index.html", build_live(season, listed, live))
    write(ROOT / "watch/feed.xml", build_feed(season, listed))
    urls = [(f"{HOST}/watch/", today), (f"{HOST}/watch/search/", today), (f"{HOST}/watch/garden/", today), (f"{HOST}/watch/live/", today)]
    for ep in listed:
        if visible(ep) != "published":
            continue
        cues, provenance = transcripts[ep["id"]]
        write(ROOT / f"watch/{ep['id']}/index.html", build_episode(season, listed, ep, words[ep["id"]], cues, provenance))
        write(ROOT / f"watch/embed/{ep['id']}/index.html", build_embed(season, listed, ep))
        urls.append((f"{HOST}/watch/{ep['id']}/", today))
    for n in (4, 5):
        if (ROOT / f"meetings/{n}/index.html").exists():
            urls.append((f"{HOST}/meetings/{n}/", today))
    write(ROOT / "sitemap.xml", merge_sitemap(urls))

    # episode JSON for other doors (public, consent-filtered — what the TV itself renders)
    public_season = {**season, "episodes": [({**ep} if visible(ep) == "published" else {"id": ep["id"], "number": ep["number"], "title": ep["title"], "dateLabel": ep["dateLabel"], "durationLabel": ep["durationLabel"], "speakers": ep["speakers"], "consent": {"status": PENDING}} if visible(ep) == "pending" else {"id": ep["id"], "number": ep["number"], "consent": {"status": GATED}, "note": "circle held · consent being confirmed"}) for ep in episodes]}
    write(ROOT / "data/season1/public.json", json.dumps(public_season, ensure_ascii=False, indent=1) + "\n")

    changed = flush(args.check)
    print(f"build_watch: {len(WRITTEN)} files · {changed} changed · {len(index_lines):,} searchable lines · {len([e for e in listed if visible(e) == 'published'])} published episodes")
    for problem in problems:
        print(f"  ⚠ {problem}")
    if args.check and changed:
        return 1
    return 2 if any("REFUSED" in p or "not allowed" in p for p in problems) else 0


if __name__ == "__main__":
    sys.exit(main())
