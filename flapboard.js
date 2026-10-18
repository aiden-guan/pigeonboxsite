// Triage as a split-flap departures board. New mail arrives, the board re-sorts
// by lane, and every changed character flaps through a few letters to land.

const POOL = [
  ['respond', 'Maya Chen', 'Can you confirm Friday?', '2h'],
  ['fyi', 'GitHub', 'CI passed on main', '3m'],
  ['waiting', 'Fieldwork', 'Revised quote, sent Tue', '2d'],
  ['follow', 'Priya Raman', 'Contract draft, no reply', '6d'],
  ['fyi', 'Figma', 'Weekly digest', '1h'],
  ['respond', 'Jonas Weber', 'Quick question on invoice', '40m'],
  ['fyi', 'Stripe', 'Payout on the way', '6h'],
  ['waiting', 'Legal', 'NDA out for countersign', '1d'],
  ['fyi', 'Linear', 'PB-412 moved to Done', '12m'],
  ['respond', 'Dana Kim', 'Need your sign-off by 5pm', '5m'],
  ['follow', 'Leo Park', 'Did the deck land?', '4d'],
  ['fyi', 'Notion', '3 pages updated', '2h'],
  ['waiting', 'Recruiting', 'Interview slots', '3d'],
  ['fyi', 'Calendar', 'Standup moved to 10:00', '1h'],
];
const RANK = { respond: 0, follow: 1, waiting: 2, fyi: 3 };
const LANE = { respond: 'RESPOND', follow: 'FOLLOW-UP', waiting: 'WAITING', fyi: 'FYI' };
const COLOR = { respond: '#e07a52', follow: '#e0ad55', waiting: '#a9b6c4', fyi: '#7c838c' };
const TEXT = '#ebe7de';
const DIM = '#8a9098';
const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:?-&/';
const ROWS = 7;
const FLIP = 64; // ms per flap

const WIDE = [['lane', 9, 'Lane'], ['who', 13, 'From'], ['sub', 26, 'Subject'], ['age', 4, 'Age']];
const NARROW = [['lane', 9, 'Lane'], ['who', 12, 'From'], ['age', 3, 'Age']];

export function mountFlapboard(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let cols = WIDE, total = 0, cw = 0, ch = 0, head = 26, W = 0, H = 0, dpr = 1;
  let cells = [];
  let gaps = new Set();
  let board = [];
  let next = 0;
  let frame = 0, visible = false, timer = 0;

  const clean = (s) => s.toUpperCase().split('').map((c) => (CHARS.includes(c) ? c : ' ')).join('');

  function layout() {
    const r = canvas.getBoundingClientRect();
    W = r.width;
    cols = W < 640 ? NARROW : WIDE;
    total = cols.reduce((sum, c) => sum + c[1], 0) + cols.length - 1;
    gaps = new Set();
    let at = 0;
    cols.forEach(([, width], k) => { at += width; if (k < cols.length - 1) gaps.add(at++); });
    cw = Math.floor(W / total);
    ch = Math.round(cw * 1.5);
    head = Math.max(20, Math.round(cw * 1.2));
    H = head + ROWS * (ch + 4);
    canvas.style.height = `${H}px`;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // Keep characters already showing; only the grid shape changes.
    cells = Array.from({ length: ROWS }, (_, r) => Array.from({ length: total }, (_, c) => cells[r]?.[c] || { cur: ' ', color: TEXT, queue: [], start: 0 }));
  }

  function rowText(mail) {
    let s = '';
    const colors = [];
    cols.forEach(([key, width], k) => {
      const value = key === 'lane' ? LANE[mail[0]] : key === 'who' ? mail[1] : key === 'sub' ? mail[2] : mail[3];
      const text = clean(value).slice(0, width).padEnd(width, ' ');
      const color = key === 'lane' ? COLOR[mail[0]] : mail[0] === 'fyi' ? DIM : TEXT;
      s += text; for (let i = 0; i < width; i++) colors.push(color);
      if (k < cols.length - 1) { s += ' '; colors.push(TEXT); }
    });
    return { s, colors };
  }

  function retarget(instant) {
    const now = performance.now();
    board.forEach((mail, r) => {
      const { s, colors } = rowText(mail);
      for (let c = 0; c < total; c++) {
        const cell = cells[r][c];
        const want = s[c];
        const [lastChar, lastColor] = cell.queue.length ? cell.queue[cell.queue.length - 1] : [cell.cur, cell.color];
        if (want === lastChar && colors[c] === lastColor) continue;
        if (instant) { cell.cur = want; cell.color = colors[c]; cell.queue = []; continue; }
        // A couple of letters riffle past, then the flap always lands on the target.
        const q = [];
        const hops = 1 + Math.floor(Math.random() * 2);
        for (let h = 0; h < hops; h++) q.push([CHARS[1 + Math.floor(Math.random() * 26)], colors[c]]);
        q.push([want, colors[c]]);
        if (!cell.queue.length) cell.start = now + r * 45 + c * 6;
        cell.queue = q;
      }
    });
  }

  function sort() {
    board.sort((a, b) => RANK[a[0]] - RANK[b[0]] || a.order - b.order);
  }

  function arrive(instant = false) {
    const mail = [...POOL[next % POOL.length]];
    mail.order = -next; // newest first within a lane
    next++;
    board.push(mail);
    sort();
    if (board.length > ROWS) board.splice(ROWS);
    retarget(instant);
    schedule();
  }

  function glyph(char, x, y, color) {
    if (char === ' ') return;
    ctx.fillStyle = color;
    ctx.fillText(char, x + cw / 2, y + ch / 2 + 1);
  }

  function drawCell(cell, x, y, now) {
    const bw = cw - 2, bh = ch;
    const mid = y + bh / 2;
    // Advance through every flap that has finished; whatever is left is mid-flip.
    let p = 0;
    if (cell.queue.length && now >= cell.start) {
      p = (now - cell.start) / FLIP;
      if (p > cell.queue.length + 2) p = cell.queue.length; // tab was hidden: just land
      while (p >= 1 && cell.queue.length) {
        [cell.cur, cell.color] = cell.queue.shift();
        cell.start += FLIP;
        p -= 1;
      }
      if (!cell.queue.length) cell.start = now;
    }
    const flipping = cell.queue.length > 0 && now >= cell.start;
    if (!flipping) {
      // At rest the letter is drawn whole over a faint seam, so crossbars stay legible.
      ctx.fillStyle = '#24272b'; ctx.fillRect(x, y, bw, bh / 2);
      ctx.fillStyle = '#202326'; ctx.fillRect(x, mid, bw, bh / 2);
      ctx.fillStyle = '#17191b'; ctx.fillRect(x, mid - 0.5, bw, 1);
      glyph(cell.cur, x, y, cell.color);
      return cell.queue.length > 0;
    }
    const [nextChar, nextColor] = cell.queue[0];
    // Top half: the next character waits behind the falling flap.
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, bw, bh / 2); ctx.clip();
    ctx.fillStyle = '#24272b'; ctx.fillRect(x, y, bw, bh);
    glyph(nextChar, x, y, nextColor);
    ctx.restore();
    // Bottom half: the current character until the flap lands.
    ctx.save();
    ctx.beginPath(); ctx.rect(x, mid, bw, bh / 2); ctx.clip();
    ctx.fillStyle = '#202326'; ctx.fillRect(x, y, bw, bh);
    glyph(cell.cur, x, y, cell.color);
    ctx.restore();
    {
      const top = p < 0.5;
      const s = top ? 1 - p * 2 : p * 2 - 1;
      ctx.save();
      ctx.beginPath();
      if (top) ctx.rect(x, y, bw, bh / 2); else ctx.rect(x, mid, bw, bh / 2);
      ctx.clip();
      ctx.translate(0, mid); ctx.scale(1, Math.max(0.001, s)); ctx.translate(0, -mid);
      ctx.fillStyle = top ? '#2c3035' : '#272a2e';
      ctx.fillRect(x, y, bw, bh);
      glyph(top ? cell.cur : nextChar, x, y, top ? cell.color : nextColor);
      ctx.restore();
    }
    ctx.fillStyle = '#111214';
    ctx.fillRect(x, mid - 0.5, bw, 1);
    return cell.queue.length > 0;
  }

  function render(now = performance.now()) {
    frame = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#111214';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${Math.max(9, Math.round(cw * 0.55))}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.fillStyle = '#6f767f';
    let cx = 0;
    cols.forEach(([, width, title]) => { ctx.fillText(title.toUpperCase(), cx * cw, head / 2 - 2); cx += width + 1; });
    ctx.textAlign = 'center';
    ctx.font = `500 ${Math.round(ch * 0.62)}px "IBM Plex Mono", ui-monospace, monospace`;
    let busy = false;
    for (let r = 0; r < ROWS; r++) {
      const y = head + r * (ch + 4);
      for (let c = 0; c < total; c++) {
        // Column gaps stay dark: the board shows its frame between fields.
        if (gaps.has(c)) continue;
        if (drawCell(cells[r][c], c * cw, y, now)) busy = true;
      }
    }
    if (busy) schedule();
  }
  function schedule() { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render); }

  function cycle() {
    clearTimeout(timer);
    if (!visible || reduce.matches || document.hidden) return;
    timer = setTimeout(() => { arrive(); cycle(); }, 3600);
  }

  layout();
  for (let i = 0; i < ROWS; i++) arrive(true);
  new ResizeObserver(() => { const w = canvas.getBoundingClientRect().width; if (Math.abs(w - W) > 1) { layout(); retarget(true); render(); } }).observe(canvas);
  new IntersectionObserver(([e]) => {
    const was = visible;
    visible = e.isIntersecting;
    if (visible && !was) { render(); cycle(); }
  }, { threshold: 0.2 }).observe(canvas);
  document.addEventListener('visibilitychange', () => { cycle(); schedule(); });
  reduce.addEventListener('change', cycle);
  const fonts = document.fonts?.load ? document.fonts.load('500 16px "IBM Plex Mono"').catch(() => undefined) : Promise.resolve();
  fonts.then(() => render());
}
