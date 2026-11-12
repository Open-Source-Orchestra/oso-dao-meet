import { createNarration } from './narration.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const PLAY_INTERVAL = 14000;

const VENUES = {
  mumbai: {
    name: 'Mumbai · Memory', entry: 'MUMBAI · MEMORY',
    long: 'Jio World Centre Mumbai memory',
    detail: 'A contemporary fan-vaulted reverie. Not an affiliated venue or exact digital twin.',
    entryNote: 'Jio World Centre memory — an artistic interpretation, never an exact digital twin or venue affiliation.'
  },
  prague: {
    name: 'Prague · Art Nouveau', entry: 'PRAGUE · ART NOUVEAU',
    long: 'Smetana Hall / Municipal House Prague-inspired',
    detail: 'Ivory warmth, floral gold, and graceful arches. A Prague-inspired fantasy, not a scale model.',
    entryNote: 'Smetana Hall / Municipal House Prague-inspired — an artistic fantasy without affiliation or scale-model claims.'
  },
  cannes: {
    name: 'Cannes · Premiere Night', entry: 'CANNES · PREMIERE NIGHT',
    long: 'Palais des Festivals Cannes-inspired',
    detail: 'Geometric bronze and red-carpet night. An interpretation only, with no festival affiliation.',
    entryNote: 'Palais des Festivals Cannes-inspired — an artistic interpretation only, with no festival affiliation.'
  }
};

const ui = {
  body: document.body,
  hallShell: $('#hall-shell'),
  entry: $('#entry-screen'),
  enter: $('#enter-button'),
  enterLabel: $('#enter-label'),
  entryLoad: $('#entry-load-state'),
  transcript: $('#transcript-dialog'),
  transcriptContent: $('#transcript-content'),
  rail: $('#slide-rail-list'),
  dockPosition: $('#dock-position'),
  dockTitle: $('#dock-title'),
  dockStatus: $('#dock-status'),
  dockLinks: $('#dock-links'),
  prev: $('#prev-button'),
  next: $('#next-button'),
  play: $('#play-button'),
  announcer: $('#slide-announcer'),
  toast: $('#toast'),
  photoToast: $('#photo-toast'),
  gallery: $('#gallery-dialog'),
  galleryGrid: $('#gallery-grid'),
  venue: $('#venue-dialog'),
  help: $('#help-dialog')
};

const state = {
  slides: [], media: [], index: 0, hallId: 'mumbai', hall: null,
  ready: false, entered: false, readingOnly: false,
  playing: false, playTimer: null, toastTimer: null, photoTimer: null
};
let narration = null;

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function safeExternalUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`Only HTTPS deck links are allowed: ${value}`);
  return url.href;
}

function deckLinks(slide, includeMore = false) {
  const links = includeMore ? [...(slide.links || []), ...(slide.moreLinks || [])] : (slide.links || []);
  return links.map((link) => ({ label: link.label, url: safeExternalUrl(link.url) }));
}

function showToast(message, duration = 3800) {
  clearTimeout(state.toastTimer);
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  state.toastTimer = setTimeout(() => { ui.toast.hidden = true; }, duration);
}

function showPhoto(item) {
  clearTimeout(state.photoTimer);
  $('#photo-toast-title').textContent = item.kind === 'portrait' ? item.name : `${item.year} · ${item.event}`;
  $('#photo-toast-credit').textContent = item.kind === 'portrait' ? `${item.alt} ${item.credit}.` : item.alt;
  ui.photoToast.hidden = false;
  state.photoTimer = setTimeout(() => { ui.photoToast.hidden = true; }, 6200);
}

function updateUrl() {
  if (!state.slides.length) return;
  const url = new URL(window.location.href);
  url.searchParams.set('slide', state.slides[state.index].id);
  url.searchParams.set('hall', state.hallId);
  if (narration?.isOpen()) url.searchParams.set('listen', '1');
  else url.searchParams.delete('listen');
  history.replaceState({ slide: state.slides[state.index].id, hall: state.hallId }, '', url);
}

function setSlide(index, { updateHistory = true, announce = true, fromPlayback = false, fromNarration = false } = {}) {
  if (!state.slides.length) return;
  const nextIndex = (index + state.slides.length) % state.slides.length;
  state.index = nextIndex;
  const slide = state.slides[nextIndex];
  ui.body.dataset.slide = slide.id;
  ui.body.dataset.theme = slide.theme || 'night';
  ui.dockPosition.textContent = `MOVEMENT ${String(nextIndex + 1).padStart(2, '0')} / ${String(state.slides.length).padStart(2, '0')} · ${slide.chord || 'OPEN'}`;
  ui.dockTitle.textContent = slide.title;
  ui.dockStatus.textContent = slide.status;
  ui.dockLinks.innerHTML = deckLinks(slide).map((link) => `<a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)}</a>`).join('');
  ui.prev.setAttribute('aria-label', `Previous slide: ${state.slides[(nextIndex - 1 + state.slides.length) % state.slides.length].title}`);
  ui.next.setAttribute('aria-label', `Next slide: ${state.slides[(nextIndex + 1) % state.slides.length].title}`);
  ui.next.querySelector('span').textContent = nextIndex === state.slides.length - 1 ? 'Return to overture' : 'Next movement';
  const label = `Movement ${nextIndex + 1} of ${state.slides.length}: ${slide.title}`;
  ui.rail.querySelectorAll('button').forEach((button, buttonIndex) => {
    if (buttonIndex === nextIndex) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.tabIndex = buttonIndex === nextIndex ? 0 : -1;
  });
  $$('[data-slide-article]').forEach((article) => article.classList.toggle('is-current', article.dataset.slideArticle === slide.id));
  document.title = `${slide.title} · Open Source Orchestra DAO Meet`;
  state.hall?.setSlide(slide, nextIndex);
  narration?.syncSlide(nextIndex, { fromNarration });
  if (updateHistory) updateUrl();
  if (announce && !fromPlayback) ui.announcer.textContent = `${label}. ${slide.lede}`;
  if (state.playing && !fromPlayback) restartPlaybackTimer();
}

function setVenue(hallId, { updateHistory = true, announce = true } = {}) {
  if (!VENUES[hallId]) return;
  state.hallId = hallId;
  const venue = VENUES[hallId];
  ui.body.dataset.hall = hallId;
  $('#venue-current').textContent = venue.name;
  $('#scene-title').textContent = venue.name;
  $('#scene-detail').textContent = venue.detail;
  $('#entry-hall-name').textContent = venue.entry;
  $('#entry-hall-note').textContent = venue.entryNote;
  $$('[data-hall-choice]').forEach((button) => button.setAttribute('aria-checked', String(button.dataset.hallChoice === hallId)));
  state.hall?.setVenue(hallId);
  if (updateHistory) updateUrl();
  if (announce) showToast(`${venue.long}. Artistic interpretation only; no venue affiliation or exact digital twin.`, 4800);
}

function renderRail() {
  ui.rail.innerHTML = state.slides.map((slide, index) => `<li><button type="button" data-slide="${escapeHTML(slide.id)}" data-chord="${escapeHTML(slide.chord || '')}" aria-label="Movement ${index + 1} of ${state.slides.length}, chord ${escapeHTML(slide.chord || 'open')}: ${escapeHTML(slide.title)}" title="${escapeHTML(slide.chord || '')} · ${escapeHTML(slide.title)}" tabindex="${index === state.index ? 0 : -1}"><span>${String(index + 1).padStart(2, '0')}</span><span class="rail-title">${escapeHTML(slide.title)}</span></button></li>`).join('');
}

function renderTranscript() {
  ui.transcriptContent.innerHTML = state.slides.map((slide, index) => {
    const links = deckLinks(slide, true).map((link) => `<a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)} ↗</a>`).join('');
    const image = slide.image ? `<figure><img src="${escapeHTML(slide.image)}" alt="${escapeHTML(slide.imageAlt || '')}" loading="lazy"><figcaption>${escapeHTML(slide.imageCaption || 'Public Garden Circle history')}</figcaption></figure>` : '';
    const listTag = slide.id === 'dao-phases' ? 'ol' : 'ul';
    const bullets = slide.bullets.map((bullet) => `<li>${escapeHTML(bullet.replace(/^\d{2} · /, ''))}</li>`).join('');
    return `<article id="transcript-${escapeHTML(slide.id)}" data-slide-article="${escapeHTML(slide.id)}"><div class="transcript-movement">MOVEMENT ${String(index + 1).padStart(2, '0')} / ${String(state.slides.length).padStart(2, '0')} · ${escapeHTML(slide.chord || '')} · ${escapeHTML(slide.status)}</div><h3>${escapeHTML(slide.title)}</h3><p class="transcript-kicker">${escapeHTML(slide.kicker)}</p><p class="transcript-lede">${escapeHTML(slide.lede)}</p>${image}<${listTag}>${bullets}</${listTag}><p class="transcript-links">${links}</p></article>`;
  }).join('');
}

function renderGallery() {
  ui.galleryGrid.innerHTML = state.media.map((item, index) => {
    const title = item.kind === 'portrait' ? item.name : item.event;
    const context = item.kind === 'portrait' ? 'PUBLIC ARTIST PORTRAIT · GARDEN CIRCLE' : `${item.year} · PUBLIC HISTORY`;
    const loading = index < 6 ? 'eager' : 'lazy';
    return `<figure><img src="${escapeHTML(item.src)}" alt="${escapeHTML(item.alt)}" loading="${loading}" decoding="async"><figcaption><strong>${escapeHTML(title)}</strong><span>${escapeHTML(context)}</span><small>${escapeHTML(item.credit)} · appearance ≠ DAO membership</small></figcaption></figure>`;
  }).join('');
}

function openDialog(dialog, { scrollCurrent = false } = {}) {
  if (!dialog || dialog.open) return;
  stopPlayback();
  narration?.pause();
  $$('dialog[open]').forEach((open) => {
    if (open !== dialog && open !== ui.transcript) open.close();
  });
  dialog.showModal();
  if (scrollCurrent) {
    const article = $(`[data-slide-article="${state.slides[state.index]?.id}"]`);
    if (article) requestAnimationFrame(() => article.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
}

function closeDialogs() {
  $$('dialog[open]').forEach((dialog) => dialog.close());
}

function updatePlayButton() {
  ui.play.setAttribute('aria-pressed', String(state.playing));
  ui.play.setAttribute('aria-label', state.playing ? 'Pause slideshow' : 'Play slideshow');
  ui.play.textContent = state.playing ? '❚❚' : '▶';
  ui.play.title = state.playing ? 'Pause slideshow · P' : 'Play slideshow · P';
}

function restartPlaybackTimer() {
  clearInterval(state.playTimer);
  if (state.playing) state.playTimer = setInterval(() => setSlide(state.index + 1, { fromPlayback: true }), PLAY_INTERVAL);
}

function startPlayback() {
  if (state.playing || !state.ready || state.readingOnly) return;
  narration?.pause();
  state.playing = true;
  updatePlayButton();
  restartPlaybackTimer();
  showToast(`Slideshow playing gently: one movement every ${PLAY_INTERVAL / 1000} seconds. No audio or flashing effects.`);
}

function stopPlayback() {
  if (!state.playing && !state.playTimer) return;
  state.playing = false;
  clearInterval(state.playTimer);
  state.playTimer = null;
  updatePlayButton();
}

function togglePlayback() {
  state.playing ? stopPlayback() : startPlayback();
}

function enterExperience() {
  if (state.entered) return;
  state.entered = true;
  ui.body.classList.add('is-entered');
  ui.hallShell.inert = false;
  ui.entry.classList.add('is-leaving');
  setTimeout(() => { ui.entry.hidden = true; }, motionQuery.matches ? 0 : 620);
  if (state.hall) {
    state.hall.resize();
    state.hall.canvas.focus({ preventScroll: true });
  } else ui.transcriptContent.focus({ preventScroll: true });
}

function chooseReadableEdition(reason = 'Readable edition selected. The complete twelve-movement deck, public links, and image credits remain available below.') {
  state.readingOnly = true;
  stopPlayback();
  narration?.close({ updateHistory: false });
  ui.body.classList.add('no-webgl');
  $('#fallback-reason').hidden = false;
  $('#fallback-reason').textContent = reason;
  ui.transcript.setAttribute('open', '');
  ui.enter.disabled = false;
  ui.enterLabel.textContent = 'Read the accessible deck';
  ui.entryLoad.textContent = 'The full document is ready. No 3D capability is required.';
  if (!state.entered) enterExperience();
}

async function loadSlideImages() {
  const images = new Map();
  await Promise.all(state.slides.filter((slide) => slide.image).map(async (slide) => {
    try {
      const image = new Image();
      image.src = slide.image;
      await image.decode();
      images.set(slide.id, image);
    } catch (error) {
      // The text slide remains intentionally complete if an optional image cannot decode.
      console.warn(`Optional slide image unavailable: ${slide.image}`, error.message);
    }
  }));
  return images;
}

function readDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const slideIndex = state.slides.findIndex((slide) => slide.id === params.get('slide'));
  state.index = slideIndex >= 0 ? slideIndex : 0;
  state.hallId = VENUES[params.get('hall')] ? params.get('hall') : 'mumbai';
}

async function boot() {
  try {
    const [deckResponse, mediaResponse] = await Promise.all([
      fetch('./data/deck.json'), fetch('./data/media.json')
    ]);
    if (!deckResponse.ok || !mediaResponse.ok) throw new Error('Local deck or media registry could not be loaded.');
    const [deck, media] = await Promise.all([deckResponse.json(), mediaResponse.json()]);
    if (!Array.isArray(deck.slides) || deck.slides.length < 10 || deck.slides.length > 12) throw new Error('The deck must contain 10–12 slides.');
    if (!Array.isArray(media.items) || !media.items.length) throw new Error('The local media registry is empty.');
    const ids = new Set();
    deck.slides.forEach((slide) => {
      if (!slide.id || ids.has(slide.id)) throw new Error('Slide IDs must be present and unique.');
      ids.add(slide.id);
      deckLinks(slide, true);
    });
    state.slides = deck.slides;
    state.media = media.items;
    readDeepLink();
    renderRail();
    renderTranscript();
    renderGallery();
    setVenue(state.hallId, { updateHistory: false, announce: false });
    setSlide(state.index, { updateHistory: false, announce: false });
    narration = createNarration({
      getSlides: () => state.slides,
      getIndex: () => state.index,
      setSlide: (index) => setSlide(index, { fromNarration: true }),
      pauseSlideshow: stopPlayback,
      onEnter: enterExperience
    });
    const openNarrationFromDeepLink = new URLSearchParams(window.location.search).get('listen') === '1';
    updateUrl();
    if (openNarrationFromDeepLink) narration.open();
    if (state.readingOnly) return;

    const slideImages = await loadSlideImages();
    if (state.readingOnly) return;
    // Probe first so a device without WebGL2 receives the document without a renderer exception.
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2')) {
      chooseReadableEdition('WebGL2 is unavailable on this device. The complete accessible deck is shown instead; no content or public link is lost.');
      return;
    }
    const { OrchestraHall } = await import('./hall.js');
    if (state.readingOnly) return;
    state.hall = new OrchestraHall({
      container: ui.hallShell,
      vrHost: $('#vr-host'),
      slides: state.slides,
      media: state.media,
      slideImages,
      reducedMotion: () => motionQuery.matches,
      onNext: () => setSlide(state.index + 1),
      onPhoto: showPhoto,
      onToast: showToast
    });
    state.hall.setSlide(state.slides[state.index], state.index);
    state.hall.setVenue(state.hallId);
    state.ready = true;
    ui.enter.disabled = false;
    ui.enterLabel.textContent = 'Enter the hall';
    ui.entryLoad.innerHTML = `<span class="loading-note"></span> The hall is ready · ${state.slides.length} movements · optional narration · no trackers`;
  } catch (error) {
    console.warn('The 3D hall could not start; using the complete readable edition.', error.message);
    chooseReadableEdition('The interactive hall could not start in this browser. The complete accessible deck is shown instead; no editorial content is lost.');
  }
}

// Slide controls and real, slide-specific external actions.
ui.prev.addEventListener('click', () => setSlide(state.index - 1));
ui.next.addEventListener('click', () => setSlide(state.index + 1));
ui.play.addEventListener('click', togglePlayback);
ui.rail.addEventListener('click', (event) => {
  const button = event.target.closest('[data-slide]');
  if (!button) return;
  const index = state.slides.findIndex((slide) => slide.id === button.dataset.slide);
  if (index >= 0) setSlide(index);
});
ui.rail.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === 'Home') setSlide(0);
  else if (event.key === 'End') setSlide(state.slides.length - 1);
  else setSlide(state.index + (event.key === 'ArrowRight' ? 1 : -1));
  ui.rail.querySelector('[aria-current="step"]')?.focus();
});
ui.enter.addEventListener('click', enterExperience);
$('#entry-read').addEventListener('click', (event) => {
  event.preventDefault();
  chooseReadableEdition();
});
$('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  if (state.readingOnly) ui.transcriptContent.focus();
  else openDialog(ui.transcript, { scrollCurrent: true });
});

$('#venue-button').addEventListener('click', () => openDialog(ui.venue));
$$('[data-hall-choice]').forEach((button) => button.addEventListener('click', () => {
  setVenue(button.dataset.hallChoice);
  ui.venue.close();
  state.hall?.canvas.focus({ preventScroll: true });
}));
$('#help-button').addEventListener('click', () => openDialog(ui.help));
$('#about-button').addEventListener('click', () => openDialog(ui.help));
$('#gallery-button').addEventListener('click', () => openDialog(ui.gallery));
$('#photo-gallery-link').addEventListener('click', () => {
  ui.photoToast.hidden = true;
  openDialog(ui.gallery);
});
$('#transcript-button').addEventListener('click', () => openDialog(ui.transcript, { scrollCurrent: true }));
$('#print-button').addEventListener('click', () => window.print());
$('#share-button').addEventListener('click', async () => {
  const slide = state.slides[state.index];
  const share = {
    title: `${slide?.title || 'The First Circle'} · Open Source Orchestra DAO Meet`,
    text: `${slide?.lede || 'The First Circle'} · ${VENUES[state.hallId].long} · public lineage, not automatic DAO membership.`,
    url: window.location.href
  };
  if (navigator.share) {
    try { await navigator.share(share); } catch (error) { if (error.name !== 'AbortError') showToast('Sharing was unavailable. Copy the address bar to share this exact movement.'); }
    return;
  }
  try {
    await navigator.clipboard.writeText(share.url);
    showToast(`Copied this exact movement: ${slide?.title || 'The First Circle'} · ${VENUES[state.hallId].name}.`);
  } catch {
    showToast('Copy the address bar to share this exact movement and hall.');
  }
});
$$('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog')?.close()));
$$('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target === dialog && !state.readingOnly) dialog.close();
}));

$('#reset-camera').addEventListener('click', () => {
  state.hall?.resetCamera();
  showToast('Returned to the best seat.');
});
$('#focus-screen').addEventListener('click', () => {
  state.hall?.focusProjector();
  showToast('A closer view. Press R whenever you want the best seat back.');
});
function syncFullscreenState() {
  const active = Boolean(document.fullscreenElement);
  $('#fullscreen-button').setAttribute('aria-pressed', String(active));
  $('#fullscreen-button').setAttribute('aria-label', active ? 'Leave fullscreen' : 'Enter fullscreen');
  state.hall?.resize();
}
$('#fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else showToast('Fullscreen is not available in this browser. The hall still fills the available window.');
    // Some Chromium builds emit the event before the request promise settles.
    syncFullscreenState();
  } catch {
    showToast('Fullscreen was not granted by this browser. You can keep enjoying the hall here.');
  }
});
document.addEventListener('fullscreenchange', syncFullscreenState);

$$('[data-move]').forEach((button) => {
  const release = (event) => {
    state.hall?.setMove(button.dataset.move, false);
    if (event?.pointerId !== undefined && button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    state.hall?.setMove(button.dataset.move, true);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', () => state.hall?.setMove(button.dataset.move, false));
});

// Global keys never steal editing, media controls, or a dialog's own keyboard behavior.
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if ($('dialog[open]') && !state.readingOnly) return;
  if (!state.entered || state.readingOnly) return;
  const tag = document.activeElement?.tagName;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
  const key = event.key.toLowerCase();
  const isNativeControl = ['BUTTON', 'A'].includes(tag);
  if ((key === 'arrowright' || key === 'pagedown') && !isNativeControl) {
    event.preventDefault(); setSlide(state.index + 1);
  } else if ((key === 'arrowleft' || key === 'pageup') && !isNativeControl) {
    event.preventDefault(); setSlide(state.index - 1);
  } else if (key === ' ' && !isNativeControl) {
    event.preventDefault(); setSlide(state.index + 1);
  } else if (key === 'home' && !isNativeControl) {
    event.preventDefault(); setSlide(0);
  } else if (key === 'end' && !isNativeControl) {
    event.preventDefault(); setSlide(state.slides.length - 1);
  } else if (key === 'p') {
    event.preventDefault(); togglePlayback();
  } else if (key === 'f') {
    event.preventDefault(); $('#fullscreen-button').click();
  } else if (key === 'h' || key === '?') {
    event.preventDefault(); openDialog(ui.help);
  } else if (key === 'g') {
    event.preventDefault(); openDialog(ui.gallery);
  } else if (key === 't') {
    event.preventDefault(); openDialog(ui.transcript, { scrollCurrent: true });
  } else if (key === 'l') {
    event.preventDefault();
    if (narration?.isOpen()) narration.close();
    else narration?.open();
  } else if (key === 'r') {
    event.preventDefault(); state.hall?.resetCamera();
  } else if (key === 'escape') {
    closeDialogs();
  }
});

motionQuery.addEventListener('change', () => {
  if (motionQuery.matches) stopPlayback();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopPlayback(); narration?.pause(); }
});
window.addEventListener('popstate', () => {
  if (!state.slides.length) return;
  const wantsNarration = new URLSearchParams(window.location.search).get('listen') === '1';
  if (!wantsNarration && narration?.isOpen()) narration.close({ updateHistory: false });
  readDeepLink();
  setVenue(state.hallId, { updateHistory: false, announce: false });
  setSlide(state.index, { updateHistory: false });
  if (wantsNarration && !narration?.isOpen()) narration?.open();
});

boot();
