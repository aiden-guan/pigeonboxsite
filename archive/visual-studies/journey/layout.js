// The world is a long strip: x runs across the screen, z runs down the page
// (the direction of travel) and y is altitude. Everything here is pure data or
// pure functions so terrain, painting and scenery agree with each other.
import { band, clamp, fbm, gauss, lerp, ridged, rng, smoothstep, noise } from './util.js';

export const X_HALF = 120;
export const Z_MIN = -240;
export const Z_MAX = 1680;
export const LAND = 0.6;

// Perches, in order. `y` is filled in once monuments are built.
export const STOPS = [
  { id: 'rooftop', name: 'The Rooftop', x: 0, z: 0 },
  { id: 'clock', name: 'The Clock Tower', x: -8, z: 190 },
  { id: 'windmill', name: 'The Old Windmill', x: 16, z: 420 },
  { id: 'lighthouse', name: 'Gull Point Lighthouse', x: -12, z: 640 },
  { id: 'pyramid', name: 'The Sand Pyramid', x: 10, z: 900 },
  { id: 'summit', name: 'Cairn Summit', x: -14, z: 1160 },
  { id: 'home', name: 'The Post Office', x: 0, z: 1420 },
];
export const OASIS = { x: 38, z: 812 };
export const LEG_CRUISE = [40, 36, 30, 34, 56, 46];

// Flight corridor centre, used to keep mountains out of the pigeon's way.
export function corridorX(z) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i], b = STOPS[i + 1];
    if (z <= b.z || i === STOPS.length - 2) return lerp(a.x, b.x, clamp((z - a.z) / (b.z - a.z)));
  }
  return 0;
}

export const riverX = (z) => -34 + 20 * Math.sin(z * 0.019 + 0.8) + 6 * Math.sin(z * 0.047);

export const biome = {
  city1: (z) => 1 - smoothstep(214, 252, z),
  fields: (z) => band(z, 225, 262, 466, 486),
  ocean: (z) => band(z, 474, 502, 712, 742),
  desert: (z) => band(z, 724, 750, 972, 1000),
  mount: (z) => band(z, 978, 1016, 1226, 1262),
  city2: (z) => smoothstep(1240, 1275, z),
};

const ISLETS = [
  { x: 42, z: 580, r: 7, h: 3.2 }, { x: 58, z: 600, r: 4, h: 2.2 }, { x: -60, z: 690, r: 9, h: 3.4 },
  { x: 30, z: 700, r: 5, h: 2.2 }, { x: -44, z: 560, r: 4, h: 1.8 },
];

function fieldsH(x, z) {
  let f = LAND + 2 + 5 * (fbm(x * 0.016 + 3, z * 0.016, 4, 5) - 0.45) + 1.4 * Math.sin(x * 0.04) * Math.sin(z * 0.031);
  const s = STOPS[2];
  f += 10 * gauss(x - s.x, z - s.z, 24);
  const d = Math.abs(x - riverX(z));
  const carve = (1 - smoothstep(4, 13, d)) * smoothstep(236, 280, z);
  return lerp(Math.max(f, LAND + 0.2), -1.9, carve);
}

function oceanH(x, z) {
  let o = -7 + 2.4 * fbm(x * 0.02, z * 0.02, 3, 9);
  const s = STOPS[3];
  const island = -7 + 12.5 * gauss(x - s.x, z - s.z, 17) + 1.2 * fbm(x * 0.12, z * 0.12, 2, 3);
  o = Math.max(o, Math.min(island, 3.1 + noise(x * 0.3, z * 0.3, 4) * 0.6));
  for (const i of ISLETS) o = Math.max(o, -6 + (i.h + 6) * gauss(x - i.x, z - i.z, i.r) + 0.8 * noise(x * 0.4, z * 0.4, 8));
  return o;
}

export function dunePhase(x, z) {
  const warp = 10 * Math.sin(z * 0.03 + x * 0.015) + 4 * Math.sin(z * 0.09 + 1.3);
  return (x + warp) * 0.2 + z * 0.035;
}
export function duneShape(x, z) {
  const s = 0.5 + 0.5 * Math.sin(dunePhase(x, z));
  return Math.pow(s, 2.2);
}
function desertH(x, z) {
  let d = LAND + 0.9 + 4.2 * duneShape(x, z) * (0.6 + 0.8 * fbm(x * 0.012, z * 0.012, 2, 14)) + 2.2 * fbm(x * 0.025, z * 0.025, 3, 12);
  d -= 6 * gauss(x - OASIS.x, z - OASIS.z, 12);
  const s = STOPS[4];
  return lerp(d, LAND + 0.5, clamp(gauss(x - s.x, z - s.z, 34) * 1.7));
}

function mountH(x, z) {
  const r = ridged(x * 0.011 + 7, z * 0.011, 5, 21);
  const high = LAND + 3 + 52 * Math.pow(r, 1.5);
  const corridor = smoothstep(5, 30, Math.abs(x - corridorX(z)));
  let m = lerp(LAND + 3 + 10 * r, high, 0.2 + 0.8 * corridor);
  const s = STOPS[5];
  const g = gauss(x - s.x, z - s.z, 20);
  m = Math.max(m, Math.min(40 * g + 5 * r * g, 38.5));
  return m;
}

function city2H(x, z) {
  let h = lerp(LAND, -5.5, smoothstep(60, 70, x));
  h = lerp(h, -6, smoothstep(1560, 1600, z));
  return h;
}

export function heightAt(x, z) {
  let h = LAND;
  const wf = biome.fields(z); if (wf > 0) h = lerp(h, fieldsH(x, z), wf);
  const wo = biome.ocean(z); if (wo > 0) h = lerp(h, oceanH(x, z), wo);
  const wd = biome.desert(z); if (wd > 0) h = lerp(h, desertH(x, z), wd);
  const wm = biome.mount(z); if (wm > 0) h = lerp(h, mountH(x, z), wm);
  const wc = biome.city2(z); if (wc > 0) h = lerp(h, city2H(x, z), wc);
  return h;
}

// Lighting and colour by position along the route: dawn to dusk.
export const SKY_KEYS = [
  { z: -40, top: '#7d95c9', horizon: '#f7c3a2', sun: '#ffc08e', sunI: 2.2, hemiSky: '#ffe2cf', hemiGround: '#797080', hemiI: 1.1, el: 22, az: -48, night: 0.15 },
  { z: 190, top: '#6fa6db', horizon: '#d6e8f0', sun: '#fff0d8', sunI: 2.8, hemiSky: '#eaf5ff', hemiGround: '#7d8466', hemiI: 1.15, el: 30, az: 70, night: 0 },
  { z: 420, top: '#5f9fdc', horizon: '#d2eaf4', sun: '#fffaf0', sunI: 3.0, hemiSky: '#eef8ff', hemiGround: '#7b8a5f', hemiI: 1.1, el: 46, az: 88, night: 0 },
  { z: 640, top: '#4f99dc', horizon: '#cdeaf6', sun: '#ffffff', sunI: 3.1, hemiSky: '#e8f6ff', hemiGround: '#5f8a8a', hemiI: 1.1, el: 58, az: 105, night: 0 },
  { z: 900, top: '#7aa8d6', horizon: '#f2d9ae', sun: '#ffdca0', sunI: 3.0, hemiSky: '#fff1dc', hemiGround: '#9a7a5a', hemiI: 0.95, el: 24, az: 122, night: 0 },
  { z: 1160, top: '#58619f', horizon: '#ff9d6e', sun: '#ff9458', sunI: 2.6, hemiSky: '#ffc9b0', hemiGround: '#5a4a6a', hemiI: 1.0, el: 11, az: 150, night: 0.25 },
  { z: 1420, top: '#17243b', horizon: '#52647b', sun: '#afc5e1', sunI: .65, hemiSky: '#a5b9d2', hemiGround: '#263047', hemiI: .65, el: 24, az: 290, night: 1 },
];

// Deterministic plans shared by the ground painter and the scenery builder.
export function cityPlan({ z0, z1, seed, style }) {
  const r = rng(seed);
  const roads = [], lots = [], plazas = [], parks = [];
  const blockW = style === 'old' ? 26 : 30, blockD = style === 'old' ? 22 : 26;
  const xs = [];
  for (let x = -X_HALF - 4; x < X_HALF + 30; x += blockW + r.range(-3, 3)) xs.push(x);
  const zs = [];
  for (let z = z0; z < z1 + blockD; z += blockD + r.range(-3, 3)) zs.push(z);
  const road = style === 'old' ? 4.2 : 5.2;
  const zEnd = Math.min(zs[zs.length - 1], z1 + 6), xEnd = style === 'new' ? 57 : xs[xs.length - 1];
  for (const x of xs) if (x < xEnd) roads.push({ x0: x - road / 2, z0: Math.max(zs[0], z0), x1: x + road / 2, z1: zEnd, axis: 'z', w: road, c: x });
  for (const z of zs) if (z <= zEnd) roads.push({ x0: xs[0], z0: z - road / 2, x1: xEnd, z1: z + road / 2, axis: 'x', w: road, c: z });

  const keepClear = [];
  if (style === 'old') {
    const clock = STOPS[1];
    plazas.push({ x: clock.x, z: clock.z, r: 22 });
    keepClear.push({ x: clock.x, z: clock.z, r: 23 });
    // A small square below the starting rooftop keeps the opening view open.
    parks.push({ x0: -16, z0: 2.5, x1: 13, z1: 24, kind: 'square' });
  } else {
    const home = STOPS[6];
    plazas.push({ x: home.x, z: home.z, r: 24 });
    keepClear.push({ x: home.x, z: home.z, r: 26 });
    // A long boulevard: the pigeon glides down it to land.
    parks.push({ x0: -9, z0: 1300, x1: 9, z1: home.z, kind: 'boulevard' });
  }
  const blocked = (x, z, pad = 0) => {
    for (const c of keepClear) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
    for (const p of parks) if (x > p.x0 - pad && x < p.x1 + pad && z > p.z0 - pad && z < p.z1 + pad) return true;
    if (style === 'new' && x > 56) return true; // harbour
    return false;
  };

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const bx0 = xs[i] + road / 2 + 1, bx1 = xs[i + 1] - road / 2 - 1;
      const bz0 = zs[j] + road / 2 + 1, bz1 = zs[j + 1] - road / 2 - 1;
      const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
      if (bz1 < z0 || bz0 > z1) continue;
      if (Math.abs(cx) > X_HALF + 10) continue;
      if (r() < (style === 'old' ? 0.07 : 0.1) && !blocked(cx, cz, 10) && Math.hypot(cx, cz) > 40) {
        parks.push({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, kind: 'park' });
        continue;
      }
      // Split the block into two rows of lots facing the streets.
      const rows = [[bz0, (bz0 + bz1) / 2 - 0.3], [(bz0 + bz1) / 2 + 0.3, bz1]];
      for (const [rz0, rz1] of rows) {
        let x = bx0;
        while (x < bx1 - 3) {
          const w = Math.min(style === 'old' ? r.range(4.5, 8) : r.range(7, 12), bx1 - x);
          const d = rz1 - rz0;
          const lx = x + w / 2, lz = (rz0 + rz1) / 2;
          x += w + (style === 'old' ? r.range(0, 0.4) : r.range(0.6, 1.8));
          if (w < 3 || blocked(lx, lz, Math.max(w, d) / 2)) continue;
          lots.push({ x: lx, z: lz, w: w - 0.2, d: d - (style === 'old' ? 0.2 : r.range(0.8, 2)), rnd: r() });
        }
      }
    }
  }
  return { roads, lots, plazas, parks, xs, zs, style };
}

export function fieldsPlan(seed = 42) {
  const r = rng(seed);
  const cells = [];
  const angle = 0.2;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const crops = [
    { fill: '#d9c46a', rows: '#c4ad52' }, { fill: '#9cc25c', rows: '#86ad4a' }, { fill: '#b7d27a', rows: '#a3bf66' },
    { fill: '#a98a62', rows: '#8f7250' }, { fill: '#e2cf82', rows: '#cbb466' }, { fill: '#7fae52', rows: '#6c9a44' },
    { fill: '#b69ac8', rows: '#9b80b0' }, { fill: '#c9d98a', rows: '#b2c374' },
  ];
  for (let u = -170; u < 170; u += 0) {
    const cw = r.range(16, 30);
    for (let v = 200; v < 520; v += 0) {
      const cd = r.range(14, 26);
      const cu = u + cw / 2, cv = v + cd / 2;
      const x = cu * ca - (cv - 360) * sa, z = cu * sa + (cv - 360) * ca + 360;
      cells.push({ x, z, w: cw - 1.4, d: cd - 1.4, angle, crop: r.pick(crops), rowAngle: r() < 0.5 ? 0 : Math.PI / 2, hedge: r() < 0.55, rnd: r() });
      v += cd;
    }
    u += cw;
  }
  return cells;
}
