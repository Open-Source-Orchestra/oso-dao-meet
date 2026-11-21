/* The Pit Theater (Open Source Orchestra) v3 · the player · GPL-3.0 · built by the ʻohana (machines, labelled as machines).
   Enhances the static <video> the generator wrote: chapters bar, speed, captions, PiP, audio-only, share with
   timestamp, ?t= deep links, continue watching (localStorage only, never sent anywhere), opt-in autoplay-next,
   keyboard shortcuts. Nothing plays until a person presses Play; nothing here floats over text. */
import { $, $$, clock, parseTime, escapeHTML, store, KEYS, progressFor, saveProgress, toast } from './common.js';

export function mountPlayer(root, options = {}) {
  if (!root || root.dataset.mounted) return null;
  root.dataset.mounted = '1';
  const ep = root.dataset.ep;
  const video = $('video', root);
  const audio = $('audio', root);
  const screen = $('.screen', root);
  const status = $('.player-status', root);
  const arriving = root.dataset.arriving === '1';
  const duration = Number(root.dataset.duration) || 0;
  const next = root.dataset.next || '';
  const chapters = (() => { try { return JSON.parse($('script[data-chapters]', root)?.textContent || '[]'); } catch { return []; } })();
  const listeners = new Set();
  let media = video || audio; // an arriving film may already have its mono MP3: the transcript follows the audio
  let userScrolledAt = 0;

  const say = (message) => toast(message, status);
  const onTime = (fn) => listeners.add(fn);
  const emit = () => { const t = media?.currentTime || 0; listeners.forEach((fn) => fn(t)); };

  /* ── chapters bar ── */
  const bar = $('.chapters-bar', root);
  const now = $('.chapter-now', root);
  const total = duration || (chapters.length ? chapters[chapters.length - 1].start + 60 : 0);
  if (bar && chapters.length && total) {
    bar.innerHTML = chapters.map((c, i) => {
      const end = chapters[i + 1]?.start ?? total;
      return `<li style="--w:${Math.max(1, end - c.start)}"><button type="button" data-start="${c.start}" title="${escapeHTML(clock(c.start))} · ${escapeHTML(c.title)}" aria-label="Chapter ${i + 1}: ${escapeHTML(c.title)} at ${escapeHTML(clock(c.start))}"></button></li>`;
    }).join('');
    bar.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-start]');
      if (!button) return;
      seek(Number(button.dataset.start), true);
    });
    onTime((t) => {
      let idx = -1;
      chapters.forEach((c, i) => { if (t >= c.start) idx = i; });
      $$('li', bar).forEach((li, i) => {
        li.classList.toggle('on', i === idx);
        const c = chapters[i], end = chapters[i + 1]?.start ?? total;
        const p = i < idx ? 100 : i === idx ? Math.min(100, ((t - c.start) / Math.max(1, end - c.start)) * 100) : 0;
        li.firstElementChild.style.setProperty('--p', `${p.toFixed(1)}%`);
      });
      if (now) now.innerHTML = idx >= 0 ? `<b>${escapeHTML(clock(chapters[idx].start))}</b> ${escapeHTML(chapters[idx].title)}` : '';
    });
  }

  /* ── seeking helpers ── */
  function seek(t, play = false) {
    if (!media) return;
    const target = Math.max(0, Math.min(t, (duration || t + 1) - 0.5));
    const apply = () => { try { media.currentTime = target; } catch { /* metadata not ready */ } };
    if (media.readyState >= 1) apply(); else media.addEventListener('loadedmetadata', apply, { once: true });
    if (play) media.play().catch(() => say(`Ready at ${clock(target)} — press Play.`));
    emit();
  }

  /* ── controls ── */
  const ctl = $('.ctl', root);
  if (ctl && !arriving) {
    ctl.innerHTML = `
      <select data-speed aria-label="Playback speed">${[0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => `<option value="${s}">${s}×</option>`).join('')}</select>
      <button type="button" class="btn" data-cc aria-pressed="true" title="Captions (c)">CC</button>
      <button type="button" class="btn" data-pip title="Picture in picture (p)">PiP</button>
      <button type="button" class="btn" data-audio aria-pressed="false" title="Audio only — saves data">♪ audio only</button>
      <button type="button" class="btn" data-share title="Copy a link to this moment (s)">share moment</button>
      <span class="spacer"></span>
      <label><input type="checkbox" data-autonext> autoplay next</label>`;
    const speed = $('[data-speed]', ctl);
    speed.value = String(store.get(KEYS.speed, 1));
    const applySpeed = () => { const v = Number(speed.value) || 1; if (video) video.playbackRate = v; if (audio) audio.playbackRate = v; store.set(KEYS.speed, v); };
    speed.addEventListener('change', applySpeed);
    applySpeed();

    const cc = $('[data-cc]', ctl);
    const setCC = (on) => {
      const tracks = video?.textTracks || [];
      for (const track of tracks) track.mode = on ? 'showing' : 'hidden';
      cc.setAttribute('aria-pressed', String(on));
      store.set(KEYS.captions, on);
    };
    cc.addEventListener('click', () => setCC(cc.getAttribute('aria-pressed') !== 'true'));
    if (video?.textTracks?.length) setCC(store.get(KEYS.captions, true) !== false); else cc.disabled = true;

    const pip = $('[data-pip]', ctl);
    if (!document.pictureInPictureEnabled || !video) pip.disabled = true;
    pip.addEventListener('click', async () => {
      try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await video.requestPictureInPicture(); }
      catch { say('Picture-in-picture is not available here.'); }
    });

    const audioButton = $('[data-audio]', ctl);
    if (!audio || !audio.dataset.src) audioButton.disabled = true;
    audioButton.addEventListener('click', () => setAudioOnly(audioButton.getAttribute('aria-pressed') !== 'true'));
    function setAudioOnly(on) {
      if (!audio || !audio.dataset.src) return;
      const t = media.currentTime || 0, wasPlaying = !media.paused;
      if (on) {
        if (!audio.getAttribute('src')) audio.src = audio.dataset.src;
        video.pause(); media = audio; screen.classList.add('audio-only');
        say('Audio only: the mono MP3 plays and the transcript keeps following. Tap again for the film.');
      } else {
        audio.pause(); media = video; screen.classList.remove('audio-only');
        say('Back to the film.');
      }
      audioButton.setAttribute('aria-pressed', String(on));
      store.set(KEYS.audioOnly, on);
      seek(t, wasPlaying);
    }

    $('[data-share]', ctl).addEventListener('click', shareMoment);

    const autonext = $('[data-autonext]', ctl);
    autonext.checked = store.get(KEYS.autonext, false) === true;
    autonext.addEventListener('change', () => { store.set(KEYS.autonext, autonext.checked); say(autonext.checked ? 'Autoplay next is on (remembered on this device).' : 'Autoplay next is off.'); });
    if (!next) autonext.closest('label').hidden = true;
  }

  async function shareMoment() {
    const t = Math.floor(media?.currentTime || 0);
    const url = new URL(location.href);
    url.searchParams.delete('autoplay');
    if (t > 3) url.searchParams.set('t', String(t)); else url.searchParams.delete('t');
    const text = `${root.dataset.title || document.title}${t > 3 ? ` · at ${clock(t)}` : ''} · Open Source Orchestra DAO Meet · recorded with consent, first names only.`;
    try {
      if (navigator.share) { await navigator.share({ title: root.dataset.title || document.title, text, url: url.href }); return; }
      await navigator.clipboard.writeText(url.href);
      say(`Copied a link to this moment${t > 3 ? ` (${clock(t)})` : ''}.`);
    } catch { say(`Share this link: ${url.href}`); }
  }

  /* ── media events ── */
  const bind = (el) => {
    if (!el) return;
    el.addEventListener('timeupdate', () => { if (el !== media) return; emit(); saveTick(); });
    el.addEventListener('seeked', () => { if (el === media) emit(); });
    el.addEventListener('play', () => { if (el === media) say(''); });
    el.addEventListener('ended', () => { if (el !== media) return; saveProgress(ep, duration || el.duration || 0, duration || el.duration || 0); if (next && store.get(KEYS.autonext, false) === true) location.href = `../${next}/?autoplay=1`; else if (next) say('Up next is one tap away below.'); });
    el.addEventListener('error', () => { if (el === media) say('The film did not load from the theater host yet — the transcript, audio and download links below still work.'); });
  };
  bind(video); bind(audio);

  let lastSave = 0;
  function saveTick() {
    const t = media?.currentTime || 0;
    if (performance.now() - lastSave < 4000 || t < 5) return;
    lastSave = performance.now();
    saveProgress(ep, t, duration || media.duration || 0);
  }

  /* ── deep link + continue watching ── */
  const params = new URLSearchParams(location.search);
  const deep = parseTime(params.get('t'));
  if (media && deep !== null && deep > 0) {
    seek(deep);
    say(`Deep link: this moment is ${clock(deep)} in. Press Play.`);
  } else if (media) {
    const saved = progressFor(ep);
    if (saved && !saved.done && saved.t > 20 && saved.t < (saved.d || duration) - 45) {
      seek(saved.t);
      if (status) status.innerHTML = `Resumed where you left off (${escapeHTML(clock(saved.t))}, remembered only on this device). <button type="button" class="btn" data-restart>Start over</button>`;
      $('[data-restart]', status)?.addEventListener('click', () => { seek(0); say('From the top.'); });
    }
  }
  if (!arriving && params.get('autoplay') === '1' && store.get(KEYS.autonext, false) === true) {
    video?.play().catch(() => say('Autoplay was blocked by the browser — press Play.'));
  }

  /* ── keyboard ── */
  const keys = $('.keys', root);
  if (keys && !arriving) keys.innerHTML = `<kbd>space</kbd> play/pause · <kbd>←</kbd>/<kbd>→</kbd> 10 s · <kbd>j</kbd>/<kbd>l</kbd> 30 s · <kbd>c</kbd> captions · <kbd>f</kbd> fullscreen · <kbd>m</kbd> mute · <kbd>p</kbd> picture-in-picture · <kbd>s</kbd> share moment · <kbd>,</kbd>/<kbd>.</kbd> chapter`;
  document.addEventListener('keydown', (event) => {
    if (!media || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable) return;
    if (tag === 'BUTTON' && event.key === ' ') return;
    const idx = () => { let i = -1; chapters.forEach((c, k) => { if (media.currentTime >= c.start + 1) i = k; }); return i; };
    switch (event.key) {
      case ' ': case 'k': event.preventDefault(); media.paused ? media.play().catch(() => {}) : media.pause(); break;
      case 'ArrowLeft': event.preventDefault(); seek(media.currentTime - 10); break;
      case 'ArrowRight': event.preventDefault(); seek(media.currentTime + 10); break;
      case 'j': seek(media.currentTime - 30); break;
      case 'l': seek(media.currentTime + 30); break;
      case 'c': $('[data-cc]', root)?.click(); break;
      case 'm': media.muted = !media.muted; say(media.muted ? 'Muted.' : 'Sound on.'); break;
      case 'f': if (document.fullscreenElement) document.exitFullscreen?.(); else (video.requestFullscreen?.call(video) || screen.requestFullscreen?.call(screen))?.catch?.(() => {}); break;
      case 'p': $('[data-pip]', root)?.click(); break;
      case 's': shareMoment(); break;
      case ',': { const i = idx(); if (i > 0) seek(chapters[i - 1].start); else seek(0); break; }
      case '.': { const i = idx(); if (chapters[i + 1]) seek(chapters[i + 1].start); break; }
      default: return;
    }
  });

  if (arriving) say('Film arriving: the 720p encode and upload are in progress. The transcript below is already public; the ledger lists every file as it lands.');
  return { seek, onTime, get media() { return media; }, chapters, ep, markScroll() { userScrolledAt = performance.now(); }, userScrolledRecently() { return performance.now() - userScrolledAt < 6000; } };
}

export function mountAll(root = document) { return $$('[data-player]', root).map((el) => mountPlayer(el)); }
