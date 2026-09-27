import * as THREE from '../vendor/three.min.js';

// Gable roof: triangular prism, 1×1×1, base at y=0, ridge along z.
// `caps` are the triangular gable ends; `slopes` are the two roof planes.
export function prismGeometry({ caps = true, slopes = true } = {}) {
  const p = [
    [-0.5, 0, -0.5], [0.5, 0, -0.5], [0, 1, -0.5],
    [-0.5, 0, 0.5], [0.5, 0, 0.5], [0, 1, 0.5],
  ];
  const tris = [];
  if (caps) tris.push([0, 2, 1], [3, 4, 5]);
  if (slopes) tris.push([0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4]);
  if (caps && slopes) tris.push([0, 1, 4], [0, 4, 3]);
  const pos = [];
  for (const t of tris) for (const i of t) pos.push(...p[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Hip roof: square pyramid 1×1 base at y=0, apex at y=1.
export function pyramidGeometry() {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  g.translate(0, 0.5, 0);
  return g.toNonIndexed();
}

export function boxGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  return g;
}

// Merge non-indexed geometries (position + normal only).
export function merge(geoms) {
  const parts = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// A cumulus puff: smooth blobs merged into one geometry with sphere normals.
export function cloudGeometry(seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const parts = [];
  const blob = (rad, sx, sy, sz, x, y, z) => {
    const g = new THREE.IcosahedronGeometry(rad, 2);
    const p = g.attributes.position;
    const n = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const l = Math.hypot(p.getX(i), p.getY(i), p.getZ(i));
      n[i * 3] = p.getX(i) / l; n[i * 3 + 1] = p.getY(i) / l; n[i * 3 + 2] = p.getZ(i) / l;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    parts.push(g);
  };
  const count = 4 + Math.floor(r() * 4);
  for (let i = 0; i < count; i++) {
    const rad = 1.2 + r() * 1.4 * (1 - Math.abs(i - count / 2) / count);
    blob(rad, 1, 0.8, 1, (i - count / 2) * 1.35 + r() * 0.5, r() * 0.6, (r() - 0.5) * 1.8);
  }
  blob(2, count * 0.55, 0.32, 1.25, -0.3, -0.4, 0);
  return merge(parts);
}

// Flat palm crown seen from above: radiating leaves.
export function palmCrownGeometry() {
  const pos = [];
  const leaves = 7;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const side = 0.32;
    const pts = [[0, 0.2, 0], [1.1, 0.12, side], [2.4, -0.45, 0], [1.1, 0.12, -side]];
    const rot = pts.map(([x, y, z]) => [x * ca - z * sa, y, x * sa + z * ca]);
    pos.push(...rot[0], ...rot[1], ...rot[2], ...rot[0], ...rot[2], ...rot[3]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
