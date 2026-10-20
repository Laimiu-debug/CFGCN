import { describe, expect, it } from 'vitest';
import { GameAudioDirector, environmentAt } from './audio-state';
import { mapRegions, riverCourse } from '../../xiyou/src/expedition-map';

const legacy = (extra = {}) => ({
  ready: true,
  phase: 'playing',
  elapsed: 1,
  hp: 100,
  xp: 0,
  level: 1,
  kills: 0,
  freeze_cd: 0,
  clone_cd: 0,
  boss_hp: null,
  hero: { x: 0, z: 0 },
  ...extra,
});
const trial = (extra = {}) => ({
  trial: {
    heroes: Array.from({ length: 5 }, () => ({
      hp: 100,
      shield: 0,
      pos: { x: 0, z: 0 },
      loadout: [0, 1, 2, 3],
      cast: null,
      dodge: null,
    })),
    leader: 1,
    elapsed: 1,
    paused: false,
    kills: 0,
    releases: 0,
    blocked: 0,
    enemies: [{ id: 10, hp: 100 }],
    ...extra,
  },
});

describe('audio follows the simulation', () => {
  it('selects menu, exploration, pause and battle from actual modes', () => {
    const d = new GameAudioDirector();
    expect(d.accept('cfgcn:xiyou:state', legacy({ phase: 'menu' }))?.scene).toBe('menu');
    expect(
      d.accept('cfgcn:xiyou:state', legacy({ expedition: { region: 0, pos: { x: 0, z: 0 } } }))
        ?.scene,
    ).toBe('exploration');
    expect(d.accept('cfgcn:xiyou:state', legacy({ phase: 'paused' }))?.paused).toBe(true);
    expect(d.accept('cfgcn:xiyou:shadow-state', trial())?.scene).toBe('battle');
    expect(d.accept('cfgcn:xiyou:shadow-state', trial({ paused: true }))?.paused).toBe(true);
    expect(d.accept('cfgcn:xiyou:shadow-state', trial({ paused: true, elapsed: 0 }))?.scene).toBe(
      'menu',
    );
  });
  it('does not invent an impact for an empty release; damaged enemy HP does produce one', () => {
    const d = new GameAudioDirector();
    d.accept('cfgcn:xiyou:shadow-state', trial());
    const swing = d.accept('cfgcn:xiyou:shadow-state', trial({ elapsed: 1.08, releases: 1 }));
    expect(swing?.cues).toContain('weapon-whoosh');
    expect(swing?.cues).not.toContain('metal-impact');
    const hit = d.accept(
      'cfgcn:xiyou:shadow-state',
      trial({ elapsed: 1.16, releases: 1, enemies: [{ id: 10, hp: 80 }] }),
    );
    expect(hit?.cues).toContain('metal-impact');
    const spawn = d.accept(
      'cfgcn:xiyou:shadow-state',
      trial({ elapsed: 1.24, releases: 1, enemies: [{ id: 99, hp: 50 }] }),
    );
    expect(spawn?.cues).not.toContain('metal-impact');
  });
  it('uses released monk/dragon events for spells and ignores unchanged snapshots', () => {
    const d = new GameAudioDirector();
    d.accept('cfgcn:xiyou:shadow-state', trial());
    const next = trial({ elapsed: 1.08, releases: 1 });
    const heroes = next.trial.heroes.map((h, i) => ({
      ...h,
      cast: i === 0 || i === 4 ? { token: i + 1, skill: 0, next_event: 1, time: 0.3 } : null,
    }));
    const value = { trial: { ...next.trial, heroes } };
    expect(d.accept('cfgcn:xiyou:shadow-state', value)?.cues).toEqual(['ink-spell', 'water-spell']);
    expect(d.accept('cfgcn:xiyou:shadow-state', value)?.cues).toEqual([]);
  });
  it('limits footsteps by distance and ignores restarts, teleports and paused movement', () => {
    const d = new GameAudioDirector();
    d.accept('cfgcn:xiyou:state', legacy());
    expect(
      d.accept('cfgcn:xiyou:state', legacy({ elapsed: 1.32, hero: { x: 1.3, z: 0 } }))?.cues,
    ).toContain('footstep-earth');
    expect(
      d.accept('cfgcn:xiyou:state', legacy({ elapsed: 1.4, hero: { x: 1000, z: 0 } }))?.cues,
    ).toEqual([]);
    expect(d.accept('cfgcn:xiyou:state', legacy({ phase: 'paused', elapsed: 1.4 }))?.cues).toEqual(
      [],
    );
    expect(d.accept('cfgcn:xiyou:state', legacy({ elapsed: 0 }))?.cues).toEqual([]);
  });
  it('triggers result stingers once and treats loaded saves as a silent baseline', () => {
    const d = new GameAudioDirector();
    expect(d.accept('cfgcn:xiyou:state', legacy({ phase: 'won' }))?.cues).toEqual([]);
    d.accept('cfgcn:xiyou:state', legacy({ phase: 'playing' }));
    expect(d.accept('cfgcn:xiyou:state', legacy({ phase: 'won' }))?.cues).toEqual(['victory']);
    expect(d.accept('cfgcn:xiyou:state', legacy({ phase: 'won' }))?.cues).toEqual([]);
  });
  it('uses water proximity from the real river rather than playing a stream everywhere', () => {
    const i = mapRegions.findIndex((r) => r.id === 'yingchou');
    const r = mapRegions[i];
    const bank = { x: r.x, z: riverCourse(r, r.x) + 5 };
    expect(environmentAt(i, bank).water).toBeGreaterThan(0.8);
    expect(environmentAt(i, { x: r.x, z: bank.z + 100 }).water).toBe(0);
    expect(environmentAt(0, { x: 0, z: 32 }).water).toBe(0);
  });
});
