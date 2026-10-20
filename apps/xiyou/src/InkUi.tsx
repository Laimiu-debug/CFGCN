import type { ReactNode } from 'react';

const glyphs = {
  back: 'M29 10L14 24L29 38M15 24H43',
  scroll: 'M13 8H36V38H12Q4 38 5 32Q5 26 12 27H36M14 8Q7 8 8 15H31M19 18H29M19 23H31',
  pause: 'M17 12V36M31 12V36',
  play: 'M17 11L37 24L17 37Z',
  close: 'M14 14L34 34M34 14L14 34',
  replay: 'M13 17A15 15 0 1 1 10 29M12 8V19H23',
  clock: 'M24 6A18 18 0 1 1 6 24A18 18 0 0 1 24 6M24 12V24L32 29',
  sword: 'M8 40L18 30M12 25L23 36M17 29L35 7L40 5L39 12L21 33',
  dodge: 'M7 34Q20 9 37 20M29 10L40 20L29 31M6 41H18M4 32H11',
  moon: 'M31 6A18 18 0 1 0 42 31A20 20 0 0 1 31 6Z',
  lotus:
    'M24 38Q9 29 11 14Q23 18 24 38Q25 18 37 14Q39 29 24 38M24 33Q16 18 24 6Q32 18 24 33M7 29Q10 39 24 40Q38 39 41 29',
} as const;
export function InkGlyph({ name }: { name: keyof typeof glyphs }) {
  return (
    <svg className="ink-glyph" viewBox="0 0 48 48" aria-hidden="true">
      <path d={glyphs[name]} />
    </svg>
  );
}
export function InkRim({ value = 1, ultimate = false }: { value?: number; ultimate?: boolean }) {
  return (
    <svg className="ink-rim" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="ink-rim-wash" cx="50" cy="50" r="41" />
      <path
        className="ink-rim-brush"
        d="M9 47C9 21 29 8 51 9C76 10 94 30 91 55C89 77 70 91 48 90C25 89 9 72 9 47M16 28Q28 8 49 13M67 86Q89 77 90 58"
      />
      <circle className="ink-rim-track" cx="50" cy="50" r="46" />
      <circle
        className="ink-rim-value"
        cx="50"
        cy="50"
        r="46"
        pathLength="100"
        strokeDasharray={`${Math.max(0, Math.min(1, value)) * 100} 100`}
        transform="rotate(-90 50 50)"
      />
      {ultimate && (
        <path
          className="ink-rim-gold"
          d="M50 0L54 5L50 10L46 5ZM0 50L5 46L10 50L5 54ZM100 50L95 54L90 50L95 46ZM50 100L46 95L50 90L54 95Z"
        />
      )}
    </svg>
  );
}
export function InkHeading({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="ink-heading">
      <span>{eyebrow}</span>
      <h2>{children}</h2>
      <svg viewBox="0 0 180 12" aria-hidden="true">
        <path d="M2 6Q41 3 76 6L87 2L94 6Q132 3 178 6M51 9Q77 7 107 9" />
      </svg>
    </div>
  );
}

export type ShadowAbility = { actor: string; clip: string; ultimate?: boolean };
const paintings: Record<string, string> = {
  Chant: 'sutra',
  RobeWard: 'kasaya',
  HealingVow: 'lotus',
  LotusPulse: 'lotus',
  BellChime: 'lamp',
  VowLink: 'lotus-spring',
  PureSeal: 'spring',
  Mandala: 'lotus',
  ScriptureRibbon: 'sutra',
  PilgrimLantern: 'lamp',
  KarmicReflection: 'binding',
  PurifyingVerse: 'sutra',
  StaffSweep: 'staff',
  FreezeSeal: 'binding',
  HairClone: 'clones',
  StaffThrust: 'staff',
  BackSweep: 'staff',
  CrashingCloud: 'staff',
  FlameGaze: 'eye',
  CloudFeint: 'clones',
  StaffGuard: 'staff',
  ReturningStaff: 'staff',
  MonkeyCommand: 'three-companions',
  StoneShell: 'scales',
  BellyBrace: 'scales',
  MudWall: 'hooves',
  RollingCharge: 'hooves',
  FeastBreath: 'spring',
  BellyRebound: 'scales',
  RiverWard: 'scales',
  SandVortex: 'surge',
  RiverDrag: 'surge',
  PrayerBeads: 'lotus-spring',
  RiverTread: 'hooves',
  SandAnchor: 'binding',
  BeadOrbit: 'lotus-spring',
  Undertow: 'surge',
  WaveStep: 'surge',
  ScaleWard: 'scales',
  TideReturn: 'surge',
  FrostBreath: 'spring',
  DragonDash: 'staff-tide',
  RainBlessing: 'lotus-spring',
  MistVeil: 'hooves',
  TidePrison: 'binding',
};
export function ShadowSkillArt({ skill }: { skill: ShadowAbility }) {
  if (skill.ultimate)
    return (
      <img className="shadow-ability-paint" src={`/games/xiyou/ui/v6/${skill.actor}.webp`} alt="" />
    );
  const painting = paintings[skill.clip];
  const gesture: Record<string, string> = {
    StaffSweep: 'M8 61Q11 25 40 16Q66 16 72 40',
    StaffThrust: 'M10 67L64 13M52 14L66 12L64 26',
    BackSweep: 'M61 12Q9 9 10 50M4 41L10 52L22 47',
    StaffGuard: 'M17 20Q40 30 63 20V44Q58 61 40 70Q22 61 17 44Z',
    ReturningStaff: 'M17 54A28 28 0 1 1 65 48M57 41L65 51L72 41M12 51L16 60L26 57',
    CloudFeint: 'M9 65Q23 48 40 51M21 71Q42 55 66 60M13 20L23 13',
    HealingVow: 'M9 18V30M3 24H15M63 52V68M55 60H71',
    LotusPulse: 'M7 57Q39 74 72 56M11 65Q40 78 68 65',
    VowLink: 'M11 20Q40 3 69 20M12 26Q40 9 68 26M11 20L8 30M69 20L72 30',
    TideReturn: 'M9 63Q22 44 36 57Q51 73 70 52M60 50L71 51L70 63',
    RainBlessing: 'M14 12L10 25M31 7L27 20M51 7L47 20M70 14L66 27',
    SpadeThrust: 'M9 66L63 12M54 12H65V24',
    RakeSlam: 'M12 11L25 34M9 33L25 36L27 20M56 60L70 71M68 54L77 63',
  };
  if (painting)
    return (
      <svg className="shadow-ability-paint" viewBox="0 0 80 80" aria-hidden="true">
        <image
          href={`/games/xiyou/ui/skills/${painting}.webp`}
          x="4"
          y="4"
          width="72"
          height="72"
        />
        {gesture[skill.clip] && <path className="ability-gesture" d={gesture[skill.clip]} />}
      </svg>
    );
  const water = skill.actor === 'shaseng' || skill.actor === 'xiaobailong';
  const thrust = /Thrust|Pin|Slam|Anchor/.test(skill.clip);
  return (
    <svg className="shadow-ability-paint" viewBox="0 0 80 80" aria-hidden="true">
      <path
        className={water ? 'ability-water' : 'ability-earth'}
        d={
          thrust
            ? 'M15 55Q31 63 57 45M21 64Q45 75 65 51M20 48Q30 51 37 44'
            : 'M8 53Q16 22 41 20Q63 20 68 41Q47 27 29 45Q22 56 12 59M22 63Q45 50 67 57'
        }
      />
      <image
        href={`/games/xiyou/assets/shadow/${skill.actor}/weapon.png`}
        x="27"
        y="3"
        width="26"
        height="73"
        preserveAspectRatio="xMidYMid meet"
        transform={`rotate(${thrust ? 12 : 40} 40 40)`}
      />
      <path
        className="ability-ink"
        d={thrust ? 'M55 8L59 24M63 13L66 27M51 63L46 70' : 'M10 37Q16 18 33 13M45 65Q62 60 69 45'}
      />
    </svg>
  );
}
