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
check(/PUBLISHED WITH CONSENT/.test(archiveSlide?.status || '') && /NOW PLAYING ON THE PROJECTOR/.test(archiveSlide?.lede || ''), 'Listening Archive must state that the consented meetings now play on the projector.');
check(archiveSlide?.bullets.some((line) => /13 Nov/.test(line) && /full consent to broadcast and share/.test(line)), 'Listening Archive must keep the dated Meeting #1 broadcast/share consent.');
check(archiveSlide?.bullets.some((line) => /raw originals stay private/.test(line)), 'Listening Archive must say the raw originals stay private.');
check(archiveSlide?.bullets.some((line) => /First names only/.test(line) && /takedown door/.test(line)), 'Listening Archive must keep first-names-only and the takedown door.');
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
check(!/<(?:iframe|embed|object)\b/i.test(html), 'No third-party frame may ship in the HTML; YouTube channels load only after an explicit click.');
check((html.match(/<video\b/g) || []).length === 1 && /<video[^>]*preload="none"/.test(html) && !/<video[^>]*autoplay/i.test(html) && !/<video[^>]*\bsrc=/.test(html), 'The theater video element must be single, silent, source-less and non-autoplay until a channel is chosen.');
check(!/\.autoplay\s*=\s*true/i.test(narrationJS), 'Narration controller must not enable media autoplay.');
check(!narrationJS.includes("tts.synth") && !narrationJS.includes('edge_tts'), 'Runtime must not synthesize or substitute voices.');
check(narration.slides.length === 12 && narrationSource.slides.length === 12, 'Narration must contain exactly twelve movements.');
const archiveNarration = narration.slides.find((item) => item.id === 'listening-archive');
const archiveCorrection = archiveNarration?.writtenUpdate;
check(archiveCorrection?.date === '2026-11-13' && /full consent/.test(archiveCorrection?.text || '') && /broadcast and shared everywhere/.test(archiveCorrection?.text || ''), 'Movement 11 must carry the dated full-recording broadcast/share consent correction.');
check(/not attached or hosted/.test(archiveCorrection?.text || '') && /full participant transcript was not separately addressed or released/.test(archiveCorrection?.text || ''), 'Movement 11 historical correction text must stay verbatim (dated 13 Nov).');
const theaterErrata = narration.errata?.find((item) => item.movement === 'listening-archive');
check(theaterErrata?.date === '2026-11-14' && /now plays on the projector/.test(theaterErrata?.text || '') && /raw video is not attached/.test(theaterErrata?.text || '') && narration.slides[10].errata?.text === theaterErrata?.text, 'Movement 11 must carry the dated 14 Nov written update that the consented films now play in the theater, without rewriting the recorded script.');
check(plain(narrationStatic).includes(theaterErrata?.text || '∅') && read('narration/transcript.txt').includes(theaterErrata?.text || '∅') && read('narration/narration.vtt').includes(theaterErrata?.text || '∅'), 'Theater update must be visible on the static narration page, plain transcript and WebVTT notes.');
check(/No new voice was synthesized/.test(archiveCorrection?.audioNote || '') && /superseded archive-lock wording/.test(archiveCorrection?.audioNote || ''), 'Movement 11 must disclose unchanged historical audio and superseded lock wording.');
check(narrationSource.slides.find((item) => item.id === 'listening-archive')?.writtenUpdate?.text === archiveCorrection?.text, 'Movement 11 correction must match its authored source.');
check(narration.totalBytes > 500000 && narration.totalDuration >= 480 && narration.totalDuration <= 720, 'Narration should remain a substantive 8–12 minute deck.');
const devconErrata = narration.errata?.find((item) => item.movement === 'origin-repertoire');
check(devconErrata?.date === '2026-11-14' && /12–14 October 2027/.test(devconErrata?.text || '') && /narration says 11–13/.test(devconErrata?.text || ''), 'Devcon IX date errata (12–14 October 2027) must be recorded against movement 2 without rewriting the recorded script.');
check(/no new voice was synthesized/i.test(devconErrata?.audioNote || '') && narration.slides[1].errata?.text === devconErrata?.text && narrationSource.slides[1].errata?.text === devconErrata?.text, 'Movement 2 errata must match its authored source and keep the historical audio unchanged.');
check(plain(narrationStatic).includes(devconErrata?.text || '∅') && read('narration/transcript.txt').includes(devconErrata?.text || '∅') && read('narration/narration.vtt').includes(devconErrata?.text || '∅'), 'Devcon IX errata must be visible on the static narration page, plain transcript and WebVTT notes.');
check(narrationJS.includes('item.errata') && /dates superseded/.test(narrationJS), 'Live narration panel must surface the dated errata beside the historical script.');
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

// Meeting #2 (13 Nov 2026): published with consent confirmed by Shaka on 14 Nov 2026. Still consent-first, still a proposal.
const meeting2 = json('meetings/2/status.json');
const transcript2 = json('meetings/2/transcript/transcript.json');
check(meeting2.meeting === 2 && meeting2.recording.status === 'published_with_consent', 'Meeting 2 must be published with consent.');
check(meeting2.recordingConsent.status === 'confirmed' && meeting2.recordingConsent.reportedAt === '2026-11-14T04:20:00Z', 'Meeting 2 consent must record its exact confirmation.');
check(meeting2.recording.rawVideo.hostedOnThisSite === false && meeting2.privateMeetLinks === null, 'Meeting 2 raw video and private Meet links must stay private.');
check(existsSync(resolve(root, meeting2.recording.publicAudio.slice(1))) && statSync(resolve(root, meeting2.recording.publicAudio.slice(1))).size === meeting2.recording.publicAudioBytes, 'Meeting 2 consented MP3 must exist with accurate measured bytes.');
check(transcript2.meeting === 2 && transcript2.turns.length >= 20 && transcript2.stats.words > 5000, 'Meeting 2 transcript must be complete.');
check(transcript2.turns.every((turn) => transcript2.speakers[turn.speaker]), 'Meeting 2 transcript speakers must be declared.');
check(transcript2.turns.every((turn) => turn.segments.every((seg) => !/meet\.google|zoom\.us|drive\.google|@gmail|\+?\d[\d\s().-]{8,}\d|NavPoint|\bKEW\b/i.test(seg.text))), 'Meeting 2 transcript must not contain private links, contacts or shielded names.');
for (const relative of ['meetings/2/index.html', 'meetings/2/notes/index.html', 'meetings/2/transcript/index.html', 'meetings/2/audio/index.html']) {
  const page = read(relative);
  check(/<link rel="canonical" href="https:\/\/osodaomeet\.opensourceorchestra\.org\/meetings\/2\//.test(page), `${relative}: canonical production URL required.`);
  check(/published with consent/i.test(plain(page)) && /proposal/i.test(plain(page)), `${relative}: must state consent and proposal status.`);
  check(!/meet\.google|drive\.google|@gmail|18OXbtj|\/workspace\//i.test(page), `${relative}: no private link, Drive ID, email or internal path may ship.`);
  check(!/<audio\b[^>]*autoplay/i.test(page), `${relative}: audio must never autoplay.`);
  check(!/<(?:script|img|link)\b[^>]*(?:src|href)="https?:/i.test(page.replace(/<link rel="canonical"[^>]*>/, '')), `${relative}: no external runtime resource.`);
  check(/opensourceorchestra\.org\/takedown\//.test(page), `${relative}: takedown path required.`);
}
check(read('meetings/2/transcript/transcript.vtt').startsWith('WEBVTT\n') && read('meetings/2/transcript/transcript.txt').includes('Proposal Meeting #2'), 'Meeting 2 plain and WebVTT transcripts required.');
check(/href="\.\/2\/"/.test(read('meetings/index.html')) && /href="\.\/meetings\/"/.test(html), 'Meetings ledger must link Meeting #2 and the hall must link the ledger.');
check(json('archive/status.json').meetings['2'].status === 'published_with_consent' && json('archive/status.json').meetings['1'].status === 'published_with_consent', 'Archive must record both proposal meetings as published with consent.');

// The Theater (14 Nov 2026): one room, six channels, every film recorded with consent to publish.
const channels = json('data/channels.json');
const garden = json('data/garden.json');
const theaterJS = read('js/theater.js');
const channelsStatic = read('channels/index.html');
const ledger = read('meetings/index.html');
const archiveStatus = json('archive/status.json');
check(channels.schema === 'oso-theater-channels-v1' && channels.channels.length === 6, 'The theater must list exactly six channels.');
check(channels.channels.map((channel) => channel.number).join(',') === '1,2,3,4,5,6', 'Channels must be numbered 1–6 in order.');
check(channels.channels.map((channel) => channel.kind).join(',') === 'video,video,video,deck,youtube,youtube', 'Channels 1–3 films, 4 deck, 5–6 YouTube.');
check(/publicinform\.com\/#consent/.test(channels.protocol.url) && /takedown\//.test(channels.protocol.takedown), 'Theater must link the PIT protocol and the takedown door.');
for (const channel of channels.channels) {
  const label = `Channel ${channel.number} (${channel.id})`;
  check(/^[a-z0-9-]+$/.test(channel.id) && channel.title && channel.lede && channel.consent?.line && channel.consent?.status, `${label}: id, title, lede and consent line are required.`);
  check(Array.isArray(channel.speakers) && channel.speakers.length >= 1 && channel.speakers.every((name) => !/\s[A-Z][a-z]+$/.test(name) || /AI steward/.test(name)), `${label}: who spoke must be first names only.`);
  check(Array.isArray(channel.links) && channel.links.length >= 2 && channel.links.every((link) => /^(https:\/\/|\/)/.test(link.url)), `${label}: links must be public HTTPS or same-site.`);
  check(channel.media?.poster && existsSync(resolve(root, channel.media.poster)), `${label}: poster must be a local asset.`);
  check(channelsStatic.includes(`id="${channel.id}"`) && ledger.includes(`id="${channel.id}"`), `${label}: must appear in the readable channels edition and the public media files ledger.`);
  const straight = (text) => plain(text).replace(/[’‘]/g, "'").toLowerCase();
  check(straight(channelsStatic).includes(straight(channel.consent.line).slice(0, 40)) || channel.kind !== 'video', `${label}: consent line must be visible in the readable edition.`);
  if (channel.kind === 'video') {
    const video = channel.media.video;
    check(channels.mediaOrigins.video.some((origin) => video.url.startsWith(origin)), `${label}: film must stream from an allowed origin.`);
    check(/^published_with_consent$/.test(channel.consent.status) && /consent/i.test(channel.consent.line) && channel.consent.confirmedAt, `${label}: films require explicit consent facts.`);
    check(Number.isInteger(video.bytes) && video.bytes > 100000000, `${label}: measured film bytes required.`);
    check(channel.id === 'weekly-call-2' || /^[a-f0-9]{64}$/.test(video.sha256 || ''), `${label}: SHA-256 provenance required for films we encoded.`);
    check(channel.media.captions && existsSync(resolve(root, channel.media.captions)) && read(channel.media.captions).startsWith('WEBVTT'), `${label}: WebVTT captions required.`);
    check(channel.media.transcript && existsSync(resolve(root, channel.media.transcript)), `${label}: karaoke transcript JSON required.`);
    const captions = read(channel.media.captions);
    check(!/meet\.google|zoom\.us|drive\.google|@gmail|NavPoint|\bKEW\b|\bBrent\b|\bBlake\b/i.test(captions), `${label}: captions must not expose private or shielded material.`);
    check(Array.isArray(channel.chapters) && channel.chapters.length >= 8 && channel.chapters.every((chapter, index, list) => index === 0 || chapter.start > list[index - 1].start), `${label}: at least eight monotonic chapters required.`);
    check(channel.durationSeconds > 3000 && channel.chapters.every((chapter) => chapter.start < channel.durationSeconds), `${label}: chapters must fall inside the film.`);
  }
  if (channel.kind === 'youtube') {
    check(channels.mediaOrigins.youtube.includes(channel.media.youtubeId) && channel.media.embed === `https://www.youtube-nocookie.com/embed/${channel.media.youtubeId}?rel=0`, `${label}: only the two blessed YouTube ids via youtube-nocookie.`);
    check(/Shaka/.test(channel.consent.line) && /own/.test(channel.consent.line), `${label}: YouTube channels must be Shaka's own published videos.`);
    check(/growing|grow/i.test(channel.lede), `${label}: must be framed as an example of growing the public media files.`);
  }
}
check(theaterJS.includes("youtube-nocookie.com/embed/") && !/<iframe/i.test(html) && theaterJS.includes('state.origins.youtube.includes'), 'YouTube embeds are runtime-only, click-to-load, id-allowlisted.');
check(!/autoplay/i.test(theaterJS.replace(/No autoplay|no autoplay|autoplay, no trackers/g, '')) && !/\.play\(\)(?![^\n]*catch)/.test(theaterJS.split('\n').filter((line) => line.includes('.play()') && !line.includes('catch')).join('')), 'Theater must never autoplay.');
check(theaterJS.includes("preload") || /preload="none"/.test(html), 'Theater video must be lazy.');
check(theaterJS.includes('setVideo') && hall.includes('VideoTexture') && hall.includes('setVideo(videoElement)'), 'The playing film must be mirrored onto the hall projector.');
check(hall.includes('buildOrchestraPit') && hall.includes("dataset.pit = 'floor'"), 'The orchestra pit must sit on the floor of the one theater.');
check(hall.includes('this.garden') && hall.includes('historyItems = [...this.garden'), 'The living wall must lead with the garden photographs.');
check(garden.schema === 'oso-theater-garden-v1' && garden.items.length === 16 && garden.items.every((item) => item.src.startsWith('./assets/garden/') && existsSync(resolve(root, item.src)) && /mandala-room/.test(item.sourceUrl) && item.alt.length > 25), 'Garden must hold 16 already-public Mandala Room photographs with alt text and provenance.');
check(readdirSync(resolve(root, 'assets/garden')).filter((file) => file.endsWith('.webp')).length === 16, 'Exactly 16 garden files on disk.');
check(!/dc8-906|dc8-392/.test(read('data/garden.json') + readdirSync(resolve(root, 'assets/garden')).join(' ')), 'Excluded photographs must never enter the garden.');
check(/garden-drift/.test(css) && /flutter-rise/.test(css) && /prefers-reduced-motion: reduce\) \{ \.garden-photo/.test(css), 'Garden drift and butterflies must exist and stand still under reduced motion.');
check(/id="channels-button"/.test(html) && /id="theater"/.test(html) && /id="channel-dial"/.test(html) && /id="karaoke-lines"/.test(html) && /role="tablist"/.test(html), 'Theater markup: channels button, dial, karaoke transcriber.');
check(/#theater\{display:none!important\}/.test(html) && /\/channels\//.test(html), 'No-JS: the theater hides and the readable channels edition is linked.');
check(!/<button id="venue-button"[^>]*title="Choose an artistic hall"/.test(html) && /LIGHTING/.test(html) && /ONE THEATER/.test(html), 'One theater: the three halls survive only as a lighting toggle.');
check(!/<(?:script|img|link)\b[^>]*(?:src|href)="https?:/i.test(channelsStatic.replace(/<link rel="canonical"[^>]*>/, '')) && !/<(?:script|img|link)\b[^>]*(?:src|href)="https?:/i.test(ledger.replace(/<link rel="canonical"[^>]*>/, '')), 'Readable channels edition and ledger must not load external runtime resources.');
check((channelsStatic.match(/<video\b/g) || []).length === 3 && !/<video[^>]*autoplay/i.test(channelsStatic) && (channelsStatic.match(/preload="none"/g) || []).length === 3 && !/<iframe/i.test(channelsStatic), 'Readable edition: three lazy native films, no iframes.');
check(/opensourceorchestra\.org\/takedown\//.test(channelsStatic) && /publicinform\.com\/#consent/.test(channelsStatic) && /opensourceorchestra\.org\/takedown\//.test(ledger) && /publicinform\.com\/#consent/.test(ledger), 'Takedown door and PIT protocol on the readable edition and the ledger.');
check(archiveStatus.status === 'published_with_consent' && archiveStatus.meetings['1'].status === 'published_with_consent' && archiveStatus.meetings['2'].status === 'published_with_consent' && archiveStatus.meetings['weekly-call-2'].status === 'published_with_consent' && archiveStatus.items.length === 3, 'Archive status must list the three consented films.');
const meeting1 = json('meetings/1/status.json');
const transcript1 = json('meetings/1/transcript/transcript.json');
check(meeting1.recording.status === 'published_with_consent' && meeting1.recordingConsent.reportedAt === '2026-11-13T05:21:00Z' && meeting1.recording.publicVideo.url === channels.channels[1].media.video.url && meeting1.recording.publicVideo.sha256 === channels.channels[1].media.video.sha256, 'Meeting 1 status must match the channel registry.');
check(transcript1.meeting === 1 && transcript1.turns.length >= 20 && transcript1.stats.words > 5000 && transcript1.turns.every((turn) => transcript1.speakers[turn.speaker]), 'Meeting 1 transcript must be complete with declared speakers.');
check(transcript1.turns.every((turn) => turn.segments.every((seg) => !/meet\.google|zoom\.us|drive\.google|@gmail|\+?\d[\d\s().-]{8,}\d|NavPoint|\bKEW\b|19-year-old/i.test(seg.text))), 'Meeting 1 transcript must not contain private links, contacts, ages or shielded names.');
for (const relative of ['meetings/1/index.html', 'meetings/1/transcript/index.html', 'meetings/1/audio/index.html', 'channels/index.html', 'meetings/index.html']) {
  const page = read(relative);
  check(/published with consent/i.test(plain(page)) && /proposal/i.test(plain(page)), `${relative}: must state consent and proposal status.`);
  check(!/meet\.google|drive\.google|@gmail|18OXbtj|\/workspace\//i.test(page), `${relative}: no private link, Drive ID, email or internal path may ship.`);
  check(!/<(?:audio|video)\b[^>]*autoplay/i.test(page), `${relative}: media must never autoplay.`);
}
const wc2 = json('data/transcripts/weekly-call-2.json');
check(wc2.cues.length > 250 && wc2.cues.every((cue, index, list) => cue.end > cue.start && (index === 0 || cue.start >= list[index - 1].start)) && wc2.cues[wc2.cues.length - 1].end <= 5831.21, 'Weekly call #2 karaoke cues must be monotonic and inside the film.');
check(Object.keys(wc2.speakers).every((name) => !/\s/.test(name)), 'Weekly call #2 karaoke labels must be first names only.');
check(hall.includes("'Memory gold'") && app.includes('One theater, three lightings'), 'Lighting presets replace the three-hall navigation.');

const ownRuntime = [html, app, hall, painter, narrationJS, theaterJS, css, read('data/deck.json'), read('data/media.json'), read('data/narration.json'), read('data/channels.json'), read('data/garden.json')].join('\n');
check(!/meet\.google|zoom\.us|mailto:|drive\.google|@gmail\.com/i.test(ownRuntime), 'No private meeting, email, or Drive link may ship.');
check(!/(?:fetch|import)\s*\(\s*['"`]https?:/i.test(app + hall + narrationJS + theaterJS), 'Runtime JavaScript must not fetch or import an external service.');
check(!/@import\s+(?:url\()?\s*['"`]?https?:/i.test(css), 'CSS must not load external resources.');
check(!/\b(?:approved|adopted|deployed)\s+(?:DAO|dao)\b/.test(deck.slides.map((slide) => slide.status).join(' ')), 'Slide statuses must not assert DAO approval, adoption, or deployment.');

if (failures.length) {
  console.error(`FAIL ${failures.length} of ${checks} validation checks:`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`PASS ${checks}/${checks} structural, editorial, fallback, privacy, and local-asset checks.`);
  console.log('PASS 12 synchronized slide articles; 24 Garden Circle history photos + 4 Mumbai frames; 9 portraits; 14 OG node images; Three.js r169 + local VRButton.');
  console.log('PASS no build step, runtime CDN, private meeting link, email link, or onchain/adoption claim; Meeting #2 audio + transcript published only with confirmed consent.');
  console.log('PASS the theater: one room, orchestra pit on the floor, 16-photo living wall, six channels (3 consented films + deck + 2 blessed YouTube ids), karaoke transcribers, no autoplay.');
}
