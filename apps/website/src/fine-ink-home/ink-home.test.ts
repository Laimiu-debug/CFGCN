import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import * as THREE from 'three';
import { inkActorScale, inkBoats, inkWalkers, inkJourney, sampleInkRoute } from './fine-ink-life';
import { inkPaintDepth, inkZoomLimit } from './ink-surface';
import { inkGroundDepth, inkImagePoint, inkLayerDepth, type DepthLayer } from './ink-depth';

describe('accepted ink homepage', () => {
  const bank: DepthLayer = {
    id: 'river-bank-paint',
    kind: 'bank',
    amplitude: 180,
    bounds: [1000, 800, 700, 500],
    image: '',
  };
  const bridge: DepthLayer = {
    id: 'bridge',
    kind: 'bridge',
    amplitude: 320,
    bounds: [1100, 700, 200, 600],
    image: '',
  };
  it('hulls follow the water painted in a raised cutout, below bridge fronts', () => {
    const x = 1200,
      y = 880;
    const painted = inkLayerDepth(bank, x, y);
    expect(inkPaintDepth([bank, bridge], x, y, () => true, true)).toBe(painted);
    expect(inkPaintDepth([bank, bridge], x, y, () => true)).toBeGreaterThan(painted);
  });
  it.each([-105, 105])('keeps the hull on the painted channel at camera orbit %s', (orbit) => {
    const x = 1300,
      y = 900,
      z = inkPaintDepth([bank], x, y, () => true, true);
    const camera = new THREE.PerspectiveCamera(
      THREE.MathUtils.radToDeg(2 * Math.atan(1320 / 5200)),
      1.6,
      4,
      10000,
    );
    camera.position.set(orbit, 20, 2600);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const project = (depth: number) =>
      new THREE.Vector3(...inkImagePoint(x, y, depth)).project(camera);
    const anchor = project(z),
      hull = project(z + 0.75),
      oldHull = project(inkGroundDepth(y) + 14);
    expect(anchor.distanceTo(hull) * 640).toBeLessThan(0.05);
    expect(anchor.distanceTo(oldHull) * 640).toBeGreaterThan(1);
  });
  it('does not attach an actor to transparent parts of a layer', () => {
    expect(inkPaintDepth([bank], 1200, 900, () => false)).toBe(inkGroundDepth(900));
  });
  it('limits zoom to available source pixels at desktop and phone sizes', () => {
    for (const size of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
      { width: 320, height: 760 },
    ]) {
      const limit = inkZoomLimit(size),
        extent = Math.min(1501, 2400 / (size.width / size.height)) * 0.88;
      expect(limit).toBeLessThanOrEqual(1.6);
      expect(limit * (size.height / extent) * (2400 / 1586)).toBeLessThan(1.36);
    }
    expect(inkZoomLimit({ width: 2560, height: 1440 })).toBe(1.35);
  });
  it('keeps each entire boat hull inside the prepared channel through a full journey', async () => {
    const nav = JSON.parse(
      await readFile('apps/website/art/fine-ink/navigation-manifest.json', 'utf8'),
    );
    const { data, info } = await sharp(nav.waterMask)
      .extractChannel('alpha')
      .median(3)
      .threshold(150)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const portalAt = (x: number, y: number) =>
      nav.bridgeOpenings.some(([a, b]: number[][]) => {
        const dx = b[0] - a[0],
          dy = b[1] - a[1],
          t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
        return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < 15;
      });
    const wet = (x: number, y: number) =>
      data[Math.round(y) * info.width + Math.round(x)] > 150 || portalAt(x, y);
    for (const boat of inkBoats) {
      // Painter's largest hull tip stays inside the authored nine-pixel margin.
      expect((29 * boat.size * inkActorScale.boat) / (2400 / 1586)).toBeLessThanOrEqual(9);
      for (let i = 0; i <= 600; i++) {
        const at = sampleInkRoute(boat.route, i / 600),
          x = at.x / (2400 / 1586),
          y = at.y / (2400 / 1586);
        for (const [dx, dy] of nav.hullFootprint)
          expect(wet(x + dx, y + dy), boat.id + ' at ' + [x, y]).toBe(true);
      }
      const travel = boat.route.length / boat.speed,
        cycle = 2 * (travel + boat.dwell);
      const before = inkJourney(boat.route, cycle - 0.001, boat.speed, boat.dwell),
        after = inkJourney(boat.route, cycle + 0.001, boat.speed, boat.dwell);
      expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(0.1);
    }
  });
  it('keeps walkers continuous at every turn, stop and reversal on the shorter authored paths', () => {
    for (const actor of inkWalkers) {
      const cycle = 2 * (actor.route.length / actor.speed + actor.dwell);
      let before = inkJourney(actor.route, 0, actor.speed, actor.dwell, actor.phase);
      for (let t = 0.2; t < cycle * 2; t += 0.2) {
        const after = inkJourney(actor.route, t, actor.speed, actor.dwell, actor.phase);
        expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThanOrEqual(
          actor.speed * 0.2 + 0.001,
        );
        before = after;
      }
    }
  });
});
