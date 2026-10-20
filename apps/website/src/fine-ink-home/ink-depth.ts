export type DepthKind = 'far' | 'mountain' | 'city' | 'bank' | 'facade' | 'bridge';
export type DepthLayer = {
  id: string;
  kind: DepthKind;
  town?: string;
  amplitude: number;
  bounds: [number, number, number, number];
  image: string;
};
export const inkDepthSize = { width: 2400, height: 1501, distance: 2600 };
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export function inkGroundDepth(y: number): number {
  return -1500 + 1900 * Math.pow(clamp01(y / inkDepthSize.height), 0.72);
}
export function inkLayerDepth(layer: DepthLayer, x: number, y: number): number {
  const [left, top, width, height] = layer.bounds;
  const u = clamp01((x - left) / width),
    v = clamp01((y - top) / height);
  const ground = inkGroundDepth(y);
  if (layer.kind === 'far') return ground + layer.amplitude * (0.88 + 0.12 * Math.sin(u * Math.PI));
  if (layer.kind === 'bridge')
    return inkGroundDepth(top + height) + layer.amplitude * Math.pow(1 - v, 0.65);
  if (layer.kind === 'city' || layer.kind === 'facade') {
    // A wall and its roofs use the same continuous surface, including their seams.
    const town = inkTownSurfaces[layer.town ?? ''];
    if (town) {
      const t = clamp01((y - town.top) / town.height);
      return ground + 12 + town.heightScale * Math.pow(1 - t, 0.8);
    }
    return ground + layer.amplitude * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
  }
  if (layer.kind === 'mountain') {
    // All connected range cutouts sample one relief field. A camera cannot tear
    // adjacent masks apart simply because their source rectangles differ.
    const sx = (x * 1586) / 2400,
      sy = (y * 992) / 1501;
    let rise = 0;
    for (const [cx, cy, rx, ry, amplitude] of inkMountainPeaks) {
      rise += amplitude * Math.exp(-Math.pow((sx - cx) / rx, 2) - Math.pow((sy - cy) / ry, 2));
    }
    return ground + rise;
  }
  const shoulder = 0.78 + 0.22 * Math.sin(u * Math.PI * 3);
  return ground + layer.amplitude * Math.pow(1 - v, 0.8) * shoulder;
}
const inkMountainPeaks = [
  [45, 170, 135, 160, 280],
  [155, 335, 140, 165, 270],
  [370, 470, 170, 110, 290],
  [640, 550, 175, 125, 320],
  [80, 625, 125, 160, 230],
  [230, 920, 240, 110, 220],
  [690, 940, 240, 115, 260],
];
const inkTownSurfaces: Record<string, { top: number; height: number; heightScale: number }> = {
  xiyou: { top: (219 * 2400) / 1586, height: (228 * 2400) / 1586, heightScale: 65 },
  sanguo: { top: (603 * 2400) / 1586, height: (150 * 2400) / 1586, heightScale: 48 },
  shuihu: { top: (244 * 2400) / 1586, height: (135 * 2400) / 1586, heightScale: 55 },
  honglou: { top: (594 * 2400) / 1586, height: (294 * 2400) / 1586, heightScale: 70 },
};
export function inkImagePoint(x: number, y: number, depth: number): [number, number, number] {
  const k = (inkDepthSize.distance - depth) / inkDepthSize.distance;
  return [(x - inkDepthSize.width / 2) * k, (inkDepthSize.height / 2 - y) * k, depth];
}
export function inkReferenceProjection(point: [number, number, number]): [number, number] {
  const k = inkDepthSize.distance / (inkDepthSize.distance - point[2]);
  return [point[0] * k + inkDepthSize.width / 2, inkDepthSize.height / 2 - point[1] * k];
}
