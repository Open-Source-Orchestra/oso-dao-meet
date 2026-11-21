/* The Pit Theater (Open Source Orchestra) v3 · episode page · GPL-3.0 · built by the ʻohana (machines, labelled as machines).
   Karaoke transcript: one media clock (js/watch/karaoke.js), the lit line and the lit word follow playback, the list
   follows the voice without fighting a human, click a timestamp to seek, ↑/↓ walk the lines, search within the page. */
import { $, $$, clock, escapeHTML } from './common.js';
import { mountPlayer } from './player.js';
import { createKaraoke, tokens } from './karaoke.js';

const player = mountPlayer($('[data-player]'));
const list = $('.lines');
const lines = list ? $$('li[data-start]', list) : [];
const cues = lines.map((li) => ({ start: Number(li.dataset.start), end: Number(li.dataset.end), text: $('.txt', li)?.textContent || '' }));
const debugOn = new URLSearchParams(location.search).get('sync') === 'debug';
let karaoke = null;

if (list && player) {
  const debug = $('.t-debug');
  if (debug) debug.hidden = !debugOn;
  karaoke = createKaraoke({
    media: () => player.media,
    elements: [...new Set([$('[data-player] video'), $('[data-player] audio')].filter(Boolean))],
    list, items: lines, cues, textSelector: '.txt',
    chip: $('.t-follow'), debug: debugOn ? debug : null,
    onSeek: (t) => player.seek(t, true)
  });
  window.__karaoke = karaoke; // read-only handle for the drift gate (scripts/test-watch.mjs) and ?sync=debug
  // real word timing (whisper word_timestamps aligned to the public text) arrives on the first play or seek — never before a choice
  const words = list.dataset.words;
  if (words) {
    const once = () => karaoke.loadWords(words).then((n) => { if (n && debugOn && debug) debug.dataset.words = String(n); });
    for (const el of [player.media]) el?.addEventListener('play', once, { once: true });
    list.addEventListener('click', once, { once: true });
  }
  list.addEventListener('click', (event) => {
    const link = event.target.closest('a.t');
    if (!link) return;
    event.preventDefault();
    const t = Number(link.closest('li').dataset.start);
    karaoke.seekTo(t);
    history.replaceState(null, '', `?t=${Math.floor(t)}`);
  });
}

/* words → timestamps: quotes and chapter lists link to ?t=; keep them in-page when JS is on */
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-seek]');
  if (!link || !player) return;
  event.preventDefault();
  const t = Number(link.dataset.seek);
  if (karaoke) karaoke.seekTo(t); else player.seek(t, true);
  history.replaceState(null, '', `?t=${Math.floor(t)}`);
  $('.screen')?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});

/* in-page transcript search: filters lines, marks matching words (no innerHTML rewrites — the karaoke spans stay) */
const box = $('#t-search');
const count = $('.t-tools .count');
const idle = `${lines.length} lines · click a time to seek · the lit line and the lit word follow the voice`;
if (box && list) {
  const texts = lines.map((li) => (li.textContent || '').toLowerCase());
  let timer = 0;
  let markJob = 0;
  const run = () => {
    const q = box.value.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    let hits = 0;
    cancelAnimationFrame(markJob);
    // pass 1 (synchronous, cheap): filter the lines
    lines.forEach((li, i) => {
      const ok = !terms.length || terms.every((term) => texts[i].includes(term));
      li.classList.toggle('off', terms.length > 0 && !ok);
      li.classList.toggle('hit', terms.length > 0 && ok);
      if (ok && terms.length) hits += 1;
    });
    if (count) count.textContent = terms.length ? `${hits} of ${lines.length} lines match` : idle;
    if (terms.length) list.scrollTop = 0;
    // pass 2 (chunked, between frames): mark the matching words without rewriting the text (the karaoke spans stay)
    let i = 0;
    const step = () => {
      const stop = Math.min(lines.length, i + 80);
      for (; i < stop; i += 1) {
        const li = lines[i];
        const txt = $('.txt', li);
        if (!txt) continue;
        if (!terms.length || li.classList.contains('off')) { if (txt.dataset.wrapped) $$('.w.mark', txt).forEach((w) => w.classList.remove('mark')); continue; }
        if (!txt.dataset.wrapped) {
          const words = tokens(txt.textContent);
          txt.textContent = '';
          words.forEach((word, k) => { if (k) txt.appendChild(document.createTextNode(' ')); const span = document.createElement('span'); span.className = 'w'; span.textContent = word; txt.appendChild(span); });
          txt.dataset.wrapped = '1';
        }
        $$('.w', txt).forEach((w) => w.classList.toggle('mark', terms.some((term) => w.textContent.toLowerCase().includes(term))));
      }
      if (i < lines.length) markJob = requestAnimationFrame(step);
    };
    markJob = requestAnimationFrame(step);
  };
  box.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 120); });
  box.addEventListener('search', run);
  if (count) count.textContent = idle;
}

/* "copy transcript line" convenience: double-click a line copies "who · time · text" */
list?.addEventListener('dblclick', async (event) => {
  const li = event.target.closest('li[data-start]');
  if (!li) return;
  const text = `${$('.who', li)?.textContent || ''} · ${clock(li.dataset.start)} · ${$('.txt', li)?.textContent || ''}`.trim();
  try { await navigator.clipboard.writeText(text); $('.player-status').textContent = 'Line copied.'; } catch { /* ignore */ }
});

/* Episode link rail: mark the one you're on */
$$('.rail a').forEach((a) => { if (new URL(a.href).pathname === location.pathname) a.setAttribute('aria-current', 'page'); });
export { escapeHTML };
