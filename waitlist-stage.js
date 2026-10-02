// Waitlist hero: Pidgy, printed in halftone dots. Every dot is a spring-loaded particle
// that targets a sample of the real flight sprite, so the pigeon can assemble, flap,
// scatter from the cursor and fold itself into an envelope.

const CELL = 112, FRAMES = 12, STEP = 2;          // sprite cell size, frame count, sample stride
const N = CELL / STEP;                            // halftone grid is N × N; each dot owns one cell
const FLAP = [3, 4, 7, 8, 9, 4];

export function startStage() {
  const stage = document.querySelector('.wl-stage');
  const canvas = stage?.querySelector('.wl-dots');
  if (!canvas) return null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  const api = { hop() {}, peck() {}, shake() {}, deliver() {} };

  const img = new Image();
  img.src = '/brand/pidgy-flight.webp';
  img.decode().then(() => run(sampleFrames(img))).catch(() => {});

  function run(frames) {
    const envelope = envelopeShape();
    const dots = Array.from({ length: N * N }, (_, i) => {
      const hx = i % N - N / 2, hy = Math.floor(i / N) - N / 2 - 6;
      return { x: hx, y: hy, hx, hy, vx: 0, vy: 0, r: 0, tr: 0, c: [200, 200, 200], tc: [200, 200, 200] };
    });
    let W = 0, H = 0, dpr = 1, gap = 6, cx = 0, cy = 0;
    let shape = null, mode = 'idle', modeAt = 0, lift = 0, liftV = 0, kick = 0;
    let mouse = { x: -1e4, y: -1e4, down: false };

    function layout() {
      const r = stage.getBoundingClientRect();
      W = r.width; H = r.height; dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      const narrow = W < 900;
      gap = narrow ? Math.max(3.4, Math.min(5, W / 110)) : Math.max(5, Math.min(10, W / 125));
      cx = narrow ? W / 2 : W * .76;
      cy = narrow ? Math.min(W * .42, 210) + 10 : H * .5;
    }

    // Each dot keeps its grid cell; a frame only changes how big and what colour it is.
    function target(points, spread = 0) {
      if (points === shape && !spread) return;
      shape = points;
      dots.forEach((d, i) => {
        const p = points[i];
        d.tr = p ? p.r : 0; if (p) d.tc = p.c;
        if (spread && d.r > .05) { d.vx += (Math.random() - .5) * spread; d.vy += (Math.random() - .5) * spread; }
      });
    }

    function scatterIn() {
      dots.forEach(d => {
        const a = Math.random() * Math.PI * 2, dist = 300 + Math.random() * 600;
        d.x = d.hx + Math.cos(a) * dist / 6; d.y = d.hy + Math.sin(a) * dist / 10; d.r = 0;
        d.c = [224, 122, 82];
      });
      target(frames[0]);
    }

    function setMode(m, now = performance.now()) { mode = m; modeAt = now; }

    const tick = now => {
      const t = now - modeAt;
      // Choreography: perch, then a burst of flight with a hover, then land.
      if (mode === 'idle') {
        target(t % 3600 > 3420 ? frames[1] : frames[0]);
        if (t > 5200) setMode('flap', now);
      } else if (mode === 'flap') {
        target(frames[FLAP[Math.floor(t / 85) % FLAP.length]]);
        liftV += (-34 - lift) * .02;
        if (t > 2200) setMode('land', now);
      } else if (mode === 'land') {
        target(t < 160 ? frames[11] : frames[0]);
        liftV += (0 - lift) * .03;
        if (t > 900) setMode('idle', now);
      } else if (mode === 'letter') {
        target(envelope);
        liftV += (-10 - lift) * .02;
        if (t > 2400) { setMode('flap', now); target(frames[3], 1.5); }
      }
      liftV *= .86; lift += liftV;
      kick *= .9;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
      const ox = cx, oy = cy + lift + Math.sin(now / 600) * 3;
      const k = mode === 'letter' ? .05 : .09;
      for (const d of dots) {
        const gx = ox + d.hx * gap, gy = oy + d.hy * gap;
        let ax = (gx - (ox + d.x * gap)) * k, ay = (gy - (oy + d.y * gap)) * k;
        // Cursor pushes dots away, like a hand through birdseed.
        const sx = ox + d.x * gap, sy = oy + d.y * gap, dx = sx - mouse.x, dy = sy - mouse.y, dd = dx * dx + dy * dy;
        const R = mouse.down ? 190 : 110;
        if (dd < R * R) { const f = (1 - Math.sqrt(dd) / R) * (mouse.down ? 9 : 4); const m = Math.sqrt(dd) || 1; ax += dx / m * f; ay += dy / m * f; }
        d.vx = (d.vx + ax / gap) * .78; d.vy = (d.vy + ay / gap) * .78;
        d.x += d.vx; d.y += d.vy;
        d.r += (d.tr - d.r) * (mode === 'flap' ? .45 : .14);
        for (let j = 0; j < 3; j++) d.c[j] += (d.tc[j] - d.c[j]) * .08;
        if (d.r < .03) continue;
        // Speed tints dots copper, so motion leaves a warm shimmer.
        const sp = Math.min(1, Math.hypot(d.vx, d.vy) * .9 + kick);
        ctx.fillStyle = `rgb(${d.c[0] + (224 - d.c[0]) * sp | 0},${d.c[1] + (122 - d.c[1]) * sp | 0},${d.c[2] + (82 - d.c[2]) * sp | 0})`;
        ctx.beginPath(); ctx.arc(ox + d.x * gap, oy + d.y * gap, d.r * gap * .5, 0, 6.2832); ctx.fill();
      }
      if (!reduced) requestAnimationFrame(tick);
    };

    stage.addEventListener('pointermove', e => { const r = stage.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    stage.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; mouse.down = false; });
    canvas.addEventListener('pointerdown', () => { mouse.down = true; kick = .6; if (mode === 'idle') setMode('flap'); });
    addEventListener('pointerup', () => { mouse.down = false; });
    new ResizeObserver(layout).observe(stage);
    layout();

    if (reduced) {
      dots.forEach((d, i) => { const p = frames[0][i]; if (p) { d.r = d.tr = p.r; d.c = [...p.c]; d.tc = p.c; } });
      new ResizeObserver(() => requestAnimationFrame(tick)).observe(stage);
      requestAnimationFrame(tick);
      return;
    }
    scatterIn();
    setMode('idle');
    modeAt = performance.now() - 2600;   // first flap comes soon after assembly
    requestAnimationFrame(tick);

    api.hop = () => { liftV -= 6; kick = .4; };
    api.peck = () => { liftV -= 1.5; };
    api.shake = () => { kick = 1; dots.forEach(d => { d.vx += (Math.random() - .5) * .9; }); };
    api.deliver = () => { kick = 1; setMode('letter'); target(envelope, 2.5); };
  }

  return { hop: () => api.hop(), peck: () => api.peck(), shake: () => api.shake(), deliver: () => api.deliver() };
}

// Sample each sprite frame on a grid: dot size from coverage and lightness, colour from the pixels.
function sampleFrames(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const data = g.getImageData(f * CELL, 0, CELL, CELL).data, pts = new Array(N * N);
    for (let y = 0; y < CELL; y += STEP) for (let x = 0; x < CELL; x += STEP) {
      let r = 0, gg = 0, b = 0, a = 0;
      for (let j = 0; j < STEP; j++) for (let i = 0; i < STEP; i++) {
        const k = ((y + j) * CELL + x + i) * 4, al = data[k + 3] / 255;
        r += data[k] * al; gg += data[k + 1] * al; b += data[k + 2] * al; a += al;
      }
      if (a < STEP * STEP * .45) continue;
      r /= a; gg /= a; b /= a;
      const lum = (r * .3 + gg * .59 + b * .11) / 255;
      const warm = r - b > 38;
      // Printed on paper: dark feathers and outline become big dots, the pale breast stays fine.
      const size = .3 + Math.pow(1 - lum, .7) * 1;
      const col = warm ? [Math.min(255, r * 1.1), gg * .8, b * .7] : [r * .8, gg * .8, b * .85];
      pts[(y / STEP) * N + x / STEP] = { r: Math.min(1.25, size), c: col };
    }
    frames.push(pts);
  }
  return frames;
}

function envelopeShape() {
  const pts = new Array(N * N), w = 30, h = 20, paper = [150, 140, 125], fold = [40, 42, 46], seal = [200, 90, 50];
  for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
    const u = x / w, v = y / h;
    const edge = x === 0 || y === 0 || x === w || y === h;
    const flap = Math.abs(v - Math.min(u, 1 - u) * 1.15) < .05;
    const inSeal = Math.hypot(x - w / 2, y - h * .575) < 3.4;
    pts[(y + 20) * N + x + 13] = { r: inSeal ? 1.15 : edge || flap ? .95 : .3 + v * .2, c: inSeal ? seal : edge || flap ? fold : paper };
  }
  return pts;
}
