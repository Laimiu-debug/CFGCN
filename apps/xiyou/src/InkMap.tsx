import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, KeyboardEvent } from 'react';
import { Button } from '@cfgcn/ui';
import type { Locale } from '@cfgcn/shared';
import type { MapPosition } from './expedition-map';
import { fogKey, mapPointAt } from './map-exploration';
import type { MapChart, MapMark } from './map-exploration';
import { paintInkMap } from './ink-map-paint';
import { MapGlyph } from './MapGlyph';
import mapSymbols from '../art/ink-settlement/map-symbols.json';

type Props = {
  center: MapPosition;
  player: MapPosition;
  span: number;
  charts: MapChart[];
  fog: Set<string>;
  revision: number;
  label: string;
  miniature?: boolean;
  locale?: Locale;
  marks: MapMark[];
  markLabel: string;
  selected?: string | null;
  select?: (id: string) => void;
  place?: (p: MapPosition) => void;
  request: (value: Record<string, unknown>) => void;
  pan?: (p: MapPosition) => void;
};
export function InkMap({
  center,
  player,
  span,
  charts,
  fog,
  revision,
  label,
  miniature,
  locale,
  marks,
  markLabel,
  selected,
  select,
  place,
  request,
  pan,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    pos: MapPosition;
    id: number;
    moved: boolean;
  } | null>(null);
  const pointers = useRef(new Set<number>());
  const [symbols, setSymbols] = useState<HTMLImageElement | null>(null);
  const [portrait, setPortrait] = useState<HTMLImageElement | null>(null);
  const [box, setBox] = useState({ height: miniature ? 320 : 800, unit: 1 });
  const width = miniature ? 320 : 800;
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const resize = () => {
      const r = element.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const next = {
        height: Math.max(1, Math.round((width * r.height) / r.width)),
        unit: width / r.width,
      };
      setBox((old) => (old.height === next.height && old.unit === next.unit ? old : next));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, [width]);
  const dataSpan = span <= 192 ? 256 : span <= 384 ? 512 : 1024;
  const q = dataSpan / 8,
    x = Math.round(center.x / q) * q,
    z = Math.round(center.z / q) * q;
  const chart = charts.find((c) => c.span === dataSpan && c.x === x && c.z === z);
  useEffect(() => {
    if (chart) return;
    const timer = setTimeout(() => request({ chart_request: [x, z, dataSpan] }), 80);
    return () => clearTimeout(timer);
  }, [chart, x, z, dataSpan, request]);
  useEffect(() => {
    const art = new Image(),
      head = new Image();
    art.onload = () => setSymbols(art);
    head.onload = () => setPortrait(head);
    art.src = `/games/xiyou/assets/ink-map-symbols.png?v=${mapSymbols.sha256.slice(0, 12)}`;
    head.src = '/games/xiyou/assets/ink-map-wukong.png';
    return () => {
      art.onload = head.onload = null;
    };
  }, []);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx)
      paintInkMap(ctx, { center, player, span, chart, fog, miniature, symbols, portrait, locale });
  }, [
    chart,
    center.x,
    center.z,
    player.x,
    player.z,
    span,
    symbols,
    portrait,
    fog,
    revision,
    miniature,
    box,
    locale,
  ]);

  const finish = (event: PointerEvent<HTMLCanvasElement>, cancel = false) => {
    const d = drag.current;
    pointers.current.delete(event.pointerId);
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (cancel || d.moved || Math.hypot(event.clientX - d.x, event.clientY - d.y) > 6 || !place)
      return;
    const r = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - r.left,
      py = event.clientY - r.top;
    if (px >= 0 && py >= 0 && px <= r.width && py <= r.height)
      place(mapPointAt(px, py, r.width, r.height, d.pos, span));
  };
  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!pan || event.button !== 0) return;
    pointers.current.add(event.pointerId);
    if (pointers.current.size !== 1) {
      drag.current = null;
      return;
    }
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      pos: { ...center },
      id: event.pointerId,
      moved: false,
    };
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || !pan || d.id !== event.pointerId || pointers.current.size !== 1) return;
    if (Math.hypot(event.clientX - d.x, event.clientY - d.y) > 6) d.moved = true;
    if (!d.moved) return;
    const r = event.currentTarget.getBoundingClientRect(),
      pixels = Math.max(r.width, r.height);
    pan({
      x: d.pos.x + ((event.clientX - d.x) * span) / pixels,
      z: d.pos.z + ((event.clientY - d.y) * span) / pixels,
    });
  };
  const keys = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!pan) return;
    if (event.key === 'Enter' && place) {
      event.preventDefault();
      place({ ...center });
      return;
    }
    const delta = span / 8;
    const v = (
      {
        ArrowLeft: [delta, 0],
        ArrowRight: [-delta, 0],
        ArrowUp: [0, delta],
        ArrowDown: [0, -delta],
      } as Record<string, number[]>
    )[event.key];
    if (v) {
      event.preventDefault();
      event.stopPropagation();
      pan({ x: center.x + v[0], z: center.z + v[1] });
    }
  };
  const size = Math.max(width, box.height),
    hit = 44 * box.unit;
  const visible = marks
    .map((m, i) => ({
      ...m,
      index: i + 1,
      x: ((center.x - m.pos.x) * size) / span + width / 2,
      y: ((center.z - m.pos.z) * size) / span + box.height / 2,
    }))
    .filter(
      (m) =>
        fog.has(fogKey(m.pos.x, m.pos.z)) &&
        m.x > -hit / 2 &&
        m.x < width + hit / 2 &&
        m.y > -hit / 2 &&
        m.y < box.height + hit / 2,
    );
  return (
    <div className="expedition-ink-map">
      <canvas
        ref={canvas}
        width={width}
        height={box.height}
        role="img"
        aria-label={label}
        tabIndex={pan ? 0 : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
        onLostPointerCapture={(e) => finish(e, true)}
        onKeyDown={keys}
      />
      <svg
        className="expedition-map-overlay"
        viewBox={`0 0 ${width} ${box.height}`}
        preserveAspectRatio="none"
        aria-hidden={miniature || undefined}
      >
        {place && (
          <path
            className="expedition-map-crosshair"
            d={`M${width / 2 - 10 * box.unit} ${box.height / 2}h${20 * box.unit}M${width / 2} ${box.height / 2 - 10 * box.unit}v${20 * box.unit}`}
          />
        )}
        {visible.map((m) =>
          miniature ? (
            <g
              key={m.id}
              className="expedition-map-mini-mark"
              transform={`translate(${m.x - hit / 4} ${m.y - hit / 2}) scale(${hit / 80})`}
            >
              <path d="M12 35V6M13 7Q21 2 30 8L27 18Q20 13 13 19M8 35H18" />
            </g>
          ) : (
            <foreignObject
              key={m.id}
              x={m.x - hit / 2}
              y={m.y - hit * 0.8}
              width={hit}
              height={hit}
            >
              <Button
                variant="icon"
                className="expedition-map-mark"
                aria-label={`${markLabel} ${m.index} · ${Math.round(m.pos.x)}, ${Math.round(m.pos.z)}`}
                title={`${markLabel} ${m.index}`}
                aria-pressed={selected === m.id}
                onClick={() => select?.(m.id)}
              >
                <MapGlyph kind="flag" />
              </Button>
            </foreignObject>
          ),
        )}
      </svg>
    </div>
  );
}
