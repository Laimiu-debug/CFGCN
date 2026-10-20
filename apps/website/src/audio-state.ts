import { anchorX, mapRegions, riverCourse } from '../../xiyou/src/expedition-map';
import layout from '../../../packages/game-core/data/xiyou-map-layout.json';

export type MusicScene = 'menu' | 'exploration' | 'battle';
export type SoundCue =
  | 'ui-hover'
  | 'ui-confirm'
  | 'ui-cancel'
  | 'footstep-earth'
  | 'footstep-stone'
  | 'weapon-whoosh'
  | 'wood-impact'
  | 'metal-impact'
  | 'ink-spell'
  | 'water-spell'
  | 'pickup'
  | 'piece-place'
  | 'warning'
  | 'victory'
  | 'defeat';
type Point = { x: number; z: number };
type Hero = {
  hp: number;
  shield: number;
  pos: Point;
  loadout: number[];
  cast: { token: number; next_event: number; skill: number; time: number } | null;
  dodge: { time: number } | null;
};
type Shadow = {
  heroes: Hero[];
  leader: number;
  elapsed: number;
  paused: boolean;
  kills: number;
  releases: number;
  blocked: number;
  enemies: { id: number; hp: number }[];
};
type Legacy = {
  ready: boolean;
  phase: string;
  elapsed: number;
  hp: number;
  xp: number;
  level: number;
  kills: number;
  freeze_cd: number;
  clone_cd: number;
  boss_hp: number | null;
  hero?: Point;
  expedition?: { region: number; pos: Point } | null;
};
export type AudioFrame = {
  scene: MusicScene;
  paused: boolean;
  water: number;
  birds: number;
  cues: SoundCue[];
};
const validPoint = (p: Point | undefined) => p && Number.isFinite(p.x) && Number.isFinite(p.z);

export function environmentAt(regionIndex: number, pos: Point) {
  const region = mapRegions[regionIndex];
  if (!region || !validPoint(pos)) return { water: 0, birds: 0.3, stone: false };
  // The sound follows the same river curve and courtyard anchors as the map.
  const distance = Math.abs(pos.z - riverCourse(region, pos.x));
  const water = region.water > 0 ? Math.max(0, 1 - distance / 38) : 0;
  const birds = region.biome === 'ochre' ? 0.08 : region.biome === 'forest' ? 0.85 : 0.45;
  const stone = layout.courts.some(
    (court) =>
      court.stone &&
      court.region === region.id &&
      Math.abs(pos.x - (anchorX(region.z) + court.offset[0])) < court.extent[0] &&
      Math.abs(pos.z - (region.z + court.offset[1])) < court.extent[1],
  );
  return { water, birds, stone };
}

// Read actual simulation changes. No input click is treated as a successful hit.
export class GameAudioDirector {
  private shadow?: Shadow;
  private legacy?: Legacy;
  private distance = 0;
  private lastStep = -1;
  reset() {
    this.shadow = undefined;
    this.legacy = undefined;
    this.distance = 0;
    this.lastStep = -1;
  }
  private step(
    before: Point | undefined,
    after: Point | undefined,
    elapsed: number,
    stone: boolean,
  ) {
    if (!validPoint(before) || !validPoint(after)) return [];
    const d = Math.hypot(after!.x - before!.x, after!.z - before!.z);
    if (d > 4) {
      this.distance = 0;
      return [];
    } // Restoration/teleport is silent.
    this.distance += d;
    if (this.distance < 1.1 || elapsed - this.lastStep < 0.28) return [];
    this.distance %= 1.1;
    this.lastStep = elapsed;
    return [stone ? 'footstep-stone' : 'footstep-earth'] as SoundCue[];
  }
  accept(type: string, value: unknown): AudioFrame | null {
    if (type === 'cfgcn:xiyou:shadow-state') {
      const t = (value as { trial?: Shadow } | null)?.trial;
      if (
        !t ||
        t.heroes?.length !== 5 ||
        !Array.isArray(t.enemies) ||
        !Number.isFinite(t.elapsed) ||
        !t.heroes[t.leader]
      )
        return null;
      if (this.legacy || (this.shadow && t.elapsed < this.shadow.elapsed)) this.reset();
      const previous = this.shadow;
      this.shadow = t;
      const cues: SoundCue[] = [];
      const opening = t.paused && t.elapsed === 0;
      const dead = t.heroes.every((h) => h.hp <= 0);
      const paused = !opening && t.paused && !dead;
      if (
        previous &&
        !t.paused &&
        t.elapsed > previous.elapsed &&
        t.elapsed - previous.elapsed < 1
      ) {
        let released = false;
        t.heroes.forEach((h, i) => {
          const old = previous.heroes[i];
          if (
            h.cast &&
            h.cast.next_event > 0 &&
            (h.cast.token !== old.cast?.token || h.cast.next_event > (old.cast?.next_event ?? 0))
          ) {
            cues.push(i === 0 ? 'ink-spell' : i === 4 ? 'water-spell' : 'weapon-whoosh');
            released = true;
          }
          if (h.dodge && (!old.dodge || h.dodge.time < old.dodge.time)) cues.push('weapon-whoosh');
          if (h.hp < old.hp || h.shield < old.shield) cues.push('wood-impact');
          if (h.loadout.some((s, slot) => s !== old.loadout[slot])) cues.push('piece-place');
        });
        if (t.releases > previous.releases && !released) cues.push('weapon-whoosh');
        const hp = new Map(previous.enemies.map((e) => [e.id, e.hp]));
        if (t.kills > previous.kills || t.enemies.some((e) => hp.has(e.id) && e.hp < hp.get(e.id)!))
          cues.push('metal-impact');
        if (t.blocked > previous.blocked) cues.push('warning');
        if (t.leader === previous.leader)
          cues.push(
            ...this.step(previous.heroes[t.leader].pos, t.heroes[t.leader].pos, t.elapsed, false),
          );
      }
      if (previous && dead && !previous.heroes.every((h) => h.hp <= 0)) cues.push('defeat');
      // Preparing equipment is a real state change even while the trial is paused.
      if (
        previous &&
        t.paused &&
        t.heroes.some((h, i) => h.loadout.some((s, slot) => s !== previous.heroes[i].loadout[slot]))
      )
        cues.push('piece-place');
      return { scene: opening ? 'menu' : 'battle', paused, water: 0, birds: 0.2, cues };
    }
    if (type !== 'cfgcn:xiyou:state') return null;
    const s = value as Legacy | null;
    if (
      !s ||
      !s.ready ||
      !Number.isFinite(s.elapsed) ||
      !['menu', 'playing', 'paused', 'upgrade', 'won', 'lost'].includes(s.phase)
    )
      return null;
    if (this.shadow || (this.legacy && s.elapsed < this.legacy.elapsed)) this.reset();
    const previous = this.legacy;
    this.legacy = s;
    const scene = s.phase === 'menu' ? 'menu' : s.expedition ? 'exploration' : 'battle';
    const env = s.expedition
      ? environmentAt(s.expedition.region, s.expedition.pos)
      : { water: scene === 'menu' ? 0.2 : 0, birds: 0.4, stone: false };
    const cues: SoundCue[] = [];
    if (
      previous &&
      s.phase === 'playing' &&
      previous.phase === 'playing' &&
      s.elapsed > previous.elapsed &&
      s.elapsed - previous.elapsed < 1
    ) {
      cues.push(
        ...this.step(
          previous.expedition?.pos ?? previous.hero,
          s.expedition?.pos ?? s.hero,
          s.elapsed,
          env.stone,
        ),
      );
      if (!s.expedition) {
        if (s.hp < previous.hp) cues.push('wood-impact');
        if (s.kills > previous.kills) cues.push('metal-impact');
        if (s.xp > previous.xp || s.level > previous.level) cues.push('pickup');
        if (s.freeze_cd > previous.freeze_cd + 0.5) cues.push('water-spell');
        if (s.clone_cd > previous.clone_cd + 0.5) cues.push('ink-spell');
        if (s.boss_hp !== null && previous.boss_hp === null) cues.push('warning');
      }
    }
    if (previous && s.phase !== previous.phase) {
      if (s.phase === 'won') cues.push('victory');
      if (s.phase === 'lost') cues.push('defeat');
    }
    return {
      scene,
      paused: s.phase === 'paused' || s.phase === 'upgrade',
      water: env.water,
      birds: env.birds,
      cues,
    };
  }
}
