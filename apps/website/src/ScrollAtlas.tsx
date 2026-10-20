import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameId, Locale } from '@cfgcn/shared';
import { Button } from '@cfgcn/ui';
import { atlasCopy } from './atlas-copy';
import { createAtlasClock } from './atlas-clock';
import { soundAtlas } from './atlas-sound';
import { scrollIds, scrollLayout, waterDistance } from './scroll-terrain';
import { createScrollWorld } from './scroll-world';
import { constrainScrollView, scrollFov, scrollElevation, scrollHomeView } from './scroll-view';
import './living-atlas.css';
import './scroll-atlas.css';

type Props = {
  locale: Locale;
  selected?: GameId;
  departing?: boolean;
  reducedMotion: boolean;
  mode?: 'map' | 'arrival';
  onSelect?: (id: GameId) => void;
  onEnter?: (id: GameId) => void;
  onReady?: () => void;
  onAvailability?: (available: boolean) => void;
  onArrivalComplete?: () => void;
  resting?: boolean;
  onRest?: () => void;
  viewRequest?: { id: GameId; sequence: number };
};
export function ScrollAtlas(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    labels = useRef<Partial<Record<GameId, HTMLDivElement | null>>>({});
  const current = useRef(props);
  current.current = props;
  const action = useRef<((value: 'in' | 'out' | 'reset') => void) | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [hover, setHover] = useState<GameId | null>(null);
  const text = atlasCopy[props.locale];
  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    const fail = () => {
      setFailed(true);
      current.current.onAvailability?.(false);
      current.current.onReady?.();
      current.current.onArrivalComplete?.();
    };
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    } catch {
      fail();
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, element.clientWidth < 600 ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', text.title);
    element.prepend(canvas);
    const css = getComputedStyle(document.documentElement),
      palette = (key: string) => new THREE.Color(css.getPropertyValue(`--${key}`).trim());
    const scene = new THREE.Scene();
    scene.background = palette('paper-raised');
    const camera = new THREE.PerspectiveCamera(scrollFov, 1, 2, 1800);
    const compact = () => element.clientWidth / element.clientHeight < 1.15;
    const origin = scrollLayout.places.xiyou;
    const homeView = () => scrollHomeView(element.clientWidth / element.clientHeight);
    const center = new THREE.Vector2(homeView().x, homeView().z),
      renderCenter = center.clone();
    let zoom = 1,
      span = 150,
      previous = 0,
      frame = 0,
      disposed = false,
      reported = false,
      arrived = false,
      lastRequest: Props['viewRequest'];
    let world: Awaited<ReturnType<typeof createScrollWorld>> | undefined;
    const clock = createAtlasClock();
    let motionTime = 0,
      sceneTime = 0;
    const mouse = new THREE.Vector2(),
      ray = new THREE.Raycaster(),
      horizontal = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      intersection = new THREE.Vector3();
    const picks: THREE.Mesh[] = [];
    const pickGeometry = new THREE.BoxGeometry(1, 1, 1),
      pickMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
    for (const id of scrollIds) {
      const p = scrollLayout.places[id];
      const mesh = new THREE.Mesh(pickGeometry, pickMaterial);
      mesh.position.set(p.x, 2, p.z);
      mesh.scale.set(p.width, 7, p.depth);
      mesh.userData.id = id;
      mesh.updateMatrixWorld(true);
      picks.push(mesh);
    }
    const setView = (value: 'in' | 'out' | 'reset') => {
      if (value === 'reset') {
        zoom = 1;
        center.set(homeView().x, homeView().z);
        current.current.onSelect?.('xiyou');
      } else zoom *= value === 'in' ? 0.82 : 1.22;
      zoom = THREE.MathUtils.clamp(zoom, 0.48, 1.13);
    };
    action.current = setView;
    const baseSpan = () => homeView().span;
    const updateCamera = (dt: number) => {
      const aspect = element.clientWidth / element.clientHeight,
        request = current.current.viewRequest;
      if (request && request !== lastRequest) {
        const p = scrollLayout.places[request.id];
        center.set(p.x, p.z);
        zoom = compact() ? 0.78 : 0.64;
        lastRequest = request;
      }
      let targetSpan = baseSpan() * zoom;
      if (current.current.mode === 'arrival') {
        const t = current.current.reducedMotion ? 1 : THREE.MathUtils.smoothstep(sceneTime, 0, 4.2);
        center.set(origin.x, origin.z + 8);
        targetSpan = THREE.MathUtils.lerp(92, 30, t);
      } else if (current.current.departing) {
        center.set(origin.x, origin.z + 8);
        targetSpan = 40;
      }
      const targetView = constrainScrollView(aspect, targetSpan, center.x, center.y);
      center.set(targetView.x, targetView.z);
      targetSpan = targetView.span;
      const easing = current.current.reducedMotion ? 1 : 1 - Math.exp(-5 * Math.min(dt, 0.1));
      renderCenter.lerp(center, easing);
      span = THREE.MathUtils.lerp(span, targetSpan, easing);
      const view = constrainScrollView(aspect, span, renderCenter.x, renderCenter.y);
      renderCenter.set(view.x, view.z);
      span = view.span;
      const distance = view.distance;
      camera.aspect = aspect;
      camera.position.set(
        renderCenter.x,
        distance * scrollElevation,
        renderCenter.y + distance * Math.sqrt(1 - scrollElevation ** 2),
      );
      camera.lookAt(renderCenter.x, 0, renderCenter.y);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    };
    span = baseSpan();
    renderCenter.copy(center);
    updateCamera(1);
    const resize = new ResizeObserver(() => {
      renderer.setSize(element.clientWidth, element.clientHeight);
      updateCamera(1);
    });
    resize.observe(element);
    let drag: THREE.Vector2 | undefined,
      dragStart: THREE.Vector2 | undefined,
      suppress = false,
      pinch = 0;
    const pointers = new Map<number, THREE.Vector2>();
    const locate = (x: number, y: number) => {
      const rect = canvas.getBoundingClientRect();
      mouse.set(((x - rect.left) / rect.width) * 2 - 1, (-(y - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || current.current.mode === 'arrival') return;
      pointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      canvas.setPointerCapture(event.pointerId);
      if (pointers.size === 1) {
        drag = new THREE.Vector2(event.clientX, event.clientY);
        dragStart = drag.clone();
        suppress = false;
      } else {
        const [a, b] = [...pointers.values()];
        pinch = a.distanceTo(b);
        suppress = true;
      }
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!pointers.size) {
        drag = undefined;
        pinch = 0;
      }
    };
    const move = (event: PointerEvent) => {
      if (current.current.mode === 'arrival') return;
      if (event.pointerType === 'mouse' && event.buttons === 0) {
        pointers.clear();
        drag = undefined;
        pinch = 0;
      }
      if (pointers.has(event.pointerId)) {
        pointers.get(event.pointerId)!.set(event.clientX, event.clientY);
        if (pointers.size > 1) {
          const [a, b] = [...pointers.values()],
            distance = a.distanceTo(b);
          if (pinch && distance)
            zoom = THREE.MathUtils.clamp((zoom * pinch) / distance, 0.48, 1.13);
          pinch = distance;
          return;
        }
        if (
          drag &&
          dragStart &&
          Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 5
        ) {
          const scale = span / element.clientHeight;
          center.x -= (event.clientX - drag.x) * scale;
          center.y -= ((event.clientY - drag.y) * scale) / 0.758;
          suppress = true;
          drag.set(event.clientX, event.clientY);
          return;
        }
      }
      locate(event.clientX, event.clientY);
      if (!current.current.reducedMotion && ray.ray.intersectPlane(horizontal, intersection))
        world?.pointAt(intersection.x, intersection.z);
      const hit = ray.intersectObjects(picks)[0]?.object.userData.id as GameId | undefined;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      setHover((previous) => (previous === hit ? previous : (hit ?? null)));
      if (hit && current.current.selected !== hit) {
        current.current.onSelect?.(hit);
        soundAtlas('town');
      }
    };
    const click = (event: MouseEvent) => {
      if (suppress) {
        suppress = false;
        return;
      }
      if (current.current.mode === 'arrival') return;
      locate(event.clientX, event.clientY);
      const id = ray.intersectObjects(picks)[0]?.object.userData.id as GameId | undefined;
      if (id) {
        current.current.onSelect?.(id);
        current.current.onEnter?.(id);
        return;
      }
      const point = world ? ray.intersectObject(world.water)[0]?.point : undefined;
      if (point && waterDistance(point.x, point.z) < 0 && !current.current.reducedMotion) {
        world!.disturb(point, motionTime);
        canvas.dataset.waterInteraction = motionTime.toFixed(2);
        soundAtlas('water');
      } else soundAtlas('birds');
    };
    const wheel = (event: WheelEvent) => {
      if (current.current.mode === 'arrival') return;
      event.preventDefault();
      zoom = THREE.MathUtils.clamp(
        zoom * Math.exp(THREE.MathUtils.clamp(event.deltaY, -100, 100) * 0.002),
        0.48,
        1.13,
      );
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Home') {
        event.preventDefault();
        setView('reset');
      } else if (event.key === '+' || event.key === '=') setView('in');
      else if (event.key === '-') setView('out');
      else if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        center.x += event.key === 'ArrowRight' ? 8 : event.key === 'ArrowLeft' ? -8 : 0;
        center.y += event.key === 'ArrowDown' ? 8 : event.key === 'ArrowUp' ? -8 : 0;
      }
    };
    const leave = () => setHover(null);
    const lost = (event: Event) => {
      event.preventDefault();
      fail();
    };
    const visibility = () => {
      pointers.clear();
      drag = undefined;
      pinch = 0;
      clock.reset();
      previous = 0;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('click', click);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('keydown', key);
    canvas.addEventListener('webglcontextlost', lost);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', visibility);
    createScrollWorld(scene, palette)
      .then((value) => {
        if (disposed) {
          value.dispose();
          return;
        }
        world = value;
        setReady(true);
        canvas.dataset.artState = 'ready';
        canvas.dataset.buildings = String(value.buildingCount);
        canvas.dataset.trees = String(value.treeCount);
        canvas.dataset.composition = 'ink-home-study-v1';
        canvas.dataset.surfaceRecipe = value.artRecipe;
      })
      .catch((error) => {
        console.error('Ink landscape could not load', error);
        if (!disposed) fail();
      });
    const projected = new THREE.Vector3();
    const draw = (now: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(draw);
      if (document.hidden || now - previous < 32) return;
      const dt = previous ? (now - previous) / 1000 : 1 / 30;
      previous = now;
      const time = clock.advance(now, current.current.reducedMotion, !!world);
      motionTime = time.environment;
      sceneTime = time.scene;
      updateCamera(dt);
      world?.tick(motionTime);
      if (world)
        for (const id of scrollIds) {
          const label = labels.current[id],
            anchor = world.anchors.get(id),
            p = scrollLayout.places[id];
          if (!label || !anchor) continue;
          projected
            .copy(anchor)
            .add(
              new THREE.Vector3(
                p.width *
                  (compact() ? (id === 'xiyou' ? 0.08 : 0.2) : id === 'honglou' ? -0.15 : 0.47),
                6,
                -p.depth * 0.2,
              ),
            )
            .project(camera);
          label.style.left = `${(projected.x * 0.5 + 0.5) * 100}%`;
          label.style.top = `${(-projected.y * 0.5 + 0.5) * 100}%`;
          label.style.visibility =
            projected.z < 1 &&
            Math.abs(projected.x) < 0.91 &&
            projected.y < 0.76 &&
            projected.y > -0.77
              ? 'visible'
              : 'hidden';
        }
      renderer.render(scene, camera);
      if (world && !reported) {
        reported = true;
        current.current.onAvailability?.(true);
        current.current.onReady?.();
      }
      if (world && current.current.mode === 'arrival' && sceneTime >= 4.2 && !arrived) {
        arrived = true;
        current.current.onArrivalComplete?.();
      }
      canvas.dataset.environmentTime = motionTime.toFixed(2);
      canvas.dataset.motion = current.current.reducedMotion ? 'reduced' : 'full';
      canvas.dataset.cloudPosition = world?.cloudPosition() ?? '';
      canvas.dataset.cloudBanks = String(world?.cloudCount ?? 0);
      canvas.dataset.waterSurfaces = '1';
      canvas.dataset.roadSurfaces = '0';
      canvas.dataset.roads = 'terrain-pigment';
      canvas.dataset.drawCalls = String(renderer.info.render.calls);
      canvas.dataset.triangles = String(renderer.info.render.triangles);
      canvas.dataset.viewScale = zoom.toFixed(3);
      canvas.dataset.viewCenter = `${center.x.toFixed(1)},${center.y.toFixed(1)}`;
    };
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      world?.dispose();
      pickGeometry.dispose();
      pickMaterial.dispose();
      action.current = null;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', visibility);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('click', click);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', key);
      canvas.removeEventListener('webglcontextlost', lost);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);
  useEffect(() => {
    host.current
      ?.querySelector('canvas')
      ?.setAttribute('aria-label', atlasCopy[props.locale].title);
  }, [props.locale, ready]);
  return (
    <div className="living-atlas scroll-atlas" ref={host} data-mode={props.mode ?? 'map'}>
      {!ready && !failed && (
        <p className="living-loading" role="status">
          {text.compile}…
        </p>
      )}
      {failed && (
        <p className="living-loading" role="status">
          {props.locale === 'en' ? 'Choose a town below to continue.' : '可通过下方城镇入口继续。'}
        </p>
      )}
      {ready && !failed && props.mode !== 'arrival' && (
        <>
          <div
            className="living-view-controls"
            data-atlas-interface
            inert={props.resting}
            aria-hidden={props.resting}
          >
            {(['in', 'out', 'reset'] as const).map((value, index) => (
              <Button
                key={value}
                variant="icon"
                aria-label={[text.zoomIn, text.zoomOut, text.overview][index]}
                title={[text.zoomIn, text.zoomOut, text.overview][index]}
                onClick={() => action.current?.(value)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d={
                      ['M5 12h14M12 5v14', 'M5 12h14', 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'][
                        index
                      ]
                    }
                  />
                </svg>
              </Button>
            ))}
            {props.onRest && (
              <Button
                variant="icon"
                aria-label={text.rest}
                title={text.rest}
                onClick={props.onRest}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z" />
                  <circle cx="12" cy="12" r="2.7" />
                </svg>
              </Button>
            )}
          </div>
          {scrollIds.map((id) => (
            <div
              key={id}
              ref={(node) => {
                labels.current[id] = node;
              }}
              className={`living-town scroll-town scroll-town--${id}`}
              data-longitude={scrollLayout.places[id].longitude}
              data-latitude={scrollLayout.places[id].latitude}
              data-active={hover === id}
              data-atlas-interface
              inert={props.resting}
              aria-hidden={props.resting}
            >
              <Button
                variant="quiet"
                onPointerEnter={() => {
                  setHover(id);
                  props.onSelect?.(id);
                }}
                onPointerLeave={() => setHover(null)}
                onFocus={() => {
                  setHover(id);
                  props.onSelect?.(id);
                }}
                onBlur={() => setHover(null)}
                onClick={() => props.onEnter?.(id)}
                aria-label={`${text.places[id]} · ${text.eras[id]} · ${id === 'xiyou' ? text.enter : text.preview}`}
              >
                <span>{text.places[id]}</span>
                <small>{text.eras[id]} ↗</small>
              </Button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
