import { initGmailDemo } from './gmail-demo.js?v=2';
// Homepage interactions for the Gmail walkthrough and data-flow diagram.
import { initFlow } from '/flow.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

function animateIn(node, cls = 'is-entering', ms = 440) {
  if (reduced() || !node) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), ms);
}

/* ---------------- B. Workflow route ---------------- */

function initRoute() {
  const route = $('[data-route]');
  if (!route) return;
  const stops = $$('[role="tab"]', route);
  const panels = stops.map((s) => document.getElementById(s.getAttribute('aria-controls')));
  const dwell = 4200;
  route.style.setProperty('--dwell', `${dwell}ms`);
  let current = 0;
  let timer = null;

  const set = (i, { focus = false, user = false } = {}) => {
    if (user) stopAuto();
    current = i;
    stops.forEach((s, n) => {
      const on = n === i;
      s.setAttribute('aria-selected', String(on));
      s.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p, n) => { p.hidden = n !== i; });
    animateIn(panels[i], 'is-entering', 460);
    if (focus) stops[i].focus();
  };
  const stopAuto = () => { clearTimeout(timer); timer = null; route.classList.remove('is-auto'); };

  stops.forEach((s, i) => {
    s.addEventListener('click', () => set(i, { user: true }));
    s.addEventListener('keydown', (event) => {
      let n = null;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') n = (i + 1) % stops.length;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') n = (i - 1 + stops.length) % stops.length;
      else if (event.key === 'Home') n = 0;
      else if (event.key === 'End') n = stops.length - 1;
      if (n === null) return;
      event.preventDefault();
      set(n, { focus: true, user: true });
    });
  });
  route.addEventListener('pointerdown', stopAuto);
  route.addEventListener('focusin', stopAuto);

  set(0);
  // Touch readers choose a stage; automatic changes can move the page mid-scroll.
  if (reduced() || matchMedia('(pointer: coarse)').matches || !('IntersectionObserver' in window)) return;
  const advance = () => {
    if (current >= stops.length - 1) { stopAuto(); return; }
    set(current + 1);
    // Restart the progress fill on the newly active stage.
    route.classList.remove('is-auto'); void route.offsetWidth; route.classList.add('is-auto');
    timer = setTimeout(advance, dwell);
  };
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    // Walk the stages once, then hand control to the reader.
    route.classList.add('is-auto');
    timer = setTimeout(advance, dwell);
  }, { threshold: 0.45 });
  io.observe(route);
}

/* ---------------- E. Cloud status clock ---------------- */

function initCityClock() {
  const clock = $('[data-city-clock]');
  if (!clock) return;
  const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  const tick = () => { clock.textContent = `Local time ${fmt.format(new Date())}`; };
  tick();
  setInterval(tick, 30_000);
}

initGmailDemo();
initRoute();
initCityClock();
initFlow();
