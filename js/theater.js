/* The Theater: the projector as a six-channel switcher with karaoke transcribers and an infinite garden behind the screen.
   Nothing plays until a person presses Play. No autoplay, no trackers, no external request before an explicit choice.
   Channels 1–3 stream consented recordings (byte ranges), channel 4 hands over to the slide deck + authorized synthetic
   narration, channels 5–6 are click-to-load youtube-nocookie embeds of Shaka's own published videos. */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const FLUTTER = ['🦋', '💛', '🦋', '🤍', '💗', '🦋', '💛', '🦋', '🩷', '🦋', '💛', '🤍', '🦋', '💗', '🦋', '💛', '🦋', '🤍'];

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}
function clock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function sameOriginOrAllowed(url, origins) {
  if (url.startsWith('/') || url.startsWith('./')) return true;
  return origins.some((origin) => url.startsWith(origin));
}

/** Normalize any of the three transcript shapes into flat karaoke cues. */
function cuesFrom(transcript) {
  if (Array.isArray(transcript?.cues)) return transcript.cues.map((cue) => ({ start: Number(cue.start), end: Number(cue.end), speaker: cue.speaker || '', text: cue.text || '' }));
  if (Array.isArray(transcript?.turns)) {
    const names = transcript.speakers || {};
    const cues = [];
    for (const turn of transcript.turns) {
      const speaker = names[turn.speaker]?.name || turn.speaker || '';
      for (const segment of turn.segments || []) cues.push({ start: Number(segment.start), end: Number(segment.end), speaker, text: segment.text || '' });
    }
    return cues.sort((a, b) => a.start - b.start);
  }
  return [];
}

export function createTheater({ hall, narration, showToast, onEnter, stopSlideshow, setSlide }) {
  const ui = {
    section: $('#theater'), title: $('#theater-title'), close: $('#theater-close'),
    dial: $('#channel-dial'), video: $('#channel-video'), track: $('#channel-track'),
    embed: $('#screen-embed'), deck: $('#screen-deck'), screen: $('#screen'),
    chapters: $('#channel-chapters'), speed: $('#channel-speed'), share: $('#channel-share'), open: $('#channel-open'),
    karaoke: $('#karaoke'), lines: $('#karaoke-lines'), karaokeTitle: $('#karaoke-title'), karaokeNote: $('#karaoke-note'),
    now: $('#now-playing'), growing: $('#theater-growing'), gardenPhotos: $('#garden-photos'), gardenFlutter: $('#garden-flutter'),
    status: $('#theater-status'), announcer: $('#theater-announcer')
  };
  const state = { channels: [], origins: { video: [], youtube: [] }, garden: [], index: 0, open: false, cues: [], cueIndex: -1, transcriptLoads: new Map(), hallVideo: false, built: false, swipe: null };
  let hallRef = hall;

  function current() { return state.channels[state.index]; }
  function isOpen() { return state.open; }
  function setHall(nextHall) { hallRef = nextHall; }

  function updateUrl({ time = null } = {}) {
    const url = new URL(window.location.href);
    if (state.open && current()) {
      url.searchParams.set('channel', current().id);
      if (time !== null && time > 2) url.searchParams.set('t', String(Math.floor(time)));
      else url.searchParams.delete('t');
    } else { url.searchParams.delete('channel'); url.searchParams.delete('t'); }
    history.replaceState(history.state, '', url);
  }

  function buildGarden() {
    if (state.built) return;
    state.built = true;
    ui.gardenPhotos.innerHTML = state.garden.map((item, index) => {
      const x = (index * 37) % 100, y = (index * 53) % 100, size = 18 + (index % 4) * 6, delay = -(index * 7.3), duration = 48 + (index % 5) * 9;
      return `<figure class="garden-photo" style="--x:${x}%;--y:${y}%;--size:${size}vw;--delay:${delay}s;--duration:${duration}s"><img src="${escapeHTML(item.src)}" alt="" loading="lazy" decoding="async"></figure>`;
    }).join('');
    ui.gardenFlutter.innerHTML = FLUTTER.map((glyph, index) => {
      const x = (index * 29 + 7) % 100, delay = -(index * 4.1), duration = 22 + (index % 6) * 5, scale = 0.7 + (index % 3) * 0.35;
      return `<span class="flutter" style="--x:${x}%;--delay:${delay}s;--duration:${duration}s;--scale:${scale}"><i>${glyph}</i></span>`;
    }).join('');
  }

  function renderDial() {
    ui.dial.innerHTML = state.channels.map((channel, index) => `<button type="button" role="tab" id="channel-tab-${escapeHTML(channel.id)}" data-channel="${escapeHTML(channel.id)}" aria-selected="${index === state.index}" aria-controls="screen" tabindex="${index === state.index ? 0 : -1}" title="Channel ${channel.number} · ${escapeHTML(channel.title)}"><b>${channel.number}</b><span><strong>${escapeHTML(channel.title.split(' · ')[0])}</strong><small>${escapeHTML(channel.durationLabel || channel.dateLabel.split(' · ')[0])}</small></span></button>`).join('');
  }

  function stopMedia() {
    if (!ui.video.paused) ui.video.pause();
    ui.embed.querySelector('iframe')?.remove();
    ui.embed.querySelectorAll('.embed-loaded').forEach((node) => node.remove());
    if (state.hallVideo) { hallRef?.setVideo?.(null); state.hallVideo = false; }
  }

  function renderNowPlaying(channel) {
    const links = (channel.links || []).map((link) => `<a href="${escapeHTML(link.url)}" ${/^https?:/.test(link.url) ? 'target="_blank" rel="noopener noreferrer"' : ''}>${escapeHTML(link.label)}${/^https?:/.test(link.url) ? ' ↗' : ''}</a>`).join('');
    const speakers = (channel.speakers || []).map((name) => `<span>${escapeHTML(name)}</span>`).join('');
    const statusLabel = { published_with_consent: 'PUBLISHED WITH CONSENT', authorized_synthetic: 'AUTHORIZED SYNTHETIC NARRATION', owner_published: 'PUBLISHED BY ITS OWNER' }[channel.consent?.status] || 'PUBLIC';
    ui.now.innerHTML = `
      <p class="now-kicker">NOW ON THE PROJECTOR · CHANNEL ${channel.number} OF ${state.channels.length} · ${escapeHTML(statusLabel)}</p>
      <h3>${escapeHTML(channel.title)}</h3>
      <p class="now-sub">${escapeHTML(channel.subtitle || '')}</p>
      <p class="now-meta"><span>${escapeHTML(channel.dateLabel || '')}</span>${channel.durationLabel ? `<span>${escapeHTML(channel.durationLabel)}</span>` : ''}</p>
      <p class="now-lede">${escapeHTML(channel.lede || '')}</p>
      <p class="now-speakers"><strong>Who spoke</strong> ${speakers} <small>${escapeHTML(channel.speakersNote || '')}</small></p>
      <p class="now-consent"><strong>Consent</strong> ${escapeHTML(channel.consent?.line || '')}</p>
      <p class="now-care"><a href="https://opensourceorchestra.org/takedown/" target="_blank" rel="noopener noreferrer">Takedown first — down first, no reason needed ↗</a> · <a href="https://publicinform.com/#consent" target="_blank" rel="noopener noreferrer">PIT protocol · publicinform ↗</a> · <a href="./meetings/">Public media files ledger</a> · <a href="./archive/">Archive status</a></p>
      <nav class="now-links" aria-label="Links for this channel">${links}</nav>`;
  }

  function renderKaraoke(channel, cues, note) {
    state.cues = cues;
    state.cueIndex = -1;
    ui.karaokeTitle.textContent = cues.length ? `Karaoke transcriber · ${channel.title.split(' · ')[0]}` : 'Karaoke transcriber';
    ui.karaokeNote.textContent = note;
    ui.lines.innerHTML = cues.map((cue, index) => `<li data-index="${index}" data-start="${cue.start}"><button type="button" data-seek="${cue.start}" aria-label="Seek to ${clock(cue.start)}"><time>${clock(cue.start)}</time>${cue.speaker ? `<b>${escapeHTML(cue.speaker)}</b>` : ''}<span>${escapeHTML(cue.text)}</span></button></li>`).join('');
    ui.karaoke.hidden = !cues.length;
  }

  async function loadTranscript(channel) {
    const path = channel.media?.transcript;
    if (!path || channel.kind !== 'video') return [];
    if (!state.transcriptLoads.has(path)) {
      state.transcriptLoads.set(path, fetch(path).then((response) => {
        if (!response.ok) throw new Error(`Transcript unavailable: ${path}`);
        return response.json();
      }).then(cuesFrom).catch((error) => { console.warn(error.message); state.transcriptLoads.delete(path); return []; }));
    }
    return state.transcriptLoads.get(path);
  }

  function syncKaraoke(time) {
    const cues = state.cues;
    if (!cues.length) return;
    let lo = 0, hi = cues.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].start <= time) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (found >= 0 && time > cues[found].end + 0.35 && (found + 1 >= cues.length || time < cues[found + 1].start)) found = -1;
    const progress = found >= 0 ? Math.min(1, Math.max(0, (time - cues[found].start) / Math.max(0.6, cues[found].end - cues[found].start))) : 0;
    const items = ui.lines.children;
    if (found !== state.cueIndex) {
      if (state.cueIndex >= 0 && items[state.cueIndex]) { items[state.cueIndex].classList.remove('is-now'); items[state.cueIndex].classList.add('is-past'); }
      for (let index = 0; index < items.length; index += 1) items[index].classList.toggle('is-past', index < found);
      state.cueIndex = found;
      if (found >= 0 && items[found]) {
        items[found].classList.add('is-now');
        items[found].classList.remove('is-past');
        items[found].scrollIntoView({ block: 'center', behavior: motionQuery.matches ? 'instant' : 'smooth' });
      }
    }
    if (found >= 0 && items[found]) items[found].style.setProperty('--p', progress.toFixed(3));
  }

  function selectChapterFor(time) {
    if (!ui.chapters.options.length) return;
    let best = 0;
    [...ui.chapters.options].forEach((option, index) => { if (Number(option.value) <= time + 0.01) best = index; });
    if (ui.chapters.selectedIndex !== best) ui.chapters.selectedIndex = best;
  }

  async function show(index, { seekTo = null, announce = true, updateHistory = true } = {}) {
    if (!state.channels.length) return;
    const nextIndex = (index + state.channels.length) % state.channels.length;
    stopMedia();
    state.index = nextIndex;
    const channel = current();
    ui.section.dataset.channel = channel.id;
    ui.section.dataset.kind = channel.kind;
    ui.title.textContent = `Channel ${channel.number} · ${channel.title}`;
    ui.dial.querySelectorAll('[role="tab"]').forEach((tab, tabIndex) => {
      tab.setAttribute('aria-selected', String(tabIndex === nextIndex));
      tab.tabIndex = tabIndex === nextIndex ? 0 : -1;
    });
    renderNowPlaying(channel);
    ui.video.hidden = channel.kind !== 'video';
    ui.embed.hidden = channel.kind !== 'youtube';
    ui.deck.hidden = channel.kind !== 'deck';
    ui.chapters.innerHTML = '';
    ui.chapters.disabled = true;
    ui.speed.disabled = channel.kind !== 'video';
    ui.share.disabled = false;
    if (channel.kind === 'video') {
      const media = channel.media;
      if (!sameOriginOrAllowed(media.video.url, state.origins.video)) throw new Error(`Channel ${channel.id}: media origin not allowed.`);
      ui.video.removeAttribute('src');
      ui.track.removeAttribute('src');
      ui.video.poster = media.poster || '';
      ui.video.src = media.video.url;
      if (media.captions) { ui.track.src = media.captions; ui.track.label = 'English captions · editorial speaker labels'; ui.track.default = true; }
      ui.video.playbackRate = Number(ui.speed.value) || 1;
      ui.video.setAttribute('aria-label', `${channel.title}. Press Play to stream; nothing plays automatically.`);
      ui.open.href = media.video.url;
      ui.open.hidden = false;
      (channel.chapters || []).forEach((chapter) => {
        const option = document.createElement('option');
        option.value = String(chapter.start);
        option.textContent = `${clock(chapter.start)} · ${chapter.title}`;
        ui.chapters.appendChild(option);
      });
      ui.chapters.disabled = !ui.chapters.options.length;
      ui.status.textContent = `Channel ${channel.number} is on the projector. Press Play on the screen to stream the film with byte ranges; captions, chapters and the karaoke transcriber follow along.`;
      renderKaraoke(channel, [], 'Loading the transcript…');
      const cues = await loadTranscript(channel);
      if (current() !== channel) return;
      renderKaraoke(channel, cues, cues.length ? `${cues.length} lines · ${channel.speakersNote || 'first names only'} · click a line to seek · the lit line follows playback` : 'No synchronized transcript for this channel.');
      if (seekTo !== null && Number.isFinite(seekTo)) {
        const target = Math.max(0, Math.min(seekTo, (channel.durationSeconds || seekTo) - 1));
        syncKaraoke(target);
        selectChapterFor(target);
        const applySeek = () => { try { ui.video.currentTime = target; } catch { /* metadata not loaded yet */ } };
        if (ui.video.readyState >= 1) applySeek();
        else ui.video.addEventListener('loadedmetadata', applySeek, { once: true });
        ui.status.textContent = `Deep link: channel ${channel.number} at ${clock(target)}. Press Play to start there.`;
      }
    } else if (channel.kind === 'youtube') {
      if (!state.origins.youtube.includes(channel.media.youtubeId)) throw new Error(`Channel ${channel.id}: YouTube id not allowed.`);
      ui.embed.innerHTML = `<button type="button" class="embed-poster" data-load-embed aria-label="Load ${escapeHTML(channel.title)} from youtube-nocookie.com"><img src="${escapeHTML(channel.media.poster)}" alt="" loading="lazy"><span><b>▶</b><strong>Load from YouTube (privacy-enhanced)</strong><small>Nothing loads from YouTube until you choose. ${escapeHTML(channel.subtitle || '')}</small></span></button><p class="embed-fallback">Or <a href="${escapeHTML(channel.media.watch)}" target="_blank" rel="noopener noreferrer">watch on YouTube ↗</a> · published by Shaka on his own channel.</p>`;
      ui.open.href = channel.media.watch;
      ui.open.hidden = false;
      ui.status.textContent = `Channel ${channel.number} is a YouTube video from Shaka's own channel. Choose Load to embed it privacy-enhanced, or open it on YouTube.`;
      renderKaraoke(channel, [], 'YouTube provides its own captions inside the player once loaded.');
    } else {
      ui.deck.innerHTML = `<div class="deck-card"><p class="now-kicker">CHANNEL 4 · THE DECK ON THE HALL PROJECTOR</p><h3>Twelve movements · AI steward narration</h3><p>The slide deck returns to the big screen and the <strong>Listen to the hall</strong> panel opens. Press Play there; captions and the sourced transcript stay readable. Authorized synthetic narration, not a live or new Shaka recording.</p><button type="button" id="deck-go" class="enter-button"><span>Put the deck on the projector</span><b aria-hidden="true">→</b></button><p class="embed-fallback"><a href="./narration/">Read the complete sourced narration ↗</a></p></div>`;
      ui.open.href = './narration/';
      ui.open.hidden = false;
      ui.status.textContent = 'Channel 4 hands the projector back to the slide deck with optional narration.';
      renderKaraoke(channel, [], 'Narration captions appear in the Listen panel, movement by movement.');
    }
    if (updateHistory) updateUrl({ time: seekTo });
    if (announce) ui.announcer.textContent = `Channel ${channel.number} of ${state.channels.length}: ${channel.title}. ${channel.consent?.line || ''}`;
    ui.growing.hidden = false;
  }

  function open({ channelId = null, seekTo = null, updateHistory = true } = {}) {
    if (!state.channels.length) { showToast?.('The channels are not available in this browser; the public media files ledger lists every film.'); return; }
    stopSlideshow?.();
    narration?.pause?.();
    buildGarden();
    state.open = true;
    ui.section.hidden = false;
    document.body.classList.add('theater-open');
    const index = channelId ? state.channels.findIndex((channel) => channel.id === channelId) : state.index;
    show(index >= 0 ? index : 0, { seekTo, updateHistory });
    onEnter?.();
    requestAnimationFrame(() => ui.dial.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true }));
  }

  function close({ updateHistory = true, focusOpener = true } = {}) {
    if (!state.open) return;
    stopMedia();
    state.open = false;
    ui.section.hidden = true;
    document.body.classList.remove('theater-open');
    if (updateHistory) updateUrl();
    if (focusOpener) $('#channels-button')?.focus({ preventScroll: true });
  }

  function step(delta) { show(state.index + delta); ui.dial.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true }); }

  // Wiring.
  ui.dial.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-channel]');
    if (!tab) return;
    show(state.channels.findIndex((channel) => channel.id === tab.dataset.channel));
  });
  ui.dial.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Home') show(0); else if (event.key === 'End') show(state.channels.length - 1); else show(state.index + (event.key === 'ArrowRight' ? 1 : -1));
    ui.dial.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
  });
  ui.close.addEventListener('click', () => close());
  ui.video.addEventListener('play', () => {
    if (hallRef?.setVideo && !state.hallVideo) { hallRef.setVideo(ui.video); state.hallVideo = true; }
    ui.status.textContent = `Playing channel ${current().number}: ${current().title}. The same film shines on the hall's big screen behind the theater.`;
  });
  ui.video.addEventListener('timeupdate', () => { syncKaraoke(ui.video.currentTime); selectChapterFor(ui.video.currentTime); });
  ui.video.addEventListener('seeked', () => { syncKaraoke(ui.video.currentTime); selectChapterFor(ui.video.currentTime); });
  ui.video.addEventListener('error', () => { if (current()?.kind === 'video') ui.status.textContent = `This film could not be streamed right now. Direct file: ${current().media.video.url} — or read the transcript and listen to the audio from the links below.`; });
  ui.lines.addEventListener('click', (event) => {
    const button = event.target.closest('[data-seek]');
    if (!button) return;
    const time = Number(button.dataset.seek);
    try { ui.video.currentTime = time; } catch { ui.video.addEventListener('loadedmetadata', () => { ui.video.currentTime = time; }, { once: true }); }
    syncKaraoke(time);
    if (ui.video.paused) ui.video.play().catch(() => { ui.status.textContent = `Cued to ${clock(time)}. Press Play on the screen to start.`; });
  });
  ui.chapters.addEventListener('change', () => {
    const time = Number(ui.chapters.value);
    try { ui.video.currentTime = time; } catch { ui.video.addEventListener('loadedmetadata', () => { ui.video.currentTime = time; }, { once: true }); }
    syncKaraoke(time);
    ui.status.textContent = `Chapter: ${ui.chapters.selectedOptions[0]?.textContent || clock(time)}. ${ui.video.paused ? 'Press Play on the screen to start here.' : ''}`;
  });
  ui.speed.addEventListener('change', () => { ui.video.playbackRate = Number(ui.speed.value) || 1; });
  ui.share.addEventListener('click', async () => {
    const channel = current();
    const time = channel.kind === 'video' ? ui.video.currentTime : null;
    updateUrl({ time });
    const url = window.location.href;
    const share = { title: `${channel.title} · Open Source Orchestra DAO Meet`, text: `${channel.consent?.line || ''} Channel ${channel.number} of the theater.`, url };
    if (navigator.share) { try { await navigator.share(share); } catch (error) { if (error.name !== 'AbortError') showToast?.('Sharing was unavailable. Copy the address bar to share this moment.'); } return; }
    try { await navigator.clipboard.writeText(url); showToast?.(`Copied this moment: channel ${channel.number}${time ? ` at ${clock(time)}` : ''}.`); }
    catch { showToast?.('Copy the address bar to share this channel and moment.'); }
  });
  ui.embed.addEventListener('click', (event) => {
    const button = event.target.closest('[data-load-embed]');
    if (!button) return;
    const channel = current();
    if (channel.kind !== 'youtube' || !state.origins.youtube.includes(channel.media.youtubeId)) return;
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(channel.media.youtubeId)}?rel=0`;
    frame.title = channel.title;
    frame.allow = 'encrypted-media; picture-in-picture; fullscreen';
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.className = 'embed-loaded';
    button.replaceWith(frame);
    ui.status.textContent = `Loaded channel ${channel.number} from youtube-nocookie.com. Use the player's own controls to play; YouTube captions are inside the player.`;
    frame.focus({ preventScroll: true });
  });
  ui.deck.addEventListener('click', (event) => {
    if (!event.target.closest('#deck-go')) return;
    close({ updateHistory: true, focusOpener: false });
    setSlide?.(0);
    narration?.open?.();
  });
  ui.section.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' || event.target.closest('video, iframe, select, input, .karaoke, button, a')) { state.swipe = null; return; }
    state.swipe = { x: event.clientX, y: event.clientY };
  });
  ui.section.addEventListener('pointerup', (event) => {
    if (!state.swipe) return;
    const dx = event.clientX - state.swipe.x, dy = event.clientY - state.swipe.y;
    state.swipe = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 60) step(dx < 0 ? 1 : -1);
  });
  document.addEventListener('keydown', (event) => {
    if (!state.open || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'VIDEO', 'IFRAME'].includes(tag)) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (/^[1-9]$/.test(event.key) && Number(event.key) <= state.channels.length) { event.preventDefault(); event.stopPropagation(); show(Number(event.key) - 1); return; }
    if (event.target.closest('#channel-dial')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); step(event.key === 'ArrowRight' ? 1 : -1); }
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden && !ui.video.paused) ui.video.pause(); });

  async function load() {
    const [channelsResponse, gardenResponse] = await Promise.all([fetch('./data/channels.json'), fetch('./data/garden.json')]);
    if (!channelsResponse.ok || !gardenResponse.ok) throw new Error('Channel registry or garden could not be loaded.');
    const [registry, garden] = await Promise.all([channelsResponse.json(), gardenResponse.json()]);
    if (!Array.isArray(registry.channels) || registry.channels.length !== 6) throw new Error('The theater needs exactly six channels.');
    state.channels = registry.channels;
    state.origins = registry.mediaOrigins;
    state.garden = garden.items || [];
    ui.growing.innerHTML = `<strong>Growing the OSO DAO public media files.</strong> ${escapeHTML(registry.protocol.growing)} <a href="./meetings/">Open the ledger</a> · <a href="${escapeHTML(registry.protocol.url)}" target="_blank" rel="noopener noreferrer">PIT protocol ↗</a> · <a href="${escapeHTML(registry.protocol.takedown)}" target="_blank" rel="noopener noreferrer">Takedown first ↗</a>`;
    renderDial();
    $('#channels-button')?.removeAttribute('disabled');
    return registry;
  }

  return { load, open, close, show, isOpen, setHall, current, channels: () => state.channels };
}
