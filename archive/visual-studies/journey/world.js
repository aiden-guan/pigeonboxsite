// Scene assembly, flight path, camera choreography and the render loop.
import * as THREE from '../vendor/three.min.js';
import { STOPS, LEG_CRUISE, SKY_KEYS, heightAt, cityPlan, fieldsPlan, Z_MIN } from './layout.js';
import { buildTerrain, buildWater } from './terrain.js';
import { buildMonuments } from './monuments.js';
import { buildScenery } from './scenery.js';
import { createPigeon } from './pigeon.js';
import { createSky } from './sky.js';
import { shared } from './materials.js';
import { createAssetStore, adoptModelGeometry } from './assets.js';
import { initialQuality } from './quality.js';
import { clamp, lerp, smoothstep, easeInOut, damp, rng } from './util.js';

const DEG = Math.PI / 180;

// Camera framing at each perch. az is measured from +z toward +x.
export const STOP_CAMS = [
  { az: 35, el: 25, dist: 28, look: [0, -2.8, -1], side: 'left', fov: 36, orbit: 4, mobileOffY: -.18 },
  { az: -32, el: 22, dist: 76, look: [0, -17, 0], side: 'right', fov: 36, orbit: 5 },
  { az: 120, el: 24, dist: 50, look: [0, -7.5, 0], side: 'left', fov: 36, orbit: 5 },
  { az: 35, el: 25, dist: 52, look: [0, -8, 0], side: 'right', fov: 36, orbit: 5 },
  { az: -35, el: 26, dist: 78, look: [0, -10, 0], side: 'left', fov: 36, orbit: 4 },
  { az: 35, el: 18, dist: 28, look: [0, -1.8, 0], side: 'right', fov: 36, orbit: 4 },
  { az: 35, el: 25, dist: 38, look: [0, -3.5, 0], side: 'left', fov: 36, orbit: 4 },
];
export const PIGEON_SCALE = 2.1;
const PERCH_LIFT = 0.64 * PIGEON_SCALE;
const STOP_MINUTES = [372, 462, 598, 742, 905, 1088, 1232];
const METERS_PER_UNIT = 4;

function buildLegs() {
  const r = rng(12);
  const legs = [];
  for (let k = 0; k < STOPS.length - 1; k++) {
    const A = new THREE.Vector3(STOPS[k].x, STOPS[k].y, STOPS[k].z);
    const B = new THREE.Vector3(STOPS[k + 1].x, STOPS[k + 1].y, STOPS[k + 1].z);
    const d = B.clone().sub(A);
    const cruise = LEG_CRUISE[k];
    const mids = [0.26, 0.52, 0.78].map((f, i) => new THREE.Vector3(A.x + d.x * f + r.range(-14, 14) * (i === 1 ? 1 : 0.7), cruise + (i === 1 ? 4 : 0), A.z + d.z * f));
    let pts;
    let curve;
    for (let iter = 0; iter < 6; iter++) {
      pts = [A, A.clone().add(new THREE.Vector3(0, 3.5, 6.5)), ...mids, B.clone().add(new THREE.Vector3(0, 9, -16)), B.clone().add(new THREE.Vector3(0, 1.6, -3.8)), B];
      curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
      let deficit = 0;
      for (let i = 12; i < 188; i++) {
        const p = curve.getPointAt(i / 200);
        deficit = Math.max(deficit, heightAt(p.x, p.z) + 14 - p.y);
      }
      if (deficit <= 0) break;
      for (const m of mids) m.y += deficit + 2;
    }
    curve.arcLengthDivisions = 400;
    const length = curve.getLength();
    legs.push({ curve, length });
  }
  return legs;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export async function createWorld(canvas, { mobile, onProgress }) {
  const debug = new URLSearchParams(location.search).has('debug');
  const mark = (label) => { if (debug) console.log('[pb]', label, Math.round(performance.now())); };
  let openingAssets = true;
  const assets = createAssetStore({ onProgress(records) {
    if (!openingAssets) return;
    const first = records.filter(r => r.url.includes('/pigeon/') || r.url.endsWith('/rooftop.glb'));
    const fraction = first.reduce((sum,r) => sum + (r.status !== 'loading' ? 1 : r.total ? r.loaded / r.total : 0),0) / 2;
    onProgress?.(.5 + fraction * .25);
  } });
  const loadModel = async (root, file) => {
    try {
      const model = await assets.preload(new URL(`../assets/models/${file}`, import.meta.url).href);
      adoptModelGeometry(root, model.scene);
      return true;
    } catch {
      root.userData.authoredModel = false;
      return false; // Complete procedural fallback, including its animation rig.
    }
  };
  mark('start');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'high-performance' });
  const quality = initialQuality(mobile);
  let pixelRatio = Math.min(window.devicePixelRatio || 1, quality.dpr);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#d6e8f0', 110, 520);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2000);

  const hemi = new THREE.HemisphereLight('#eaf5ff', '#7d8466', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d8', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadow, quality.shadow);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  // Soft fill from the viewer so the courier never reads as a silhouette.
  const fill = new THREE.DirectionalLight('#fff4ea', 0.45);
  scene.add(fill, fill.target);

  const sky = createSky(scene);
  const tick = () => new Promise((r) => setTimeout(r, 0));

  onProgress?.(0.1);
  await tick();
  const cityPlans = [cityPlan({ z0: -240, z1: 232, seed: 7, style: 'old' }), cityPlan({ z0: 1262, z1: 1545, seed: 9, style: 'new' })];
  const fields = fieldsPlan();
  const terrain = buildTerrain({ scene, cityPlans, fields, textureSize: mobile ? 768 : 1024, anisotropy: renderer.capabilities.getMaxAnisotropy() });
  mark('terrain');
  const water = buildWater(scene);
  mark('water');
  onProgress?.(0.3);
  await tick();
  const monuments = buildMonuments(scene);
  mark('monuments');
  const scenery = buildScenery(scene, { cityPlans, fields, density: quality.foliageDensity });
  mark('scenery');
  onProgress?.(0.5);
  await tick();
  const pigeon = createPigeon();
  const [birdAsset, flightTexture, flightDownTexture] = await Promise.all([
    assets.preload(new URL('../assets/models/pigeon/gascogne-pigeon.glb', import.meta.url).href).catch(() => null),
    new THREE.TextureLoader().loadAsync(new URL('../assets/models/pigeon/flight.png', import.meta.url).href).catch(() => null),
    new THREE.TextureLoader().loadAsync(new URL('../assets/models/pigeon/flight-down.png', import.meta.url).href).catch(() => null),
    loadModel(monuments[0].group, 'landmarks/rooftop.glb'),
  ]);
  if (birdAsset) pigeon.useModel(birdAsset.scene);
  openingAssets = false;
  pigeon.root.scale.setScalar(PIGEON_SCALE);
  scene.add(pigeon.root);
  // Drop shadow: the bird's own silhouette flattened onto the ground below it.
  const shadowMat = new THREE.MeshBasicMaterial({
    color: '#0d1a2a', transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const dropShadow = pigeon.makeShadow(shadowMat);
  const flattener = new THREE.Group();
  flattener.matrixAutoUpdate = false;
  flattener.renderOrder = 3;
  flattener.add(dropShadow.root);
  scene.add(flattener);
  if (birdAsset && flightTexture && flightDownTexture) {
    flightTexture.colorSpace = THREE.SRGBColorSpace;
    flightDownTexture.colorSpace = THREE.SRGBColorSpace;
    const flightSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flightTexture, transparent: true, depthWrite: false, toneMapped: false,
    }));
    flightSprite.scale.set(2.8, 2.8, 1);
    flightSprite.position.y = 0.12;
    pigeon.useFlightSprite(flightSprite, flightDownTexture);
  }
  // Warm lamplight for the night-time plaza.
  const plazaLamp = new THREE.PointLight('#ffb870', 0, 60, 1.6);
  plazaLamp.position.set(STOPS[6].x + 6, STOPS[6].y + 6, STOPS[6].z + 8);
  scene.add(plazaLamp);
  const legs = buildLegs();
  const legOffsets = [];
  let total = 0;
  for (const l of legs) { legOffsets.push(total); total += l.length; }

  // Headings at each perch (arrival direction, departure for the first).
  const headingOf = (v) => Math.atan2(v.x, v.z);
  const perchHeading = STOPS.map((_, k) => {
    if (k === 0) return headingOf(legs[0].curve.getTangentAt(0.1));
    const t = legs[k - 1].curve.getTangentAt(0.86);
    return headingOf(t);
  });

  // Paint the opening chunks before the first frame, the rest progressively.
  mark('legs');
  terrain.ensurePainted(0);
  mark('painted');
  onProgress?.(0.8);
  await tick();

  const state = { T: 0, targetT: 0, time: 0, mobile, aspect: 1, width: 1, height: 1, arrived: false };
  const out = {
    pigeon: new THREE.Vector3(), screen: { x: 0, y: 0, visible: false }, altitude: 0, distance: 0, minutes: 372,
    stop: 0, hold: 0, leg: -1, legFrac: 0, perched: true,
  };

  const cam = { target: new THREE.Vector3(), az: 0, el: 0, dist: 0, fov: 40, offX: 0, offY: 0 };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const colorA = new THREE.Color(), colorB = new THREE.Color();

  function stopCamera(k, h, into) {
    const c = STOP_CAMS[k];
    const s = STOPS[k];
    const mob = state.aspect < 0.85;
    into.target.set(s.x + c.look[0], s.y + c.look[1] * (mob ? 0.25 : 1), s.z + c.look[2]);
    into.az = (c.az + lerp(-c.orbit, c.orbit, h)) * DEG;
    into.el = c.el * DEG;
    into.dist = c.dist * (mob ? 1.05 : state.aspect < 1.2 ? 1.2 : 1);
    into.fov = mob ? c.fov + 6 : c.fov;
    const shift = c.side === 'left' ? -1 : 1;
    into.offX = mob ? 0 : shift * 0.2;
    into.offY = mob ? (c.mobileOffY ?? 0.2) : 0;
    return into;
  }
  function flightCamera(pos, tangent, f, into, legIndex) {
    const mob = state.aspect < 0.85;
    const lead = mob ? 3 : 5;
    tmp.set(tangent.x, 0, tangent.z).normalize();
    into.target.set(pos.x + tmp.x * lead, pos.y - 2, pos.z + tmp.z * lead);
    const H = (mob ? 48 : 38) + 5 * Math.sin(Math.PI * f);
    into.az = (STOP_CAMS[legIndex].az + wrapAngle((STOP_CAMS[legIndex+1].az-STOP_CAMS[legIndex].az)*DEG)/DEG*f)*DEG;
    into.el = 32 * DEG;
    into.dist = H * 1.04;
    into.fov = mob ? 46 : 38;
    into.offX = 0;
    into.offY = 0;
    return into;
  }
  const blendCam = (a, b, w, into) => {
    into.target.lerpVectors(a.target, b.target, w);
    into.az = a.az + wrapAngle(b.az-a.az)*w;
    into.el = lerp(a.el, b.el, w);
    into.dist = lerp(a.dist, b.dist, w);
    into.fov = lerp(a.fov, b.fov, w);
    into.offX = lerp(a.offX, b.offX, w);
    into.offY = lerp(a.offY, b.offY, w);
    return into;
  };
  const camA = { target: new THREE.Vector3() }, camB = { target: new THREE.Vector3() }, camF = { target: new THREE.Vector3() };

  function applyEnvironment(z) {
    let i = 0;
    while (i < SKY_KEYS.length - 2 && z > SKY_KEYS[i + 1].z) i++;
    const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
    const t = smoothstep(a.z, b.z, z);
    const mix = (key, target) => target.copy(colorA.set(a[key])).lerp(colorB.set(b[key]), t);
    mix('top', sky.uniforms.uTop.value);
    mix('horizon', sky.uniforms.uHorizon.value);
    mix('sun', sky.uniforms.uSun.value);
    scene.fog.color.copy(sky.uniforms.uHorizon.value);
    mix('sun', sun.color);
    sun.intensity = lerp(a.sunI, b.sunI, t);
    mix('hemiSky', hemi.color);
    mix('hemiGround', hemi.groundColor);
    hemi.intensity = lerp(a.hemiI, b.hemiI, t);
    const el = lerp(a.el, b.el, t) * DEG, az = lerp(a.az, b.az, t) * DEG;
    const dir = tmp2.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    sky.uniforms.uSunDir.value.copy(dir);
    const night = lerp(a.night, b.night, t);
    sky.uniforms.uNight.value = night;
    shared.uNight.value = night;
    scenery.clouds.material.emissiveIntensity = 0.28 * (1 - night * 0.7);
    return { dir, night };
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    state.width = w; state.height = h; state.aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = state.aspect;
    camera.updateProjectionMatrix();
  }
  resize();

  const pigeonState = { flap: 0, fold: 1, landing: 0, legs: 1, look: 0 };
  let heading = perchHeading[0];
  let debugCamera = null;
  let prevHeading = heading;
  let smoothBank = 0;

  function update(dt) {
    state.time += dt;
    state.T = damp(state.T, state.targetT, state.mobile ? 5 : 4.2, dt);
    if (Math.abs(state.T - state.targetT) < 1e-4) state.T = state.targetT;
    const T = state.T;
    const N = STOPS.length;
    const seg = Math.min(Math.floor(T), 2 * N - 2);
    const frac = clamp(T - seg);
    const P = new THREE.Vector3();
    let tangent = new THREE.Vector3(0, 0, 1);
    let camera$;
    if (seg % 2 === 0 || seg >= 2 * N - 2) {
      // Perched.
      const k = Math.min(seg / 2, N - 1) | 0;
      const s = STOPS[k];
      P.set(s.x, s.y + PERCH_LIFT, s.z);
      heading = lerp(heading, perchHeading[k], 1 - Math.exp(-dt * 4));
      pigeonState.flap = 0; pigeonState.fold = 1; pigeonState.landing = 0; pigeonState.legs = 1;
      camera$ = stopCamera(k, seg >= 2 * N - 2 ? 1 : frac, cam);
      out.stop = k; out.hold = frac; out.leg = -1; out.perched = true;
      out.distance = k === 0 ? 0 : legOffsets[k - 1] + legs[k - 1].length;
      out.minutes = STOP_MINUTES[k] + frac * 12;
    } else {
      const k = (seg - 1) / 2;
      const leg = legs[k];
      const u = lerp(frac, easeInOut(frac), 0.65);
      P.copy(leg.curve.getPointAt(u));
      P.y += PERCH_LIFT;
      tangent = leg.curve.getTangentAt(Math.min(0.995, Math.max(0.005, u)));
      const target = headingOf(tangent);
      const toTarget = u < 0.05 ? lerp(perchHeading[k], target, smoothstep(0, 0.05, u)) : u > 0.96 ? lerp(target, perchHeading[k + 1], smoothstep(0.96, 1, u)) : target;
      heading = heading + wrapAngle(toTarget - heading) * (1 - Math.exp(-dt * 8));
      const climbing = tangent.y;
      pigeonState.fold = Math.max(1 - smoothstep(0.004, 0.03, u), smoothstep(0.985, 1, u));
      pigeonState.landing = smoothstep(0.9, 0.97, u) * (1 - smoothstep(0.985, 1, u));
      pigeonState.legs = Math.max(pigeonState.landing, 1 - smoothstep(0.01, 0.06, u));
      pigeonState.flap = clamp(0.7 + climbing * 1.6, 0.35, 1) * (1 - pigeonState.fold);
      out.stop = k; out.leg = k; out.legFrac = frac; out.perched = false; out.hold = 0;
      out.distance = legOffsets[k] + leg.length * u;
      out.minutes = lerp(STOP_MINUTES[k] + 12, STOP_MINUTES[k + 1], frac);
      // Camera: leave the last perch, cruise, then settle on the next one.
      stopCamera(k, 1, camA);
      stopCamera(k + 1, 0, camB);
      flightCamera(P, tangent, frac, camF, k);
      const wOut = 1 - smoothstep(0, 0.3, frac), wIn = smoothstep(0.66, 1, frac);
      camera$ = frac < 0.5 ? blendCam(camF, camA, wOut, cam) : blendCam(camF, camB, wIn, cam);
    }

    // Pigeon orientation.
    const turn = wrapAngle(heading - prevHeading) / Math.max(dt, 1e-3);
    prevHeading = heading;
    smoothBank = damp(smoothBank, clamp(-turn * 0.35, -0.7, 0.7) * (1 - pigeonState.fold), 5, dt);
    const pitch = out.perched ? 0 : clamp(-Math.asin(clamp(tangent.y, -1, 1)) * 0.7, -0.5, 0.45) - pigeonState.landing * 0.45;
    pigeon.root.position.copy(P);
    pigeon.root.rotation.set(pitch, heading, smoothBank, 'YXZ');
    if (debugCamera) debugCamera(camera$, P, heading);

    // Camera placement.
    const c = camera$;
    camera.position.set(
      c.target.x + c.dist * Math.cos(c.el) * Math.sin(c.az),
      c.target.y + c.dist * Math.sin(c.el),
      c.target.z + c.dist * Math.cos(c.el) * Math.cos(c.az),
    );
    const ground = heightAt(camera.position.x, camera.position.z) + 2;
    if (camera.position.y < ground) camera.position.y = ground;
    camera.lookAt(c.target);
    if (Math.abs(camera.fov - c.fov) > 0.01) camera.fov = c.fov;
    const W = state.width, H = state.height;
    camera.setViewOffset(W, H, c.offX * W, c.offY * H, W, H);
    camera.updateProjectionMatrix();

    // Look at the viewer while perched.
    const toCam = Math.atan2(camera.position.x - P.x, camera.position.z - P.z);
    pigeonState.look = out.perched ? Math.sin(state.time * .5) * .12 : 0;
    pigeon.update(dt, pigeonState);
    const groundY = Math.max(heightAt(P.x, P.z), 0) + 0.12;
    const above = P.y - PERCH_LIFT - groundY;
    dropShadow.sync();
    flattener.matrix.set(1, 0, 0, 0, 0, 0, 0, groundY, 0, 0, 1, 0, 0, 0, 0, 1);
    flattener.visible = above > 1.5;
    shadowMat.opacity = 0.26 * (1 - smoothstep(20, 90, above)) * smoothstep(1.5, 6, above);

    // Environment.
    const env = applyEnvironment(P.z);
    const focus = c.target;
    const size = clamp(c.dist * 1.6, 34, 90);
    sun.position.copy(focus).addScaledVector(env.dir, 220);
    sun.target.position.copy(focus);
    const sc = sun.shadow.camera;
    if (sc.right !== size) { sc.left = -size; sc.right = size; sc.top = size; sc.bottom = -size; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix(); }
    scene.fog.near = lerp(140, 70, smoothstep(40, 12, c.el / DEG));
    scene.fog.far = lerp(560, 420, smoothstep(40, 12, c.el / DEG));
    sky.dome.position.copy(camera.position);
    fill.position.copy(camera.position);
    fill.target.position.copy(focus);
    fill.intensity = .38 + env.night * .12;
    plazaLamp.intensity = env.night * 240 * smoothstep(1300, 1380, P.z);

    const tEnv = { night: env.night, clockMinutes: out.minutes, arrived: T > 2 * N - 2.4 };
    monuments.forEach((m,i) => {
      m.group.visible = Math.abs(STOPS[i].z-camera.position.z)<460;
      if(Math.abs(STOPS[i].z-P.z)<quality.animationRange)m.update(state.time,tEnv);
    });
    scenery.update(state.time, dt, env.night, P.z, quality.animationRange);
    water.update(state.time);
    terrain.ensurePainted(P.z);

    out.pigeon.copy(P);
    out.altitude = Math.max(0, (P.y - PERCH_LIFT - heightAt(P.x, P.z)) * METERS_PER_UNIT);
    out.distanceM = out.distance * METERS_PER_UNIT;
    tmp.copy(P).project(camera);
    out.screen.x = (tmp.x * 0.5 + 0.5) * W;
    out.screen.y = (-tmp.y * 0.5 + 0.5) * H;
    out.screen.visible = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
  }

  // Frame loop with a light adaptive resolution.
  let last = performance.now();
  let slow = 0, frames = 0, running = true, idleHandle = 0;
  const listeners = [];
  let frameSample = null;
  function loop(now) {
    if (!running) return;
    const elapsed = now - last;
    if (frameSample) {
      frameSample.times.push(elapsed);
      if (now >= frameSample.until) {
        const sorted = frameSample.times.sort((a,b)=>a-b);
        frameSample.resolve({frames:sorted.length, meanMs:sorted.reduce((a,b)=>a+b,0)/sorted.length,p95Ms:sorted[Math.floor(sorted.length*.95)],over33ms:sorted.filter(t=>t>33.3).length,dpr:pixelRatio,quality:quality.name});
        frameSample = null;
      }
    }
    const dt = Math.min(0.05, elapsed / 1000);
    last = now;
    update(dt);
    renderer.render(scene, camera);
    for (const l of listeners) l(out, state);
    frames++;
    if (dt > 0.026) slow++;
    if (frames % 90 === 0) {
      if (slow > 45 && pixelRatio > 1) {
        pixelRatio = Math.max(1, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        resize();
      }
      slow = 0;
    }
    requestAnimationFrame(loop);
  }
  const paintIdle = () => {
    const more = terrain.paintNext(out.pigeon.z || 0);
    if (more) idleHandle = (window.requestIdleCallback || setTimeout)(paintIdle, { timeout: 600 });
  };
  // Later sets decode serially after first paint. Their fallback has exactly
  // the same silhouette, so even a fast route jump never reveals an empty set.
  async function loadLaterModels() {
    for (let i = 1; i < monuments.length; i++) {
      await tick();
      await loadModel(monuments[i].group, `landmarks/${STOPS[i].id}.glb`);
    }
  }

  return {
    start() {
      update(0.016);
      renderer.render(scene, camera);
      requestAnimationFrame((n) => { last = n; loop(n); });
      idleHandle = setTimeout(paintIdle, 400);
      setTimeout(loadLaterModels, 600);
    },
    setTarget(T, jump = false) {
      state.targetT = T;
      if (jump) state.T = T;
    },
    resize,
    // Debug: render synchronously and report the average frame cost in ms.
    bench(n = 30) {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        update(1 / 60);
        renderer.render(scene, camera);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      }
      for (const l of listeners) l(out, state);
      return { ms: (performance.now() - t0) / n, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, dpr: pixelRatio, models: [pigeon.root, ...monuments.map(m=>m.group)].filter(g=>g.userData.authoredModel).length };
    },
    sampleFrames(duration = 3000) {
      if (frameSample) return Promise.reject(new Error('Sampling already active'));
      return new Promise(resolve => { frameSample = {times:[],until:performance.now()+duration,resolve}; });
    },
    capture() {
      renderer.render(scene,camera);
      return {url:canvas.toDataURL('image/png'),name:`pigeonbox-${STOPS[out.stop].id}.png`};
    },
    onFrame(fn) { listeners.push(fn); },
    setDebugCamera(fn) { debugCamera = fn; },
    debugInfo() { return { camera: camera.position.toArray().map((v) => +v.toFixed(2)), pigeon: pigeon.root.position.toArray().map((v) => +v.toFixed(2)), heading: +heading.toFixed(3), T: state.T, pose:pigeon.debugPose() }; },
    pause() { running = false; },
    resume() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } },
    get state() { return state; },
    stopCount: STOPS.length,
  };
}
