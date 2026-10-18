// Folded paper, flat-shaded: Local seals itself into an envelope and stays put;
// Cloud is a paper plane that keeps flying. Facets take one of four flat tones
// by their angle to the light, outlined with a hairline like a print.

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const LIGHT = norm([-0.35, 0.75, 0.6]);

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function rotX(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; }
function rotY(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; }
function rotZ(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; }
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v) => Math.min(1, Math.max(0, v));

function stageFor(canvas, draw) {
  const ctx = canvas.getContext('2d');
  const view = { w: 0, h: 0, dpr: 1 };
  let frame = 0, visible = false, t0 = performance.now(), running = false;
  const size = () => {
    const r = canvas.getBoundingClientRect();
    view.w = r.width; view.h = r.height;
    view.dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
  };
  const loop = (now) => {
    frame = 0;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    const keep = draw(ctx, view, reduce.matches ? 99 : (now - t0) / 1000);
    if (keep && visible && !reduce.matches && !document.hidden) frame = requestAnimationFrame(loop);
    else running = false;
  };
  const kick = () => { if (!frame) { running = true; frame = requestAnimationFrame(loop); } };
  new ResizeObserver(() => { size(); kick(); }).observe(canvas);
  new IntersectionObserver(([e]) => {
    const was = visible;
    visible = e.isIntersecting;
    if (visible && !was) { t0 = performance.now(); kick(); }
  }, { threshold: 0.35 }).observe(canvas);
  document.addEventListener('visibilitychange', kick);
  reduce.addEventListener('change', kick);
  return { replay() { t0 = performance.now(); kick(); }, get running() { return running; } };
}

function facet(ctx, pts, tone, stroke) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = tone;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function toneOf(tri, tones) {
  const n = norm(cross(sub(tri[1], tri[0]), sub(tri[2], tri[0])));
  const lum = Math.abs(dot(n, LIGHT));
  return tones[Math.min(tones.length - 1, Math.floor((1 - lum) * tones.length * 0.999))];
}

/* ---------- Local: the envelope folds itself shut ---------- */

export function mountEnvelope(canvas) {
  const TONES = ['#faf8f3', '#ebe7dd', '#dcd6c9', '#c9c2b3'];
  const stage = stageFor(canvas, (ctx, { w, h }, t) => {
    const S = Math.min(w / 2.6, h / 1.75);
    const cx = w / 2, cy = h / 2 + 4, D = 6;
    const sway = t > 2.4 ? Math.sin((t - 2.4) * 0.8) * 0.06 : 0;
    const place = (v) => rotZ(rotY(rotX(v, -0.55), 0.32 + sway), -0.06);
    const project = (v) => { const p = place(v); const k = D / (D - p[2]); return [cx + p[0] * S * k, cy - p[1] * S * k, p[2]]; };
    const fold = (start, len) => Math.PI * ease(clamp((t - start) / len)) * 0.985;
    const aL = fold(0.15, 0.6), aR = fold(0.45, 0.6), aB = fold(0.8, 0.65), aT = fold(1.35, 0.75);
    const tris = [
      { v: [[-0.8, 0.5, 0], [0.8, 0.5, 0], [0.8, -0.5, 0], [-0.8, -0.5, 0]], z: 0 },
      { v: [[-0.8, 0.5, 0], [-0.8, -0.5, 0], [-0.8 - 0.78 * Math.cos(aL), 0, 0.78 * Math.sin(aL) + 0.01]], z: 1 },
      { v: [[0.8, 0.5, 0], [0.8, -0.5, 0], [0.8 + 0.78 * Math.cos(aR), 0, 0.78 * Math.sin(aR) + 0.02]], z: 2 },
      { v: [[-0.8, -0.5, 0], [0.8, -0.5, 0], [0, -0.5 - 0.6 * Math.cos(aB), 0.6 * Math.sin(aB) + 0.03]], z: 3 },
      { v: [[-0.8, 0.5, 0], [0.8, 0.5, 0], [0, 0.5 + 0.58 * Math.cos(aT), 0.58 * Math.sin(aT) + 0.04]], z: 4 },
    ];
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    for (const tri of tris) {
      const world = tri.v.map(place);
      facet(ctx, tri.v.map(project), tri.z === 0 ? TONES[2] : toneOf(world, TONES), '#18191b');
    }
    // Wax seal on the top flap's tip once it lands.
    const seal = ease(clamp((t - 2.15) / 0.35));
    if (seal > 0) {
      const tip = project([0, 0.5 + 0.58 * Math.cos(aT), 0.58 * Math.sin(aT) + 0.05]);
      const r = S * 0.1 * (seal < 1 ? 1 + Math.sin(seal * Math.PI) * 0.35 : 1);
      ctx.beginPath(); ctx.ellipse(tip[0], tip[1], r, r * 0.86, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#a8502c'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(tip[0], tip[1], r * 0.55, r * 0.47, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#faf8f3'; ctx.lineWidth = 1.25; ctx.stroke();
    }
    return true; // keeps a slow sway once sealed
  });
  canvas.addEventListener('pointerdown', () => stage.replay());
}

/* ---------- Cloud: a paper plane loops through the card ---------- */

export function mountPlane(canvas) {
  const TONES = ['#ebe7de', '#cfc9bc', '#a9a397', '#7f7a70'];
  const MODEL = {
    N: [1.1, 0, 0], T: [-0.9, 0, 0], L: [-0.9, 0.1, -0.85], R: [-0.9, 0.1, 0.85], K: [-0.9, -0.34, 0],
  };
  const FACES = [['N', 'T', 'L'], ['N', 'T', 'R'], ['N', 'T', 'K']];
  const trail = [];
  const path = (s) => [1.55 * Math.sin(s), 0.28 * Math.sin(2 * s + 0.6), 0.85 * Math.sin(2 * s)];
  const d1 = (s) => [1.55 * Math.cos(s), 0.56 * Math.cos(2 * s + 0.6), 1.7 * Math.cos(2 * s)];
  const d2 = (s) => [-1.55 * Math.sin(s), -1.12 * Math.sin(2 * s + 0.6), -3.4 * Math.sin(2 * s)];
  stageFor(canvas, (ctx, { w, h }, t) => {
    const S = Math.min(w / 3.6, h / 1.3);
    const cx = w / 2, cy = h / 2, D = 7;
    const view = (v) => rotX(v, 0.42);
    const project = (v) => { const p = view(v); const k = D / (D - p[2]); return [cx + p[0] * S * k, cy - p[1] * S * k, p[2]]; };
    const s = reduce.matches ? 0.9 : t * 0.55;
    const P = path(s);
    const f = norm(d1(s));
    let right = norm(cross(f, [0, 1, 0]));
    let up = cross(right, f);
    const bank = Math.max(-1.1, Math.min(1.1, dot(d2(s), right) * 0.35));
    const c = Math.cos(bank), sn = Math.sin(bank);
    [up, right] = [[up[0] * c + right[0] * sn, up[1] * c + right[1] * sn, up[2] * c + right[2] * sn], [right[0] * c - up[0] * sn, right[1] * c - up[1] * sn, right[2] * c - up[2] * sn]];
    const k = 0.5;
    const world = {};
    for (const [key, v] of Object.entries(MODEL)) {
      world[key] = [P[0] + (f[0] * v[0] + up[0] * v[1] + right[0] * v[2]) * k, P[1] + (f[1] * v[0] + up[1] * v[1] + right[1] * v[2]) * k, P[2] + (f[2] * v[0] + up[2] * v[1] + right[2] * v[2]) * k];
    }
    // Dashed flight path behind the tail.
    trail.push(world.T);
    if (trail.length > 70) trail.shift();
    if (reduce.matches) { trail.length = 0; for (let q = 0; q < 70; q++) trail.push(path(s - (70 - q) * 0.012)); }
    ctx.setLineDash([2, 5]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#6f767f';
    ctx.beginPath();
    trail.forEach((p, i) => { const q = project(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.stroke();
    ctx.setLineDash([]);
    const faces = FACES.map((keys) => {
      const tri = keys.map((key) => world[key]);
      const pts = tri.map(project);
      return { pts, tone: toneOf(tri, TONES), z: (pts[0][2] + pts[1][2] + pts[2][2]) / 3 };
    }).sort((a, b) => a.z - b.z);
    ctx.lineJoin = 'round';
    for (const face of faces) facet(ctx, face.pts, face.tone, '#111214');
    return true;
  });
}
