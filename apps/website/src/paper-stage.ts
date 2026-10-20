// World-up is Y. The painting is a local surface reference, never a camera
// projection used to reconstruct all objects together.
export const paperWorld = { width: 2400, rows: 1501, down: (58 * Math.PI) / 180 };
export type PaperPoint = readonly [number, number, number];
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function paperPoint(x: number, row: number, height = 0): PaperPoint {
  return [
    x - paperWorld.width / 2,
    height,
    (row - paperWorld.rows / 2) / Math.sin(paperWorld.down),
  ];
}
export function paperMap(point: PaperPoint) {
  return {
    x: point[0] + paperWorld.width / 2,
    y: point[2] * Math.sin(paperWorld.down) + paperWorld.rows / 2,
  };
}
export function paperPlainHeight(x: number, row: number) {
  const shoulder = Math.exp(-Math.pow((x - 460) / 650, 2));
  const valleys = 0.65 + 0.35 * Math.sin(row / 220 + x / 500);
  return 10 + 35 * shoulder * valleys + 5 * Math.sin(x / 350) * Math.sin(row / 180);
}

export function paperCardPoint(
  x: number,
  row: number,
  root: number,
  ground: number,
  lift: number,
  fold = 0,
): PaperPoint {
  const rise = Math.max(0, root - row);
  const y = ground + (rise * lift) / Math.cos(paperWorld.down);
  const z = (root - rise * (1 - lift) - paperWorld.rows / 2) / Math.sin(paperWorld.down) + fold;
  return [x - paperWorld.width / 2, y, z];
}

export function paperLimitView(x: number, row: number, zoom: number, aspect: number) {
  const z = clamp(zoom, 1, 2.7);
  const span = Math.min(1320, 2180 / Math.max(0.2, aspect)) / z;
  const horizontal = Math.min(1100, (span * aspect) / 2);
  const vertical = Math.min(650, span / 2);
  return {
    x: clamp(x, horizontal + 25, 2400 - horizontal - 25),
    y: clamp(row, vertical + 38, 1501 - vertical - 38),
    zoom: z,
    whole: false,
  };
}
