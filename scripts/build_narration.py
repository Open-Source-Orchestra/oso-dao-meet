#!/usr/bin/env python3
"""Build the optional, explicitly authorized AI-steward narrated deck.

Default: validate existing local audio and regenerate captions, transcript and runtime data.
--synthesize: create only missing/stale movement audio through the existing Fish lane.
There is deliberately NO edge-tts or other voice fallback, and this script never sends media.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "scripts/narration-source.json"
OUT = ROOT / "assets/narration"
STATIC = ROOT / "narration"
DATA = ROOT / "data/narration.json"
META = OUT / "generation.json"
DISCLOSURE = "AI-agent-steward synthetic narration authorized by Shaka; not a live or new recording of Shaka. An AI speaker, not human presence or meeting attendance; based only on cited public records."


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def sha(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def digest(text: str):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def speech_text(text: str):
    """Natural AI/DAO transcript typography, explicit letter pronunciation for TTS."""
    return re.sub(r"\bAI\b", "A I", re.sub(r"\bDAO\b", "D A O", text))


def check(condition, message):
    if not condition:
        raise ValueError(message)


def check_source(source, deck):
    check(source["schema"] == "oso-ai-steward-narration-source-v1", "unexpected narration schema")
    check(source["disclosure"] == DISCLOSURE, "the required exact disclosure changed")
    slide_ids = [slide["id"] for slide in deck["slides"]]
    check([slide["id"] for slide in source["slides"]] == slide_ids, "narration must match all twelve deck movements in order")
    blocked = re.compile(r"meet\.google|zoom\.us|@gmail|BEGIN PRIVATE KEY|seed phrase:|/workspace/vault|/shared/letters|unsent invite|private diary", re.I)
    for slide in source["slides"]:
        text = slide.get("text", "")
        check(60 <= len(text.split()) <= 230, f"{slide['id']}: keep narration between 60 and 230 words")
        check(not blocked.search(text), f"{slide['id']}: forbidden private/internal material")
        check(slide.get("sources"), f"{slide['id']}: claim-level sources required")
        for ref in slide["sources"]:
            check(ref.get("claim") and ref.get("label"), f"{slide['id']}: incomplete source claim")
            check(ref.get("url", "").startswith("https://"), f"{slide['id']}: source must be public HTTPS")
    check("synthetic narration that Shaka authorized" in source["slides"][0]["text"], "spoken intro must disclose authorized synthetic narration")
    check("not a live or new recording of Shaka" in source["slides"][0]["text"], "spoken intro must say this is not a live/new Shaka recording")
    check("meeting attendee" in source["slides"][0]["text"], "spoken intro must reject simulated meeting attendance")


def split_chunks(text: str, max_length: int = 650):
    """Natural sentence/paragraph chunks, matching the authorized hug-voice lane."""
    chunks, current = [], ""
    for paragraph in [p.strip() for p in text.split("\n") if p.strip()]:
        for sentence in re.split(r"(?<=[.!?])\s+", paragraph):
            if len(sentence) > max_length:
                words = sentence.split()
                piece = ""
                for word in words:
                    if piece and len(piece) + len(word) + 1 > max_length:
                        chunks.append(piece)
                        piece = ""
                    piece = f"{piece} {word}".strip()
                if current:
                    chunks.append(current.strip())
                    current = ""
                if piece:
                    chunks.append(piece)
            elif current and len(current) + len(sentence) + 1 > max_length:
                chunks.append(current.strip())
                current = sentence
            else:
                current = f"{current} {sentence}".strip()
        if current:
            chunks.append(current.strip())
            current = ""
    return [chunk for chunk in chunks if chunk]


def run(command, **kwargs):
    return subprocess.run(command, check=True, **kwargs)


def duration(path: Path):
    result = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return round(float(result.stdout.strip()), 3)


def synthesize(slide, ordinal: int, output: Path, model: str, work: Path):
    import sys as _sys
    _sys.path.insert(0, "/workspace/ohana-totem")
    import tts  # the same authorized Fish reference/credential lane as hug-voice.py

    check(tts.voice_for("shaka") == "fish:clone", "Shaka's authorized Fish voice is not selected; refusing a substitute")
    check(tts.FISH_MODEL == model, "configured synthesis model changed; update provenance intentionally")
    parts = split_chunks(slide["text"])
    part_dir = work / f"{ordinal:02d}-{slide['id']}"
    part_dir.mkdir(parents=True, exist_ok=True)
    part_files = []
    for number, text in enumerate(parts, 1):
        part = part_dir / f"part-{number:02d}.mp3"
        expected_hash = digest(text)
        hash_file = part_dir / f"part-{number:02d}.sha256"
        if not (part.exists() and part.stat().st_size >= 2000 and hash_file.exists() and hash_file.read_text() == expected_hash):
            last_error = None
            for attempt in range(1, 4):
                try:
                    # Directly use Fish, never tts.synth's edge fallback.
                    tts._synth_fish(text, part)
                    hash_file.write_text(expected_hash)
                    break
                except Exception as error:
                    last_error = error
                    print(f"[narration] {slide['id']} part {number}, attempt {attempt} failed: {type(error).__name__}: {error}", file=sys.stderr)
            else:
                raise RuntimeError(f"authorized Fish synthesis failed for {slide['id']} part {number}; substitute voice is forbidden") from last_error
        part_files.append(part)
        print(f"[narration] {slide['id']} part {number}/{len(parts)} · {part.stat().st_size} bytes", flush=True)

    # Insert only short inter-chunk pauses, then normalize spoken-word loudness.
    gap = part_dir / "gap.mp3"
    run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.28", "-c:a", "libmp3lame", "-b:a", "64k", str(gap)])
    concat = part_dir / "concat.txt"
    lines = []
    for part in part_files:
        lines.append(f"file '{part}'")
        lines.append(f"file '{gap}'")
    concat.write_text("\n".join(lines[:-1]) + "\n", encoding="utf-8")
    output.parent.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "96k",
        "-metadata", f"title={ordinal:02d} · {slide['id']} · AI steward synthetic narration",
        "-metadata", "artist=Shaka's AI agent steward (synthetic, authorized)",
        "-metadata", "comment=Not a live or new recording of Shaka; editorial synthetic narration from cited public records.",
        str(output),
    ])


def vtt_time(seconds: float, srt=False):
    total_ms = round(seconds * 1000)
    hours, remainder = divmod(total_ms, 3600000)
    minutes, remainder = divmod(remainder, 60000)
    secs, millis = divmod(remainder, 1000)
    separator = "," if srt else "."
    return f"{hours:02d}:{minutes:02d}:{secs:02d}{separator}{millis:03d}"


def captions(text: str, start: float, end: float, srt=False):
    return (f"1\n{srt and ''}" if srt else "WEBVTT\n\n") + f"{vtt_time(start, srt)} --> {vtt_time(end, srt)}\n{text}\n"


def clock(seconds: float):
    minutes = int(seconds // 60)
    return f"{minutes}:{int(round(seconds - minutes * 60)):02d}"


def render_static(source, records, generated_at: str, total_duration: float):
    items = []
    for index, (authored, record) in enumerate(zip(source["slides"], records), 1):
        refs = "".join(
            f'<li><strong>{html.escape(ref["claim"])}</strong><br><a href="{html.escape(ref["url"], quote=True)}" rel="noopener noreferrer">{html.escape(ref["label"])} ↗</a></li>'
            for ref in authored["sources"]
        )
        items.append(f'''<article id="{html.escape(authored['id'])}">
<p class="movement">MOVEMENT {index:02d} / 12 · {clock(record['duration'])} · <a href="../?slide={html.escape(authored['id'])}&amp;listen=1">Open this movement in the hall</a></p>
<h2>{html.escape(record['title'])}</h2>
<div class="listen"><audio controls preload="none" src="../{record['audio'].removeprefix('./')}" aria-label="Movement {index}, {html.escape(record['title'])}, synthetic AI steward narration"><track kind="captions" src="../{record['vtt'].removeprefix('./')}" srclang="en" label="English" default>Your browser cannot play this optional audio. Read the complete text below or <a href="../{record['audio'].removeprefix('./')}" download>download the MP3</a>.</audio><div class="file-links"><a href="../{record['audio'].removeprefix('./')}" download>MP3 · {record['bytes']:,} bytes</a><a href="../{record['vtt'].removeprefix('./')}" download>WebVTT</a><a href="../{record['srt'].removeprefix('./')}" download>SRT</a></div></div>
<p class="script">{html.escape(authored['text'])}</p>
<details open><summary>Sources for this movement · {len(authored['sources'])} claims</summary><ol class="sources">{refs}</ol></details>
</article>''')
    page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#110b17"><meta name="referrer" content="no-referrer"><meta name="description" content="Optional authorized synthetic AI-agent-steward narration for the Open Source Orchestra First Circle, with complete readable transcript, captions and claim-level public sources."><title>Listen to the hall — sourced AI steward transcript</title>
<style>
:root{{--night:#110b17;--panel:#1c1423;--ivory:#f8edda;--muted:#c9bdcb;--gold:#e6c37f;--line:#54445a}}*{{box-sizing:border-box}}html{{background:var(--night);color-scheme:dark}}body{{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ivory);background:radial-gradient(ellipse at 50% 0%,#382033,transparent 60%),var(--night);line-height:1.7}}main,header,footer{{width:min(900px,calc(100% - 32px));margin:auto}}a{{color:var(--gold);text-underline-offset:.2em;overflow-wrap:anywhere}}a:focus-visible,audio:focus-visible,summary:focus-visible{{outline:3px solid var(--gold);outline-offset:4px}}header{{padding:44px 0 28px;border-bottom:1px solid var(--line)}}h1,h2{{font-family:Georgia,serif;font-weight:400;line-height:1.12}}h1{{font-size:clamp(2.4rem,7vw,4.5rem);margin:.35em 0 .25em}}h2{{font-size:clamp(1.8rem,4vw,2.5rem);margin:8px 0 18px}}.kicker,.movement{{font-size:.72rem;letter-spacing:.15em;color:var(--gold);text-transform:uppercase}}.notice{{padding:18px 20px;margin:20px 0;border:1px solid var(--gold);border-radius:14px;background:#e6c37f10}}.notice strong{{color:var(--gold)}}.notice p{{margin:.45em 0}}.downloads,.file-links{{display:flex;flex-wrap:wrap;gap:9px 18px;font-size:.83rem}}.downloads{{padding:18px 0}}article{{padding:30px 0;border-bottom:1px solid var(--line);scroll-margin:20px}}.movement a{{letter-spacing:.04em;text-transform:none}}.listen{{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:15px;margin:16px 0}}audio{{display:block;width:100%;min-height:44px;margin-bottom:12px}}.script{{font:1.12rem/1.85 Georgia,serif;color:#efe3d7;white-space:pre-line}}details{{margin-top:22px}}summary{{cursor:pointer;color:var(--gold);font-size:.9rem}}.sources{{padding-left:22px}}.sources li{{padding:10px 0;color:var(--muted);font-size:.86rem}}.sources strong{{color:#e5d8df;font-weight:550}}footer{{padding:30px 0 55px;color:var(--muted);font-size:.83rem}}.files{{font: .72rem ui-monospace,monospace;color:var(--muted);overflow-wrap:anywhere}}@media(max-width:480px){{header{{padding-top:25px}}article{{padding:24px 0}}.script{{font-size:1.06rem}}.listen{{padding:11px}}}}@media print{{:root{{color-scheme:light}}html,body{{background:white!important;color:black!important}}.listen,.downloads,.movement a{{display:none}}main,header,footer{{width:100%}}a,.kicker,.movement,summary,.sources strong,.notice strong{{color:#523615!important}}article{{break-inside:auto}}.sources{{font-size:.75rem}}.notice{{border-color:#777}}}}
</style></head><body>
<header><p class="kicker">OPEN SOURCE ORCHESTRA · THE FIRST CIRCLE</p><h1>Listen to the hall</h1><p>Optional twelve-movement AI steward narration · {clock(total_duration)} total measured audio · English</p>
<div class="notice" role="note" aria-label="Synthetic narration disclosure"><p><strong>{html.escape(DISCLOSURE)}</strong></p><p>{html.escape(source['recordingBoundary'])}</p><p>Audio is always optional and never autoplays. Use the controls on each movement, or read the complete transcript below. No meeting-attendee voices or words are published here.</p></div>
<nav class="downloads" aria-label="Full narration downloads"><a href="./transcript.txt" download>Plain transcript</a><a href="./narration.vtt" download>Full-deck WebVTT</a><a href="./narration.srt" download>Full-deck SRT</a><a href="../data/narration.json" download>Narration data + measured durations</a><a href="../SOURCES.md#ai-steward-narration">Credits and rights</a><a href="../">Return to the hall</a></nav>
<p>Generated {html.escape(generated_at)}. Each movement cites the public records behind its factual claims. The ledger and live tip configuration may change; consult their current public versions. This presentation proposes nothing onchain, approves no membership or governance change, and asks for no wallet, token, rank, donation or funds movement.</p></header>
<main>{''.join(items)}</main>
<footer><p>Prepared by Shaka's AI agent steward under his explicit authorization for this narrated edition. The closing movement is original agent-attributed language, not testimony or a quotation from a participant.</p><p>Voice generation used the pre-existing authorized Fish reference lane; the private voice reference and credentials are not shipped. A single slide-specific MP3 is only requested after a visitor opens narration or chooses its native audio control. Static text works without JavaScript.</p><p>Takedown first: <a href="https://opensourceorchestra.org/takedown/">Open Source Orchestra takedown commitment</a>. <a href="../archive/">The separate raw Listening Archive remains locked.</a></p></footer>
</body></html>'''
    return page


def build(args):
    deck = read_json(ROOT / "data/deck.json")
    source = read_json(SOURCE_PATH)
    check_source(source, deck)
    OUT.mkdir(parents=True, exist_ok=True)
    previous = read_json(META) if META.exists() else {}
    previous_audio = previous.get("audio", {})
    model = os.environ.get("OHANA_FISH_MODEL", "s2.1-pro-free")
    work = Path(args.work) if args.work else ROOT / ".narration-work"
    records, total_duration = [], 0.0
    audio_manifest = {}
    for index, (authored, deck_slide) in enumerate(zip(source["slides"], deck["slides"]), 1):
        slug = f"{index:02d}-{authored['id']}"
        audio_path = OUT / "audio" / f"{slug}.mp3"
        spoken_script = speech_text(authored["text"])
        source_hash = digest(spoken_script)
        cached = previous_audio.get(authored["id"], {})
        if args.synthesize and (args.force or source_hash != cached.get("sourceSha256") or not audio_path.exists()):
            print(f"[narration] synthesizing {slug} with authorized Fish lane", flush=True)
            synthesize({**authored, "title": deck_slide["title"], "text": spoken_script}, index, audio_path, model, work)
        check(audio_path.is_file(), f"{slug}: audio missing; run --synthesize (authorized Fish only) or use the static fallback")
        check(audio_path.stat().st_size > 5000, f"{slug}: unexpectedly tiny audio")
        audio_duration = duration(audio_path)
        check(12 <= audio_duration <= 180, f"{slug}: implausible duration {audio_duration}s")
        vtt = f"assets/narration/captions/{slug}.vtt"
        srt = f"assets/narration/captions/{slug}.srt"
        write_text(ROOT / vtt, captions(authored["text"], 0, audio_duration))
        write_text(ROOT / srt, captions(authored["text"], 0, audio_duration, srt=True))
        record = {
            "id": authored["id"], "ordinal": index, "title": deck_slide["title"],
            "text": authored["text"], "audio": f"./{audio_path.relative_to(ROOT).as_posix()}",
            "duration": audio_duration, "bytes": audio_path.stat().st_size,
            "sha256": sha(audio_path), "vtt": f"./{vtt}", "srt": f"./{srt}", "sources": authored["sources"]
        }
        records.append(record)
        total_duration += audio_duration
        audio_manifest[authored["id"]] = {"sourceSha256": source_hash, "audioSha256": record["sha256"], "duration": audio_duration, "bytes": record["bytes"]}
    total_duration = round(total_duration, 3)
    generated_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    full_vtt = "WEBVTT\n\n"
    full_srt = []
    full_text = [source["title"], "", DISCLOSURE, source["recordingBoundary"], f"Generated {generated_at}", f"Total measured audio: {clock(total_duration)}", ""]
    offset = 0.0
    for number, (authored, record) in enumerate(zip(source["slides"], records), 1):
        end = offset + record["duration"]
        full_vtt += f"{number}\n{vtt_time(offset)} --> {vtt_time(end)}\n{record['title']}: {authored['text']}\n\n"
        full_srt.append(f"{number}\n{vtt_time(offset, True)} --> {vtt_time(end, True)}\n{record['title']}: {authored['text']}\n")
        full_text += [f"MOVEMENT {number:02d} / 12 · {record['title']} · {clock(record['duration'])}", authored["text"], f"MP3: {record['audio'].removeprefix('./')}", "Sources:"]
        full_text += [f"- {ref['claim']}\n  {ref['label']}: {ref['url']}" for ref in authored["sources"]]
        full_text.append("")
        offset = end
    write_text(STATIC / "narration.vtt", full_vtt.rstrip() + "\n")
    write_text(STATIC / "narration.srt", "\n".join(full_srt))
    write_text(STATIC / "transcript.txt", "\n".join(full_text))
    write_text(STATIC / "index.html", render_static(source, records, generated_at, total_duration))

    manifest = {
        "schema": "oso-ai-steward-narration-v1", "title": source["title"], "language": "en",
        "generatedAt": generated_at, "disclosure": DISCLOSURE, "recordingBoundary": source["recordingBoundary"],
        "voice": {"kind": "authorized synthetic zero-shot clone through the existing Fish steward lane", "model": model, "speaker": "Shaka's AI agent steward, a machine", "notHumanRecording": True, "authorizedByShaka": True},
        "usage": {"autoplay": False, "defaultEnabled": False, "preload": "none", "runtimeExternalRequests": False},
        "totalDuration": total_duration, "totalBytes": sum(r["bytes"] for r in records), "slides": records
    }
    write_text(DATA, json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    write_text(META, json.dumps({"schema": "oso-narration-generation-cache-v1", "generatedAt": generated_at, "model": model, "audio": audio_manifest}, indent=2) + "\n")
    print(f"[narration] complete: 12 movements · {clock(total_duration)} ({total_duration:.3f}s) · {manifest['totalBytes']:,} bytes")
    print(f"[narration] generated {generated_at}; static transcript, VTT/SRT and runtime JSON written")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--synthesize", action="store_true", help="synthesize only missing or changed scripts using authorized Fish, no fallback")
    parser.add_argument("--force", action="store_true", help="regenerate all movement audio even if source hashes match")
    parser.add_argument("--work", help="private temporary work directory")
    args = parser.parse_args()
    try:
        build(args)
    except (ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
    # Private partial chunks are not publishable artifacts.
    work = Path(args.work) if args.work else ROOT / ".narration-work"
    if work.exists():
        shutil.rmtree(work)


if __name__ == "__main__":
    main()
