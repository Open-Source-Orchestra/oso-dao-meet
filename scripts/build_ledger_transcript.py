#!/usr/bin/env python3
"""Publish an AUTOMATIC transcript edition into the ledger (meetings/N/transcript/) and render its readable page.

    python3 -I scripts/build_ledger_transcript.py 4 5

Input  : data/season1/e{N}.transcript.json (the privacy-scanned faster-whisper draft staged by build_watch.py)
         + data/season1/e{N}.vtt + meetings/N/status.json (consent + facts)
Output : meetings/N/transcript/transcript.{json,vtt,txt} and meetings/N/transcript/index.html
         (the existing page's head / nav / footer chrome is kept; header lede + main are regenerated).
Honesty: the edition is labelled "automatic transcript · editorial pass pending" everywhere (page, JSON, VTT, TXT);
         no speaker labels are invented. The privacy scan runs again here and FAILS CLOSED.
Code GPL-3.0 · words CC BY-SA 4.0 · by the AI ʻohana.
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRIVATE = re.compile(r"meet\.google|zoom\.us|drive\.google|@gmail|@[a-z0-9.-]+\.(com|org|net)\b|\+?\d[\d\s().-]{8,}\d|NavPoint|\bKEW\b|\bBrent\b|\bBlake\b|Ham Agents|BEGIN PRIVATE KEY|https?://", re.I)
ORDINAL = {1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth", 7: "seventh", 8: "eighth", 9: "ninth"}
E = html.escape


def clock(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}"


def publish(n: int) -> None:
    ep = f"e{n}"
    staged = ROOT / "data" / "season1" / f"{ep}.transcript.json"
    staged_vtt = ROOT / "data" / "season1" / f"{ep}.vtt"
    out_dir = ROOT / "meetings" / str(n) / "transcript"
    status = json.loads((ROOT / "meetings" / str(n) / "status.json").read_text())
    if not staged.exists():
        if (out_dir / "transcript.json").exists():
            print(f"meet {n}: ledger transcript already present, staged draft gone — nothing to do")
            return
        sys.exit(f"meet {n}: no staged automatic transcript at {staged}")
    draft = json.loads(staged.read_text())
    cues = draft["cues"]
    hits = [f"{clock(c['start'])} {c['text'][:80]}" for c in cues if PRIVATE.search(c["text"] or "")]
    if hits:
        sys.exit(f"meet {n}: privacy scan REFUSED {len(hits)} line(s), e.g. {hits[0]!r}")
    if any(c.get("speaker") for c in cues):
        sys.exit(f"meet {n}: speaker labels present — this tool only publishes unlabelled automatic editions")

    title = status["title"]
    duration = status["recording"]["durationSeconds"]
    label = status["recording"]["durationLabel"]
    consent = status["recordingConsent"]
    payload = {
        "schema": "oso-dao-proposal-meeting-transcript-v1",
        "edition": "automatic",
        "editorial": "pending — automatic edition: speaker labels not yet assigned; wording may be imperfect; first names only; takedown first",
        "meeting": n,
        "title": title,
        "recordedAt": status["startedAt"],
        "recordingDurationSeconds": duration,
        "consent": {"status": "published_with_consent", "reportedBy": consent["reportedBy"], "reportedAt": consent["reportedAt"], "scope": consent["scope"]},
        "transcription": "automatic transcript by faster-whisper (small.en) on the ʻohana's own machine; the recording was never uploaded to a transcription service; wording may be imperfect",
        "speakerLabels": "not yet assigned — an editorial pass with first-name labels (from what is said, not voice identification) replaces this edition when it is checked",
        "redactions": "scanned for surnames, private meeting links, emails and phone numbers before publication; first names only; corrections and takedown come first",
        "takedown": "https://opensourceorchestra.org/takedown/",
        "licenses": {"content": "CC BY-SA 4.0", "code": "GPL-3.0"},
        "cues": [{"start": c["start"], "end": c["end"], "speaker": "", "text": c["text"]} for c in cues],
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "transcript.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n")
    (out_dir / "transcript.vtt").write_text(staged_vtt.read_text() if staged_vtt.exists() else "")
    txt = [f"{title} — automatic transcript (editorial pass pending)", f"Recorded {status['startedAt']} · {label} · published with consent (confirmed by {consent['reportedBy']} {consent['reportedAt']})",
           "Speaker labels not yet assigned; wording may be imperfect; first names only. Takedown first: https://opensourceorchestra.org/takedown/ · CC BY-SA 4.0", ""]
    txt += [f"[{clock(c['start'])}] {c['text']}" for c in cues]
    (out_dir / "transcript.txt").write_text("\n".join(txt) + "\n")

    page_path = out_dir / "index.html"
    page = page_path.read_text()
    ordinal = ORDINAL.get(n, str(n))
    desc = f"Full public transcript of {title} ({status['recording']['durationLabel']}, automatic edition — editorial pass pending). Published with consent, first names only; still a proposal."
    page = re.sub(r'(<meta name="description" content=")[^"]*(")', lambda m: m.group(1) + E(desc, quote=True) + m.group(2), page, count=1)
    page = re.sub(r'(<meta property="og:description" content=")[^"]*(")', lambda m: m.group(1) + E(desc, quote=True) + m.group(2), page, count=1)
    page = re.sub(r'<p class="lede">.*?</p>', f'<p class="lede">The complete public-safe transcript ({E(label)}), automatic edition: every line timestamped, no speaker labels yet. In HTML, plain text, WebVTT captions and JSON; the editorial first-name edition replaces it when checked.</p>', page, count=1, flags=re.S)
    if "</style>" in page and ".cues{" not in page:
        page = page.replace("</style>", ".cues{list-style:none;padding:0;margin:18px 0}.cues li{padding:7px 0;border-bottom:1px solid rgba(223,187,115,.12);line-height:1.55}.cues li a.t{font:600 .72rem var(--sans);letter-spacing:.04em;color:var(--gold);text-decoration:none;margin-right:.6em;font-variant-numeric:tabular-nums}.cues li:target{background:rgba(223,187,115,.12)}</style>", 1)
    lines = "".join(f'<li id="c{i}"><a class="t" href="#c{i}" title="{E(clock(c["start"]))}">[{E(clock(c["start"]))}]</a>{E(c["text"])}</li>' for i, c in enumerate(cues, 1))
    main = (f'<main>\n<p class="notice"><strong>Automatic edition · editorial pass pending.</strong> These {len(cues):,} lines were transcribed by faster-whisper on the ʻohana’s own computer (the recording is never uploaded to a transcription service), scanned for surnames and contact details, and published as they are: no speaker labels yet, wording may be imperfect. Everyone present consented to the public video and transcript (confirmed by {E(consent["reportedBy"])} on 21 November 2026, 11:50 Bangkok). First names only; the raw original stays private. <a href="https://opensourceorchestra.org/takedown/">Takedown first.</a></p>'
            f'<section class="card"><h2>How the transcript is made</h2><p>Automatic transcription on the ʻohana’s own computer, then an editorial pass: first-name speaker labels from what is said, surnames and contact details removed, Googly Eye’s live captions read only as a cross-check. That editorial edition replaces this page when it is checked. Formats: <a href="./transcript.txt" download>transcript.txt</a> · <a href="./transcript.vtt" download>transcript.vtt</a> · <a href="./transcript.json" download>transcript.json</a>. The same lines play as a karaoke transcript on <a href="../../../watch/{ep}/">the episode page</a>.</p></section>'
            f'<section aria-labelledby="every-word"><h2 id="every-word" class="kicker">Every line, with its moment · {E(label)}</h2><ol class="cues">{lines}</ol></section>'
            f'<section class="card"><h2>Follow the open score</h2><div class="links"><a href="../">Meet #{n} recap</a><a href="../../../watch/{ep}/">Episode {n} in the theater</a><a href="../audio/">Audio</a><a href="../status.json">status.json</a><a href="../../">Public media files ledger</a><a href="https://publicinform.com/#consent">PIT protocol · publicinform</a><a href="https://opensourceorchestra.org/join/">Join the circle</a><a href="https://opensourceorchestra.org/takedown/">Takedown first</a></div></section>\n</main>')
    page, count = re.subn(r"<main>.*?</main>", lambda _: main, page, count=1, flags=re.S)
    if count != 1:
        sys.exit(f"meet {n}: could not find <main> in {page_path}")
    page_path.write_text(page)

    # ledger facts
    rec = status["recording"]
    rec["publicTranscript"] = f"/meetings/{n}/transcript/"
    rec["publicTranscriptEdition"] = "automatic — editorial pass (first-name speaker labels) pending"
    rec["transcriptFormats"] = [f"/meetings/{n}/transcript/transcript.txt", f"/meetings/{n}/transcript/transcript.vtt", f"/meetings/{n}/transcript/transcript.json"]
    status["publicRecapStatus"] = "published_automatic_transcript" if status.get("publicRecapStatus") == "pending_transcript" else status.get("publicRecapStatus")
    (ROOT / "meetings" / str(n) / "status.json").write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n")

    # the staged copies are superseded by the ledger edition (build_watch prefers the ledger path)
    staged.unlink()
    if staged_vtt.exists():
        staged_vtt.unlink()
    print(f"meet {n}: automatic edition published → {out_dir} ({len(cues)} lines, {label}); {ordinal} circle page regenerated")


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        publish(int(arg))
