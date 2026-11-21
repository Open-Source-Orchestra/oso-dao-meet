/* The Pit Theater (Open Source Orchestra) v3 · the photo reel · GPL-3.0 · built by the ʻohana (machines, labelled as machines).
   A Ken Burns reel of consented photographs. Nothing moves until a person presses Start; it pauses on hover and focus,
   stops with ✕ or Escape, ←/→ step, Space pauses; prefers-reduced-motion = cross-fades only, no drift. Every frame
   shows its credit and consent state. The static grid below is the no-JS edition and stays the record. */
import { $, $$, store } from './common.js';

const stage = $('.reel-stage');
const grid = $('.photo-grid');
const items = grid ? $$('figure[data-photo]', grid) : [];
if (stage && items.length) {
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seconds = Number(stage.dataset.seconds) || 6;
  const frameA = $('.frame.a', stage), frameB = $('.frame.b', stage);
  const caption = $('.reel-caption', stage);
  const counter = $('.reel-counter'); // in the controls row under the stage
  const startButton = $('[data-start]', stage);
  const bar = $('.reel-bar i', stage);
  const controls = $('.reel-controls'); // sits right under the stage, in the flow
  const state = { on: false, index: -1, timer: 0, front: frameA, paused: false, startedAt: 0, left: 0 };
  frameA.classList.add('show'); // the first frame is the static poster until a person starts the reel
  const photos = items.map((figure) => ({ src: figure.dataset.src || $('img', figure).currentSrc || $('img', figure).src, alt: $('img', figure).alt, caption: $('figcaption .cap', figure)?.textContent || '', credit: $('figcaption .credit', figure)?.textContent || '' }));

  function show(index, { immediate = false } = {}) {
    state.index = (index + photos.length) % photos.length;
    const photo = photos[state.index];
    const back = state.front === frameA ? frameB : frameA;
    const img = $('img', back);
    img.alt = photo.alt;
    img.src = photo.src;
    const pan = ['kb-a', 'kb-b', 'kb-c', 'kb-d'][state.index % 4];
    back.className = `frame ${back === frameA ? 'a' : 'b'} ${reduced() ? '' : pan}`;
    back.style.setProperty('--kb', `${seconds + 1.2}s`);
    const flip = () => { back.classList.add('show'); state.front.classList.remove('show'); state.front = back; };
    if (immediate || img.complete) flip(); else img.addEventListener('load', flip, { once: true });
    caption.innerHTML = `<b>${escape(photo.caption)}</b><small>${escape(photo.credit)} · public already · takedown first</small>`;
    counter.textContent = `${state.index + 1} / ${photos.length}`;
    items.forEach((figure, i) => figure.classList.toggle('on', i === state.index));
    arm(seconds * 1000);
    // preload the next one
    const next = new Image(); next.src = photos[(state.index + 1) % photos.length].src;
  }
  function arm(ms) {
    clearTimeout(state.timer);
    state.left = ms; state.startedAt = performance.now();
    if (bar) { bar.style.transition = 'none'; bar.style.width = '0%'; requestAnimationFrame(() => { bar.style.transition = reduced() ? 'none' : `width ${ms}ms linear`; bar.style.width = '100%'; }); }
    if (!state.paused) state.timer = setTimeout(() => show(state.index + 1), ms);
  }
  function pause(on) {
    if (!state.on || state.paused === on) return;
    state.paused = on;
    stage.classList.toggle('paused', on);
    if (on) { clearTimeout(state.timer); state.left = Math.max(400, state.left - (performance.now() - state.startedAt)); if (bar) { const w = getComputedStyle(bar).width; bar.style.transition = 'none'; bar.style.width = w; } }
    else arm(state.left);
    $('[data-pause]', stage)?.setAttribute('aria-pressed', String(on));
  }
  function start() {
    state.on = true; state.paused = false;
    stage.classList.add('on');
    startButton.hidden = true;
    controls.hidden = false;
    show(Math.max(0, state.index), { immediate: true });
    store.set('oso-pit-photos-started', true);
  }
  function stop() {
    state.on = false;
    clearTimeout(state.timer);
    stage.classList.remove('on', 'paused');
    controls.hidden = true;
    startButton.hidden = false;
    startButton.focus({ preventScroll: true });
  }
  startButton?.addEventListener('click', start);
  controls?.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-stop')) stop();
    else if (button.hasAttribute('data-pause')) pause(!state.paused);
    else if (button.hasAttribute('data-prev')) show(state.index - 1);
    else if (button.hasAttribute('data-next')) show(state.index + 1);
  });
  stage.addEventListener('pointerenter', () => pause(true));
  stage.addEventListener('pointerleave', () => pause(false));
  stage.addEventListener('focusin', () => pause(true));
  stage.addEventListener('focusout', (event) => { if (!stage.contains(event.relatedTarget)) pause(false); });
  document.addEventListener('keydown', (event) => {
    if (!state.on || event.altKey || event.ctrlKey || event.metaKey) return;
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (event.key === 'Escape') { event.preventDefault(); stop(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); show(state.index + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); show(state.index - 1); }
    else if (event.key === ' ' && tag !== 'BUTTON') { event.preventDefault(); pause(!state.paused); }
  });
  document.addEventListener('visibilitychange', () => pause(document.hidden || state.paused));
  // click a grid photo → the reel opens on it (user-started)
  grid.addEventListener('click', (event) => {
    const figure = event.target.closest('figure[data-photo]');
    if (!figure) return;
    event.preventDefault();
    state.index = items.indexOf(figure);
    if (!state.on) start(); else show(state.index, { immediate: true });
    stage.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  });
}
function escape(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
