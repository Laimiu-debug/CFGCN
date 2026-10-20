import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  createInkTerrainField,
  inkHeightDepth,
  inkImagePoint,
  inkLayerDepth,
  inkReferenceProjection,
  inkTerrainHeight,
  inkWaterDepth,
  inkWorldElevation,
  type DepthLayer,
} from './ink-depth';

const mountain = (bounds: DepthLayer['bounds']): DepthLayer => ({
  id: 'range',
  kind: 'mountain',
  amplitude: 300,
  bounds,
  image: '',
});
describe('painted terrain reconstructed in perspective', () => {
  it('keeps the original composition at the reference camera at every depth', () => {
    for (const [x, y, z] of [
      [36, 54, -1250],
      [1280, 700, -200],
      [2190, 1350, 490],
    ]) {
      const p = inkReferenceProjection(inkImagePoint(x, y, z));
      expect(p[0]).toBeCloseTo(x, 8);
      expect(p[1]).toBeCloseTo(y, 8);
    }
  });
  it('keeps adjoining range masks on the same surface when their rectangles differ', () => {
    const a = mountain([0, 400, 900, 500]),
      b = mountain([500, 500, 900, 800]);
    for (const [x, y] of [
      [550, 550],
      [700, 800],
      [895, 895],
    ])
      expect(inkLayerDepth(a, x, y)).toBeCloseTo(inkLayerDepth(b, x, y), 8);
  });
  it('has a world-up elevation and a level river, instead of image-row bulges', () => {
    for (const y of [70, 400, 750, 1100, 1480]) {
      expect(inkWorldElevation(inkImagePoint(900, y, inkWaterDepth(y)))).toBeCloseTo(0, 8);
      for (const height of [25, 250, 700]) {
        const point = inkImagePoint(600, y, inkHeightDepth(y, height));
        expect(inkWorldElevation(point)).toBeCloseTo(height, 8);
        expect(inkReferenceProjection(point)[1]).toBeCloseTo(y, 8);
      }
    }
  });
  it('connects a high Qinling crest through a shoulder into a habitable basin', () => {
    const height = (x: number, y: number) => inkTerrainHeight((x * 2400) / 1586, (y * 1501) / 992);
    const crest = height(493, 477),
      shoulder = height(499, 453),
      foot = height(505, 413);
    expect(crest).toBeGreaterThan(440);
    expect(shoulder).toBeGreaterThan(foot + 65);
    expect(crest).toBeGreaterThan(shoulder + 65);
    expect(height(577, 339)).toBeLessThan(40);
    expect(height(350, 681)).toBeLessThan(40);
    // The connecting saddle remains elevated, rather than isolated placed rocks.
    expect(height(570, 519)).toBeGreaterThan(210);
  });
  it('preserves mountain and basin heights when the shared mesh grid is cached', () => {
    const terrain = createInkTerrainField();
    for (const [sx, sy] of [
      [493, 477],
      [570, 519],
      [577, 339],
      [350, 681],
    ]) {
      const x = (sx * 2400) / 1586,
        y = (sy * 1501) / 992;
      expect(Math.abs(terrain.height(x, y) - inkTerrainHeight(x, y))).toBeLessThan(35);
    }
    expect(
      Math.abs(terrain.height(1080 - 0.0001, 810) - terrain.height(1080 + 0.0001, 810)),
    ).toBeLessThan(0.01);
    expect(terrain.height((577 * 2400) / 1586, (339 * 1501) / 992)).toBeLessThan(40);
  });
  it('keeps front walls joined to their town while allowing arch cutouts', () => {
    const city: DepthLayer = {
      id: 'city',
      kind: 'city',
      town: 'xiyou',
      amplitude: 38,
      bounds: [400, 300, 900, 400],
      image: '',
    };
    const wall: DepthLayer = {
      ...city,
      id: 'wall',
      kind: 'facade',
      amplitude: 100,
      bounds: [450, 500, 850, 200],
    };
    expect(inkLayerDepth(wall, 930, 620)).toBe(inkLayerDepth(city, 930, 620));
  });
  it('moves near and far scenery differently without changing camera zoom', () => {
    const camera = new PerspectiveCamera(32, 1.6, 4, 10000);
    const shift = (z: number) => {
      const positions = [-200, 200].map((x) => {
        camera.position.set(x, 0, 2600);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        return new Vector3(...inkImagePoint(1200, 750.5, z)).project(camera).x;
      });
      return positions[1] - positions[0];
    };
    expect(shift(-1100)).toBeGreaterThan(0.07);
    expect(shift(350)).toBeLessThan(-0.03);
    expect(camera.zoom).toBe(1);
  });
});
