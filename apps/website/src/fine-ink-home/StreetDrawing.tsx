import { memo } from 'react';
import { StreetPerson, type StreetRole } from './StreetPeople';

const ink = 'var(--ink)',
  paper = 'var(--paper-raised)',
  shade = 'var(--paper-shade)',
  gold = 'var(--gold-ink)';
function Roof({
  x,
  y,
  width,
  rise = 95,
  seed = 0,
}: {
  x: number;
  y: number;
  width: number;
  rise?: number;
  seed?: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={ink} strokeWidth="1.3" strokeLinejoin="round">
      <path
        d={`M-24 10Q20 1 36 -22L68 ${-rise}L${width - 73} ${-rise - 8}L${width - 25} -6Q${width + 6} 11 ${width + 28} -2L${width + 14} 19Q${width * 0.55} 3 -14 27Z`}
        fill="var(--muted)"
        fillOpacity=".45"
      />
      <path
        d={`M-17 12Q${width * 0.5} -4 ${width + 20} 5L${width + 14} 15Q${width * 0.52} 6 -14 23Z`}
        fill={ink}
        fillOpacity=".48"
      />
      {Array.from({ length: Math.floor(width / 12) }, (_, i) => {
        const px = 5 + i * 12,
          top = -rise * Math.min(1, px / 65, (width - px) / 70);
        return (
          <path
            key={i}
            d={`M${px} 11Q${px + 9} ${top * 0.3} ${68 + (px / width) * (width - 141)} ${top + 8}`}
            fill="none"
            strokeWidth=".72"
            opacity={0.32 + (i % 3) * 0.08}
          />
        );
      })}
      {[0.25, 0.47, 0.68, 0.86].map((v) => (
        <path
          key={v}
          d={`M${width * 0.51 * (1 - v)} ${-rise * (1 - v) + 12}Q${width * 0.51} ${-rise * (1 - v) - 4} ${width * 0.51 + width * 0.49 * v} ${-rise * (1 - v) + 12}`}
          fill="none"
          opacity=".34"
          strokeWidth=".8"
        />
      ))}
      <path
        d={`M58 ${-rise + 1}Q${width * 0.5} ${-rise - 1} ${width - 61} ${-rise - 6}`}
        fill="none"
        strokeWidth="3"
      />
      <path
        d={`M-24 10L-13 4M${width + 24} -2L${width + 14} -9M${width * 0.5} ${-rise - 3}L${width * 0.5 - 4} ${-rise - 14}`}
        fill="none"
      />
      <path
        d={`M18 24Q${width * 0.5} 11 ${width - 5} 19`}
        fill="none"
        stroke={paper}
        strokeWidth="1.2"
        opacity=".75"
      />
      {seed % 2 === 1 && (
        <path
          d={`M${width * 0.5 - 10} ${-rise + 1}L${width * 0.5 - 14} ${-rise - 9}M${width * 0.54 + 8} ${-rise + 4}L${width * 0.54 + 15} ${-rise - 3}`}
          fill="none"
        />
      )}
    </g>
  );
}
function Shop({
  x,
  y,
  width = 300,
  name,
  seed = 0,
}: {
  x: number;
  y: number;
  width?: number;
  name: string;
  seed?: number;
}) {
  const h = 156;
  return (
    <g transform={`translate(${x} ${y})`} stroke={ink} strokeWidth="1.1" strokeLinejoin="round">
      <path d={`M0 0L${width} -9 ${width} ${h} 0 ${h + 9}Z`} fill={paper} />
      <path
        d={`M${width} -9L${width + 58} -50 ${width + 58} ${h - 42} ${width} ${h}Z`}
        fill={shade}
      />
      <path
        d={`M-7 ${h + 9}L${width + 2} ${h} ${width + 63} ${h - 40} ${width + 64} ${h - 30} ${width + 3} ${h + 14} -8 ${h + 23}Z`}
        fill={shade}
      />
      <path
        d={`M15 5L15 ${h + 5}M${width - 13} 0L${width - 13} ${h}M${width * 0.5} 0L${width * 0.5} ${h}`}
        stroke="var(--vermilion)"
        strokeOpacity=".65"
        strokeWidth="5"
      />
      <path
        d={`M${width * 0.17} 47L${width * 0.17} ${h + 4} ${width * 0.41} ${h + 2} ${width * 0.41} 47Z`}
        fill={ink}
        fillOpacity=".69"
      />
      <path
        d={`M${width * 0.18} 50L${width * 0.18} ${h}M${width * 0.2} 50L${width * 0.2} ${h - 1}`}
        stroke={gold}
        opacity=".7"
      />
      <path
        d={`M${width * 0.57} 37L${width - 31} 33 ${width - 31} 103 ${width * 0.57} 107Z`}
        fill="var(--muted)"
        fillOpacity=".18"
      />
      {Array.from({ length: 6 }, (_, i) => (
        <path
          key={i}
          d={`M${width * 0.59 + i * ((width * 0.32) / 6)} 39L${width * 0.59 + i * ((width * 0.32) / 6)} 102`}
          fill="none"
          strokeWidth="1.2"
        />
      ))}
      <path
        d={`M${width * 0.57} 69L${width - 31} 65M${width * 0.57} 104L${width - 31} 100M0 15L${width} 8M0 25L${width} 18`}
        fill="none"
      />
      {['茶肆', '酒舍', '客舍'].includes(name) && (
        <g>
          <path
            d={`M-2 -8L-2 -136 ${width} -145 ${width + 48} -184 ${width + 48} -41 ${width} -9Z`}
            fill={paper}
          />
          <path
            d={`M${width} -145L${width + 48} -184 ${width + 48} -41 ${width} -9Z`}
            fill={shade}
          />
          {[0.12, 0.39, 0.67].map((v) => (
            <g key={v} transform={`translate(${width * v} -116)`}>
              <path d="M0 0L63 -2 63 70 0 72Z" fill={ink} fillOpacity=".35" />
              <path
                d="M8 3L8 68M19 2L19 68M30 2L30 67M41 2L41 67M52 1L52 67M0 26L63 24M0 47L63 45"
                fill="none"
                stroke={gold}
                strokeWidth="1.3"
              />
            </g>
          ))}
          <path
            d={`M-8 -29L${width + 7} -38M-8 -10L${width + 7} -19`}
            fill="none"
            strokeWidth="3"
          />
          {Array.from({ length: 14 }, (_, i) => (
            <path key={i} d={`M${(i * width) / 13} -30v24`} strokeWidth="2" />
          ))}
          <Roof x={-7} y={-139} width={width + 24} rise={62} seed={seed} />
        </g>
      )}
      <Roof
        x={-2}
        y={-5}
        width={width + 18}
        rise={['茶肆', '酒舍', '客舍'].includes(name) ? 34 : 62 + (seed % 3) * 5}
        seed={seed}
      />
      <path
        d={`M${width * 0.38} 21L${width * 0.65} 18 ${width * 0.65} 43 ${width * 0.38} 46Z`}
        fill={gold}
        fillOpacity=".35"
      />
      <text x={width * 0.515} y="38" fontSize="16" textAnchor="middle" stroke="none" fill={ink}>
        {name}
      </text>
      <g transform={`translate(${width - 42} 34)`}>
        <path d="M0 0L0 75M-3 4L14 2 16 40 2 42" fill="var(--vermilion)" fillOpacity=".5" />
        <path d="M8 4L8 36" stroke={paper} />
      </g>
      <path
        d={`M30 ${h - 5}L44 ${h - 5}M${width + 10} ${h - 24}L${width + 37} ${h - 42}M${width + 18} 30L${width + 47} 9`}
        stroke={gold}
        opacity=".32"
        fill="none"
      />
      {Array.from({ length: 10 }, (_, i) => (
        <path
          key={i}
          d={`M${18 + i * 29} ${h + 16 - ((i * 29) / width) * 9}l14 -.4`}
          fill="none"
          strokeWidth=".5"
          opacity=".6"
        />
      ))}
      {name === '绢帛' && (
        <g transform="translate(181 115)">
          <path d="M-20 -57L13 -58 17 13 -19 14Z" fill="var(--accent-honglou)" fillOpacity=".42" />
          <path d="M18 -55L46 -56 50 13 20 14Z" fill="var(--gold)" fillOpacity=".5" />
          <path
            d="M-17 -52L-15 10M-12 -50L-10 10M25 -52L28 8M34 -52L37 8"
            fill="none"
            strokeWidth=".7"
          />
          <path d="M-25 -61L54 -63" strokeWidth="2" />
        </g>
      )}
      {name === '书坊' && (
        <g transform="translate(175 143)">
          <path d="M-4 -42L86 -45 86 20 -4 24Z" fill={gold} fillOpacity=".4" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(0 ${i * 17})`}>
              <path d="M0 -37L30 -39 31 -28 0 -26ZM40 -39L79 -40 79 -29 40 -28Z" fill={paper} />
              <path d="M3 -34L26 -35M44 -35L74 -37" fill="none" strokeWidth=".6" />
            </g>
          ))}
        </g>
      )}
      {name === '粟行' && (
        <g transform="translate(190 151)">
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(${i * 28} ${-Math.sin(i) * 10})`}>
              <path
                d="M-14 0Q-21 -15 -11 -33L-8 -40 8 -40 11 -32Q23 -8 13 0Z"
                fill="var(--gold)"
                fillOpacity=".42"
              />
              <path
                d="M-8 -39L8 -39M-7 -29L-12 -8M8 -27L13 -7M-5 -15L-7 -4"
                fill="none"
                strokeWidth=".65"
              />
            </g>
          ))}
        </g>
      )}
      {name === '陶坊' && (
        <g transform="translate(190 150)">
          <path
            d="M-24 -14L105 -20 105 -11 -24 -5M-17 -5L-17 13M94 -10L94 8"
            fill="none"
            strokeWidth="2"
          />
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(${i * 29 - 7} ${-19 - i * 1.6})`}>
              <path
                d="M-6 -24L6 -24 5 -17Q21 1 8 5L-8 5Q-21 -1 -5 -17Z"
                fill="var(--vermilion)"
                fillOpacity=".4"
              />
              <path d="M-6 -24Q0 -21 6 -24M-8 -4Q0 0 8 -4" fill="none" strokeWidth=".6" />
            </g>
          ))}
        </g>
      )}
      {name === '香药' && (
        <g transform="translate(177 78)">
          {Array.from({ length: 8 }, (_, i) => (
            <g key={i} transform={`translate(${(i % 4) * 22} ${Math.floor(i / 4) * 35})`}>
              <path d="M-7 0L7 0 9 19Q0 24 -9 19Z" fill="var(--jade)" fillOpacity=".3" />
              <path d="M-8 0L8 0M-6 9L6 9M-3 7L-3 15M1 7L1 15" fill="none" strokeWidth=".6" />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}
function Willow({
  x,
  y,
  scale = 1,
  seed = 0,
}: {
  x: number;
  y: number;
  scale?: number;
  seed?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      stroke={ink}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M-20 6Q-5 -7 -3 -59L-11 -149Q-15 -217 2 -271L15 -311Q8 -242 13 -184L23 -104Q15 -40 32 2L18 8 8 -8 -3 5Z"
        fill={shade}
        strokeWidth="1.6"
      />
      <path
        d="M0 -4Q8 -64 3 -116L-3 -164M9 -128Q0 -209 11 -263M17 -75L11 -34M-7 -148L1 -128"
        fill="none"
        strokeWidth="1"
        opacity=".7"
      />
      {[-1, 1].map((side, i) => (
        <g key={side}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`${side * 0.25} 5 -190;${side * 1.2} 5 -190;${side * 0.25} 5 -190`}
            dur={`${6 + i + seed * 0.17}s`}
            begin={`${-seed}s`}
            repeatCount="indefinite"
          />
          <path
            d={`M5 -188Q${side * 46} -294 ${side * 135} -281Q${side * 182} -267 ${side * 196} -239M7 -224Q${side * 42} -297 ${side * 125} -294M6 -261Q${side * 30} -308 ${side * 61} -319`}
            fill="none"
            strokeWidth="3"
          />
          <path
            d={`M${side * 7} -279Q${side * 34} -335 ${side * 85} -317Q${side * 112} -330 ${side * 143} -300Q${side * 186} -301 ${side * 208} -266L${side * 195} -199Q${side * 174} -172 ${side * 154} -211Q${side * 139} -174 ${side * 107} -205Q${side * 81} -163 ${side * 62} -211Q${side * 28} -192 ${side * 15} -227Z`}
            fill="var(--jade)"
            fillOpacity=".14"
            stroke="none"
          />
          {Array.from({ length: 23 }, (_, j) => {
            const a = j / 22,
              bx = side * (24 + a * 168),
              by = -249 - Math.sin(a * Math.PI) * 48,
              end = by + 72 + (j % 4) * 23;
            return (
              <g key={j}>
                <path
                  d={`M${bx} ${by}Q${bx + side * 17} ${by + 47} ${bx + side * 11} ${end}`}
                  fill="none"
                  stroke="var(--jade)"
                  strokeWidth=".9"
                />
                {[0.08, 0.18, 0.28, 0.35, 0.44, 0.55, 0.66, 0.76, 0.84, 0.92].map((v, k) => (
                  <path
                    key={v}
                    d={`M${bx + side * 12 * v} ${by + (end - by) * v}q${(k % 2 ? side : -side) * (7 + (k % 2) * 2)} 9 ${(k % 2 ? side : -side) * 4} 15q${(k % 2 ? -side : side) * 6} -5 ${(k % 2 ? -side : side) * 4} -15`}
                    fill="var(--jade)"
                    fillOpacity={0.28 + (j % 3) * 0.1}
                    strokeWidth=".4"
                  />
                ))}
              </g>
            );
          })}
        </g>
      ))}
      <path d="M-22 8L-31 12M17 10L41 12M-8 5L-16 12" stroke={gold} fill="none" />
    </g>
  );
}
function MarketStall({ x, y, fruit = false }: { x: number; y: number; fruit?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={ink} strokeWidth=".9" strokeLinejoin="round">
      <path
        d="M-75 -72L75 -80 92 -25 -85 -16Z"
        fill={fruit ? 'var(--accent-honglou)' : 'var(--gold)'}
        fillOpacity=".24"
      />
      <path
        d="M-85 -16L-86 -9Q-62 -2 -44 -10Q-16 -3 0 -11Q23 -5 45 -14Q69 -8 92 -20L92 -25"
        fill={paper}
      />
      <path d="M-75 -72L-74 53M75 -80L76 44M-70 3L75 -5 75 24 -70 33Z" fill={shade} />
      <path
        d="M-65 31L-65 57M68 25L68 50M-56 -73L-53 -18M-15 -75L-8 -20M29 -78L36 -22M61 -79L73 -24"
        fill="none"
      />
      {Array.from({ length: 5 }, (_, i) => (
        <g key={i} transform={`translate(${-49 + i * 25} ${2 - i * 1.4})`}>
          <ellipse cy="3" rx="11" ry="6" fill="var(--gold)" fillOpacity=".28" />
          {[0, 1, 2].map((j) => (
            <path
              key={j}
              d={
                fruit
                  ? `M${-6 + j * 5} 1q-4 -8 1 -8q6 0 4 7Z`
                  : `M${-8 + j * 5} 1q-2 -4 0 -7l2 -2q3 6 3 9Z`
              }
              fill={fruit ? 'var(--vermilion)' : 'var(--paper-raised)'}
              fillOpacity=".7"
              strokeWidth=".6"
            />
          ))}
        </g>
      ))}
    </g>
  );
}
function Boat({ cargo = false }: { cargo?: boolean }) {
  return (
    <g stroke={ink} strokeWidth="1" strokeLinejoin="round">
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;0 1.8;0 0"
          dur="3.7s"
          repeatCount="indefinite"
        />
        <path
          d="M-119 -8Q-91 11 104 -6L123 -21Q120 3 102 13Q-16 38 -101 17Z"
          fill={gold}
          fillOpacity=".56"
        />
        <path d="M-119 -8Q-20 -23 123 -21Q39 10 -101 7Z" fill={paper} />
        <path d="M-103 16Q-7 30 105 10M-98 10Q-8 22 109 3" fill="none" opacity=".5" />
        {Array.from({ length: 15 }, (_, i) => (
          <path
            key={i}
            d={`M${-92 + i * 13} 5L${-87 + i * 13} -15`}
            strokeWidth=".55"
            opacity=".55"
          />
        ))}
        <path d="M-32 0L-34 -37Q4 -84 51 -45L64 -6Z" fill={shade} />
        <path
          d="M-34 -37Q-1 -65 15 -25L18 -5M-22 -48Q13 -74 28 -27L32 -6M-8 -56Q30 -73 42 -27L46 -7M6 -57Q45 -65 53 -27"
          fill="none"
          strokeWidth="1.2"
        />
        <path d="M-31 -34L12 -23 15 -6 -30 -1Z" fill={ink} fillOpacity=".55" />
        {cargo && (
          <g>
            <path d="M58 -6L58 -28 78 -34 91 -16 88 -8Z" fill="var(--gold)" fillOpacity=".4" />
            <path
              d="M63 -8L62 -26M69 -10L69 -28M77 -9L76 -27M59 -17L88 -19"
              fill="none"
              strokeWidth=".6"
            />
          </g>
        )}
        <g transform="translate(-67 -5) scale(.8)">
          <StreetPerson role="boatman" seed={2} />
        </g>
      </g>
      <path
        d="M-127 29Q-90 37 -53 31M-100 38Q-35 42 27 29M-122 35Q-143 33 -151 37M113 19Q134 16 147 23"
        fill="none"
        stroke="var(--accent-shuihu)"
        opacity=".32"
      />
    </g>
  );
}
function PersonAt({
  x,
  y,
  role,
  scale = 1,
  seed = 0,
  path,
}: {
  x: number;
  y: number;
  role: StreetRole;
  scale?: number;
  seed?: number;
  path?: string;
}) {
  const label = {
    scholar: '读书人 · 圆领袍与幞头',
    woman: '行人 · 襦裙与披帛',
    porter: '挑担人 · 交领短衣与裹巾',
    boatman: '舟子 · 短衣与绑腿',
    monk: '行脚僧 · 袈裟',
    vendor: '商贩 · 交领短衣',
    child: '孩童 · 短襦',
  }[role];
  return (
    <g aria-label={label} role="img" className="street-resident">
      <title>{label}</title>
      {path ? (
        <g>
          <animateMotion
            path={path}
            dur={`${110 + seed * 11}s`}
            begin={`${-seed * 13}s`}
            repeatCount="indefinite"
            keyPoints="0;1;1;0;0"
            keyTimes="0;.44;.5;.94;1"
            calcMode="linear"
          />
          <g transform={`scale(${scale})`}>
            <StreetPerson role={role} seed={seed} walking />
          </g>
        </g>
      ) : (
        <g transform={`translate(${x} ${y}) scale(${scale})`}>
          <StreetPerson role={role} seed={seed} />
        </g>
      )}
    </g>
  );
}

export const StreetDrawing = memo(function StreetDrawing() {
  const river =
    'M3540 680C2910 655 2790 1020 2430 1100C2110 1175 1855 1055 1640 1180C1380 1345 1130 1435 730 1470L-160 1510L-160 2060C580 1925 1220 1830 1660 1630C2090 1425 2450 1510 2790 1305C3070 1135 3180 1095 3540 1100Z';
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fontFamily="var(--font-display)">
      <defs>
        <linearGradient id="street-ground-wash" x1="0" y1="0" x2=".4" y2="1">
          <stop stopColor={paper} />
          <stop offset="1" stopColor="var(--paper)" />
        </linearGradient>
        <linearGradient id="street-river-wash" x1="0" y1="0" x2=".7" y2="1">
          <stop stopColor="var(--scene-mist)" stopOpacity=".32" />
          <stop offset=".5" stopColor="var(--accent-shuihu)" stopOpacity=".14" />
          <stop offset="1" stopColor="var(--scene-mist)" stopOpacity=".4" />
        </linearGradient>
        <clipPath id="street-river">
          <path d={river} />
        </clipPath>
        <pattern id="street-bricks" width="54" height="32" patternUnits="userSpaceOnUse">
          <path
            d="M0 0H54M0 16H54M18 0V16M45 16V32"
            fill="none"
            stroke={gold}
            strokeWidth=".65"
            opacity=".28"
          />
        </pattern>
        <pattern id="street-earth" width="173" height="117" patternUnits="userSpaceOnUse">
          <path
            d="M18 24l13 -1m67 42 11 -2m30 33 6 -.5M56 98l8 -2M130 13l9 1"
            fill="none"
            stroke={gold}
            strokeWidth=".7"
            opacity=".17"
          />
        </pattern>
      </defs>
      <rect x="-1000" y="-1000" width="5500" height="4400" fill="url(#street-ground-wash)" />
      <g fill="var(--scene-mist)" stroke="var(--muted)" strokeOpacity=".16" opacity=".28">
        <path d="M-300 470L-60 240 108 290 267 104 365 191 491 118 667 296 814 244 1032 420 1320 340 1503 450 1670 272 1804 317 1960 185 2190 309 2390 230 2660 389 2970 269 3580 490Z" />
        <path d="M-300 536Q-60 427 130 431L340 334 570 477 899 389 1150 504 1522 421 1830 500 2100 380 2380 481 2740 407 3470 520Z" />
      </g>
      <g opacity=".7" stroke={ink} strokeWidth="1.2">
        <path d="M-150 526L3550 401 3550 585 -150 710Z" fill={shade} />
        <path d="M-150 526L3550 401 3550 585 -150 710Z" fill="url(#street-bricks)" />
        <path d="M-150 526L3550 401M-150 551L3550 426" fill="none" />
        {Array.from({ length: 47 }, (_, i) => (
          <path key={i} d={`M${-110 + i * 80} ${520 - i * 2.7}v-24h42v23h38`} fill={shade} />
        ))}
        <g transform="translate(1660 412)">
          <path
            d="M-130 0L130 -5 137 189 57 192Q55 89 0 96Q-56 95 -58 197L-133 199Z"
            fill={shade}
          />
          <path
            d="M-130 0L130 -5 137 189 57 192Q55 89 0 96Q-56 95 -58 197L-133 199Z"
            fill="url(#street-bricks)"
          />
          <path d="M-91 8L-91 -126 91 -129 91 6Z" fill={paper} />
          <path
            d="M-78 -107L-78 -7M-40 -108L-40 -8M0 -110L0 -8M40 -111L40 -10M78 -111L78 -12"
            stroke="var(--vermilion)"
            strokeWidth="4"
          />
          <Roof x={-118} y={-117} width={238} rise={78} />
          <Roof x={-145} y={3} width={292} rise={54} />
          <path d="M-12 109Q12 105 34 128L51 189 -3 192Z" fill={ink} fillOpacity=".65" />
        </g>
      </g>
      <rect x="-80" y="600" width="3600" height="1500" fill="url(#street-earth)" />
      <path
        d="M1550 609C1350 759 1540 900 1630 978C1820 1100 2160 1002 2350 964L2870 804"
        fill="none"
        stroke={shade}
        strokeWidth="126"
        opacity=".55"
      />
      <path
        d="M1558 613C1430 800 1560 923 1670 976C1910 1085 2240 979 2380 954"
        fill="none"
        stroke={gold}
        strokeOpacity=".25"
        strokeWidth="1.2"
        strokeDasharray="40 17 12 29"
      />
      <Willow x={1110} y={843} scale={0.62} seed={2} />
      <Willow x={2890} y={718} scale={0.66} seed={6} />
      <Shop x={300} y={810} width={316} name="茶肆" seed={1} />
      <Shop x={690} y={772} width={248} name="绢帛" seed={3} />
      <Shop x={1090} y={693} width={260} name="书坊" seed={2} />
      <Shop x={2180} y={684} width={302} name="粟行" seed={5} />
      <Shop x={2570} y={649} width={250} name="酒舍" seed={1} />
      <g stroke={gold} strokeWidth="1" opacity=".3" fill="none">
        <path d="M286 995Q770 945 1140 904M309 1006L502 986M571 976L886 938M1150 851L1360 810M2181 857L2476 823M2554 809L2788 791" />
      </g>
      <PersonAt x={1164} y={913} role="scholar" seed={3} scale={0.82} />
      <PersonAt x={1201} y={918} role="vendor" seed={7} scale={0.82} />
      <PersonAt
        x={0}
        y={0}
        role="porter"
        seed={4}
        scale={0.83}
        path="M773 1036Q1090 967 1415 859Q1494 812 1535 715"
      />
      <PersonAt
        x={0}
        y={0}
        role="woman"
        seed={7}
        scale={0.84}
        path="M1390 875Q1642 1000 1894 1008L2165 956"
      />
      <PersonAt x={2369} y={910} role="monk" scale={0.86} seed={2} />
      <PersonAt x={2427} y={915} role="scholar" scale={0.84} seed={6} />
      <MarketStall x={878} y={1052} />
      <PersonAt x={863} y={1043} role="vendor" seed={5} scale={0.86} />
      <MarketStall x={1290} y={1031} fruit />
      <PersonAt x={1300} y={1026} role="vendor" seed={7} scale={0.86} />
      <g stroke={ink} strokeWidth=".8" transform="translate(512 1025)">
        <path d="M-42 -9L48 -12 48 2 -42 5Z" fill={shade} />
        <path
          d="M-34 5L-34 30M39 3L39 26M-17 -13Q-21 -27 -10 -27Q-1 -25 -5 -14ZM12 -14L13 -24 20 -24 22 -14"
          fill={paper}
        />
        <path
          d="M-45 23L-45 31 -14 29 -14 21ZM25 20L25 28 56 26 56 18Z"
          fill={gold}
          fillOpacity=".3"
        />
      </g>
      <PersonAt x={502} y={1076} role="scholar" seed={4} scale={0.9} />
      <PersonAt x={570} y={1083} role="vendor" seed={1} scale={0.9} />
      <path
        d={river}
        fill="url(#street-river-wash)"
        stroke="var(--muted)"
        strokeWidth="1.1"
        strokeOpacity=".45"
      />
      <g clipPath="url(#street-river)" fill="none" stroke="var(--accent-shuihu)">
        {Array.from({ length: 34 }, (_, i) => (
          <path
            key={i}
            d={`M-300 ${1640 + i * 13}C650 ${1610 + i * 11} 1120 ${1590 + i * 9} 1680 ${1320 + i * 9}S2540 ${1400 + i * 6} 2940 ${940 + i * 7}S3370 ${920 + i * 6} 3660 ${820 + i * 7}`}
            opacity={0.1 + (i % 4) * 0.025}
            strokeWidth={i % 5 === 0 ? 1.3 : 0.8}
            strokeDasharray={`${18 + (i % 4) * 8} ${190 + (i % 7) * 29} 8 89`}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-900"
              dur={`${29 + (i % 5) * 4}s`}
              repeatCount="indefinite"
            />
          </path>
        ))}
        {Array.from({ length: 26 }, (_, i) => (
          <path
            key={`r-${i}`}
            d={`M${-50 + i * 144} ${1645 - Math.sin(i * 0.18) * 310}q28 -7 53 -2m8 1 17 -1`}
            opacity=".25"
            strokeWidth=".8"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="80 -10;-80 10"
              dur={`${14 + (i % 4) * 3}s`}
              begin={`${-i}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;.28;0"
              dur={`${14 + (i % 4) * 3}s`}
              begin={`${-i}s`}
              repeatCount="indefinite"
            />
          </path>
        ))}
        <path
          d="M2340 1150Q2570 1080 2710 925M1350 1456Q1510 1400 1600 1350M380 1745L880 1660"
          stroke={paper}
          strokeWidth="3"
          opacity=".3"
          strokeDasharray="37 120 10 90"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-850"
            dur="37s"
            repeatCount="indefinite"
          />
        </path>
      </g>
      <g stroke={ink} strokeWidth="1" fill="none" opacity=".55">
        <path d="M-100 1500C790 1489 1270 1388 1634 1174C1850 1043 2120 1172 2430 1095C2795 1017 2910 650 3500 678M-100 1515C800 1502 1290 1395 1645 1188" />
        <path d="M-100 2058C580 1926 1230 1822 1661 1634C2090 1422 2450 1505 2790 1309C3070 1135 3180 1092 3500 1101" />
      </g>
      <g>
        <animateMotion
          path="M2940 1030C2560 1230 2280 1306 1810 1370C1250 1620 670 1670 120 1780"
          dur="150s"
          begin="-43s"
          keyPoints="0;1;1;0;0"
          keyTimes="0;.44;.5;.94;1"
          calcMode="linear"
          repeatCount="indefinite"
        />
        <Boat cargo />
      </g>
      <g>
        <animateMotion
          path="M210 1870C920 1765 1240 1700 1775 1455C2200 1364 2620 1300 3090 1020"
          dur="190s"
          begin="-132s"
          keyPoints="0;1;1;0;0"
          keyTimes="0;.44;.5;.94;1"
          calcMode="linear"
          repeatCount="indefinite"
        />
        <g transform="scale(.84)">
          <Boat />
        </g>
      </g>
      <g stroke={ink} strokeWidth="1.2" fill="none">
        {[0.16, 0.4, 0.65, 0.88].map((t) => (
          <g key={t} transform={`translate(${1810 + 245 * t} ${1125 + 410 * t})`}>
            <path
              d="M0 0L-2 93 8 94 12 1M76 -17L74 79 84 78 87 -19"
              fill={gold}
              fillOpacity=".55"
            />
            <path d="M-2 34L84 74M84 16L8 88" strokeWidth="3" />
            <path
              d="M-7 97q18 5 28 -2M69 85q19 5 29 -2"
              stroke="var(--accent-shuihu)"
              opacity=".35"
            />
          </g>
        ))}
        <path d="M1810 1125L1890 1107 2135 1517 2055 1538Z" fill={shade} />
        <path d="M1810 1125L2055 1538 2057 1551 1810 1138Z" fill={gold} fillOpacity=".5" />
        {Array.from({ length: 33 }, (_, i) => {
          const t = i / 32;
          return (
            <path
              key={i}
              d={`M${1810 + 245 * t} ${1125 + 413 * t}L${1890 + 245 * t} ${1107 + 410 * t}`}
              opacity=".65"
              strokeWidth=".7"
            />
          );
        })}
        {[0, 0.16, 0.32, 0.48, 0.64, 0.8, 1].map((t) => (
          <g key={t}>
            <path
              d={`M${1810 + 245 * t} ${1125 + 413 * t}v-50M${1890 + 245 * t} ${1107 + 410 * t}v-50`}
              strokeWidth="4"
            />
            <path
              d={`M${1806 + 245 * t} ${1075 + 413 * t}q4 -8 8 0M${1886 + 245 * t} ${1057 + 410 * t}q4 -8 8 0`}
              fill={paper}
            />
          </g>
        ))}
        <path
          d="M1810 1075L2055 1488M1810 1095L2055 1508M1890 1057L2135 1467M1890 1077L2135 1487"
          strokeWidth="2.5"
        />
      </g>
      <PersonAt x={1945} y={1285} role="woman" scale={0.9} seed={3} />
      <PersonAt x={1978} y={1315} role="child" scale={0.51} seed={6} />
      <g stroke={ink} strokeWidth="1.1" transform="translate(2640 1418)">
        <path d="M0 0L164 -69 169 -58 8 16Z" fill={shade} />
        {Array.from({ length: 6 }, (_, i) => (
          <path
            key={i}
            d={`M${i * 15} ${i * 9}L${164 + i * 15} ${-69 + i * 9}l1 10L${i * 15 + 1} ${i * 9 + 10}Z`}
            fill={shade}
          />
        ))}
        <path d="M-3 -7L163 -76M-4 -12L162 -81" fill="none" />
      </g>
      <g stroke={gold} strokeWidth=".8" opacity=".36" fill="none">
        <path d="M80 2060Q910 1929 1290 1820M1400 1775L1680 1650M1780 1610L2190 1522M2280 1500L2580 1436M2990 1330L3430 1130" />
        {Array.from({ length: 19 }, (_, i) => (
          <path key={i} d={`M${500 + i * 140} ${2000 - i * 41}l25 -7m-13 11 9 -2`} />
        ))}
      </g>
      <Shop x={310} y={1910} width={353} name="陶坊" seed={2} />
      <Shop x={840} y={1785} width={306} name="香药" seed={5} />
      <Shop x={2400} y={1662} width={336} name="客舍" seed={1} />
      <PersonAt
        x={0}
        y={0}
        role="porter"
        scale={1.04}
        seed={9}
        path="M1180 1872Q1540 1715 1850 1632L2320 1531"
      />
      <PersonAt x={1467} y={1784} role="woman" scale={1.02} seed={3} />
      <PersonAt x={1518} y={1790} role="child" scale={0.64} seed={4} />
      <PersonAt x={2494} y={1868} role="scholar" scale={1.05} seed={6} />
      <PersonAt x={2550} y={1871} role="vendor" scale={1.06} seed={2} />
      <Willow x={3000} y={1535} scale={1.08} seed={7} />
      <Willow x={1090} y={1504} scale={0.87} seed={1} />
      <Willow x={135} y={1488} scale={0.9} seed={3} />
      <g fill="var(--jade)" fillOpacity=".27" stroke="var(--muted)" strokeWidth=".7">
        {[
          [2770, 1440],
          [2820, 1430],
          [2900, 1410],
          [910, 1510],
          [947, 1505],
          [980, 1490],
          [1450, 1700],
          [1485, 1685],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={`-1 ${x} ${y};2 ${x} ${y};-1 ${x} ${y}`}
              dur={`${4 + i * 0.2}s`}
              repeatCount="indefinite"
              additive="sum"
            />
            <path d="M0 0Q-6 -28 -19 -42Q-7 -39 0 -20Q-1 -64 9 -74Q4 -35 2 -6Q12 -42 27 -46Q11 -28 5 0Z" />
          </g>
        ))}
      </g>
      <g stroke={ink} strokeWidth=".8" opacity=".45" fill="none">
        <path d="M2950 1551l24 -3 21 5M1100 1519l-24 -2M130 1500l-23 4 34 2" />
      </g>
    </g>
  );
});
