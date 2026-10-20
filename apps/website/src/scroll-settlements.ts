import type { GameId } from '@cfgcn/shared';
import {
  scrollLayout as layout,
  waterDistance,
  mountainHeight,
  townDistance,
  terrainHeight,
  scrollRoads,
} from './scroll-terrain';

export type Architecture = 'house' | 'shop' | 'hall' | 'gallery' | 'pavilion' | 'barn';
export type RoofForm = 'hip' | 'gable' | 'studio' | 'pavilion';
export type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  angle: number;
  kind: Architecture;
  roof: RoofForm;
  finish: 'plaster' | 'earth' | 'timber' | 'red';
  royal: boolean;
  base?: number;
  tier?: boolean;
  site?: string;
};
export type Lane = { points: number[][]; width: number; paved?: boolean; site?: string };
export type Court = {
  x: number;
  z: number;
  w: number;
  d: number;
  garden?: boolean;
  angle?: number;
  site?: string;
};
export type GardenTree = { x: number; z: number; scale: number; type: number };

/** Authored urban blocks, yards and waterside lanes. Shared by surface painting and 3D. */
export function settlementPlan() {
  type Located<T> = T & { origin?: GameId };
  const buildings: Located<Building>[] = [],
    lanes: Located<Lane>[] = [],
    courts: Located<Court>[] = [],
    trees: Located<GardenTree>[] = [];
  const origins = {
    xiyou: { ...layout.places.xiyou, x: -36, z: -14 },
    sanguo: { ...layout.places.sanguo, x: -68, z: 37 },
    shuihu: { ...layout.places.shuihu, x: 61, z: -35 },
    honglou: { ...layout.places.honglou, x: 91, z: 48 },
  };
  let area: GameId | undefined = 'xiyou';
  const plantTownTree = (p: GardenTree) => trees.push({ ...p, origin: area });
  const move = <T extends { x: number; z: number; origin?: GameId }>(p: T): T => {
    if (!p.origin) return p;
    const to = layout.places[p.origin],
      from = origins[p.origin];
    return { ...p, x: p.x + to.x - from.x, z: p.z + to.z - from.z };
  };
  let seed = 51217;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const place = (
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    kind: Architecture = 'house',
    options: Partial<Building> = {},
  ) => {
    buildings.push({
      x,
      z,
      w,
      d,
      h,
      kind,
      angle: 0,
      roof: kind === 'pavilion' ? 'pavilion' : kind === 'hall' ? 'hip' : 'gable',
      finish: 'plaster',
      royal: false,
      ...options,
      origin: area,
    });
  };
  const lane = (points: number[][], width: number, paved = false) =>
    lanes.push({ points, width, paved, origin: area });
  const court = (x: number, z: number, w: number, d: number, garden = false) =>
    courts.push({ x, z, w, d, garden, origin: area });
  // A courtyard is built from a principal hall, lower side wings, an entry and a yard.
  // Differing aspect ratios, open sides, roof types and frontage break the roof-array effect.
  const compound = (
    x: number,
    z: number,
    w: number,
    d: number,
    variant: number,
    jungle = false,
  ) => {
    const wing = 1.25 + random() * 0.4;
    court(x, z, w + 0.5, d + 0.3, jungle);
    if (variant % 5 === 2) {
      // Narrow urban lots: two uneven frontages with a shared lane, not a large U compound.
      for (let row = 0; row < 2; row++)
        for (let col = 0; col < 3; col++) {
          const px = x + (col - 1) * w * 0.3,
            pz = z + (row - 0.5) * d * 0.53;
          place(
            px + (random() - 0.5) * 0.28,
            pz,
            w * (0.22 + random() * 0.04),
            d * 0.27,
            1.05 + random() * 1.05,
            row === 1 ? 'shop' : 'house',
            {
              roof: col === 1 ? 'hip' : 'gable',
              finish: (col + row) % 3 === 0 ? 'earth' : 'plaster',
            },
          );
        }
      lane(
        [
          [x - w * 0.46, z],
          [x + w * 0.46, z + 0.22],
        ],
        0.58,
        true,
      );
      plantTownTree({ x: x + w * 0.37, z: z + d * 0.39, scale: 1.8, type: jungle ? 2 : 1 });
      return;
    }
    if (variant % 5 === 3) {
      // An open market has low awnings, a storehouse and a bent pedestrian alley.
      place(x, z - d * 0.33, w * 0.86, d * 0.22, 1.65, 'barn', { roof: 'hip', finish: 'earth' });
      for (let i = 0; i < 3; i++) {
        place(
          x + (i - 1) * w * 0.29,
          z + d * 0.26,
          w * 0.24,
          d * 0.22,
          0.8 + random() * 0.45,
          'shop',
          { finish: i % 2 ? 'earth' : 'plaster' },
        );
        place(
          x + (i - 1) * w * 0.29,
          z - d * 0.02,
          w * 0.21,
          d * 0.18,
          0.7 + random() * 0.4,
          'shop',
          { roof: 'studio' },
        );
      }
      lane(
        [
          [x - w * 0.44, z + d * 0.11],
          [x, z + d * 0.1],
          [x + w * 0.42, z + d * 0.17],
        ],
        0.65,
        true,
      );
      return;
    }
    place(
      x + (random() - 0.5) * 0.45,
      z - d * 0.35,
      w * 0.88,
      d * 0.26,
      1.25 + random() * 0.65,
      'house',
      {
        roof: variant % 3 === 0 ? 'hip' : 'gable',
        finish: variant % 4 === 0 ? 'earth' : 'plaster',
      },
    );
    if (variant % 4 !== 1)
      place(x - w * 0.37, z - 0.1, d * 0.58, wing, 0.9 + random() * 0.35, 'house', {
        angle: Math.PI / 2,
      });
    place(x + w * 0.36, z + 0.15, d * 0.63, wing, 1.1 + random() * 0.55, 'house', {
      angle: Math.PI / 2,
      roof: variant % 2 ? 'gable' : 'studio',
    });
    if (variant % 3 !== 1) place(x - w * 0.22, z + d * 0.36, w * 0.38, 1.35, 0.85, 'shop');
    if (variant % 3 !== 0) place(x + w * 0.24, z + d * 0.36, w * 0.4, 1.3, 0.9, 'house');
    if (variant % 4 === 2 || variant % 4 === 3) {
      place(x - w * 0.08, z + d * 0.08, w * 0.33, d * 0.22, 0.8 + random() * 0.3, 'house', {
        roof: 'studio',
        finish: 'earth',
      });
      place(x + w * 0.16, z + d * 0.23, w * 0.23, d * 0.16, 0.72, 'barn');
    }
    if (variant % 2 === 0)
      plantTownTree({
        x: x - w * 0.16,
        z: z + 0.5,
        scale: 1.65 + random() * 0.65,
        type: jungle ? 2 : 1,
      });
  };
  const ca = origins.xiyou;
  // North palace, temples and a broad ceremonial avenue; side blocks carry everyday life.
  lane(
    [
      [ca.x, ca.z + ca.depth / 2 + 5],
      [ca.x, ca.z - 5],
      [ca.x, ca.z - 14],
    ],
    3.8,
    true,
  );
  lane(
    [
      [-71, -12],
      [-4, -12],
    ],
    1.55,
    true,
  );
  lane(
    [
      [-71, 1],
      [-4, 1],
    ],
    1.15,
    true,
  );
  lane(
    [
      [-71, -25],
      [-53, -25],
    ],
    1,
    true,
  );
  lane(
    [
      [-20, -25],
      [-4, -25],
    ],
    1,
    true,
  );
  for (const x of [-57.6, -16.5])
    lane(
      [
        [x, -32],
        [x, 5.5],
      ],
      0.85,
      true,
    );
  const blocks: [number, number, number, number, number][] = [
    [-64, -28.5, 10, 7, 0],
    [-51, -28.5, 9, 7, 1],
    [-15, -29, 9.5, 7, 2],
    [-6, -29, 6.8, 7, 3],
    [-64, -18.5, 10, 9, 3],
    [-50, -18.5, 10.4, 9, 4],
    [-24, -18, 9, 9, 5],
    [-9, -18.5, 11, 9, 6],
    [-65, -6, 9.8, 9, 6],
    [-50.5, -6, 11, 9, 7],
    [-24, -6, 10.8, 9, 8],
    [-9, -6, 11, 9, 9],
    [-65, 4, 10, 5.7, 4],
    [-50, 4, 10.6, 5.7, 5],
    [-24, 4, 10.3, 5.7, 2],
    [-9, 4, 10.5, 5.7, 8],
  ];
  for (const b of blocks) compound(...b);
  // The palace has a raised forecourt, three halls and long, low red galleries.
  court(ca.x, -26, 25, 16);
  place(ca.x, -30, 13.5, 5.2, 3.5, 'hall', { royal: true, finish: 'red', base: 1.2 });
  place(ca.x, -29.8, 10.8, 4.2, 1.15, 'hall', {
    royal: true,
    finish: 'red',
    base: 5.55,
    tier: true,
  });
  for (const sign of [-1, 1]) {
    place(ca.x + sign * 9.4, -29, 5.6, 3.5, 1.65, 'hall', { royal: true, finish: 'red' });
    place(ca.x + sign * 11, -23.5, 10.5, 1.25, 1.2, 'gallery', {
      angle: Math.PI / 2,
      royal: true,
      finish: 'red',
    });
    place(ca.x + sign * 5.6, -19.5, 6.2, 1.45, 1.1, 'gallery', { royal: true, finish: 'red' });
    plantTownTree({ x: ca.x + sign * 9, z: -24, scale: 2.3, type: 0 });
  }
  place(ca.x, -19, 4.3, 2, 1.5, 'hall', { royal: true, finish: 'red' });
  // Market frontages face the avenue, with short secondary alleys behind them.
  for (const side of [-1, 1])
    for (let i = 0; i < 7; i++) {
      const z = -13.5 + i * 2.55;
      place(ca.x + side * 4.5, z, 2.35 + random() * 0.6, 2.15, 1.05 + random() * 0.5, 'shop', {
        angle: (side * Math.PI) / 2,
        finish: i % 3 === 0 ? 'earth' : 'plaster',
        roof: i % 3 === 1 ? 'hip' : 'gable',
      });
    }
  // Two recognisable precincts stand above the ordinary roofline.
  place(-65, -18, 4.2, 3.8, 1.9, 'hall', { royal: true, finish: 'red', base: 2.5 });
  place(-7, -27.5, 3.2, 3.2, 2.3, 'pavilion', { royal: false, base: 2.15 });
  // Suburbs follow the outward roads, rather than ending abruptly at the city wall.
  for (const side of [-1, 1])
    for (let i = 0; i < 6; i++) {
      const x = ca.x + side * (5 + i * 3.7),
        z = ca.z + ca.depth / 2 + 3.5 + Math.sin(i) * 1.2;
      place(x, z, 2.6 + random() * 0.8, 1.8, 1.1 + random() * 0.35, 'shop', {
        roof: i % 2 ? 'gable' : 'studio',
      });
    }
  // Hanzhong: compact fort, one bent lane, barracks, grain stores and a command court.
  area = 'sanguo';
  const hz = origins.sanguo;
  lane(
    [
      [hz.x, hz.z + 9],
      [hz.x - 1, hz.z + 3],
      [hz.x + 1, hz.z - 5],
    ],
    1.5,
    true,
  );
  court(hz.x, hz.z - 3.5, 10, 7);
  place(hz.x, hz.z - 5.3, 6.5, 3, 2.4, 'hall', { royal: true, finish: 'red' });
  for (const side of [-1, 1]) {
    place(hz.x + side * 7, hz.z - 3, 6.8, 2, 1.35, 'barn', { angle: Math.PI / 2, finish: 'earth' });
    place(hz.x + side * 6.4, hz.z + 3.6, 4.8, 2.3, 1.15, 'house', {
      roof: side === 1 ? 'hip' : 'gable',
    });
    place(hz.x + side * 6, hz.z + 7.8, 2.5, 1.8, 1.1, 'shop');
    plantTownTree({ x: hz.x + side * 3.6, z: hz.z + 0.5, scale: 1.8, type: 1 });
  }
  // Liangshan: high gathering hall, irregular terraced cabins and lakeside sheds.
  area = 'shuihu';
  const ls = origins.shuihu;
  court(ls.x, ls.z, 18, 11);
  place(ls.x, ls.z - 3, 7.8, 4, 2.8, 'hall', { finish: 'timber', roof: 'hip' });
  place(ls.x, ls.z - 3, 5.7, 3, 1, 'hall', { finish: 'timber', base: 4.2, tier: true });
  for (const [dx, dz, w, a] of [
    [-6, 1, 3.6, 0.12],
    [-5.5, 5, 3.9, 0],
    [5.5, 2.1, 3.8, -0.17],
    [5.7, 5.7, 3.2, 0.1],
    [-7, -4, 2.5, Math.PI / 2],
    [8, -1, 3.1, Math.PI / 2],
  ])
    place(ls.x + dx, ls.z + dz, w, 2.3, 1.25, 'house', {
      finish: 'timber',
      angle: a,
      roof: 'studio',
    });
  lane(
    [
      [ls.x, ls.z - 2],
      [ls.x, ls.z + 5],
      [ls.x + 6, ls.z + 8],
      [ls.x + 13, ls.z + 9],
    ],
    1.1,
  );
  for (const [dx, dz] of [
    [9, 7],
    [13, 9],
    [17, 10],
  ])
    place(ls.x + dx, ls.z + dz, 2.7, 2, 1.1, 'barn', {
      finish: 'timber',
      roof: 'gable',
      base: 0.4,
    });
  area = 'honglou';
  // Jinling: a clustered town wraps a pond. Garden galleries and waterfront vary its edge.
  lane(
    [
      [76, 49],
      [82, 46],
      [88, 46],
      [92, 42],
      [103, 42],
    ],
    1.05,
    true,
  );
  lane(
    [
      [79, 54],
      [86, 55],
      [90, 59],
      [99, 59],
      [105, 55],
    ],
    0.75,
    true,
  );
  compound(81, 42, 8, 7.5, 2, true);
  compound(82, 51, 8.5, 6.3, 5, true);
  compound(90, 40, 7, 7, 7, true);
  compound(89, 56, 6.5, 5.2, 1, true);
  place(100, 43, 6.4, 3.1, 1.85, 'hall', { roof: 'hip' });
  place(103, 47, 7.8, 1.25, 1.05, 'gallery', { angle: Math.PI / 2 });
  place(96, 55.2, 8.4, 1.2, 1, 'gallery');
  place(96, 49, 2.8, 2.8, 1.6, 'pavilion', { base: 0.7 });
  place(105, 52, 3.1, 3.1, 1.8, 'pavilion');
  for (let i = 0; i < 6; i++)
    place(104.5, 39.5, 3.2 - i * 0.33, 3.2 - i * 0.33, 0.72, 'pavilion', {
      base: 0.65 + i * 1.24,
      royal: i === 5,
      tier: true,
    });
  for (const [x, z] of [
    [78, 46],
    [86, 48],
    [94, 43],
    [101, 54],
    [91, 59],
    [105, 56],
    [92, 52],
  ])
    plantTownTree({ x, z, scale: 1.7 + random() * 0.6, type: 2 });
  // Individual village plans follow their sites; fewer buildings carry clearer roles.
  area = undefined;
  type Lot = [number, number, number, number, number, Architecture, number?];
  const plans: Record<string, Lot[]> = {
    market: [
      [-7, -2, 3.4, 2.1, 1.3, 'shop'],
      [-2, -3, 3, 2.3, 1.4, 'shop'],
      [3, -1.8, 3.6, 2.1, 1.2, 'shop'],
      [7, 1, 2.8, 2.4, 1.25, 'shop', 0.2],
      [-4, 4, 3.3, 2.5, 1.5, 'house'],
      [2, 5, 4.7, 2.8, 1.7, 'hall'],
      [8, -5, 4, 2.4, 1.25, 'barn'],
    ],
    ford: [
      [-8, -2, 4.3, 2.8, 1.6, 'house'],
      [-3, -4, 3, 2.2, 1.2, 'house'],
      [-5, 3, 5.8, 2.3, 1.4, 'barn'],
      [2, 2, 3.1, 2, 1.25, 'shop'],
      [6, 4, 2.4, 2.4, 1.3, 'pavilion'],
    ],
    terrace: [
      [-7, -2, 3.4, 2.2, 1.4, 'house'],
      [-3, -6, 2.9, 2, 1.2, 'house'],
      [2, -2, 4.2, 2.6, 1.6, 'house'],
      [7, -5, 3.1, 2.1, 1.25, 'house', 0.2],
      [0, 4, 4.4, 2.5, 1.3, 'barn'],
    ],
    hamlet: [
      [-6, -4, 4.1, 2.6, 1.7, 'house'],
      [-7, 2, 2.7, 2.1, 1.15, 'house', 1.57],
      [-1, -5, 3.1, 2, 1.2, 'house'],
      [4, -3, 3.8, 2.5, 1.5, 'house'],
      [5, 3, 2.9, 2.1, 1.25, 'house'],
      [-1, 5, 4.6, 2.2, 1.2, 'barn'],
    ],
    fishing: [
      [-6, -3, 3.1, 2, 1.2, 'house'],
      [-2, -5, 4.3, 2.2, 1.1, 'barn'],
      [3, -2, 2.8, 1.9, 1.15, 'house', 0.18],
      [6, 2, 4.8, 1.7, 1.05, 'barn'],
      [-2, 3, 3.2, 2, 1.2, 'shop'],
    ],
    orchard: [
      [-5, -3, 4.8, 2.7, 1.6, 'barn'],
      [1, -4, 3.3, 2.5, 1.5, 'house'],
      [-6, 3, 2.9, 2.1, 1.1, 'house', 1.57],
      [3, 3, 3.8, 2.2, 1.3, 'house'],
    ],
  };
  for (const site of layout.villages) {
    const c = Math.cos(site.angle),
      s = Math.sin(site.angle);
    const local = (u: number, v: number) => [site.x + c * u + s * v, site.z - s * u + c * v];
    const active: number[][] = [];
    for (const [index, [u, v, w, d, h, kind, turn = 0]] of plans[site.kind].entries()) {
      const [x, z] = local(u, v),
        wet = waterDistance(x, z),
        relief = mountainHeight(x, z);
      const angle = site.angle + turn;
      const corners = [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [-w / 2, d / 2],
        [w / 2, d / 2],
      ].map(([a, b]) => [
        x + Math.cos(angle) * a + Math.sin(angle) * b,
        z - Math.sin(angle) * a + Math.cos(angle) * b,
      ]);
      const heights = corners.map(([px, pz]) => terrainHeight(px, pz));
      if (townDistance(x, z) < 3 || relief > 8 || Math.max(...heights) - Math.min(...heights) > 1.6)
        continue;
      const waterside = (site.kind === 'fishing' && kind === 'barn') || kind === 'pavilion';
      if (!waterside && corners.some(([px, pz]) => waterDistance(px, pz) < 1.3)) continue;
      if (wet < -4 && !waterside) continue;
      place(x, z, w, d, h, kind, {
        site: site.id,
        angle,
        roof:
          kind === 'pavilion'
            ? 'pavilion'
            : kind === 'hall'
              ? 'hip'
              : index % 4 === 0
                ? 'studio'
                : 'gable',
        finish:
          site.kind === 'fishing'
            ? 'timber'
            : site.kind === 'terrace' || site.kind === 'orchard'
              ? 'earth'
              : 'plaster',
        base: waterside ? Math.max(0.8, ...heights) : Math.max(...heights) + 0.035,
      });
      active.push(local(u, v > 0 ? v - 2 : v + 2));
    }
    if (!active.length) continue;
    const through =
      site.kind === 'terrace'
        ? [local(-10, 2), local(-4, 0), local(1, 1), local(7, -1), local(11, -4)]
        : site.kind === 'market'
          ? [local(-12, 1), local(-4, 0.3), local(2, 1.8), local(10, 4)]
          : [local(-10, 0), local(-4, 1), local(2, 0), local(10, 2)];
    lanes.push({ points: through, width: site.kind === 'market' ? 0.85 : 0.55, site: site.id });
    for (const p of active) lanes.push({ points: [local(0, 0), p], width: 0.32, site: site.id });
    courts.push({
      x: site.x,
      z: site.z,
      w: site.kind === 'market' ? 8 : 5,
      d: site.kind === 'market' ? 4.8 : 4,
      angle: site.angle,
      site: site.id,
    });
    // Short access lane joins the nearest real road; it does not radiate at every house.
    let best = Infinity,
      join: number[] | undefined;
    for (const road of scrollRoads)
      for (let i = 1; i < road.samples.length; i++) {
        const a = road.samples[i - 1],
          b = road.samples[i],
          dx = b[0] - a[0],
          dz = b[1] - a[1];
        const t = Math.max(
          0,
          Math.min(1, ((site.x - a[0]) * dx + (site.z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
        );
        const x = a[0] + dx * t,
          z = a[1] + dz * t,
          d = (x - site.x) ** 2 + (z - site.z) ** 2;
        if (d < best) {
          best = d;
          join = [x, z];
        }
      }
    if (join && best > 9 && best < 65 * 65)
      lanes.push({
        points: [
          join,
          [(join[0] + site.x) / 2 + 1.5, (join[1] + site.z) / 2 - 1.2],
          local(-4, 0),
          local(0, 0),
        ],
        width: 0.5,
        site: site.id,
      });
    for (const [u, v] of site.kind === 'orchard'
      ? [
          [-1, 6],
          [5, 5],
          [7, -5],
        ]
      : [
          [-8, 5],
          [7, -6],
        ]) {
      const [x, z] = local(u, v);
      if (waterDistance(x, z) > 1.5)
        plantTownTree({ x, z, scale: 1.6 + random() * 0.7, type: site.kind === 'orchard' ? 1 : 0 });
    }
  }
  return {
    buildings: buildings.map(move),
    courts: courts.map(move),
    trees: trees.map(move),
    lanes: lanes.map((l) => ({
      ...l,
      points: l.points.map(([x, z]) => {
        const p = move({ x, z, origin: l.origin });
        return [p.x, p.z];
      }),
    })),
  };
}
