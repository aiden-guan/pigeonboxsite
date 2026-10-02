// Halftone dot-matrix renderer for PigeonBox's graphic scenes.
// A scene is drawn at grid resolution (one pixel per dot): the red channel is
// dot density, the green channel marks copper accent dots. The field then turns
// that into dots, adds a pointer "flashlight", and optional sprite overlays.
// Loaded lazily; animates only while visible; static under reduced motion.

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;
const ink = (v) => `rgb(${Math.round(Math.min(1, Math.max(0, v)) * 255)},0,0)`;
const acc = (v) => `rgb(0,${Math.round(Math.min(1, Math.max(0, v)) * 255)},0)`;
const CUT = 'rgb(0,0,0)';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Field                                                               */
/* ------------------------------------------------------------------ */

export function createField(canvas, scene) {
  const opts = {
    cell: 9, dot: 0.34, color: [158, 164, 172], accent: [224, 122, 82], alphas: [0.28, 0.55, 0.9],
    bg: null, floor: 0, flashlight: 0.5, radius: 120, fps: 40, interactive: true, ...scene.options,
  };
  const ctx = canvas.getContext('2d');
  const low = document.createElement('canvas');
  const lctx = low.getContext('2d', { willReadFrequently: true });
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');
  const state = { W: 0, H: 0, cols: 0, rows: 0, cell: opts.cell, dpr: 1, t: 0, pointer: null, glow: 0, running: false, visible: false, last: 0 };
  let raf = 0;
  let data = null;

  const fit = () => {
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width));
    const H = Math.max(1, Math.round(rect.height));
    if (W === state.W && H === state.H && data) return;
    state.W = W; state.H = H;
    state.cell = typeof opts.cell === 'function' ? opts.cell(W, H) : opts.cell;
    state.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * state.dpr);
    canvas.height = Math.round(H * state.dpr);
    state.cols = Math.ceil(W / state.cell);
    state.rows = Math.ceil(H / state.cell);
    low.width = base.width = state.cols;
    low.height = base.height = state.rows;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.fillStyle = CUT;
    bctx.fillRect(0, 0, state.cols, state.rows);
    bctx.setTransform(1 / state.cell, 0, 0, 1 / state.cell, 0, 0);
    scene.build?.(bctx, W, H, state);
    data = true;
  };

  const paint = () => {
    const { W, H, cols, rows, cell, dpr } = state;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = CUT;
    lctx.fillRect(0, 0, cols, rows);
    lctx.drawImage(base, 0, 0);
    lctx.setTransform(1 / cell, 0, 0, 1 / cell, 0, 0);
    lctx.globalCompositeOperation = 'lighten';
    scene.frame?.(lctx, W, H, state.t, state);
    const px = lctx.getImageData(0, 0, cols, rows).data;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, W, H); }
    else ctx.clearRect(0, 0, W, H);

    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const rMax = cell * opts.dot;
    const p = state.pointer;
    const R = opts.radius;
    const glow = state.glow * opts.flashlight;
    for (let y = 0; y < rows; y++) {
      const cy = (y + 0.5) * cell;
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = px[i];
        const g = px[i + 1];
        let v = Math.max(r, g) / 255;
        const cx = (x + 0.5) * cell;
        if (opts.floor) v = Math.max(v, opts.floor);
        if (glow && p) {
          const dx = cx - p.x;
          const dy = cy - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            const f = 1 - Math.sqrt(d2) / R;
            v = Math.min(1, v + f * f * glow * (v > 0.05 ? 0.6 : 0.35));
          }
        }
        if (v < 0.06) continue;
        const accent = g > r + 8 ? 3 : 0;
        const bucket = v < 0.36 ? 0 : v < 0.7 ? 1 : 2;
        const rad = rMax * (0.5 + 0.5 * Math.sqrt(v));
        const path = paths[accent + bucket];
        path.moveTo(cx + rad, cy);
        path.arc(cx, cy, rad, 0, TAU);
      }
    }
    for (let k = 0; k < 6; k++) {
      const [cr, cg, cb] = k < 3 ? opts.color : opts.accent;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${opts.alphas[k % 3]})`;
      ctx.fill(paths[k]);
    }
    scene.overlay?.(ctx, W, H, state.t, state);
  };

  const tick = (now) => {
    raf = 0;
    if (!state.running) return;
    const dt = Math.min(0.1, (now - (state.last || now)) / 1000);
    if (now - state.last >= 1000 / opts.fps - 2 || !state.last) {
      state.t += dt;
      state.dt = dt;
      state.last = now;
      if (state.pointer) state.glow = Math.min(1, state.glow + dt * 4);
      else state.glow = Math.max(0, state.glow - dt * 2.5);
      scene.update?.(dt, state);
      paint();
    }
    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    if (state.running || reduced() || scene.static) return;
    state.running = true;
    state.last = 0;
    raf = requestAnimationFrame(tick);
  };
  const stop = () => { state.running = false; cancelAnimationFrame(raf); raf = 0; };
  const render = () => { fit(); paint(); };

  // Static scenes repaint on pointer moves, coalesced to one paint per frame.
  let pending = false;
  const repaint = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  };

  // Pointer flashlight; scenes may also react to clicks.
  if (opts.interactive) {
    const host = canvas.parentElement;
    host.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      state.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (scene.static && !reduced()) { state.glow = 1; repaint(); }
    });
    host.addEventListener('pointerleave', () => {
      state.pointer = null;
      if (scene.static) { state.glow = 0; repaint(); }
    });
    host.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      scene.click?.(event.clientX - rect.left, event.clientY - rect.top, state);
    });
  }

  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { data = null; scene.resize?.(state); render(); }, 120);
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting;
    if (entry.isIntersecting) start(); else stop();
  }, { rootMargin: '80px' }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (state.visible) start(); });

  render();
  return { state, render, start, stop, scene };
}

/* ------------------------------------------------------------------ */
/* Pidgy, in flight                                                    */
/* ------------------------------------------------------------------ */

const FLIGHT = new Image();
FLIGHT.decoding = 'async';
FLIGHT.src = '/brand/pidgy-flight.webp';
const FRAME = 112;
const FLAP = [3, 4, 5, 6, 7, 4];

class Courier {
  constructor(size) {
    this.size = size;
    this.x = -80; this.y = 120;
    this.vx = 0; this.vy = 0;
    this.face = 1;
    this.mode = 'fly';
    this.frame = 3;
    this.clock = 0;
    this.route = [];
    this.wait = 0;
    this.trail = [];
    this.trailClock = 0;
    this.bursts = [];
  }

  go(points) { this.route = points.slice(); if (this.mode === 'perch') this.takeoff(); }
  takeoff() { this.mode = 'takeoff'; this.clock = 0; }

  update(dt, speed) {
    this.clock += dt;
    if (this.mode === 'perch') {
      this.frame = Math.sin(this.clock * 1.7) > 0.96 ? 1 : 0;
      if (this.wait > 0) { this.wait -= dt; if (this.wait <= 0 && this.route.length) this.takeoff(); }
      return;
    }
    if (this.mode === 'takeoff') {
      this.frame = this.clock < 0.12 ? 1 : 2;
      if (this.clock > 0.26) { this.mode = 'fly'; this.vy = -60; }
      return;
    }
    if (this.mode === 'idle') {
      if (this.wait > 0) this.wait -= dt;
      else if (this.route.length) { this.mode = 'fly'; this.x = this.route[0].from?.x ?? this.x; this.y = this.route[0].from?.y ?? this.y; }
      return;
    }
    const target = this.route[0];
    if (!target) { this.mode = 'idle'; return; }
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const landing = target.perch && dist < 70;
    const want = landing ? Math.max(40, dist * 2.2) : speed;
    const ax = (dx / (dist || 1)) * want - this.vx;
    const ay = (dy / (dist || 1)) * want - this.vy;
    this.vx += ax * Math.min(1, dt * 2.6);
    this.vy += ay * Math.min(1, dt * 2.6);
    this.x += this.vx * dt;
    this.y += this.vy * dt + Math.sin(this.clock * 5) * 0.25;
    if (Math.abs(this.vx) > 8) this.face = this.vx > 0 ? 1 : -1;

    if (landing) this.frame = dist < 22 ? 10 : 9;
    else if (this.vy > 45 && Math.abs(this.vx) > 40) this.frame = 8;
    else this.frame = FLAP[Math.floor(this.clock * 13) % FLAP.length];

    this.trailClock += dt;
    if (this.trailClock > 0.07 && !landing) {
      this.trailClock = 0;
      this.trail.push({ x: this.x - this.face * this.size * 0.22, y: this.y + this.size * 0.08, life: 1 });
    }

    if (dist < (target.perch ? 3 : 26)) {
      this.route.shift();
      if (target.burst) this.bursts.push({ x: target.x, y: target.y, r: 4, life: 1 });
      if (target.perch) {
        this.x = target.x; this.y = target.y; this.vx = this.vy = 0;
        this.mode = 'perch'; this.clock = 0; this.wait = target.wait || 4; this.frame = 11;
      }
      if (target.exit) { this.mode = 'idle'; this.wait = target.wait || 1.2; this.trail.length = 0; }
      target.done?.();
    }
  }

  decay(dt) {
    for (const p of this.trail) p.life -= dt * 0.38;
    while (this.trail.length && this.trail[0].life <= 0) this.trail.shift();
    for (const b of this.bursts) { b.life -= dt * 0.9; b.r += dt * 90; }
    while (this.bursts.length && this.bursts[0].life <= 0) this.bursts.shift();
  }

  drawTrail(ctx, cell) {
    for (const p of this.trail) {
      ctx.fillStyle = ink(0.95 * p.life);
      ctx.fillRect(Math.floor(p.x / cell) * cell, Math.floor(p.y / cell) * cell, cell, cell);
    }
    for (const b of this.bursts) {
      ctx.strokeStyle = acc(b.life);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.stroke();
    }
  }

  draw(ctx) {
    if (!FLIGHT.complete || this.mode === 'idle') return;
    const s = this.size;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.face, 1);
    ctx.drawImage(FLIGHT, this.frame * FRAME, 0, FRAME, FRAME, -s / 2, -s * 0.93, s, s);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Scene: night shift (footer)                                         */
/* ------------------------------------------------------------------ */

export function nightShift() {
  let layout = null;
  let courier = null;
  let twinkles = [];
  let windows = [];
  let loop = 0;

  const scene = {
    options: { cell: (W) => (W < 640 ? 7 : 9), bg: '#111214', flashlight: 0.55, radius: 130 },

    build(ctx, W, H, state) {
      const rand = rng(1907);
      const mobile = W < 640;
      const cell = state.cell;
      // Checkerboard dither: every other dot, so shapes read as tone, not slabs.
      const dither = (x, y, w, h, v, odd = 0) => {
        ctx.fillStyle = ink(v);
        for (let gy = Math.ceil(y / cell); gy * cell < y + h; gy++) {
          for (let gx = Math.ceil(x / cell); gx * cell < x + w; gx++) {
            if ((gx + gy + odd) % 2 === 0) ctx.fillRect(gx * cell, gy * cell, cell, cell);
          }
        }
      };
      const ground = H * (mobile ? 0.88 : 0.86);
      layout = { ground, mobile };
      twinkles = [];
      windows = [];

      // Stars, some of which twinkle.
      const n = Math.round((W * H) / (mobile ? 2600 : 3400));
      for (let i = 0; i < n; i++) {
        const x = rand() * W;
        const y = rand() * ground * 0.92;
        const v = rand() < 0.82 ? 0.18 + rand() * 0.3 : 0.6 + rand() * 0.4;
        if (rand() < 0.22) twinkles.push({ x, y, v, s: 0.6 + rand() * 2.2, p: rand() * TAU });
        else { ctx.fillStyle = ink(v); ctx.fillRect(x, y, 1, 1); }
      }
      // Constellations: Columba (the Dove) and a little Envelope of our own.
      const constellation = (ox, oy, sc, pts, links) => {
        ctx.strokeStyle = ink(0.16); ctx.lineWidth = 5;
        for (const [a, b] of links) {
          ctx.beginPath(); ctx.moveTo(ox + pts[a][0] * sc, oy + pts[a][1] * sc); ctx.lineTo(ox + pts[b][0] * sc, oy + pts[b][1] * sc); ctx.stroke();
        }
        pts.forEach(([px, py, v]) => { ctx.fillStyle = ink(v); ctx.fillRect(ox + px * sc - 4, oy + py * sc - 4, 9, 9); });
      };
      const sc = mobile ? 0.7 : 1;
      constellation(W * (mobile ? 0.62 : 0.66), H * 0.1, sc,
        [[0, 30, 0.9], [38, 18, 1], [70, 26, 0.8], [104, 8, 0.95], [86, 52, 0.7], [128, 40, 0.75], [52, 60, 0.6]],
        [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [4, 6], [1, 6]]);
      if (!mobile) constellation(W * 0.47, H * 0.08, 0.8,
        [[0, 0, 0.7], [60, 0, 0.7], [60, 38, 0.7], [0, 38, 0.7], [30, 22, 0.9]],
        [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 1]]);
      // Moon with halo.
      const mr = Math.min(Math.max(H * 0.12, 26), 66);
      const mx = W * (mobile ? 0.2 : 0.13);
      const my = H * 0.25;
      for (let k = 0; k < (mobile ? 140 : 260); k++) {
        const a = rand() * TAU;
        const d = mr * (1.15 + Math.pow(rand(), 1.6) * 1.5);
        ctx.fillStyle = ink(0.42 - (d / mr - 1.15) * 0.16);
        ctx.fillRect(mx + Math.cos(a) * d, my + Math.sin(a) * d, 1, 1);
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(mx + mr * 0.42, my - mr * 0.18, mr * 0.9, 0, TAU, true);
      ctx.clip('evenodd');
      ctx.fillStyle = ink(0.92);
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
      ctx.restore();

      // Floating envelopes.
      const envelope = (x, y, w, rot, v) => {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rot);
        const h = w * 0.64;
        ctx.strokeStyle = ink(v);
        ctx.lineWidth = 6;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(0, h * 0.08); ctx.lineTo(w / 2, -h / 2); ctx.stroke();
        ctx.restore();
      };
      envelope(W * 0.35, H * 0.19, mobile ? 64 : 104, -0.16, 0.75);
      envelope(W * 0.82, H * 0.15, mobile ? 44 : 66, 0.22, 0.55);
      if (!mobile) envelope(W * 0.6, H * 0.36, 48, -0.34, 0.42);

      // A postage stamp, perforated, with its own little moon.
      if (!mobile) {
        const sx = W * 0.93; const sy = H * 0.42; const ss = 76;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(0.12);
        ctx.fillStyle = ink(0.75);
        for (let k = -ss / 2; k <= ss / 2; k += 10) { ctx.fillRect(k, -ss * 0.62, 5, 5); ctx.fillRect(k, ss * 0.62, 5, 5); }
        for (let k = -ss * 0.62; k <= ss * 0.62; k += 10) { ctx.fillRect(-ss / 2, k, 5, 5); ctx.fillRect(ss / 2, k, 5, 5); }
        ctx.strokeStyle = ink(0.35); ctx.lineWidth = 4;
        ctx.strokeRect(-ss / 2 + 11, -ss * 0.62 + 11, ss - 22, ss * 1.24 - 22);
        ctx.fillStyle = acc(0.85);
        ctx.font = `600 ${ss * 0.34}px ui-serif, Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText('PB', 0, ss * 0.14);
        ctx.restore();
        // Cancellation waves sweeping off the stamp.
        ctx.strokeStyle = ink(0.32); ctx.lineWidth = 7;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          for (let x = sx - 230; x < sx - 20; x += 6) {
            const yy = sy - 30 + k * 18 + Math.sin(x / 26) * 6;
            if (x === sx - 230) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
      }

      // Rooftops.
      let x = -10;
      const roofs = [];
      while (x < W + 10) {
        const w = 46 + rand() * (mobile ? 56 : 92);
        const h = H * (0.04 + rand() * 0.1);
        roofs.push({ x, w, top: ground - h });
        x += w + (rand() < 0.3 ? 6 + rand() * 18 : 0);
      }
      for (const b of roofs) {
        ctx.fillStyle = CUT;
        ctx.fillRect(b.x, b.top, b.w, H - b.top);
        dither(b.x, b.top, b.w, H - b.top, 0.3);
        ctx.fillStyle = ink(0.62);
        ctx.fillRect(b.x, b.top, b.w, cell * 0.9);
        if (rand() < 0.35) { ctx.fillRect(b.x + b.w * 0.3, b.top - 18, 6, 18); ctx.fillRect(b.x + b.w * 0.3 - 8, b.top - 18, 22, 5); }
        for (let gy = Math.ceil((b.top + cell * 2) / cell); gy * cell < H - cell; gy += 2) {
          for (let gx = Math.ceil((b.x + cell) / cell); gx * cell < b.x + b.w - cell; gx += 2) {
            if ((gx + gy) % 2 === 1 && rand() < 0.45) windows.push({ x: gx * cell, y: gy * cell, p: rand() * TAU, s: 0.08 + rand() * 0.25, on: rand() < 0.1, c: cell });
          }
        }
      }
      // The rooftop sign: PigeonBox, on scaffold legs above the city.
      if (!mobile) {
        const fs = Math.min(H * 0.27, W * 0.115);
        ctx.font = `400 ${fs}px ui-serif, "Iowan Old Style", Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const sw = ctx.measureText('PigeonBox').width;
        const base = ground - H * 0.16;
        const sx0 = W / 2 - sw / 2;
        ctx.fillStyle = ink(0.5);
        for (const lx of [0.08, 0.31, 0.54, 0.77, 0.94]) {
          const px = sx0 + sw * lx;
          ctx.fillRect(px, base + 10, 5, ground - base);
          ctx.beginPath(); ctx.moveTo(px, base + 14); ctx.lineTo(px + sw * 0.11, ground); ctx.lineTo(px + sw * 0.11 + 4, ground); ctx.lineTo(px + 4, base + 14); ctx.fill();
        }
        ctx.fillStyle = ink(0.62);
        ctx.fillRect(sx0 - 14, base + 6, sw + 28, 6);
        ctx.fillStyle = CUT;
        ctx.fillRect(sx0 - 10, base - fs * 0.78, sw + 20, fs * 0.84);
        ctx.fillStyle = ink(0.92);
        ctx.fillText('PigeonBox', W / 2, base);
        layout.sign = { x: sx0 + sw * 0.7, y: base - fs * 0.71 };
      }

      // Water tower.
      const tx = W * (mobile ? 0.12 : 0.07);
      const roofAt = (px) => (roofs.find((b) => px >= b.x && px <= b.x + b.w)?.top ?? ground);
      const tBase = roofAt(tx);
      ctx.fillStyle = ink(0.55);
      ctx.fillRect(tx - 18, tBase - 34, 4, 34); ctx.fillRect(tx + 14, tBase - 34, 4, 34);
      ctx.fillStyle = ink(0.62);
      ctx.fillRect(tx - 24, tBase - 72, 48, 40);
      ctx.beginPath(); ctx.moveTo(tx - 28, tBase - 72); ctx.lineTo(tx, tBase - 96); ctx.lineTo(tx + 28, tBase - 72); ctx.fill();

      // The dovecote: Pidgy's roof.
      const dx = W * (mobile ? 0.74 : 0.875);
      const dBase = roofAt(dx);
      const dw = mobile ? 54 : 74;
      const dh = mobile ? 38 : 50;
      ctx.fillStyle = ink(0.72);
      ctx.fillRect(dx - dw / 2, dBase - dh, dw, dh);
      ctx.beginPath(); ctx.moveTo(dx - dw / 2 - 10, dBase - dh); ctx.lineTo(dx, dBase - dh - dw * 0.42); ctx.lineTo(dx + dw / 2 + 10, dBase - dh); ctx.fill();
      ctx.fillStyle = CUT;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const hx = dx - dw / 2 + dw * (0.2 + c * 0.3);
        const hy = dBase - dh + 12 + r * (dh * 0.45);
        ctx.beginPath(); ctx.arc(hx, hy + 4, 6, Math.PI, 0); ctx.lineTo(hx + 6, hy + 12); ctx.lineTo(hx - 6, hy + 12); ctx.fill();
      }
      ctx.fillStyle = ink(0.8);
      ctx.fillRect(dx - 2, dBase - dh - dw * 0.42 - 26, 4, 26);
      ctx.fillStyle = acc(0.95);
      ctx.fillRect(dx + 2, dBase - dh - dw * 0.42 - 26, 18, 11);
      layout.perch = { x: dx - 12, y: dBase - dh - dw * 0.42 + 6 };

      // Telephone wire with pigeons perched along it.
      const p1 = W * (mobile ? 0.3 : 0.12);
      const p2 = W * (mobile ? 0.56 : 0.24);
      const top = ground - H * (mobile ? 0.27 : 0.3);
      ctx.fillStyle = ink(0.6);
      for (const px of [p1, p2]) { ctx.fillRect(px - 3, top, 6, ground - top); ctx.fillRect(px - 16, top + 6, 32, 5); }
      ctx.strokeStyle = ink(0.55); ctx.lineWidth = 5;
      const sag = H * 0.06;
      const wireY = (t) => (1 - t) * (1 - t) * (top + 8) + 2 * (1 - t) * t * (top + 8 + sag * 2) + t * t * (top + 8);
      ctx.beginPath(); ctx.moveTo(p1, top + 8); ctx.quadraticCurveTo((p1 + p2) / 2, top + 8 + sag * 2, p2, top + 8); ctx.stroke();
      ctx.fillStyle = ink(0.85);
      for (const t of [0.22, 0.31, 0.63, 0.78]) {
        const bx = p1 + (p2 - p1) * t; const by = wireY(t);
        ctx.beginPath(); ctx.ellipse(bx, by - 8, 9, 7, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + (t > 0.5 ? -7 : 7), by - 16, 4.5, 0, TAU); ctx.fill();
      }
      layout.wire = { x: p1 + (p2 - p1) * 0.46, y: wireY(0.46) - 2 };
    },

    frame(ctx, W, H, t, state) {
      for (const s of twinkles) {
        ctx.fillStyle = ink(s.v * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.s + s.p))));
        ctx.fillRect(s.x, s.y, 1, 1);
      }
      for (const w of windows) {
        const lit = w.on || Math.sin(t * w.s + w.p) > 0.55;
        if (lit) { ctx.fillStyle = acc(0.9); ctx.fillRect(w.x, w.y, w.c, w.c); }
      }
      courier?.drawTrail(ctx, state.cell);
    },

    overlay(ctx, W, H, t, state) { scene.ensure(state); courier?.draw(ctx); },

    ensure(state) {
      if (courier || !layout) return;
      courier = new Courier(layout.mobile ? 44 : 58);
      courier.x = layout.perch.x; courier.y = layout.perch.y;
      courier.mode = 'perch'; courier.wait = 2.5; courier.frame = 0;
      scene.plan(state);
    },

    update(dt, state) {
      if (!layout) return;
      scene.ensure(state);
      courier.update(dt, state.W < 640 ? 120 : 175);
      courier.decay(dt);
      if (!courier.route.length) scene.plan(state);
    },

    plan(state) {
      const { W, H } = state;
      const g = layout.ground;
      loop += 1;
      const perches = [layout.wire, layout.perch, layout.sign].filter(Boolean);
      const perch = perches[loop % perches.length];
      courier.route = [
        { x: W * 0.84, y: H * 0.22 },
        { x: W + 90, y: H * 0.16, exit: true, wait: 1.4 },
        { x: W * 0.2, y: H * 0.18, from: { x: -90, y: H * 0.3 } },
        { x: W * 0.46, y: g * 0.42 },
        { ...perch, perch: true, wait: 5 + (loop % 3) },
      ];
    },

    click(x, y, state) {
      if (!courier || reduced()) return;
      const yy = Math.min(y, layout.ground - 40);
      courier.go([{ x, y: yy, burst: true }]);
      if (courier.mode === 'idle') { courier.mode = 'fly'; courier.x = -60; courier.y = state.H * 0.3; }
    },

    flyBy(state) {
      if (!courier) return;
      courier.go([{ x: state.W * 0.5, y: state.H * 0.3, burst: true }]);
    },

    resize() { courier = null; },
  };
  return scene;
}

/* ------------------------------------------------------------------ */
/* Scene: always-on skyline (Cloud section)                            */
/* ------------------------------------------------------------------ */

export function alwaysOn() {
  let blocks = [];
  let mast = null;
  return {
    options: { cell: (W) => (W < 640 ? 6 : 8), bg: null, flashlight: 0.45, radius: 110 },
    build(ctx, W, H, state) {
      const rand = rng(77);
      const cell = state.cell;
      blocks = [];
      let x = -6;
      while (x < W) {
        const w = 40 + rand() * 90;
        const h = H * (0.28 + rand() * 0.5);
        const b = { x, w, top: H - h, win: [] };
        ctx.fillStyle = ink(0.3);
        for (let gy = Math.ceil((H - h) / cell); gy * cell < H; gy++) {
          for (let gx = Math.ceil(x / cell); gx * cell < x + w; gx++) {
            if ((gx + gy) % 2 === 0) ctx.fillRect(gx * cell, gy * cell, cell, cell);
            else if (gy * cell > H - h + cell * 1.5 && gx * cell < x + w - cell && rand() < 0.5) b.win.push({ x: gx * cell, y: gy * cell, r: rand(), c: cell });
          }
        }
        ctx.fillStyle = ink(0.62);
        ctx.fillRect(x, H - h, w, cell * 0.9);
        blocks.push(b);
        x += w + (rand() < 0.25 ? 10 : 0);
      }
      const mx = W * 0.62;
      const base = blocks.find((b) => mx >= b.x && mx <= b.x + b.w)?.top ?? H * 0.5;
      ctx.fillStyle = ink(0.7);
      ctx.fillRect(mx - 2, base - 70, 4, 70);
      ctx.beginPath(); ctx.moveTo(mx - 16, base); ctx.lineTo(mx, base - 70); ctx.lineTo(mx + 16, base); ctx.lineTo(mx + 10, base); ctx.lineTo(mx, base - 50); ctx.lineTo(mx - 10, base); ctx.fill();
      mast = { x: mx, y: base - 72 };
    },
    frame(ctx, W, H, t) {
      // A sync sweep crosses the city; windows it passes light up and stay lit a while.
      const sweep = ((t * 0.18) % 1.25) * W * 1.1 - W * 0.05;
      for (const b of blocks) for (const w of b.win) {
        const since = (sweep - w.x) / W;
        const lit = (since > 0 && since < 0.32 + w.r * 0.25) || w.r > 0.93;
        if (lit) {
          const fresh = since > 0 && since < 0.03;
          ctx.fillStyle = fresh ? ink(1) : acc(0.85);
          ctx.fillRect(w.x, w.y, w.c, w.c);
        }
      }
      ctx.fillStyle = ink(0.12);
      ctx.fillRect(sweep, 0, 8, H);
      if (mast) {
        ctx.lineWidth = 6;
        for (let k = 0; k < 3; k++) {
          const ph = (t * 0.6 + k / 3) % 1;
          ctx.strokeStyle = acc(1 - ph);
          ctx.beginPath(); ctx.arc(mast.x, mast.y, 10 + ph * 70, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Scene: postmark (hero)                                              */
/* ------------------------------------------------------------------ */

export function postmark() {
  return {
    static: true,
    options: { cell: 5, dot: 0.4, color: [17, 18, 20], accent: [168, 80, 44], alphas: [0.08, 0.15, 0.24], flashlight: 0.8, radius: 90 },
    build(ctx, W, H) {
      const R = Math.min(W * 0.32, H * 0.42);
      const cx = W - R - 8;
      const cy = R + 10;
      ctx.strokeStyle = ink(1);
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.74, 0, TAU); ctx.stroke();
      const ring = 'PIGEONBOX · GMAIL DISPATCH · LOCAL FIRST · ';
      ctx.fillStyle = ink(1);
      ctx.font = `600 ${R * 0.13}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const step = TAU / ring.length;
      for (let i = 0; i < ring.length; i++) {
        const a = -Math.PI / 2 + i * step;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * R * 0.87, cy + Math.sin(a) * R * 0.87);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillText(ring[i], 0, 0);
        ctx.restore();
      }
      const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date()).toUpperCase().replace(',', '');
      ctx.font = `600 ${R * 0.17}px ui-monospace, Menlo, monospace`;
      ctx.fillText(date, cx, cy - R * 0.1);
      ctx.fillStyle = acc(1);
      ctx.font = `400 ${R * 0.26}px ui-serif, Georgia, serif`;
      ctx.fillText('Delivered', cx, cy + R * 0.2);
      ctx.strokeStyle = ink(0.9);
      ctx.lineWidth = 5;
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        for (let x = 0; x < cx - R * 1.04; x += 4) {
          const y = cy - R * 0.62 + k * R * 0.25 + Math.sin(x / 22 + k * 0.6) * R * 0.05;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Scenes: capability glyphs                                           */
/* ------------------------------------------------------------------ */

const glyphOptions = { cell: 6, dot: 0.4, color: [24, 25, 27], accent: [168, 80, 44], alphas: [0.16, 0.42, 0.85], flashlight: 0.7, radius: 70, fps: 30 };

const loopT = (t, len) => (t % len) / len;
const ease = (p) => 1 - (1 - p) ** 3;

function envelopeShape(ctx, x, y, w, v, accent = false) {
  const h = w * 0.64;
  ctx.fillStyle = accent ? acc(v * 0.3) : ink(v * 0.25);
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = accent ? acc(v) : ink(v);
  ctx.lineWidth = 5;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.beginPath(); ctx.moveTo(x - w / 2, y - h / 2); ctx.lineTo(x, y + h * 0.06); ctx.lineTo(x + w / 2, y - h / 2); ctx.stroke();
}

export const glyphs = {
  triage: () => ({
    options: glyphOptions,
    frame(ctx, W, H, t) {
      const trays = 4;
      const tw = W * 0.42;
      const tx = W * 0.52;
      for (let i = 0; i < trays; i++) {
        const ty = H * 0.2 + i * H * 0.2;
        ctx.strokeStyle = ink(i === 0 ? 0.95 : 0.55);
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty + H * 0.13); ctx.lineTo(tx + tw, ty + H * 0.13); ctx.lineTo(tx + tw, ty); ctx.stroke();
      }
      const p = loopT(t, 3.2);
      const lane = Math.floor(t / 3.2) % trays;
      const e = ease(Math.min(1, p * 1.6));
      const sx = W * 0.18; const sy = H * 0.5;
      const ex = tx + tw / 2; const ey = H * 0.2 + lane * H * 0.2 + H * 0.05;
      envelopeShape(ctx, sx + (ex - sx) * e, sy + (ey - sy) * e - Math.sin(e * Math.PI) * H * 0.18, W * 0.17, 1, lane === 0);
      for (let k = 0; k < 3; k++) envelopeShape(ctx, sx - 6 + k * 4, sy + 10 - k * 6, W * 0.17, 0.3);
    },
  }),

  companion: () => ({
    options: glyphOptions,
    frame(ctx, W, H, t) {
      const p = loopT(t, 4);
      for (let i = 0; i < 9; i++) {
        const y = H * 0.12 + i * H * 0.09;
        const scan = Math.abs(p * 11 - i - 1) < 1.2;
        ctx.fillStyle = ink(scan ? 0.75 : 0.28);
        ctx.fillRect(W * 0.06, y, W * (0.32 + ((i * 37) % 10) / 70), 5);
      }
      const cx = W * 0.5;
      ctx.fillStyle = ink(0.12);
      ctx.fillRect(cx, H * 0.18, W * 0.44, H * 0.64);
      ctx.strokeStyle = ink(0.9); ctx.lineWidth = 5;
      ctx.strokeRect(cx, H * 0.18, W * 0.44, H * 0.64);
      ctx.fillStyle = acc(1);
      ctx.fillRect(cx, H * 0.18, 6, H * 0.64);
      for (let k = 0; k < 3; k++) {
        const grow = ease(Math.max(0, Math.min(1, (p - 0.45 - k * 0.12) * 4)));
        ctx.fillStyle = ink(0.95);
        ctx.fillRect(cx + 16, H * 0.32 + k * H * 0.15, (W * 0.34 - k * 14) * grow, 7);
      }
    },
  }),

  drafting: () => ({
    options: glyphOptions,
    frame(ctx, W, H, t) {
      const p = loopT(t, 3.6);
      const rows = [H * 0.32, H * 0.52, H * 0.72];
      let tipX = 0; let tipY = 0;
      rows.forEach((ry, r) => {
        const start = W * 0.08;
        const end = W * (r === 2 ? 0.6 : 0.9);
        const local = Math.max(0, Math.min(1, p * 3.3 - r));
        if (!local) return;
        ctx.strokeStyle = ink(0.85); ctx.lineWidth = 5;
        ctx.beginPath();
        for (let x = start; x <= start + (end - start) * local; x += 3) {
          const y = ry + Math.sin(x / 7) * 4 + Math.sin(x / 19) * 3;
          if (x === start) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          tipX = x; tipY = y;
        }
        ctx.stroke();
      });
      if (tipX) {
        ctx.fillStyle = acc(1);
        ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX + 10, tipY - 30); ctx.lineTo(tipX + 26, tipY - 22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = ink(0.8);
        ctx.fillRect(tipX + 16, tipY - 62, 9, 40);
      }
      ctx.fillStyle = ink(0.22);
      ctx.fillRect(W * 0.06, H * 0.12, W * 0.88, 4);
    },
  }),

  ask: () => ({
    options: glyphOptions,
    frame(ctx, W, H, t) {
      const lx = W * (0.32 + 0.26 * Math.sin(t * 0.7));
      const ly = H * (0.48 + 0.12 * Math.sin(t * 1.1));
      const R = Math.min(W, H) * 0.24;
      for (let y = H * 0.14; y < H * 0.9; y += H * 0.11) {
        for (let x = W * 0.06; x < W * 0.94; x += 7) {
          const inLens = Math.hypot(x - lx, y - ly) < R;
          const word = Math.sin(x * 0.21 + y) > -0.3;
          if (!word) continue;
          ctx.fillStyle = inLens ? (Math.hypot(x - lx, y - ly) < R * 0.45 ? acc(1) : ink(0.95)) : ink(0.22);
          ctx.fillRect(x, y, inLens ? 6 : 4, inLens ? 6 : 4);
        }
      }
      ctx.strokeStyle = ink(1); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(lx, ly, R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(lx + R * 0.72, ly + R * 0.72); ctx.lineTo(lx + R * 1.45, ly + R * 1.45); ctx.stroke();
    },
  }),

  tracking: () => ({
    options: glyphOptions,
    frame(ctx, W, H, t) {
      const ox = W * 0.24; const oy = H * 0.56;
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.45 + k / 4) % 1;
        ctx.strokeStyle = k % 2 ? ink(0.7 * (1 - ph)) : acc(0.9 * (1 - ph));
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(ox, oy, 18 + ph * W * 0.62, -Math.PI * 0.42, Math.PI * 0.42); ctx.stroke();
      }
      envelopeShape(ctx, ox, oy, W * 0.2, 1);
      // A faint, uncertain receiver: an open is a signal, not proof.
      const blink = Math.sin(t * 2.2) > 0.2;
      ctx.fillStyle = ink(blink ? 0.6 : 0.18);
      ctx.fillRect(W * 0.86, H * 0.36, 8, 8);
      ctx.fillRect(W * 0.86, H * 0.52, 8, 16);
    },
  }),
};

/* ------------------------------------------------------------------ */
/* Scene: the loft (Local page): mail comes home                       */
/* ------------------------------------------------------------------ */

export function loft() {
  let holes = [];
  let peak = null;
  return {
    options: { cell: 6, dot: 0.42, color: [24, 25, 27], accent: [168, 80, 44], alphas: [0.14, 0.4, 0.85], flashlight: 0.7, radius: 90, fps: 30 },
    build(ctx, W, H, state) {
      const cell = state.cell;
      const x0 = W * 0.2; const x1 = W * 0.8; const top = H * 0.42; const bottom = H * 0.9;
      ctx.fillStyle = ink(0.32);
      for (let gy = Math.ceil(top / cell); gy * cell < bottom; gy++) for (let gx = Math.ceil(x0 / cell); gx * cell < x1; gx++) {
        if ((gx + gy) % 2 === 0) ctx.fillRect(gx * cell, gy * cell, cell, cell);
      }
      ctx.fillStyle = ink(0.8);
      ctx.beginPath(); ctx.moveTo(x0 - 18, top); ctx.lineTo((x0 + x1) / 2, H * 0.16); ctx.lineTo(x1 + 18, top); ctx.closePath(); ctx.fill();
      ctx.fillStyle = CUT;
      ctx.beginPath(); ctx.moveTo(x0 + 16, top - 4); ctx.lineTo((x0 + x1) / 2, H * 0.22); ctx.lineTo(x1 - 16, top - 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = ink(0.45);
      ctx.beginPath(); ctx.moveTo(x0 + 30, top - 8); ctx.lineTo((x0 + x1) / 2, H * 0.25); ctx.lineTo(x1 - 30, top - 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = ink(0.75);
      ctx.fillRect(x0 - 8, top, x1 - x0 + 16, 6);
      ctx.fillRect(0, bottom, W, 6);
      holes = [];
      const cols = 4; const rows = 3;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const hx = x0 + (x1 - x0) * ((c + 0.5) / cols);
        const hy = top + 22 + r * ((bottom - top - 30) / rows);
        ctx.fillStyle = CUT;
        ctx.beginPath(); ctx.arc(hx, hy + 14, 16, Math.PI, 0); ctx.lineTo(hx + 16, hy + 36); ctx.lineTo(hx - 16, hy + 36); ctx.fill();
        ctx.fillStyle = ink(0.85);
        ctx.fillRect(hx - 22, hy + 36, 44, 5);
        holes.push({ x: hx, y: hy + 22, lit: -10 });
      }
      peak = { x: (x0 + x1) / 2, y: H * 0.16 };
    },
    frame(ctx, W, H, t) {
      const n = holes.length;
      const period = 1.4;
      const k = Math.floor(t / period);
      const p = (t % period) / period;
      const hole = holes[(k * 5) % n];
      if (p > 0.98) hole.lit = t;
      for (const h of holes) {
        const age = t - h.lit;
        if (age >= 0 && age < 5) { ctx.fillStyle = acc(1 - age / 6); ctx.fillRect(h.x - 13, h.y - 12, 26, 24); }
      }
      const e = ease(p);
      const sx = -30; const sy = H * 0.3 + Math.sin(k) * H * 0.1;
      const x = sx + (hole.x - sx) * e;
      const y = sy + (hole.y - sy) * e - Math.sin(e * Math.PI) * H * 0.2;
      envelopeShape(ctx, x, y, 26 - e * 10, 1);
    },
    overlay(ctx, W, H, t) {
      if (!FLIGHT.complete || !peak) return;
      const s = Math.min(64, W * 0.15);
      const blink = Math.sin(t * 1.3) > 0.97 ? 1 : 0;
      ctx.drawImage(FLIGHT, blink * FRAME, 0, FRAME, FRAME, peak.x - s / 2, peak.y - s * 0.9, s, s);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Scene: sealed (Privacy page)                                        */
/* ------------------------------------------------------------------ */

export function sealed() {
  return {
    static: true,
    options: { cell: 6, dot: 0.42, color: [24, 25, 27], accent: [168, 80, 44], alphas: [0.12, 0.38, 0.85], flashlight: 0.8, radius: 100 },
    build(ctx, W, H, state) {
      const cell = state.cell;
      const w = Math.min(W * 0.82, H * 1.25); const h = w * 0.62;
      const x0 = (W - w) / 2; const y0 = (H - h) / 2 + 10;
      ctx.fillStyle = ink(0.24);
      for (let gy = Math.ceil(y0 / cell); gy * cell < y0 + h; gy++) for (let gx = Math.ceil(x0 / cell); gx * cell < x0 + w; gx++) {
        if ((gx + gy) % 2 === 0) ctx.fillRect(gx * cell, gy * cell, cell, cell);
      }
      ctx.strokeStyle = ink(0.9); ctx.lineWidth = 6;
      ctx.strokeRect(x0, y0, w, h);
      ctx.beginPath(); ctx.moveTo(x0, y0 + h); ctx.lineTo(x0 + w * 0.4, y0 + h * 0.5); ctx.moveTo(x0 + w, y0 + h); ctx.lineTo(x0 + w * 0.6, y0 + h * 0.5); ctx.stroke();
      ctx.fillStyle = CUT;
      ctx.beginPath(); ctx.moveTo(x0 + 3, y0 + 3); ctx.lineTo(x0 + w / 2, y0 + h * 0.58); ctx.lineTo(x0 + w - 3, y0 + 3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w / 2, y0 + h * 0.58); ctx.lineTo(x0 + w, y0); ctx.stroke();
      const cx = x0 + w / 2; const cy = y0 + h * 0.58; const r = h * 0.2;
      ctx.fillStyle = acc(1);
      ctx.beginPath();
      for (let a = 0; a <= TAU + 0.01; a += TAU / 18) {
        const rr = r * (1 + (Math.round(a / (TAU / 18)) % 2 ? 0.08 : -0.04));
        const px = cx + Math.cos(a) * rr; const py = cy + Math.sin(a) * rr;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.fill();
      ctx.fillStyle = CUT;
      ctx.font = `600 ${r * 0.8}px ui-serif, Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PB', cx, cy + 2);
      ctx.strokeStyle = acc(0.5); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, TAU); ctx.stroke();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Mounting                                                            */
/* ------------------------------------------------------------------ */

const SCENES = { night: nightShift, always: alwaysOn, postmark, loft, sealed, ...glyphs };

export function mount(root = document) {
  const fields = [];
  root.querySelectorAll('canvas[data-halftone]').forEach((canvas) => {
    if (canvas.dataset.mounted) return;
    const make = SCENES[canvas.dataset.halftone];
    if (!make) return;
    canvas.dataset.mounted = '1';
    const field = createField(canvas, make());
    fields.push(field);
    canvas.field = field;
  });
  if (!FLIGHT.complete) FLIGHT.addEventListener('load', () => fields.forEach((f) => f.render()), { once: true });
  return fields;
}
