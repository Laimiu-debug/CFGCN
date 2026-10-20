import { describe, expect, it } from 'vitest';
import { stickVector } from './touch-input';

describe('touch movement', () => {
  it('keeps small finger drift still and rejects invalid coordinates', () => {
    expect(stickVector(3, 2)).toEqual({ x: 0, z: 0 });
    expect(stickVector(Number.NaN, 0)).toEqual({ x: 0, z: 0 });
  });
  it('uses the same screen directions as keyboard movement', () => {
    expect(stickVector(36, 0).x).toBe(1);
    expect(stickVector(0, -36).z).toBe(1);
    expect(stickVector(-36, 0).x).toBe(-1);
  });
  it('preserves analogue speed and limits diagonals and long drags', () => {
    expect(stickVector(18, 0).x).toBeGreaterThan(0);
    expect(stickVector(18, 0).x).toBeLessThan(1);
    const diagonal = stickVector(360, -360);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1);
  });
});
