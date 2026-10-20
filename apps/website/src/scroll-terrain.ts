import layout from './scroll-layout.json';
import type { GameId } from '@cfgcn/shared';

export { layout as scrollLayout };
export type Point = [number, number];
export const scrollIds: GameId[] = ['xiyou', 'sanguo', 'shuihu', 'honglou'];
export function smooth(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function sampleCurve(points: number[][], subdivisions = 12): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)],
      b = points[i];
    const c = points[i + 1],
      d = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < subdivisions; k++) {
      const t = k / subdivisions;
      result.push(
        [0, 1].map(
          (axis) =>
            0.5 *
            (2 * b[axis] +
              (-a[axis] + c[axis]) * t +
              (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t * t +
              (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * t * t * t),
        ) as Point,
      );
    }
  }
  result.push(points.at(-1)! as Point);
  return result;
}
export const scrollRivers = layout.rivers.map((r) => ({ ...r, samples: sampleCurve(r.points) }));
export const scrollRoads = layout.roads.map((r) => ({ ...r, samples: sampleCurve(r.points) }));
export function distanceToPath(x: number, z: number, points: Point[]) {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1],
      [bx, bz] = points[i];
    const dx = bx - ax,
      dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const px = x - ax - t * dx,
      pz = z - az - t * dz;
    distance = Math.min(distance, px * px + pz * pz);
  }
  return Math.sqrt(distance);
}
export function waterDistance(x: number, z: number) {
  let distance = Infinity;
  for (const r of scrollRivers)
    distance = Math.min(distance, distanceToPath(x, z, r.samples) - r.width);
  for (const l of layout.lakes) {
    const angle = Math.atan2((z - l.z) / l.rz, (x - l.x) / l.rx);
    const edge = 1 + 0.07 * Math.sin(angle * 5) + 0.035 * Math.cos(angle * 9);
    distance = Math.min(
      distance,
      (Math.hypot((x - l.x) / l.rx, (z - l.z) / l.rz) - edge) * Math.min(l.rx, l.rz),
    );
  }
  // Liangshan's promontory remains part of the continuous land, rather than a slab.
  const p = layout.places.shuihu;
  const angle = Math.atan2((z - p.z) / 9, (x - p.x) / 14);
  const island =
    Math.hypot((x - p.x) / 14, (z - p.z) / 9) /
    (1 + 0.07 * Math.sin(angle * 4) + 0.05 * Math.cos(angle * 7));
  if (island < 1.15) distance = Math.max(distance, (1.15 - island) * 8);
  for (const [wx, wz, rx, rz] of layout.wetlands) {
    const r = Math.hypot((x - wx) / rx, (z - wz) / rz);
    if (r < 1.6) distance = Math.max(distance, (1.2 - r) * 3.5);
  }
  return distance;
}
export const scrollRanges = layout.ranges.map((r) => {
  let along = 0;
  const curve = sampleCurve(r.points, 6);
  const samples = curve.map(([x, z], i) => {
    const at = Math.min(r.points.length - 2, Math.floor(i / 6)),
      t = i === (r.points.length - 1) * 6 ? 1 : (i % 6) / 6;
    const a = r.points[at],
      b = r.points[at + 1];
    if (i > 0) {
      const previous = curve[i - 1];
      along += Math.hypot(x - previous[0], z - previous[1]);
    }
    return [x, z, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t, along];
  });
  const radius = Math.max(...r.points.map((p) => p[3])) * 3.2;
  return {
    ...r,
    samples,
    minX: Math.min(...samples.map((p) => p[0])) - radius,
    maxX: Math.max(...samples.map((p) => p[0])) + radius,
    minZ: Math.min(...samples.map((p) => p[1])) - radius,
    maxZ: Math.max(...samples.map((p) => p[1])) + radius,
  };
});
// Each authored summit is a coherent massif with a few intersecting rock
// planes. The continuous talus underneath joins the valley terrain. There are
// no sine-wave channels or per-vertex noise displacements down its faces.
const massifs = layout.ranges.flatMap((range, rangeIndex) =>
  range.points.flatMap((p, i) => {
    if (
      p[2] < 14 ||
      p[2] < (range.points[i - 1]?.[2] ?? 0) ||
      p[2] < (range.points[i + 1]?.[2] ?? 0)
    )
      return [];
    const a = range.points[Math.max(0, i - 1)],
      b = range.points[Math.min(range.points.length - 1, i + 1)];
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]),
      seed = rangeIndex * 13 + i * 7;
    const ca = Math.cos(angle),
      sa = Math.sin(angle);
    return [
      [0, 0, 1, 1],
      [0.86, 0.42, 0.72, 0.72],
      [-0.74, 0.37, 0.68, 0.76],
    ].map(([u, v, high, size], k) => {
      const radius = p[3] * size * 1.55;
      const sides = Array.from({ length: 7 }, (_, j) => {
        const phi = angle + (j * Math.PI * 2) / 7;
        const slope = 1.35 + (1 + Math.sin(j * 2.3 + seed + k)) * 1.0;
        return [
          Math.cos(phi),
          Math.sin(phi),
          Math.max(
            radius * (0.86 + 0.13 * Math.sin(j * 3.1 + seed + k * 2.6)),
            ((p[2] * high) / slope) * 1.1,
          ),
          slope,
        ];
      });
      return {
        x: p[0] + p[3] * (ca * u - sa * v),
        z: p[1] + p[3] * (sa * u + ca * v),
        height: p[2] * high,
        radius,
        bound: Math.max(...sides.map((s) => s[2])) * 1.25,
        sides,
        ca: Math.cos(angle + 0.3 * k),
        sa: Math.sin(angle + 0.3 * k),
        seed,
      };
    });
  }),
);
export function mountainHeight(x: number, z: number) {
  let talus = 0,
    rock = 0;
  // Low aprons connect the authored ridges, including the saddles between
  // exposed crags. Their height cannot turn the whole chain into a high wall.
  for (const range of scrollRanges) {
    if (x < range.minX || x > range.maxX || z < range.minZ || z > range.maxZ) continue;
    for (let i = 1; i < range.points.length; i++) {
      const a = range.points[i - 1],
        b = range.points[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
      );
      const u = x - a[0] - dx * t,
        v = z - a[1] - dz * t,
        width = a[3] + (b[3] - a[3]) * t;
      talus = Math.max(
        talus,
        (a[2] + (b[2] - a[2]) * t) * 0.16 * Math.exp((-(u * u + v * v) / (width * width)) * 0.65),
      );
    }
  }
  for (const m of massifs) {
    const dx = x - m.x,
      dz = z - m.z,
      r2 = (dx * dx + dz * dz) / (m.radius * m.radius);
    if (r2 > 13) continue;
    talus = Math.max(talus, m.height * 0.19 * Math.exp(-r2 * 0.88));
    if (r2 * m.radius * m.radius > m.bound * m.bound) continue;
    let wall = Infinity;
    for (const [nx, nz, radius, slope] of m.sides) {
      // A bevel at the base meets the apron. Large planar faces remain steep,
      // instead of becoming rounded lobes smoothed by noise.
      wall = Math.min(wall, (radius - dx * nx - dz * nz) * slope);
    }
    const u = dx * m.ca + dz * m.sa,
      v = -dx * m.sa + dz * m.ca;
    const crown = m.height * (1 - (0.24 * (u * u + v * v * 1.15)) / (m.radius * m.radius));
    rock = Math.max(rock, Math.min(wall, crown));
  }
  let height = Math.max(talus, rock);
  for (const p of layout.passes) {
    const d = Math.hypot(x - p.x, z - p.z) / p.radius;
    height = p.floor + (height - p.floor) * smooth(0.1, 1.65, d);
  }
  return Math.max(0, height);
}
export function cultivationWeight(x: number, z: number) {
  let cover = 0;
  for (const area of layout.cultivation) {
    const c = Math.cos(area.angle),
      s = Math.sin(area.angle),
      dx = x - area.x,
      dz = z - area.z;
    const u = (dx * c + dz * s) / area.rx,
      v = (-dx * s + dz * c) / area.rz;
    const angle = Math.atan2(v, u),
      edge = 1 + 0.11 * Math.sin(angle * 3) + 0.06 * Math.cos(angle * 7);
    // These are agricultural influences, not silhouettes to cut out of the land.
    // Parcel boundaries are clipped against the actual foothills and wet banks.
    cover = Math.max(cover, 1 - smooth(0.55, 1.65, Math.hypot(u, v) / edge));
  }
  return cover;
}
export function lowlandHeight(x: number, z: number, water: number) {
  let height =
    0.55 +
    0.35 * Math.sin(x * 0.021 + z * 0.013) * Math.cos(z * 0.027) +
    0.25 * Math.sin(x * 0.047 - z * 0.032);
  let folds = 0;
  for (const [cx, cz, high, rx, rz, angle] of layout.terraces) {
    const dx = x - cx,
      dz = z - cz,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const u = (dx * c + dz * s) / rx,
      v = (-dx * s + dz * c) / rz;
    const radius = u * u + v * v;
    if (radius < 1) folds = Math.max(folds, high * Math.pow(1 - radius, 2));
  }
  height += folds * smooth(3, 17, water);
  return Math.max(0.35, height);
}
export function terrainHeight(x: number, z: number) {
  const river = waterDistance(x, z);
  const peak = mountainHeight(x, z);
  let height = lowlandHeight(x, z, river) + peak * 1.12;
  for (const id of scrollIds) {
    const p = layout.places[id];
    const d = Math.max(Math.abs(x - p.x) / (p.width * 0.53), Math.abs(z - p.z) / (p.depth * 0.53));
    height = 0.65 + (height - 0.65) * smooth(1, 1.9, d);
  }
  const bank = 1.6 + Math.min(2.8, peak * 0.12);
  return -0.65 + (height + 0.65) * smooth(0, bank, river);
}

export function townDistance(x: number, z: number) {
  return Math.min(
    ...scrollIds.map((id) => {
      const p = layout.places[id];
      return Math.max(Math.abs(x - p.x) - p.width * 0.58, Math.abs(z - p.z) - p.depth * 0.58);
    }),
  );
}
