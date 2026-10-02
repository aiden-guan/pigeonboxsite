// Everything that fills the world between landmarks.
import * as THREE from '../vendor/three.min.js';
import { STOPS, X_HALF, heightAt, biome, riverX, OASIS, corridorX, LEG_CRUISE } from './layout.js';
import { boxGeometry, prismGeometry, pyramidGeometry, cloudGeometry, palmCrownGeometry, canopyGeometry, pineGeometry, weatheredRock, beveledBox, beveledPrism, merge, boatGeometry } from './geometry.js';
import { lambert, windowMaterial, glowMap, shared } from './materials.js';
import { rng, fbm, noise, clamp } from './util.js';

const dummy = new THREE.Object3D();
const tint = new THREE.Color();

function instanced(geo, material, items, { cast = true, receive = true, variants = true, regions = true } = {}) {
  if (!items.length) return null;
  if(regions&&items.length>80){
    const buckets=new Map();
    for(const item of items){const key=Math.floor(item.z/160);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item);}
    if(buckets.size>1){
      const group=new THREE.Group();
      for(const list of buckets.values())group.add(instanced(geo,material,list,{cast,receive,variants,regions:false}));
      return group;
    }
  }
  const kit = variants && (geo === GEO.blob ? CANOPIES : geo === GEO.pine ? PINES_GEO : geo === GEO.rock ? ROCKS : null);
  if (kit) {
    const group = new THREE.Group();
    kit.forEach((geometry, k) => {
      const part = instanced(geometry, material, items.filter((_, i) => i % kit.length === k), {cast, receive, variants:false,regions:false});
      if (part) group.add(part);
    });
    return group;
  }
  const m = new THREE.InstancedMesh(geo, material, items.length);
  items.forEach((it, i) => {
    dummy.position.set(it.x, it.y, it.z);
    dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    dummy.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    if (it.color) m.setColorAt(i, tint.set(it.color));
  });
  m.userData.optionalVegetation = CANOPIES.includes(geo) || PINES_GEO.includes(geo) || ROCKS.includes(geo) || geo === GEO.trunk || geo === GEO.palm;
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.computeBoundingSphere();
  return m;
}

const GEO = {
  box: beveledBox(1,1,1,.012).translate(0,.5,0),
  prism: prismGeometry(),
  roof: beveledPrism(),
  pyramid: pyramidGeometry(),
  blob: (() => { return canopyGeometry(); })(),
  pine: (() => { return pineGeometry(); })(),
  trunk: (() => { const g = new THREE.CylinderGeometry(0.13, 0.22, 1, 10, 3); g.translate(0, 0.5, 0); return g; })(),
  palm: (() => { const g = palmCrownGeometry(); return g; })(),
  rock: weatheredRock(),
  mesa: (() => { const g = new THREE.CylinderGeometry(1, 1.18, 1, 7); g.translate(0, 0.5, 0); return g; })(),
  car: (() => { return merge([beveledBox(1.1,.42,2.2,.14).translate(0,.28,0),beveledBox(.90,.38,1.1,.12).translate(0,.64,-.1)]); })(),
};

const CANOPIES = [GEO.blob, canopyGeometry(1), canopyGeometry(2)];
const PINES_GEO = [GEO.pine, pineGeometry(1)];
const ROCKS = [GEO.rock, weatheredRock(2)];

const FACADES_OLD = ['#f2e3c6', '#ecc9b0', '#f1d9a2', '#c9dbe0', '#f3eee5', '#e7c2a6', '#dfe2c3', '#f0d0c0'];
const ROOFS_OLD = ['#c4643f', '#b85a3b', '#d27a52', '#a95237', '#cf8a5c', '#9b5a48', '#7a7f8c'];
const FACADES_NEW = ['#d9d4cc', '#b9c3cc', '#a2adb9', '#e3dbcf', '#c9b8a6', '#8f9ba8', '#cfc9d6', '#b0a79d'];
const GREENS = ['#5f9444', '#6fa04a', '#4f8540', '#7aa852', '#86b05a', '#58903f'];
const PINES = ['#3f6f45', '#4a7a4c', '#355f3e', '#2f5a3c'];

function buildCity(plan, out, env) {
  const r = rng(plan.style === 'old' ? 101 : 202);
  const bodies = [], gables = [], gableWalls = [], hips = [], details = [], trees = [], trunks = [];
  const rooftop = STOPS[0];
  for (const lot of plan.lots) {
    const g = heightAt(lot.x, lot.z);
    if (plan.style === 'old') {
      if (Math.abs(lot.x - rooftop.x) < 4 + lot.w / 2 && lot.z + lot.d / 2 > rooftop.z - 10 && lot.z - lot.d / 2 < rooftop.z + 1.4) continue;
      const nearStart = Math.hypot(lot.x - rooftop.x, lot.z - rooftop.z) < 20;
      const h = nearStart ? r.range(4, 6.5) : 4.5 + Math.pow(lot.rnd, 1.4) * 9;
      const facade = r.pick(FACADES_OLD);
      bodies.push({ x: lot.x, y: g, z: lot.z, sx: lot.w, sy: h, sz: lot.d, color: facade });
      const kind = r();
      const roofColor = r.pick(ROOFS_OLD);
      if (kind < 0.72) {
        const along = lot.w > lot.d;
        const span = along ? lot.d : lot.w, len = along ? lot.w : lot.d;
        const rh = span * r.range(0.32, 0.5);
        gables.push({ x: lot.x, y: g + h, z: lot.z, sx: span + 0.5, sy: rh, sz: len + 0.4, ry: along ? Math.PI / 2 : 0, color: roofColor });
        gableWalls.push({ x: lot.x, y: g + h - 0.02, z: lot.z, sx: span, sy: rh * 0.97, sz: len, ry: along ? Math.PI / 2 : 0, color: facade });
        if (r() < 0.3) details.push({ x: lot.x + r.range(-1, 1), y: g + h, z: lot.z + r.range(-1.5, 1.5), sx: 0.7, sy: span * 0.55, sz: 0.7, color: '#9a4d36' });
      } else if (kind < 0.9) {
        hips.push({ x: lot.x, y: g + h, z: lot.z, sx: lot.w + 0.4, sy: Math.min(lot.w, lot.d) * 0.42, sz: lot.d + 0.4, color: roofColor });
      } else {
        details.push({ x: lot.x, y: g + h, z: lot.z, sx: lot.w + 0.3, sy: 0.4, sz: lot.d + 0.3, color: '#e8dccb' });
        if (r() < 0.6) trees.push({ x: lot.x + r.range(-1, 1), y: g + h + 0.4, z: lot.z, sx: 0.8, sy: 0.7, sz: 0.8, color: r.pick(GREENS) });
      }
    } else {
      const home = STOPS[6];
      const dHome = Math.hypot(lot.x - home.x, lot.z - home.z);
      let h = 9 + Math.pow(lot.rnd, 1.5) * 32;
      if (dHome < 46) h = Math.min(h, 7 + (dHome / 46) * 12);
      if (Math.abs(lot.x) < 18) h = Math.min(h, 16);
      bodies.push({ x: lot.x, y: g, z: lot.z, sx: lot.w, sy: h, sz: lot.d, color: r.pick(FACADES_NEW) });
      details.push({ x: lot.x, y: g + h, z: lot.z, sx: lot.w + 0.25, sy: 0.5, sz: lot.d + 0.25, color: '#6f7480' });
      if (h > 22 && r() < 0.5) {
        const sh = r.range(4, 10);
        bodies.push({ x: lot.x, y: g + h, z: lot.z, sx: lot.w * 0.62, sy: sh, sz: lot.d * 0.62, color: r.pick(FACADES_NEW) });
      } else {
        for (let k = 0; k < 2; k++) details.push({ x: lot.x + r.range(-lot.w / 4, lot.w / 4), y: g + h + 0.5, z: lot.z + r.range(-lot.d / 4, lot.d / 4), sx: r.range(0.8, 1.8), sy: r.range(0.6, 1.4), sz: r.range(0.8, 1.8), color: '#b9bcc4' });
        if (r() < 0.25) trees.push({ x: lot.x, y: g + h + 0.5, z: lot.z, sx: 1, sy: 0.8, sz: 1, color: r.pick(GREENS) });
      }
    }
  }
  for (const p of plan.parks) {
    if (p.kind === 'square') {
      for (let x = p.x0 + 1.5; x < p.x1; x += 4.5) for (const z of [p.z0 + 1.5, p.z1 - 1.5]) {
        const s = r.range(1, 1.4);
        trees.push({ x, y: heightAt(x, z), z, sx: s, sy: s * 1.15, sz: s, color: r.pick(GREENS) });
        trunks.push({ x, y: heightAt(x, z), z, sx: s, sy: 1.5, sz: s });
      }
      continue;
    }
    if (p.kind === 'boulevard') {
      for (let z = p.z0 + 2; z < p.z1 - 18; z += 5) for (const x of [-6.5, 6.5]) {
        const s = r.range(1.1, 1.5);
        trees.push({ x, y: heightAt(x, z), z, sx: s, sy: s * 1.2, sz: s, color: r.pick(GREENS) });
        trunks.push({ x, y: heightAt(x, z), z, sx: s, sy: 1.6, sz: s });
      }
      continue;
    }
    const n = Math.floor(((p.x1 - p.x0) * (p.z1 - p.z0)) / 30);
    for (let i = 0; i < n; i++) {
      const x = r.range(p.x0 + 1.5, p.x1 - 1.5), z = r.range(p.z0 + 1.5, p.z1 - 1.5);
      const s = r.range(1, 2);
      trees.push({ x, y: heightAt(x, z), z, sx: s, sy: s * 1.1, sz: s, color: r.pick(GREENS) });
      trunks.push({ x, y: heightAt(x, z), z, sx: s, sy: 1.4, sz: s });
    }
  }
  for (const pl of plan.plazas) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
      const x = pl.x + Math.cos(a) * (pl.r - 2), z = pl.z + Math.sin(a) * (pl.r - 2);
      if (plan.style === 'new' && Math.abs(x) < 10 && z < pl.z) continue;
      if (plan.style === 'old' && Math.abs(x - pl.x) < 8 && z > pl.z) continue;
      trees.push({ x, y: heightAt(x, z), z, sx: 1.3, sy: 1.5, sz: 1.3, color: r.pick(GREENS) });
      trunks.push({ x, y: heightAt(x, z), z, sx: 1.3, sy: 1.5, sz: 1.3 });
    }
  }
  // The same kit supplies a base course and eave to every lot. These remain
  // in the shared detail batch rather than becoming individual scene objects.
  for (const b of bodies) {
    details.push({x:b.x,y:b.y+.06,z:b.z,sx:b.sx+.12,sy:.22,sz:b.sz+.12,color:'#c9baa2'});
    details.push({x:b.x,y:b.y+b.sy-.2,z:b.z,sx:b.sx+.22,sy:.24,sz:b.sz+.22,color:'#e4d7bd'});
  }
  const wallMat = windowMaterial({ spacing: plan.style === 'old' ? [1.9, 2.5] : [1.5, 2.2], glass: plan.style === 'old' ? '#3d4a5a' : '#2a3b52' });
  out.push(instanced(GEO.box, wallMat, bodies));
  out.push(instanced(GEO.roof, lambert('#ffffff', { side: THREE.DoubleSide }), gables));
  out.push(instanced(GEO.prism, wallMat, gableWalls));
  out.push(instanced(GEO.pyramid, lambert('#ffffff'), hips));
  out.push(instanced(GEO.box, lambert('#ffffff'), details));
  out.push(instanced(GEO.blob, lambert('#ffffff'), trees));
  out.push(instanced(GEO.trunk, lambert('#6b4b35'), trunks));

  // Traffic.
  const cars = [];
  for (const road of plan.roads) {
    const len = road.axis === 'z' ? road.z1 - road.z0 : road.x1 - road.x0;
    const count = Math.floor(len / (plan.style === 'old' ? 34 : 18));
    for (let i = 0; i < count; i++) {
      const dir = r() < 0.5 ? 1 : -1;
      cars.push({ road, dir, t: r(), speed: r.range(5, 9) / len, color: r.pick(['#e2574c', '#f4f1ea', '#2f5d8a', '#ffd95e', '#3b3f48', '#7fb0c9', '#c9d1d9', '#5d9f8e']) });
    }
  }
  const offRoad = (x, z) => plan.plazas.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 3) || plan.parks.some((p) => { const m = p.kind === 'park' ? -0.5 : 3; return x > p.x0 - m && x < p.x1 + m && z > p.z0 - m && z < p.z1 + m; });
  const carMesh = new THREE.InstancedMesh(GEO.car, lambert('#ffffff'), cars.length);
  cars.forEach((c, i) => carMesh.setColorAt(i, tint.set(c.color)));
  carMesh.castShadow = true;
  carMesh.frustumCulled = false;
  out.push(carMesh);
  const lights = plan.style === 'new' ? new Float32Array(cars.length * 6) : null;
  let lightGeo = null;
  if (lights) {
    lightGeo = new THREE.BufferGeometry();
    lightGeo.setAttribute('position', new THREE.BufferAttribute(lights, 3));
    const colors = new Float32Array(cars.length * 6);
    for (let i = 0; i < cars.length; i++) { colors.set([1, 0.9, 0.65], i * 6); colors.set([1, 0.25, 0.2], i * 6 + 3); }
    lightGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const pts = new THREE.Points(lightGeo, new THREE.PointsMaterial({ size: 1.6, map: glowMap(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    pts.frustumCulled = false;
    out.push(pts);
    env.carLights = pts;
  }
  return {
    update(dt, night) {
      cars.forEach((c, i) => {
        c.t = (c.t + c.speed * dt * c.dir + 1) % 1;
        const road = c.road;
        const lane = c.dir * 1.1;
        let x, z, ry;
        if (road.axis === 'z') { x = road.c + lane; z = road.z0 + (road.z1 - road.z0) * c.t; ry = c.dir > 0 ? 0 : Math.PI; }
        else { z = road.c - lane; x = road.x0 + (road.x1 - road.x0) * c.t; ry = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        const hidden = offRoad(x, z);
        const y = hidden ? -50 : 0.62;
        dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        carMesh.setMatrixAt(i, dummy.matrix);
        if (lights) {
          const fx = Math.sin(ry) * 1.2, fz = Math.cos(ry) * 1.2;
          lights.set([x + fx, y + 0.5, z + fz, x - fx, y + 0.5, z - fz], i * 6);
        }
      });
      carMesh.instanceMatrix.needsUpdate = true;
      if (lightGeo) {
        lightGeo.attributes.position.needsUpdate = true;
        env.carLights.material.opacity = night;
      }
    },
  };
}

function buildFields(cells, out) {
  const r = rng(303);
  const bushes = [], trees = [], trunks = [], sheep = [], houses = [], gables = [], walls = [];
  const windmill = STOPS[2];
  for (const cell of cells) {
    const wf = biome.fields(cell.z);
    if (wf < 0.7) continue;
    if (Math.abs(cell.x) > X_HALF - 4) continue;
    const ca = Math.cos(cell.angle), sa = Math.sin(cell.angle);
    const toWorld = (u, v) => [cell.x + u * ca - v * sa, cell.z + u * sa + v * ca];
    if (cell.hedge) {
      for (let u = -cell.w / 2; u < cell.w / 2; u += 1.7) {
        const [x, z] = toWorld(u, -cell.d / 2 - 0.7);
        if (heightAt(x, z) < 1 || Math.hypot(x - windmill.x, z - windmill.z) < 14) continue;
        const s = r.range(0.55, 0.9);
        bushes.push({ x, y: heightAt(x, z) - 0.3, z, sx: s, sy: s * 0.8, sz: s, color: r.pick(['#4d7d3c', '#5b8a44', '#44723a']) });
      }
    }
    if (cell.rnd < 0.08) {
      // Farmhouse with a barn.
      const [x, z] = toWorld(0, 0);
      if (Math.abs(x - riverX(z)) < 12 || Math.hypot(x - windmill.x, z - windmill.z) < 20) continue;
      const g = heightAt(x, z);
      houses.push({ x, y: g - 0.3, z, sx: 5, sy: 3.4, sz: 4, ry: cell.angle, color: '#f3ede2' });
      gables.push({ x, y: g + 3.1, z, sx: 4.4, sy: 2, sz: 5.5, ry: cell.angle + Math.PI / 2, color: '#b8503b' });
      walls.push({ x, y: g + 3.08, z, sx: 4, sy: 1.95, sz: 5, ry: cell.angle + Math.PI / 2, color: '#f3ede2' });
      const [bx, bz] = toWorld(6, 2);
      houses.push({ x: bx, y: heightAt(bx, bz) - 0.3, z: bz, sx: 4, sy: 4, sz: 7, ry: cell.angle, color: '#b0473b' });
      gables.push({ x: bx, y: heightAt(bx, bz) + 3.7, z: bz, sx: 4.6, sy: 2.4, sz: 7.4, ry: cell.angle, color: '#6f727b' });
      walls.push({ x: bx, y: heightAt(bx, bz) + 3.68, z: bz, sx: 4, sy: 2.35, sz: 7, ry: cell.angle, color: '#b0473b' });
      for (let k = 0; k < 5; k++) {
        const [tx, tz] = toWorld(r.range(-6, 6), r.range(-6, -3));
        const s = r.range(1.2, 2);
        trees.push({ x: tx, y: heightAt(tx, tz) - 0.2, z: tz, sx: s, sy: s * 1.1, sz: s, color: r.pick(GREENS) });
        trunks.push({ x: tx, y: heightAt(tx, tz) - 0.2, z: tz, sx: s, sy: 1.4, sz: s });
      }
    } else if (cell.crop.fill === '#9cc25c' || cell.crop.fill === '#7fae52') {
      const n = r.int(0, 8);
      for (let k = 0; k < n; k++) {
        const [x, z] = toWorld(r.range(-cell.w / 2 + 1, cell.w / 2 - 1), r.range(-cell.d / 2 + 1, cell.d / 2 - 1));
        if (heightAt(x, z) < 1.2) continue;
        sheep.push({ x, y: heightAt(x, z) + 0.1, z, sx: 0.55, sy: 0.4, sz: 0.75, ry: r.range(0, 6), color: '#f6f3ec' });
      }
    }
  }
  // Woods and river banks.
  for (let i = 0; i < 1300; i++) {
    const x = r.range(-X_HALF + 2, X_HALF - 2), z = r.range(240, 482);
    if (biome.fields(z) < 0.6) continue;
    const nearRiver = Math.abs(x - riverX(z)) < 12 && Math.abs(x - riverX(z)) > 5;
    const wood = fbm(x * 0.03 + 11, z * 0.03, 3, 44) > 0.6;
    if (!nearRiver && !wood) continue;
    if (Math.hypot(x - windmill.x, z - windmill.z) < 18) continue;
    const g = heightAt(x, z);
    if (g < 1) continue;
    const s = r.range(1.1, 2.1);
    trees.push({ x, y: g - 0.2, z, sx: s, sy: s * r.range(1, 1.3), sz: s, color: r() < 0.08 ? '#c9a24a' : r.pick(GREENS) });
    trunks.push({ x, y: g - 0.2, z, sx: s, sy: 1.5, sz: s });
  }
  out.push(instanced(GEO.blob, lambert('#ffffff'), bushes));
  out.push(instanced(GEO.blob, lambert('#ffffff'), trees));
  out.push(instanced(GEO.trunk, lambert('#6b4b35'), trunks));
  out.push(instanced(new THREE.SphereGeometry(1, 10, 7), lambert('#ffffff'), sheep));
  out.push(instanced(GEO.box, lambert('#ffffff'), houses));
  out.push(instanced(GEO.roof, lambert('#ffffff', { side: THREE.DoubleSide }), gables));
  out.push(instanced(GEO.prism, lambert('#ffffff'), walls));
}

function stripedBalloon(a, b) {
  const g = new THREE.SphereGeometry(3, 12, 10).toNonIndexed();
  g.scale(1, 1.18, 1);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const seg = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 12);
    const c = seg % 2 ? ca : cb;
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function buildBalloons(scene) {
  const specs = [
    { x: -40, y: 34, z: 300, a: '#e2574c', b: '#ffe17c' }, { x: 36, y: 42, z: 340, a: '#4f8fc0', b: '#f4f1ea' },
    { x: -26, y: 26, z: 470, a: '#79b86a', b: '#ffe17c' }, { x: 52, y: 30, z: 262, a: '#b36ad0', b: '#ffd0a0' },
    { x: 40, y: 38, z: 1010, a: '#ff8a5c', b: '#f4f1ea' },
  ];
  const balloons = specs.map((s, i) => {
    const group = new THREE.Group();
    const env = new THREE.Mesh(stripedBalloon(s.a, s.b), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), lambert('#8a5a34'));
    basket.position.y = -4.6;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 5), lambert('#ffcf6b', { emissive: '#ff9a30' }));
    flame.position.y = -3.5;
    group.add(env, basket, flame);
    group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.position.set(s.x, s.y, s.z);
    scene.add(group);
    return { group, base: s, phase: i * 1.7 };
  });
  return (t) => {
    for (const b of balloons) {
      b.group.position.y = b.base.y + Math.sin(t * 0.4 + b.phase) * 0.8;
      b.group.position.x = b.base.x + Math.sin(t * 0.05 + b.phase) * 4;
      b.group.rotation.y = t * 0.05 + b.phase;
    }
  };
}

function buildOcean(scene, out) {
  const r = rng(404);
  const boats = [];
  const wakeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
  const wakeGeo = new THREE.BufferGeometry();
  wakeGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -1.8, 0, -9, 1.8, 0, -9], 3));
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const cargo = i === 0;
    const len = cargo ? 16 : r.range(2.6, 3.6);
    const hull = new THREE.Mesh(boatGeometry(cargo ? 3.6 : 1.2, 0.8, len), lambert(cargo ? '#2f3a4a' : r.pick(['#f4f1ea', '#f4f1ea', '#2f5d8a', '#e2574c'])));
    hull.position.y = 0.3;
    g.add(hull);
    if (cargo) {
      const cols = ['#e2574c', '#4f8fc0', '#ffd95e', '#79b86a', '#f28d3c'];
      for (let k = 0; k < 10; k++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 2.4), lambert(cols[(k * 3) % cols.length]));
        c.position.set((k % 2) * 1.5 - 0.75, 1.2, -5.5 + Math.floor(k / 2) * 2.6);
        g.add(c);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 2), lambert('#f4f1ea'));
      bridge.position.set(0, 1.6, -7);
      g.add(bridge);
    } else if (r() < 0.75) {
      const sail = new THREE.Mesh(prismGeometry(), lambert('#fbfaf6'));
      sail.scale.set(0.12, 3.6, 2.2);
      sail.position.y = 0.7;
      g.add(sail);
    }
    const wake = new THREE.Mesh(wakeGeo, wakeMat);
    wake.position.set(0, 0.05, -len / 2 + 0.4);
    wake.scale.setScalar(cargo ? 2.2 : 1);
    g.add(wake);
    g.traverse((o) => { if (o.isMesh && o !== wake) o.castShadow = true; });
    const x = cargo ? 70 : r.range(-100, 100), z = cargo ? 560 : r.range(520, 705);
    if (Math.hypot(x - STOPS[3].x, z - STOPS[3].z) < 26) continue;
    g.position.set(x, 0, z);
    g.rotation.y = r.range(0, Math.PI * 2);
    scene.add(g);
    boats.push({ g, speed: cargo ? 1.2 : r.range(1.5, 3.2) });
  }
  // Harbour boats at the final city.
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(boatGeometry(1.3, 0.8, 3.4), lambert(r.pick(['#f4f1ea', '#2f5d8a', '#e2574c', '#ffd95e'])));
    hull.position.y = 0.3;
    g.add(hull);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4, 0.1), lambert('#d9d4cc'));
    mast.position.y = 2.3;
    g.add(mast);
    g.position.set(62 + (i % 2) * 7, 0, 1300 + Math.floor(i / 2) * 36 + 5);
    g.rotation.y = Math.PI / 2;
    scene.add(g);
  }
  // Gulls.
  const gulls = [];
  const gullMat = lambert('#ffffff', { side: THREE.DoubleSide });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.3, 1.1, 0, 0, 0, 0, -0.3], 3));
  wingGeo.computeVertexNormals();
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const l = new THREE.Mesh(wingGeo, gullMat), rgt = new THREE.Mesh(wingGeo, gullMat);
    rgt.scale.x = -1;
    const bodyM = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.9), gullMat);
    g.add(l, rgt, bodyM);
    g.scale.setScalar(1.3);
    scene.add(g);
    gulls.push({ g, l, r: rgt, cx: r.range(-60, 60), cz: r.range(500, 740), rad: r.range(10, 26), y: r.range(8, 22), speed: r.range(0.2, 0.4) * (r() < 0.5 ? 1 : -1), ph: r() * 6 });
  }
  return (t, dt) => {
    for (const b of boats) {
      b.g.position.x += Math.sin(b.g.rotation.y) * b.speed * dt;
      b.g.position.z += Math.cos(b.g.rotation.y) * b.speed * dt;
      b.g.position.y = Math.sin(t * 1.3 + b.g.position.x) * 0.08;
      if (b.g.position.x > X_HALF + 30) b.g.position.x = -X_HALF - 30;
      if (b.g.position.x < -X_HALF - 30) b.g.position.x = X_HALF + 30;
      if (b.g.position.z > 712) b.g.position.z = 515;
      if (b.g.position.z < 512) b.g.position.z = 710;
    }
    for (const g of gulls) {
      const a = t * g.speed + g.ph;
      g.g.position.set(g.cx + Math.cos(a) * g.rad, g.y + Math.sin(t + g.ph) * 1.5, g.cz + Math.sin(a) * g.rad);
      g.g.rotation.y = -a + (g.speed > 0 ? 0 : Math.PI);
      const f = Math.sin(t * 7 + g.ph) * 0.5;
      g.l.rotation.z = f; g.r.rotation.z = -f;
    }
  };
}

function buildDesert(scene, out) {
  const r = rng(505);
  const palms = [], trunks = [], rocks = [], mesas = [], tents = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r.range(-0.1, 0.1), rad = r.range(12, 19);
    const x = OASIS.x + Math.cos(a) * rad, z = OASIS.z + Math.sin(a) * rad;
    const g = heightAt(x, z);
    const h = r.range(4, 6.5);
    trunks.push({ x, y: g, z, sx: 1.2, sy: h, sz: 1.2, rz: r.range(-0.15, 0.15) });
    palms.push({ x, y: g + h, z, sx: 1.3, sy: 1.3, sz: 1.3, ry: r.range(0, 6), color: r.pick(['#4f8a3c', '#5e9a45', '#3f7a35']) });
  }
  tents.push({ x: OASIS.x - 20, y: heightAt(OASIS.x - 20, OASIS.z + 6), z: OASIS.z + 6, sx: 3, sy: 3, sz: 3, color: '#f4efe4' });
  tents.push({ x: OASIS.x - 25, y: heightAt(OASIS.x - 25, OASIS.z - 3), z: OASIS.z - 3, sx: 2.6, sy: 2.4, sz: 2.6, color: '#d8603f' });
  for (let i = 0; i < 26; i++) {
    const x = r.range(-X_HALF, X_HALF), z = r.range(760, 985);
    if (Math.abs(x - corridorX(z)) < 34 || Math.hypot(x - OASIS.x, z - OASIS.z) < 30 || Math.hypot(x - STOPS[4].x, z - STOPS[4].z) < 50) continue;
    const s = r.range(6, 14);
    mesas.push({ x, y: heightAt(x, z) - 1, z, sx: s, sy: r.range(4, 11), sz: s * r.range(0.7, 1.3), ry: r.range(0, 6), color: r.pick(['#c9794d', '#b8683f', '#d68a58']) });
  }
  for (let i = 0; i < 160; i++) {
    const x = r.range(-X_HALF, X_HALF), z = r.range(750, 990);
    const s = r.range(0.4, 1.4);
    rocks.push({ x, y: heightAt(x, z), z, sx: s, sy: s * 0.6, sz: s, rx: r() * 3, ry: r() * 3, color: r.pick(['#b98a5f', '#a87a52', '#caa070']) });
  }
  // Dry scrub dotted across the sand.
  const scrub = [];
  for (let i = 0; i < 700; i++) {
    const x = r.range(-X_HALF, X_HALF), z = r.range(748, 988);
    if (fbm(x * 0.05, z * 0.05, 2, 91) < 0.52) continue;
    const s = r.range(0.35, 0.8);
    scrub.push({ x, y: heightAt(x, z) - 0.1, z, sx: s, sy: s * 0.6, sz: s, color: r.pick(['#8a8a4a', '#9a8f55', '#7b7d45']) });
  }
  out.push(instanced(GEO.blob, lambert('#ffffff'), scrub));
  out.push(instanced(GEO.trunk, lambert('#8a6a48'), trunks));
  out.push(instanced(GEO.palm, lambert('#ffffff', { side: THREE.DoubleSide }), palms));
  out.push(instanced(GEO.mesa, lambert('#ffffff'), mesas));
  out.push(instanced(GEO.rock, lambert('#ffffff'), rocks));
  out.push(instanced(new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0), lambert('#ffffff'), tents));
  // A small camel caravan.
  const camels = [];
  const camelMat = lambert('#b8844f');
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 1.5), camelMat); b.position.y = 1.3;
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 4), camelMat); hump.position.y = 1.75;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), camelMat); neck.position.set(0, 1.8, 0.8); neck.rotation.x = 0.5;
    g.add(b, hump, neck);
    for (const [lx, lz] of [[0.25, 0.5], [-0.25, 0.5], [0.25, -0.5], [-0.25, -0.5]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 0.15), camelMat); leg.position.set(lx, 0.5, lz); g.add(leg);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    camels.push({ g, offset: i * 3.2 });
  }
  return (t) => {
    for (const c of camels) {
      const z = 800 + ((t * 1.1 + c.offset) % 180);
      const x = -24 + 12 * Math.sin(z * 0.02);
      const dx = 12 * Math.cos(z * 0.02) * 0.02;
      c.g.position.set(x, heightAt(x, z), z);
      c.g.rotation.y = Math.atan2(dx, 1);
    }
  };
}

function buildMountains(out) {
  const r = rng(606);
  const pines = [], trunks = [], rocks = [];
  for (let i = 0; i < 5200; i++) {
    const x = r.range(-X_HALF, X_HALF), z = r.range(985, 1262);
    const wm = biome.mount(z);
    if (wm < 0.5) continue;
    const g = heightAt(x, z);
    const slope = Math.abs(heightAt(x + 1, z) - heightAt(x - 1, z)) + Math.abs(heightAt(x, z + 1) - heightAt(x, z - 1));
    if (g > 22 + noise(x * 0.1, z * 0.1, 3) * 4 || slope > 2.4) continue;
    if (fbm(x * 0.04, z * 0.04, 3, 66) < 0.45) continue;
    if (Math.hypot(x - STOPS[5].x, z - STOPS[5].z) < 22) continue;
    const s = r.range(0.8, 1.6);
    pines.push({ x, y: g - 0.3, z, sx: s, sy: s * r.range(1, 1.4), sz: s, color: r.pick(PINES) });
    if (r() < 0.2) trunks.push({ x, y: g - 0.3, z, sx: s, sy: 1.2, sz: s });
  }
  for (let i = 0; i < 180; i++) {
    const x = r.range(-X_HALF, X_HALF), z = r.range(990, 1250);
    const s = r.range(0.8, 2.6);
    rocks.push({ x, y: heightAt(x, z) - 0.2, z, sx: s, sy: s * 0.7, sz: s, rx: r() * 3, ry: r() * 3, color: r.pick(['#8d857d', '#9d948a', '#7b746e']) });
  }
  out.push(instanced(GEO.pine, lambert('#ffffff'), pines));
  out.push(instanced(GEO.trunk, lambert('#5d4331'), trunks));
  out.push(instanced(GEO.rock, lambert('#ffffff'), rocks));
}

function buildStreetGlow(plan, scene) {
  const pts = [];
  for (const road of plan.roads) {
    if (road.axis !== 'z') continue;
    for (let z = Math.max(road.z0, 1270); z < road.z1; z += 9) pts.push(road.c + 3, 5.4, z);
  }
  for (let z = 1300; z < STOPS[6].z - 16; z += 6) pts.push(-9.5, 4.8, z, 9.5, 4.8, z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.PointsMaterial({ size: 3.4, map: glowMap(), color: '#ffc47a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const p = new THREE.Points(geo, mat);
  scene.add(p);
  return p;
}

function buildClouds(scene) {
  const r = rng(707);
  const variants = [cloudGeometry(3), cloudGeometry(17), cloudGeometry(41)];
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.3, transparent: true, opacity: 0.94 });
  const lists = [[], [], []];
  const cruiseAt = (z) => {
    for (let i = 0; i < STOPS.length - 1; i++) if (z < STOPS[i + 1].z) return LEG_CRUISE[i];
    return LEG_CRUISE[LEG_CRUISE.length - 1];
  };
  for (let i = 0; i < 120; i++) {
    const z = r.range(40, 1480);
    let near = false;
    for (const s of STOPS) if (Math.abs(z - s.z) < 45) near = true;
    if (near) continue;
    const high = r() < 0.25;
    const x = high ? corridorX(z) + (r() < 0.5 ? -1 : 1) * r.range(30, 70) : r.range(-110, 110);
    const y = high ? cruiseAt(z) + r.range(2, 7) : Math.max(heightAt(x, z) + 10, cruiseAt(z) - r.range(9, 22));
    const s = r.range(0.8, 1.7);
    lists[i % 3].push({ x, y, z, s, ry: r.range(0, 6), drift: r.range(0.4, 1.2) });
  }
  const meshes = lists.map((list, k) => {
    const m = new THREE.InstancedMesh(variants[k], mat, list.length);
    m.castShadow = false;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });
  const update = (t) => {
    lists.forEach((list, k) => {
      list.forEach((c, i) => {
        const x = ((c.x + t * c.drift + X_HALF + 40) % (X_HALF * 2 + 80)) - X_HALF - 40;
        dummy.position.set(x, c.y, c.z);
        dummy.rotation.set(0, c.ry, 0);
        dummy.scale.set(c.s, c.s, c.s);
        dummy.updateMatrix();
        meshes[k].setMatrixAt(i, dummy.matrix);
      });
      meshes[k].instanceMatrix.needsUpdate = true;
    });
  };
  update(0);
  return { update, material: mat };
}

export function buildScenery(scene, { cityPlans, fields, density = 1 }) {
  const out = [];
  const env = {};
  const traffic = cityPlans.map((plan) => buildCity(plan, out, env));
  buildFields(fields, out);
  const balloons = buildBalloons(scene);
  const ocean = buildOcean(scene, out);
  const desert = buildDesert(scene, out);
  buildMountains(out);
  const streetGlow = buildStreetGlow(cityPlans[1], scene);
  const clouds = buildClouds(scene);
  for (const m of out) if (m) {
    if(density<1)m.traverse(part=>{
      if(!part.isInstancedMesh||!part.userData.optionalVegetation)return;
      const matrix=new THREE.Matrix4(),color=new THREE.Color();let kept=0;
      for(let i=0;i<part.count;i++){
        part.getMatrixAt(i,matrix);
        const x=matrix.elements[12],z=matrix.elements[14];
        // Coordinate-based selection keeps matching foliage and trunks together.
        const nearHero=STOPS.some(s=>Math.hypot(s.x-x,s.z-z)<30);
        const hash=Math.sin(Math.round(x*10)*12.9898+Math.round(z*10)*78.233)*43758.5453;
        if(!nearHero&&hash-Math.floor(hash)>density)continue;
        part.setMatrixAt(kept,matrix);
        if(part.instanceColor){part.getColorAt(i,color);part.setColorAt(kept,color);}
        kept++;
      }
      part.count=kept;part.instanceMatrix.needsUpdate=true;
      if(part.instanceColor)part.instanceColor.needsUpdate=true;
      part.computeBoundingSphere();
    });
    scene.add(m);
  }
  return {
    clouds,
    update(t, dt, night, focusZ = 0, range = 360) {
      traffic.forEach((tr,i)=>{if(Math.abs(focusZ-(i?1420:0))<range+240)tr.update(dt,night);});
      balloons(t);
      if(Math.abs(focusZ-620)<range)ocean(t, dt);
      if(Math.abs(focusZ-870)<range)desert(t);
      streetGlow.material.opacity = clamp(night * 1.2);
      clouds.update(t);
    },
  };
}

export { shared };
