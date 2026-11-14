/* Optional AI-agent-steward narration. No media request before an explicit play gesture.
 * Editorial speech only — never raw meeting audio or participant voices. */
export function createNarration(options) {
  const ui = {
    panel: document.querySelector('#narration-panel'),
    close: document.querySelector('#narration-close'),
    position: document.querySelector('#narration-position'),
    title: document.querySelector('#narration-title'),
    disclosure: document.querySelector('#narration-disclosure'),
    audio: document.querySelector('#narration-audio'),
    track: document.querySelector('#narration-track'),
    play: document.querySelector('#narration-play'),
    previous: document.querySelector('#narration-prev'),
    next: document.querySelector('#narration-next'),
    seek: document.querySelector('#narration-seek'),
    time: document.querySelector('#narration-time'),
    speed: document.querySelector('#narration-speed'),
    caption: document.querySelector('#narration-caption'),
    transcript: document.querySelector('#narration-transcript-link'),
    download: document.querySelector('#narration-download'),
    vtt: document.querySelector('#narration-vtt'),
    srt: document.querySelector('#narration-srt'),
    status: document.querySelector('#narration-status')
  };
  const openers = [document.querySelector('#narration-open'), document.querySelector('#entry-listen')].filter(Boolean);
  const state = {
    open: false, loaded: null, loading: null, index: -1, pendingContinue: false,
    seeking: false, lastError: '', activationRequested: false
  };

  const escapeText = (value) => String(value ?? '');
  function record() { return state.loaded?.slides?.[options.getIndex()]; }
  function timecode(seconds) {
    const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
    return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
  }
  function setOpenerState() {
    openers.forEach((opener) => opener.setAttribute('aria-expanded', String(state.open)));
  }
  function setStatus(message) {
    ui.status.textContent = message;
  }
  function updateUrl() {
    const url = new URL(window.location.href);
    if (state.open) url.searchParams.set('listen', '1');
    else url.searchParams.delete('listen');
    history.replaceState(history.state, '', url);
  }
  function updatePlay() {
    const playing = !ui.audio.paused && !ui.audio.ended;
    ui.play.textContent = playing ? 'Pause' : 'Play';
    ui.play.setAttribute('aria-label', playing ? 'Pause synthetic narration' : 'Play synthetic narration');
    ui.play.setAttribute('aria-pressed', String(playing));
  }
  function updateTime() {
    const item = record();
    const duration = Number.isFinite(ui.audio.duration) ? ui.audio.duration : item?.duration || 0;
    if (!state.seeking) ui.seek.value = String(Math.min(ui.audio.currentTime || 0, duration));
    ui.seek.max = String(duration || 0);
    ui.seek.disabled = !duration || Boolean(state.lastError);
    ui.seek.setAttribute('aria-valuetext', `${timecode(ui.audio.currentTime)} of ${timecode(duration)}; movement ${options.getIndex() + 1} of 12`);
    ui.time.textContent = `${timecode(ui.audio.currentTime)} / ${timecode(duration)}`;
  }
  function displaySlide() {
    const item = record();
    const slide = options.getSlides()[options.getIndex()];
    if (!item || !slide) return;
    ui.position.textContent = `MOVEMENT ${String(options.getIndex() + 1).padStart(2, '0')} / 12 · ${timecode(item.duration)} · SYNTHETIC AI STEWARD`;
    ui.title.textContent = slide.title;
    const update = item.writtenUpdate;
    const erratum = item.errata;
    let caption = update
      ? `${update.title}\n${update.text}\n\nHistorical audio limitation: ${update.audioNote}\n\nOriginal 12 November script and matching audio (historical):\n${item.text}`
      : item.text;
    if (erratum) {
      caption = `${erratum.title}\n${erratum.text}\n\nHistorical audio limitation: ${erratum.audioNote}\n\nOriginal 12 November script and matching audio (historical, dates superseded):\n${item.text}`;
    }
    ui.caption.textContent = caption;
    ui.transcript.href = `./narration/#${encodeURIComponent(item.id)}`;
    ui.download.href = item.audio;
    ui.vtt.href = item.vtt;
    ui.srt.href = item.srt;
    ui.download.setAttribute('download', item.audio.split('/').pop());
    ui.previous.setAttribute('aria-label', `Previous narrated movement: ${options.getSlides()[(options.getIndex() - 1 + 12) % 12].title}`);
    ui.next.setAttribute('aria-label', `Next narrated movement: ${options.getSlides()[(options.getIndex() + 1) % 12].title}`);
    ui.previous.disabled = false;
    ui.next.disabled = false;
    updateTime();
  }
  function fail(message) {
    state.lastError = message;
    state.pendingContinue = false;
    ui.play.disabled = true;
    ui.seek.disabled = true;
    setStatus(`${message} The complete sourced transcript and caption downloads remain available.`);
    updatePlay();
  }

  async function loadManifest() {
    if (state.loaded) return state.loaded;
    if (state.loading) return state.loading;
    state.loading = fetch('./data/narration.json').then(async (response) => {
      if (!response.ok) throw new Error('Narration data is unavailable.');
      const data = await response.json();
      const slides = options.getSlides();
      if (data.schema !== 'oso-ai-steward-narration-v1' || !Array.isArray(data.slides) || data.slides.length !== slides.length || data.slides.some((item, index) => item.id !== slides[index].id)) throw new Error('Narration data does not match this deck.');
      if (data.usage?.autoplay !== false || data.usage?.defaultEnabled !== false || data.voice?.notHumanRecording !== true || data.voice?.authorizedByShaka !== true) throw new Error('Narration disclosure or playback boundary failed validation.');
      state.loaded = data;
      ui.disclosure.textContent = data.disclosure;
      return data;
    }).catch((error) => {
      state.loading = null;
      fail(`${error.message} Showing the readable edition instead.`);
      ui.transcript.href = './narration/';
      return null;
    });
    return state.loading;
  }

  async function play() {
    options.pauseSlideshow();
    if (!state.loaded && !await loadManifest()) return;
    if (!state.loaded || state.lastError) return;
    const index = options.getIndex();
    if (state.index !== index || !ui.audio.getAttribute('src')) loadSlide(index);
    // The track URL is deliberately attached only after a Play gesture, not on open.
    const item = record();
    if (item && ui.track.getAttribute('src') !== item.vtt) ui.track.src = item.vtt;
    ui.audio.playbackRate = Number(ui.speed.value);
    state.activationRequested = true;
    try {
      await ui.audio.play();
    } catch (error) {
      if (error.name === 'AbortError') return; // navigation/pause won the race intentionally
      fail(`Audio could not play in this browser (${error.name}).`);
    }
  }

  function loadSlide(index) {
    const items = state.loaded?.slides;
    if (!items?.[index]) return;
    state.index = index;
    state.lastError = '';
    state.activationRequested = false;
    ui.play.disabled = false;
    ui.audio.src = items[index].audio;
    // No autoplay attribute and no play() here unless syncSlide explicitly preserves an already-playing sequence.
    ui.audio.playbackRate = Number(ui.speed.value);
    displaySlide();
  }

  function syncSlide(index) {
    if (!state.open || !state.loaded) return;
    const resume = state.pendingContinue || (!ui.audio.paused && !ui.audio.ended);
    state.pendingContinue = false;
    if (state.index === index) { displaySlide(); return; }
    loadSlide(index);
    if (resume) play();
    else setStatus('Ready only when you press Play. Read the same narration below or open its claim-level sources.');
  }

  function pause() {
    state.pendingContinue = false;
    ui.audio.pause();
    updatePlay();
  }
  function close({ updateHistory = true } = {}) {
    state.open = false;
    pause();
    ui.panel.hidden = true;
    options.onVisibility?.(false);
    if (updateHistory) updateUrl();
    setOpenerState();
  }
  async function open() {
    state.open = true;
    state.lastError = '';
    ui.panel.hidden = false;
    options.onVisibility?.(true);
    options.onEnter?.();
    options.pauseSlideshow();
    setOpenerState();
    updateUrl();
    setStatus('Preparing the optional narrated edition. Nothing will play until you press Play.');
    ui.play.disabled = true;
    ui.previous.disabled = true;
    ui.next.disabled = true;
    const data = await loadManifest();
    if (!data || !state.open) return;
    loadSlide(options.getIndex());
    ui.play.disabled = false;
    setStatus('Ready only when you press Play. Read the same narration below or open its claim-level sources.');
    ui.play.focus({ preventScroll: true });
  }
  function go(delta) {
    const next = (options.getIndex() + delta + options.getSlides().length) % options.getSlides().length;
    options.setSlide(next);
  }

  openers.forEach((opener) => {
    opener.setAttribute('aria-controls', 'narration-panel');
    opener.setAttribute('aria-expanded', 'false');
    opener.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.open) ui.play.focus({ preventScroll: true });
      else open();
    });
  });
  ui.close.addEventListener('click', () => { close(); document.querySelector('#narration-open')?.focus({ preventScroll: true }); });
  ui.play.addEventListener('click', () => { if (ui.audio.paused || ui.audio.ended) play(); else pause(); });
  ui.previous.addEventListener('click', () => go(-1));
  ui.next.addEventListener('click', () => go(1));
  ui.speed.addEventListener('change', () => { ui.audio.playbackRate = Number(ui.speed.value); setStatus(`Playback speed ${ui.speed.options[ui.speed.selectedIndex].text}. Narration remains optional and synthetic.`); });
  ui.seek.addEventListener('input', () => {
    if (!Number.isFinite(ui.audio.duration)) return;
    state.seeking = true;
    const time = Math.min(Math.max(Number(ui.seek.value), 0), ui.audio.duration);
    ui.time.textContent = `${timecode(time)} / ${timecode(ui.audio.duration)}`;
  });
  ui.seek.addEventListener('change', () => {
    if (Number.isFinite(ui.audio.duration)) {
      try { ui.audio.currentTime = Math.min(Math.max(Number(ui.seek.value), 0), ui.audio.duration); }
      catch { fail('Seeking is unavailable for this audio.'); }
    }
    state.seeking = false;
    updateTime();
  });
  ui.panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  });
  ui.audio.addEventListener('play', () => { options.pauseSlideshow(); updatePlay(); setStatus('Playing synthetic editorial narration — not Shaka live, and not meeting audio.'); });
  ui.audio.addEventListener('pause', updatePlay);
  ui.audio.addEventListener('loadedmetadata', () => { state.lastError = ''; ui.play.disabled = false; updateTime(); });
  ui.audio.addEventListener('durationchange', updateTime);
  ui.audio.addEventListener('timeupdate', updateTime);
  ui.audio.addEventListener('seeked', updateTime);
  ui.audio.addEventListener('ratechange', updateTime);
  ui.audio.addEventListener('error', () => { if (state.open && ui.audio.getAttribute('src')) fail('This narration audio is unavailable.'); });
  ui.audio.addEventListener('ended', () => {
    updatePlay();
    if (options.getIndex() === options.getSlides().length - 1) {
      state.index = -1; // a later Play intentionally starts the final movement again, not a surprise loop
      setStatus('The narrated deck is complete. Press Play to hear this closing again, or return to any movement.');
      return;
    }
    state.pendingContinue = true;
    go(1);
  });

  ui.disclosure.textContent = escapeText('AI-agent-steward synthetic narration authorized by Shaka; not a live or new recording of Shaka. An AI speaker, not human presence or meeting attendance; based only on cited public records.');
  updatePlay();
  return {
    open, close, pause, syncSlide,
    isOpen: () => state.open,
    isLoaded: () => Boolean(state.loaded),
    hasRequestedActivation: () => state.activationRequested
  };
}
