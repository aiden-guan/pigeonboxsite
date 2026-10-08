// Continuous geometry shared by the live orbit and its full-cycle regression check.
export function layoutFeatureOrbit(width, height, sizes, time) {
  if (!(width > 0 && height > 0 && Number.isFinite(width + height)) || !sizes.length || sizes.some(size => !(size.w > 0 && size.h > 0))) return [];
  const narrow = width < 950;
  const compact = narrow && height < 410;
  const rx = Math.max(40, (width - Math.max(narrow ? 100 : 170, ...sizes.map(size => size.w)) - 8) / 2);
  const ry = Math.max(80, (height - (narrow ? 40 : 64)) / 2);
  const cx = width / 2, cy = height / 2;
  const positions = sizes.map((size, i) => {
    const inner = !narrow && i < 6;
    const count = narrow ? sizes.length : inner ? 6 : sizes.length - 6;
    const index = narrow || inner ? i : i - 6;
    const angle = index / count * Math.PI * 2 - Math.PI / 2 + time * (inner ? -.035 : .022);
    if (narrow) {
      // A periodic cubic path rounds the two poles without a velocity cusp.
      const phase = (i + time * .06) % sizes.length;
      const segment = Math.floor(phase), t = phase - segment;
      const anchor = index => {
        const slot = (index + sizes.length) % sizes.length;
        const halfway = sizes.length / 2;
        const vertical = -1 + 2 * Math.min(slot, sizes.length - slot) / halfway;
        return {
          x: cx + (slot < halfway ? 1 : -1) * rx * Math.sqrt(Math.max(0, 1 - vertical ** 2)),
          y: cy + vertical * (height - (compact ? 44 : 60)) / 2,
        };
      };
      const points = [-1, 0, 1, 2].map(offset => anchor(segment + offset));
      const interpolate = axis => {
        const [a, b, c, d] = points.map(point => point[axis]);
        return .5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
      };
      return { x: interpolate('x'), y: interpolate('y'), ...sizes[i] };
    }
    const radiusX = inner ? rx * .58 : rx;
    const radiusY = inner ? height * .24 : ry;
    return { x: cx + Math.cos(angle) * radiusX, y: cy + Math.sin(angle) * radiusY, ...sizes[i] };
  });
  // Wide layouts have two separated lanes. The single narrow lane uses
  // continuous radial separation to keep names readable around its poles.
  for (let pass = 0; pass < (narrow ? 16 : 0); pass++) {
    for (let i = 0; i < positions.length; i++) {
      const a = positions[i];
      for (let j = i + 1; j < positions.length; j++) {
        const b = positions[j];
        const overlapX = (a.w + b.w) / 2 + 8 - Math.abs(a.x - b.x);
        const overlapY = (a.h + b.h) / 2 + (compact ? 3 : 7) - Math.abs(a.y - b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;
        // Separate along the existing relative direction. Choosing a fresh
        // horizontal/vertical axis here made labels snap when that choice flipped.
        const fromX = a.x - b.x, fromY = a.y - b.y;
        const scale = Math.min(((a.w + b.w) / 2 + 8) / Math.max(.001, Math.abs(fromX)), ((a.h + b.h) / 2 + (compact ? 3 : 7)) / Math.max(.001, Math.abs(fromY)));
        const pushX = fromX * (scale - 1) * .51;
        const pushY = fromY * (scale - 1) * .51;
        a.x += pushX; b.x -= pushX;
        a.y += pushY; b.y -= pushY;
      }
      a.x = Math.max(a.w / 2 + 4, Math.min(width - a.w / 2 - 4, a.x));
      a.y = Math.max(a.h / 2 + 4, Math.min(height - a.h / 2 - 4, a.y));
    }
  }
  return positions;
}
