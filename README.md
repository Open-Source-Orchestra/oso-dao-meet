# Open Source Orchestra DAO Meet — The First Circle

A self-contained, walkable Three.js concert hall and twelve-movement virtual-reality-ready slide deck, with opt-in sourced AI-steward narration, a complete OG Circle, a Listening Archive whose Meeting #1 recording broadcast/share consent is confirmed while its raw media remains unattached on this site, and Proposal Meeting #2 (13 November 2026) published in full with consent: recap, ten-theme notes, complete timestamped transcript and a mono MP3 of the recording.

**Canonical home:** https://osodaomeet.opensourceorchestra.org/

**Open source:** https://github.com/Open-Source-Orchestra/oso-dao-meet

## Experience

- A giant raycastable 16:9 stage screen with crisp local `CanvasTexture` slides.
- Orchestra seating, music stands, string instruments, congas, piano, organ pipes, carved balconies, curtains, chandeliers, and parquet/inlay floors.
- Sixteen clickable living frames draw from **24 Garden Circle history photos + 4 official Mumbai frames + 9 public artist portraits = 37 credited items**. Their local public images rotate with the deck; a wall click advances that individual frame and displays its credit.
- Three explicit artistic interpretations, never venue twins or affiliations:
  - **Mumbai:** Jio World Centre Mumbai memory — fan ribs, burgundy, jewel-like gold.
  - **Prague:** Smetana Hall / Municipal House Prague-inspired — ivory warmth, floral arches, balcony light.
  - **Cannes:** Palais des Festivals Cannes-inspired — geometric fins, bronze/night palette, red-carpet emphasis.
- Slide-specific real HTTPS links in the DOM action dock, a twelve-stop rail, previous/next controls, optional 14-second silent slideshow, deep links, theater/camera controls, mobile walking pad, and local WebXR support.
- **Listen to the hall:** twelve optional synthetic AI-agent-steward narrated movements, **9 minutes 25 seconds** total, explicitly authorized by Shaka and never represented as a live/new Shaka recording. Play/pause, previous/next, seek and speed controls synchronize the existing projector and readable captions. Every slide has claim-level public sources, MP3/VTT/SRT links and an accessible full transcript. Off by default; no autoplay, no third-party runtime media calls, and no participant voices/words.
- Full semantic transcript and credited gallery, complete no-JavaScript and no-WebGL editions, reduced-motion behavior, takedown route, and AI disclosure.
- **`/circle/`:** all 15 existing public lineage nodes, 14 localized public card images and one monogram, 86 source-exact public links, the corrected Bogotá DIP history, and explicit non-membership/non-endorsement language. The invited guest remains unnamed and unpublished pending their own APPROVE; Kuba has only a minimal consent-gated remembrance chair.
- **`/archive/`:** machine- and human-readable status confirming full consent for the Meeting #1 recording to be broadcast and shared everywhere. The high-level public notes remain available. No raw video file or full participant transcript is attached to this site in the 13 November status-only update; no recording download is claimed.
- Musical chord spine: **G · Em · C · D · C · G**, twice. Shareable deep links and an accessible **Print / save PDF** score.

## Run locally — no build step

ES modules and JSON loading require HTTP rather than `file://`.

```bash
cd /path/to/oso-dao-meet
python -m http.server 18743 --bind 127.0.0.1
# open http://127.0.0.1:18743/
```

No `npm install`, bundler, environment file, backend, service worker, API key, font service, tracker, or runtime CDN is needed. Everything the experience requests at runtime—including optional narration—is inside this directory. External sites are reached only when a visitor explicitly follows a labeled link. Initial hall load makes no narration request; opening the player reads `data/narration.json`, and only Play attaches caption media and requests that movement's local MP3. The independently readable `/narration/` page requires no JavaScript.

## Deploy — GitHub Pages + custom subdomain

Copy the **entire directory** including `vendor/`, `assets/` (with `assets/narration/`), `data/`, `js/`, `css/`, `circle/`, `narration/`, and `archive/` to the repository root. GitHub Pages serves `main` from `/`; `CNAME` contains `osodaomeet.opensourceorchestra.org`. Cloudflare DNS is a DNS-only CNAME to `open-source-orchestra.github.io`. Preserve the relative file layout. No SPA rewrite is required.

HTTPS must be verified on the public hostname before `https_enforced` is enabled. WebXR immersive sessions require a secure context and a capable browser/headset. A normal desktop can use every non-VR function. Test a real headset before describing the production site as headset-certified. Do not add trackers or third-party runtime imports when integrating.

## Controls

| Input | Result |
|---|---|
| Click/tap stage screen, Right Arrow, Page Down, or Space | Next movement, wrapping at the end |
| Previous button, Left Arrow, or Page Up | Previous movement, wrapping at the beginning |
| Rail numbers, Home, End | Direct movement / first / last |
| P or play button | Gentle play/pause; 14 seconds per slide |
| Drag / one-finger drag | Look around |
| Wheel / pinch | Move closer or farther |
| W A S D | Walk; Shift moves faster |
| Q / E | Move down / up |
| R / house button | Best seat |
| Focus screen button | Move toward the projector |
| Click a living wall | Change that frame and show its credit |
| G | Living-wall gallery and captions |
| T | Complete semantic transcript, scrolled to current slide |
| L / Listen to the hall | Open or close optional narrated player; opening alone never plays audio |
| Narration Play / Pause | Start/pause current synthetic editorial movement |
| Narration Previous / Next | Change projector, script, caption and audio together |
| Narration seek / speed | Seek within the actual MP3 / choose 0.75×, 1×, 1.25× or 1.5× |
| H or ? | Help, controls, boundaries, AI/takedown disclosure |
| F | Toggle fullscreen where the browser grants it |
| Escape | Close an open native panel/dialog |
| WebXR controller select | Next movement |

Mobile supplies forward/back/left/right hold buttons in addition to drag, pinch, and all slide controls. Dialogs pause the slideshow; switching from multiple browser tabs does too.

## Deep links

Use either parameter alone or both:

```text
/?slide=overture&hall=mumbai
/?slide=community-ledger&hall=prague
/?slide=listening-archive&hall=cannes
/?slide=dao-phases&hall=prague&listen=1
```

Valid hall IDs: `mumbai`, `prague`, `cannes`. Unknown values fall back to `overture` and `mumbai`; the URL is normalized to a valid state. Navigation uses `history.replaceState`, so a slide change does not create a long trail of browser-history entries. `listen=1` opens the narrated panel on the chosen movement **without playing audio**. Closing narration removes that parameter. The complete sourced transcript also has fragment links such as `/narration/#dao-phases`.

Slide IDs: `overture`, `origin-repertoire`, `devcon-8`, `repertoire`, `open-code-resume`, `first-circle`, `consent-privacy`, `community-ledger`, `dao-phases`, `third-meetup`, `listening-archive`, `love`.

## Refine the deck

Primary editorial source: **`data/deck.json`**. Each slide contains `id`, `chord`, `kicker`, `title`, `lede`, `bullets`, `links`, `theme`, `status`, and optional `moreLinks`, `image`, `imageAlt`, `imageCaption`. Main links appear in the action dock; `moreLinks` also appear in the complete transcript.

Available visual themes: `overture`, `night`, `burgundy`, `ivory`, `gold`, `sage`, `blueprint`, `invitation`, `locked`. Canvas slides are 1600×900. Three to four concise bullets work best; the DOM transcript always carries the full text. Slide links must use HTTPS.

**Important:** `index.html` contains the authored no-JavaScript transcript. When changing deck copy, update both `data/deck.json` and the matching `data-slide-article` in `index.html`, then run `node scripts/validate.mjs` and browser tests. The runtime replaces this static transcript from JSON when JavaScript is available; without JavaScript, the HTML transcript is the complete source of truth.

## Narrated edition — source, generation and captions

The authored script and its 36 claim-level public references live in `scripts/narration-source.json`. The runtime manifest, actual durations/bytes/hashes, exact scripts and references are in `data/narration.json`. The generated static fallback is `/narration/`.

```bash
# Recheck local audio and regenerate captions, transcript and runtime manifest:
python3 scripts/build_narration.py

# Create missing/changed movement audio only in the pre-authorized agent workspace:
python3 scripts/build_narration.py --synthesize
```

Synthesis directly reuses the existing authorized Fish Shaka-steward lane (`s2.1-pro-free`); the private reference and credential must already exist in that authorized workspace. The script has **no edge/other-voice fallback**, never sends the audio, and never needs credentials at website runtime. Do not add credentials/reference media to this repository. If authorized synthesis is unavailable, retain `/narration/` as the static accessible fallback rather than substituting another voice.

Readable transcripts use natural **AI** and **DAO** typography; the build's `speech_text()` applies explicit letter pronunciation only at synthesis time, without changing the editorial words. Each per-slide VTT/SRT cue spans that slide's measured MP3 duration, and the visible caption follows the projector. Full-deck VTT/SRT cues are sequential offsets for a gapless editorial concatenation—not a raw recording, attendee transcript, or claim of word-level timing. New generation should re-measure durations and refresh `generatedAt`; `assets/narration/generation.json` caches source/audio hashes for resumable synthesis and contains no secrets. Code validates that only these twelve disclosed editorial MP3s are allowed: every unexpected audio file, including any raw meeting audio, still fails release validation.

A movement may also carry a non-spoken `writtenUpdate` for a dated factual correction. Movement 11 uses this to present Shaka's 13 November full-recording broadcast/share consent confirmation beside the unchanged 12 November audio and its explicitly historical script/caption cues. The update is rendered in the static page, live panel, manifest, plain transcript and WebVTT `NOTE` metadata; it does not trigger synthesis or alter the MP3. SRT has no standard comment block, so its original spoken cue remains verbatim and is labelled as historical in the surrounding page and documentation.

The voice/reuse permission is limited to this specifically disclosed synthetic edition. See the detailed provenance in `SOURCES.md#ai-steward-narration` and `ASSET-CREDITS.md`.

## Editorial and safety boundaries

- The DAO is a **proposal**, not deployed, adopted, or onchain. The current public ledger is <https://opensourceorchestra.org/dao/>.
- One human, one equal voice; appearance in a photo does not create formal membership or consent.
- AI agents assist only: no votes and no keys.
- No token sale, financial return, or funds movement.
- The third meetup is an **open future invitation for everyone**. Details remain to be announced. No current Meet URL, attendee details, or email address is shipped.
- **Meeting #1 recording consent is confirmed:** on 13 November 2026 at 05:21 UTC, Shaka confirmed full consent for the recording to be broadcast and shared everywhere, superseding earlier consent-blocked wording. The high-level public notes remain available. The raw video file is not attached or hosted on this site in this status-only update, and the full participant transcript was not separately addressed or released. Only status metadata and editorial notes are present; no raw media or participant-transcript payload is added.
- Public image reuse follows the supplied approved Garden Circle and Mandala Room bundles. Takedown requests come first.
- Public node cards are lineage, never DAO membership, endorsement, voting power, or activation. The invited guest's private draft is not shipped. Kuba has only a minimal remembrance chair; no rich tribute, photo, audio, or lore.
- Venue names describe artistic interpretations only; no affiliation or exact digital-twin claim.

## File map

```text
index.html             Entry, semantic controls/dialogs, full no-JS transcript
css/styles.css         Gold/ivory/burgundy/deep-night art direction + responsive/fallback UI
js/app.js              Deck state, links, deep links, dialogs, controls, slideshow, fallbacks
js/narration.js         Opt-in synchronized media player and caption controls
narration/             Full static sourced transcript + VTT/SRT/plain-text downloads
assets/narration/      Twelve authorized synthetic MP3s + per-slide VTT/SRT + hashes
scripts/build_narration.py  Authorized synthesis / measured-caption builder
scripts/narration-source.json  Exact scripts and claim-level source map
js/hall.js             Three.js architecture, raycasting, camera, venues, photo textures, XR
js/slides.js           Deterministic 1600×900 slide painter
vendor/                Pinned Three.js r169, VRButton, full MIT notice
assets/history/        24 approved public history photographs, 2022–2026
assets/portraits/      9 approved public artist portraits
assets/mumbai/         4 official Devcon 8 Mandala Room frames
assets/nodes/          14 localized public OG node images
circle/                OG Circle static lounge and node search
archive/               Listening Archive consent/status + status.json (no raw media attached)
data/deck.json         Twelve-slide editorial source and honest statuses
data/media.json        Asset registry, alt text, public captions, and credits
data/nodes.json        15 existing public lineage nodes + 86 links
scripts/validate.mjs   Optional local structural/editorial/asset validation
scripts/validate_final.py  Final OG/archive/privacy/release gates
SOURCES.md             Complete local provenance and consent notes
OG-SOURCES.md          OG lineage, media and consent provenance
TESTING.md             Exact verification evidence and remaining device checks
```

## QA artifacts

The full browser harness, screenshots, and machine-readable result are outside the deployable tree:

- `/workspace/oso-dao-meet-qa/final-qa.cjs`
- `/workspace/oso-dao-meet-qa/final-results.json`
- `/workspace/oso-dao-meet-qa/final-qa.log`
- `/workspace/oso-dao-meet-qa/final-*.png`

See `TESTING.md` for coverage, exact results, and honest limitations.
