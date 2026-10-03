import { initGmailDemo } from './gmail-demo.js';
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
  const bird = $('[data-route-bird]', route);
  const sprite = $('.pidgy', bird);
  const path = $('.route-path', route);
  const states = ['idle', 'route', 'search', 'draft', 'alert'];
  let current = 0;
  let timer = null;

  const set = (i, { focus = false, user = false } = {}) => {
    if (user) stopAuto();
    const prev = current;
    current = i;
    route.style.setProperty('--stop', String(i));
    // The copper route fills up to the current stop (4 equal hops).
    path.style.strokeDashoffset = String(1 - i / (stops.length - 1));
    stops.forEach((s, n) => {
      const on = n === i;
      s.setAttribute('aria-selected', String(on));
      s.tabIndex = on ? 0 : -1;
      s.classList.toggle('is-passed', n < i);
    });
    panels.forEach((p, n) => { p.hidden = n !== i; });
    animateIn(panels[i], 'is-entering', 520);
    sprite.dataset.state = states[i];
    if (prev !== i && !reduced()) {
      sprite.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-16px)' }, { transform: 'translateY(0)' }], { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    if (focus) stops[i].focus();
  };
  const stopAuto = () => { clearInterval(timer); timer = null; };

  stops.forEach((s, i) => {
    s.addEventListener('click', () => set(i, { user: true }));
    s.addEventListener('keydown', (event) => {
      let n = null;
      if (event.key === 'ArrowRight') n = (i + 1) % stops.length;
      else if (event.key === 'ArrowLeft') n = (i - 1 + stops.length) % stops.length;
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
  // Touch readers choose a stop; automatic panel changes can move the page mid-scroll.
  if (reduced() || matchMedia('(pointer: coarse)').matches || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) { stopAuto(); return; }
    io.disconnect();
    // Fly the route once, then hand control to the reader.
    let i = 0;
    timer = setInterval(() => {
      i += 1;
      if (i >= stops.length) { stopAuto(); return; }
      set(i);
    }, 1700);
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
