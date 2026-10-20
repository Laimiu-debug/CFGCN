import world from '../../../packages/game-core/data/xiyou-world.json';
import layout from '../../../packages/game-core/data/xiyou-map-layout.json';

export const mapRegions = world.regions;
export const mapFields = layout.fields.map((field) => {
  const region = mapRegions.find((r) => r.id === field.region)!;
  return { ...field, x: anchorX(region.z) + field.offset[0], z: region.z + field.offset[1] };
});
export const mapLandmarks = layout.landmarks.map((landmark) => {
  const region = mapRegions.find((r) => r.id === landmark.region)!;
  const z = region.z + landmark.offset[1];
  return {
    ...landmark,
    icon: landmark.icon ?? landmark.scene,
    x: anchorX(z) + landmark.offset[0],
    z,
  };
});
export const expeditionSaveKey = 'cfgcn:map:xiyou:v1';
export type MapPosition = { x: number; z: number };
export type ExpeditionState = {
  version: 1;
  region: number;
  visited: number;
  distance: number;
  pos: MapPosition;
  restored_from?: MapPosition | null;
};
export type MapSave = { version: 1; pos: MapPosition; visited: number };
export function readMapSave(storage: Pick<Storage, 'getItem'> | null | undefined): MapSave | null {
  try {
    const v = JSON.parse(storage?.getItem(expeditionSaveKey) ?? 'null') as MapSave | null;
    return v?.version === 1 &&
      Number.isFinite(v.pos?.x) &&
      Number.isFinite(v.pos?.z) &&
      Math.abs(v.pos.x) < 1_000_000 &&
      Math.abs(v.pos.z) < 1_000_000 &&
      Number.isSafeInteger(v.visited) &&
      v.visited >= 0 &&
      v.visited <= 0xffffffff
      ? v
      : null;
  } catch {
    return null;
  }
}
export function saveMap(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  state: ExpeditionState,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(
      expeditionSaveKey,
      JSON.stringify({ version: 1, pos: state.pos, visited: state.visited }),
    );
    return true;
  } catch {
    return false;
  }
}
export function anchorX(z: number): number {
  const next = Math.max(
    0,
    Math.min(
      mapRegions.length - 1,
      mapRegions.findIndex((r) => r.z > z) < 0
        ? mapRegions.length - 1
        : mapRegions.findIndex((r) => r.z > z),
    ),
  );
  const a = mapRegions[Math.max(0, next - 1)],
    b = mapRegions[next];
  const t = a === b ? 0 : Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z)));
  const smooth = t * t * (3 - 2 * t);
  return a.x * (1 - smooth) + b.x * smooth + Math.sin(z * 0.013) * 9 + Math.sin(z * 0.031) * 2;
}
export function riverCourse(region: (typeof mapRegions)[number], x: number): number {
  const l = layout.river,
    dx = x - region.x;
  return (
    region.z +
    l.offset +
    l.meander * Math.sin(dx * l.meanderRate) +
    l.smallMeander * Math.sin(dx * l.smallRate + l.smallPhase)
  );
}
export function riverLine(region: (typeof mapRegions)[number], start: number, end: number): string {
  const left = Math.max(region.x - 440, start),
    right = Math.min(region.x + 440, end);
  const segments = Math.max(1, Math.ceil((right - left) / 4));
  if (right < left) return '';
  return Array.from({ length: segments + 1 }, (_, i) => {
    const x = left + ((right - left) * i) / segments;
    return `${i ? 'L' : 'M'}${x.toFixed(2)} ${riverCourse(region, x).toFixed(2)}`;
  }).join(' ');
}
export function regionSites(index: number): MapPosition[] {
  const r = mapRegions[Math.max(0, Math.min(mapRegions.length - 1, index))];
  const x = anchorX(r.z);
  return [
    { x: x - 240, z: r.z },
    { x: x + 240, z: r.z },
    { x: x - 170, z: r.z + 190 },
    { x: x + 180, z: r.z - 190 },
  ];
}
