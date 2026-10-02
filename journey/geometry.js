import * as THREE from '../vendor/three.min.js';

// Rounded edge profile with planar faces: highlights follow the bevel without
// turning architectural parts into inflated pillows. Dimensions include bevel.
export function beveledBox(w = 1, h = 1, d = 1, radius = 0.06) {
  const r = Math.min(radius, w / 3, h / 3, d / 3);
  const x = w / 2 - r, y = h / 2 - r;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -y); shape.lineTo(x, -y);
  shape.lineTo(x, y); shape.lineTo(-x, y); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - 2 * r, bevelEnabled: true, bevelSegments: 3,
    steps: 1, bevelSize: r, bevelThickness: r, curveSegments: 1,
  });
  geo.translate(0, 0, -d / 2 + r);
  return geo;
}

export function canopyGeometry(variant = 0) {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = i * 2.4 + variant * .8;
    const g = new THREE.SphereGeometry(1, 10, 7);
    const r = .60 + (i % 2) * .14;
    g.scale(r, r * (1.05 + variant * .07), r * .92);
    g.translate(Math.cos(a) * .40, 1.35 + (i % 3) * .25, Math.sin(a) * .38);
    parts.push(g);
  }
  return merge(parts);
}

export function pineGeometry(variant = 0) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const scale = 1 - i * .22;
    const profile = [[0,0],[.55,.04],[.92,.14],[1,.26],[.88,.40],[.67,.70],[.40,1.02],[.12,1.31],[0,1.42]];
    const g = new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r * scale,y * scale)),12);
    g.translate(Math.sin(i+variant)*.07,.45+i*.72,Math.cos(i+variant)*.05);
    parts.push(g);
  }
  return merge(parts);
}

export function weatheredRock(variant = 0) {
  const g = new THREE.SphereGeometry(1, 12, 8);
  const p = g.attributes.position;
  for (let i=0;i<p.count;i++) {
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const r=1+.09*Math.sin(x*4+variant)*Math.cos(z*3-y*2);
    p.setXYZ(i,x*r,y*r*.83,z*r);
  }
  g.computeVertexNormals();
  return g;
}

export function beveledPrism() {
  const shape=new THREE.Shape();
  shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(0,1);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:.97,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:3,steps:1});
  g.translate(0,0,-.485);return g;
}

export function beveledFrustum(bottom,top,height,radius=.12) {
  const g=beveledBox(bottom,height,bottom,radius),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const t=Math.max(0,Math.min(1,p.getY(i)/height+.5));
    const scale=1+(top/bottom-1)*t;
    p.setX(i,p.getX(i)*scale);p.setZ(i,p.getZ(i)*scale);
  }
  g.computeVertexNormals();return g;
}

export function boatGeometry(width,height,length) {
  const shape=new THREE.Shape([
    [-.46,.45],[.46,.45],[.49,-.1],[.24,-.40],[0,-.5],[-.24,-.40],[-.49,-.1],
  ].map(([x,z])=>new THREE.Vector2(x*width,z*length)));
  const g=new THREE.ExtrudeGeometry(shape,{depth:height*.8,bevelEnabled:true,bevelSize:Math.min(width*.08,.15),bevelThickness:height*.1,bevelSegments:2,steps:1});
  g.rotateX(-Math.PI/2);g.translate(0,-height*.4,0);return g;
}

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

// Curved, closed fronds retain a readable silhouette from below and in flight.
export function palmCrownGeometry() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.SphereGeometry(1, 10, 6);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const t = (p.getX(k) + 1) / 2;
      p.setXYZ(k, t * 2.6, p.getY(k) * .055 + Math.sin(t * Math.PI) * .38 - t * t * .6, p.getZ(k) * .35);
    }
    g.computeVertexNormals();
    g.rotateY(i / 7 * Math.PI * 2);
    parts.push(g);
  }
  return merge(parts);
}
