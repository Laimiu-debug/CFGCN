import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  atlasViewBounds,
  atlasViewElevation,
  atlasViewFov,
  atlasViewEasing,
  constrainAtlasView,
} from './atlas-view';

describe('authored atlas camera limits', () => {
  it('finishes the same town pan at slow and fast frame rates', () => {
    const pan = (frames: number) => {
      let position = -28;
      for (let i = 0; i < frames; i++) position += (70 - position) * atlasViewEasing(1 / frames);
      return position;
    };
    expect(pan(5)).toBeCloseTo(pan(60), 8);
    expect(pan(5)).toBeGreaterThan(69.8);
    expect(atlasViewEasing(0)).toBe(0);
  });
  it.each([320 / 844, 390 / 844, 1, 1280 / 800, 2560 / 1080])(
    'keeps actual perspective ground intersections in authored scenery at aspect %s',
    (aspect) => {
      for (const zoom of [0.01, 0.48, 0.8, 1, 12])
        for (const requested of [-10000, 0, 10000]) {
          const view = constrainAtlasView(aspect, zoom, requested, -requested);
          const camera = new THREE.PerspectiveCamera(atlasViewFov, aspect, 0.1, 1000);
          camera.position.set(
            view.x,
            view.distance * atlasViewElevation.y,
            view.z + view.distance * atlasViewElevation.z,
          );
          camera.lookAt(view.x, 0, view.z);
          camera.updateMatrixWorld();
          const ray = new THREE.Raycaster();
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
          for (const x of [-1, 1])
            for (const y of [-1, 1]) {
              ray.setFromCamera(new THREE.Vector2(x, y), camera);
              const hit = ray.ray.intersectPlane(plane, new THREE.Vector3())!;
              expect(hit.x).toBeGreaterThanOrEqual(atlasViewBounds.left - 0.0001);
              expect(hit.x).toBeLessThanOrEqual(atlasViewBounds.right + 0.0001);
              expect(hit.z).toBeGreaterThanOrEqual(atlasViewBounds.north - 0.0001);
              expect(hit.z).toBeLessThanOrEqual(atlasViewBounds.south + 0.0001);
            }
        }
    },
  );
});
