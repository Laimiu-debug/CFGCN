import { describe, expect, it } from 'vitest';
import { advanceInkClock, inkJourney, makeInkRoute, sampleInkRoute } from './fine-ink-life';

describe('living ink journeys', () => {
  const route = makeInkRoute('quay-to-quay', [
    [0, 0],
    [50, 0],
    [50, 50],
  ]);
  const speed = 5;
  const travel = route.length / speed;
  const dwell = 8;
  it('waits at both quays and reverses continuously without teleporting', () => {
    const start = inkJourney(route, 0, speed, dwell);
    const waiting = inkJourney(route, dwell - 0.01, speed, dwell);
    expect(waiting.x).toBe(start.x);
    expect(waiting.y).toBe(start.y);
    expect(waiting.moving).toBe(false);
    const beforeArrival = inkJourney(route, dwell + travel - 0.001, speed, dwell);
    const arrived = inkJourney(route, dwell + travel + 0.001, speed, dwell);
    expect(Math.hypot(arrived.x - beforeArrival.x, arrived.y - beforeArrival.y)).toBeLessThan(0.01);
    expect(arrived.moving).toBe(false);
    const leaving = inkJourney(route, dwell * 2 + travel + 1, speed, dwell);
    expect(leaving.moving).toBe(true);
    expect(leaving.direction).toBe(-1);
    expect(leaving.y).toBeLessThan(arrived.y);
  });
  it('travels by distance, including bends, and clamps endpoint sampling', () => {
    const middle = sampleInkRoute(route, 0.5);
    expect(middle.x).toBeCloseTo(route.points[1][0]);
    expect(middle.y).toBeCloseTo(0);
    expect(sampleInkRoute(route, -1).x).toBe(0);
    expect(sampleInkRoute(route, 2).y).toBe(route.points[2][1]);
  });
  it('freezes the ecosystem for reduced motion and avoids a catch-up jump after a hidden tab', () => {
    const clock = 42;
    expect(advanceInkClock(clock, 300_000, false)).toBe(clock);
    const resumed = advanceInkClock(clock, 300_000, true);
    expect(resumed).toBeLessThanOrEqual(clock + 0.08);
    const a = inkJourney(route, clock, speed, dwell);
    const b = inkJourney(route, resumed, speed, dwell);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(speed * 0.081);
  });
  it('slows down continuously at a quay while retaining the timetable and reverse route', () => {
    const ramp = 2;
    const depart = inkJourney(route, dwell, speed, dwell, 0, ramp);
    const nearStart = inkJourney(route, dwell + 0.15, speed, dwell, 0, ramp);
    const cruise = inkJourney(route, dwell + travel / 2, speed, dwell, 0, ramp);
    const nearEnd = inkJourney(route, dwell + travel - 0.15, speed, dwell, 0, ramp);
    const arrived = inkJourney(route, dwell + travel + 0.01, speed, dwell, 0, ramp);
    expect(depart.pace).toBe(0);
    expect(nearStart.pace).toBeLessThan(0.15);
    expect(cruise.pace).toBeGreaterThan(0.99);
    expect(nearEnd.pace).toBeLessThan(0.15);
    expect(arrived.progress).toBe(1);
    expect(arrived.moving).toBe(false);
    const before = inkJourney(route, dwell + travel - 0.001, speed, dwell, 0, ramp);
    expect(Math.hypot(arrived.x - before.x, arrived.y - before.y)).toBeLessThan(0.001);
    const returning = inkJourney(route, dwell * 2 + travel + 0.15, speed, dwell, 0, ramp);
    expect(returning.direction).toBe(-1);
    expect(returning.pace).toBeLessThan(0.15);
    expect(returning.progress).toBeGreaterThan(0.99);
  });
});
