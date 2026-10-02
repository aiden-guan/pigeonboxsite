// Ties native scrolling to the flight: each perch section holds the pigeon on
// a landmark while its card is shown; the sections between are flight legs.
import { initDemos } from './demos.js';

const root = document.documentElement;
const stops = [...document.querySelectorAll('[data-stop]')];
const legs = [...document.querySelectorAll('[data-leg]')];
const demos = initDemos();
const PLACES = ['The Rooftop', 'The Clock Tower', 'The Old Windmill', 'Gull Point Lighthouse', 'The Sand Pyramid', 'Cairn Summit', 'Home'];

function staticMode() {
  root.classList.remove('journey-3d');
  root.classList.add('journey-static');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const demo = demos.get(entry.target);
      if (!demo) continue;
      if (entry.isIntersecting) demo.start(); else demo.stop();
    }
  }, { threshold: 0.45 });
  stops.forEach((s) => io.observe(s));
}

async function flightMode() {
  const canvas = document.getElementById('world');
  const loaderBar = document.querySelector('.loader-bar');
  const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const { createWorld } = await import('./world.js');
  const world = await createWorld(canvas, { mobile, onProgress: (p) => loaderBar?.style.setProperty('--p', String(p)) });

  // Scroll → timeline keyframes. T = 2k is "landed on stop k", 2k+1 "leaving".
  let keys = [];
  let holds = [];
  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  function computeKeys() {
    const vh = window.innerHeight;
    keys = [];
    holds = [];
    stops.forEach((el, k) => {
      const top = docTop(el), h = el.offsetHeight;
      let a, b;
      if (k === 0) { a = 0; b = vh * 0.18; }
      else if (k === stops.length - 1) { a = top - vh * 0.1; b = Math.max(a + 1, document.documentElement.scrollHeight - vh); }
      else { a = top - vh * 0.1; b = top + h - vh + vh * 0.1; }
      keys.push([a, 2 * k], [b, 2 * k + 1]);
      holds.push([a, b]);
    });
  }
  function timelineAt(y) {
    if (y <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [y1, t1] = keys[i];
      if (y <= y1) {
        const [y0, t0] = keys[i - 1];
        return t0 + ((y - y0) / Math.max(1, y1 - y0)) * (t1 - t0);
      }
    }
    return keys[keys.length - 1][1];
  }
  computeKeys();
  const onScroll = () => world.setTarget(timelineAt(window.scrollY));
  window.addEventListener('scroll', onScroll, { passive: true });
  world.setTarget(timelineAt(window.scrollY), true);

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    world.resize();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { computeKeys(); onScroll(); }, 120);
  });
  document.addEventListener('visibilitychange', () => (document.hidden ? world.pause() : world.resume()));

  // Route rail.
  const routeLinks = [...document.querySelectorAll('[data-go]')];
  const routeFill = document.querySelector('.route');
  routeLinks.forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    const k = Number(link.dataset.go);
    const [a, b] = holds[k];
    window.scrollTo({ top: k === 0 ? 0 : a + (b - a) * 0.35, behavior: 'smooth' });
  }));
  // Keyboard users: focusing inside a card flies there.
  stops.forEach((el, k) => el.addEventListener('focusin', () => {
    if (el.classList.contains('is-active')) return;
    const [a, b] = holds[k];
    window.scrollTo({ top: k === 0 ? 0 : a + (b - a) * 0.35 });
  }));

  // HUD + card activation driven by the rendered (smoothed) timeline.
  const heroCopy = document.querySelector('.hero-copy');
  const heroStage = document.querySelector('.stop-hero .stage');
  const logTime = document.querySelector('.log-time'), logAlt = document.querySelector('.log-alt'), logDist = document.querySelector('.log-dist'), logPlace = document.querySelector('.log-place');
  const tether = document.querySelector('.tether');
  const tetherLine = tether.querySelector('.tether-line'), tetherRing = tether.querySelector('.tether-ring'), tetherDot = tether.querySelector('.tether-dot');
  let active = -1, activeLeg = -1, lastHud = 0, dusk = false;
  const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

  world.onFrame((out, state) => {
    const T = state.T;
    // Hero copy fades as the pigeon takes off.
    const heroFade = Math.min(1, Math.max(0, (T - 0.7) / 0.6));
    heroStage.style.setProperty('--hero-o', String(1 - heroFade));
    heroStage.style.setProperty('--hero-y', String(-heroFade * 40));
    heroCopy.inert = heroFade > 0.9;

    let now = -1;
    for (let k = 1; k < stops.length; k++) if (T > 2 * k - 0.08 && T < 2 * k + 1.06) now = k;
    if (T >= 2 * (stops.length - 1) - 0.08) now = stops.length - 1;
    if (now !== active) {
      if (active > 0) { stops[active].classList.remove('is-active'); demos.get(stops[active])?.stop(); }
      if (now > 0) { stops[now].classList.add('is-active'); demos.get(stops[now])?.start(); }
      active = now;
    }
    let leg = -1;
    if (out.leg >= 0 && out.legFrac > 0.18 && out.legFrac < 0.78) leg = out.leg;
    if (leg !== activeLeg) {
      if (activeLeg >= 0) legs[activeLeg].classList.remove('is-active');
      if (leg >= 0) legs[leg].classList.add('is-active');
      activeLeg = leg;
    }
    root.classList.toggle('card-open', active > 0);
    root.classList.toggle('at-hero', T < 0.9);
    const isDusk = T > 10.5;
    if (isDusk !== dusk) { root.classList.toggle('is-dusk', isDusk); dusk = isDusk; }

    // Tether: from the perched pigeon to the nearest edge of the open card.
    if (active > 0 && out.screen.visible) {
      const card = stops[active].querySelector('.card').getBoundingClientRect();
      const px = out.screen.x, py = out.screen.y - 10;
      let cx, cy;
      if (state.aspect < 0.85) { cx = Math.min(Math.max(px, card.left + 40), card.right - 40); cy = card.top; }
      else if (card.left > px) { cx = card.left; cy = Math.min(Math.max(py, card.top + 60), card.bottom - 60); }
      else { cx = card.right; cy = Math.min(Math.max(py, card.top + 60), card.bottom - 60); }
      const sx = px + (cx - px) * 0.08, sy = py + (cy - py) * 0.08;
      const mx = (sx + cx) / 2, my = Math.min(sy, cy) - 40;
      tetherLine.setAttribute('d', `M${sx.toFixed(1)},${sy.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`);
      for (const c of [tetherRing, tetherDot]) { c.setAttribute('cx', px.toFixed(1)); c.setAttribute('cy', py.toFixed(1)); }
      tether.classList.add('is-on');
    } else {
      tether.classList.remove('is-on');
    }

    const t = performance.now();
    if (t - lastHud > 90) {
      lastHud = t;
      logTime.textContent = fmt(out.minutes);
      logAlt.textContent = String(Math.round(out.altitude));
      logDist.textContent = (out.distanceM / 1000).toFixed(1);
      logPlace.textContent = out.perched ? PLACES[out.stop] : `En route to ${PLACES[out.stop + 1].replace(/^The /, '')}`;
      const progress = T / (2 * stops.length - 2);
      routeFill.style.setProperty('--route', String(Math.min(1, progress)));
      routeLinks.forEach((link, k) => {
        link.classList.toggle('is-done', T >= 2 * k);
        link.classList.toggle('is-current', out.perched && out.stop === k);
      });
    }
  });

  world.start();
  root.classList.add('world-ready');
  if (new URLSearchParams(location.search).has('debug')) {
    window.__pb = { world, holds: () => holds, keys: () => keys };
    const { mountDebug } = await import('./debug.js');
    mountDebug(world);
  }
}

if (root.classList.contains('journey-3d')) {
  flightMode().catch((error) => {
    console.error(error);
    staticMode();
  });
} else {
  staticMode();
}
