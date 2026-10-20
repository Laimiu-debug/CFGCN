import { describe, expect, it } from 'vitest';
import { atlasPlace, atlasPoint, atlasRegion, geometry } from './atlas';

describe('story atlas geography', () => {
  it('registers the vector and raster bounds without rotating north', () => {
    expect(atlasPoint(geometry.west, geometry.north)).toEqual([0, 0]);
    expect(atlasPoint(geometry.east, geometry.south)).toEqual([geometry.width, geometry.height]);
  });
  it('keeps Hanzhong southwest of Chang’an, Liangshan northeast, and Jinling southeast of Liangshan', () => {
    const changan = atlasPlace('xiyou');
    const hanzhong = atlasPlace('sanguo');
    const liangshan = atlasPlace('shuihu');
    const jinling = atlasPlace('honglou');
    expect(hanzhong.x).toBeLessThan(changan.x);
    expect(hanzhong.y).toBeGreaterThan(changan.y);
    expect(liangshan.x).toBeGreaterThan(changan.x);
    expect(liangshan.y).toBeLessThan(changan.y);
    expect(jinling.x).toBeGreaterThan(liangshan.x);
    expect(jinling.y).toBeGreaterThan(liangshan.y);
    expect(jinling.y).toBeGreaterThan(hanzhong.y);
  });
  it('keeps the adjacent western gateways distinct and assigns eastern scenery by geography', () => {
    expect(atlasRegion(109, 34.8)).toBe('xiyou');
    expect(atlasRegion(107, 32.8)).toBe('sanguo');
    expect(atlasRegion(116, 36)).toBe('shuihu');
    expect(atlasRegion(119, 31.8)).toBe('honglou');
  });
});
