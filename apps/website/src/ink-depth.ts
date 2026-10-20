import relief from './ink-ridge-layout.json';

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
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const angle = (relief.reference.downAngle * Math.PI) / 180;
const up = { y: Math.cos(angle), z: Math.sin(angle) };

// Reconstruct an oblique ground plane in the painting's reference camera. Height
// is world-up, not a bulge towards the lens. Water at height zero is coplanar even
// when it appears at different rows of the painting.
export function inkHeightDepth(y: number, height: number): number {
  const q = inkDepthSize.height / 2 - y;
  return (height - q * up.y) / (up.z - (q * up.y) / inkDepthSize.distance);
}
export function inkWorldElevation(point: [number, number, number]): number {
  return point[1] * up.y + point[2] * up.z;
}
export function inkWaterDepth(y: number): number {
  return inkHeightDepth(y, 0);
}

function nearestSegment(x: number, y: number, a: number[], b: number[]) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = clamp01(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy));
  return { t, distance: Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) };
}

export function inkTerrainHeight(x: number, y: number): number {
  const sx = (x * relief.reference.width) / inkDepthSize.width,
    sy = (y * relief.reference.height) / inkDepthSize.height;
  // Low terraces carry fields into the slope feet. They are shared by the ground
  // and every rock cutout, so terrain never stops at the rectangular layer edges.
  const plain =
    16 +
    10 * (0.5 + 0.5 * Math.sin(sx / 139 + sy / 207)) +
    8 * (0.5 + 0.5 * Math.sin(sx / 77 - sy / 153));
  let rise = 0;
  for (const { nodes } of relief.ridges) {
    let ridge = 0;
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1],
        b = nodes[i];
      const { t, distance } = nearestSegment(sx, sy, a, b);
      const width = a[3] + (b[3] - a[3]) * t;
      const u = Math.min(1, distance / width);
      const along = smooth(0, 1, t);
      const crest = a[2] + (b[2] - a[2]) * along;
      // A narrow crest, secondary shoulder and soft foot, rather than a round
      // Gaussian mound. Small folds follow the flank and die out at the foot.
      const profile = Math.pow(1 - u, 1.5) * (0.76 + 0.24 * Math.cos(u * Math.PI));
      const fold = 1 + 0.065 * Math.sin(sx * 0.12 + sy * 0.17) * Math.sin(u * Math.PI);
      ridge = Math.max(ridge, crest * profile * fold);
    }
    // Smooth only the junction, without adding heights into an artificial wall.
    const blend = Math.max(22 - Math.abs(rise - ridge), 0) / 22;
    rise = Math.max(rise, ridge) + blend * blend * 5.5;
  }
  for (const pass of relief.passes) {
    let distance = Infinity;
    for (let i = 1; i < pass.nodes.length; i++)
      distance = Math.min(
        distance,
        nearestSegment(sx, sy, pass.nodes[i - 1], pass.nodes[i]).distance,
      );
    rise *= 1 - pass.cut * (1 - smooth(0, pass.width, distance));
  }
  for (const basin of relief.basins) {
    const r = Math.hypot(
      (sx - basin.center[0]) / basin.radius[0],
      (sy - basin.center[1]) / basin.radius[1],
    );
    rise *= smooth(0.58, 1.12, r);
  }
  return plain + rise * 0.65;
}
export function inkGroundDepth(y: number, x = 1200): number {
  return inkHeightDepth(y, inkTerrainHeight(x, y));
}
// All static meshes share this grid. Build the geological field once, rather
// than solving every ridge again for each overlapping mask and each return home.
export function createInkTerrainField() {
  const step = 12,
    left = -216,
    top = -180,
    width = 237,
    height = 156;
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      values[y * width + x] = inkTerrainHeight(left + x * step, top + y * step);
  return {
    height(x: number, y: number) {
      const gx = Math.max(0, Math.min(width - 1, (x - left) / step)),
        gy = Math.max(0, Math.min(height - 1, (y - top) / step)),
        ix = Math.floor(gx),
        iy = Math.floor(gy),
        jx = Math.min(width - 1, ix + 1),
        jy = Math.min(height - 1, iy + 1),
        tx = gx - ix,
        ty = gy - iy;
      const a = values[iy * width + ix] * (1 - tx) + values[iy * width + jx] * tx,
        b = values[jy * width + ix] * (1 - tx) + values[jy * width + jx] * tx;
      return a * (1 - ty) + b * ty;
    },
  };
}
export function inkLayerDepth(
  layer: DepthLayer,
  x: number,
  y: number,
  ground = inkTerrainHeight(x, y),
): number {
  const [left, top, width, height] = layer.bounds;
  const u = clamp01((x - left) / width),
    v = clamp01((y - top) / height);
  if (layer.kind === 'far')
    return inkHeightDepth(y, 60 + layer.amplitude * (0.72 + 0.28 * Math.sin(u * Math.PI)));
  if (layer.kind === 'bridge')
    return inkHeightDepth(y, 28 + layer.amplitude * Math.sin(Math.PI * v) * 0.42);
  if (layer.kind === 'city' || layer.kind === 'facade') {
    // A wall and its roofs use the same continuous surface, including their seams.
    const town = inkTownSurfaces[layer.town ?? ''];
    if (town) {
      const t = clamp01((y - town.top) / town.height);
      return inkHeightDepth(y, ground + 10 + town.heightScale * Math.pow(1 - t, 0.8));
    }
    return inkHeightDepth(
      y,
      ground + layer.amplitude * Math.sin(Math.PI * u) * Math.sin(Math.PI * v),
    );
  }
  if (layer.kind === 'mountain') {
    // All connected range cutouts sample one relief field. A camera cannot tear
    // adjacent masks apart simply because their source rectangles differ.
    return inkHeightDepth(y, ground);
  }
  const shoulder = 0.78 + 0.22 * Math.sin(u * Math.PI * 3);
  return inkHeightDepth(y, ground + layer.amplitude * Math.pow(1 - v, 0.8) * shoulder * 0.45);
}
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
