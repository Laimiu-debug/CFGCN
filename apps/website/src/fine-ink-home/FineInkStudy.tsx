import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { GameId, Locale } from '@cfgcn/shared';
import { Button } from '@cfgcn/ui';
import { atlasCopy } from './atlas-copy';
import { FineInkLife, type InkTouch } from './FineInkLife';
import {
  FineInkDepth,
  type InkDepthLayout,
  type InkDepthApi,
  type DepthProjection,
} from './FineInkDepth';
import './fine-ink-study.css';
import { inkZoomLimit } from './ink-surface';

type Layout = InkDepthLayout;
const order: GameId[] = ['xiyou', 'sanguo', 'shuihu', 'honglou'];
const ChanganStreet = lazy(() => import('./ChanganStreet'));
export function FineInkStudy({
  locale,
  reducedMotion,
  onMotionChange,
  onEnter,
}: {
  locale: Locale;
  reducedMotion: boolean;
  onMotionChange: (value: boolean) => void;
  onEnter: (id: GameId, direct?: boolean) => void;
}) {
  const text = atlasCopy[locale];
  const root = useRef<HTMLElement>(null);
  const depthApi = useRef<InkDepthApi | null>(null);
  const cityNodes = useRef<Partial<Record<GameId, HTMLDivElement | null>>>({});
  const labelNodes = useRef<Partial<Record<GameId, HTMLDivElement | null>>>({});
  const projections = useRef<DepthProjection | null>(null);
  const hintNode = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    cx: number;
    cy: number;
    moved: boolean;
  } | null>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [layout, setLayout] = useState<Layout>();
  const [imageReady, setImageReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ width: 1280, height: 800 });
  const maxZoom = inkZoomLimit(size);
  const [view, setView] = useState({ x: 1200, y: 720, zoom: 1, whole: false });
  const [selected, setSelected] = useState<GameId | null>(null);
  const [hover, setHover] = useState<GameId | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [touch, setTouch] = useState<InkTouch | null>(null);
  const [follow, setFollow] = useState<string | null>(null);
  const [entering, setEntering] = useState<GameId | null>(null);
  const [lifeReady, setLifeReady] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [street, setStreet] = useState(false);
  useEffect(() => {
    setView((old) => (old.zoom > maxZoom ? { ...old, zoom: maxZoom } : old));
  }, [maxZoom]);
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/art/atlas/fine-ink/depth-v3/layout.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Fine-ink layout unavailable');
        return response.json() as Promise<Layout>;
      })
      .then(setLayout)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    const element = root.current!;
    let firstSize = true;
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
      if (firstSize && width / height < 1) setView((old) => ({ ...old, x: 930, y: 710 }));
      firstSize = false;
    });
    resize.observe(element);
    return () => {
      resize.disconnect();
      controller.abort();
      if (enterTimer.current) clearTimeout(enterTimer.current);
    };
  }, []);
  const width = layout?.width ?? 2400;
  const height = layout?.height ?? 1501;
  const base = view.whole
    ? Math.min(size.width / width, size.height / height)
    : Math.max(size.width / width, size.height / height) / 0.88;
  const scale = base * view.zoom;
  const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
  const cx =
    size.width / scale >= width
      ? width / 2
      : clamp(view.x, size.width / scale / 2, width - size.width / scale / 2);
  const cy =
    size.height / scale >= height
      ? height / 2
      : clamp(view.y, size.height / scale / 2, height - size.height / scale / 2);
  const visit = (id: GameId) => {
    if (!layout) return;
    setInspect(false);
    setFollow(null);
    const p = layout.places[id];
    setSelected(id);
    setView({
      x: p.x,
      y: p.y - 30,
      zoom: Math.min(maxZoom, size.width > 700 ? 1.35 : 1),
      whole: false,
    });
  };
  const zoom = (factor: number) => {
    setInspect(false);
    setFollow(null);
    setView((old) => ({ x: cx, y: cy, whole: false, zoom: clamp(old.zoom * factor, 1, maxZoom) }));
  };
  const overview = () => {
    setInspect(false);
    setSelected(null);
    setFollow(null);
    setView({ x: 1200, y: 750.5, zoom: 1, whole: true });
  };
  const enterTown = (id: GameId) => {
    if (enterTimer.current || entering) return;
    visit(id);
    setHover(null);
    setEntering(id);
    enterTimer.current = setTimeout(() => onEnter(id, true), reducedMotion ? 0 : 650);
  };
  const hintPlace = hover ? projections.current?.[hover] : null;
  const hintX = hintPlace ? clamp(hintPlace.x + 35, 16, Math.max(16, size.width - 240)) : 0;
  const hintY = hintPlace ? clamp(hintPlace.y, 105, size.height - 210) : 0;
  const projectMarkers = (projected: DepthProjection) => {
    projections.current = projected;
    for (const id of order) {
      const p = projected[id],
        city = cityNodes.current[id],
        label = labelNodes.current[id];
      const visible =
        p.left + p.width > 0 &&
        p.left < size.width &&
        p.top + p.height > 90 &&
        p.top < size.height - 110;
      const labelMargin = locale === 'en' ? 64 : 35;
      p.x = clamp(p.x, labelMargin, size.width - labelMargin);
      p.y = clamp(p.y, 120, size.height - 135);
      if (city) {
        city.style.visibility = visible ? 'visible' : 'hidden';
        city.style.left = `${p.left}px`;
        city.style.top = `${p.top}px`;
        city.style.width = `${p.width}px`;
        city.style.height = `${p.height}px`;
      }
      if (label) {
        label.style.visibility = visible ? 'visible' : 'hidden';
        label.style.left = `${p.x}px`;
        label.style.top = `${p.y}px`;
      }
    }
    if (hoverRef.current && hintNode.current) {
      const p = projected[hoverRef.current];
      hintNode.current.style.left = `${clamp(p.x + 35, 16, Math.max(16, size.width - 240))}px`;
      hintNode.current.style.top = `${clamp(p.y, 105, size.height - 210)}px`;
    }
  };
  return (
    <section
      ref={root}
      className="fine-ink-study"
      data-ready={layout && imageReady && lifeReady ? 'true' : 'false'}
      data-recipe={layout?.version}
      data-center={`${cx.toFixed(1)},${cy.toFixed(1)}`}
      data-zoom={view.zoom.toFixed(2)}
      data-motion={reducedMotion ? 'reduced' : 'full'}
      data-follow={follow ?? 'none'}
      data-entering={entering ?? 'none'}
      data-street={street}
      aria-label={locale === 'en' ? 'Living ink landscape' : '细笔水墨山河世界'}
    >
      <h1 className="sr-only">{text.title}</h1>
      <div
        className="fine-ink-navigation"
        tabIndex={0}
        role="region"
        aria-label={
          locale === 'en'
            ? 'World. Arrow keys pan, plus and minus zoom, Home shows the full landscape. Touch the river for ripples.'
            : '山河，方向键平移，加减键缩放，Home 查看全景，点水泛涟漪'
        }
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const delta = 70 / scale;
          const directions: Record<string, [number, number]> = {
            ArrowLeft: [-delta, 0],
            ArrowRight: [delta, 0],
            ArrowUp: [0, -delta],
            ArrowDown: [0, delta],
          };
          if (directions[event.key]) {
            event.preventDefault();
            setInspect(false);
            setFollow(null);
            const [dx, dy] = directions[event.key];
            setView((old) => ({ ...old, x: cx + dx, y: cy + dy }));
          } else if (['+', '=', '-', 'Home', 'Escape'].includes(event.key)) {
            event.preventDefault();
            if (event.key === 'Home' || event.key === 'Escape') overview();
            else zoom(event.key === '-' ? 0.82 : 1.22);
          }
        }}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button')) return;
          setFollow(null);
          setInspect(false);
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            cx,
            cy,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!reducedMotion) {
            const bounds = event.currentTarget.getBoundingClientRect();
            setPointer({
              x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
              y: ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
            });
          }
          const current = drag.current;
          if (!current || current.id !== event.pointerId) return;
          const dx = (event.clientX - current.x) / scale;
          const dy = (event.clientY - current.y) / scale;
          if (Math.abs(dx) + Math.abs(dy) > 6 / scale) current.moved = true;
          if (current.moved && !view.whole)
            setView((old) => ({ ...old, x: current.cx - dx, y: current.cy - dy }));
        }}
        onPointerUp={(event) => {
          const current = drag.current;
          if (current && !current.moved) {
            const bounds = event.currentTarget.getBoundingClientRect();
            const hit = depthApi.current?.pick(
              event.clientX - bounds.left,
              event.clientY - bounds.top,
            );
            if (hit) setTouch((old) => ({ ...hit, serial: (old?.serial ?? 0) + 1 }));
          }
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        {layout && (
          <FineInkDepth
            layout={layout}
            size={size}
            view={{ x: cx, y: cy, zoom: view.zoom, whole: view.whole }}
            pointer={pointer}
            reducedMotion={reducedMotion || entering !== null || street}
            inspect={inspect}
            api={depthApi}
            onReady={() => setImageReady(true)}
            onError={() => setFailed(true)}
            onProject={projectMarkers}
          />
        )}
        {layout && (
          <FineInkLife
            depth
            onDepthFrame={(frame) => depthApi.current?.frame(frame)}
            camera={{ x: 0, y: 0, scale: 1586 / 2400, width: 1586, height: 992 }}
            paused={reducedMotion || entering !== null || street}
            ready={imageReady}
            water={layout.life.water}
            waterMask={layout.life.waterMask}
            shoreFront={layout.life.shoreFront}
            occluders={[]}
            pointer={{ x: 0, y: 0 }}
            touch={touch}
            follow={follow}
            onFollow={(fx, fy) =>
              setView((old) => ({
                ...old,
                x: fx,
                y: fy,
                zoom: Math.min(maxZoom, size.width > 700 ? 1.35 : 1.05),
                whole: false,
              }))
            }
            onReady={() => setLifeReady(true)}
          />
        )}
        <div className="fine-ink-markers">
          {layout &&
            order.map((id) => {
              return (
                <div
                  className="fine-ink-city"
                  key={`city-${id}`}
                  ref={(node) => {
                    cityNodes.current[id] = node;
                  }}
                >
                  <Button
                    variant="quiet"
                    className="fine-ink-city-target"
                    aria-label={`${locale === 'en' ? 'Enter' : '进入'} ${text.places[id]} · ${text.eras[id]}`}
                    aria-describedby={hover === id ? 'fine-ink-town-hint' : undefined}
                    onPointerEnter={() => setHover(id)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(id)}
                    onBlur={() => setHover(null)}
                    onClick={() => enterTown(id)}
                  />
                </div>
              );
            })}
          {layout &&
            order.map((id) => {
              return (
                <div
                  className="fine-ink-place"
                  key={id}
                  ref={(node) => {
                    labelNodes.current[id] = node;
                  }}
                  data-selected={selected === id}
                  data-hover={hover === id}
                >
                  <Button
                    variant="quiet"
                    className="fine-ink-place-name"
                    aria-label={`${text.places[id]} · ${locale === 'en' ? 'Enter story' : '点击入境'}`}
                    aria-describedby={hover === id ? 'fine-ink-town-hint' : undefined}
                    aria-pressed={selected === id}
                    onClick={() => enterTown(id)}
                    onPointerEnter={() => setHover(id)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(id)}
                    onBlur={() => setHover(null)}
                  >
                    {text.places[id]}
                  </Button>
                </div>
              );
            })}
        </div>
      </div>
      {hover && (
        <div
          id="fine-ink-town-hint"
          ref={hintNode}
          role="tooltip"
          className="fine-ink-town-hint"
          style={{ left: hintX, top: hintY }}
        >
          <strong>{text.places[hover]}</strong>
          <span>{text.eras[hover]}</span>
          <small>{locale === 'en' ? 'Enter story →' : '点击入境 →'}</small>
        </div>
      )}
      {failed && (
        <p role="alert" className="fine-ink-status">
          {text.failure}
        </p>
      )}
      {!imageReady && !failed && (
        <p role="status" className="fine-ink-status">
          {text.loading}
        </p>
      )}
      <div className="fine-ink-tools" role="group" aria-label={text.title}>
        <Button
          data-street-entry
          variant="control"
          aria-label={locale === 'en' ? 'Inspect Chang’an street' : '细看长安市井'}
          onClick={() => {
            setFollow(null);
            setInspect(false);
            setStreet(true);
          }}
        >
          <svg
            viewBox="0 0 28 28"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M17 17L26 26M6 14V9L11 6 16 9V14M9 14V11H13V14" />
          </svg>
        </Button>
        <Button
          variant="control"
          aria-label={text.zoomIn}
          disabled={!view.whole && view.zoom >= maxZoom - 0.001}
          onClick={() => zoom(1.22)}
        >
          ＋
        </Button>
        <Button
          variant="control"
          aria-label={text.zoomOut}
          disabled={view.zoom <= 1 && !view.whole}
          onClick={() => zoom(0.82)}
        >
          −
        </Button>
        <Button
          variant="control"
          aria-label={text.lookAround}
          aria-pressed={inspect}
          disabled={reducedMotion}
          onClick={() => {
            setFollow(null);
            setView((old) => ({ ...old, x: cx, y: cy, whole: false }));
            setInspect((old) => !old);
          }}
        >
          ◇
        </Button>
        <Button
          variant="control"
          aria-label={locale === 'en' ? 'Full painting' : '查看全卷'}
          onClick={overview}
        >
          ⌑
        </Button>
        <Button
          variant="control"
          aria-label={
            locale === 'en'
              ? follow
                ? 'Leave the boat'
                : 'Follow a ferry'
              : follow
                ? '离舟自由游览'
                : '随舟游览'
          }
          aria-pressed={Boolean(follow)}
          disabled={reducedMotion}
          onClick={() => {
            setInspect(false);
            setSelected(null);
            setFollow((old) => (old ? null : 'han-ferry'));
          }}
        >
          <svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true">
            <path
              d="M3 19Q13 23 25 18L21 24H8ZM14 4V18M16 5Q23 10 21 15H16M6 14Q9 10 12 14V18H6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
        </Button>
      </div>
      <div className="fine-ink-compass" aria-hidden="true">
        {text.north}
        <span>↑</span>
      </div>
      <div className="fine-ink-caption" aria-hidden="true">
        {follow
          ? locale === 'en'
            ? 'ALONG THE RIVER'
            : '随舟 · 沿江而行'
          : locale === 'en'
            ? 'LIVING INK LANDSCAPE'
            : '四方山河 · 生生不息'}
      </div>
      <nav className="fine-ink-tour" aria-label={text.hint}>
        {order.map((id) => (
          <Button
            variant="quiet"
            key={id}
            aria-label={`${text.visit} ${text.places[id]}`}
            aria-pressed={selected === id}
            onClick={() => visit(id)}
          >
            {text.places[id]}
          </Button>
        ))}
        {selected && (
          <Button variant="primary" onClick={() => enterTown(selected)}>
            {locale === 'en' ? 'Enter' : '入境'}
          </Button>
        )}
      </nav>
      <label className="fine-ink-motion">
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={(event) => onMotionChange(event.target.checked)}
        />
        {text.motion}
      </label>
      {entering && (
        <div className="fine-ink-entering" role="status">
          {locale === 'en' ? 'Entering ' : '入'}
          {text.places[entering]}
        </div>
      )}
      {street && (
        <Suspense
          fallback={
            <p role="status" className="fine-ink-status">
              {text.loading}
            </p>
          }
        >
          <ChanganStreet
            locale={locale}
            reducedMotion={reducedMotion}
            onClose={() => {
              setStreet(false);
              requestAnimationFrame(() =>
                root.current?.querySelector<HTMLButtonElement>('[data-street-entry]')?.focus(),
              );
            }}
            onEnter={() => onEnter('xiyou', true)}
          />
        </Suspense>
      )}
    </section>
  );
}
