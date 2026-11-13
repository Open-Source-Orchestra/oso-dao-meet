#!/usr/bin/env node
/* Optional authoring-time validation. This is not a build or runtime dependency. */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let checks = 0;
function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}
function read(relative) { return readFileSync(resolve(root, relative), 'utf8'); }
function json(relative) { return JSON.parse(read(relative)); }
function plain(html) {
  return html.replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

const deck = json('data/deck.json');
const registry = json('data/media.json');
const html = read('index.html');
const app = read('js/app.js');
const hall = read('js/hall.js');
const painter = read('js/slides.js');
const css = read('css/styles.css');
check(Array.isArray(deck.slides) && deck.slides.length === 12, 'Deck must contain exactly 12 slides.');
check(new Set(deck.slides.map((slide) => slide.id)).size === deck.slides.length, 'Slide IDs must be unique.');
check((html.match(/data-slide-article="/g) || []).length === 12, 'The static no-JS transcript must contain 12 articles.');
check(/<noscript>/.test(html), 'A native noscript fallback must remain present.');
check(/prefers-reduced-motion:\s*reduce/.test(css), 'Reduced-motion CSS must remain present.');
check(/body\.no-webgl/.test(css), 'The inline no-WebGL document treatment must remain present.');
check(/createSlideCanvas/.test(hall) && /CanvasTexture/.test(hall), 'The 3D stage must use locally drawn slide textures.');
check(/VRButton/.test(hall) && /'xr' in navigator/.test(hall), 'The local WebXR capability path must remain present.');
check(/1600|WIDTH = 1600/.test(painter) && /900|HEIGHT = 900/.test(painter), 'Slide canvas must remain 16:9 at 1600×900.');

for (const [index, slide] of deck.slides.entries()) {
  const label = `Slide ${index + 1} (${slide.id || 'missing id'})`;
  check(/^[a-z0-9-]+$/.test(slide.id || ''), `${label}: invalid or missing ID.`);
  for (const key of ['kicker', 'title', 'lede', 'status']) check(typeof slide[key] === 'string' && slide[key].trim().length > 0, `${label}: ${key} is required.`);
  check(Array.isArray(slide.bullets) && slide.bullets.length >= 2 && slide.bullets.every((line) => typeof line === 'string' && line.trim()), `${label}: at least two authored bullets are required.`);
  check(Array.isArray(slide.links) && slide.links.every((link) => {
    try { return new URL(link.url).protocol === 'https:'; }
    catch { return false; }
  }), `${label}: links must be approved public HTTPS destinations.`);
  if (slide.image) {
    check(slide.image.startsWith('./assets/') && existsSync(resolve(root, slide.image)), `${label}: optional image must be a local approved asset.`);
    check(Boolean(slide.imageAlt && slide.imageCaption), `${label}: optional image needs alt text and an honest caption.`);
  }
  const marker = `data-slide-article="${slide.id}"`;
  const markerPosition = html.indexOf(marker);
  const start = markerPosition >= 0 ? html.lastIndexOf('<article ', markerPosition) : -1;
  check(start >= 0, `${label}: static no-JS article is missing or has different attributes.`);
  if (start >= 0) {
    const end = html.indexOf('</article>', start);
    const text = plain(html.slice(start, end));
    check(text.includes(plain(slide.title)), `${label}: no-JS title is out of sync.`);
    check(text.includes(plain(slide.lede)), `${label}: no-JS lede is out of sync.`);
    check(text.includes(plain(slide.status)), `${label}: no-JS status is out of sync.`);
    for (const original of slide.bullets) {
      const textBullet = original.replace(/^\d{2} · /, '');
      check(text.includes(plain(textBullet)), `${label}: no-JS bullet is out of sync: ${textBullet}`);
    }
    for (const link of slide.links) check(html.slice(start, end).includes(`href="${link.url}"`), `${label}: no-JS link is missing: ${link.url}`);
  }
}

check(registry.items.length === 37, 'Registry must hold 37 curated public assets.');
check(new Set(registry.items.map((item) => item.id)).size === registry.items.length, 'Media IDs must be unique.');
check(registry.items.filter((item) => item.kind === 'history').length === 28, 'Exactly 24 Garden Circle history photographs plus 4 Mumbai frames must be curated.');
check(registry.items.filter((item) => item.kind === 'portrait').length === 9, 'Exactly 9 public artist portraits must be curated.');
check(registry.items.filter((item) => item.kind === 'history').every((item) => Number(item.year) >= 2022 && Number(item.year) <= 2026), 'History years must cover only the approved 2022–2026 range.');
check(new Set(registry.items.filter((item) => item.kind === 'history').map((item) => item.year)).size === 5, 'History must include all five years, 2022–2026.');
for (const item of registry.items) {
  check(item.src.startsWith('./assets/') && existsSync(resolve(root, item.src)), `Missing or non-local media: ${item.src}`);
  check(typeof item.alt === 'string' && item.alt.length > 25, `Missing descriptive alt text: ${item.id}`);
  check(typeof item.credit === 'string' && /Garden Circle|Mandala Room/.test(item.credit), `Missing public provenance: ${item.id}`);
}
const historyFiles = readdirSync(resolve(root, 'assets/history')).filter((file) => file.endsWith('.webp'));
const portraitFiles = readdirSync(resolve(root, 'assets/portraits')).filter((file) => file.endsWith('.jpg'));
check(historyFiles.length === 24, `Expected 24 history files on disk; found ${historyFiles.length}.`);
check(portraitFiles.length === 9, `Expected 9 portrait files on disk; found ${portraitFiles.length}.`);
check(readdirSync(resolve(root, 'assets/mumbai')).filter((file) => file.endsWith('.webp')).length === 4, 'Exactly 4 official Mumbai frames are required.');
check(readdirSync(resolve(root, 'assets/nodes')).filter((file) => file.endsWith('.webp')).length === 14, 'Exactly 14 localized public node images are required.');
check(read('vendor/three.module.min.js').startsWith('/**\n * @license'), 'Pinned Three.js file must retain its license header.');
check(read('vendor/three.module.min.js').includes('const t="169"'), 'Vendored renderer must remain Three.js r169.');
check(existsSync(resolve(root, 'vendor/VRButton.js')), 'Local VRButton.js is required.');
check(read('vendor/THREE-LICENSE.txt').includes('Permission is hereby granted'), 'Full Three.js MIT license is required.');

const phaseSlide = deck.slides.find((slide) => slide.id === 'dao-phases');
const invite = deck.slides.find((slide) => slide.id === 'third-meetup');
const archiveSlide = deck.slides.find((slide) => slide.id === 'listening-archive');
check(/PROPOSED ONLY/.test(phaseSlide?.status || '') && /NO SAFE OR CONTRACT DEPLOYED/.test(phaseSlide?.status || ''), 'DAO phases must remain explicitly proposed, not deployed or adopted.');
check(invite?.title === 'The third meetup is open to all', 'Third meetup must remain an open invitation for everyone.');
check(invite?.bullets.some((line) => line.includes('No date, time, place or public meeting link has been confirmed here yet.')), 'Third meetup must say details are not yet published.');
check(!invite?.links.some((link) => /meet\.google|zoom\.us/i.test(link.url)), 'Third meetup must not contain a current meeting link.');
check(/CONSENT CONFIRMED/.test(archiveSlide?.status || '') && /FULL BROADCAST \+ SHARING CONSENT/.test(archiveSlide?.lede || ''), 'Listening Archive must confirm full recording broadcast and sharing consent.');
check(archiveSlide?.bullets.some((line) => /not attached or hosted/.test(line) && /no download is claimed/i.test(line)), 'Listening Archive must not imply that raw video is attached or downloadable.');
check(archiveSlide?.bullets.some((line) => /Full participant transcript was not separately addressed and is not released/.test(line)), 'Listening Archive must keep the full participant transcript unreleased.');
check(!/LOCKED UNTIL|SEALED WITH CARE/.test(`${archiveSlide?.status || ''} ${archiveSlide?.lede || ''} ${archiveSlide?.kicker || ''}`), 'Listening Archive must not retain superseded consent-lock wording.');
check(!archiveSlide?.image, 'Listening Archive must not carry an image.');

const narration = json('data/narration.json');
const narrationSource = json('scripts/narration-source.json');
const narrationJS = read('js/narration.js');
const narrationStatic = read('narration/index.html');
const disclosure = 'AI-agent-steward synthetic narration authorized by Shaka; not a live or new recording of Shaka. An AI speaker, not human presence or meeting attendance; based only on cited public records.';
check(narration.schema === 'oso-ai-steward-narration-v1', 'Narration schema must identify editorial AI speech.');
check(narration.disclosure === disclosure && narrationSource.disclosure === disclosure, 'Narration requires the exact visible synthetic-voice disclosure.');
check(plain(html).includes(disclosure) && plain(narrationStatic).includes(disclosure), 'Player and static transcript must visibly disclose AI authorship, authorization and no live/new Shaka recording.');
check(narration.usage.autoplay === false && narration.usage.defaultEnabled === false && narration.usage.preload === 'none', 'Narration must be off, lazy and non-autoplay by default.');
check(narration.voice.notHumanRecording === true && narration.voice.authorizedByShaka === true, 'Narration provenance must record authorization and synthetic provenance.');
check(/preload="none"/.test(html) && !/<audio\b[^>]*autoplay/i.test(html), 'Initial audio element must be silent and must not autoplay.');
check(!/<(?:video|iframe|embed|object)\b/i.test(html), 'No embedded meeting media or third-party frame may ship.');
check(!/\.autoplay\s*=\s*true/i.test(narrationJS), 'Narration controller must not enable media autoplay.');
check(!narrationJS.includes("tts.synth") && !narrationJS.includes('edge_tts'), 'Runtime must not synthesize or substitute voices.');
check(narration.slides.length === 12 && narrationSource.slides.length === 12, 'Narration must contain exactly twelve movements.');
const archiveNarration = narration.slides.find((item) => item.id === 'listening-archive');
const archiveCorrection = archiveNarration?.writtenUpdate;
check(archiveCorrection?.date === '2026-11-13' && /full consent/.test(archiveCorrection?.text || '') && /broadcast and shared everywhere/.test(archiveCorrection?.text || ''), 'Movement 11 must carry the dated full-recording broadcast/share consent correction.');
check(/not attached or hosted/.test(archiveCorrection?.text || '') && /full participant transcript was not separately addressed or released/.test(archiveCorrection?.text || ''), 'Movement 11 correction must distinguish unattached raw video and the unreleased full participant transcript.');
check(/No new voice was synthesized/.test(archiveCorrection?.audioNote || '') && /superseded archive-lock wording/.test(archiveCorrection?.audioNote || ''), 'Movement 11 must disclose unchanged historical audio and superseded lock wording.');
check(narrationSource.slides.find((item) => item.id === 'listening-archive')?.writtenUpdate?.text === archiveCorrection?.text, 'Movement 11 correction must match its authored source.');
check(narration.totalBytes > 500000 && narration.totalDuration >= 480 && narration.totalDuration <= 720, 'Narration should remain a substantive 8–12 minute deck.');
for (const [index, item] of narration.slides.entries()) {
  const label = `Narration ${index + 1} (${item.id || 'missing id'})`;
  const source = narrationSource.slides[index];
  check(item.id === deck.slides[index].id && source.id === item.id, `${label}: must match the existing slide and narration source.`);
  check(item.title === deck.slides[index].title && item.text === source.text, `${label}: transcript must be synchronized with the slide and voice script.`);
  check(item.audio.startsWith('./assets/narration/audio/') && existsSync(resolve(root, item.audio)), `${label}: synthetic editorial MP3 must be local.`);
  for (const key of ['vtt', 'srt']) {
    check(item[key].startsWith('./assets/narration/captions/') && existsSync(resolve(root, item[key])), `${label}: ${key.toUpperCase()} must be local.`);
    const captions = read(item[key]);
    check(captions.includes(item.text), `${label}: ${key.toUpperCase()} must contain the exact spoken script.`);
    check(!/meet\.google|zoom\.us|@gmail\.com|BEGIN PRIVATE KEY/i.test(captions), `${label}: captions must not expose private material.`);
  }
  check(existsSync(resolve(root, item.audio)) && statSync(resolve(root, item.audio)).size === item.bytes, `${label}: measured audio size must be accurate.`);
  check(item.duration > 12 && item.duration < 180, `${label}: duration outside expected spoken-movement range.`);
  check(/^[a-f0-9]{64}$/.test(item.sha256), `${label}: SHA-256 provenance missing.`);
  check(Array.isArray(item.sources) && item.sources.length >= 2, `${label}: at least two claim-level sources required.`);
  for (const ref of item.sources) {
    check(typeof ref.claim === 'string' && ref.claim.length > 20 && typeof ref.label === 'string' && ref.label.length > 3, `${label}: each reference must identify its exact claim and label.`);
    try { check(new URL(ref.url).protocol === 'https:', `${label}: public source must be HTTPS.`); }
    catch { check(false, `${label}: malformed source URL.`); }
    check(!/meet\.google|zoom\.us|@gmail\.com|privatediary/i.test(ref.url), `${label}: no private/meeting material may be cited.`);
  }
}
check((narrationStatic.match(/<article id=/g) || []).length === 12, 'Static narrated transcript must contain twelve semantic articles.');
check((narrationStatic.match(/<audio\b/g) || []).length === 12 && !/<audio\b[^>]*autoplay/i.test(narrationStatic), 'Static fallback must offer twelve native non-autoplay audio controls.');
check(read('narration/transcript.txt').includes(narration.disclosure), 'Plain transcript must repeat disclosure.');
check(read('narration/narration.vtt').startsWith('WEBVTT\n\n') && (read('narration/narration.vtt').match(/-->/g) || []).length === 12, 'Full-deck VTT must contain all twelve measured cues.');
check((read('narration/narration.srt').match(/-->/g) || []).length === 12, 'Full-deck SRT must contain all twelve measured cues.');

const ownRuntime = [html, app, hall, painter, narrationJS, css, read('data/deck.json'), read('data/media.json'), read('data/narration.json')].join('\n');
check(!/meet\.google|zoom\.us|mailto:|drive\.google|@gmail\.com/i.test(ownRuntime), 'No private meeting, email, or Drive link may ship.');
check(!/(?:fetch|import)\s*\(\s*['"`]https?:/i.test(app + hall + narrationJS), 'Runtime JavaScript must not fetch or import an external service.');
check(!/@import\s+(?:url\()?\s*['"`]?https?:/i.test(css), 'CSS must not load external resources.');
check(!/\b(?:approved|adopted|deployed)\s+(?:DAO|dao)\b/.test(deck.slides.map((slide) => slide.status).join(' ')), 'Slide statuses must not assert DAO approval, adoption, or deployment.');

if (failures.length) {
  console.error(`FAIL ${failures.length} of ${checks} validation checks:`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`PASS ${checks}/${checks} structural, editorial, fallback, privacy, and local-asset checks.`);
  console.log('PASS 12 synchronized slide articles; 24 Garden Circle history photos + 4 Mumbai frames; 9 portraits; 14 OG node images; Three.js r169 + local VRButton.');
  console.log('PASS no build step, runtime CDN, embedded recording, private meeting link, email link, or onchain/adoption claim.');
}
