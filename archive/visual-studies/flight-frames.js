// Atlas cells have hand-tuned source bounds and registration anchors.
// Cropping in the renderer preserves the original generated artwork.
export const flightFrames = [
  [70,95,320,369,210,366], [403,148,690,369,555,366],
  [746,85,1073,367,935,366], [1140,25,1425,369,1300,366],
  [12,458,402,713,243,710], [410,455,707,735,570,730],
  [778,454,1090,736,970,730], [1138,377,1430,737,1305,730],
  [9,803,422,1052,218,1045], [389,741,750,1056,600,1045],
  [773,811,1090,1058,970,1048], [1138,784,1411,1056,1290,1048],
];
export function paintFlightFrame(element, index) {
  const [left, top, right, bottom, anchorX, anchorY] = flightFrames[index];
  const size = element.clientWidth;
  const scale = size / 440;
  const x = size * .5 - anchorX * scale;
  const y = size * .93 - anchorY * scale;
  element.style.backgroundSize = `${1448 * scale}px ${1086 * scale}px`;
  element.style.backgroundPosition = `${x}px ${y}px`;
  const outline = index === 8 ? [[9,803],[380,803],[380,884],[422,884],[422,1052],[9,1052]]
    : index === 9 ? [[389,741],[750,741],[750,1056],[430,1056],[430,877],[389,877]] : null;
  if (outline) {
    element.style.clipPath = `polygon(${outline.map(([px,py]) => `${x + px * scale}px ${y + py * scale}px`).join(',')})`;
    return;
  }
  element.style.clipPath = `inset(${Math.max(0, y + top * scale)}px ${Math.max(0, size - x - right * scale)}px ${Math.max(0, size - y - bottom * scale)}px ${Math.max(0, x + left * scale)}px)`;
}
