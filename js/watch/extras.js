/* The Pit Theater (Open Source Orchestra) v3 · Season 1 · Extras · GPL-3.0 · built by the ʻohana (machines, labelled as machines).
   Native players stay native (nothing plays until a person presses Play). The one YouTube piece (a public Devcon 8
   recording) loads only after an explicit click, privacy-enhanced (youtube-nocookie), never before. */
import { $$ } from './common.js';

for (const button of $$('[data-load-embed]')) {
  button.addEventListener('click', () => {
    const id = button.dataset.loadEmbed;
    if (!/^[\w-]{6,20}$/.test(id)) return;
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
    frame.title = button.dataset.title || 'Video';
    frame.allow = 'encrypted-media; picture-in-picture; fullscreen';
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.className = 'embed-loaded';
    button.replaceWith(frame);
    frame.focus({ preventScroll: true });
  });
}
// one film at a time: pressing Play on a piece pauses the others
const players = $$('.extra video, .extra audio');
for (const el of players) el.addEventListener('play', () => players.forEach((other) => { if (other !== el && !other.paused) other.pause(); }));
