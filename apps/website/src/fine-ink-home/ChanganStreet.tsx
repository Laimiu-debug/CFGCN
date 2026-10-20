import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@cfgcn/shared';
import { Button } from '@cfgcn/ui';
import { StreetDrawing } from './StreetDrawing';
import { streetHome, streetView, streetZoom, type StreetCamera } from './street-camera';
import './changan-street.css';

export default function ChanganStreet({
  locale,
  reducedMotion,
  onClose,
  onEnter,
}: {
  locale: Locale;
  reducedMotion: boolean;
  onClose: () => void;
  onEnter: () => void;
}) {
  const en = locale === 'en',
    root = useRef<HTMLElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 1280, height: 720 });
  const [camera, setCamera] = useState<StreetCamera>(streetHome);
  const [hidden, setHidden] = useState(document.hidden);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ camera: StreetCamera; x: number; y: number; distance: number } | null>(
    null,
  );
  const latest = useRef({ camera, size });
  latest.current = { camera, size };
  const view = streetView(camera, size.width, size.height),
    paused = reducedMotion || hidden;
  useEffect(() => {
    const element = root.current!;
    element.focus();
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest('button')) return;
      event.preventDefault();
      const b = element.getBoundingClientRect(),
        { size: s } = latest.current;
      setCamera((c) =>
        streetZoom(
          c,
          Math.exp(-event.deltaY * 0.0014),
          s.width,
          s.height,
          (event.clientX - b.left) / b.width,
          (event.clientY - b.top) / b.height,
        ),
      );
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      element.removeEventListener('wheel', wheel);
    };
  }, []);
  useEffect(() => {
    if (paused) svg.current?.pauseAnimations();
    else svg.current?.unpauseAnimations();
  }, [paused]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (root.current && svg.current)
        root.current.dataset.clock = svg.current.getCurrentTime().toFixed(2);
    }, 500);
    return () => clearInterval(timer);
  }, []);
  const zoom = (factor: number) => setCamera((c) => streetZoom(c, factor, size.width, size.height));
  const snapshotGesture = () => {
    const p = [...pointers.current.values()];
    if (!p.length) {
      gesture.current = null;
      return;
    }
    gesture.current = {
      camera: latest.current.camera,
      x: p.reduce((s, a) => s + a.x, 0) / p.length,
      y: p.reduce((s, a) => s + a.y, 0) / p.length,
      distance: p.length > 1 ? Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) : 0,
    };
  };
  return (
    <section
      ref={root}
      className="changan-street"
      role="dialog"
      aria-modal="true"
      aria-label={en ? 'Chang’an street, close view' : '长安市井精细近景样段'}
      tabIndex={-1}
      data-zoom={camera.zoom.toFixed(2)}
      data-paused={paused}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key === 'Tab') {
          const controls = Array.from(
            root.current!.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
          );
          const index = controls.indexOf(document.activeElement as HTMLButtonElement);
          if (event.shiftKey && index <= 0) {
            event.preventDefault();
            controls.at(-1)?.focus();
          } else if (!event.shiftKey && index === controls.length - 1) {
            event.preventDefault();
            controls[0]?.focus();
          }
          return;
        }
        if ((event.target as Element).closest('button')) return;
        const deltas: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        if (deltas[event.key]) {
          event.preventDefault();
          const [x, y] = deltas[event.key];
          setCamera((c) => ({
            ...c,
            x: c.x + x * view.width * 0.12,
            y: c.y + y * view.height * 0.12,
          }));
        } else if (['+', '=', '-', 'Home'].includes(event.key)) {
          event.preventDefault();
          if (event.key === 'Home') setCamera(streetHome);
          else zoom(event.key === '-' ? 0.8 : 1.25);
        }
      }}
    >
      <svg
        ref={svg}
        className="changan-street-art"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        aria-label={
          en
            ? 'Ink street, flowing canal, willow branches, market and Tang clothing'
            : '水墨街市、流动河渠、风中柳枝与唐代衣装人物'
        }
        role="img"
        onPointerDown={(event) => {
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          event.currentTarget.setPointerCapture(event.pointerId);
          snapshotGesture();
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId) || !gesture.current) return;
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          const p = [...pointers.current.values()],
            g = gesture.current;
          const px = p.reduce((s, a) => s + a.x, 0) / p.length,
            py = p.reduce((s, a) => s + a.y, 0) / p.length;
          const base = streetView(g.camera, size.width, size.height);
          let next = {
            ...g.camera,
            x: g.camera.x - ((px - g.x) * base.width) / size.width,
            y: g.camera.y - ((py - g.y) * base.height) / size.height,
          };
          if (p.length > 1 && g.distance) {
            const distance = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y),
              b = root.current!.getBoundingClientRect();
            next = streetZoom(
              next,
              distance / g.distance,
              size.width,
              size.height,
              (px - b.left) / b.width,
              (py - b.top) / b.height,
            );
          }
          setCamera(next);
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          snapshotGesture();
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          snapshotGesture();
        }}
      >
        <StreetDrawing />
      </svg>
      <div className="changan-street-heading">
        <span>{en ? 'TANG · CHANG’AN' : '唐 · 长安市井'}</span>
        <small>{en ? 'Close-view study' : '近景样段'}</small>
      </div>
      <div className="changan-street-back">
        <Button variant="quiet" onClick={onClose}>
          {en ? '← Landscape' : '← 回望山河'}
        </Button>
      </div>
      <div
        className="changan-street-tools"
        role="group"
        aria-label={en ? 'Inspect the street' : '街景镜头'}
      >
        <Button
          variant="control"
          aria-label={en ? 'Zoom into street' : '放大街景'}
          onClick={() => zoom(1.5)}
          disabled={camera.zoom >= 24}
        >
          ＋
        </Button>
        <Button
          variant="control"
          aria-label={en ? 'Zoom out of street' : '缩小街景'}
          onClick={() => zoom(1 / 1.5)}
          disabled={camera.zoom <= 1}
        >
          −
        </Button>
        <Button
          variant="control"
          aria-label={en ? 'Inspect people' : '细看人物衣饰'}
          onClick={() => setCamera({ x: 1490, y: 1730, zoom: 5 })}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="6" />
            <path d="M15 15L22 22M8 8Q10 6 12 8M7 14L8 11H12L13 14" />
          </svg>
        </Button>
        <Button
          variant="control"
          aria-label={en ? 'Street overview' : '查看街市全景'}
          onClick={() => setCamera(streetHome)}
        >
          ⌑
        </Button>
      </div>
      <div className="changan-street-enter">
        <Button variant="quiet" onClick={onEnter}>
          {en ? 'Journey west →' : '启程西行 →'}
        </Button>
      </div>
    </section>
  );
}
