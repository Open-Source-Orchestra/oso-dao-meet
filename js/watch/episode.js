/* The Pit Theater (Open Source Orchestra) v3 · episode page · GPL-3.0 · built by the ʻohana (machines, labelled as machines).
   Karaoke transcript: the lit line follows playback; click a timestamp to seek; search within the page. */
import { $, $$, clock, escapeHTML } from './common.js';
import { mountPlayer } from './player.js';

const player = mountPlayer($('[data-player]'));
const list = $('.lines');
const lines = list ? $$('li[data-start]', list) : [];
const starts = lines.map((li) => Number(li.dataset.start));
const ends = lines.map((li) => Number(li.dataset.end));
let current = -1;

if (list && player) {
  list.addEventListener('scroll', () => player.markScroll(), { passive: true });
  list.addEventListener('click', (event) => {
    const link = event.target.closest('a.t');
    if (!link) return;
    event.preventDefault();
    const t = Number(link.closest('li').dataset.start);
    player.seek(t, true);
    history.replaceState(null, '', `?t=${Math.floor(t)}`);
  });
  player.onTime((t) => {
    let lo = 0, hi = starts.length - 1, found = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (starts[mid] <= t) { found = mid; lo = mid + 1; } else hi = mid - 1; }
    if (found >= 0 && t > ends[found] + 0.6 && (found + 1 >= starts.length || t < starts[found + 1])) found = -1;
    if (found === current) return;
    if (current >= 0) lines[current].classList.remove('on');
    current = found;
    if (found < 0) return;
    const li = lines[found];
    li.classList.add('on');
    if (!player.userScrolledRecently() && !li.classList.contains('off')) {
      const top = li.offsetTop - list.clientHeight / 2 + li.clientHeight / 2;
      list.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  });
}

/* words → timestamps: quotes and chapter lists link to ?t=; keep them in-page when JS is on */
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-seek]');
  if (!link || !player) return;
  event.preventDefault();
  const t = Number(link.dataset.seek);
  player.seek(t, true);
  history.replaceState(null, '', `?t=${Math.floor(t)}`);
  $('.screen')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

/* in-page transcript search */
const box = $('#t-search');
const count = $('.t-tools .count');
if (box && list) {
  const texts = lines.map((li) => (li.textContent || '').toLowerCase());
  const originals = lines.map((li) => $('.txt', li)?.innerHTML || '');
  let timer = 0;
  const run = () => {
    const q = box.value.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    let hits = 0;
    lines.forEach((li, i) => {
      const txt = $('.txt', li);
      if (!terms.length) { li.classList.remove('off', 'hit'); if (txt && txt.innerHTML !== originals[i]) txt.innerHTML = originals[i]; return; }
      const ok = terms.every((term) => texts[i].includes(term));
      li.classList.toggle('off', !ok);
      li.classList.toggle('hit', ok);
      if (ok) {
        hits += 1;
        if (txt) {
          let html = originals[i];
          for (const term of terms) html = html.replace(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
          txt.innerHTML = html;
        }
      } else if (txt && txt.innerHTML !== originals[i]) txt.innerHTML = originals[i];
    });
    if (count) count.textContent = terms.length ? `${hits} of ${lines.length} lines match` : `${lines.length} lines · click a time to seek · the lit line follows playback`;
    if (terms.length) list.scrollTop = 0;
  };
  box.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 120); });
  box.addEventListener('search', run);
  if (count) count.textContent = `${lines.length} lines · click a time to seek · the lit line follows playback`;
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
