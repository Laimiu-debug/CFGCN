export type JourneyCheckpoint = {
  version: 1;
  chapter: number;
  level: number;
  xp: number;
  monk: number[];
  wukong: number[];
  dragon?: number[];
  dragon_joined?: boolean;
  leader?: number;
  events?: number;
  camp?: number;
};
export type JourneyState = {
  world: {
    region: number;
    events: number;
    camp: number;
    camp_ready: boolean;
    rest_cd: number;
  } | null;
  links: {
    resonance: number;
    cooldown: number[];
    active: number;
    remaining: number;
    windup: number;
    count: number[];
  };
  intentions: number[];
  chapter: number;
  joined: boolean;
  dragon_joined: boolean;
  dragon_defeated: boolean;
  leader: number;
  dragon: number[];
  dragon_hp: number;
  reunion: boolean;
  recipient: number | null;
  offers: number[][];
  monk: number[];
  wukong: number[];
  stage_time: number;
  rescue_ready: boolean;
  exit_open: boolean;
  shield: number;
  start: JourneyCheckpoint;
  checkpoint: JourneyCheckpoint;
};
export function isJourneyCheckpoint(value: unknown): value is JourneyCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  const ranks = (v: unknown): v is number[] =>
    Array.isArray(v) && v.length === 4 && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 5);
  if (
    (c.events !== undefined &&
      (!Number.isInteger(c.events) || (c.events as number) < 0 || (c.events as number) > 31)) ||
    (c.camp !== undefined &&
      (!Number.isInteger(c.camp) || (c.camp as number) < 0 || (c.camp as number) > 3)) ||
    c.version !== 1 ||
    !Number.isInteger(c.chapter) ||
    (c.chapter as number) < 0 ||
    (c.chapter as number) > 4 ||
    !Number.isInteger(c.level) ||
    (c.level as number) < 1 ||
    (c.level as number) > 70 ||
    !Number.isInteger(c.xp) ||
    (c.xp as number) < 0 ||
    (c.xp as number) >= 4 + ((c.level as number) - 1) * 3 ||
    !ranks(c.monk) ||
    !ranks(c.wukong) ||
    (c.dragon !== undefined && !ranks(c.dragon)) ||
    (c.dragon_joined !== undefined && typeof c.dragon_joined !== 'boolean') ||
    (c.leader !== undefined &&
      (!Number.isInteger(c.leader) || (c.leader as number) < 0 || (c.leader as number) > 2))
  )
    return false;
  return (
    (((c.events as number) ?? 0) === 0 || !c.dragon_joined || ((c.events as number) & 8) !== 0) &&
    (((c.camp as number) ?? 0) === 0 || (((c.events as number) ?? 0) & 2) !== 0) &&
    (((c.camp as number) ?? 0) < 3 || (((c.events as number) ?? 0) & 16) !== 0) &&
    (!(((c.events as number) ?? 0) & 8) || c.dragon_joined === true) &&
    (c.events === undefined || c.events === 0 || (c.chapter as number) >= 2) &&
    [2, 4, 8, 16].every(
      (bit) => !(((c.events as number) ?? 0) & bit) || ((c.events as number) & (bit >> 1)) !== 0,
    ) &&
    [...c.monk, ...c.wukong, ...((c.dragon as number[] | undefined) ?? [0, 0, 0, 0])].reduce(
      (sum, n) => sum + n,
      0,
    ) < (c.level as number) &&
    ((c.chapter as number) >= 2 || c.wukong.every((n) => n === 0)) &&
    (!c.dragon_joined || (c.chapter as number) >= 3) &&
    (c.dragon_joined || ((c.dragon as number[] | undefined) ?? []).every((n) => n === 0)) &&
    (c.leader === undefined ||
      c.leader === 0 ||
      (c.leader === 1 && ((c.chapter as number) >= 3 || (((c.events as number) ?? 0) & 1) !== 0)) ||
      (c.leader === 2 && c.dragon_joined === true))
  );
}
