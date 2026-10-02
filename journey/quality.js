export function initialQuality(mobile, cores = navigator.hardwareConcurrency || 8) {
  const name = mobile ? 'low' : cores <= 4 ? 'medium' : 'high';
  const presets = {
    high: { dpr: 1.75, shadow: 2048, animationRange: 360, foliageDensity: 1 },
    medium: { dpr: 1.4, shadow: 1024, animationRange: 280, foliageDensity: .75 },
    low: { dpr: 1.25, shadow: 1024, animationRange: 220, foliageDensity: .5 },
  };
  return { name, ...presets[name] };
}
