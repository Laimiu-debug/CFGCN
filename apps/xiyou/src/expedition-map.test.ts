import { describe, expect, it } from 'vitest';
import {
  expeditionSaveKey,
  mapRegions,
  readMapSave,
  riverCourse,
  riverLine,
  anchorX,
  saveMap,
} from './expedition-map';

describe('westward map data and separate survey save', () => {
  it('shows the authored river bend instead of the old offset stripe', () => {
    const r = mapRegions[3];
    // Reference points from the shared river layout, in world metres.
    expect(riverCourse(r, r.x)).toBeCloseTo(1954.152068, 4);
    expect(riverLine(r, r.x, r.x + 4)).toBe('M-60.00 1954.15 L-56.00 1957.06');
    expect(riverLine(r, r.x + 500, r.x + 600)).toBe('');
    expect(riverLine(r, r.x - 500, r.x + 500).startsWith('M-500.00 ')).toBe(true);
  });
  it('covers the selected westward route in order and keeps the first party milestones', () => {
    expect(mapRegions).toHaveLength(32);
    expect(mapRegions[0].id).toBe('changan');
    expect(mapRegions.at(-1)?.id).toBe('lingshan');
    expect(mapRegions.slice(2, 8).map((r) => r.id)).toEqual([
      'wuxing',
      'yingchou',
      'heifeng',
      'gaolao',
      'huangfeng',
      'liusha',
    ]);
    expect(new Set(mapRegions.map((r) => r.id)).size).toBe(32);
    expect(
      mapRegions.every((r, i) => r.names.length === 3 && (!i || r.z > mapRegions[i - 1].z)),
    ).toBe(true);
    expect(mapRegions.at(-1)!.z).toBeGreaterThan(19000);
  });
  it('keeps stable layout anchors and saves beyond both ends of the world', () => {
    for (const z of [-1000, 0, 108, 1280, 19840, 25000]) {
      expect(Number.isFinite(anchorX(z))).toBe(true);
      expect(Math.abs(anchorX(z + 0.01) - anchorX(z))).toBeLessThan(0.02);
    }
  });
  it('rejects broken survey saves and preserves the independent combat journal', () => {
    const data = new Map([['cfgcn:save:xiyou:v1', 'existing battle save']]);
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    const state = {
      version: 1 as const,
      region: 31,
      pos: { x: 150, z: 19840 },
      visited: 0xffffffff,
      distance: 500,
    };
    expect(saveMap(storage, state)).toBe(true);
    expect(readMapSave(storage)).toEqual({ version: 1, pos: state.pos, visited: 0xffffffff });
    expect(data.get('cfgcn:save:xiyou:v1')).toBe('existing battle save');
    for (const broken of [
      '{}',
      '{',
      'null',
      JSON.stringify({ version: 1, pos: { x: 0, z: 1e8 }, visited: 0 }),
      JSON.stringify({ version: 1, pos: { x: 0, z: 0 }, visited: -1 }),
    ]) {
      storage.setItem(expeditionSaveKey, broken);
      expect(readMapSave(storage)).toBeNull();
    }
    expect(readMapSave(undefined)).toBeNull();
    expect(saveMap(undefined, state)).toBe(false);
  });
});
