/* The Pit Theater (Open Source Orchestra) v3 · the TV (/watch/) · GPL-3.0 · built by the ʻohana (machines, labelled as machines).
   Continue watching lives in localStorage on this device only. Nothing is sent anywhere. */
import { $, $$, clock, escapeHTML, progressAll, store, KEYS } from './common.js';
import { mountPlayer } from './player.js';

mountPlayer($('[data-player]'));

const progress = progressAll();
const cards = $$('.guide .ep[data-ep]');
const byEp = Object.fromEntries(cards.map((card) => [card.dataset.ep, card]));

/* mark watched / in-progress on the guide */
for (const card of cards) {
  const p = progress[card.dataset.ep];
  if (!p) continue;
  const chip = document.createElement('li');
  if (p.done) { chip.className = 'chip-ok'; chip.textContent = 'watched'; card.classList.add('watched'); }
  else { chip.className = 'chip-wait'; chip.textContent = `${clock(p.t)} in`; }
  $('.chips', card)?.appendChild(chip);
}

/* continue watching: most recent unfinished episode first */
const resumeList = Object.entries(progress)
  .filter(([ep, p]) => byEp[ep] && !p.done && p.t > 20 && p.t < p.d - 45)
  .sort((a, b) => b[1].at - a[1].at)
  .slice(0, 3);
const slot = $('#continue');
if (slot && resumeList.length) {
  slot.hidden = false;
  slot.innerHTML = `<p class="kicker">Continue watching · remembered only on this device</p>` + resumeList.map(([ep, p]) => {
    const card = byEp[ep];
    const title = $('h3', card)?.textContent || ep;
    const poster = $('.poster img', card)?.getAttribute('src') || '';
    const pct = Math.min(100, Math.round((p.t / Math.max(1, p.d)) * 100));
    return `<a class="resume" href="./${escapeHTML(ep)}/?t=${Math.floor(p.t)}"><img src="${escapeHTML(poster)}" alt="" loading="lazy" width="96" height="54"><span><b>${escapeHTML(title)}</b><small>resume at ${escapeHTML(clock(p.t))} of ${escapeHTML(clock(p.d))}</small><span class="bar" aria-hidden="true"><i style="--p:${pct}%"></i></span></span></a>`;
  }).join('') + `<p class="keys"><button type="button" class="btn" data-forget>forget my progress</button></p>`;
  $('[data-forget]', slot)?.addEventListener('click', () => { store.del(KEYS.progress); slot.hidden = true; cards.forEach((c) => { c.classList.remove('watched'); $$('.chips .chip-ok, .chips .chip-wait', c).forEach((chip) => chip.remove()); }); });
}

/* autoplay-next and speed are remembered by the player; the TV just shows what's set */
const pref = $('#prefs');
if (pref) {
  const autonext = store.get(KEYS.autonext, false) === true;
  pref.textContent = `Your settings on this device: autoplay next ${autonext ? 'on' : 'off'} · speed ${store.get(KEYS.speed, 1)}× · captions ${store.get(KEYS.captions, true) === false ? 'off' : 'on'}. Change them in any player; nothing leaves this browser.`;
}
