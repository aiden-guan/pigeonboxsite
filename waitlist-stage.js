// Waitlist hero: a little world printed in halftone, with Pidgy at its centre.
// Everything (sky, props, Pidgy himself) is painted as tone into a tiny buffer, one pixel
// per dot, then printed as ink dots on paper. Props are real buttons: each one cues a
// routine from Pidgy's sprite sheets, and the prop he's busy with blooms copper.

const CELL = 96;                                   // sprite cell on /brand/pidgy-world.webp
const INK = '24,25,27', COPPER = '168,80,44';
const BIRD = 24;                                   // 20% smaller; pose bounds normalize to one visible height
const BODY_ANCHOR_X = 44, GROUND_ANCHOR_Y = 92;    // stable pigeon pivot in the sprite atlas
const RES = 1.6;                                   // dots per world unit

// row on the sheet, frame order, ms per frame; `hide` lifts a prop while Pidgy holds it.
const ROUTINES = {
  route:   { row: 1, frames: [0, 1, 2, 3, 0, 1, 2, 3], ms: 240 },
  draft:   { row: 2, frames: [0, 1, 2, 3], ms: 230 },
  search:  { row: 3, frames: [0, 1, 2, 3, 0, 1, 2, 3], ms: 280 },
  alert:   { row: 4, frames: [0, 1, 2, 3, 0, 1, 2, 3], ms: 190 },
  tea:     { row: 5, frames: [0, 1, 2, 2, 1, 2, 3, 0], ms: 430, hide: 'tea' },
  sleep:   { row: 6, frames: [0, 1, 2, 1, 2, 1, 2, 1, 2, 3], ms: 620, night: true },
  parcel:  { row: 7, frames: [0, 1, 2, 3, 1, 2, 3, 0], ms: 380, hide: 'parcel' },
  plane:   { row: 8, frames: [0, 1, 2, 3, 0, 1, 2, 3], ms: 300, hide: 'plane' },
  wave:    { row: 9, frames: [0, 1, 2, 1, 2, 1, 3], ms: 260 },
  stars:   { row: 10, frames: [0, 1, 2, 1, 2, 1, 2, 3], ms: 330, sparkle: true },
  map:     { row: 11, frames: [0, 1, 2, 3, 1, 2, 3, 0], ms: 430 },
  lantern: { row: 12, frames: [0, 1, 2, 3, 1, 2, 3, 0], ms: 430, hide: 'lantern' },
};

// Props in dot units around Pidgy's feet (y grows downward, 0 is the ground).
const PROPS = [
  { id: 'map',     label: 'Read the map',      box: [-38, -27, 13, 27] },
  { id: 'tea',     label: 'Tea break',         box: [-27, -18, 15, 18] },
  { id: 'pidgy',   label: 'Say hello',         box: [-BIRD * .34, -BIRD * .86, BIRD * .68, BIRD * .86], routine: 'wave' },
  { id: 'parcel',  label: 'Open a parcel',     box: [14, -13, 12, 13] },
  { id: 'mail',    label: 'Check the mail',    box: [25, -21, 11, 21], routine: 'alert' },
  { id: 'laptop',  label: 'Run the inbox',     box: [36, -16, 13, 16], routine: 'route' },
  { id: 'lantern', label: 'Light the lantern', box: [44, -39, 12, 39] },
  { id: 'moon',    label: 'Goodnight',         box: [30, -68, 15, 15], routine: 'sleep' },
  { id: 'star',    label: 'Make a wish',       box: [-14, -76, 46, 12], routine: 'stars' },
  { id: 'plane',   label: 'Catch the plane',   box: [0, 0, 9, 7], moving: true },
];
const STARS = [[-10, -70], [4, -66], [16, -73], [27, -67]];
const AMBIENT = ['tea', 'map', 'stars', 'parcel', 'lantern', 'plane', 'search', 'wave', 'route', 'draft'];

export function startStage() {
  const stage = document.querySelector('.wl-stage');
  const canvas = stage?.querySelector('.wl-dots');
  const layer = stage?.querySelector('.wl-props');
  const tip = stage?.querySelector('.wl-tip');
  if (!canvas || !layer) return null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const out = canvas.getContext('2d');
  const buf = document.createElement('canvas'), g = buf.getContext('2d', { willReadFrequently: true });
  const acc = document.createElement('canvas'), a = acc.getContext('2d', { willReadFrequently: true });
  const sheet = new Image();
  sheet.src = '/brand/pidgy-world.webp';
  let spriteBounds = [], spriteScale = [];

  let W = 0, H = 0, dpr = 1, cell = 7, dot = 4, cols = 0, rows = 0, ax = 0, gy = 0, fade = [], tone = new Float32Array(0);
  let routine = null, routineAt = 0, queue = [], lastPlay = performance.now(), hovered = null, focusProp = null;
  let night = 0, plane = { x: -30, y: -48, dir: 1 }, planeAway = 0;
  const mouse = { x: -1e4, y: -1e4 }, ripples = [], sparks = [], steam = [];

  // One focusable button per prop, laid over the dots.
  const buttons = new Map(PROPS.map(p => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'wl-prop'; b.setAttribute('aria-label', p.label);
    b.addEventListener('click', () => trigger(p));
    b.addEventListener('pointerenter', event => { if (event.pointerType === 'touch') return; hovered = p.id; showTip(p); });
    b.addEventListener('pointerleave', () => { if (hovered === p.id) hovered = null; hideTip(); });
    b.addEventListener('focus', () => { if (b.matches(':focus-visible')) { hovered = p.id; showTip(p); } });
    b.addEventListener('blur', () => { hovered = null; hideTip(); });
    layer.append(b);
    return [p.id, b];
  }));

  function layout() {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(2, devicePixelRatio || 1);
    const narrow = matchMedia('(max-width: 900px)').matches;
    // Read the resolved padding: CSS reserves the scene height plus a 28px text gap.
    const sceneHeight = narrow ? parseFloat(getComputedStyle(stage).paddingTop) - 28 : 0;
    cell = narrow ? Math.min(4.5, W / 112) : Math.max(4.4, Math.min(8.5, W / 172, H / 100));
    dot = cell / RES; cols = Math.ceil(W / dot); rows = Math.ceil(H / dot);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    buf.width = acc.width = cols; buf.height = acc.height = rows;
    tone = new Float32Array(cols * rows);
    ax = narrow ? Math.round(W / cell / 2 - 9) : Math.round(W / cell * .64);
    gy = narrow ? Math.round(sceneHeight / cell) : Math.round(H / cell * .8);
    // The world fades out before it reaches the headline on wide screens.
    fade = Array.from({ length: cols }, (_, x) => narrow ? 1 : smooth(ax - 66, ax - 42, x / RES));
    for (const p of PROPS) if (!p.moving) place(p, p.box[0], p.box[1]);
  }

  function place(p, x, y) {
    const b = buttons.get(p.id), [, , w, h] = p.box;
    b.style.transform = `translate(${(ax + x) * cell}px, ${(gy + y) * cell}px)`;
    b.style.width = `${w * cell}px`; b.style.height = `${h * cell}px`;
  }

  function showTip(p) {
    if (!tip) return;
    tip.textContent = p.label;
    const [x, y, w] = p.moving ? [plane.x - 4, plane.y - 3, 9] : p.box;
    tip.style.transform = `translate(${(ax + x + w / 2) * cell}px, ${(gy + y) * cell - 10}px) translate(-50%, -100%)`;
    tip.dataset.show = 'true';
  }
  function hideTip() { if (tip) tip.dataset.show = 'false'; }

  function play(name, now = performance.now()) {
    if (routine?.name === name) return;
    routine = { name, ...ROUTINES[name] }; routineAt = now; lastPlay = now;
  }

  function trigger(p) {
    const name = p.routine || p.id;
    const [x, y, w, h] = p.moving ? [plane.x - 4, plane.y - 3, 9, 7] : p.box;
    if (!reduced) ripples.push({ x: x + w / 2, y: y + h / 2, at: performance.now() });
    if (name === 'plane') planeAway = performance.now();
    queue = []; routine = null; play(name);
  }

  // ---------- Painting (into the 1-pixel-per-dot buffer) ----------

  const rect = (c, x, y, w, h, t) => { c.fillStyle = `rgba(0,0,0,${t})`; c.fillRect(x, y, w, h); };
  const disc = (c, x, y, r, t) => { c.fillStyle = `rgba(0,0,0,${t})`; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };
  const clear = (c, x, y, w, h) => { c.fillStyle = '#fff'; c.fillRect(x, y, w, h); };
  const glow = (c, x, y, r, k) => {
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${k})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  };
  const holding = id => routine?.hide === id;

  const painters = {
    map(c) {
      rect(c, -32.5, -26, 1.4, 26, .85);
      c.fillStyle = 'rgba(0,0,0,.62)';
      c.beginPath(); c.moveTo(-38, -25); c.lineTo(-27, -25); c.lineTo(-25, -23); c.lineTo(-27, -21); c.lineTo(-38, -21); c.fill();
      c.beginPath(); c.moveTo(-26, -19); c.lineTo(-36, -19); c.lineTo(-38, -17); c.lineTo(-36, -15); c.lineTo(-26, -15); c.fill();
      rect(c, -36, -23.4, 7, .6, .95); rect(c, -34.5, -17.4, 6, .6, .95);
    },
    tea(c, t) {
      rect(c, -26, -11.5, 14, 1.4, .85); rect(c, -24.5, -10, 1, 10, .75); rect(c, -14.5, -10, 1, 10, .75);
      if (holding('tea')) return;
      rect(c, -22.5, -12.4, 7.5, .9, .55);
      rect(c, -21.6, -16.4, 5, 4, .72); clear(c, -21, -16.2, 3.8, .7);
      c.strokeStyle = 'rgba(0,0,0,.72)'; c.lineWidth = .9; c.beginPath(); c.arc(-16.2, -14.6, 1.3, -1.4, 1.4); c.stroke();
      for (const s of steam) disc(c, -19 + s.x, -17 - s.y, .55, .35 * (1 - s.y / 9));
    },
    parcel(c) {
      if (holding('parcel')) { rect(c, 15, -.8, 10, .8, .3); return; }
      rect(c, 15, -7, 10, 7, .5); rect(c, 19.4, -7, 1.2, 7, .95); rect(c, 15, -4, 10, 1, .95);
      rect(c, 17, -12, 6.5, 5, .4); rect(c, 19.7, -12, 1, 5, .9);
      disc(c, 19.2, -12.8, 1.1, .9); disc(c, 21.4, -12.8, 1.1, .9);
    },
    mail(c) {
      rect(c, 29.6, -12, 1.5, 12, .85);
      c.fillStyle = 'rgba(0,0,0,.7)'; c.beginPath(); c.moveTo(25.5, -12); c.lineTo(25.5, -17); c.arc(30.3, -17, 4.8, Math.PI, 0); c.lineTo(35.1, -12); c.fill();
      rect(c, 27, -15.5, 6, .8, .98);
      const up = routine?.name === 'alert';
      rect(c, 34.6, up ? -21 : -16, .9, up ? 7 : 4, .9); rect(c, 35.2, up ? -21 : -13.2, up ? 3 : 2.6, 1.7, .9);
    },
    laptop(c, t) {
      rect(c, 37, -8, 11, 8, .42); for (let y = -6.5; y < 0; y += 2.4) rect(c, 37, y, 11, .5, .7); rect(c, 37, -8, .7, 8, .8); rect(c, 47.3, -8, .7, 8, .8);
      rect(c, 38.3, -9, 8.8, 1, .88); rect(c, 39, -15.4, 7.4, 6.4, .92);
      clear(c, 40, -14, .8, .8); clear(c, 40.8, -13.2, .8, .8); clear(c, 40, -12.4, .8, .8);
      if (Math.floor(t / 500) % 2) clear(c, 42.2, -12.2, 1.8, .6);
    },
    lantern(c, t, n) {
      rect(c, 52, -38, 1.6, 38, .85); rect(c, 47, -38.4, 6.4, 1.2, .85); rect(c, 51, -1.4, 3.6, 1.4, .9);
      if (holding('lantern')) return;
      rect(c, 47.9, -37.4, .7, 2, .85); rect(c, 46.2, -35.6, 4.2, 6, .82); rect(c, 45.8, -36, 5, 1, .9); rect(c, 45.8, -30, 5, 1, .9);
      clear(c, 47, -34.6, 2.6, 4);
      if (n > .05) glow(c, 48.3, -32.6, 9 + Math.sin(t / 130) * .6, .9 * n);
    },
    moon(c, t, n) {
      if (n > .05) glow(c, 37, -60, 13, .85 * n);
      disc(c, 37, -60, 5, .38 * (1 - n));
      if (n > .05) { c.globalAlpha = n; c.fillStyle = '#fff'; c.beginPath(); c.arc(37, -60, 5, 0, 6.2832); c.fill(); c.globalAlpha = 1; }
      c.fillStyle = n > .5 ? `rgba(0,0,0,${.5 * n})` : '#fff';
      c.beginPath(); c.arc(39.4, -61.4, 4.3, 0, 6.2832); c.fill();
    },
    star(c, t, n) {
      STARS.forEach(([x, y], i) => {
        const tw = .55 + .45 * Math.sin(t / 380 + i * 1.7), s = 1.4 + tw * .9;
        c.fillStyle = n > .5 ? '#fff' : `rgba(0,0,0,${.35 + tw * .4})`;
        c.beginPath(); c.moveTo(x, y - s * 1.6); c.lineTo(x + s * .35, y - s * .35); c.lineTo(x + s * 1.6, y); c.lineTo(x + s * .35, y + s * .35);
        c.lineTo(x, y + s * 1.6); c.lineTo(x - s * .35, y + s * .35); c.lineTo(x - s * 1.6, y); c.lineTo(x - s * .35, y - s * .35); c.fill();
      });
    },
    plane(c) {
      if (holding('plane') || planeAway) return;
      const { x, y, dir } = plane;
      c.save(); c.translate(x, y); c.scale(dir, 1);
      c.fillStyle = 'rgba(0,0,0,.78)';
      c.beginPath(); c.moveTo(4.5, 0); c.lineTo(-4, -2.6); c.lineTo(-2.2, 0); c.lineTo(-4, 2); c.fill();
      clear(c, -2, -.25, 5.5, .5);
      c.restore();
    },
  };

  function paintWorld(c, t) {
    // Hills and a dotted ground that thins toward the bottom.
    c.fillStyle = 'rgba(0,0,0,.07)'; c.beginPath(); c.ellipse(-12, 2, 58, 13, 0, Math.PI, 0); c.fill();
    c.fillStyle = 'rgba(0,0,0,.05)'; c.beginPath(); c.ellipse(40, 2, 40, 9, 0, Math.PI, 0); c.fill();
    const gr = c.createLinearGradient(0, 0, 0, 14);
    gr.addColorStop(0, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(-70, 0, 140, 14);
    rect(c, -80, 0, 160, .7, .55);
    for (let i = 0; i < 18; i++) { const x = -60 + i * 7.3 + (i % 3) * 1.7; rect(c, x, -1.2, .6, 1.2, .5); rect(c, x + 1, -1.8, .6, 1.8, .5); }
    // Clouds drift; the plane loops and leaves a dashed trail.
    for (const [cx0, cy, k] of [[-30, -52, .006], [20, -44, .004], [60, -58, .005]]) {
      const x = ((cx0 + t * k * .1 + 45) % 115) - 45;
      c.fillStyle = 'rgba(0,0,0,.08)';
      c.beginPath(); c.ellipse(x, cy, 9, 2.4, 0, 0, 6.2832); c.ellipse(x + 5, cy - 1.6, 5, 2.4, 0, 0, 6.2832); c.fill();
    }
    if (!holding('plane') && !planeAway) for (let i = 1; i < 9; i++) {
      const p = planeAt(t - i * 140);
      if (i % 2) disc(c, p.x - p.dir * 2, p.y, .45, .4 - i * .035);
    }
  }

  function planeAt(t) {
    const s = t / 5200;
    return { x: 6 + Math.sin(s) * 44, y: -47 + Math.sin(s * 2) * 5, dir: Math.cos(s) >= 0 ? 1 : -1 };
  }

  function paintBird(c, now) {
    let row = 0, col = reduced ? 0 : idleFrame(now - lastPlay);
    if (routine) {
      const i = Math.floor((now - routineAt) / routine.ms);
      if (i >= routine.frames.length) { finish(routine, now); return paintBird(c, now); }
      row = routine.row; col = reduced ? 0 : routine.frames[i];
    }
    const bounds = spriteBounds[row]?.[col];
    const scale = spriteScale[row]?.[col] || 1;
    const size = BIRD * scale;
    const bodyCenterX = bounds?.bodyCenterX ?? CELL / 2;
    const bodyAnchorX = BIRD * (BODY_ANCHOR_X / CELL - .5);
    const x = bodyAnchorX - size * bodyCenterX / CELL;
    const y = -size * GROUND_ANCHOR_Y / CELL;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(bodyAnchorX, -.2, 12 * BIRD / 30, 1.4 * BIRD / 30, 0, 0, 6.2832); c.fill();
    if (sheet.complete && sheet.naturalWidth) {
      c.drawImage(sheet, col * CELL, row * CELL, CELL, CELL, x, y, size, size);
    }
  }

  // Atlas frames use different padding. Normalize each frame, then align the pigeon core and
  // foot line to fixed world anchors so props and empty margins cannot pull it around.
  function measureSpriteFrames() {
    if (!sheet.naturalWidth || !sheet.naturalHeight) return;
    const columns = Math.floor(sheet.naturalWidth / CELL);
    const rows = Math.floor(sheet.naturalHeight / CELL);
    const sample = document.createElement('canvas');
    sample.width = sample.height = CELL;
    const pixels = sample.getContext('2d', { willReadFrequently: true });
    const mask = new Uint8Array(CELL * CELL), stack = new Int32Array(CELL * CELL);
    let maxHeight = 0;
    spriteBounds = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, col) => {
      pixels.clearRect(0, 0, CELL, CELL);
      pixels.drawImage(sheet, col * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
      const rgba = pixels.getImageData(0, 0, CELL, CELL).data;
      let top = CELL, bottom = 0;
      for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
        if (rgba[(y * CELL + x) * 4 + 3] <= 128) continue;
        top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      }
      const height = bottom - top;
      maxHeight = Math.max(maxHeight, height);
      return { height, bodyCenterX: neutralBodyCenterX(rgba, mask, stack) };
    }));
    spriteScale = spriteBounds.map(row => row.map(frame => maxHeight / Math.max(1, frame.height)));
  }

  function neutralBodyCenterX(rgba, mask, stack) {
    mask.fill(0);
    for (let i = 0; i < mask.length; i++) {
      const offset = i * 4, red = rgba[offset], green = rgba[offset + 1], blue = rgba[offset + 2];
      const tone = (red + green + blue) / 3;
      if (rgba[offset + 3] > 100 && tone >= 75 && tone <= 220 && Math.max(red, green, blue) - Math.min(red, green, blue) < 28) mask[i] = 1;
    }

    let bestSize = 0, bestX = CELL / 2;
    for (let seed = 0; seed < mask.length; seed++) {
      if (!mask[seed]) continue;
      let size = 0, sumX = 0, stackSize = 0;
      stack[stackSize++] = seed; mask[seed] = 0;
      while (stackSize) {
        const index = stack[--stackSize], x = index % CELL, y = (index - x) / CELL;
        size++; sumX += x;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= CELL || ny < 0 || ny >= CELL) continue;
          const neighbor = ny * CELL + nx;
          if (mask[neighbor]) { mask[neighbor] = 0; stack[stackSize++] = neighbor; }
        }
      }
      if (size > bestSize) { bestSize = size; bestX = sumX / size; }
    }
    return bestX;
  }

  function finish(done, now) {
    if (done.name === 'plane') planeAway = now;
    routine = null; lastPlay = now;
    if (queue.length) play(queue.shift(), now);
  }

  // ---------- Printing ----------

  function frame(now) {
    const t = reduced ? 0 : now;
    // Pidgy finds something to do on his own when nobody's clicking.
    if (!routine && !reduced && now - lastPlay > 7000) play(AMBIENT[Math.floor(now / 7000) % AMBIENT.length], now);
    night = reduced ? Number(!!routine?.night) : night + ((routine?.night ? 1 : 0) - night) * .07;
    if (planeAway && now - planeAway > 2600) planeAway = 0;
    plane = planeAt(t);
    const planeBtn = buttons.get('plane');
    planeBtn.hidden = !!planeAway || holding('plane');
    if (!planeBtn.hidden) place(PROPS.at(-1), plane.x - 4.5, plane.y - 3.5);
    if (!reduced) {
      for (const s of steam) { s.y += .07; s.x = Math.sin(s.y * 1.3 + s.p) * .8; if (s.y > 9) { s.y = 0; s.p = Math.random() * 6; } }
      if (steam.length < 3) steam.push({ x: 0, y: steam.length * 3, p: Math.random() * 6 });
    }
    if (routine?.sparkle && !reduced && Math.random() < .35) sparks.push({ x: 8 + Math.random() * 4, y: -34, vx: (Math.random() - .3) * .5, vy: -.2 - Math.random() * .4, life: 1 });

    // Tone buffer: the world, then night, then Pidgy and particles on top.
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, cols, rows);
    g.setTransform(RES, 0, 0, RES, ax * RES, gy * RES);
    paintWorld(g, t);
    if (night > .02) {
      const gr = g.createRadialGradient(10, -36, 4, 10, -36, 78);
      gr.addColorStop(0, `rgba(0,0,0,${.62 * night})`); gr.addColorStop(.6, `rgba(0,0,0,${.3 * night})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(-90, -90, 180, 90);
    }
    for (const p of PROPS) if (p.id !== 'pidgy') painters[p.id](g, t, night);
    paintBird(g, now);
    for (const s of sparks) { s.x += s.vx; s.y += s.vy; s.vy += .012; s.life -= .02; disc(g, s.x, s.y, .7, s.life * .8); }
    while (sparks.length && sparks[0].life <= 0) sparks.shift();

    // Accent mask: whatever is hovered, or the prop Pidgy is busy with.
    const lit = hovered || (routine && (PROPS.find(p => (p.routine || p.id) === routine.name)?.id));
    a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, cols, rows);
    if (lit && lit !== 'pidgy' && painters[lit]) { a.setTransform(RES, 0, 0, RES, ax * RES, gy * RES); painters[lit](a, t, 0); }

    const d = g.getImageData(0, 0, cols, rows).data, m = a.getImageData(0, 0, cols, rows).data;
    out.setTransform(dpr, 0, 0, dpr, 0, 0); out.clearRect(0, 0, W, H);
    const live = ripples.filter(r => now - r.at < 1400);
    ripples.length = 0; ripples.push(...live);
    const inkPath = new Path2D(), copperPath = new Path2D();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      let v = (1 - d[i * 4] / 255) * fade[x];
      // Flashlight: dots swell a little near the cursor, like the home page.
      const px = (x + .5) * dot, py = (y + .5) * dot, dx = px - mouse.x, dy = py - mouse.y, dd = dx * dx + dy * dy;
      if (dd < 14400) v += (1 - Math.sqrt(dd) / 120) * (v > .02 ? .18 : .05);
      for (const r of live) {
        const age = (now - r.at) / 1400, dist = Math.hypot(x / RES - ax - r.x, y / RES - gy - r.y), ring = age * 46;
        if (Math.abs(dist - ring) < 2.2) v += .28 * (1 - age) * fade[x];
      }
      tone[i] += (v - tone[i]) * (reduced ? 1 : .55);
      const k = tone[i];
      if (k < .045) continue;
      const rad = Math.min(.62, .05 + Math.pow(k, .72) * .6) * dot, cx = px, cy = py;
      const path = m[i * 4 + 3] > 30 ? copperPath : inkPath;
      path.moveTo(cx + rad, cy); path.arc(cx, cy, rad, 0, 6.2832);
    }
    out.fillStyle = `rgb(${INK})`; out.fill(inkPath);
    out.fillStyle = `rgb(${COPPER})`; out.fill(copperPath);
  }

  let visible = true, last = 0;
  const loop = now => {
    if (visible && !document.hidden && now - last > 32) { last = now; frame(now); }
    requestAnimationFrame(loop);
  };

  stage.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const r = stage.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  stage.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);
  new ResizeObserver(layout).observe(stage);
  layout();
  sheet.decode().catch(() => {}).finally(() => {
    measureSpriteFrames();
    // Open with a wave, so the first thing a visitor sees is Pidgy saying hello.
    if (!reduced) play('wave');
    requestAnimationFrame(loop);
  });

  return {
    peck() { if (!routine || routine.name === 'draft') { routine = null; play('draft'); } },
    hop() { queue = []; routine = null; play('route'); },
    shake() { queue = []; routine = null; play('alert'); },
    deliver() {
      routine = null; play('parcel'); queue = ['stars', 'wave'];
      if (!reduced) ripples.push({ x: 0, y: -18, at: performance.now() });
    },
  };
}

// Mostly still, with the sheet's blink and glance frames sprinkled in.
function idleFrame(t) {
  const c = t % 3600;
  return c > 2100 && c < 2220 ? 2 : c > 2800 && c < 3100 ? 1 : c > 3300 ? 3 : 0;
}

function smooth(e0, e1, x) { const k = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); }
