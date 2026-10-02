// Hand-built landmarks. Each returns the absolute height the pigeon perches on.
import * as THREE from '../vendor/three.min.js';
import { STOPS, heightAt, LAND } from './layout.js';
import { prismGeometry, pyramidGeometry, beveledBox, weatheredRock, beveledPrism, beveledFrustum } from './geometry.js';
import { stylizedMat as lambert, shared, windowMaterial } from './materials.js';
import { windowFrame, batchStatic, bench } from './craft.js';
import { addLandmarkDetails } from './landmark-details.js';

const shadowed = (obj) => {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
};
const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};
const box = (w, h, d, mat, x, y, z) => mesh(beveledBox(w, h, d, Math.min(.10, w*.1, h*.1, d*.1)), mat, x, y + h / 2, z);

function rooftop(stop) {
  const g = LAND;
  const group = new THREE.Group();
  const walls = windowMaterial({ spacing: [1.8, 2.4] });
  walls.color.set('#f1dfc0');
  group.add(box(7, 7.5, 10, walls, 0, g, 0));
  const roof = mesh(beveledPrism(), lambert('#c7664a', { side: THREE.DoubleSide }), 0, g + 7.5, 0);
  roof.scale.set(7.9, 3.4, 10.9);
  group.add(roof);
  const gable = mesh(prismGeometry(), walls, 0, g + 7.48, 0);
  gable.scale.set(7, 3.3, 10);
  group.add(gable);
  group.add(box(1, 2.8, 1, lambert('#a6553f'), 2, g + 8.6, -3.2));
  group.add(box(1.3, 0.3, 1.3, lambert('#7d4030'), 2, g + 11.4, -3.2));
  group.position.set(stop.x, 0, stop.z - 4.3);
  return { group: shadowed(group), perchY: g + 7.5 + 3.4, update() {} };
}

function clockTower(stop) {
  const g = heightAt(stop.x, stop.z);
  const group = new THREE.Group();
  const stone = lambert('#ead9b8'), trim = lambert('#cdb48b'), copper = lambert('#5d9f8e'), gold = lambert('#f0c65a', { emissive: '#3a2a00' });
  group.add(box(11, 2, 11, trim, 0, g, 0));
  group.add(box(7.2, 22, 7.2, stone, 0, g + 2, 0));
  for (const y of [9, 16]) group.add(box(7.8, 0.6, 7.8, trim, 0, g + y, 0));
  // Tall arched windows.
  const windows = new THREE.Group();
  for (const [dx, dz, ry] of [[0, 3.62, 0], [0, -3.62, Math.PI], [3.62, 0, Math.PI / 2], [-3.62, 0, -Math.PI / 2]]) {
    for (const y of [4, 11, 18]) {
      const w = windowFrame(windows, dx, g + y, dz, 1.25, 3.3);
      w.rotation.y = ry;
      windows.add(w);
    }
  }
  group.add(batchStatic(windows));
  group.add(box(8.4, 6.4, 8.4, lambert('#f2e6cc'), 0, g + 24, 0));
  group.add(box(9.2, 0.8, 9.2, trim, 0, g + 30.4, 0));
  const faceMat = lambert('#fbf6ea'), ink = lambert('#1d2a3a');
  const hands = [];
  for (const [dx, dz, ry] of [[0, 4.25, 0], [0, -4.25, Math.PI], [4.25, 0, Math.PI / 2], [-4.25, 0, -Math.PI / 2]]) {
    const face = new THREE.Group();
    face.position.set(dx, g + 27.2, dz);
    face.rotation.y = ry;
    const disc = mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.25, 24), faceMat);
    disc.rotation.x = Math.PI / 2;
    face.add(disc);
    const rim = mesh(new THREE.TorusGeometry(2.6, 0.18, 4, 24), ink);
    face.add(rim);
    const hour = mesh(new THREE.BoxGeometry(0.28, 1.5, 0.12), ink); hour.geometry.translate(0, 0.7, 0);
    const minute = mesh(new THREE.BoxGeometry(0.2, 2.2, 0.12), ink); minute.geometry.translate(0, 1, 0);
    hour.position.z = minute.position.z = 0.22;
    face.add(hour, minute);
    hands.push({ hour, minute });
    group.add(face);
  }
  for (const [cx, cz] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) {
    const t = mesh(new THREE.ConeGeometry(0.8, 2.6, 16), copper, cx, g + 32.5, cz);
    group.add(t);
  }
  const roof = mesh(pyramidGeometry(), copper, 0, g + 31.2, 0);
  roof.scale.set(8.6, 8.2, 8.6);
  group.add(roof);
  const apex = g + 31.2 + 8.2;
  group.add(mesh(new THREE.SphereGeometry(0.65, 12, 8), gold, 0, apex + 0.45, 0));
  group.position.set(stop.x, 0, stop.z);
  return {
    group: shadowed(group),
    perchY: apex + 1.05,
    update(t, env) {
      const minutes = env.clockMinutes;
      for (const h of hands) {
        h.hour.rotation.z = -((minutes / 720) % 1) * Math.PI * 2;
        h.minute.rotation.z = -((minutes / 60) % 1) * Math.PI * 2;
      }
    },
  };
}

function windmill(stop) {
  const g = heightAt(stop.x, stop.z) - 0.3;
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(4, 4.4, 1.2, 32), lambert('#b9ab93'), 0, g + 0.6, 0));
  group.add(mesh(new THREE.CylinderGeometry(2.4, 3.5, 12.5, 32,4), lambert('#f4ecdb'), 0, g + 1.2 + 6.25, 0));
  group.add(mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.5, 32), lambert('#8b5a3c'), 0, g + 13.7, 0));
  const dark = lambert('#3b3a3f');
  group.add(box(1.4, 2.4, 0.3, dark, 0, g + 1.2, 3.35));
  for (const y of [6, 10]) group.add(box(0.8, 1.1, 0.3, dark, 0, g + y, 3.0 - (y - 6) * 0.1));
  const cap = mesh(new THREE.LatheGeometry([new THREE.Vector2(3,0),new THREE.Vector2(3.05,.18),new THREE.Vector2(2.8,.5),new THREE.Vector2(2.35,1.1),new THREE.Vector2(1.65,1.85),new THREE.Vector2(.75,2.55),new THREE.Vector2(0,3.4)],32).translate(0,-1.7,0), lambert('#a84c36'), 0, g + 13.95 + 1.7, 0);
  group.add(cap);
  const top = g + 13.95 + 3.4;
  const sails = new THREE.Group();
  sails.position.set(0, g + 12.2, -3.4);
  const spar = lambert('#6b4a32'), cloth = lambert('#f5ecd6', { side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group();
    blade.rotation.z = (i * Math.PI) / 2 + 0.3;
    blade.add(box(0.28, 8.8, 0.28, spar, 0, 0, 0));
    const sail = box(1.9, 6.6, 0.08, cloth, 1.15, 2.2, 0);
    blade.add(sail);
    for (let k = 0; k < 5; k++) blade.add(box(2.2, 0.1, 0.14, spar, 1.1, 2.3 + k * 1.6, -0.11));
    blade.add(box(.12,6.6,.14,spar,2.12,2.2,-.11));
    sails.add(blade);
  }
  sails.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 8), spar).rotateX(Math.PI / 2));
  group.add(sails);
  // A low stone wall and hay bales around the hill.
  const bale = lambert('#e2c36a');
  for (let i = 0; i < 6; i++) {
    const a = 0.6 + i * 0.5;
    const b = mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 10), bale, Math.cos(a) * 9, 0, Math.sin(a) * 9);
    b.rotation.z = Math.PI / 2;
    b.rotation.y = a;
    b.position.y = heightAt(stop.x + b.position.x, stop.z + b.position.z) + 0.7;
    group.add(b);
  }
  group.position.set(stop.x, 0, stop.z);
  return {
    group: shadowed(group),
    perchY: top + 0.05,
    update(t) { sails.rotation.z = t * 0.55; },
  };
}

function lighthouse(stop) {
  const g = heightAt(stop.x, stop.z) - 0.2;
  const group = new THREE.Group();
  const red = lambert('#d24b3e'), white = lambert('#f6f1e8');
  const bands = 6, bandH = 2.8;
  for (let i = 0; i < bands; i++) {
    const r0 = 2.3 - (i / bands) * 0.8, r1 = 2.3 - ((i + 1) / bands) * 0.8;
    group.add(mesh(new THREE.CylinderGeometry(r1, r0, bandH, 32), i % 2 ? red : white, 0, g + i * bandH + bandH / 2, 0));
  }
  const top = g + bands * bandH;
  const iron = lambert('#2b3440');
  group.add(mesh(new THREE.CylinderGeometry(2.4, 2.1, 0.4, 16), iron, 0, top + 0.2, 0));
  const rail = mesh(new THREE.TorusGeometry(2.3, 0.07, 4, 28), iron, 0, top + 1.1, 0);
  rail.rotation.x = Math.PI / 2;
  group.add(rail);
  const glass = new THREE.MeshLambertMaterial({ color: '#fff4c8', emissive: '#ffd66b', emissiveIntensity: 0.5 });
  group.add(mesh(new THREE.CylinderGeometry(1.15, 1.15, 2, 12), glass, 0, top + 1.4, 0));
  const dome = mesh(new THREE.SphereGeometry(1.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), red, 0, top + 2.4, 0);
  group.add(dome);
  group.add(mesh(new THREE.SphereGeometry(0.28, 8, 6), iron, 0, top + 3.85, 0));
  const beam = new THREE.Group();
  beam.position.set(0, top + 1.4, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff1b8', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const dir of [1, -1]) {
    const cone = mesh(new THREE.ConeGeometry(4.5, 42, 20, 1, true), beamMat);
    cone.geometry.translate(0, -21, 0);
    cone.rotation.z = (dir * Math.PI) / 2;
    beam.add(cone);
  }
  group.add(beam);
  // Keeper's cottage and rocks.
  const cottage = new THREE.Group();
  cottage.add(box(5, 3, 4, lambert('#f4efe6'), 0, 0, 0));
  const cr = mesh(beveledPrism(), lambert('#d24b3e', { side: THREE.DoubleSide }), 0, 3, 0); cr.scale.set(4.5, 1.8, 5.6); cr.rotation.y = Math.PI / 2;
  const cw = mesh(prismGeometry(), white, 0, 2.98, 0); cw.scale.set(4, 1.75, 5); cw.rotation.y = Math.PI / 2;
  cottage.add(cr, cw);
  cottage.position.set(5.5, g, 4.5);
  group.add(cottage);
  const rock = lambert('#8d8a86');
  for (let i = 0; i < 16; i++) {
    const a = i * 0.41 + 0.2, rr = 13 + (i % 3) * 2;
    const s = 0.9 + (i % 4) * 0.5;
    const m = mesh(weatheredRock(i).scale(s,s,s), rock, Math.cos(a) * rr, 0, Math.sin(a) * rr);
    m.position.y = Math.max(-0.3, heightAt(stop.x + m.position.x, stop.z + m.position.z));
    m.rotation.set(i, i * 2, 0);
    group.add(m);
  }
  group.position.set(stop.x, 0, stop.z);
  return {
    group: shadowed(group),
    perchY: top + 4.1,
    update(t, env) {
      beam.rotation.y = t * 0.8;
      beamMat.opacity = env.night * 0.16;
      glass.emissiveIntensity = 0.5 + env.night * 1.6;
    },
  };
}

function pyramid(stop) {
  const g = heightAt(stop.x, stop.z) - 0.2;
  const group = new THREE.Group();
  const layers = 11, h = 2.1;
  const a = lambert('#dfb87c'), b = lambert('#d2a86c');
  let y = g;
  for (let i = 0; i < layers; i++) {
    const half0 = 17 - i * 1.45, half1 = half0 - 1.1;
    const layer = mesh(beveledFrustum(half0*2,half1*2,h,.13), i % 2 ? a : b, 0, y + h / 2, 0);
    layer.rotation.y = 0;
    group.add(layer);
    y += h;
  }
  const capHalf = 17 - layers * 1.45 - 0.2;
  const cap = mesh(pyramidGeometry(), lambert('#f3c95b', { emissive: '#3d2a00' }), 0, y, 0);
  cap.scale.set(capHalf * 2, 3.2, capHalf * 2);
  group.add(cap);
  // Companions: two smaller pyramids and an obelisk.
  for (const [dx, dz, s] of [[34, 22, 0.42], [-30, 34, 0.32]]) {
    const small = mesh(pyramidGeometry(), a, dx, heightAt(stop.x + dx, stop.z + dz) - 1.2, dz);
    small.scale.set(30 * s, 22 * s, 30 * s);
    group.add(small);
  }
  const ob = box(1.4, 12, 1.4, lambert('#d8b27a'), -18, heightAt(stop.x - 18, stop.z - 16), -16);
  group.add(ob);
  const obTip = mesh(pyramidGeometry(), lambert('#f3c95b'), -18, ob.position.y + 6, -16);
  obTip.scale.set(1.4, 1.4, 1.4);
  group.add(obTip);
  group.position.set(stop.x, 0, stop.z);
  return { group: shadowed(group), perchY: y + 3.2, update() {} };
}

function summit(stop) {
  const g = heightAt(stop.x, stop.z) - 0.4;
  const group = new THREE.Group();
  const stone = lambert('#8a8179');
  const sizes = [1.8, 1.4, 1.05, 0.7];
  let y = g;
  sizes.forEach((s, i) => {
    const m = mesh(weatheredRock(i).scale(s,s,s), stone, (i % 2 ? 0.15 : -0.1), y + s * 0.7, 0);
    m.scale.y = 0.72;
    m.rotation.y = i * 1.3;
    group.add(m);
    y += s * 1.05;
  });
  group.add(box(0.12, 6.5, 0.12, lambert('#5b4a3a'), 2.4, g, 0.4));
  const flagGeo = new THREE.PlaneGeometry(2.6, 1.5, 10, 4);
  flagGeo.translate(1.3, 0, 0);
  const flag = mesh(flagGeo, lambert('#ffd95e', { side: THREE.DoubleSide, flatShading: true }), 2.45, g + 5.7, 0.4);
  flag.userData.runtimeGeometry = true;
  group.add(flag);
  const base = flagGeo.attributes.position.array.slice();
  // Prayer-style bunting down to a boulder.
  const colors = ['#e2574c', '#ffd95e', '#4f8fc0', '#79b86a', '#f4f1ea'];
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    const pennant = mesh(new THREE.ConeGeometry(0.28, 0.6, 3), lambert(colors[i % colors.length]), 2.4 - t * 7, g + 5.6 - t * 5.4 - Math.sin(t * Math.PI) * 0.8, 0.4 + t * 3);
    pennant.rotation.z = Math.PI;
    group.add(pennant);
  }
  group.position.set(stop.x, 0, stop.z);
  return {
    group: shadowed(group),
    perchY: y + 0.05,
    update(t) {
      const p = flagGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3];
        p.setZ(i, Math.sin(x * 2.2 - t * 6) * 0.22 * (x / 2.6));
      }
      p.needsUpdate = true;
      flagGeo.computeVertexNormals();
    },
  };
}

function mailbox(stop) {
  const g = heightAt(stop.x, stop.z);
  const group = new THREE.Group();
  const blue = lambert('#2d5f93'), ink = lambert('#15263a'), yellow = lambert('#ffe17c', { emissive: '#3a2c00' });
  // Plinth and legs.
  group.add(box(8, 0.6, 7, lambert('#cfc3b3'), 0, g, 0));
  for (const [x, z] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]]) group.add(box(0.6, 1.4, 0.6, ink, x, g + 0.6, z));
  const body = box(5, 5.8, 4.2, blue, 0, g + 2, 0);
  group.add(body);
  const top = mesh(new THREE.CylinderGeometry(2.5, 2.5, 4.2, 40, 1, false, 0, Math.PI), blue, 0, g + 7.8, 0);
  top.geometry.rotateZ(Math.PI / 2);
  top.geometry.rotateY(Math.PI / 2);
  group.add(top);
  // Slot with a yellow lip, a nameplate and the flag.
  group.add(box(3, 0.45, 0.2, ink, 0, g + 6.7, 2.12));
  group.add(box(3.3, 0.14, 0.3, yellow, 0, g + 7.15, 2.12));
  group.add(box(2.6, 1.3, 0.14, yellow, 0, g + 3.6, 2.14));
  const bird = box(0.9, 0.7, 0.16, ink, 0, g + 3.9, 2.2);
  group.add(bird);
  const flagArm = new THREE.Group();
  flagArm.position.set(2.62, g + 5.8, 0.8);
  flagArm.add(box(0.14, 3, 0.14, ink, 0, 0, 0));
  flagArm.add(box(0.1, 1.2, 1.5, lambert('#e2574c'), 0, 1.8, 0.7));
  group.add(flagArm);
  // Lamp posts and benches around the plaza.
  const lampMat = lambert('#2a2d38');
  const lampGlass = new THREE.MeshBasicMaterial({ color: '#ffd9a0' });
  const lamps = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * 16, z = Math.sin(a) * 16;
    group.add(box(0.25, 5, 0.25, lampMat, x, g, z));
    const bulb = mesh(new THREE.SphereGeometry(0.45, 8, 6), lampGlass, x, g + 5.2, z);
    lamps.push(bulb);
    group.add(bulb);
    const seating = new THREE.Group();
    bench(seating, Math.cos(a + 0.2) * 12, g, Math.sin(a + 0.2) * 12, -a);
    group.add(batchStatic(seating));
  }
  group.position.set(stop.x, 0, stop.z);
  let flagUp = 0;
  return {
    group: shadowed(group),
    perchY: g + 7.8 + 2.5,
    lampPositions: lamps.map((l) => new THREE.Vector3(stop.x + l.position.x, l.position.y, stop.z + l.position.z)),
    update(t, env) {
      flagUp += ((env.arrived ? 1 : 0) - flagUp) * 0.06;
      flagArm.rotation.x = -Math.PI / 2 + flagUp * Math.PI / 2;
      lampGlass.color.setRGB(1, 0.85 * (0.5 + env.night * 0.5), 0.63 * (0.4 + env.night * 0.6));
    },
  };
}

const BUILDERS = { rooftop, clock: clockTower, windmill, lighthouse, pyramid, summit, home: mailbox };

export function buildMonuments(scene) {
  return STOPS.map((stop) => {
    const m = BUILDERS[stop.id](stop);
    addLandmarkDetails(stop, m);
    stop.y = m.perchY;
    scene.add(m.group);
    return m;
  });
}

export { shared };
