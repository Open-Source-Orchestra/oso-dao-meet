#!/usr/bin/env node
/* Optional authoring-time validation. This is not a build or runtime dependency. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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
const locked = deck.slides.find((slide) => slide.id === 'listening-archive');
check(/PROPOSED ONLY/.test(phaseSlide?.status || '') && /NO SAFE OR CONTRACT DEPLOYED/.test(phaseSlide?.status || ''), 'DAO phases must remain explicitly proposed, not deployed or adopted.');
check(invite?.title === 'The third meetup is open to all', 'Third meetup must remain an open invitation for everyone.');
check(invite?.bullets.some((line) => line.includes('No date, time, place or public meeting link has been confirmed here yet.')), 'Third meetup must say details are not yet published.');
check(!invite?.links.some((link) => /meet\.google|zoom\.us/i.test(link.url)), 'Third meetup must not contain a current meeting link.');
check(/LOCKED/.test(locked?.status || '') && /ALL REQUIRED CONSENT/.test(locked?.lede || ''), 'Listening Archive must remain locked pending all required consent.');
check(!locked?.image, 'Listening Archive must not carry an image.');

const ownRuntime = [html, app, hall, painter, css, read('data/deck.json'), read('data/media.json')].join('\n');
check(!/meet\.google|zoom\.us|mailto:|drive\.google|@gmail\.com/i.test(ownRuntime), 'No private meeting, email, or Drive link may ship.');
check(!/<(?:audio|video|iframe)\b/i.test(html), 'No embedded media or iframe may ship in the initial document.');
check(!/(?:fetch|import)\s*\(\s*['"`]https?:/i.test(app + hall), 'Runtime JavaScript must not fetch or import an external service.');
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
