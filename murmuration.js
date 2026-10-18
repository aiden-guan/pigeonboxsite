// Hero: a flock of envelopes drifts like pigeons over the paper. Tracking
// brackets follow the three that need a reply. The pointer is a hawk: the flock
// breaks around it.
// Envelopes are WebGL point sprites; the overlay is a 2D canvas.

const VERT = `
attribute vec2 a_pos;
attribute vec4 a_look; // size, heading, copper, alpha
uniform vec2 u_res;
uniform float u_dpr;
varying vec3 v_look;
void main() {
  vec2 clip = a_pos / u_res * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = a_look.x * u_dpr;
  v_look = a_look.yzw;
}`;

const FRAG = `
precision mediump float;
varying vec3 v_look;
uniform vec3 u_ink;
uniform vec3 u_copper;
uniform vec3 u_paper;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 p = gl_PointCoord - 0.5;
  p.y = -p.y;
  float c = cos(v_look.x), s = sin(v_look.x);
  vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
  vec2 h = vec2(0.4, 0.26);
  if (abs(q.x) > h.x || abs(q.y) > h.y) discard;
  vec3 col = mix(u_ink, u_copper, v_look.y);
  float crease = min(seg(q, vec2(-h.x, h.y), vec2(0.0, -0.03)), seg(q, vec2(h.x, h.y), vec2(0.0, -0.03)));
  if (crease < 0.05) col = u_paper;
  gl_FragColor = vec4(col * v_look.z, v_look.z);
}`;

const INK = [0.094, 0.098, 0.106];
const COPPER = [0.659, 0.314, 0.173];
const PAPER = [0.953, 0.941, 0.910];
const TRACKED = [
  { who: 'Maya Chen' },
  { who: 'Jonas Weber' },
  { who: 'Dana Kim' },
];

export function mountMurmuration({ host, field, overlay, stage, coords }) {
  const gl = field.getContext('webgl', { antialias: false, premultipliedAlpha: true, alpha: true });
  const ctx = overlay.getContext('2d');
  if (!gl || !ctx) return null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const compile = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  const aPos = gl.getAttribLocation(program, 'a_pos');
  const aLook = gl.getAttribLocation(program, 'a_look');
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aLook);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(aLook, 4, gl.FLOAT, false, 24, 8);
  const uRes = gl.getUniformLocation(program, 'u_res');
  const uDpr = gl.getUniformLocation(program, 'u_dpr');
  gl.uniform3fv(gl.getUniformLocation(program, 'u_ink'), INK);
  gl.uniform3fv(gl.getUniformLocation(program, 'u_copper'), COPPER);
  gl.uniform3fv(gl.getUniformLocation(program, 'u_paper'), PAPER);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let W = 0, H = 0, dpr = 1, n = 0, narrow = false;
  let px, py, vx, vy, ou, ov, depth, verts, cellHead, cellNext;
  let cols = 0, rows = 0, cellSize = 24;
  let frame = 0, visible = true, t = 0, last = 0;
  const box = { cx: 0, cy: 0, rx: 0, ry: 0, bottom: 0 };
  const hawk = { x: -1e4, y: -1e4, until: 0 };
  const tracked = [0, 1, 2];
  const labels = tracked.map(() => ({ x: 0, y: 0, ready: false }));

  function layout() {
    const r = host.getBoundingClientRect();
    W = r.width; H = r.height;
    if (!W || !H) return false;
    dpr = Math.min(2, devicePixelRatio || 1);
    for (const c of [field, overlay]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    gl.viewport(0, 0, field.width, field.height);
    gl.uniform2f(uRes, W, H);
    gl.uniform1f(uDpr, dpr);
    const s = stage.getBoundingClientRect();
    box.cx = s.left - r.left + s.width / 2;
    box.cy = s.top - r.top + s.height / 2;
    // One radius for the flock so it stays compact however it turns.
    box.rx = box.ry = Math.min(s.width * 0.5, s.height * (W < 760 ? 0.34 : 0.42));
    box.bottom = s.top - r.top + s.height;
    narrow = W < 760;
    cellSize = narrow ? 18 : 24;
    cols = Math.ceil(W / cellSize) + 2;
    rows = Math.ceil(H / cellSize) + 2;
    cellHead = new Int32Array(cols * rows);
    return true;
  }

  function seed() {
    n = narrow ? 320 : 680;
    px = new Float32Array(n); py = new Float32Array(n);
    vx = new Float32Array(n); vy = new Float32Array(n);
    ou = new Float32Array(n); ov = new Float32Array(n);
    depth = new Float32Array(n);
    verts = new Float32Array(n * 6);
    cellNext = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      // A body of the flock: dense core, ragged edges.
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.6);
      ou[i] = Math.cos(a) * r;
      ov[i] = Math.sin(a) * r;
      depth[i] = 0.62 + Math.random() * 0.55;
      const tgt = target(i, 0);
      px[i] = tgt[0] + (Math.random() - 0.5) * 40;
      py[i] = tgt[1] + (Math.random() - 0.5) * 40;
      vx[i] = 2.2; vy[i] = (Math.random() - 0.5);
    }
    // Three copper envelopes, picked from the middle of the flock.
    for (let k = 0; k < 3; k++) { tracked[k] = k * 7 + 3; depth[tracked[k]] = 1.25; }
    labels.forEach((l) => { l.ready = false; });
  }

  // The flock's shape drifts: ribbon, ball, crescent, and back.
  const tg = [0, 0];
  function target(i, time) {
    const theta = time * 0.13 + Math.sin(time * 0.37) * 0.7;
    const stretch = 1 + 0.4 * Math.sin(time * 0.23);
    const bend = Math.sin(time * 0.19) * 0.9;
    const u = ou[i] * stretch;
    const v = ov[i] * (0.55 / stretch) + bend * ou[i] * ou[i] * 0.5;
    const c = Math.cos(theta), s = Math.sin(theta);
    const cx = box.cx + Math.sin(time * 0.21) * box.rx * (narrow ? 0.4 : 0.28);
    const cy = box.cy + Math.sin(time * 0.29 + 1.3) * box.ry * (narrow ? 0.12 : 0.3);
    tg[0] = cx + (u * c - v * s) * box.rx * 0.78;
    tg[1] = cy + (u * s + v * c) * box.ry * 0.62;
    return tg;
  }

  function step(k) {
    const R = narrow ? 16 : 22;
    const R2 = R * R;
    const SEP = narrow ? 6 : 8;
    const SEP2 = SEP * SEP;
    const maxV = narrow ? 1.9 : 2.2;
    const minV = 0.9;
    // Bucket the flock into a grid for neighbour lookups.
    cellHead.fill(-1);
    for (let i = 0; i < n; i++) {
      const cx = Math.min(cols - 1, Math.max(0, (px[i] / cellSize | 0) + 1));
      const cy = Math.min(rows - 1, Math.max(0, (py[i] / cellSize | 0) + 1));
      const c = cy * cols + cx;
      cellNext[i] = cellHead[c];
      cellHead[c] = i;
    }
    const hawkOn = hawk.until > t;
    for (let i = 0; i < n; i++) {
      const x = px[i], y = py[i];
      let ax = 0, ay = 0, sx = 0, sy = 0, count = 0;
      const gx = Math.min(cols - 1, Math.max(0, (x / cellSize | 0) + 1));
      const gy = Math.min(rows - 1, Math.max(0, (y / cellSize | 0) + 1));
      for (let oy = -1; oy <= 1 && count < 14; oy++) {
        const yy = gy + oy;
        if (yy < 0 || yy >= rows) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = gx + ox;
          if (xx < 0 || xx >= cols) continue;
          for (let j = cellHead[yy * cols + xx]; j !== -1 && count < 14; j = cellNext[j]) {
            if (j === i) continue;
            const dx = px[j] - x, dy = py[j] - y;
            const d2 = dx * dx + dy * dy;
            if (d2 > R2) continue;
            ax += vx[j]; ay += vy[j]; count++;
            if (d2 < SEP2 && d2 > 0.0001) { const inv = 1 / d2; sx -= dx * inv; sy -= dy * inv; }
          }
        }
      }
      let ux = vx[i], uy = vy[i];
      if (count) { ux += (ax / count - ux) * 0.07 * k; uy += (ay / count - uy) * 0.07 * k; }
      ux += sx * 0.9 * k; uy += sy * 0.9 * k;
      const tgt = target(i, t);
      ux += (tgt[0] - x) * 0.0016 * k;
      uy += (tgt[1] - y) * 0.0016 * k;
      if (hawkOn) {
        const dx = x - hawk.x, dy = y - hawk.y;
        const d2 = dx * dx + dy * dy;
        const HR = narrow ? 110 : 170;
        if (d2 < HR * HR && d2 > 1) {
          const d = Math.sqrt(d2);
          const f = (1 - d / HR) * 2.4 * k;
          ux += (dx / d) * f; uy += (dy / d) * f;
        }
      }
      const sp = Math.hypot(ux, uy) || 1;
      const cl = Math.min(maxV * (hawkOn ? 1.6 : 1), Math.max(minV, sp)) / sp;
      vx[i] = ux * cl; vy[i] = uy * cl;
    }
    for (let i = 0; i < n; i++) { px[i] += vx[i] * k; py[i] += vy[i] * k; }
  }

  function draw() {
    const base = narrow ? 6.5 : 7.5;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      const isT = i === tracked[0] || i === tracked[1] || i === tracked[2];
      verts[o] = px[i]; verts[o + 1] = py[i];
      verts[o + 2] = base * depth[i] * (isT ? 1.75 : 1);
      verts[o + 3] = Math.atan2(vy[i], vx[i]);
      verts[o + 4] = isT ? 1 : 0;
      verts[o + 5] = isT ? 1 : 0.22 + (depth[i] - 0.62) * 0.55;
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, n);
    drawOverlay();
  }

  function drawOverlay() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Tracking brackets and labels for the three.
    ctx.font = `500 9.5px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    tracked.forEach((i, k) => {
      const x = px[i], y = py[i];
      const b = 10, tick = 4;
      ctx.strokeStyle = '#18191b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(x + sx * b, y + sy * (b - tick));
        ctx.lineTo(x + sx * b, y + sy * b);
        ctx.lineTo(x + sx * (b - tick), y + sy * b);
      }
      ctx.stroke();
      // Label sits outside the flock, flipping side near the edges; it eases, the bracket doesn't.
      const info = TRACKED[k];
      const id = `0${k + 1}`;
      const line = narrow ? '' : info.who; // phones: number tags only
      const lw = ctx.measureText(line).width;
      const w = narrow ? 22 : 26 + lw + 12, h = 18;
      // Labels stack in their own lanes beside the bird, on whichever side has room.
      const gap = narrow ? 26 : 38;
      const side = x + gap + w < W - 12 ? 1 : -1;
      const want = [x + side * gap, y - (narrow ? 24 : 32)];
      const l = labels[k];
      if (!l.ready) { l.x = want[0]; l.y = want[1]; l.ready = true; }
      l.x += (want[0] - l.x) * 0.12; l.y += (want[1] - l.y) * 0.12;
      let lx = side > 0 ? l.x : l.x - w;
      lx = Math.min(W - w - 8, Math.max(8, lx));
      const ly = Math.min((narrow ? box.bottom : H) - h - 8, Math.max(8, l.y - h / 2));
      ctx.beginPath();
      ctx.moveTo(x + side * b, y - b);
      ctx.lineTo(side > 0 ? lx : lx + w, ly + h / 2);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#faf8f3';
      ctx.fillRect(lx, ly, w, h);
      ctx.strokeRect(lx + 0.5, ly + 0.5, w - 1, h - 1);
      ctx.fillStyle = '#a8502c';
      ctx.fillRect(lx, ly, 22, h);
      ctx.fillStyle = '#faf8f3';
      ctx.fillText(id, lx + 6, ly + h / 2 + 0.5);
      ctx.fillStyle = '#18191b';
      ctx.fillText(line, lx + 30, ly + h / 2 + 0.5);
    });
  }

  let coordTick = 0;
  const showCoords = () => {
    if (!coords) return;
    const i = tracked[0];
    coords.textContent = `${String(Math.round(px[i])).padStart(4, '0')} ${String(Math.round(py[i])).padStart(4, '0')}`;
  };
  function loop(now) {
    frame = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    t += dt;
    step(dt * 60);
    draw();
    if (++coordTick % 6 === 0) showCoords();
    schedule();
  }
  function schedule() { if (!frame && visible && !document.hidden && !reduce.matches) frame = requestAnimationFrame(loop); }

  function start() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!layout()) return;
    seed();
    t = 0; last = 0;
    // Warm up so the first frame is already a flock, not a cloud.
    for (let s = 0; s < 90; s++) { t += 1 / 60; step(1); }
    draw();
    showCoords();
    schedule();
  }

  let resizeTimer = 0;
  let lastW = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = host.getBoundingClientRect().width;
      if (Math.abs(w - lastW) < 2 && n) { layout(); draw(); return; } // mobile URL bar: keep the flock
      lastW = w;
      start();
    }, 150);
  }).observe(host);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); }).observe(host);
  document.addEventListener('visibilitychange', () => { last = 0; schedule(); });
  reduce.addEventListener('change', () => { last = 0; draw(); schedule(); });

  host.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const r = host.getBoundingClientRect();
    hawk.x = event.clientX - r.left; hawk.y = event.clientY - r.top; hawk.until = t + 0.25;
  });
  host.addEventListener('pointerdown', (event) => {
    if (event.target.closest('a, button')) return;
    const r = host.getBoundingClientRect();
    hawk.x = event.clientX - r.left; hawk.y = event.clientY - r.top; hawk.until = t + 0.9;
  });

  const fonts = document.fonts?.load ? document.fonts.load('500 10px "IBM Plex Mono"').catch(() => undefined) : Promise.resolve();
  fonts.then(() => { lastW = host.getBoundingClientRect().width; start(); });
  return { start };
}
