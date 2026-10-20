import { describe, expect, it } from 'vitest';
import { createAtlasClock } from './atlas-clock';

describe('living world time', () => {
  it('keeps clouds and water moving at wall speed on a slow renderer without skipping the arrival', () => {
    const clock = createAtlasClock();
    clock.advance(1000, false, true);
    const frame = clock.advance(2000, false, true);
    expect(frame.environment).toBe(1);
    expect(frame.scene).toBe(1);
  });

  it('starts the arrival on its first painted frame after a long model download', () => {
    const clock = createAtlasClock();
    clock.advance(0, false, false);
    expect(clock.advance(60000, false, true).scene).toBe(0);
    expect(clock.advance(61000, false, true).scene).toBe(1);
  });

  it('does not fast forward after returning from a hidden page', () => {
    const clock = createAtlasClock();
    clock.advance(1000, false, true);
    clock.advance(2000, false, true);
    clock.reset();
    expect(clock.advance(62000, false, true).environment).toBe(1);
    expect(clock.advance(63000, false, true).environment).toBe(2);
  });

  it('freezes reduced motion while allowing the entrance to finish and resumes without a jump', () => {
    const clock = createAtlasClock();
    clock.advance(0, false, false);
    clock.advance(1000, true, true);
    expect(clock.advance(2000, true, true)).toEqual({ environment: 0, scene: 1 });
    expect(clock.advance(2100, false, true).environment).toBeCloseTo(0.1);
  });
});
