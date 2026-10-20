import { describe, it, expect } from 'vitest';
import { readTrialLoadouts, shadowActors } from './ShadowTrial';
import book from '../art/shadow-actions-v3/skills.json';
describe('five-person trial equipment compatibility', () => {
  it('restores the same owner skill identities used by the resource workbench', () => {
    const value = readTrialLoadouts({ version: 1, loadouts: book.defaults });
    expect(value).toHaveLength(5);
    for (const list of value) {
      expect(list).toHaveLength(4);
      expect(new Set(list).size).toBe(4);
      expect(list.every((i) => i >= 0 && i < 12)).toBe(true);
    }
  });
  it('repairs only the corrupted actor while preserving the other four choices', () => {
    const loadouts = { ...book.defaults, wukong: ['tangseng.Chant', 'tangseng.Chant'] };
    const result = readTrialLoadouts({ version: 1, loadouts });
    expect(result).toEqual(readTrialLoadouts({ version: 1, loadouts: book.defaults }));
    expect(shadowActors).toHaveLength(5);
    expect(readTrialLoadouts({ version: 999, loadouts })).toEqual(readTrialLoadouts(null));
  });
});
