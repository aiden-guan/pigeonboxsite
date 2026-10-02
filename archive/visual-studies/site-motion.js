import { paintFlightFrame } from './flight-frames.js';
// Lightweight, decorative motion for the public homepage.
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

if (!motionPreference.matches && 'IntersectionObserver' in window) {
  const revealTargets = document.querySelectorAll([
    '.story-section .story-heading',
    '.story-section .triage-scene',
    '.story-section .thread-visual',
    '.draft-layout .story-heading',
    '.draft-layout .compose-scene',
    '.split-feature > div',
    '.tracking-band > div',
    '.choice-intro',
    '.choice-grid',
    '.open-source > div',
    '.privacy-layout > div',
    '.end-section > *',
  ].join(','));
  const revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
  revealTargets.forEach((target) => {
    target.classList.add('reveal');
    if (target.matches('.triage-scene, .thread-visual, .compose-scene, .choice-grid, .privacy-diagram, .terminal')) {
      target.classList.add('reveal-delay');
    }
    revealObserver.observe(target);
  });
  document.body.classList.add('has-motion');
}

// A fixed hit target prevents the moving bird from retriggering itself.
const perch = document.querySelector('.courier-perch');
const bird = perch?.querySelector('.flight-bird');
if (perch && bird) {
  const atlas = new Image();
  atlas.src = '/brand/pigeon-flight-atlas.png';
  let frameRequest = 0;
  let flying = false;
  let armed = true;
  const pose = (frame) => {
    paintFlightFrame(bird, frame);
  };
  pose(0);
  const reset = () => {
    cancelAnimationFrame(frameRequest);
    flying = false;
    perch.dataset.flying = 'false';
    bird.style.transform = '';
    bird.style.opacity = '';
    pose(0);
  };
  const fly = () => {
    if (flying || motionPreference.matches || !atlas.complete || !atlas.naturalWidth) return;
    flying = true;
    armed = false;
    perch.dataset.flying = 'true';
    const rect = perch.getBoundingClientRect();
    const exit = innerWidth - rect.left + 180;
    const enter = -rect.right - 180;
    const started = performance.now();
    const wingCycle = [3, 4, 5, 6, 7, 4, 5, 6];
    const tick = (now) => {
      const t = now - started;
      let x = 0, y = 0, angle = 0, scale = 1, alpha = 1, frame = 0;
      if (t < 180) {
        frame = 1; y = 5 * Math.sin(t / 180 * Math.PI); // anticipation
      } else if (t < 1450) {
        const p = (t - 180) / 1270;
        x = exit * p * p;
        y = -110 * Math.sin(p * Math.PI / 2);
        angle = -8 * Math.sin(p * Math.PI);
        frame = t < 280 ? 2 : wingCycle[Math.floor((t - 280) / 72) % wingCycle.length];
        scale = 1 - p * .15;
      } else if (t < 1700) {
        alpha = 0; frame = 8;
      } else if (t < 3100) {
        const p = (t - 1700) / 1400;
        const eased = 1 - Math.pow(1 - p, 2);
        x = enter * (1 - eased);
        y = -100 * (1 - eased) - Math.sin(p * Math.PI) * 45;
        scale = .85 + .15 * eased;
        frame = p > .88 ? 9 : wingCycle[Math.floor(t / 78) % wingCycle.length];
        angle = p > .85 ? -4 : 4;
      } else if (t < 3290) {
        frame = 10; y = 3 * Math.sin((t - 3100) / 190 * Math.PI);
      } else {
        reset(); return;
      }
      pose(frame);
      bird.style.transform = `translate3d(${x}px,${y}px,0) rotate(${angle}deg) scale(${scale})`;
      bird.style.opacity = String(alpha);
      frameRequest = requestAnimationFrame(tick);
    };
    frameRequest = requestAnimationFrame(tick);
  };
  perch.addEventListener('pointerenter', () => { if (finePointer.matches && armed) fly(); });
  perch.addEventListener('pointerleave', () => { armed = true; });
  perch.addEventListener('click', fly);
  motionPreference.addEventListener('change', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  window.addEventListener('resize', reset, { passive: true });
}
