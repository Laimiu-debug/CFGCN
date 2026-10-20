import { describe, expect, it } from 'vitest';
import { paperCardPoint, paperLimitView, paperMap, paperPoint, paperWorld } from './paper-stage';

describe('paper stage spatial construction', () => {
  it('keeps world position independent from the camera and object height', () => {
    const a = paperPoint(899, 543, 0);
    const b = paperPoint(899, 543, 180);
    expect(a[0]).toBe(b[0]);
    expect(a[2]).toBe(b[2]);
    expect(paperMap(b)).toEqual({ x: 899, y: 543 });
  });
  it('anchors every upright or folded surface at the ground without a rectangular plinth', () => {
    for (const lift of [0.2, 0.7, 1])
      expect(paperCardPoint(620, 900, 900, 24, lift)).toEqual(paperPoint(620, 900, 24));
  });
  it('a vertical card has actual elevation with a fixed footprint', () => {
    const foot = paperCardPoint(600, 800, 800, 20, 1);
    const crest = paperCardPoint(600, 520, 800, 20, 1);
    expect(crest[2]).toBe(foot[2]);
    expect(crest[1]).toBeGreaterThan(foot[1] + 280);
    const projectedRise = (crest[1] - foot[1]) * Math.cos(paperWorld.down);
    expect(projectedRise).toBeCloseTo(280);
  });
  it('folded mountains combine a slope footprint and rise, keeping zoom / map bounds finite', () => {
    const foot = paperCardPoint(700, 900, 900, 14, 0.7);
    const crest = paperCardPoint(700, 600, 900, 14, 0.7);
    expect(crest[1]).toBeGreaterThan(foot[1]);
    expect(crest[2]).toBeLessThan(foot[2]);
    for (const aspect of [0.38, 1, 1.8]) {
      const v = paperLimitView(-10000, 10000, 100, aspect);
      expect(v.x).toBeGreaterThan(0);
      expect(v.y).toBeLessThan(1501);
      expect(v.zoom).toBe(2.7);
    }
  });
});
