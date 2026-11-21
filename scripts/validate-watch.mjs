#!/usr/bin/env node
/* The Pit Theater (Open Source Orchestra) v3 · authoring-time gates for /watch/ (Season 1 · The Proposal Circles). Not a build or runtime dependency.
   Run after `python3 scripts/build_watch.py`. GPL-3.0 · built by the ʻohana (machines, labelled as machines). */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let checks = 0;
const check = (ok, message) => { checks += 1; if (!ok) failures.push(message); };
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));
const exists = (rel) => existsSync(resolve(root, rel.replace(/^\//, '')));
const plain = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, ' ');
const PRIVATE = /meet\.google|zoom\.us|drive\.google|@gmail|mailto:|NavPoint|\bKEW\b|\bBrent\b|\bBlake\b|Ham Agents|\/workspace\//i;
const PUBLISHED = 'published_with_consent';

// 1. generator is current
const diff = (() => { try { execFileSync('python3', ['-I', 'scripts/build_watch.py', '--check'], { cwd: root, stdio: 'pipe' }); return ''; } catch (error) { return String(error.stdout || error.message); } })();
check(!/would change: (watch\/|data\/search-index|data\/season1\/public)/.test(diff), `Generated /watch/ files are stale — run python3 scripts/build_watch.py:\n${diff}`);

// 2. the season
const season = json('data/season1/season.json');
const garden = json('data/season1/garden.json');
const live = json('data/season1/live.json');
check(season.schema === 'oso-pit-theater-season-v1' && Array.isArray(season.episodes) && season.episodes.length >= 6, 'season.json must hold Season 1 (pilot + e1…e5).');
check(season.episodes.map((e) => e.id).join(',') === 'pilot,e1,e2,e3,e4,e5', 'Episode order must be pilot, e1…e5.');
check(/CROPS values/.test(season.show.values.crops) && /Infinite Garden/.test(season.show.values.garden), 'The values strip text must live in season.json.');
check(/machines, labelled as machines/.test(season.show.machines), 'Machines must say they are machines.');
check(['published_with_consent', 'pending_confirmation', 'gated'].every((k) => season.consentStates[k]), 'Consent states (published · pending · gated) must stay in the schema.');
const published = season.episodes.filter((e) => e.consent?.status === PUBLISHED);
const hidden = season.episodes.filter((e) => e.consent?.status === 'gated');
const pending = season.episodes.filter((e) => e.consent?.status === 'pending_confirmation');
for (const ep of season.episodes) {
  const label = `Episode ${ep.id}`;
  check(/^(pilot|e\d+)$/.test(ep.id) && ep.title && ep.lede && ep.durationLabel && ep.dateLabel, `${label}: id, title, lede, duration and date are required.`);
  check(Array.isArray(ep.speakers) && ep.speakers.length >= 1 && ep.speakers.every((n) => !/\s[A-Z][a-z]+$/.test(n) || /^(Food For Riot)$/.test(n)), `${label}: first names (or chosen display names) only.`);
  check(ep.consent?.status && ep.consent?.line && /consent/i.test(ep.consent.line) && ep.consent.confirmedAt, `${label}: consent status, line and confirmation date are required.`);
  check(!/\bOSO\b/.test(`${ep.title} ${ep.tagline}`), `${label}: write "Open Source Orchestra" in full in titles (quotes inside ledes may keep a speaker's own words).`);
  const video = ep.media?.video || {};
  check(season.mediaOrigins.some((o) => (video.url || '').startsWith(o)), `${label}: film must come from an allowed origin.`);
  if (video.arriving) check(video.bytes === null && video.sha256 === null, `${label}: an arriving film carries null bytes/sha256 until verified.`);
  else check(Number.isInteger(video.bytes) && video.bytes > 100000000 && (ep.id === 'pilot' || /^[a-f0-9]{64}$/.test(video.sha256 || '')), `${label}: a published film needs measured bytes (and SHA-256 for films we encoded).`);
  check(exists(ep.media.poster), `${label}: poster must be a local asset (${ep.media.poster}).`);
  check(Array.isArray(ep.chapters) && ep.chapters.every((c, i, a) => i === 0 || c.start > a[i - 1].start) && ep.chapters.every((c) => c.start < ep.durationSeconds), `${label}: chapters must be monotonic and inside the film.`);
  check(!PRIVATE.test(JSON.stringify(ep)), `${label}: no private link, contact or shielded name may ship.`);
}
check(json('meetings/4/status.json').recordingConsent.reportedAt === '2026-11-21T11:50:00+07:00' && json('meetings/5/status.json').recordingConsent.reportedAt === '2026-11-21T11:50:00+07:00', 'Meets #4 and #5 must record Shaka\'s 21 Nov 11:50 Bangkok consent confirmation.');
check(json('meetings/5/status.json').participants.guests.join(',') === 'Ben,Bo,Food For Riot', 'Meet #5 participants: Ben, Bo, Food For Riot (first names / chosen display names).');

// 3. pages
const pages = ['watch/index.html', 'watch/search/index.html', 'watch/garden/index.html', 'watch/live/index.html', ...published.map((e) => `watch/${e.id}/index.html`), ...published.map((e) => `watch/embed/${e.id}/index.html`)];
for (const rel of pages) {
  check(existsSync(resolve(root, rel)), `${rel}: page must exist.`);
  if (!existsSync(resolve(root, rel))) continue;
  const page = read(rel);
  const text = plain(page);
  const embed = rel.startsWith('watch/embed/');
  check((page.match(/<script src="\/lang\.js" async><\/script>/g) || []).length === 1, `${rel}: the ʻŌlelo language bridge exactly once.`);
  check(/opensourceorchestra\.org\/takedown\//.test(page), `${rel}: takedown link required.`);
  check(/<link rel="canonical" href="https:\/\/osodaomeet\.opensourceorchestra\.org\/watch\//.test(page), `${rel}: canonical production URL required.`);
  if (!embed) {
    check(/CROPS values/.test(text) && /consent asked out loud/.test(text) && /share-alike, fork us like crazy/.test(text) && /Infinite Garden/.test(text) && /more open, more musical and more alive/.test(text), `${rel}: the values strip (SPEC §3) must be on the page.`);
    check(/GPL-3\.0/.test(text) && /CC BY-SA 4\.0/.test(text), `${rel}: GPL-3.0 + CC BY-SA 4.0 footer.`);
    check(/machines, labelled as machines/.test(text), `${rel}: machines must say they are machines.`);
    check(/proposal/i.test(text) && !/on-chain DAO\b(?! \(|,|\.)/.test('') , `${rel}: must say the DAO is a proposal.`);
    check(/opensourceorchestra\.org\/join\//.test(page), `${rel}: the join page is the only door.`);
  }
  check(!PRIVATE.test(page), `${rel}: no private link, contact, Drive ID, email or internal path may ship.`);
  const prose = plain(page.replace(/<li data-start="[^"]*"[\s\S]*?<\/li>/g, ' ').replace(/<q>[\s\S]*?<\/q>/g, ' ').replace(/<ul class="quotes">[\s\S]*?<\/ul>/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' '));
  check(!/\bOSO\b/.test(prose), `${rel}: NAME LAW — bare "OSO" in visible prose (write "Open Source Orchestra" in full): ${(prose.match(/.{0,30}\bOSO\b.{0,30}/) || [''])[0]}`);
  check(!/<(?:video|audio)\b[^>]*\bautoplay\b/i.test(page), `${rel}: media must never autoplay.`);
  check(!/<video\b(?![^>]*preload="none")/i.test(page) && !/<audio\b(?![^>]*preload="none")/i.test(page), `${rel}: every media element is lazy (preload="none").`);
  check(!/<(?:script|img|link)\b[^>]*(?:src|href)="https?:/i.test(page.replace(/<link rel="canonical"[^>]*>/, '').replace(/<meta[^>]*>/g, '')), `${rel}: no external runtime resource (films are media, not scripts).`);
  check(!/<iframe/i.test(page), `${rel}: no third-party frame.`);
  check(!/position:\s*fixed/i.test(page), `${rel}: BUTTON LAW — nothing of ours floats over text (no position:fixed in the page).`);
  for (const m of page.matchAll(/<video[^>]*\bsrc="([^"]+)"/g)) check(season.mediaOrigins.some((o) => m[1].startsWith(o)), `${rel}: film origin not allowed: ${m[1]}`);
}
check(!/position:\s*fixed/.test(read('css/watch.css').replace(/\.skip-link[^}]*\}/, '')), 'BUTTON LAW: watch.css must not float anything over text (skip-link excepted — it is off-screen until focused).');
check(/prefers-reduced-motion:\s*reduce/.test(read('css/watch.css')) && /@media print/.test(read('css/watch.css')), 'Reduced-motion and print stylesheets must exist.');

// 4. the TV
const tv = read('watch/index.html');
for (const ep of published) check(tv.includes(`data-ep="${ep.id}"`) && tv.includes(`href="./${ep.id}/"`), `TV must list published ${ep.id}.`);
for (const ep of pending) check(tv.includes(ep.title) && !tv.includes(`href="./${ep.id}/"`) && !new RegExp(`data-player[^>]*data-ep="${ep.id}"`).test(tv), `TV lists pending ${ep.id} with a badge and no media.`);
for (const ep of hidden) check(!tv.includes(ep.title || '∅∅') && !tv.includes(`"${ep.id}"`) && !(ep.speakers || []).some((n) => tv.includes(n)) && !existsSync(resolve(root, `watch/${ep.id}`)), `Gated ${ep.id} must be invisible: no title, no speakers, no page.`);
check(/Up next/.test(tv) && /id="continue"/.test(tv) && /Episode guide/.test(tv) && /field guide/i.test(tv) && /feed\.xml/.test(tv), 'TV: now playing + up next + continue slot + guide + field guide + feed.');
check((tv.match(/film arriving/g) || []).length >= 1 || published.every((e) => !e.media.video.arriving), 'TV must say "film arriving" for episodes whose film is not uploaded yet.');

// 5. episode pages
for (const ep of published) {
  const page = read(`watch/${ep.id}/index.html`);
  const label = `watch/${ep.id}/`;
  check(page.includes(`data-ep="${ep.id}"`) && page.includes('data-chapters') && /class="chapters-bar/.test(page) && /class="player-status"/.test(page), `${label}: player markup.`);
  check(page.includes('id="words"') && page.includes('id="transcript"') && /Highlight reel/.test(page) && /id="credits-title"/.test(page), `${label}: words, transcript, reel and credits sections.`);
  check(plain(page).replace(/[’‘]/g, "'").includes(ep.consent.line.replace(/[’‘]/g, "'").slice(0, 40)), `${label}: consent line visible.`);
  const hasTranscript = (ep.media.transcript && exists(ep.media.transcript)) || existsSync(resolve(root, `data/season1/${ep.id}.transcript.json`));
  if (hasTranscript) {
    const lines = (page.match(/<li data-start="/g) || []).length;
    check(lines > 200, `${label}: no-JS karaoke transcript must be in the HTML (${lines} lines).`);
    check(/data-start="[\d.]+" data-end="[\d.]+"/.test(page) && /class="t" href="\?t=/.test(page), `${label}: transcript lines carry start/end and ?t= links.`);
  } else check(/Transcript arriving/.test(page), `${label}: must say the transcript is arriving.`);
  const words = json(`data/season1/${ep.id}.words.json`);
  if (words.draft) check(/Words in progress/.test(page), `${label}: draft words must show the visible "words in progress" note.`);
  else check(!/Words in progress/.test(page) && words.quotes.length >= 3 && words.recap.length >= 3, `${label}: finished words must render without the draft note.`);
  if (ep.media.video.arriving) check(/Film arriving/.test(page) && !new RegExp(`<video[^>]*src="${ep.media.video.url}`).test(page), `${label}: arriving film shows the arriving state and attaches no src.`);
  else check(page.includes(`src="${ep.media.video.url}"`) && /<track kind="captions"/.test(page), `${label}: published film + captions track.`);
  check(exists(ep.media.captions) ? read(ep.media.captions.replace(/^\//, '')).startsWith('WEBVTT') : true, `${label}: captions must be WebVTT.`);
  const embed = read(`watch/embed/${ep.id}/index.html`);
  check(/class="embed"/.test(embed) && !/<header/.test(embed) && /target="_top"/.test(embed), `${label}: embed page is minimal and links out with target=_top.`);
}

// 6. search index
const index = json('data/search-index.json');
check(index.schema === 'oso-pit-theater-search-index-v1' && Array.isArray(index.lines) && index.lines.length > 3000, 'Search index must contain every public line.');
check(Object.keys(index.episodes).every((id) => published.some((e) => e.id === id)), 'Search index must contain only published episodes.');
check(index.lines.every((l) => l.length === 5 && typeof l[1] === 'number' && !PRIVATE.test(l[4])), 'Search lines must be [ep,start,end,who,text] and clean.');
check(statSync(resolve(root, 'data/search-index.json')).size < 900000, 'Search index should stay under 900 KB.');

// 7. garden
const gardenPage = read('watch/garden/index.html');
check(garden.schema === 'oso-pit-theater-memory-garden-v1' && garden.seeds.length >= 6 && /tribute/i.test(garden.framing) && /nothing is invented/i.test(garden.framing), 'Garden: schema, seeds, honest tribute framing.');
for (const seed of garden.seeds) {
  const ep = season.episodes.find((e) => e.id === seed.episode);
  check(ep && ep.consent.status === PUBLISHED, `Seed ${seed.id}: only from published episodes.`);
  check(!/\s[A-Z][a-z]+$/.test(seed.who), `Seed ${seed.id}: first name only.`);
  // verbatim: words in order inside the transcript near t
  const transcript = ep && exists(ep.media.transcript) ? json(ep.media.transcript.replace(/^\//, '')) : (ep && existsSync(resolve(root, `data/season1/${ep.id}.transcript.json`)) ? json(`data/season1/${ep.id}.transcript.json`) : null);
  if (transcript) {
    const cues = transcript.cues || transcript.turns.flatMap((t) => t.segments);
    const hay = cues.filter((c) => c.start >= seed.t - 1 && c.start <= seed.t + 150).map((c) => c.text).join(' ').toLowerCase();
    const words = seed.text.replace(/\[[^\]]*\]/g, ' ').toLowerCase().replace(/…/g, ' ').match(/[a-z0-9']+/g) || [];
    let pos = 0, ok = words.length > 0;
    for (const w of words) { const at = hay.indexOf(w, pos); if (at < 0) { ok = false; break; } pos = at + w.length; }
    check(ok, `Seed ${seed.id}: text must be verbatim from the transcript near ${seed.t}s.`);
  }
  check(gardenPage.includes(`id="${seed.id}"`) && gardenPage.includes(`data-seed="${seed.id}"`), `Seed ${seed.id}: card + plant on the page.`);
}
check((gardenPage.match(/class="seed-plant"/g) || []).length === garden.seeds.length && /<svg/.test(gardenPage) && /NEXT CIRCLE/.test(gardenPage), 'Garden SVG grows with the seed count and leaves plots for the next circles.');
check(/ethereum\.foundation\/infinitegarden/.test(gardenPage) && /not an official EF project/.test(gardenPage), 'Garden must credit the Infinite Garden idea honestly.');

// 8. live + feed + embeds + JS budget
const livePage = read('watch/live/index.html');
check(!/meet\.google|zoom\.us/i.test(livePage) && /opensourceorchestra\.org\/join\//.test(livePage) && /publicinform\.com\/#consent/.test(livePage), 'Live: join page only, PIT protocol linked, no raw meeting link.');
check(live.next === null || !Number.isNaN(Date.parse(live.next)), 'live.json next must be null or ISO-8601.');
const feed = read('watch/feed.xml');
check(!/\bOSO\b/.test(feed.replace(/<description>[\s\S]*?<\/description>/g, '')), 'NAME LAW: no bare "OSO" in feed titles.');
check(feed.startsWith('<?xml') && /<rss version="2.0"/.test(feed) && /CC BY-SA 4\.0/.test(feed) && /itunes:image href="https:\/\/osodaomeet\.opensourceorchestra\.org\/assets\/watch\/season1-artwork\.jpg"/.test(feed), 'Podcast feed: RSS 2.0, CC BY-SA 4.0, artwork.');
const enclosures = [...feed.matchAll(/<enclosure url="([^"]+)" length="(\d+)" type="audio\/mpeg"\/>/g)];
check(enclosures.length === published.filter((e) => e.media.audio && !e.media.audio.arriving && e.media.audio.bytes).length, 'Feed items only for episodes whose MP3 is verified.');
for (const [, url, length] of enclosures) { const rel = url.replace('https://osodaomeet.opensourceorchestra.org/', ''); if (!url.startsWith('https://archive.org')) check(existsSync(resolve(root, rel)) && statSync(resolve(root, rel)).size === Number(length), `Feed enclosure bytes must match the file: ${rel}`); }
check(existsSync(resolve(root, 'assets/watch/season1-artwork.jpg')) && existsSync(resolve(root, 'assets/watch/season1-og.jpg')), 'Season artwork + OG image.');
const jsFiles = readdirSync(resolve(root, 'js/watch')).filter((f) => f.endsWith('.js'));
const gz = jsFiles.reduce((sum, f) => sum + gzipSync(read(`js/watch/${f}`)).length, 0);
check(gz < 60 * 1024, `JS budget: all /js/watch modules gzip to ${gz} bytes (limit 61440).`);
for (const f of jsFiles) {
  const src = read(`js/watch/${f}`);
  check(!/(?:fetch|import)\s*\(\s*['"`]https?:/i.test(src), `${f}: runtime must not fetch or import an external service.`);
  check(!/\.autoplay\s*=\s*true/.test(src), `${f}: no forced autoplay.`);
}
check(/opt-in|autonext/.test(read('js/watch/player.js')) && /localStorage/.test(read('js/watch/common.js')) && !/navigator\.sendBeacon|XMLHttpRequest/.test(read('js/watch/common.js') + read('js/watch/player.js')), 'Continue watching + autoplay-next stay local and opt-in.');
check(/sitemap/.test('sitemap') && /\/watch\/<\/loc>/.test(read('sitemap.xml')) && /\/watch\/garden\/<\/loc>/.test(read('sitemap.xml')) && /\/meetings\/4\/<\/loc>/.test(read('sitemap.xml')) && /\/meetings\/5\/<\/loc>/.test(read('sitemap.xml')), 'Sitemap lists /watch/ surfaces and Meets #4/#5.');
check(/id="meeting-4"/.test(read('meetings/index.html')) && /id="meeting-5"/.test(read('meetings/index.html')) && /watch\//.test(read('meetings/index.html')), 'Ledger lists Meets #4 and #5 and links the TV.');

if (failures.length) {
  console.error(`FAIL ${failures.length} of ${checks} /watch/ checks:`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exitCode = 1;
} else {
  console.log(`PASS ${checks}/${checks} /watch/ checks · ${published.length} published episodes · ${pending.length} pending · ${hidden.length} gated · ${garden.seeds.length} garden seeds · ${index.lines.length.toLocaleString()} searchable lines · JS ${gz} B gz.`);
}
