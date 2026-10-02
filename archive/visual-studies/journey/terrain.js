// Continuous smooth heightfield with a hand-painted miniature ground map.
import * as THREE from '../vendor/three.min.js';
import { X_HALF, Z_MIN, Z_MAX, LAND, heightAt, biome, riverX, duneShape, dunePhase, STOPS, OASIS } from './layout.js';
import { clamp, hash2, hexToRgb, mixRgb, noise, smoothstep, fbm, rng } from './util.js';

const CHUNK = 240;
const STEP = 1.25;

const C = Object.fromEntries(Object.entries({
  pave: '#d8c7aa', pave2: '#cbb796', grass: '#9cc063', grass2: '#7ba64b', dry: '#bcc36c',
  sand: '#efdcae', wetSand: '#d9c08a', foam: '#f7f3e6', shallow: '#86ddd0', mid: '#2ea5ba', deep: '#1a6592',
  dune: '#eec188', duneLight: '#fbe6ba', duneDark: '#c4824b', oasis: '#6ea24a',
  valley: '#86a85a', forest: '#557f45', rock: '#a0948a', rockDark: '#7c736d', snow: '#f4f6f9',
  pave2City: '#b9aea4', pave2City2: '#aaa097', river: '#5b8f7c',
}).map(([k, v]) => [k, hexToRgb(v)]));

function baseColor(x, z, h, slope) {
  const n = noise(x * 0.09, z * 0.09, 3);
  const g = hash2(Math.floor(x * 1.3), Math.floor(z * 1.3), 7) - 0.5;
  let c = mixRgb(C.pave, C.pave2, n);

  const wf = biome.fields(z);
  if (wf > 0) {
    let grass = mixRgb(C.grass, C.grass2, fbm(x * 0.04, z * 0.04, 3, 2));
    grass = mixRgb(grass, C.dry, smoothstep(0.62, 0.8, noise(x * 0.02, z * 0.02, 5)) * 0.6);
    c = mixRgb(c, grass, wf);
  }
  const wd = biome.desert(z);
  if (wd > 0) {
    // Windward faces catch the light, lee faces fall into shade, crests glow.
    const ph = dunePhase(x, z);
    const sn = Math.sin(ph), cs = Math.cos(ph);
    let sand = mixRgb(C.duneDark, C.dune, smoothstep(-0.35, 0.25, cs));
    sand = mixRgb(sand, C.duneLight, smoothstep(0.82, 0.97, sn) * smoothstep(-0.2, 0.2, cs));
    sand = mixRgb(sand, C.duneDark, smoothstep(0.9, 1, sn) * (1 - smoothstep(-0.05, 0.05, cs)) * 0.6);
    const od = Math.hypot(x - OASIS.x, z - OASIS.z);
    sand = mixRgb(sand, C.oasis, (1 - smoothstep(14, 22, od)) * 0.9);
    c = mixRgb(c, sand, wd);
  }
  const wm = biome.mount(z);
  if (wm > 0) {
    let m = mixRgb(C.valley, C.forest, smoothstep(6, 14, h) * 0.7);
    m = mixRgb(m, mixRgb(C.rock, C.rockDark, n), clamp(smoothstep(0.55, 1.1, slope) + smoothstep(17, 25, h)));
    m = mixRgb(m, C.snow, smoothstep(26, 29, h + n * 5 - slope * 3));
    c = mixRgb(c, m, wm);
  }
  const wc = biome.city2(z);
  if (wc > 0) c = mixRgb(c, mixRgb(C.pave2City, C.pave2City2, n), wc);

  // Shores and water depth apply wherever the ground dips near sea level.
  if (h < 1.6) {
    const wetland = biome.fields(z) > 0.5 && Math.abs(x - riverX(z)) < 10;
    const beach = wetland ? C.river : mixRgb(C.sand, C.wetSand, smoothstep(0.9, -0.2, h));
    c = mixRgb(c, beach, smoothstep(1.6, 0.9, h));
    if (h < 0) {
      const t = clamp(-h / 7);
      let w = mixRgb(C.shallow, C.mid, smoothstep(0.02, 0.4, t));
      w = mixRgb(w, C.deep, smoothstep(0.45, 0.95, t));
      c = mixRgb(c, w, smoothstep(0, -0.5, h));
    }
    c = mixRgb(c, C.foam, (1 - smoothstep(0.05, 0.4, Math.abs(h + 0.1))) * 0.75);
  }
  const k = 1 + g * 0.06;
  return [c[0] * k, c[1] * k, c[2] * k];
}

function paintCity(ctx, plan, night) {
  const asphalt = plan.style === 'old' ? '#8f8a86' : '#5d5b63';
  const curb = plan.style === 'old' ? '#e8dcc6' : '#cfc6bd';
  for (const r of plan.roads) {
    ctx.fillStyle = curb;
    ctx.fillRect(r.x0 - 1, r.z0 - 1, r.x1 - r.x0 + 2, r.z1 - r.z0 + 2);
  }
  for (const r of plan.roads) {
    ctx.fillStyle = asphalt;
    ctx.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0);
  }
  ctx.strokeStyle = plan.style === 'old' ? 'rgba(255,248,230,.75)' : 'rgba(255,226,140,.8)';
  ctx.lineWidth = 0.22;
  ctx.setLineDash([1.6, 1.6]);
  for (const r of plan.roads) {
    ctx.beginPath();
    if (r.axis === 'z') { ctx.moveTo(r.c, r.z0); ctx.lineTo(r.c, r.z1); } else { ctx.moveTo(r.x0, r.c); ctx.lineTo(r.x1, r.c); }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(250,246,236,.85)';
  for (const x of plan.xs) for (const z of plan.zs) {
    for (let k = -3; k <= 3; k++) {
      ctx.fillRect(x + k * 0.7 - 0.2, z - 4.4, 0.4, 1.4);
      ctx.fillRect(x - 4.4, z + k * 0.7 - 0.2, 1.4, 0.4);
    }
  }
  for (const p of plan.parks) {
    if (p.kind === 'square') {
      ctx.fillStyle = '#e6d6b8';
      ctx.fillRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0);
      ctx.strokeStyle = 'rgba(150,115,80,.35)';
      ctx.lineWidth = 0.18;
      for (let x = p.x0; x < p.x1; x += 1.6) { ctx.beginPath(); ctx.moveTo(x, p.z0); ctx.lineTo(x, p.z1); ctx.stroke(); }
      for (let z = p.z0; z < p.z1; z += 1.6) { ctx.beginPath(); ctx.moveTo(p.x0, z); ctx.lineTo(p.x1, z); ctx.stroke(); }
      const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
      ctx.fillStyle = '#c9b594'; ctx.beginPath(); ctx.arc(cx, cz, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7cc6d6'; ctx.beginPath(); ctx.arc(cx, cz, 3.2, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    if (p.kind === 'boulevard') {
      ctx.fillStyle = '#d9cbb6';
      ctx.fillRect(p.x0 - 3, p.z0, p.x1 - p.x0 + 6, p.z1 - p.z0);
      ctx.fillStyle = '#7fae5a';
      ctx.fillRect(-2.2, p.z0, 4.4, p.z1 - p.z0 - 14);
      ctx.fillStyle = 'rgba(120,98,80,.25)';
      for (let z = p.z0; z < p.z1; z += 2.4) ctx.fillRect(p.x0 - 3, z, p.x1 - p.x0 + 6, 0.12);
      continue;
    }
    ctx.fillStyle = '#8fbd5e';
    ctx.fillRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0);
    ctx.strokeStyle = '#e9dcc0';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(p.x0, p.z0); ctx.lineTo(p.x1, p.z1);
    ctx.moveTo(p.x1, p.z0); ctx.lineTo(p.x0, p.z1);
    ctx.stroke();
  }
  for (const p of plan.plazas) {
    const grad = ctx.createRadialGradient(p.x, p.z, 2, p.x, p.z, p.r);
    grad.addColorStop(0, plan.style === 'old' ? '#efe3cb' : '#d8cdbf');
    grad.addColorStop(1, plan.style === 'old' ? '#dccaa9' : '#bdb1a4');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x, p.z, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = plan.style === 'old' ? 'rgba(160,120,80,.35)' : 'rgba(80,70,90,.35)';
    ctx.lineWidth = 0.3;
    for (let rr = 5; rr < p.r; rr += 3.2) { ctx.beginPath(); ctx.arc(p.x, p.z, rr, 0, Math.PI * 2); ctx.stroke(); }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * 5, p.z + Math.sin(a) * 5); ctx.lineTo(p.x + Math.cos(a) * p.r, p.z + Math.sin(a) * p.r); ctx.stroke();
    }
  }
  // Soft contact shadow at every lot so buildings sit on the ground.
  ctx.fillStyle = plan.style === 'old' ? 'rgba(90,70,50,.28)' : 'rgba(40,36,48,.32)';
  for (const l of plan.lots) ctx.fillRect(l.x - l.w / 2 - 0.35, l.z - l.d / 2 - 0.35, l.w + 0.7, l.d + 0.7);
  if (night) {
    // Warm pools of light along the streets.
    for (const r of plan.roads) {
      if (r.axis !== 'z') continue;
      for (let z = r.z0; z < r.z1; z += 9) {
        const g = ctx.createRadialGradient(r.c + 3, z, 0, r.c + 3, z, 4);
        g.addColorStop(0, 'rgba(255,200,120,.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g; ctx.fillRect(r.c - 1, z - 4, 8, 8);
      }
    }
  }
}

function paintFields(ctx, cells) {
  const r = rng(9);
  for (const cell of cells) {
    const h = heightAt(cell.x, cell.z);
    if (h < 1.2 || biome.fields(cell.z) < 0.6) continue;
    const s = STOPS[2];
    if (Math.hypot(cell.x - s.x, cell.z - s.z) < 16) continue;
    if (Math.abs(cell.x - riverX(cell.z)) < cell.w * 0.5 + 8) continue;
    ctx.save();
    ctx.translate(cell.x, cell.z);
    ctx.rotate(cell.angle);
    ctx.fillStyle = cell.crop.fill;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(-cell.w / 2, -cell.d / 2, cell.w, cell.d);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = cell.crop.rows;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    if (cell.rowAngle === 0) for (let x = -cell.w / 2 + 0.6; x < cell.w / 2; x += 1.1) { ctx.moveTo(x, -cell.d / 2); ctx.lineTo(x, cell.d / 2); }
    else for (let z = -cell.d / 2 + 0.6; z < cell.d / 2; z += 1.1) { ctx.moveTo(-cell.w / 2, z); ctx.lineTo(cell.w / 2, z); }
    ctx.stroke();
    if (r() < 0.35) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#e9d59a';
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(r.range(-cell.w / 2 + 1, cell.w / 2 - 1), r.range(-cell.d / 2 + 1, cell.d / 2 - 1), 0.55, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // A winding lane to the coast.
  ctx.strokeStyle = '#d8c39a';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let z = 236; z <= 486; z += 4) {
    const x = 34 + 14 * Math.sin(z * 0.03) + 6 * Math.sin(z * 0.011);
    if (z === 236) ctx.moveTo(x, z); else ctx.lineTo(x, z);
  }
  ctx.stroke();
}

function paintDesert(ctx) {
  const r = rng(77);
  ctx.lineWidth = 0.25;
  for (let i = 0; i < 1400; i++) {
    const x = r.range(-X_HALF, X_HALF), z = r.range(740, 990);
    const s = duneShape(x, z);
    ctx.strokeStyle = s > 0.4 ? 'rgba(255,240,205,.5)' : 'rgba(170,110,60,.22)';
    ctx.beginPath();
    const len = r.range(3, 9);
    ctx.moveTo(x, z);
    ctx.quadraticCurveTo(x + len * 0.5, z + r.range(-1, 1) - len * 0.18, x + len, z - len * 0.25);
    ctx.stroke();
  }
  // Caravan track.
  ctx.strokeStyle = 'rgba(160,110,70,.35)';
  ctx.setLineDash([0.5, 0.8]);
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  for (let z = 742; z < 990; z += 3) {
    const x = -24 + 12 * Math.sin(z * 0.02);
    if (z === 742) ctx.moveTo(x, z); else ctx.lineTo(x, z);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function paintHarbour(ctx) {
  ctx.fillStyle = '#9c7a57';
  for (let z = 1290; z < 1560; z += 36) ctx.fillRect(58, z, 16, 2.4);
  ctx.fillStyle = '#b89b78';
  ctx.fillRect(55, 1280, 3.5, 290);
}

export function buildTerrain({ scene, cityPlans, fields, textureSize, anisotropy }) {
  const chunks = [];
  // Shared smooth material across biome boundaries.
  const material = (map) => new THREE.MeshStandardMaterial({ map, roughness: .98, flatShading: false });
  const cols = Math.round((X_HALF * 2) / STEP) + 1;
  const pending = [];
  for (let z0 = Z_MIN; z0 < Z_MAX; z0 += CHUNK) {
    const rows = Math.round(CHUNK / STEP) + 1;
    const heights = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) heights[j * cols + i] = heightAt(-X_HALF + i * STEP, z0 + j * STEP);
    const geo = new THREE.PlaneGeometry(X_HALF * 2, CHUNK, cols - 1, rows - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k) + z0 + CHUNK / 2;
      const i = Math.round((x + X_HALF) / STEP), j = Math.round((z - z0) / STEP);
      pos.setY(k, heights[j * cols + i]);
      pos.setZ(k, z);
    }
    // Sample across chunk boundaries so shared edges have identical normals.
    const normals=geo.attributes.normal;
    for(let k=0;k<pos.count;k++){
      const x=pos.getX(k),z=pos.getZ(k),e=.7;
      const nx=heightAt(x-e,z)-heightAt(x+e,z),nz=heightAt(x,z-e)-heightAt(x,z+e);
      const length=Math.hypot(nx,2*e,nz);
      normals.setXYZ(k,nx/length,2*e/length,nz/length);
    }
    geo.computeBoundingSphere();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = textureSize;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    const mesh = new THREE.Mesh(geo, material(tex));
    mesh.receiveShadow = true;
    mesh.castShadow = z0 >= 720 && z0 < 1280;
    scene.add(mesh);
    const chunk = { z0, mesh, canvas, tex, heights, cols, rows, painted: false };
    chunks.push(chunk);
    pending.push(chunk);
  }

  const paint = (chunk) => {
    const { canvas, z0, heights, cols, rows } = chunk;
    const ctx = canvas.getContext('2d');
    // Base colour pass at one pixel per world unit, upscaled with smoothing.
    const res = z0 >= 720 && z0 < 1200 ? 2 : 1;
    const bw = X_HALF * 2 * res, bh = CHUNK * res;
    const base = document.createElement('canvas');
    base.width = bw; base.height = bh;
    const bctx = base.getContext('2d');
    const img = bctx.createImageData(bw, bh);
    const hAt = (x, z) => {
      const fx = (x + X_HALF) / STEP, fz = (z - z0) / STEP;
      const i = Math.min(cols - 2, Math.max(0, Math.floor(fx))), j = Math.min(rows - 2, Math.max(0, Math.floor(fz)));
      const u = fx - i, v = fz - j;
      const a = heights[j * cols + i], b = heights[j * cols + i + 1], c = heights[(j + 1) * cols + i], d = heights[(j + 1) * cols + i + 1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    for (let py = 0; py < bh; py++) {
      const z = z0 + (py + 0.5) / res;
      for (let px = 0; px < bw; px++) {
        const x = -X_HALF + (px + 0.5) / res;
        const h = hAt(x, z);
        const slope = Math.hypot(hAt(x + 1, z) - hAt(x - 1, z), hAt(x, z + 1) - hAt(x, z - 1)) * 0.5;
        const c = baseColor(x, z, h, slope);
        const o = (py * bw + px) * 4;
        img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
    // Vector details in world units.
    const s = canvas.width / (X_HALF * 2);
    ctx.setTransform(s, 0, 0, canvas.height / CHUNK, X_HALF * s, -z0 * (canvas.height / CHUNK));
    const inRange = (a, b) => b > z0 - 10 && a < z0 + CHUNK + 10;
    for (const plan of cityPlans) if (inRange(plan.zs[0], plan.zs[plan.zs.length - 1])) paintCity(ctx, plan, plan.style === 'new');
    if (inRange(200, 520)) paintFields(ctx, fields);
    if (inRange(730, 1000)) paintDesert(ctx);
    if (inRange(1270, 1580)) paintHarbour(ctx);
    // Painted contact under landmark foundations; no fullscreen AO pass.
    for(const [i,stop] of STOPS.entries()){
      if(!inRange(stop.z-20,stop.z+20))continue;
      const radius=[7,8,5,3.5,18,2.5,5][i];
      const shadow=ctx.createRadialGradient(stop.x,stop.z,0,stop.x,stop.z,radius);
      shadow.addColorStop(0,'rgba(57,43,35,.25)');shadow.addColorStop(.6,'rgba(57,43,35,.12)');shadow.addColorStop(1,'rgba(57,43,35,0)');
      ctx.fillStyle=shadow;ctx.fillRect(stop.x-radius,stop.z-radius,radius*2,radius*2);
    }
    // Fine grain so close-ups do not look airbrushed.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const grain = rng(z0 + 999);
    for (let i = 0; i < canvas.width * 6; i++) {
      ctx.fillStyle = grain() < 0.5 ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.04)';
      ctx.fillRect(grain() * canvas.width, grain() * canvas.height, 2, 2);
    }
    chunk.tex.needsUpdate = true;
    chunk.painted = true;
  };

  return {
    chunks,
    // Paint the chunk nearest the camera first, one chunk per call.
    paintNext(zFocus) {
      if (!pending.length) return false;
      pending.sort((a, b) => Math.abs(a.z0 + CHUNK / 2 - zFocus) - Math.abs(b.z0 + CHUNK / 2 - zFocus));
      paint(pending.shift());
      return pending.length > 0;
    },
    ensurePainted(zFocus) {
      for (let i = pending.length - 1; i >= 0; i--) {
        const c = pending[i];
        if (Math.abs(c.z0 + CHUNK / 2 - zFocus) < CHUNK) { pending.splice(i, 1); paint(c); }
      }
    },
  };
}

export function buildWater(scene) {
  // Tileable normal map from periodic value noise.
  const size = 256, period = 8;
  const hgt = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x / size) * period, v = (y / size) * period;
    hgt[y * size + x] = noise(u, v, 11, period) * 0.6 + noise(u * 2, v * 2, 12, period * 2) * 0.3 + noise(u * 4, v * 4, 13, period * 4) * 0.1;
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hx = hgt[y * size + ((x + 1) % size)] - hgt[y * size + ((x - 1 + size) % size)];
    const hy = hgt[((y + 1) % size) * size + x] - hgt[((y - 1 + size) % size) * size + x];
    const nx = -hx * 6, ny = -hy * 6, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    const o = (y * size + x) * 4;
    img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const normalMap = new THREE.CanvasTexture(canvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(12, 96);
  const mat = new THREE.MeshPhongMaterial({
    color: '#65afb4', specular: '#8bb2b4', shininess: 24, transparent: true, opacity: 0.48,
    normalMap, normalScale: new THREE.Vector2(0.22, 0.22), depthWrite: false,
  });
  const geo = new THREE.PlaneGeometry(X_HALF * 2 + 400, Z_MAX - Z_MIN + 400);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, mat);
  water.position.set(0, 0, (Z_MIN + Z_MAX) / 2);
  water.receiveShadow = true;
  water.renderOrder = 2;
  scene.add(water);
  return {
    mesh: water,
    update(t) {
      normalMap.offset.set(t * 0.002, t * 0.005);
    },
  };
}

export { CHUNK, LAND };
