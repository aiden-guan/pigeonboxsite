import { initGmailDemo } from './gmail-demo.js?v=2';
import { mountMurmuration } from './murmuration.js?v=3';
import { mountQuadReveal } from './reveal.js?v=1';
import { mountFlapboard } from './flapboard.js?v=3';
import { mountEnvelope, mountPlane } from './origami.js?v=1';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);

initGmailDemo();

const hero = $('[data-hero]');
if (hero) {
  mountMurmuration({
    host: hero,
    field: $('[data-flock]', hero),
    overlay: $('[data-flock-overlay]', hero),
    stage: $('[data-hero-stage]', hero),
  });
}

const viewport = $('[data-demo-viewport]');
if (viewport) mountQuadReveal(viewport);

const board = $('[data-board]');
if (board) mountFlapboard(board);
const clock = $('[data-board-clock]');
if (clock) {
  const tick = () => { clock.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  tick();
  setInterval(tick, 20000);
}

const envelope = $('[data-envelope]');
if (envelope) mountEnvelope(envelope);
const plane = $('[data-plane]');
if (plane) mountPlane(plane);

/* ---------- Scroll-bound print, redaction and stamp ---------- */

const plates = $$('[data-plate]');
const memo = $('[data-memo]');
let ticking = false;

function onScroll() {
  ticking = false;
  const vh = innerHeight;
  if (reduce.matches) {
    plates.forEach((plate) => { plate.style.removeProperty('--p'); plate.style.removeProperty('--mis'); });
    if (memo) { memo.style.removeProperty('--r'); memo.classList.add('is-stamped'); }
    return;
  }
  // Each sheet sorts itself and comes into register as it rises through the view.
  plates.forEach((plate) => {
    const top = plate.getBoundingClientRect().top;
    const p = smooth(clamp((vh * 0.95 - top) / (vh * 0.6)));
    plate.style.setProperty('--p', p.toFixed(3));
    plate.style.setProperty('--mis', (1 - p).toFixed(3));
  });
  if (memo) {
    const top = memo.getBoundingClientRect().top;
    const r = clamp((vh * 0.85 - top) / (vh * 0.5));
    memo.style.setProperty('--r', r.toFixed(3));
    if (r >= 1) memo.classList.add('is-stamped');
  }
}
const requestScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
addEventListener('scroll', requestScroll, { passive: true });
addEventListener('resize', requestScroll);
reduce.addEventListener('change', requestScroll);
onScroll();

/* ---------- The receipt prints once it's in view ---------- */

const printer = $('[data-printer]');
if (printer) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    printer.classList.add('is-printing');
  }, { threshold: 0.3 });
  io.observe(printer);
}
