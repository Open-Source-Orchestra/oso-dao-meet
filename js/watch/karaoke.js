/* The Pit Theater (Open Source Orchestra) · karaoke engine · GPL-3.0 · built by the ʻohana (machines, labelled as machines).
   One clock: the <video>/<audio> element. A requestAnimationFrame loop runs only while the media plays (and the tab is
   visible); timeupdate / seeking / seeked / ratechange / play / pause keep it honest in between; a 1 Hz watchdog
   re-syncs if the lit line ever disagrees with the clock. Cues are searched with a binary search; words light up from
   real whisper word timings when a timing sidecar exists, otherwise by character-weighted interpolation inside the cue.
   The list follows the voice with a monotonic scroll only when the lit line leaves a safe band, and never fights a
   human: wheel / touch / scrollbar / keys pause the follow for four seconds and show an in-flow "↩ follow" chip with a ✕
   (BUTTON LAW: nothing floats over text). DOM work is a diff: only the lines whose state changed are touched. */

export const TOKEN = /\S+/g;
export const GRACE = 0.6;          // seconds a line stays lit after its end when no next line has started
export const HUMAN_PAUSE_MS = 4000; // follow pauses this long after a human scroll
export const DRIFT_LIMIT = 0.25;    // watchdog: re-sync when the lit line is further than this from the clock

export const tokens = (text) => String(text || '').match(TOKEN) || [];

/** Parse WebVTT into sorted cues {start, end, speaker, text}. Voice spans <v Name> become the speaker label. */
export function parseVTT(source) {
  const lines = String(source || '').replace(/\r/g, '').split('\n');
  const stamp = (raw) => {
    const m = String(raw || '').trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
    return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number((m[4] || '0').padEnd(3, '0')) / 1000 : NaN;
  };
  const cues = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('-->')) continue;
    const [a, b] = lines[i].split('-->');
    const start = stamp(a), end = stamp(b.trim().split(/\s+/)[0]);
    const buffer = [];
    for (i += 1; i < lines.length && lines[i].trim() !== ''; i += 1) buffer.push(lines[i]);
    let text = buffer.join(' ').trim(), speaker = '';
    const voice = text.match(/^<v(?:\.[^\s>]*)?\s+([^>]+)>/);
    if (voice) { speaker = voice[1].trim(); text = text.slice(voice[0].length); }
    text = text.replace(/<\/?[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) cues.push({ start, end, speaker, text });
  }
  return cues.sort((x, y) => x.start - y.start);
}

/** Index of the cue lit at time t: the last cue that has started, kept lit through `grace` seconds of silence
 *  (but never past the next cue's start). -1 when nothing should be lit. O(log n). */
export function findCue(starts, ends, t, grace = GRACE) {
  let lo = 0, hi = starts.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (found < 0) return -1;
  if (t <= ends[found]) return found;
  const nextStart = found + 1 < starts.length ? starts[found + 1] : Infinity;
  return t < Math.min(ends[found] + grace, nextStart) ? found : -1;
}

/** Per-token [start, end] for a cue: real timings when `cue.words` matches the token count, otherwise a
 *  character-weighted spread between cue.start and cue.end (longer words take longer; every word gets a beat). */
export function wordTimes(cue) {
  const words = tokens(cue.text);
  if (!words.length) return [];
  if (Array.isArray(cue.words) && cue.words.length === words.length && cue.words.every((w) => Array.isArray(w) && w.length === 2)) return cue.words;
  const duration = Math.max(0.3, Number(cue.end) - Number(cue.start));
  const weights = words.map((word) => word.replace(/[^\p{L}\p{N}]/gu, '').length + 1.4);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let acc = 0;
  return weights.map((weight) => { const s = cue.start + (duration * acc) / total; acc += weight; return [s, cue.start + (duration * acc) / total]; });
}

/** Index of the word being spoken at t (last word whose start <= t); -1 before the first word. */
export function wordIndex(times, t) {
  let lo = 0, hi = times.length - 1, found = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (times[mid][0] <= t) { found = mid; lo = mid + 1; } else hi = mid - 1; }
  return found;
}

/** 0..1 progress inside word i at time t. */
export function wordFraction(times, i, t) {
  if (i < 0 || i >= times.length) return 0;
  const [s, e] = times[i];
  return Math.max(0, Math.min(1, (t - s) / Math.max(0.08, e - s)));
}

/** Seconds between the clock and the lit window: 0 when inside [start, end]; distance otherwise. */
export function drift(cue, t) {
  if (!cue) return 0;
  if (t < cue.start) return cue.start - t;
  if (t > cue.end) return t - cue.end;
  return 0;
}

/** Attach a timing sidecar ({cues: {index: [[s,e],...]}}, keyed by cue index with a start check) to cues in place. */
export function attachWords(cues, sidecar) {
  let attached = 0;
  const table = sidecar?.cues || {};
  for (const [key, entry] of Object.entries(table)) {
    const index = Number(key);
    const cue = cues[index];
    const times = Array.isArray(entry) ? entry : entry?.t;
    const start = Array.isArray(entry) ? null : entry?.s;
    if (!cue || !Array.isArray(times) || times.length !== tokens(cue.text).length) continue;
    if (start !== null && start !== undefined && Math.abs(Number(start) - cue.start) > 0.05) continue;
    cue.words = times;
    attached += 1;
  }
  return attached;
}

/** Wrap the words of a text element in spans once (idempotent). Returns the spans. */
export function wrapWords(element) {
  if (!element) return [];
  if (element.dataset.wrapped === '1') return [...element.querySelectorAll('.w')];
  const text = element.textContent;
  const words = tokens(text);
  const fragment = document.createDocumentFragment();
  words.forEach((word, i) => {
    if (i) fragment.appendChild(document.createTextNode(' '));
    const span = document.createElement('span');
    span.className = 'w';
    span.textContent = word;
    fragment.appendChild(span);
  });
  element.textContent = '';
  element.appendChild(fragment);
  element.dataset.wrapped = '1';
  return [...element.querySelectorAll('.w')];
}

/**
 * Mount the engine.
 * @param {object} o
 * @param {() => HTMLMediaElement|null} o.media   live getter (the player may swap video ↔ audio)
 * @param {HTMLMediaElement[]} o.elements        every media element to listen to
 * @param {HTMLElement} o.list                   the scroll container holding the lines
 * @param {HTMLElement[]} o.items                one element per cue, in cue order
 * @param {Array<{start:number,end:number,text:string,words?:number[][]}>} o.cues
 * @param {string} [o.textSelector='.txt']        where the words live inside an item
 * @param {HTMLElement} [o.chip]                 in-flow "↩ follow" chip (has [data-follow] and [data-dismiss])
 * @param {HTMLElement} [o.debug]                in-flow debug output (filled when present)
 * @param {(t:number)=>void} [o.onSeek]          perform a seek (the engine syncs to the target immediately)
 */
export function createKaraoke(o) {
  const { list, items, cues } = o;
  const textSelector = o.textSelector || '.txt';
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const starts = cues.map((cue) => cue.start), ends = cues.map((cue) => cue.end);
  const state = { current: -1, pastMark: -1, word: -1, spans: null, times: null, raf: 0, humanUntil: 0, chipDismissed: false, pendingSeek: null, resyncs: 0, ticks: 0, lastDebug: 0, lastT: -1 };
  const media = () => o.media?.() || o.elements?.[0] || null;

  /* ── lines ── */
  function setPast(upTo) {
    if (upTo > state.pastMark) for (let i = state.pastMark + 1; i <= upTo; i += 1) items[i]?.classList.add('past');
    else if (upTo < state.pastMark) for (let i = upTo + 1; i <= state.pastMark; i += 1) items[i]?.classList.remove('past');
    state.pastMark = upTo;
  }
  function light(index, t) {
    if (index === state.current) return;
    if (state.current >= 0) {
      const old = items[state.current];
      old?.classList.remove('on');
      old?.removeAttribute('aria-current');
      state.spans?.forEach((span) => { span.classList.remove('lit', 'now'); span.style.removeProperty('--wp'); });
      old?.style.removeProperty('--p');
    }
    state.current = index; state.word = -1; state.spans = null; state.times = null;
    setPast(index >= 0 ? index - 1 : (t !== undefined ? findPastMark(t) : state.pastMark));
    if (index < 0) return;
    const li = items[index];
    li.classList.add('on');
    li.classList.remove('past');
    li.setAttribute('aria-current', 'true');
    state.spans = wrapWords(li.querySelector(textSelector));
    state.times = wordTimes(cues[index]);
    follow(li);
  }
  function findPastMark(t) { // during silence: everything that already ended is past
    let lo = 0, hi = ends.length - 1, found = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (ends[mid] <= t) { found = mid; lo = mid + 1; } else hi = mid - 1; }
    return found;
  }
  function paint(t) {
    if (state.current < 0 || !state.times?.length) return;
    const cue = cues[state.current];
    const wi = wordIndex(state.times, t);
    if (wi !== state.word) {
      const spans = state.spans;
      if (wi > state.word) for (let i = Math.max(0, state.word); i <= wi; i += 1) spans[i]?.classList.add('lit');
      else for (let i = wi + 1; i <= state.word; i += 1) spans[i]?.classList.remove('lit');
      spans[state.word]?.classList.remove('now');
      if (wi >= 0) spans[wi]?.classList.add('now');
      state.word = wi;
    }
    const total = Math.max(0.3, cue.end - cue.start);
    items[state.current].style.setProperty('--p', Math.max(0, Math.min(1, (t - cue.start) / total)).toFixed(3));
    if (wi >= 0) state.spans[wi].style.setProperty('--wp', wordFraction(state.times, wi, t).toFixed(2));
  }
  function sync(t) {
    const index = findCue(starts, ends, t);
    light(index, t);
    paint(t);
    state.lastT = t;
    if (o.debug && performance.now() - state.lastDebug > 100) { state.lastDebug = performance.now(); renderDebug(t); }
  }

  /* ── follow ── */
  function follow(li, force = false) {
    if (!li || !list) return;
    if (!force && performance.now() < state.humanUntil) { showChip(true); return; }
    const lr = list.getBoundingClientRect(), r = li.getBoundingClientRect();
    if (!lr.height) return;
    const top = r.top - lr.top, bottom = r.bottom - lr.top;
    const bandTop = lr.height * 0.18, bandBottom = lr.height * 0.66;
    if (!force && top >= bandTop && bottom <= bandBottom) return;
    const target = Math.max(0, list.scrollTop + top - lr.height * 0.34);
    const far = Math.abs(target - list.scrollTop) > lr.height * 3;
    list.scrollTo({ top: target, behavior: reduced() || far ? 'instant' : 'smooth' });
    showChip(false);
  }
  function human() {
    state.humanUntil = performance.now() + HUMAN_PAUSE_MS;
    showChip(true);
    clearTimeout(state.resume);
    state.resume = setTimeout(() => { if (state.current >= 0) follow(items[state.current]); }, HUMAN_PAUSE_MS + 50);
  }
  function showChip(on) {
    if (!o.chip) return;
    const show = on && !state.chipDismissed;
    if (o.chip.hidden === !show) return;
    o.chip.hidden = !show;
  }
  if (list) {
    list.addEventListener('wheel', human, { passive: true });
    list.addEventListener('touchmove', human, { passive: true });
    list.addEventListener('pointerdown', (event) => { if (event.offsetX > list.clientWidth || event.offsetY > list.clientHeight) human(); }); // scrollbar grab
    list.addEventListener('keydown', (event) => {
      if (['PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) human();
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      const focusables = [...list.querySelectorAll('a.t, button[data-seek]')];
      const at = focusables.indexOf(document.activeElement);
      if (at < 0) return;
      event.preventDefault();
      human();
      focusables[Math.max(0, Math.min(focusables.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus({ preventScroll: false });
    });
  }
  o.chip?.querySelector('[data-follow]')?.addEventListener('click', () => { state.humanUntil = 0; state.chipDismissed = false; if (state.current >= 0) follow(items[state.current], true); else showChip(false); });
  o.chip?.querySelector('[data-dismiss]')?.addEventListener('click', () => { state.chipDismissed = true; showChip(false); });

  /* ── clock ── */
  function loop() {
    state.raf = 0;
    const el = media();
    if (!el || el.paused || el.ended || document.hidden) return;
    state.ticks += 1;
    sync(el.currentTime);
    state.raf = requestAnimationFrame(loop);
  }
  function kick() { if (!state.raf) state.raf = requestAnimationFrame(loop); }
  for (const el of o.elements || []) {
    el.addEventListener('play', () => { if (el === media()) kick(); });
    el.addEventListener('playing', () => { if (el === media()) kick(); });
    el.addEventListener('pause', () => { if (el === media()) sync(el.currentTime); });
    el.addEventListener('ratechange', () => { if (el === media()) sync(el.currentTime); });
    el.addEventListener('seeking', () => { if (el === media()) sync(state.pendingSeek ?? el.currentTime); });
    el.addEventListener('seeked', () => { if (el !== media()) return; state.pendingSeek = null; sync(el.currentTime); if (state.current >= 0) follow(items[state.current], true); kick(); });
    el.addEventListener('timeupdate', () => { if (el !== media()) return; if (state.pendingSeek !== null) return; sync(el.currentTime); kick(); });
    el.addEventListener('ended', () => { if (el === media()) sync(el.currentTime); });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  // watchdog: once a second, the lit line must agree with the clock (catches missed events, tampered DOM, drift)
  const watchdog = setInterval(() => {
    const el = media();
    if (!el || state.pendingSeek !== null) return;
    const t = el.currentTime;
    const expected = findCue(starts, ends, t);
    const litOk = state.current < 0 || items[state.current]?.classList.contains('on');
    if (expected !== state.current || !litOk || (expected >= 0 && drift(cues[expected], t) > DRIFT_LIMIT)) {
      state.resyncs += 1;
      if (state.current >= 0 && !litOk) state.current = -1;
      sync(t);
    }
  }, 1000);

  function renderDebug(t) {
    const cue = state.current >= 0 ? cues[state.current] : null;
    o.debug.textContent = `t=${t.toFixed(3)}s · cue ${state.current}/${cues.length} ${cue ? `[${cue.start.toFixed(2)}–${cue.end.toFixed(2)}]` : '[silence]'} · drift ${Math.round(drift(cue, t) * 1000)} ms · word ${state.word}${cue?.words ? ' (real)' : ' (interp)'} · resyncs ${state.resyncs} · ticks ${state.ticks} · rate ${media()?.playbackRate || 1}× · follow ${performance.now() < state.humanUntil ? 'paused' : 'on'}`;
  }

  /* ── API ── */
  function seekTo(t) {
    state.pendingSeek = t;
    sync(t);
    if (state.current >= 0) follow(items[state.current], true);
    o.onSeek?.(t);
    setTimeout(() => { if (state.pendingSeek === t) { state.pendingSeek = null; const el = media(); if (el) sync(el.currentTime); } }, 1500);
  }
  function loadWords(url) {
    if (!url || state.wordsPromise) return state.wordsPromise || Promise.resolve(0);
    state.wordsPromise = fetch(url).then((r) => (r.ok ? r.json() : null)).then((sidecar) => {
      const n = sidecar ? attachWords(cues, sidecar) : 0;
      if (n && state.current >= 0) { state.times = wordTimes(cues[state.current]); state.word = -1; state.spans?.forEach((span) => span.classList.remove('lit', 'now')); const el = media(); if (el) paint(el.currentTime); }
      return n;
    }).catch(() => 0);
    return state.wordsPromise;
  }
  const initial = media();
  if (initial) sync(initial.currentTime || 0);
  return {
    sync, seekTo, loadWords, kick,
    follow: () => { state.humanUntil = 0; if (state.current >= 0) follow(items[state.current], true); },
    destroy() { clearInterval(watchdog); if (state.raf) cancelAnimationFrame(state.raf); },
    get current() { return state.current; }, get resyncs() { return state.resyncs; }, get state() { return state; }, cues
  };
}
