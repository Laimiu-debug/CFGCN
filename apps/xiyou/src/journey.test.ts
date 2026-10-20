import { describe, expect, it } from 'vitest';
import { isJourneyCheckpoint } from './journey';

const cp = { version: 1, chapter: 1, level: 4, xp: 2, monk: [1, 1, 1, 0], wukong: [0, 0, 0, 0] };
describe('journey checkpoint', () => {
  it('migrates legacy chapters and validates ordered one-shot world events', () => {
    expect(isJourneyCheckpoint({ ...cp, chapter: 2, events: 1, camp: 0, leader: 1 })).toBe(true);
    expect(
      isJourneyCheckpoint({
        ...cp,
        chapter: 3,
        events: 31,
        camp: 3,
        dragon_joined: true,
        leader: 2,
      }),
    ).toBe(true);
    for (const events of [2, 4, 8, 16, 32, -1, 1.5])
      expect(isJourneyCheckpoint({ ...cp, chapter: 3, events, camp: 0 })).toBe(false);
    expect(isJourneyCheckpoint({ ...cp, chapter: 3, events: 3, camp: 4 })).toBe(false);
  });
  it('accepts region progress and a completed first region', () => {
    expect(isJourneyCheckpoint(cp)).toBe(true);
    expect(isJourneyCheckpoint({ ...cp, chapter: 3 })).toBe(true);
  });
  it('rejects malformed, out-of-range and impossible character progress', () => {
    for (const bad of [
      null,
      {},
      { ...cp, version: 2 },
      { ...cp, chapter: 5 },
      { ...cp, level: 0 },
      { ...cp, xp: 99 },
      { ...cp, xp: -1 },
      { ...cp, monk: [6, 0, 0, 0] },
      { ...cp, monk: [0] },
      { ...cp, wukong: [1, 0, 0, 0] },
      { ...cp, monk: [2, 2, 2, 2] },
      { ...cp, level: Infinity },
    ]) {
      expect(isJourneyCheckpoint(bad)).toBe(false);
    }
  });
  it('continues old completed routes and validates dragon recruitment and leader selection', () => {
    expect(isJourneyCheckpoint({ ...cp, chapter: 3 })).toBe(true);
    expect(
      isJourneyCheckpoint({
        ...cp,
        chapter: 3,
        dragon: [0, 0, 0, 0],
        dragon_joined: true,
        leader: 2,
      }),
    ).toBe(true);
    expect(isJourneyCheckpoint({ ...cp, leader: 2 })).toBe(false);
    expect(isJourneyCheckpoint({ ...cp, chapter: 3, dragon: [1, 0, 0, 0] })).toBe(false);
    expect(isJourneyCheckpoint({ ...cp, dragon_joined: true })).toBe(false);
    expect(isJourneyCheckpoint({ ...cp, chapter: 3, dragon_joined: 'yes' })).toBe(false);
    expect(isJourneyCheckpoint({ ...cp, chapter: 4, dragon_joined: true, leader: 2 })).toBe(true);
  });
});
