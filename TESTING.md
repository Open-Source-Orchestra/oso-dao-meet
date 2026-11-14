# Testing — the Theater edition

## 14 November 2026 · The Theater: one room, six channels (current)

Shaka (14 Nov, 07:23 and 07:36 UTC) asked for one theater — the orchestra pit on the floor, the living wall, the projector as a channel switcher — playing **every meeting we recorded and had consent to publish**, with karaoke transcribers, the narrated deck as channel 4, and two of his own YouTube videos as channels 5–6, framed as examples of growing the OSO DAO public media files. The three halls survive only as a lighting toggle.

| Suite / evidence | Result |
|---|---|
| Structural, editorial, fallback, privacy, Meeting #1/#2, theater, garden and karaoke checks | **803 / 803 PASS** · `node scripts/validate.mjs` |
| Release gates (films off-Pages with SHA-256, consented MP3s, forbidden-material scans, six channels, YouTube id allowlist, sitemap) | **913 PASS** · `python3 scripts/validate_final.py .` |
| Narration integrity | **12 / 12 MP3 SHA-256 unchanged** after `python3 scripts/build_narration.py` (dated 14 Nov written update on movement 11; no new voice) |
| Real-browser theater suite | `/workspace/oso-dao-meet-qa/theater-qa.cjs` · results `theater-<tag>-results.json` (local / production / preview) |
| Axe (WCAG 2.1 A/AA) | 0 violations with the theater open at 1440×960 and 390×844, and on `/channels/`, `/meetings/`, `/meetings/1/`, `/meetings/1/transcript/`, `/meetings/1/audio/`, `/archive/` |
| No external request before an explicit choice | verified: no film, YouTube or ytimg bytes until Play / Load |
| Reduced motion | garden drift and butterflies `animation-name: none`, photos remain visible |
| No-JS | theater hidden; `/channels/` readable with three native lazy films, consent lines and takedown; ledger `/meetings/` lists six files |
| Films | Meeting #1 `oso-dao-proposal-meeting-1-2026-11-12-720p.mp4` 438,969,537 B · Meeting #2 `oso-dao-proposal-meeting-2-2026-11-13-720p.mp4` 662,724,224 B on `theater.opensourceorchestra.org` (R2: 200, Range 206, CORS); weekly call #2 from archive.org (Range 206, CORS). SHA-256 in `data/channels.json` and the meetings' `status.json` |

Headless Chromium has no H.264 decoder, so karaoke sync is exercised through a synthetic time position; real playback was verified by hand in a desktop browser against production.


## 14 November 2026 Devcon IX date errata (current)

Devcon announced on 13 November 2026 that Devcon IX moves to **12–14 October 2027** (CCL – Lisbon Congress Centre). Movement 2 of the narration, recorded 12 November, says 11–13 October 2027. The recorded audio, its captions and the verbatim script are **unchanged** so they keep matching each other; a dated written errata now appears in the `/narration/` header and beside movement 2, in `data/narration.json` (`errata`, top level and on slide 2), the plain transcript, the full-deck and movement-2 WebVTT `NOTE` blocks and the live narration panel. Movement 2's claim-level source line now records both the spoken and the current official dates.

| Suite / evidence | Result |
|---|---|
| Structural, editorial, fallback, privacy, Meeting #2 and errata checks | **686 / 686 PASS** · `node scripts/validate.mjs` (4 new errata gates) |
| Release gates | **760 PASS** · `python3 scripts/validate_final.py .` |
| Narration integrity | **12 / 12 MP3 SHA-256 unchanged** before and after `python3 scripts/build_narration.py` (no `--synthesize`; no new voice) |

## 14 November 2026 Meeting #2 publication (current)

Verified locally on **14 November 2026, UTC** after Shaka's 04:20 UTC confirmation that Meeting #2 (13 November, 07:11 UTC) was recorded with consent and may be transcribed, published and shared. New routes: `/meetings/2/` recap, `/meetings/2/notes/` ten themes, `/meetings/2/transcript/` complete timestamped transcript (HTML, TXT, WebVTT, JSON) and `/meetings/2/audio/` mono MP3 player. The raw 1280×720 video stays private.

| Suite / evidence | Result |
|---|---|
| Structural, editorial, fallback, privacy and Meeting #2 checks | **682 / 682 PASS** · `node scripts/validate.mjs` |
| Release gates, including the single consented MP3 allowance, SHA-256, duration, sitemap/hall links and negation-aware DAO-claim scan | **760 PASS** · `python3 scripts/validate_final.py .` |
| Focused real-browser Meeting #2 suite | **143 PASS · 0 FAIL · 0 diagnostics** · `/workspace/oso-dao-meet-qa/meeting-2-local-results.json` |
| Desktop/mobile axe accessibility | **0 violation rules / 0 nodes in all 12 tested views** · recap, notes, transcript, audio, meetings index and archive at 1440×960 and 390×844 |
| No-JavaScript | **PASS** · 26 speaker turns readable and native audio control present at 390×844; download link present on the audio page |
| Media behaviour | **zero MP3 requests before interaction** on both the transcript and audio pages; clicking a timestamp or chapter seeks the real decoded audio (duration 3407.7 s); captions track is the transcript WebVTT |
| Byte-range serving | `206` with exactly 1024 bytes matching the committed MP3, 127-byte suffix, explicit `416`, full GET 27,261,952 bytes |
| Hall | Meeting #2 toolbar button present; no horizontal overflow at 390×844 |

Transcription used local `faster-whisper large-v3-turbo` (CPU int8); media never left the machine. Speaker labels are editorial. Three short lines were omitted as personal circumstances, and a few mis-heard names/project terms were normalized; both are documented in the transcript JSON. The five expected `net::ERR_ABORTED` media requests recorded during seeking are normal `<audio>` range re-requests and are counted separately from diagnostics.

## 13 November 2026 recording-consent correction (superseded as current; still accurate for Meeting #1)

Verified locally on **13 November 2026, UTC** after Shaka's 05:21 UTC correction. Public wording now confirms full Meeting #1 recording broadcast/share consent, keeps the high-level notes available, attaches no raw video or full participant transcript, and makes no governance/funding decision claim.

| Suite / evidence | Result |
|---|---|
| Structural, editorial, fallback, privacy and correction checks | **648 / 648 PASS** · `node scripts/validate.mjs` |
| Release gates, including raw-media exclusion and conservative status JSON | **661 PASS** · `python3 scripts/validate_final.py .` |
| Focused real-browser correction suite | **117 PASS · 0 FAIL · 0 diagnostics** · `/workspace/oso-dao-meet-qa/consent-correction-results.json` |
| Desktop/mobile axe accessibility | **0 violation rules / 0 nodes in all 12 tested views** · notes, recap, meetings index, archive, narration and main panel at 1440×960 and 390×844 |
| No-JavaScript functional fallback | **PASS** · corrected movement readable at 390×844 with no overflow or stale lock status. Axe injection is **SKIPPED** in this view only because axe requires a JavaScript runtime; the equivalent main JS and static views passed axe. |
| Narration integrity | **12 / 12 MP3 SHA-256 checks unchanged** · no synthesis, raw meeting media or full participant transcript added |

The focused suite also verifies corrected JSON, no recording URL/download invention, no autoplay or pre-Play MP3 request, no Drive/private Meet payload, no horizontal overflow, and a visible dated correction before movement 11's historical audio. Screenshots are `/workspace/oso-dao-meet-qa/consent-correction-*.png`; the harness is `/workspace/oso-dao-meet-qa/consent-correction-qa.cjs`.

**Intentional historical limitation:** movement 11's original 12 November synthetic audio and matching SRT/VTT spoken cues retain superseded lock wording verbatim so they continue to match the unchanged audio. A prominent dated written correction appears beside the static player, in the live panel, manifest, plain transcript and non-spoken WebVTT `NOTE` blocks. No new voice was synthesized.

## Historical 12 November 2026 baselines — superseded archive status

**All results below this point are dated historical evidence, not current archive/consent assertions.** They were captured before the 13 November correction, when the site represented the archive as locked/sealed. Their old lock wording is retained only to describe what those earlier test runs asserted; current results are above.

Verified locally on **12 November 2026, UTC**. The integrated edition included the verified presentation content, 37 living-wall assets, the complete OG Circle, share/print controls, and the then-sealed archive. Physical-headset certification remains a follow-up, not a claim.

### Optional AI-steward narrated edition (12 November historical baseline)

Verified locally on **12 November 2026, UTC** in `/workspace/oso-dao-meet`. At that historical checkpoint, the original archive/circle/meeting files were not changed and the public Listening Archive verified `locked`, `items=[]`, and null transcript/recording. The 13 November status and correction results above supersede that consent status.

| Suite / evidence | Result |
|---|---|
| Structural, editorial, provenance, fallback and privacy checks | **641 / 641 PASS** · `node scripts/validate.mjs` |
| Final release gates, including raw-media exclusion | **652 / 652 PASS** · `python3 scripts/validate_final.py .` |
| Narration-specific real-browser suite | **51 PASS · 0 FAIL · process exit 0** · `/workspace/oso-dao-meet-qa/narration-results.json` |
| Original hall regression, isolated output copy | **71 PASS · 0 FAIL · 1 existing headless-fullscreen SKIP** · `/workspace/oso-dao-meet-qa/narration-regression-results.json` |
| Browser diagnostics | **0** exceptions, console errors, unexpected request failures, HTTP ≥400 responses, or third-party runtime requests in successful test paths |
| axe accessibility | **0 violations / 0 nodes** in original suite's eight views and narration's desktop, mobile, static-transcript and reduced-motion views |
| Actual generated audio | **12 mono MP3s · 44.1 kHz · 96 kbps · 564.610 s (9:25) · 6,782,481 bytes** · `narration-ffprobe.json` |
| Audio signal levels | All 12 non-silent; measured max peaks **−1.8 to −1.9 dB**, mean levels **−16.4 to −17.4 dB** · `narration-audio-levels.log` |
| Independent offline speech spot-check | **3 / 3 sampled tracks** (opening, artist tips, closing) transcribed with cached `faster-whisper-medium.en`, CPU int8, no network; required disclosure and caveats all recovered. Approx. normalized word-error metrics **4.84% / 9.35% / 5.26%** · `narration-whisper-results.json` |
| Public claim sources | **18 / 18 external URLs HTTP 200**; the new canonical `/narration/` self-reference intentionally remains pending parent deployment · `narration-public-sources.json` |
| Byte-range serving | Local range server: `206` with exactly 1024 requested bytes matching the MP3, 127-byte suffix, and explicit `416` for an unsatisfiable range · `narration-qa.cjs` |

### Narrated controls and boundaries exercised

- Initial hall contains only one empty `preload="none"` audio element; **zero narration JSON or MP3 requests** before the listener chooses the feature.
- Listen opens the manifest and panel **without audio playback or MP3 requests**. Only Play attaches the per-slide VTT and begins real media loading/decoding.
- Play/pause truthfully changes audio state; pause freezes `currentTime`; seek sets actual time; 0.75×–1.5× speed controls change `playbackRate` and carry to the next movement.
- Previous/next synchronize the existing projector, local audio, visible caption, download URLs, and deck deep link. End-of-track continuation advances to the next narrated movement, not the silent slideshow's 14-second timer.
- `?slide=dao-phases&hall=prague&listen=1` initializes the correct hall and script with audio still paused. Closing pauses and removes `listen=1`. Keyboard **L** opens/closes; arrow input on seek does not change slides.
- Dialog opening and closing the narration both pause audio. Mobile controls are at least 44 px high at 390×844; no horizontal overflow was found.
- The visible and spoken disclosure identifies authorized AI-agent-steward synthetic narration, not a live/new Shaka recording, human presence or meeting attendance. No attendee voice or quotation is included.
- Static `/narration/` has **12 articles, 12 native non-autoplay audio controls, 36 claim-level references**, the exact readable script, measured durations, generated timestamp and MP3/VTT/SRT/plain-text links without JavaScript. Actual no-JS mode requests no MP3.
- Deliberately unavailable MP3 responses leave the readable caption, sources, transcript/download links and previous/next navigation usable, with no uncaught browser exception. The deliberate failure route is not counted as a release diagnostic.
- No-WebGL and reduced-motion paths retain the readable deck and source links and never start sound automatically.

### Resolved QA findings

1. **Deep-link ordering bug:** boot's URL normalization originally removed `listen=1` before checking it. The requested flag is now captured before normalization. A focused browser probe and the complete rerun prove movement 9 / Prague opens with its correct source still paused.
2. **Axe/navigation harness race:** injecting axe into a genuinely JavaScript-disabled context caused `Execution context was destroyed`. Functional no-JS assertions now complete first. A fresh, network-idle audit page then verifies **byte-identical `body.innerHTML` and zero authored scripts** before running axe. This does not bypass or mock an accessibility violation: desktop/mobile/reduced-motion axe checks also pass, and the static audit found 0 violations.
3. The narrated runner now always writes `narration-results.json` and exits nonzero on any recorded failure. The final recorded run is **51 PASS / 0 FAIL / exit 0**.

The known headless fullscreen skip comes from the original suite and is **not** treated as a new pass. Earlier headed-fullscreen evidence remains in the historical suite below. Audio checks used real browser decoding, ffprobe, signal-level measurement and offline ASR sampling; these are not a substitute for a final human listening/taste review. Local range support is verified, but the parent must verify production HTTPS, caching and byte-range behavior after deployment.

### Reproduce the narrated checks

```bash
cd /workspace/oso-dao-meet
python3 scripts/build_narration.py
node scripts/validate.mjs
python3 scripts/validate_final.py .

# Owned local range-enabled preview (stop this exact PID after review):
node /workspace/oso-dao-meet-qa/narration-range-server.cjs  # 127.0.0.1:18813

# The baseline harness uses the same server on port 18745:
PORT=18745 node /workspace/oso-dao-meet-qa/narration-range-server.cjs
cd /workspace/oso-dao-meet-qa
node narration-qa.cjs
node narration-regression.cjs

# Optional independent three-track speech check, cached model only, serial:
/workspace/whisper-venv/bin/python narration-whisper.py
```

## Integrated presentation results (prior base before narration)

| Suite | Result | Evidence |
|---|---|---|
| Structural/editorial/asset validation | **362 / 362 PASS** | `node scripts/validate.mjs` |
| Final OG/archive/privacy release gates | **415 / 415 PASS** | `python3 scripts/validate_final.py` |
| Final Playwright browser suite | **70 PASS · 0 FAIL · 1 documented SKIP** | `/workspace/oso-dao-meet-qa/final-results.json` |
| Browser/runtime diagnostics | **0** page exceptions, console errors, failed requests, HTTP ≥400 responses, or unexpected third-party runtime requests | `final-results.json` and monitor in `final-qa.cjs` |
| Real headed-Chromium fullscreen | **2 / 2 PASS** | `/workspace/oso-dao-meet-qa/final-fullscreen-results.json` |
| axe accessibility views | **0 violation rules / 0 nodes in all 8 tested views** | `axeReports` in `final-results.json` |
| Living-wall registry | **24 Garden Circle history + 4 Mumbai + 9 portraits = 37**, all local | Both validators and browser requests |
| OG Circle | **15 cards · 14 localized images decoding · 86 links · 1 monogram** | Final browser suite and validators |
| Deck resource set | **37 distinct public links**, HTTPS only | `data/deck.json` and validators |
| Share / print | Exact deep link copied; complete-score print handler called | Final browser suite |
| Archive lock | `status=locked`, `items=[]`, null transcript/recording, no downloads | Browser + JSON checks |

The documented skip is the headless-only Chromium Fullscreen API limitation. Real fullscreen entry and F-key exit passed separately under Xvfb, including `aria-pressed` state. A physical WebXR headset was unavailable; capability detection was tested with a mock and still needs a real immersive-session check.

Final screenshots are `/workspace/oso-dao-meet-qa/final-*.png`, including the hall, all three venues, mobile, transcript, gallery, OG Circle, archive, and headed fullscreen. The final harness targets `127.0.0.1:18745`.

## Core-build results (historical)

| Suite | Result | Evidence |
|---|---|---|
| Dependency-free source/editorial/asset validation | **322 / 322 PASS** | `node scripts/validate.mjs` |
| Playwright browser suite | **59 PASS · 0 FAIL** | `/workspace/oso-dao-meet-qa/core-results.json` and `core-qa.log` |
| Browser/runtime diagnostics | **0** uncaught page exceptions, `console.error` messages, failed requests, HTTP ≥400 responses, or unexpected third-party runtime requests | Same results file and monitor in `core-qa.cjs` |
| Headed Chromium fullscreen proof | **2 / 2 PASS** | `/workspace/oso-dao-meet-qa/core-fullscreen-results.json` |
| axe-core 4.10.3, WCAG 2 A/AA + 2.1 AA tags | **0 violation rules / 0 violating nodes** in each of six tested DOM views | `axeReports` in `core-results.json` |
| Unique external action destinations | **5 / 5 HTTP 200** after redirects | `/workspace/oso-dao-meet-qa/external-links.json` |
| Local media registry | **24 history photos + 10 portraits**, every referenced file exists | Validator and browser requests |
| No-JavaScript ↔ JSON editorial synchronization | **12 / 12** articles match titles, ledes, statuses, bullets, and URLs | 322-check validator |

The single listed `SKIP` in `core-results.json` is the **headless Chromium fullscreen API**. Headless Chromium has a known fullscreen limitation (Playwright issue #15116). It was not treated as an application pass. Instead, a separate **headed Chromium under Xvfb** test proved actual fullscreen entry and F-key exit, including correct `aria-pressed` changes. There are no remaining failed functional checks.

## What was exercised in a real browser

### Desktop hall and projector

- Entry waits for local renderer creation and then enables **Enter the hall**.
- Three.js starts with a WebGL2 canvas; sixteen living wall frames are interactive.
- An actual raycast click on the big projector moves `overture` → `origin-repertoire`.
- The DOM action dock changes with the projector slide and carries real HTTPS links.
- Next and previous controls, all twelve rail positions, wraparound, and the Devcon 8 / open-invite content states.
- Mumbai → Prague → Cannes selection changes the scene palette/decorations, accessible selection state, canvas hall state, and `?hall=` deep link.
- Keyboard Right Arrow, Space, H, Escape, T, and G.
- Slide-specific transcript position and the complete 34-item credited living-wall gallery.
- Slideshow starts only on request, advances after 14 seconds, and pauses correctly.
- A drag around the hall, a raycast search that locates a genuine wall photograph, and a wall click that changes the photo and shows its public credit.
- A direct `/​?slide=listening-archive&hall=prague` deep link; the locked archive contains no audio, video, iframe, transcript payload, or archive link.

### Mobile, 390×844 with touch emulation

- Entry and all three-dimensional content initialize at the mobile camera position.
- No horizontal document overflow; twelve rail stops remain present; walking pad is visible.
- Actual tap on the canvas projector advances the slide; next and venue controls work.
- Mumbai and Prague screenshots checked after venue selection.
- Held forward-walk control does not unexpectedly advance the deck or alter the URL.
- Two-point pinch is dispatched through the Chrome DevTools Protocol `Input.dispatchTouchEvent`; it is handled by the camera layer without navigation.
- Transcript opens and closes as a readable native dialog.

### Reduced motion

- Respects `prefers-reduced-motion: reduce` with zero-duration entry transitions.
- Ambient hall rotation is disabled in the renderer; automatic slideshow does not begin.
- Manual slide navigation remains available.

### No WebGL and no JavaScript

- A test deliberately returns `null` for all WebGL context requests. The site exposes the complete inline document, all twelve movements, and all eighteen deck links without constructing a renderer canvas.
- With JavaScript disabled entirely, the entry overlay and unusable controls are hidden, while twelve fully authored articles, alt text, real links, and locked/proposal notices remain readable and scrollable.
- No-WebGL receives the same dynamic editorial source as the hall; no-JS is independently checked against `deck.json` so the two copies cannot silently diverge.

### WebXR

- A capability mock supplies `navigator.xr.isSessionSupported('immersive-vr') → true`.
- The vendored local `VRButton` produces an enabled **ENTER VR** control after asynchronous detection; its accessible label and `aria-disabled` state are checked.
- Controller-select-to-next-slide logic is present in `js/hall.js`.

### Fullscreen

- Real browser Fullscreen API, not a mocked property: click enters fullscreen and `aria-pressed` becomes `true`.
- F exits fullscreen and `aria-pressed` returns to `false`.
- This caught and fixed a Chromium promise/event timing race: state is now synchronized both on `fullscreenchange` and after the request promise resolves.

### Editorial, privacy, and local-only checks

- AI assistance and venue-interpretation disclaimers are present.
- No deployed/adopted/onchain assertion, token sale, funds movement, formal-membership inference from photos, or agent votes/keys.
- No `meet.google`, Zoom, `mailto:`, Drive, attendee payload, email address, raw meeting audio, video, iframe, or remote script ships in the initial page. The optional narration's single initial audio element has no source, no autoplay and `preload=none`.
- No runtime `fetch()` or `import()` targets an external origin.
- Third meetup explicitly says details are to be announced and that no meeting link is published yet.
- Listening Archive explicitly remains locked pending blessing and every required consent; no fake empty player is used.
- Only HTTPS action links are accepted by runtime validation.
- Historical invite illustration was visually checked and corrected to the actual approved Bangkok group photograph.

## Accessibility audits

axe-core reported zero violations in these six views:

1. Desktop entry
2. Desktop hall chrome
3. Desktop help dialog
4. Desktop transcript drawer
5. Mobile hall
6. No-WebGL readable document

**Scope note:** axe cannot inspect text rasterized into a WebGL/CanvasTexture. Its results apply to the semantic DOM, dialogs, links, controls, and document views. The main, origin, invitation, and locked canvas slides were also reviewed visually on desktop; the main and Devcon slides were reviewed on mobile. Every bitmap slide’s content is additionally available as readable HTML.

## Public destinations checked

A one-time QA HEAD request, not a runtime request made by the website, returned **200** for:

- <https://opensourceorchestra.org/>
- <https://opensourceorchestra.org/dao/>
- <https://opensourceorchestra.org/join/>
- <https://opensourceorchestra.org/takedown/>
- <https://github.com/Open-Source-Orchestra>

## Artifacts and screenshots

QA-only files are deliberately outside the static project. The browser harness is `/workspace/oso-dao-meet-qa/core-qa.cjs`; axe-core is a QA-only dependency and is **not** required by the site.

There are 24 `core-*.png` screenshots in `/workspace/oso-dao-meet-qa/`, including:

- `core-entry-desktop.png`, `core-desktop-mumbai.png`, `core-desktop-origin.png`
- `core-desktop-invitation.png`, `core-desktop-prague.png`, `core-desktop-cannes.png`
- `core-side-wall.png`, `core-wall-change.png`, `core-gallery-desktop.png`
- `core-entry-mobile.png`, `core-mobile-mumbai.png`, `core-mobile-prague.png`, `core-mobile-transcript.png`
- `core-desktop-prague-locked.png`, `core-reduced-motion.png`
- `core-no-webgl.png`, `core-no-webgl-ledger.png`, `core-no-js.png`
- `core-webxr-capable.png`, `core-fullscreen-headed.png`
- `core-help-desktop.png`, `core-transcript-desktop.png`, `core-venue-selector.png`

Machine-readable results:

- `/workspace/oso-dao-meet-qa/core-results.json`
- `/workspace/oso-dao-meet-qa/core-fullscreen-results.json`
- `/workspace/oso-dao-meet-qa/external-links.json`
- `/workspace/oso-dao-meet-qa/core-qa.log`

## Reproduce

Start an owned local server (port chosen for this test run):

```bash
cd /shared/oso-dao-meet-src
python -m http.server 18743 --bind 127.0.0.1
```

In another shell with the existing environment’s Playwright installed:

```bash
cd /shared/oso-dao-meet-src
node scripts/validate.mjs

cd /workspace/oso-dao-meet-qa
# axe-core@4.10.3 is installed here for QA only:
node core-qa.cjs

# Real, not headless-mocked, Fullscreen API:
xvfb-run -a node core-fullscreen.cjs
```

The scripts target `127.0.0.1:18743`. Stop only the server whose PID is recorded in `/workspace/oso-dao-meet-qa/server.pid`; do not kill unrelated HTTP or graphics processes.

## Honest remaining device checks

These are follow-up checks, not hidden claims of completion:

- **Physical headset:** no headset or real immersive session is available in this container. Local capability detection and Enter VR presentation were tested with a mock; a target Quest/other WebXR headset should verify entry, controller select, floor height, frame rate, and safe exit before public certification.
- **Physical mobile:** Chromium touch emulation and CDP pinch were tested, not a physical iOS/Android device. Verify actual Safari/Chrome touch behavior, address-bar resizing, fullscreen policy, and sustained GPU performance.
- **Visual QA beyond sampled views:** automated accessibility and the screenshot set do not replace a human review of all twelve slides at several camera angles.
- **Editorial approval:** the supplied copy is an honest core draft for the parent to refine. Final public copy, proposed DAO phases, image reuse, and future meetup details still need the appropriate human blessing and consent processes.
- **Production hosting:** HTTPS headers, cache policy, custom-domain behavior, uptime, and real-device WebXR must be checked after the parent deploys. No deployment or publication was performed by this core build.
