// The courier: a low-poly rock pigeon with the PigeonBox satchel. It faces +z.
import * as THREE from '../vendor/three.min.js';
import { lerp } from './util.js';

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

// Shape points are (x, z) in the wing plane; Shape uses y = -z.
function planar(points) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  return g;
}

function wing(side) {
  const shoulder = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.order = 'YZX';
  const outer = new THREE.Group();
  const double = { side: THREE.DoubleSide };
  // Top-view outline: the wrist juts forward, the hand sweeps back to a point.
  const innerGeo = planar([[0, 0.3], [0.5, 0.36], [0.96, 0.44], [0.98, -0.3], [0.82, -0.42], [0.72, -0.36], [0.6, -0.48], [0.48, -0.41], [0.36, -0.52], [0.22, -0.45], [0.08, -0.54], [0, -0.46]]);
  const outerGeo = planar([[0, 0.44], [0.45, 0.38], [0.95, 0.16], [1.38, -0.34], [1.14, -0.44], [1.1, -0.36], [0.92, -0.5], [0.88, -0.42], [0.68, -0.52], [0.64, -0.45], [0.44, -0.52], [0.22, -0.42], [0, -0.3]]);
  const tipGeo = planar([[0.8, 0.22], [0.95, 0.16], [1.38, -0.34], [1.14, -0.44], [1.1, -0.36], [0.92, -0.5], [0.88, -0.42], [0.72, -0.48], [0.66, 0.0]]);
  const bar = (z) => planar([[0.34, z], [0.9, z + 0.02], [0.9, z - 0.055], [0.34, z - 0.07]]);
  const pieces = [
    [inner, new THREE.Mesh(innerGeo, mat('#bcc4ce', double))],
    [inner, new THREE.Mesh(bar(-0.12), mat('#4a515b', double))],
    [inner, new THREE.Mesh(bar(-0.28), mat('#4a515b', double))],
    [outer, new THREE.Mesh(outerGeo, mat('#a5aeb9', double))],
    [outer, new THREE.Mesh(tipGeo, mat('#646d79', double))],
  ];
  pieces.forEach(([parent, m], i) => {
    m.position.y = i === 0 || i === 3 ? 0 : 0.012;
    if (side < 0) m.geometry.scale(-1, 1, 1);
    m.castShadow = true;
    parent.add(m);
  });
  outer.position.x = 0.96 * side;
  inner.add(outer);
  shoulder.add(inner);
  return { shoulder, inner, outer, side };
}

export function createPigeon() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mat('#a7b0bb'));
  torso.scale.set(0.47, 0.41, 0.8);
  body.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat('#b3aebd'));
  chest.scale.set(0.38, 0.34, 0.42);
  chest.position.set(0, -0.02, 0.36);
  body.add(chest);
  const neck = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), mat('#6c9e8d'));
  neck.position.set(0, 0.16, 0.5);
  body.add(neck);
  const neckSheen = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 6), mat('#8f84ab'));
  neckSheen.position.set(0, 0.2, 0.5);
  body.add(neckSheen);

  const head = new THREE.Group();
  head.position.set(0, 0.3, 0.7);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 9), mat('#8e98a5'));
  head.add(skull);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.28, 6), mat('#f0954a'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.03, 0.38);
  head.add(beak);
  const cere = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat('#f4efe6'));
  cere.position.set(0, 0.03, 0.27);
  head.add(cere);
  for (const s of [1, -1]) {
    const ring = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat('#f28d3c'));
    ring.position.set(0.2 * s, 0.07, 0.14);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#141414'));
    eye.position.set(0.235 * s, 0.075, 0.16);
    head.add(ring, eye);
  }
  body.add(head);

  const tail = new THREE.Group();
  tail.position.set(0, 0.1, -0.62);
  const tailFan = new THREE.Mesh(planar([[-0.18, 0.08], [0.18, 0.08], [0.44, -0.74], [0.3, -0.8], [0.15, -0.76], [0, -0.82], [-0.15, -0.76], [-0.3, -0.8], [-0.44, -0.74]]), mat('#98a1ac', { side: THREE.DoubleSide }));
  const tailBand = new THREE.Mesh(planar([[-0.41, -0.64], [0.41, -0.64], [0.44, -0.74], [0.3, -0.8], [0.15, -0.76], [0, -0.82], [-0.15, -0.76], [-0.3, -0.8], [-0.44, -0.74]]), mat('#373d45', { side: THREE.DoubleSide }));
  tailBand.position.y = 0.01;
  tail.add(tailFan, tailBand);
  tail.rotation.x = -0.12;
  body.add(tail);

  // The satchel and its strap — the courier's uniform.
  const satchel = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.42), mat('#8b5a34'));
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.44), mat('#a8703f'));
  flap.position.y = 0.12;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.1), mat('#ffe17c'));
  buckle.position.set(0.12, 0.08, 0);
  satchel.add(bag, flap, buckle);
  satchel.position.set(0.47, -0.2, 0.02);
  satchel.rotation.z = 0.18;
  body.add(satchel);
  const strapSpace = new THREE.Group();
  strapSpace.scale.set(0.47, 0.41, 0.8);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.045, 4, 28), mat('#6a4226'));
  strap.rotation.y = -0.62;
  strap.scale.z = 0.4;
  strapSpace.add(strap);
  body.add(strapSpace);

  const legs = new THREE.Group();
  for (const s of [1, -1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 5), mat('#e9814a'));
    leg.position.set(0.14 * s, -0.47, 0.06);
    legs.add(leg);
    for (const a of [-0.45, 0, 0.45]) {
      const toe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.2), mat('#e9814a'));
      toe.position.set(0.14 * s + Math.sin(a) * 0.08, -0.62, 0.14 + Math.cos(a) * 0.04);
      toe.rotation.y = a;
      legs.add(toe);
    }
  }
  body.add(legs);

  const left = wing(1), right = wing(-1);
  body.add(left.shoulder, right.shoulder);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  let phase = 0;
  let glideTimer = 0;
  let idle = 0;
  const pose = { flapAmp: 0 };

  return {
    root,
    head,
    // A flat, flapping copy of the bird for the drop shadow.
    makeShadow(material) {
      const copy = root.clone(true);
      copy.traverse((o) => { if (o.isMesh) { o.material = material; o.castShadow = false; } });
      const src = [], dst = [];
      root.traverse((o) => src.push(o));
      copy.traverse((o) => dst.push(o));
      return {
        root: copy,
        sync() {
          for (let i = 0; i < src.length; i++) {
            dst[i].position.copy(src[i].position);
            dst[i].quaternion.copy(src[i].quaternion);
            dst[i].scale.copy(src[i].scale);
          }
        },
      };
    },
    // state: { flap 0..1, fold 0..1, landing 0..1, legs 0..1, look rad, dt, speed }
    update(dt, s) {
      idle += dt;
      glideTimer += dt;
      // Pigeons alternate bursts of flapping with short glides.
      const gliding = s.flap < 0.9 && (glideTimer % 3.2) > 2.1 ? 1 : 0;
      const targetAmp = s.flap * (1 - gliding * 0.85);
      pose.flapAmp = lerp(pose.flapAmp, targetAmp, 1 - Math.exp(-dt * 6));
      const freq = 5.2 + s.flap * 2.4;
      phase += dt * freq * Math.PI * 2 * Math.max(0.25, pose.flapAmp);
      const a = pose.flapAmp;
      const flapZ = Math.sin(phase) * 0.95 * a + 0.1;
      const outerZ = Math.sin(phase - 0.8) * 0.55 * a + 0.04;
      const sweep = Math.cos(phase) * 0.18 * a;
      const fold = s.fold, land = s.landing * (1 - fold);

      for (const w of [left, right]) {
        const sd = w.side;
        let iz = flapZ, oz = outerZ, iy = -sweep * sd, oy = 0;
        // Landing: wings high and cupped forward to brake.
        iz = lerp(iz, 0.95 + Math.sin(idle * 14) * 0.12, land);
        iy = lerp(iy, -0.45 * sd, land);
        oz = lerp(oz, -0.35, land);
        // Folded: swept back, rolled upright against the flank and compressed.
        iz = lerp(iz, 0.08, fold);
        iy = lerp(iy, 1.52 * sd, fold);
        oz = lerp(oz, 0, fold);
        oy = lerp(oy, 0.08 * sd, fold);
        w.shoulder.position.set((0.3 + fold * 0.17) * sd, 0.22 + fold * 0.05, 0.24 - fold * 0.04);
        w.inner.rotation.set(-1.42 * fold, iy, iz * sd);
        w.outer.rotation.set(0, oy, oz * sd);
        w.inner.scale.set(lerp(1, 0.62, fold), 1, lerp(1, 0.56, fold));
      }
      body.position.y = -Math.sin(phase) * 0.06 * a;
      legs.scale.y = lerp(0.05, 1, Math.max(s.legs, fold));
      legs.position.y = lerp(0.3, 0, Math.max(s.legs, fold));
      legs.position.z = lerp(-0.25, 0, Math.max(s.legs, fold));
      tail.rotation.x = -0.12 + land * 0.5 + Math.sin(idle * 1.7) * 0.04 * fold;
      // Perched: small nods and a look toward the viewer.
      const nod = fold * Math.max(0, Math.sin(idle * 2.4)) ** 6 * 0.18;
      head.position.z = 0.7 + nod * 0.4;
      head.rotation.x = nod * 0.6;
      head.rotation.y = lerp(head.rotation.y, s.look ?? 0, 1 - Math.exp(-dt * 3));
      torso.scale.y = 0.41 + Math.sin(idle * 2) * 0.008 * fold;
    },
  };
}
