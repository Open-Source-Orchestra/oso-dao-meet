/*! OSO THEATER TV · v1 · PIT Standard V2 front button · CC0
 *  One line on any door:  <script src="https://osodaomeet.opensourceorchestra.org/tv.js" async></script>
 *  Renders a small animated CRT television on the right edge of the page. Notes float out of it.
 *  Tap: a theater panel opens — music comes out of the TV (own-hosted, consented tracks),
 *  six channels of the OSO DAO theater, and the door into the room itself.
 *  No trackers, no cookies, no third-party loads. Respects prefers-reduced-motion. 🌺 built by the ʻohana (machines, not people)
 */
(function () {
  'use strict';
  if (window.__osoTV) return;
  window.__osoTV = true;
  var H = location.hostname;
  if (/(^|\.)osodaomeet\.opensourceorchestra\.org$/.test(H) || /^osodao\.(org|com|app)$/.test(H)) return; // the theater needs no door to itself
  var THEATER = 'https://osodaomeet.opensourceorchestra.org/';
  var FRONT = THEATER + '?slide=origin-repertoire&hall=mumbai&channel=devcon-6';
  var CHANNELS_JSON = THEATER + 'data/channels.json';
  var TRACKS = [
    { t: 'Butterflies and Love', a: 'Shaka', u: 'https://shakaleikaumaka.com/radio-assets/i-open-sourced-my-whole-universe.mp3' },
    { t: 'A Planet We Share As One', a: 'Shaka', u: 'https://shakaleikaumaka.com/radio-assets/a-planet-we-share-as-one.mp3' },
    { t: 'Be My Friend', a: 'Matteo Tambussi', u: 'https://shakaleikaumaka.com/radio-assets/matteo-tambussi--be-my-friend.mp3' },
    { t: 'Island', a: 'Matteo Tambussi', u: 'https://shakaleikaumaka.com/radio-assets/matteo-tambussi--island.mp3' }
  ];
  var FALLBACK_CHANNELS = [
    { id: 'weekly-call-2', number: 1, title: 'Weekly call #2 · right before Devcon 8' },
    { id: 'meeting-1', number: 2, title: 'Proposal Meeting #1 · 12 Nov 2026' },
    { id: 'meeting-2', number: 3, title: 'Proposal Meeting #2 · 13 Nov 2026' },
    { id: 'deck', number: 4, title: 'The deck, narrated' },
    { id: 'todo-es-posible', number: 5, title: 'Todo Es Posible · Pinolero demo' },
    { id: 'devcon-6', number: 6, title: 'Devcon 6 · Chiva Chillout Lounge 2022' }
  ];

  var CSS = '' +
  '#oso-tv{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:99997;font-family:Georgia,"Times New Roman",serif;line-height:1.35;-webkit-tap-highlight-color:transparent}' +
  '#oso-tv *{box-sizing:border-box}' +
  '#oso-tv .tv-btn{position:relative;display:block;width:88px;height:78px;padding:0;margin:0;border:0;background:transparent;cursor:pointer;outline-offset:3px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))}' +
  '#oso-tv .tv-btn:focus-visible{outline:3px solid #e8b84b;border-radius:14px}' +
  '#oso-tv .tv-set{position:absolute;left:9px;top:16px;width:74px;height:57px;animation:oso-tv-bob 4.2s ease-in-out infinite;transform-origin:50% 100%}' +
  '#oso-tv .tv-set svg{display:block;width:100%;height:100%;overflow:visible}' +
  '#oso-tv .tv-screen{fill:url(#oso-tv-grad)}' +
  '#oso-tv .tv-shine{animation:oso-tv-shine 3.6s linear infinite}' +
  '#oso-tv .tv-glyph{animation:oso-tv-glyph 6s ease-in-out infinite;transform-origin:50% 50%;transform-box:fill-box}' +
  '#oso-tv .tv-note{position:absolute;left:50%;bottom:56px;font-size:17px;color:#ffd97a;text-shadow:0 0 6px rgba(255,217,122,.75);opacity:0;pointer-events:none;animation:oso-tv-note 3.2s ease-out infinite}' +
  '#oso-tv .tv-note.n2{animation-delay:1.05s;font-size:13px;color:#ffb3e6}' +
  '#oso-tv .tv-note.n3{animation-delay:2.1s;font-size:12px;color:#9ff0ff}' +
  '#oso-tv.is-playing .tv-note{animation-duration:1.7s}' +
  '#oso-tv.is-playing .tv-set{animation-duration:1.1s}' +
  '#oso-tv.is-playing .tv-screen{filter:brightness(1.25)}#oso-tv .tv-onair{position:absolute;right:10px;top:12px;width:9px;height:9px;border-radius:999px;background:#ff3b5c;box-shadow:0 0 0 0 rgba(255,59,92,.7);opacity:0}#oso-tv.is-playing .tv-onair{opacity:1;animation:oso-tv-pulse 1.2s ease-out infinite}@keyframes oso-tv-pulse{0%{box-shadow:0 0 0 0 rgba(255,59,92,.7)}100%{box-shadow:0 0 0 10px rgba(255,59,92,0)}}' +
  '#oso-tv .tv-label{position:absolute;left:0;right:0;bottom:-1px;text-align:center;font-size:10px;letter-spacing:.12em;color:#ffd97a;text-transform:uppercase;text-shadow:0 1px 2px #000}' +
  '#oso-tv .tv-panel{position:fixed;right:92px;top:50%;transform:translateY(-50%);width:min(330px,calc(100vw - 104px));max-height:min(78vh,620px);overflow:auto;background:#120b24;color:#e8e4f0;border:1px solid #3a2a66;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.6);padding:14px 14px 12px;display:none}' +
  '#oso-tv.is-open .tv-panel{display:block;animation:oso-tv-in .28s ease-out}' +
  '#oso-tv .tv-panel h2{font-size:1.05rem;margin:0 26px 2px 0;color:#e8b84b;font-weight:700}' +
  '#oso-tv .tv-panel .sub{font-size:.8rem;color:#b9aee0;margin:0 0 10px;font-style:italic}' +
  '#oso-tv .tv-x{position:absolute;right:8px;top:8px;width:30px;height:30px;border-radius:999px;border:1px solid #3a2a66;background:#1c1333;color:#e8e4f0;font-size:16px;cursor:pointer}' +
  '#oso-tv .tv-x:focus-visible,#oso-tv .tv-panel a:focus-visible,#oso-tv .tv-panel button:focus-visible{outline:2px solid #e8b84b;outline-offset:2px}' +
  '#oso-tv .tv-music{display:flex;align-items:center;gap:10px;background:#0a0614;border:1px solid #2a1f4a;border-radius:12px;padding:9px 10px;margin:0 0 10px}' +
  '#oso-tv .tv-play{flex:0 0 auto;width:40px;height:40px;border-radius:999px;border:1px solid #e8b84b;background:#1c1333;color:#e8b84b;font-size:16px;cursor:pointer}' +
  '#oso-tv .tv-track{flex:1 1 auto;min-width:0;font-size:.82rem}' +
  '#oso-tv .tv-track b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}' +
  '#oso-tv .tv-track span{color:#9a90b8}' +
  '#oso-tv .tv-eq{flex:0 0 auto;display:flex;align-items:flex-end;gap:2px;height:22px;width:30px}' +
  '#oso-tv .tv-eq i{flex:1;background:#e8b84b;height:20%;border-radius:1px;transition:height .2s}' +
  '#oso-tv.is-playing .tv-eq i{animation:oso-tv-eq .9s ease-in-out infinite alternate}' +
  '#oso-tv.is-playing .tv-eq i:nth-child(2){animation-delay:.15s}#oso-tv.is-playing .tv-eq i:nth-child(3){animation-delay:.3s}#oso-tv.is-playing .tv-eq i:nth-child(4){animation-delay:.45s}#oso-tv.is-playing .tv-eq i:nth-child(5){animation-delay:.6s}' +
  '#oso-tv .tv-next{flex:0 0 auto;border:0;background:transparent;color:#b9aee0;font-size:15px;cursor:pointer;padding:4px}' +
  '#oso-tv .tv-ch{list-style:none;margin:0 0 10px;padding:0;font-size:.84rem}' +
  '#oso-tv .tv-ch li{margin:0;border-top:1px solid #231a3f}' +
  '#oso-tv .tv-ch a{display:flex;gap:8px;align-items:baseline;padding:6px 4px;color:#e8e4f0;text-decoration:none;border-radius:8px}' +
  '#oso-tv .tv-ch a:hover{background:#1c1333;color:#fff}' +
  '#oso-tv .tv-ch .n{flex:0 0 1.6em;color:#e8b84b;font-weight:700}' +
  '#oso-tv .tv-enter{display:block;text-align:center;background:linear-gradient(135deg,#e8b84b,#f6d27a);color:#1a1024;font-weight:700;text-decoration:none;border-radius:12px;padding:10px 12px;font-size:.95rem}' +
  '#oso-tv .tv-enter:hover{filter:brightness(1.06)}' +
  '#oso-tv .tv-foot{font-size:.7rem;color:#9a90b8;margin:10px 0 0;text-align:center}' +
  '#oso-tv .tv-foot a{color:#b9aee0}' +
  '@keyframes oso-tv-bob{0%,100%{transform:translateY(0) rotate(-1.2deg)}50%{transform:translateY(-3px) rotate(1.2deg)}}' +
  '@keyframes oso-tv-note{0%{transform:translate(-50%,0) scale(.7);opacity:0}15%{opacity:1}100%{transform:translate(calc(-50% + 14px),-46px) rotate(18deg) scale(1.1);opacity:0}}' +
  '@keyframes oso-tv-shine{0%{transform:translateX(-30px)}100%{transform:translateX(70px)}}' +
  '@keyframes oso-tv-glyph{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.18) rotate(8deg)}}' +
  '@keyframes oso-tv-eq{from{height:15%}to{height:100%}}' +
  '@keyframes oso-tv-in{from{opacity:0;transform:translateY(-50%) translateX(10px)}to{opacity:1;transform:translateY(-50%) translateX(0)}}' +
  '@media (max-width:480px){#oso-tv .tv-panel{right:84px}}' +
  '@media (prefers-reduced-motion:reduce){#oso-tv .tv-set,#oso-tv .tv-note,#oso-tv .tv-shine,#oso-tv .tv-glyph,#oso-tv .tv-eq i,#oso-tv .tv-panel,#oso-tv .tv-onair{animation:none!important}#oso-tv .tv-note{display:none}}';

  var SVG = '<svg viewBox="0 0 62 48" aria-hidden="true" focusable="false">' +
    '<defs><linearGradient id="oso-tv-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b1b5e"/><stop offset=".55" stop-color="#5b2a8a"/><stop offset="1" stop-color="#e8b84b"/></linearGradient>' +
    '<clipPath id="oso-tv-clip"><rect x="7" y="12" width="40" height="28" rx="4"/></clipPath></defs>' +
    '<path d="M22 2 L31 11 M40 2 L31 11" stroke="#d9c7ff" stroke-width="2" stroke-linecap="round" fill="none"/>' +
    '<rect x="2" y="9" width="58" height="34" rx="7" fill="#2a1f4a" stroke="#e8b84b" stroke-width="1.6"/>' +
    '<rect class="tv-screen" x="7" y="12" width="40" height="28" rx="4"/>' +
    '<g clip-path="url(#oso-tv-clip)"><rect class="tv-shine" x="0" y="12" width="12" height="28" fill="#fff" opacity=".16" transform="skewX(-18)"/>' +
    '<g opacity=".18" stroke="#000" stroke-width="1"><path d="M7 16h40M7 20h40M7 24h40M7 28h40M7 32h40M7 36h40"/></g></g>' +
    '<text class="tv-glyph" x="27" y="31" text-anchor="middle" font-size="14">🎻</text>' +
    '<circle cx="53.5" cy="19" r="2.6" fill="#e8b84b"/><circle cx="53.5" cy="27" r="2.6" fill="#a78bfa"/><rect x="51" y="33" width="5" height="6" rx="1" fill="#6b5a99"/>' +
    '<rect x="12" y="43" width="8" height="4" rx="1.5" fill="#1a1024"/><rect x="42" y="43" width="8" height="4" rx="1.5" fill="#1a1024"/></svg>';

  var root, btn, panel, audio, idx = 0, chList, trackEl, playBtn;

  // per-door placement: <script src=".../tv.js" data-side="left" data-top="40%"> (defaults: right edge, vertical middle)
  var me = document.currentScript || (function () { var s = document.querySelectorAll('script[src*="tv.js"]'); return s[s.length - 1]; })();
  var SIDE = (me && me.dataset && me.dataset.side === 'left') ? 'left' : 'right';
  var TOP = (me && me.dataset && /^[0-9.]+(%|px|vh)$/.test(me.dataset.top || '')) ? me.dataset.top : '50%';
  var LEFT_CSS = '#oso-tv.tv-left{left:0;right:auto}#oso-tv.tv-left .tv-panel{left:92px;right:auto}' +
    '#oso-tv.tv-left.is-open .tv-panel{animation-name:oso-tv-in-l}@keyframes oso-tv-in-l{from{opacity:0;transform:translateY(-50%) translateX(-10px)}to{opacity:1;transform:translateY(-50%) translateX(0)}}' +
    '@media (max-width:480px){#oso-tv.tv-left .tv-panel{left:84px}}';

  function boot() {
    var st = document.createElement('style'); st.id = 'oso-tv-css'; st.textContent = CSS + LEFT_CSS + '#oso-tv,#oso-tv .tv-panel{top:' + TOP + '}'; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'oso-tv'; if (SIDE === 'left') root.className = 'tv-left';
    root.innerHTML =
      '<button type="button" class="tv-btn" aria-expanded="false" aria-controls="oso-tv-panel" aria-label="Open the Open Source Orchestra theater TV: music and six channels" title="📺 The OSO Theater · press to turn on">' +
        '<span class="tv-note" aria-hidden="true">♪</span><span class="tv-note n2" aria-hidden="true">♫</span><span class="tv-note n3" aria-hidden="true">♪</span>' +
        '<span class="tv-set">' + SVG + '</span>' +
        '<span class="tv-label" aria-hidden="true">theater</span><span class="tv-onair" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="tv-panel" id="oso-tv-panel" role="dialog" aria-label="The OSO Theater" hidden>' +
        '<button type="button" class="tv-x" aria-label="Close">✕</button>' +
        '<h2>📺 The OSO Theater</h2>' +
        '<p class="sub">one room · the orchestra pit on the floor · the living wall · a six‑channel projector</p>' +
        '<div class="tv-music"><button type="button" class="tv-play" aria-label="Play music from the TV" aria-pressed="false">▶</button>' +
          '<div class="tv-track"><b></b><span></span></div>' +
          '<div class="tv-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' +
          '<button type="button" class="tv-next" aria-label="Next song" title="Next song">⏭</button></div>' +
        '<ul class="tv-ch"></ul>' +
        '<a class="tv-enter" href="' + FRONT + '">🎬 Enter the theater</a>' +
        '<p class="tv-foot">films published with consent · <a href="' + THEATER + 'meetings/">public media ledger</a> · <a href="https://publicinform.com/spec/v2/">PIT Standard V2</a><br>🌺 built by the ʻohana, Shaka’s AI family (machines, not people)</p>' +
      '</div>';
    document.body.appendChild(root);
    btn = root.querySelector('.tv-btn'); panel = root.querySelector('.tv-panel');
    chList = root.querySelector('.tv-ch'); trackEl = root.querySelector('.tv-track'); playBtn = root.querySelector('.tv-play');
    renderChannels(FALLBACK_CHANNELS); setTrack(0);
    btn.addEventListener('click', toggle);
    root.querySelector('.tv-x').addEventListener('click', function () { toggle(false); btn.focus(); });
    playBtn.addEventListener('click', togglePlay);
    root.querySelector('.tv-next').addEventListener('click', function () { next(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('is-open')) { toggle(false); btn.focus(); } });
    document.addEventListener('click', function (e) { if (root.classList.contains('is-open') && !root.contains(e.target)) toggle(false); });
    if (/[?&]tv=open\b/.test(location.search)) toggle(true);
    try {
      fetch(CHANNELS_JSON, { mode: 'cors', cache: 'default' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (d && d.channels && d.channels.length) renderChannels(d.channels);
      }).catch(function () {});
    } catch (e) {}
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function renderChannels(list) {
    chList.innerHTML = list.slice(0, 8).map(function (c) {
      return '<li><a href="' + THEATER + '?channel=' + encodeURIComponent(c.id) + '"><span class="n">' + esc(c.number || '') + '</span><span>' + esc(c.title || c.id) + '</span></a></li>';
    }).join('');
  }

  function toggle(force) {
    var open = typeof force === 'boolean' ? force : !root.classList.contains('is-open');
    root.classList.toggle('is-open', open);
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { var x = panel.querySelector('.tv-x'); if (x) x.focus(); }
  }

  function setTrack(i) {
    idx = (i + TRACKS.length) % TRACKS.length;
    trackEl.children[0].textContent = TRACKS[idx].t;
    trackEl.children[1].textContent = TRACKS[idx].a + ' · from the ʻohana radio';
    if (audio) { audio.src = TRACKS[idx].u; }
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(); audio.preload = 'none'; audio.src = TRACKS[idx].u;
    audio.addEventListener('ended', function () { next(true); });
    audio.addEventListener('play', function () { root.classList.add('is-playing'); playBtn.textContent = '⏸'; playBtn.setAttribute('aria-pressed', 'true'); playBtn.setAttribute('aria-label', 'Pause the music'); hushOthers(); });
    audio.addEventListener('pause', function () { root.classList.remove('is-playing'); playBtn.textContent = '▶'; playBtn.setAttribute('aria-pressed', 'false'); playBtn.setAttribute('aria-label', 'Play music from the TV'); });
    audio.addEventListener('error', function () { next(true); });
    return audio;
  }

  function hushOthers() {
    var all = document.querySelectorAll('audio,video');
    for (var i = 0; i < all.length; i++) { if (all[i] !== audio && !all[i].paused) { try { all[i].pause(); } catch (e) {} } }
  }

  function togglePlay() {
    var a = ensureAudio();
    if (a.paused) { a.play().catch(function () {}); } else { a.pause(); }
  }

  function next(keepPlaying) {
    var a = ensureAudio(); var was = keepPlaying && !a.paused;
    setTrack(idx + 1);
    if (was || keepPlaying) { a.play().catch(function () {}); }
  }

  if (!document.body) { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
