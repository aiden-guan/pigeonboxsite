import { layoutFeatureOrbit } from '/pricing-orbit.js?v=1';
import { initFeatureIcons } from '/pricing-icons.js?v=1';

const stage = document.querySelector('[data-cloud-stage]');
const cloud = document.querySelector('[data-cloud-hover]');
const trigger = document.querySelector('[data-cloud-trigger]');
const world = document.querySelector('.cloud-art');
const list = document.querySelector('.cloud-orbit-list');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

if (stage && cloud && trigger && world && list) {
  let open = false, hoverBlocked = false, hoverOpened = false, hoverTimer, leaveTimer;
  let intro = [];
  const art = initCloudArt(document.querySelector('[data-cloud-art]'));
  const orbit = initFeatureOrbit(world, list, art);
  const icons = initFeatureIcons(list, reducedMotion, finePointer);
  const hint = trigger.querySelector('.cloud-trigger-hint');
  const closedHint = () => finePointer.matches ? 'Hover to explore' : 'Tap to explore';

  function frameCloud(motion) {
    if (!open) return;
    const card = cloud.getBoundingClientRect();
    const header = document.querySelector('.site-header').getBoundingClientRect().height;
    if (card.top < header + 8 || card.bottom > innerHeight - 8) {
      window.scrollTo({ top: scrollY + card.top - header - 16, behavior: motion ? 'smooth' : 'instant' });
    }
  }

  function setOpen(next, { animate = true, fromHover = false } = {}) {
    if (open === next) return;
    const before = cloud.getBoundingClientRect();
    const cloudStart = art?.capture();
    intro.forEach(animation => animation.cancel());
    intro = [];
    open = next;
    hoverOpened = fromHover;
    if (!next) {
      hoverBlocked = cloud.matches(':hover');
      if (cloud.contains(document.activeElement) && document.activeElement !== trigger) trigger.focus({ preventScroll: true });
    }
    const motion = animate && !reducedMotion.matches;
    stage.classList.toggle('is-instant', !motion);
    stage.dataset.open = String(next);
    cloud.classList.toggle('is-expanded', next);
    trigger.setAttribute('aria-expanded', String(next));
    hint.textContent = next ? 'Cloud features' : closedHint();
    list.hidden = !next;
    list.inert = !next;
    if (!next) icons.stop();
    orbit.setOpen(next, motion);
    if (art) art.moveFrom(cloudStart, next && motion, next ? orbit.reveal : null);
    else if (next) orbit.reveal();
    if (!next) {
      if (motion) intro.push(cloud.querySelector('.cloud-plan').animate([
        { opacity: .85, transform: 'translateX(-8px)' },
        { opacity: 1, transform: 'translateX(0)' },
      ], { duration: 180, easing: 'cubic-bezier(.16,1,.3,1)' }));
      return;
    }
    const after = cloud.getBoundingClientRect();
    if (motion) {
      const leftInset = Math.max(0, before.left - after.left);
      intro.push(cloud.querySelector('.cloud-plan').animate([
        { clipPath: `inset(0 0 0 ${leftInset}px round 8px)` },
        { clipPath: 'inset(0 0 0 0 round 8px)' },
      ], { duration: 650, easing: 'cubic-bezier(.22,.8,.25,1)' }));
      art?.burst();
    }
    // Frame the expanded card once; the artwork and all feature labels stay inside it.
    requestAnimationFrame(() => frameCloud(motion));
  }

  stage.classList.add('is-ready');
  stage.dataset.open = 'false';
  list.hidden = true;
  list.inert = true;
  trigger.setAttribute('aria-expanded', 'false');
  hint.textContent = closedHint();
  cloud.addEventListener('pointerenter', event => {
    clearTimeout(leaveTimer);
    if (finePointer.matches && event.pointerType !== 'touch' && !hoverBlocked) hoverTimer = setTimeout(() => setOpen(true, { fromHover: true }), 80);
  });
  cloud.addEventListener('pointerleave', event => {
    clearTimeout(hoverTimer);
    hoverBlocked = false;
    hoverOpened = false;
    if (finePointer.matches && event.pointerType !== 'touch') leaveTimer = setTimeout(() => setOpen(false), 100);
  });
  trigger.addEventListener('click', event => {
    clearTimeout(hoverTimer);
    if (hoverOpened && event.detail > 0) { hoverOpened = false; return; }
    setOpen(!open, { animate: event.detail !== 0 });
  });
  cloud.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false, { animate: false }); }
  });
  finePointer.addEventListener('change', () => { if (!open) hint.textContent = closedHint(); });
  reducedMotion.addEventListener('change', () => { intro.forEach(animation => animation.cancel()); orbit.refresh(); });
  let viewportWidth = innerWidth;
  window.addEventListener('resize', () => {
    // Reframe after rotation or a width breakpoint; browser chrome height changes
    // should not interrupt someone scrolling through a short-screen orbit.
    if (innerWidth === viewportWidth) return;
    viewportWidth = innerWidth;
    requestAnimationFrame(() => frameCloud(false));
  });
}

function initFeatureOrbit(world, list, art) {
  const nodes = [...list.querySelectorAll('.orbit-feature')];
  let width = 1, height = 1, sizes = [];
  let active = false, visible = false, held = false;
  let frame = 0, elapsed = 0, previous = 0, opening = -Infinity;
  let animateEntry = false;
  function measure() {
    const box = world.getBoundingClientRect();
    width = box.width; height = box.height;
    sizes = nodes.map(node => ({ w: node.offsetWidth, h: node.offsetHeight }));
    world.dataset.orbitLayout = width < 950 ? 'single' : 'double';
    world.style.setProperty('--orbit-inset', `${Math.max(width < 950 ? 100 : 170, ...sizes.map(size => size.w)) + 8}px`);
  }
  function draw(now) {
    frame = 0;
    if (!active || !visible || document.hidden) { previous = 0; return; }
    if (previous && !held && !reducedMotion.matches) elapsed += Math.min(40, now - previous);
    previous = now;
    if (!sizes[0]?.w) measure();
    const cx = width / 2, cy = height / 2;
    const positions = layoutFeatureOrbit(width, height, sizes, reducedMotion.matches ? 0 : elapsed / 1000);
    const progress = !animateEntry || reducedMotion.matches ? 1 : Math.min(1, Math.max(0, (now - opening) / 780));
    const release = 1 - (1 - progress) ** 3;
    positions.forEach((p, i) => {
      const x = cx + (p.x - cx) * release - p.w / 2;
      const y = cy + (p.y - cy) * release - p.h / 2;
      nodes[i].style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
      nodes[i].style.opacity = String(Math.min(1, progress * 3));
    });
    world.dataset.orbitPaused = String(held || reducedMotion.matches);
    if (!reducedMotion.matches && ((!held) || progress < 1)) frame = requestAnimationFrame(draw);
  }
  function refresh() {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    if (active && reducedMotion.matches) list.inert = false;
    art?.setPaused(held);
    if (active && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  const geometryObserver = new ResizeObserver(() => { measure(); refresh(); });
  geometryObserver.observe(world);
  nodes.forEach(node => geometryObserver.observe(node));
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refresh(); }).observe(world);
  document.addEventListener('visibilitychange', refresh);
  nodes.forEach(node => {
    node.addEventListener('pointerenter', () => { held = true; refresh(); });
    node.addEventListener('pointerleave', () => { held = list.contains(document.activeElement); refresh(); });
  });
  list.addEventListener('focusin', () => { held = true; refresh(); });
  list.addEventListener('focusout', event => { held = list.contains(event.relatedTarget); refresh(); });
  reducedMotion.addEventListener('change', refresh);
  return {
    setOpen(next, motion) {
      held = false; active = next; animateEntry = motion;
      opening = motion ? Infinity : performance.now();
      if (next && motion) {
        list.inert = true;
        nodes.forEach(node => { node.style.opacity = '0'; });
      }
      measure(); refresh();
    },
    reveal() { if (active) { opening = performance.now(); list.inert = false; } },
    refresh,
  };
}

function initCloudArt(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let width = 1, height = 1, frame = 0, visible = false, burstStart = -Infinity;
  let elapsed = 0, lastTime = 0, paused = false;
  let travel = null, paintedGeometry = null;
  const points = [];
  // A sculpted cloud made from a union of ellipsoids, rendered as halftone dots.
  const lobes = [
    [-.29, .08, .23, .23, .07], [-.12, -.03, .25, .32, .14],
    [.08, -.10, .28, .36, .2], [.30, .07, .23, .23, .04],
    [.01, .17, .37, .16, .09],
  ];
  for (let y = -.48; y < .38; y += .014) {
    for (let x = -.58; x < .58; x += .013) {
      let z = -1;
      for (const [cx, cy, rx, ry, depth] of lobes) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d < 1) z = Math.max(z, Math.sqrt(1 - d) * .25 + depth);
      }
      if (z < 0) continue;
      const seed = Math.sin(x * 183.4 + y * 371.7) * 43758.5453;
      const noise = seed - Math.floor(seed);
      // Lighting and dot texture are fixed; calculate them once, not every frame.
      const light = Math.min(1, Math.max(.13, z * 1.8 - y * .7 - x * .23));
      const copper = y > .11 || z < .2;
      points.push({
        x, y, z, waveSin: Math.sin(x * 4), waveCos: Math.cos(x * 4),
        color: copper ? `rgba(224,122,82,${light * .85})` : `rgba(235,225,209,${light * (.65 + noise * .3)})`,
        radius: (.7 + light * .86 + noise * .25) / 410,
      });
    }
  }
  const stars = Array.from({ length: 48 }, (_, i) => ({
    x: ((i * 73.17) % 101) / 101,
    y: ((i * 31.73) % 97) / 97,
    r: i % 9 === 0 ? 1.25 : .6,
  }));

  function draw(now) {
    frame = 0;
    if (!visible || document.hidden) { lastTime = 0; return; }
    if (lastTime) elapsed += Math.min(now - lastTime, 50);
    lastTime = now;
    ctx.clearRect(0, 0, width, height);
    const t = reducedMotion.matches ? 0 : elapsed / 1000;
    const expanded = canvas.closest('.cloud-column').classList.contains('is-expanded');
    let scale = expanded ? Math.min(290, width * (width < 650 ? .26 : .32), height * .55) : Math.min(width * .83, height * 1.38);
    let cx = width * .5, cy = height * .5;
    if (travel && !reducedMotion.matches) {
      const progress = Math.min(1, Math.max(0, (now - travel.started) / 780));
      const ease = progress * progress * (3 - 2 * progress);
      // Carry the painted cloud through the layout change in page coordinates.
      // This also keeps its path continuous during automatic viewport framing.
      const box = canvas.getBoundingClientRect();
      const fromX = travel.from.x - box.left;
      const fromY = travel.from.y - box.top - scrollY;
      cx = fromX + (cx - fromX) * ease;
      cy = fromY + (cy - fromY) * ease;
      scale = travel.from.scale + (scale - travel.from.scale) * ease;
      if (progress === 1) finishTravel();
    } else if (travel) finishTravel();
    paintedGeometry = { cx, cy, scale };
    for (const star of stars) {
      ctx.fillStyle = `rgba(194,174,156,${.16 + star.r * .09})`;
      ctx.beginPath(); ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2); ctx.fill();
    }
    // Tilted orbital paths give the cloud an editorial, astronomical frame.
    ctx.strokeStyle = 'rgba(184,125,88,.24)'; ctx.lineWidth = .6;
    ctx.beginPath(); ctx.ellipse(cx, cy + scale * .03, scale * .54, scale * .19, -.24, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(184,125,88,.1)';
    ctx.beginPath(); ctx.ellipse(cx, cy, scale * .57, scale * .27, .23, 0, Math.PI * 2); ctx.stroke();
    const burst = reducedMotion.matches ? 0 : Math.max(0, Math.min(1, (now - burstStart) / 950));
    const impulse = burst > 0 && burst < 1 ? Math.sin(burst * Math.PI) * (1 - burst) : 0;
    const yaw = Math.sin(t * .33) * .08;
    const yawCos = Math.cos(yaw), yawSin = Math.sin(yaw);
    const waveSin = Math.sin(t * .6) * .005, waveCos = Math.cos(t * .6) * .005;
    const spread = 1 + impulse * .32;
    for (const p of points) {
      const px = p.x * yawCos + p.z * yawSin;
      const wave = waveSin * p.waveCos + waveCos * p.waveSin;
      const x = cx + px * scale * spread;
      const y = cy + (p.y + wave) * scale * .72 * spread;
      ctx.fillStyle = p.color;
      const radius = Math.max(.58, scale * p.radius);
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }
    // A single copper satellite makes one slow circuit; never a busy starfield.
    const angle = t * .22 + .4;
    const ox = Math.cos(angle) * scale * .54, oy = Math.sin(angle) * scale * .19;
    const sx = cx + ox * Math.cos(-.24) - oy * Math.sin(-.24);
    const sy = cy + scale * .03 + ox * Math.sin(-.24) + oy * Math.cos(-.24);
    ctx.fillStyle = '#e07a52'; ctx.beginPath(); ctx.arc(sx, sy, 2.3, 0, Math.PI * 2); ctx.fill();
    if (impulse > 0) {
      ctx.strokeStyle = `rgba(224,122,82,${(1 - burst) * .5})`;
      ctx.beginPath(); ctx.ellipse(cx, cy, scale * (.38 + burst * .33), scale * (.16 + burst * .18), -.24, 0, Math.PI * 2); ctx.stroke();
    }
    if (width > 1 && height > 1) canvas.dataset.cloudPainted = 'true';
    if (!reducedMotion.matches && (!paused || travel)) frame = requestAnimationFrame(draw);
  }
  function finishTravel() {
    const settled = travel?.settled;
    travel = null;
    settled?.();
  }
  function resume() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function measure() {
    const box = canvas.getBoundingClientRect();
    width = box.width; height = box.height;
    delete canvas.dataset.cloudPainted;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth; canvas.height = pixelHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  new ResizeObserver(() => {
    measure();
    resume();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); }).observe(canvas);
  document.addEventListener('visibilitychange', resume);
  reducedMotion.addEventListener('change', resume);
  return {
    capture() {
      if (!paintedGeometry) return null;
      const box = canvas.getBoundingClientRect();
      return { x: box.left + paintedGeometry.cx, y: box.top + scrollY + paintedGeometry.cy, scale: paintedGeometry.scale };
    },
    moveFrom(from, motion, settled) {
      travel = motion && from ? { from, started: performance.now(), settled } : null;
      measure();
      // Paint the original location before presenting the expanded layout.
      if (frame) cancelAnimationFrame(frame);
      draw(performance.now());
      if (!travel) settled?.();
    },
    burst() { burstStart = performance.now(); resume(); },
    setPaused(value) { paused = value; resume(); },
  };
}
