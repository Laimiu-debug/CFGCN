import type { MapPosition } from './expedition-map';

export const fogSaveKey = 'cfgcn:map:xiyou:fog:v1';
export const fogCell = 16;
export const mapMarksSaveKey = 'cfgcn:map:xiyou:marks:v1';
export const maxMapMarks = 64;
export type MapMark = { id: string; pos: MapPosition };

function isMapMark(value: unknown): value is MapMark {
  if (!value || typeof value !== 'object') return false;
  const v = value as MapMark;
  return (
    typeof v.id === 'string' &&
    /^[a-zA-Z0-9-]{1,64}$/.test(v.id) &&
    Number.isFinite(v.pos?.x) &&
    Number.isFinite(v.pos?.z) &&
    Math.abs(v.pos.x) < 1_000_000 &&
    Math.abs(v.pos.z) < 1_000_000
  );
}
export function readMapMarks(storage: Pick<Storage, 'getItem'> | null | undefined): MapMark[] {
  try {
    const value = JSON.parse(storage?.getItem(mapMarksSaveKey) ?? 'null');
    if (value?.version !== 1 || !Array.isArray(value.marks) || value.marks.length > maxMapMarks)
      return [];
    const seen = new Set<string>();
    return value.marks.filter((v: unknown): v is MapMark => {
      if (!isMapMark(v) || seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  } catch {
    return [];
  }
}
export function saveMapMarks(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  marks: MapMark[],
): boolean {
  try {
    if (!storage || marks.length > maxMapMarks || !marks.every(isMapMark)) return false;
    storage.setItem(mapMarksSaveKey, JSON.stringify({ version: 1, marks }));
    return true;
  } catch {
    return false;
  }
}

/** The map shares the game camera axes: west is up, positive world X is left. */
export function mapPointAt(
  x: number,
  y: number,
  width: number,
  height: number,
  center: MapPosition,
  span: number,
): MapPosition {
  const metres = span / Math.max(width, height);
  return { x: center.x - (x - width / 2) * metres, z: center.z - (y - height / 2) * metres };
}
export type MapChart = {
  x: number;
  z: number;
  span: number;
  size: number;
  terrain: [number, number, number][];
  props: [number, number, number, number][];
};
export const fogKey = (x: number, z: number) =>
  `${Math.floor(x / fogCell)}:${Math.floor(z / fogCell)}`;
export function readFog(storage: Pick<Storage, 'getItem'> | null | undefined): Set<string> {
  try {
    const value = JSON.parse(storage?.getItem(fogSaveKey) ?? 'null');
    if (value?.version !== 1 || !Array.isArray(value.cells) || value.cells.length > 60000)
      return new Set();
    return new Set(
      value.cells.filter((s: unknown) => typeof s === 'string' && /^-?\d{1,6}:-?\d{1,6}$/.test(s)),
    );
  } catch {
    return new Set();
  }
}
export function revealFog(fog: Set<string>, p: MapPosition): boolean {
  let changed = false;
  // Reveal the surroundings actually approached, independently of region bits.
  for (let z = -4; z <= 4; z++)
    for (let x = -4; x <= 4; x++) {
      if (x * x + z * z > 16) continue;
      const key = fogKey(p.x + x * fogCell, p.z + z * fogCell);
      if (!fog.has(key)) {
        fog.add(key);
        changed = true;
      }
    }
  return changed;
}
export function saveFog(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  fog: Set<string>,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(fogSaveKey, JSON.stringify({ version: 1, cells: [...fog] }));
    return true;
  } catch {
    return false;
  }
}
export function isMapChart(value: unknown): value is MapChart {
  if (!value || typeof value !== 'object') return false;
  const v = value as MapChart;
  return (
    Number.isFinite(v.x) &&
    Number.isFinite(v.z) &&
    [128, 256, 512, 1024].includes(v.span) &&
    v.size === 65 &&
    Array.isArray(v.terrain) &&
    v.terrain.length === 4225 &&
    v.terrain.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) &&
    Array.isArray(v.props) &&
    v.props.length < 20000 &&
    v.props.every((p) => Array.isArray(p) && p.length === 4 && p.every(Number.isFinite))
  );
}
