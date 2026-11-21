/* OSO PIT THEATER v3 · shared helpers · GPL-3.0 · built by the ʻohana (machines, labelled as machines). */
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + ':' + String(r).padStart(2, '0');
}

export function parseTime(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  const parts = text.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) {
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
    if (!m) return null;
    return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
  }
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function escapeHTML(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* localStorage that never throws (private mode, quotas, disabled storage). Everything stays on this device. */
export const store = {
  get(key, fallback = null) { try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
  del(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
};
export const KEYS = { progress: 'oso-watch:progress', autonext: 'oso-watch:autonext', speed: 'oso-watch:speed', captions: 'oso-watch:captions', audioOnly: 'oso-watch:audio-only' };

export function progressAll() { const all = store.get(KEYS.progress, {}); return all && typeof all === 'object' ? all : {}; }
export function progressFor(ep) { return progressAll()[ep] || null; }
export function saveProgress(ep, t, d) {
  if (!ep || !Number.isFinite(t) || !Number.isFinite(d) || d <= 0) return;
  const all = progressAll();
  const done = t >= d - 45;
  all[ep] = { t: Math.round(t), d: Math.round(d), at: Date.now(), done: done || Boolean(all[ep]?.done) };
  store.set(KEYS.progress, all);
}

export function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

export function toast(message, status) {
  const target = status || $('[data-toast]') || $('.player-status');
  if (target) target.textContent = message;
}

export async function loadJSON(url) {
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

/* Consent gate: only episodes published with consent may show media or words. The schema keeps the other
   states (pending_confirmation · gated) for future circles; this function is the one place that decides. */
export const CONSENT = { PUBLISHED: 'published_with_consent', PENDING: 'pending_confirmation', GATED: 'gated' };
export function isPublished(episode) { return episode?.consent?.status === CONSENT.PUBLISHED; }
export function isListed(episode) { return isPublished(episode) || episode?.consent?.status === CONSENT.PENDING; }
export function hasFilm(episode) { return isPublished(episode) && Boolean(episode?.media?.video?.url) && episode.media.video.arriving !== true; }
