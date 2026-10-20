import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAtlasRest } from './atlas-rest';

afterEach(() => vi.useRealTimers());
describe('quiet world', () => {
  it('waits for scenery and a full idle interval after the last activity', () => {
    vi.useFakeTimers();
    const changes: boolean[] = [];
    const rest = createAtlasRest((value) => changes.push(value));
    vi.advanceTimersByTime(20000);
    expect(changes).toEqual([]);
    rest.setEnabled(true);
    vi.advanceTimersByTime(7000);
    rest.activity();
    vi.advanceTimersByTime(7000);
    expect(changes).toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(changes).toEqual([true]);
    rest.activity();
    expect(changes).toEqual([true, false]);
    rest.dispose();
  });

  it('keeps keyboard controls and dialogs available until they are released', () => {
    vi.useFakeTimers();
    let blocked = true;
    const change = vi.fn();
    const rest = createAtlasRest(change, () => !blocked);
    rest.setEnabled(true);
    vi.advanceTimersByTime(24000);
    expect(change).not.toHaveBeenCalled();
    blocked = false;
    vi.advanceTimersByTime(8000);
    expect(change).toHaveBeenLastCalledWith(true);
    rest.setEnabled(false);
    vi.advanceTimersByTime(60000);
    expect(change.mock.calls).toEqual([[true], [false]]);
    rest.dispose();
  });

  it('supports deliberate quiet viewing and releases timers on departure', () => {
    vi.useFakeTimers();
    const change = vi.fn();
    const rest = createAtlasRest(change);
    rest.setEnabled(true);
    rest.rest();
    expect(change).toHaveBeenLastCalledWith(true);
    rest.activity();
    rest.dispose();
    vi.advanceTimersByTime(60000);
    expect(change.mock.calls).toEqual([[true], [false]]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('consumes a click whose pointer movement just woke a hidden town', () => {
    vi.useFakeTimers();
    const rest = createAtlasRest(() => {});
    rest.setEnabled(true);
    expect(rest.shouldConsumePointer()).toBe(false);
    rest.rest();
    expect(rest.shouldConsumePointer()).toBe(true);
    rest.activity(); // Moving to a hidden target precedes the pointer down.
    expect(rest.shouldConsumePointer()).toBe(true);
    vi.advanceTimersByTime(400);
    rest.activity(); // Other movement must not restart the grace interval.
    vi.advanceTimersByTime(400);
    expect(rest.shouldConsumePointer()).toBe(false);
    rest.dispose();
  });
});
