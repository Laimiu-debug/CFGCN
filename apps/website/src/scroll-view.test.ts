import { describe, it, expect } from 'vitest';
import {
  constrainScrollView,
  scrollFootprint,
  scrollViewBounds,
  scrollHomeView,
  scrollFov,
  scrollElevation,
} from './scroll-view';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  scrollLayout,
  terrainHeight,
  waterDistance,
  distanceToPath,
  scrollRoads,
  scrollRivers,
  scrollRanges,
} from './scroll-terrain';
import { settlementPlan } from './scroll-settlements';

describe('approved ink composition in the real camera', () => {
  it('keeps every ground-plane corner inside the authored world at portrait, wide, zoom and drag extremes', () => {
    for (const aspect of [320 / 760, 390 / 844, 996 / 1244, 1280 / 800, 1440 / 900, 2560 / 1080, 4])
      for (const span of [30, 70, 155, 220, 350, 900])
        for (const x of [-999, 0, 999])
          for (const z of [-999, 0, 999]) {
            const view = constrainScrollView(aspect, span, x, z);
            for (const point of scrollFootprint(aspect)) {
              const px = view.x + point.x * view.distance,
                pz = view.z + point.z * view.distance;
              expect(px).toBeGreaterThanOrEqual(scrollViewBounds.left - 1e-7);
              expect(px).toBeLessThanOrEqual(scrollViewBounds.right + 1e-7);
              expect(pz).toBeGreaterThanOrEqual(scrollViewBounds.north - 1e-7);
              expect(pz).toBeLessThanOrEqual(scrollViewBounds.south + 1e-7);
            }
          }
  });
  it('preserves four geographic directions and keeps the landmarks dry, with Qinling between Chang’an and Hanzhong', () => {
    const { xiyou, sanguo, shuihu, honglou } = scrollLayout.places;
    expect(sanguo.x).toBeLessThan(xiyou.x);
    expect(sanguo.z).toBeGreaterThan(xiyou.z);
    expect(shuihu.x).toBeGreaterThan(xiyou.x);
    expect(shuihu.z).toBeLessThan(xiyou.z);
    expect(honglou.x).toBeGreaterThan(xiyou.x);
    expect(honglou.z).toBeGreaterThan(xiyou.z);
    for (const p of Object.values(scrollLayout.places)) {
      expect(waterDistance(p.x, p.z)).toBeGreaterThan(0);
      expect(terrainHeight(p.x, p.z)).toBeCloseTo(0.65, 3);
    }
    const north = scrollRanges
      .find((r) => r.id === 'qinling')!
      .samples.filter((p) => p[0] > sanguo.x - 75 && p[0] < sanguo.x + 65);
    const south = scrollRanges
      .find((r) => r.id === 'daba')!
      .samples.filter((p) => p[0] > sanguo.x - 75 && p[0] < sanguo.x + 90);
    expect(Math.max(...north.map((p) => terrainHeight(p[0], p[1])))).toBeGreaterThan(25);
    expect(Math.max(...south.map((p) => terrainHeight(p[0], p[1])))).toBeGreaterThan(25);
    expect(terrainHeight(90, 20)).toBeLessThan(2);
  });
  it('leaves landscape between cities without enlarging their building footprints', () => {
    const places = Object.values(scrollLayout.places);
    for (let i = 0; i < places.length; i++)
      for (let j = i + 1; j < places.length; j++) {
        const a = places[i],
          b = places[j];
        const clearance =
          Math.hypot(a.x - b.x, a.z - b.z) -
          Math.hypot(a.width, a.depth) / 2 -
          Math.hypot(b.width, b.depth) / 2;
        expect(clearance).toBeGreaterThan(80);
      }
    expect(scrollLayout.places.xiyou.width).toBe(76);
    const plan = settlementPlan();
    for (const [id, town] of Object.entries(scrollLayout.places)) {
      const buildings = plan.buildings.filter((b) => b.origin === id);
      expect(buildings.length).toBeGreaterThan(5);
      for (const b of buildings) {
        expect(Math.abs(b.x - town.x)).toBeLessThan(town.width * 0.85);
        expect(Math.abs(b.z - town.z)).toBeLessThan(town.depth * 0.8);
        if (b.kind === 'house' || b.kind === 'shop' || b.kind === 'hall')
          expect(waterDistance(b.x, b.z)).toBeGreaterThan(1.5);
      }
    }
  });
  it('places Wei north of Chang’an, Han south of Hanzhong and Yangtze north of Jinling', () => {
    const riverAt = (id: string, x: number) => {
      const river = scrollLayout.rivers.find((r) => r.id === id)!;
      for (let i = 1; i < river.points.length; i++) {
        const a = river.points[i - 1],
          b = river.points[i];
        if (a[0] <= x && b[0] >= x) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
      }
      throw new Error('River does not reach the city longitude');
    };
    const { xiyou, sanguo, honglou } = scrollLayout.places;
    expect(riverAt('weishui', xiyou.x)).toBeLessThan(xiyou.z - xiyou.depth / 2);
    expect(riverAt('hanshui', sanguo.x)).toBeGreaterThan(sanguo.z + sanguo.depth / 2);
    expect(riverAt('changjiang', honglou.x)).toBeLessThan(honglou.z - honglou.depth / 2 - 6);
    const pass = scrollLayout.passes[0];
    expect(distanceToPath(pass.x, pass.z, scrollRoads[1].samples)).toBeLessThan(pass.radius / 2);
    expect(terrainHeight(pass.x, pass.z)).toBeLessThan(5);
  });
  it('frames all four city footprints in the default desktop view', () => {
    for (const aspect of [1280 / 800, 1440 / 900, 1920 / 1080]) {
      const initial = scrollHomeView(aspect),
        view = constrainScrollView(aspect, initial.span, initial.x, initial.z);
      const camera = new PerspectiveCamera(scrollFov, aspect, 2, 1800);
      camera.position.set(
        view.x,
        view.distance * scrollElevation,
        view.z + view.distance * Math.sqrt(1 - scrollElevation ** 2),
      );
      camera.lookAt(view.x, 0, view.z);
      camera.updateMatrixWorld(true);
      for (const city of Object.values(scrollLayout.places))
        for (const dx of [-0.5, 0.5])
          for (const dz of [-0.5, 0.5]) {
            const point = new Vector3(
              city.x + city.width * dx,
              1,
              city.z + city.depth * dz,
            ).project(camera);
            expect(Math.abs(point.x)).toBeLessThan(1);
            expect(Math.abs(point.y)).toBeLessThan(0.82);
          }
    }
  });
  it('breaks high crests with low saddles and gives cultivated lowlands real relief', () => {
    const ridge = scrollRanges.find((r) => r.id === 'qinling-east')!;
    const heights = ridge.samples.map((p) => terrainHeight(p[0], p[1]));
    expect(Math.max(...heights)).toBeGreaterThan(35);
    expect(Math.min(...heights)).toBeLessThan(8);
    expect(heights.filter((h) => h < 12).length / heights.length).toBeGreaterThan(0.2);
    const hills = [];
    for (let x = 70; x <= 180; x += 5)
      for (let z = 10; z <= 80; z += 5)
        if (waterDistance(x, z) > 4) hills.push(terrainHeight(x, z));
    expect(Math.max(...hills) - Math.min(...hills)).toBeGreaterThan(6);
    expect(Math.max(...hills)).toBeLessThan(18);
  });
  it('carves continuous tributaries even through raised land and joins their parent rivers', () => {
    for (const [id, parent] of [
      ['qinling-rill', 'hanshui'],
      ['valley-rill', 'hanshui'],
      ['east-fields-rill', 'changjiang'],
    ]) {
      const r = scrollRivers.find((r) => r.id === id)!,
        target = scrollRivers.find((r) => r.id === parent)!;
      for (const [x, z] of r.samples) expect(terrainHeight(x, z)).toBeLessThan(0.025);
      const end = r.samples.at(-1)!;
      expect(distanceToPath(end[0], end[1], target.samples)).toBeLessThan(target.width);
    }
  });
  it('grounds the individual village lots while keeping ordinary homes out of water', () => {
    const plan = settlementPlan();
    for (const site of scrollLayout.villages) {
      const lots = plan.buildings.filter((b) => b.site === site.id);
      expect(lots.length, site.id).toBeGreaterThanOrEqual(2);
      for (const b of lots) {
        if (b.kind === 'house' || b.kind === 'shop')
          expect(waterDistance(b.x, b.z), site.id).toBeGreaterThan(1.3);
        const ground = terrainHeight(b.x, b.z);
        expect(b.base!, site.id).toBeGreaterThanOrEqual(ground - 0.15);
        expect(b.base! - Math.max(0, ground), site.id).toBeLessThan(1.6);
      }
    }
  });
});
