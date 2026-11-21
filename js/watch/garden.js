/* OSO PIT THEATER v3 · the Memory Garden · GPL-3.0 · built by the ʻohana (machines, labelled as machines).
   The SVG garden is generated statically; this only adds hover/click focus and a gentle sway (not under reduced motion). */
import { $, $$, reducedMotion } from './common.js';

const plants = $$('.seed-plant[data-seed]');
const cards = Object.fromEntries($$('.seed[id]').map((card) => [card.id, card]));
let active = null;

function focusSeed(id, scroll = true) {
  if (active && cards[active]) cards[active].classList.remove('on');
  plants.forEach((p) => p.classList.toggle('on', p.dataset.seed === id));
  active = id;
  const card = cards[id];
  if (!card) return;
  card.classList.add('on');
  if (scroll) card.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

plants.forEach((plant, i) => {
  if (!reducedMotion()) { plant.classList.add('sway'); plant.style.animationDelay = `${(i * 0.7) % 6}s`; }
  plant.addEventListener('click', () => focusSeed(plant.dataset.seed));
  plant.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focusSeed(plant.dataset.seed); } });
  plant.addEventListener('mouseenter', () => focusSeed(plant.dataset.seed, false));
});
Object.values(cards).forEach((card) => card.addEventListener('mouseenter', () => focusSeed(card.id, false)));

const hash = location.hash.replace('#', '');
if (hash && cards[hash]) focusSeed(hash);
const count = $('.garden-count b');
if (count) count.textContent = String(plants.length);
