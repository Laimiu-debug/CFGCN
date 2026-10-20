import type { Locale } from '@cfgcn/shared';
import type { JourneyState } from './journey';
import { worldCopy } from './world-copy';
export function WorldMap({
  state,
  locale,
}: {
  state: { journey: JourneyState | null; master?: { z: number }; hero?: { z: number } };
  locale: Locale;
}) {
  const j = state.journey!;
  const w = j.world!;
  const text = worldCopy[locale];
  const z =
    j.leader === 0
      ? state.master?.z
      : j.leader === 1
        ? state.hero?.z
        : (j as JourneyState & { dragon_pos: { z: number } }).dragon_pos?.z;
  return (
    <div
      className="xiyou-world-map"
      role="img"
      aria-label={`${text.regions[w.region]} · ${text.goals[w.events & 16 ? 6 : !j.joined ? 0 : !j.dragon_joined ? 3 : 5]}`}
    >
      <svg viewBox="0 0 210 94" aria-hidden="true">
        <defs>
          <linearGradient id="xiyou-map-mineral" x1="0" y1="0" x2="0.2" y2="1">
            <stop stopColor="var(--accent-shuihu)" />
            <stop offset="0.55" stopColor="var(--jade)" />
            <stop offset="1" stopColor="var(--paper-shade)" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path
          className="map-peaks"
          d="M3 65Q11 54 12 44Q13 32 20 26Q24 24 28 37Q33 33 35 22Q38 7 43 13Q51 23 50 39Q56 39 60 26Q66 20 69 38Q69 52 80 63ZM94 54Q100 47 102 35Q103 28 110 25Q113 10 118 15Q124 22 124 36Q129 37 135 53ZM164 54Q169 37 170 27Q174 12 180 24Q184 33 184 41Q190 32 195 44L204 57Z"
        />
        <path
          className="map-ink-detail"
          d="M19 30Q15 45 14 54M23 36Q23 47 29 55M43 18Q39 29 40 39L34 47M45 30L45 45L52 53M63 30L61 44M111 30L108 43M117 21L116 39L122 47M176 25L175 41M184 46L190 51M7 65Q28 58 47 63T83 62M96 55Q113 50 137 56"
        />
        <path className="map-stream" d="M157 4Q139 27 159 47Q174 69 155 91" />
        <path
          className="map-water-detail"
          d="M155 8Q146 26 156 39M159 55Q169 70 158 84M150 18Q153 20 151 24M161 68Q157 70 159 73"
        />
        <path className="map-route" d="M20 71Q45 57 70 64T115 57T151 60T194 54" />
        {[0, 1, 2, 3].map((n) => (
          <g key={n} transform={`translate(${[23, 83, 139, 192][n]} ${[69, 64, 59, 54][n]})`}>
            <path
              className={w.camp === n ? 'map-camp-current' : 'map-camp'}
              d="M-5 4V-3H5V4ZM-8-2Q-5-2-3-6L0-8L3-6Q5-2 8-2M-3-5H3M-2 4V0H2V4"
            />
          </g>
        ))}
        <circle
          className="map-player"
          cx={20 + Math.max(0, Math.min(1, (z ?? 0) / 108)) * 174}
          cy={64}
          r="5"
        />
        {w.events & 1 ? (
          <path className="map-event" d="M42 49L46 53L53 44" />
        ) : (
          <path className="map-event" d="M45 43V54M41 47H49" />
        )}
        {w.events & 8 ? (
          <path className="map-event" d="M163 42L167 46L174 37" />
        ) : (
          <path className="map-event" d="M166 38Q176 29 177 39T166 46" />
        )}
      </svg>
      <span>{text.regions[w.region]}</span>
    </div>
  );
}
