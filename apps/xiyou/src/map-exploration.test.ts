import { describe, expect, it } from 'vitest';
import {
  fogKey,
  fogSaveKey,
  readFog,
  revealFog,
  saveFog,
  isMapChart,
  mapMarksSaveKey,
  maxMapMarks,
  readMapMarks,
  saveMapMarks,
  mapPointAt,
} from './map-exploration';

describe('spatial exploration independent of region and battle saves', () => {
  it('discovers only the approached surroundings, persists and supports negative coordinates', () => {
    const data = new Map<string, string>([
      ['cfgcn:save:xiyou:v1', 'battle'],
      ['cfgcn:map:xiyou:v1', 'position'],
    ]);
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
    };
    const fog = readFog(storage);
    expect(revealFog(fog, { x: 0, z: 0 })).toBe(true);
    expect(fog.has(fogKey(-20, -20))).toBe(true);
    expect(fog.has(fogKey(250, 0))).toBe(false);
    expect(revealFog(fog, { x: 0, z: 0 })).toBe(false);
    expect(saveFog(storage, fog)).toBe(true);
    expect(readFog(storage)).toEqual(fog);
    revealFog(fog, { x: 300, z: 0 });
    expect(fog.has(fogKey(150, 0))).toBe(false);
    expect(data.get('cfgcn:save:xiyou:v1')).toBe('battle');
    expect(data.get('cfgcn:map:xiyou:v1')).toBe('position');
  });
  it('handles unavailable / invalid storage and rejects malformed chart messages', () => {
    for (const value of [
      '{',
      'null',
      '{}',
      JSON.stringify({ version: 1, cells: ['0:0', 'broken', null] }),
    ]) {
      const fog = readFog({ getItem: () => value });
      expect([...fog].every((s) => s === '0:0')).toBe(true);
    }
    expect(readFog(undefined).size).toBe(0);
    expect(saveFog(undefined, new Set())).toBe(false);
    expect(
      saveFog(
        {
          setItem: () => {
            throw Error('denied');
          },
        },
        new Set(),
      ),
    ).toBe(false);
    expect(isMapChart(null)).toBe(false);
    expect(isMapChart({ x: 0, z: 0, span: 256, size: 65, terrain: [], props: [] })).toBe(false);
    expect(fogSaveKey).not.toBe('cfgcn:map:xiyou:v1');
  });
});

describe('personal map marks', () => {
  it('round-trips negative / distant positions independently of exploration and battle', () => {
    const data = new Map([
      [fogSaveKey, 'exploration'],
      ['cfgcn:map:xiyou:v1', 'position'],
      ['cfgcn:save:xiyou:v1', 'battle'],
    ]);
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
    };
    const marks = [
      { id: 'old-place', pos: { x: -128.375, z: 13980.5 } },
      { id: 'new-place', pos: { x: 64, z: -80 } },
    ];
    expect(saveMapMarks(storage, marks)).toBe(true);
    expect(readMapMarks(storage)).toEqual(marks);
    expect(saveMapMarks(storage, marks.slice(1))).toBe(true);
    expect(readMapMarks(storage)).toEqual(marks.slice(1));
    expect(data.get(fogSaveKey)).toBe('exploration');
    expect(data.get('cfgcn:map:xiyou:v1')).toBe('position');
    expect(data.get('cfgcn:save:xiyou:v1')).toBe('battle');
  });
  it('rejects malformed, duplicate and unbounded input while keeping valid marks', () => {
    const good = { id: 'one', pos: { x: -12, z: 3200 } };
    const read = (v: unknown) => readMapMarks({ getItem: () => JSON.stringify(v) });
    expect(
      read({
        version: 1,
        marks: [
          good,
          good,
          null,
          { id: '<bad>', pos: good.pos },
          { id: 'far', pos: { x: 1e6, z: 0 } },
        ],
      }),
    ).toEqual([good]);
    expect(read({ version: 2, marks: [good] })).toEqual([]);
    expect(
      read({ version: 1, marks: Array.from({ length: maxMapMarks + 1 }, () => good) }),
    ).toEqual([]);
    expect(readMapMarks({ getItem: () => '{' })).toEqual([]);
    expect(readMapMarks(null)).toEqual([]);
    expect(saveMapMarks(null, [])).toBe(false);
    expect(
      saveMapMarks(
        {
          setItem: () => {
            throw Error('quota');
          },
        },
        [good],
      ),
    ).toBe(false);
    expect(
      saveMapMarks(
        {
          setItem: () => {
            throw Error('must not write');
          },
        },
        [{ ...good, pos: { x: NaN, z: 0 } }],
      ),
    ).toBe(false);
    expect(mapMarksSaveKey).not.toBe(fogSaveKey);
  });
  it('places map coordinates under the pointer in both portrait and landscape, with matching camera axes', () => {
    const center = { x: -40, z: 3200 };
    for (const [width, height] of [
      [340, 560],
      [1392, 650],
      [760, 180],
    ]) {
      expect(mapPointAt(width / 2, height / 2, width, height, center, 320)).toEqual(center);
      const p = mapPointAt(width / 2 + 50, height / 2 - 25, width, height, center, 320);
      expect(p.x).toBeCloseTo(center.x - (50 * 320) / Math.max(width, height));
      expect(p.z).toBeCloseTo(center.z + (25 * 320) / Math.max(width, height));
    }
  });
});
