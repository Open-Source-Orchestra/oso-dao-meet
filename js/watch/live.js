/* The Pit Theater (Open Source Orchestra) v3 · the circle clock · GPL-3.0 · built by the ʻohana (machines, labelled as machines).
   The only join path is the public join page; no meeting link is ever printed here. */
import { $, $$ } from './common.js';

const clock = $('#clock');
const next = clock?.dataset.next ? new Date(clock.dataset.next) : null;
const big = $('.big', clock);
const small = $('#clock-local');
const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

function tick() {
  if (!next || Number.isNaN(next.getTime())) return;
  const diff = next.getTime() - Date.now();
  if (diff <= 0) { big.textContent = 'now'; if (small) small.textContent = `The circle is open — the join page is the door. (${fmt.format(next)} in your clock.)`; return; }
  const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
  big.innerHTML = `${d ? `<span>${d}</span>d ` : ''}<span>${String(h).padStart(2, '0')}</span>h <span>${String(m).padStart(2, '0')}</span>m <span>${String(s).padStart(2, '0')}</span>s`;
  if (small) small.textContent = `${fmt.format(next)} in your clock.`;
}
if (next) { tick(); setInterval(tick, 1000); }

/* past circles in the visitor's own clock */
$$('.past time[datetime]').forEach((t) => { const d = new Date(t.getAttribute('datetime')); if (!Number.isNaN(d.getTime())) t.title = fmt.format(d); const local = t.nextElementSibling; if (local?.classList.contains('local')) local.textContent = `· ${fmt.format(d)} your time`; });
