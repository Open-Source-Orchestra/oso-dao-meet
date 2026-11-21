#!/usr/bin/env node
/* Unit tests for js/watch/karaoke.js (pure parts: VTT parse, cue search, word timing, drift, sidecar attach).
   Authoring-time only. `node scripts/test-karaoke.mjs`. GPL-3.0 · built by the ʻohana (machines, labelled as machines). */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVTT, findCue, wordTimes, wordIndex, wordFraction, drift, attachWords, tokens, GRACE } from '../js/watch/karaoke.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let checks = 0;
const check = (ok, message) => { checks += 1; if (!ok) failures.push(message); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// 1. VTT parsing (voice spans, hours, commas, blank-line separated payloads, sorting)
const vtt = `WEBVTT\n\nNOTE a note\n\n00:00:30.590 --> 00:00:42.850\n<v Shaka>And a flexibility of getting\ninto the next opportunity.\n\n00:00.590 --> 00:29.590 align:start\n<v Shaka>Hello, now we're recording.\n\n01:02:03,500 --> 01:02:04,000\n<c.yellow>late</c> words\n`;
const cues = parseVTT(vtt);
check(cues.length === 3, `parseVTT: 3 cues (${cues.length})`);
check(near(cues[0].start, 0.59) && near(cues[0].end, 29.59) && cues[0].speaker === 'Shaka' && cues[0].text === "Hello, now we're recording.", `parseVTT: first cue sorted + voice span (${JSON.stringify(cues[0])})`);
check(cues[1].text === 'And a flexibility of getting into the next opportunity.', 'parseVTT: multi-line payload joined with spaces');
check(near(cues[2].start, 3723.5) && cues[2].text === 'late words' && cues[2].speaker === '', 'parseVTT: hours + comma millis + tags stripped');

// 2. the real VTT files parse to the same windows as the JSON they came from
for (const [vttPath, jsonPath] of [['meetings/1/transcript/transcript.vtt', 'meetings/1/transcript/transcript.json'], ['meetings/4/transcript/transcript.vtt', 'meetings/4/transcript/transcript.json']]) {
  if (!existsSync(resolve(root, vttPath))) continue;
  const parsed = parseVTT(readFileSync(resolve(root, vttPath), 'utf8'));
  const data = JSON.parse(readFileSync(resolve(root, jsonPath), 'utf8'));
  const flat = data.cues || data.turns.flatMap((turn) => turn.segments);
  check(parsed.length === flat.length, `${vttPath}: ${parsed.length} VTT cues vs ${flat.length} JSON cues`);
  check(parsed.every((cue, i) => near(cue.start, flat[i].start, 0.002) && near(cue.end, flat[i].end, 0.002)), `${vttPath}: VTT windows == JSON windows`);
}

// 3. cue search
const starts = [0.59, 30.59, 43.85, 60, 100], ends = [29.59, 42.85, 59.03, 70, 110];
check(findCue(starts, ends, 0) === -1, 'findCue: before the first cue → -1');
check(findCue(starts, ends, 0.59) === 0 && findCue(starts, ends, 29.59) === 0, 'findCue: inclusive bounds');
check(findCue(starts, ends, 30.0) === 0, 'findCue: inside the grace window after a cue keeps it lit');
check(findCue(starts, ends, 70 + GRACE + 0.01) === -1, 'findCue: silence beyond grace → -1');
check(findCue(starts, ends, 70.5) === 3, 'findCue: 0.5 s into silence still lit');
check(findCue(starts, ends, 42.9) === 1 && findCue(starts, ends, 43.85) === 2, 'findCue: boundary hands over to the next cue at its start');
check(findCue(starts, ends, 5000) === -1 && findCue([], [], 5) === -1, 'findCue: past the end / empty list → -1');
// grace never crosses the next start
check(findCue([0, 0.5], [0.4, 1], 0.45) === 0 && findCue([0, 0.5], [0.4, 1], 0.5) === 1, 'findCue: grace stops at the next start');
// random consistency against a linear scan
let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const rs = []; let t0 = 0; for (let i = 0; i < 500; i += 1) { const s = t0 + rnd() * 2; const e = s + 0.5 + rnd() * 5; rs.push([s, e]); t0 = e; }
const rStarts = rs.map((x) => x[0]), rEnds = rs.map((x) => x[1]);
const linear = (t) => { let f = -1; for (let i = 0; i < rs.length; i += 1) if (rStarts[i] <= t) f = i; if (f < 0) return -1; if (t <= rEnds[f]) return f; const next = f + 1 < rs.length ? rStarts[f + 1] : Infinity; return t < Math.min(rEnds[f] + GRACE, next) ? f : -1; };
let agree = true; for (let i = 0; i < 3000; i += 1) { const t = rnd() * (t0 + 10) - 2; if (findCue(rStarts, rEnds, t) !== linear(t)) { agree = false; break; } }
check(agree, 'findCue: binary search agrees with a linear scan on 3,000 random times');

// 4. word timing
const cue = { start: 10, end: 14, text: 'We are the Open Source Orchestra.' };
const times = wordTimes(cue);
check(times.length === 6 && near(times[0][0], 10) && near(times[5][1], 14), 'wordTimes: one window per token, spanning the cue');
check(times.every((w, i) => i === 0 || near(w[0], times[i - 1][1])), 'wordTimes: interpolated windows are contiguous');
check(times[4][1] - times[4][0] > times[1][1] - times[1][0], 'wordTimes: longer words take longer (Source > are)');
check(wordIndex(times, 9.9) === -1 && wordIndex(times, 10) === 0 && wordIndex(times, 13.99) === 5, 'wordIndex: before/first/last');
check(near(wordFraction(times, 0, times[0][0]), 0) && near(wordFraction(times, 0, times[0][1]), 1), 'wordFraction: 0 at word start, 1 at word end');
const real = { start: 10, end: 14, text: 'We are the Open Source Orchestra.', words: [[10, 10.2], [10.2, 10.4], [10.5, 10.6], [11, 11.4], [11.5, 12], [12.2, 13.9]] };
check(wordTimes(real) === real.words, 'wordTimes: real whisper timings win when the count matches');
check(wordTimes({ ...real, words: real.words.slice(1) }) !== real.words, 'wordTimes: a mismatched sidecar falls back to interpolation');
check(wordTimes({ start: 1, end: 2, text: '' }).length === 0, 'wordTimes: empty text → no windows');
check(tokens('  a  b\tc\n').length === 3, 'tokens: whitespace split');

// 5. drift
check(drift({ start: 10, end: 14 }, 12) === 0 && near(drift({ start: 10, end: 14 }, 14.3), 0.3) && near(drift({ start: 10, end: 14 }, 9.5), 0.5) && drift(null, 5) === 0, 'drift: 0 inside, distance outside, 0 for silence');

// 6. sidecar attach
const list = [{ start: 0.59, end: 2, text: 'one two three' }, { start: 5, end: 6, text: 'four five' }];
const n = attachWords(list, { cues: { 0: { s: 0.59, t: [[0.6, 1], [1, 1.5], [1.5, 2]] }, 1: { s: 9.99, t: [[5, 5.5], [5.5, 6]] } } });
check(n === 1 && list[0].words && !list[1].words, 'attachWords: start check rejects a misaligned entry, accepts the matching one');
check(attachWords(list, { cues: { 1: [[5, 5.5], [5.5, 6]] } }) === 1 && list[1].words, 'attachWords: bare arrays keyed by index attach too');

// 7. committed word sidecars (if any) are internally consistent with their transcripts
import { readdirSync } from 'node:fs';
for (const dir of readdirSync(resolve(root, 'meetings')).filter((d) => /^\d+$/.test(d))) {
  const side = resolve(root, `meetings/${dir}/transcript/words.json`);
  if (!existsSync(side)) continue;
  const sidecar = JSON.parse(readFileSync(side, 'utf8'));
  const data = JSON.parse(readFileSync(resolve(root, `meetings/${dir}/transcript/transcript.json`), 'utf8'));
  const flat = data.cues || data.turns.flatMap((turn) => turn.segments);
  const copy = flat.map((c) => ({ start: Number(c.start), end: Number(c.end), text: c.text }));
  const attached = attachWords(copy, sidecar);
  check(attached >= Math.floor(copy.length * 0.9), `meetings/${dir}/transcript/words.json: ≥ 90 % of cues carry word timing (${attached}/${copy.length})`);
  const monotonic = copy.every((c) => !c.words || c.words.every((w, i) => w[1] >= w[0] - 1e-6 && (i === 0 || w[0] >= c.words[i - 1][0] - 1e-6)));
  check(monotonic, `meetings/${dir}/transcript/words.json: word windows are monotonic inside every cue`);
  const inside = copy.every((c) => !c.words || (c.words[0][0] >= c.start - 1.5 && c.words[c.words.length - 1][1] <= c.end + 1.5));
  check(inside, `meetings/${dir}/transcript/words.json: word windows stay within 1.5 s of the cue window`);
  check(/clock only|timing only/i.test(sidecar.source || '') && sidecar.schema === 'oso-pit-theater-word-timing-v1', `meetings/${dir}/transcript/words.json: schema + honest source line`);
}

if (failures.length) { console.error(`FAIL ${failures.length} of ${checks} karaoke checks:`); failures.forEach((f) => console.error(`  - ${f}`)); process.exitCode = 1; }
else console.log(`PASS ${checks}/${checks} karaoke engine checks (VTT parse · cue search · word timing · drift · sidecars).`);
