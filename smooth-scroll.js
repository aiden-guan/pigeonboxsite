// Eased mouse-wheel scrolling for the page. Touch, keyboard, scrollbar and
// anchor scrolling stay native (anchors already ease via CSS scroll-behavior).
// Off under prefers-reduced-motion, and wheel input over anything that can
// scroll on its own (palette list, terminal log, dialogs) is left alone.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
const EASE = 0.14; // share of the remaining distance covered per 60fps frame
const LINE = 16;

let target = 0;
let current = 0;
let written = 0;
let frame = 0;
let last = 0;

function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
}

function maxScroll() {
  return Math.max(0, root.scrollHeight - innerHeight);
}

function step(now) {
  // Something else moved the page (keyboard, scrollbar, anchor): yield to it.
  if (Math.abs(scrollY - written) > 1) { stop(); return; }
  const dt = Math.min(64, now - (last || now - 16.7));
  last = now;
  current += (target - current) * (1 - Math.pow(1 - EASE, dt / 16.7));
  if (Math.abs(target - current) < 0.5) current = target;
  window.scrollTo({ top: current, behavior: 'instant' });
  written = scrollY;
  frame = current === target ? 0 : requestAnimationFrame(step);
}

function scrollsItself(node, dy) {
  for (; node && node !== document.body && node !== root; node = node.parentElement) {
    if (node.scrollHeight <= node.clientHeight) continue;
    const overflow = getComputedStyle(node).overflowY;
    if (overflow !== 'auto' && overflow !== 'scroll') continue;
    if (dy < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
  }
  return false;
}

function onWheel(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  if (document.querySelector('dialog[open], .palette:not([hidden])')) return;
  const dy = event.deltaY * (event.deltaMode === 1 ? LINE : event.deltaMode === 2 ? innerHeight : 1);
  if (!dy || scrollsItself(event.target, dy)) return;
  event.preventDefault();
  if (!frame) { current = target = written = scrollY; last = 0; }
  target = Math.max(0, Math.min(maxScroll(), target + dy));
  if (!frame) frame = requestAnimationFrame(step);
}

function sync() {
  stop();
  if (reduceMotion.matches) removeEventListener('wheel', onWheel);
  else addEventListener('wheel', onWheel, { passive: false });
}

reduceMotion.addEventListener('change', sync);
// Keys, clicks and touches start their own (often smooth) scrolls; writing
// over them mid-flight would cancel them, so hand control back first.
for (const type of ['keydown', 'pointerdown', 'touchstart']) addEventListener(type, stop, { passive: true, capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
sync();
