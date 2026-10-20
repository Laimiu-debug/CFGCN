// Original vector drawings. Adult height 78, door opening 108, boat length 238.
// Tang costume cues are illustrations, not an archaeological reconstruction.
export type StreetRole = 'scholar' | 'woman' | 'porter' | 'boatman' | 'monk' | 'vendor' | 'child';
export function StreetPerson({
  role,
  seed = 0,
  walking = false,
}: {
  role: StreetRole;
  seed?: number;
  walking?: boolean;
}) {
  const woman = role === 'woman',
    monk = role === 'monk',
    worker = ['porter', 'boatman', 'vendor'].includes(role);
  const skin = 'var(--paper-raised)',
    dark = 'var(--ink)',
    color = woman
      ? 'var(--accent-honglou)'
      : monk
        ? 'var(--vermilion)'
        : worker
          ? 'var(--muted)'
          : 'var(--accent-shuihu)';
  return (
    <g stroke={dark} strokeWidth="0.72" strokeLinecap="round" strokeLinejoin="round" fill={skin}>
      <ellipse cx="1" cy="1.4" rx="14" ry="2.2" fill={dark} opacity="0.1" stroke="none" />
      <g>
        {walking && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-5 0 -28;5 0 -28;-5 0 -28"
            dur="1.4s"
            begin={`${-seed}s`}
            repeatCount="indefinite"
          />
        )}
        <path d="M-8 -29L-8 -9 -12 -2Q-15 1 -18 -1L-10 -15 -6 -31" fill="var(--paper-shade)" />
        <path d="M-12 -3Q-17 -5 -19 -1L-18 1 -7 1 -6 -2" fill={dark} />
      </g>
      <g>
        {walking && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="5 5 -28;-5 5 -28;5 5 -28"
            dur="1.4s"
            begin={`${-seed}s`}
            repeatCount="indefinite"
          />
        )}
        <path d="M2 -32L10 -24 10 -9 14 -3 11 0 5 -3 3 -19 -2 -28" fill="var(--paper-shade)" />
        <path d="M10 -4Q15 -4 18 -1L18 1 8 1 6 -2" fill={dark} />
      </g>
      <path
        d={
          woman
            ? 'M-9 -61Q-17 -55 -15 -42L-24 -9Q-5 -3 16 -8L8 -45 7 -62Z'
            : worker
              ? 'M-8 -60Q-17 -59 -15 -46L-12 -23Q-2 -20 11 -26L8 -48 7 -61Z'
              : 'M-9 -61Q-16 -59 -15 -45L-17 -10Q-2 -5 15 -12L8 -47 8 -61Z'
        }
        fill={color}
        fillOpacity="0.62"
      />
      {woman ? (
        <>
          <path d="M-10 -61Q-5 -55 6 -61L8 -44 -13 -44Z" fill="var(--paper-raised)" />
          <path
            d="M-12 -46Q-1 -43 10 -46L10 -41Q-1 -38 -13 -42Z"
            fill="var(--vermilion)"
            fillOpacity="0.65"
          />
          <path
            d="M-11 -59Q-21 -55 -21 -41L-12 -32 -11 -38 -15 -43 -11 -51M7 -59Q19 -51 14 -36L9 -31 5 -37 9 -42 6 -51"
            fill="var(--paper-raised)"
          />
          <path
            d="M-14 -59Q-19 -40 -26 -33Q-28 -29 -24 -26M7 -59Q20 -43 23 -35L15 -29"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="2.5"
            opacity="0.7"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="-1 0 -55;2 0 -55;-1 0 -55"
              dur="4.8s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M-9 -39L-18 -12M-2 -38L-5 -10M4 -39L7 -10M9 -35L12 -12"
            fill="none"
            opacity="0.42"
          />
        </>
      ) : (
        <>
          <path
            d={
              worker || monk
                ? 'M-7 -61L4 -48 -4 -42M6 -60L-5 -45 -10 -39'
                : 'M-6 -61Q-5 -53 5 -58M-6 -61L6 -58'
            }
            fill="none"
            stroke="var(--paper-raised)"
            strokeWidth="1.4"
          />
          <path d="M-13 -38Q-2 -35 10 -39L10 -35Q-1 -31 -13 -34Z" fill="var(--gold-ink)" />
          <path
            d="M-7 -31L-11 -14M-2 -31L-3 -13M5 -32L9 -15M-9 -54L-7 -42M5 -50L7 -42"
            fill="none"
            opacity="0.38"
          />
          {monk && (
            <path
              d="M-10 -59Q1 -51 12 -43L9 -18 -15 -12M-6 -54L-8 -18M1 -50L-1 -16M8 -45L5 -19M-9 -42L11 -36M-12 -30L10 -25"
              fill="none"
              stroke="var(--gold-ink)"
            />
          )}
          <g>
            {!walking && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 -10 -56;8 -10 -56;0 -10 -56"
                dur={`${4.2 + (seed % 3)}s`}
                repeatCount="indefinite"
              />
            )}
            <path
              d="M-12 -57Q-20 -52 -17 -43L-8 -35 -4 -40 -11 -47 -7 -54"
              fill={color}
              fillOpacity="0.7"
            />
            <path d="M-8 -36Q-3 -32 0 -37L-1 -41 -5 -41Z" />
            <path d="M-6 -38L-2 -37M-7 -40L-3 -39" fill="none" strokeWidth="0.35" />
          </g>
          <path d="M7 -58Q17 -53 14 -44L7 -38 4 -43 8 -49 4 -53" fill={color} fillOpacity="0.6" />
          <path d="M6 -39Q2 -36 0 -39L2 -43 5 -43" />
        </>
      )}
      <path d="M-4 -66L-4 -59Q0 -56 4 -61L4 -68" />
      <path d="M-7 -75Q-2 -81 4 -76L8 -71 10 -68 7 -67Q7 -61 3 -61L-2 -63 -5 -67Z" />
      <path
        d="M3 -72L6 -72M4 -70L5 -70M7 -66L4 -65M2 -76Q6 -76 7 -73"
        fill="none"
        strokeWidth="0.46"
      />
      <path d="M-5 -72Q-8 -75 -8 -70L-5 -67" />
      <path d="M-6 -70L-7 -72M-1 -66L-1 -64" fill="none" opacity="0.6" strokeWidth="0.4" />
      {woman ? (
        <>
          <path
            d="M-7 -71Q-11 -78 -5 -81Q-7 -86 -2 -87Q4 -86 3 -82Q9 -81 6 -74L1 -77 -4 -76 -4 -70Z"
            fill={dark}
          />
          <path d="M-5 -82L3 -83M-7 -79Q-4 -81 -2 -79" stroke="var(--gold)" />
          <path d="M-4 -67L-4 -64" stroke="var(--gold-ink)" />
        </>
      ) : monk ? (
        <path d="M-7 -74Q-3 -80 3 -77M-4 -77L-3 -76M0 -78L1 -77" fill="none" />
      ) : worker ? (
        <>
          <path d="M-8 -73L-8 -78Q-2 -83 5 -77L7 -74Z" fill="var(--paper-shade)" />
          <path d="M-8 -77L5 -76M-7 -77L-13 -69 -9 -69 -5 -75" fill="none" />
        </>
      ) : (
        <>
          <path d="M-8 -73L-9 -80Q-4 -86 3 -81L7 -74Z" fill={dark} />
          <path
            d="M-8 -78Q-16 -83 -14 -70L-10 -65M-6 -78Q-13 -76 -10 -66L-7 -62"
            fill="none"
            strokeWidth="1.8"
          />
          <path d="M3 -63Q0 -61 -1 -63L0 -57" fill="none" strokeWidth="0.6" />
        </>
      )}
      {role === 'porter' && (
        <>
          <path d="M-40 -55Q-3 -59 38 -51" fill="none" stroke="var(--gold-ink)" strokeWidth="2" />
          <path d="M-34 -54L-36 -23M31 -52L33 -19" fill="none" />
          {[-36, 33].map((x, i) => (
            <g key={x} transform={`translate(${x} ${i ? -17 : -21})`}>
              <path
                d="M-11 -5L-8 10Q0 14 9 8L12 -6Q0 -11 -11 -5Z"
                fill="var(--gold)"
                fillOpacity="0.4"
              />
              <path
                d="M-11 -5Q0 1 12 -6M-8 1L10 -1M-7 6L9 4M-4 -6L-3 10M3 -7L4 10"
                fill="none"
                strokeWidth="0.5"
              />
            </g>
          ))}
        </>
      )}
      {role === 'scholar' && (
        <path d="M-9 -39L-1 -42 1 -34 -7 -32Z M-7 -38L-2 -39M-6 -36L-1 -37" fill="var(--paper)" />
      )}
      {role === 'boatman' && (
        <path
          d="M-12 -41L49 18M46 14L53 20"
          fill="none"
          stroke="var(--gold-ink)"
          strokeWidth="1.8"
        />
      )}
    </g>
  );
}
