// The walkthrough arrives under a sheet of paper that splits itself into a
// quadtree, then lifts away tile by tile, smallest first near the top-left.

const reduce = matchMedia('(prefers-reduced-motion: reduce)');

export function mountQuadReveal(viewport) {
  if (reduce.matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'quad-cover';
  canvas.setAttribute('aria-hidden', 'true');
  viewport.append(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, leaves = [], splits = [], start = 0, frame = 0;

  function build() {
    const r = viewport.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    leaves = []; splits = [];
    const odds = [1, 1, 0.82, 0.6, 0.42, 0.25];
    const grow = (x, y, w, h, d) => {
      if (d < odds.length && Math.random() < odds[d] && w > 24) {
        splits.push({ x, y, w, h, d });
        grow(x, y, w / 2, h / 2, d + 1); grow(x + w / 2, y, w / 2, h / 2, d + 1);
        grow(x, y + h / 2, w / 2, h / 2, d + 1); grow(x + w / 2, y + h / 2, w / 2, h / 2, d + 1);
      } else {
        const sweep = ((x + w / 2) / W + (y + h / 2) / H) / 2;
        leaves.push({ x, y, w, h, d, at: 0.95 + sweep * 0.7 + Math.random() * 0.35 - d * 0.04 });
      }
    };
    grow(0, 0, W, H, 0);
  }

  function draw(now) {
    frame = 0;
    const t = start ? (now - start) / 1000 : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.font = '500 9px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    let left = 0;
    for (const leaf of leaves) {
      const k = Math.min(1, Math.max(0, (t - leaf.at) / 0.28));
      if (k >= 1) continue;
      left++;
      const s = 1 - k * k;
      const w = leaf.w * s, h = leaf.h * s;
      const x = leaf.x + (leaf.w - w) / 2, y = leaf.y + (leaf.h - h) / 2;
      ctx.fillStyle = leaf.d % 2 ? '#ebe7dd' : '#e2ddd1';
      ctx.fillRect(x, y, w, h);
      if (t >= 0.95) {
        ctx.strokeStyle = '#18191b';
        ctx.lineWidth = 1 / dpr;
        ctx.strokeRect(x + 0.5 / dpr, y + 0.5 / dpr, w - 1 / dpr, h - 1 / dpr);
      }
      if (k === 0 && leaf.w > 60 && t > 0.5) {
        ctx.fillStyle = '#7a7e85';
        ctx.fillText(`${Math.round(leaf.x)},${Math.round(leaf.y)}`, leaf.x + 6, leaf.y + 6);
      }
    }
    // Split lines draw in, one depth at a time, before anything lifts.
    ctx.strokeStyle = '#18191b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const node of splits) {
      const k = Math.min(1, Math.max(0, (t - node.d * 0.13) / 0.2));
      if (!k) continue;
      const mx = node.x + node.w / 2, my = node.y + node.h / 2;
      ctx.moveTo(mx, my - (node.h / 2) * k); ctx.lineTo(mx, my + (node.h / 2) * k);
      ctx.moveTo(mx - (node.w / 2) * k, my); ctx.lineTo(mx + (node.w / 2) * k, my);
    }
    if (t < 0.95) ctx.stroke();
    if (start && left) frame = requestAnimationFrame(draw);
    else if (start) canvas.remove();
  }

  build();
  draw(performance.now());
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    start = performance.now();
    frame = requestAnimationFrame(draw);
  }, { threshold: 0.45 });
  io.observe(viewport);
  new ResizeObserver(() => { if (!start && canvas.isConnected) { build(); draw(performance.now()); } }).observe(viewport);
}
