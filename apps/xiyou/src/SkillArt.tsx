/** Original gongbi paintings; the full source and provenance live in art/. */
const paintings = [
  'sutra',
  'kasaya',
  'lotus',
  'lamp',
  'staff',
  'binding',
  'clones',
  'eye',
  'hooves',
  'surge',
  'scales',
  'spring',
  'sutra-staff',
  'three-companions',
  'staff-tide',
  'lotus-spring',
];
export function SkillArt({
  member = 0,
  skill = 0,
  link = false,
  cooldown = 0,
}: {
  member?: number;
  skill?: number;
  link?: boolean;
  cooldown?: number;
}) {
  const index = link ? 12 + skill : skill === 4 ? 2 : member * 4 + skill;
  return (
    <svg
      className="xiyou-skill-art"
      viewBox="0 0 64 64"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <image
        href={`/games/xiyou/ui/skills/${paintings[index] ?? paintings[2]}.webp`}
        x="2"
        y="2"
        width="60"
        height="60"
      />
      {cooldown > 0 && (
        <path
          className="xiyou-cooldown-mask"
          d={`M32 32L32 3A29 29 0 ${cooldown > 0.5 ? 1 : 0} 1 ${32 + 29 * Math.sin(Math.PI * 2 * cooldown)} ${32 - 29 * Math.cos(Math.PI * 2 * cooldown)}Z`}
        />
      )}
      <path
        className="xiyou-icon-border"
        d="M6 29A27 27 0 0 1 25 6M39 6A27 27 0 0 1 58 29M9 47Q15 54 24 53Q29 52 32 57Q35 52 40 53Q49 54 55 47"
      />
    </svg>
  );
}
