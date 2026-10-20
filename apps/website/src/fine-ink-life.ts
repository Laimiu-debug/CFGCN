import type { GameId } from '@cfgcn/shared';
import navigableWater from './fine-ink-water-routes.json';

export type InkPoint = readonly [number, number];
export type InkRoute = {
  id: string;
  points: InkPoint[];
  lengths: number[];
  length: number;
};
export type InkJourney = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  moving: boolean;
  progress: number;
  direction: 1 | -1;
  pace?: number;
};
export type InkBoat = {
  id: string;
  route: InkRoute;
  speed: number;
  dwell: number;
  phase: number;
  size: number;
  kind: 'ferry' | 'cargo' | 'fisher';
};
export type InkWalker = {
  id: string;
  route: InkRoute;
  speed: number;
  dwell: number;
  phase: number;
  size: number;
  town: GameId;
  kind: 'resident' | 'porter' | 'monk' | 'monkey' | 'pig' | 'sandy' | 'lady' | 'farmer';
};

export const inkWorldSize = { width: 2400, height: 1501 };
// Source coordinates are authored against the accepted 1586 × 992 painting.
// These routes follow visible channels / roads, rather than random screen paths.
const unit = 2400 / 1586;
export const inkPoint = (x: number, y: number): InkPoint => [x * unit, y * unit];

export function makeInkRoute(id: string, source: readonly InkPoint[]): InkRoute {
  const points = source.map(([x, y]) => inkPoint(x, y));
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(
      lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
    );
  }
  return { id, points, lengths, length: lengths.at(-1) ?? 0 };
}

export function sampleInkRoute(
  route: InkRoute,
  progress: number,
): Omit<InkJourney, 'moving' | 'direction'> {
  const p = Math.max(0, Math.min(1, progress));
  const distance = route.length * p;
  let i = 1;
  while (i < route.lengths.length - 1 && route.lengths[i] < distance) i++;
  const a = route.points[i - 1] ?? [0, 0];
  const b = route.points[i] ?? a;
  const span = route.lengths[i] - route.lengths[i - 1];
  const t = span > 0 ? (distance - route.lengths[i - 1]) / span : 0;
  return {
    x: a[0] + (b[0] - a[0]) * t,
    y: a[1] + (b[1] - a[1]) * t,
    dx: b[0] - a[0],
    dy: b[1] - a[1],
    progress: p,
  };
}

// A journey waits at BOTH endpoints. A reversing boat never teleports across the river.
export function inkJourney(
  route: InkRoute,
  seconds: number,
  speed: number,
  dwell: number,
  phase = 0,
  rampSeconds = 0,
): InkJourney {
  const travel = route.length / Math.max(0.1, speed);
  const half = travel + dwell;
  const cycle = half * 2;
  const clock = (((seconds + phase) % cycle) + cycle) % cycle;
  const direction = clock < half ? 1 : -1;
  const leg = clock % half;
  const moving = leg >= dwell;
  const t = Math.max(0, Math.min(1, (leg - dwell) / travel));
  const edge = Math.min(0.2, Math.max(0, rampSeconds / Math.max(travel, 0.001)));
  let along = t,
    pace = moving ? 1 : 0;
  if (edge > 0 && moving) {
    if (t < edge) {
      along = (t * t) / (2 * edge * (1 - edge));
      pace = t / (edge * (1 - edge));
    } else if (t > 1 - edge) {
      along = 1 - (1 - t) ** 2 / (2 * edge * (1 - edge));
      pace = (1 - t) / (edge * (1 - edge));
    } else {
      along = (t - edge / 2) / (1 - edge);
      pace = 1 / (1 - edge);
    }
  }
  const point = sampleInkRoute(route, direction === 1 ? along : 1 - along);
  return { ...point, dx: point.dx * direction, dy: point.dy * direction, direction, moving, pace };
}

export function advanceInkClock(seconds: number, deltaMs: number, active: boolean): number {
  // A hidden tab / reduced-motion preference freezes the whole ecosystem together.
  return active ? seconds + Math.min(Math.max(deltaMs, 0), 80) / 1000 : seconds;
}

// Authored seeds live in art/fine-ink/water-routes-source.json. This checked
// route pack is prepared from the same water mask used by the visible surface.
const riverRoute = (id: keyof typeof navigableWater) =>
  makeInkRoute(
    id,
    navigableWater[id].map(([x, y]) => [x, y] as InkPoint),
  );
const channel = riverRoute('north-trade-channel'),
  liangshan = riverRoute('liangshan-ferry'),
  east = riverRoute('eastern-channel'),
  han = riverRoute('han-valley-ferry'),
  jinling = riverRoute('jinling-front-channel'),
  garden = riverRoute('garden-ferry');

export const inkBoats: InkBoat[] = [
  { id: 'han-ferry', route: han, speed: 9, dwell: 9, phase: 18, size: 1.15, kind: 'ferry' },
  { id: 'han-fisher', route: han, speed: 5, dwell: 17, phase: 67, size: 0.72, kind: 'fisher' },
  {
    id: 'liangshan-ferry',
    route: liangshan,
    speed: 10,
    dwell: 10,
    phase: 3,
    size: 1.05,
    kind: 'ferry',
  },
  {
    id: 'liangshan-fisher',
    route: liangshan,
    speed: 5,
    dwell: 16,
    phase: 78,
    size: 0.65,
    kind: 'fisher',
  },
  { id: 'grain-barge', route: channel, speed: 10, dwell: 10, phase: 64, size: 0.95, kind: 'cargo' },
  { id: 'north-sail', route: channel, speed: 12, dwell: 8, phase: 13, size: 0.7, kind: 'cargo' },
  { id: 'east-ferry', route: east, speed: 8, dwell: 11, phase: 11, size: 0.8, kind: 'ferry' },
  { id: 'jinling-barge', route: jinling, speed: 9, dwell: 13, phase: 52, size: 1.1, kind: 'cargo' },
  { id: 'jinling-ferry', route: jinling, speed: 12, dwell: 8, phase: 9, size: 0.9, kind: 'ferry' },
  {
    id: 'garden-fisher',
    route: garden,
    speed: 7,
    dwell: 15,
    phase: 38,
    size: 0.75,
    kind: 'fisher',
  },
];

const changanStreet = makeInkRoute('changan-main-street', [
  [619, 279],
  [620, 315],
  [625, 360],
  [630, 401],
  [638, 435],
]);
const westernRoad = makeInkRoute('western-pilgrimage-road', [
  [634, 436],
  [608, 454],
  [578, 470],
  [548, 481],
  [523, 491],
]);
const farmRoad = makeInkRoute('farmland-lane', [
  [858, 438],
  [894, 449],
  [932, 467],
  [978, 482],
  [1020, 492],
]);
const hanStreet = makeInkRoute('hanzhong-gate-road', [
  [401, 651],
  [396, 679],
  [394, 701],
  [410, 721],
  [438, 740],
  [480, 759],
]);
const liangshanQuay = makeInkRoute('liangshan-quay', [
  [1096, 321],
  [1135, 327],
  [1174, 332],
  [1213, 340],
]);
const jinlingStreet = makeInkRoute('jinling-market-road', [
  [1180, 695],
  [1214, 706],
  [1246, 718],
  [1281, 734],
  [1311, 755],
]);
const gardenWalk = makeInkRoute('jinling-garden-path', [
  [1313, 748],
  [1357, 746],
  [1393, 753],
  [1426, 764],
  [1473, 771],
]);

export const inkWalkers: InkWalker[] = [
  ...Array.from({ length: 5 }, (_, i): InkWalker => ({
    id: `changan-${i}`,
    route: changanStreet,
    speed: 5.3 + i * 0.4,
    dwell: 4 + i,
    phase: i * 12 + 5,
    size: 0.9,
    town: 'xiyou',
    kind: i === 2 ? 'porter' : 'resident',
  })),
  ...(['monk', 'monkey', 'pig', 'sandy'] as const).map((kind, i): InkWalker => ({
    id: `pilgrim-${kind}`,
    route: westernRoad,
    speed: 4.5,
    dwell: 13,
    phase: 26 + i * 3.2,
    size: 1.08,
    town: 'xiyou',
    kind,
  })),
  ...Array.from({ length: 4 }, (_, i): InkWalker => ({
    id: `farmer-${i}`,
    route: farmRoad,
    speed: 4 + i * 0.2,
    dwell: 7,
    phase: 7 + i * 19,
    size: 0.82,
    town: 'sanguo',
    kind: i === 1 ? 'porter' : 'farmer',
  })),
  ...Array.from({ length: 4 }, (_, i): InkWalker => ({
    id: `hanzhong-${i}`,
    route: hanStreet,
    speed: 4.8 + i * 0.3,
    dwell: 6,
    phase: 8 + i * 17,
    size: 1,
    town: 'sanguo',
    kind: i === 2 ? 'porter' : 'resident',
  })),
  ...Array.from({ length: 4 }, (_, i): InkWalker => ({
    id: `liangshan-${i}`,
    route: liangshanQuay,
    speed: 4.2 + i * 0.4,
    dwell: 10,
    phase: 4 + i * 13,
    size: 0.95,
    town: 'shuihu',
    kind: i === 0 ? 'porter' : 'resident',
  })),
  ...Array.from({ length: 5 }, (_, i): InkWalker => ({
    id: `jinling-${i}`,
    route: jinlingStreet,
    speed: 4.1 + i * 0.3,
    dwell: 6,
    phase: 5 + i * 12,
    size: 1,
    town: 'honglou',
    kind: i % 2 ? 'lady' : 'resident',
  })),
  ...Array.from({ length: 3 }, (_, i): InkWalker => ({
    id: `garden-${i}`,
    route: gardenWalk,
    speed: 3.9,
    dwell: 10,
    phase: 8 + i * 23,
    size: 0.96,
    town: 'honglou',
    kind: 'lady',
  })),
];

export const inkSmoke = [
  [509, 287],
  [707, 400],
  [909, 458],
  [307, 701],
  [1148, 308],
  [1370, 715],
  [1490, 744],
].map(([x, y]) => inkPoint(x, y));
export const inkFlags = [
  [584, 242],
  [647, 394],
  [393, 631],
  [1097, 286],
  [1221, 306],
  [1436, 704],
].map(([x, y]) => inkPoint(x, y));

export const inkClouds = [
  { x: 80, y: 360, width: 340, height: 52, speed: 0.8, depth: 0.4, phase: 0 },
  { x: 240, y: 590, width: 310, height: 55, speed: 1.3, depth: 0.7, phase: 2 },
  { x: 620, y: 585, width: 400, height: 48, speed: 1.1, depth: 0.7, phase: 5 },
  { x: 97, y: 901, width: 420, height: 65, speed: 1.7, depth: 1, phase: 7 },
  { x: 660, y: 927, width: 350, height: 47, speed: 1.4, depth: 1, phase: 3 },
  { x: 460, y: 112, width: 460, height: 26, speed: 0.45, depth: 0.2, phase: 4 },
];
