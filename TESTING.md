# Testing — presentation edition

Verified locally on **12 November 2026, UTC**. The integrated edition includes the verified presentation content, 37 living-wall assets, the complete OG Circle, share/print controls, and the sealed archive. Physical-headset certification remains a follow-up, not a claim.

## Integrated presentation results (final)

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
- No `meet.google`, Zoom, `mailto:`, Drive, attendee payload, email address, audio, video, iframe, or remote script ships in the initial page.
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
