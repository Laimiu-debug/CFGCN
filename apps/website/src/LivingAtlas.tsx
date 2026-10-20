import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameId, Locale } from '@cfgcn/shared';
import { Button } from '@cfgcn/ui';
import { atlasPlace, geometry } from './atlas';
import { atlasCopy } from './atlas-copy';
import { populateAtlasLandscape } from './atlas-landscape';
import { createAtlasWater } from './atlas-water';
import { createAtlasAtmosphere } from './atlas-atmosphere';
import { populateAtlasBiomes } from './atlas-biomes';
import { populateAtlasCountryside } from './atlas-countryside';
import { atlasGroundColor, finishAtlasInInk } from './atlas-ink';
import {
  atlasViewElevation,
  atlasViewFov,
  atlasViewEasing,
  constrainAtlasView,
} from './atlas-view';
import { createAtlasClock } from './atlas-clock';
import { soundAtlas } from './atlas-sound';
import data from './atlas-data.json';
import './living-atlas.css';

const ids: GameId[] = ['xiyou', 'sanguo', 'shuihu', 'honglou'];
const columns = 193,
  rows = 113,
  worldWidth = 360,
  worldDepth = (worldWidth * geometry.height) / geometry.width;
let terrainPromise: Promise<Float32Array> | undefined;
function loadTerrain() {
  if (!terrainPromise)
    terrainPromise = fetch('/art/atlas/terrain-v1.bin')
      .then(async (r) => {
        if (!r.ok) throw new Error('Terrain unavailable');
        const bytes = await r.arrayBuffer();
        if (bytes.byteLength !== columns * rows * 2) throw new Error('Invalid terrain grid');
        let smooth = Float32Array.from(new Int16Array(bytes));
        // Soften sampling steps for the illustrated scale, retaining the same
        // geographic grid. Assets supply rock silhouettes above this ground.
        for (let pass = 0; pass < 2; pass++) {
          const next = new Float32Array(smooth.length);
          for (let row = 0; row < rows; row++)
            for (let col = 0; col < columns; col++) {
              let sum = 0;
              for (let dz = -1; dz <= 1; dz++)
                for (let dx = -1; dx <= 1; dx++) {
                  const x = Math.max(0, Math.min(columns - 1, col + dx));
                  const z = Math.max(0, Math.min(rows - 1, row + dz));
                  sum += smooth[z * columns + x] * (dx === 0 ? 2 : 1) * (dz === 0 ? 2 : 1);
                }
              next[row * columns + col] = sum / 16;
            }
          smooth = next;
        }
        return smooth;
      })
      .catch((error) => {
        terrainPromise = undefined;
        throw error;
      });
  return terrainPromise;
}

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

export function LivingAtlas(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<Partial<Record<GameId, HTMLDivElement | null>>>({});
  const changeView = useRef<((action: 'in' | 'out' | 'reset') => void) | null>(null);
  const liveProps = useRef(props);
  liveProps.current = props;
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<GameId | null>(null);
  const text = atlasCopy[props.locale];
  useEffect(() => {
    const element = host.current!;
    const fallback = () => {
      setError(true);
      liveProps.current.onAvailability?.(false);
      liveProps.current.onReady?.();
      liveProps.current.onArrivalComplete?.();
    };
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      });
    } catch {
      fallback();
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 600 ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = innerWidth >= 700;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    element.prepend(renderer.domElement);
    const styles = getComputedStyle(document.documentElement);
    const palette = (name: string) => new THREE.Color(styles.getPropertyValue(`--${name}`).trim());
    const paper = palette('paper'),
      gold = palette('gold');
    const scene = new THREE.Scene();
    scene.background = paper;
    const fog = new THREE.Fog(paper, 230, 560);
    scene.fog = fog;
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2200);
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    const material = (name: string, roughness = 0.95) => {
      const m = new THREE.MeshStandardMaterial({ color: palette(name), roughness });
      materials.push(m);
      return m;
    };
    const wallMat = material('paper-raised'),
      woodMat = material('gold-ink');
    const addMesh = (
      parent: THREE.Object3D,
      shape: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      shadow = true,
    ) => {
      geometries.push(shape);
      const mesh = new THREE.Mesh(shape, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const box = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat = wallMat,
    ) => addMesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
    const flags: THREE.Mesh[] = [];
    function flag(parent: THREE.Object3D, x: number, z: number) {
      box(parent, 0.12, 4, 0.12, x, 2, z, woodMat);
      const m = new THREE.MeshStandardMaterial({
        color: palette('vermilion'),
        side: THREE.DoubleSide,
        roughness: 1,
      });
      materials.push(m);
      const mesh = addMesh(parent, new THREE.PlaneGeometry(1.9, 1.1, 7, 1), m, x + 0.95, 3.3, z);
      flags.push(mesh);
    }
    const sun = new THREE.DirectionalLight(palette('on-jade'), 1.3);
    sun.position.set(-80, 180, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    sun.shadow.camera.far = 450;
    sun.shadow.bias = -0.001;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(palette('paper'), palette('gold-ink'), 1.1));
    const towns = new Map<GameId, THREE.Group>();
    const anchors = new Map<GameId, THREE.Vector3>();
    const picks: THREE.Mesh[] = [];
    const rings = new Map<GameId, THREE.Mesh>();
    const boats: THREE.Group[] = [];
    let waterLife: ReturnType<typeof createAtlasWater> | undefined;
    let atmosphere: ReturnType<typeof createAtlasAtmosphere> | undefined;
    const windPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -18);
    const windPoint = new THREE.Vector3();
    let landscape: ReturnType<typeof populateAtlasLandscape> | undefined;
    let biomes: ReturnType<typeof populateAtlasBiomes> | undefined;
    let countryside: ReturnType<typeof populateAtlasCountryside> | undefined;
    let inkLife: ReturnType<typeof finishAtlasInInk> | undefined;
    const clock = createAtlasClock();
    let artReady = false;
    let heights: Float32Array | undefined,
      disposed = false,
      frame = 0,
      previous = 0,
      lastHover: GameId | null = null;
    const mouse = new THREE.Vector2(),
      ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const target = new THREE.Vector3(),
      basePosition = new THREE.Vector3();
    const rawHeightAt = (u: number, v: number) => {
      if (!heights) return 0;
      const x = THREE.MathUtils.clamp(u * (columns - 1), 0, columns - 1),
        y = THREE.MathUtils.clamp(v * (rows - 1), 0, rows - 1);
      const x0 = Math.floor(x),
        y0 = Math.floor(y),
        x1 = Math.min(x0 + 1, columns - 1),
        y1 = Math.min(y0 + 1, rows - 1);
      const fx = x - x0,
        fy = y - y0;
      const a = heights[y0 * columns + x0],
        b = heights[y1 * columns + x0];
      const c = heights[y1 * columns + x1],
        d = heights[y0 * columns + x1];
      // Match PlaneGeometry's b–d diagonal so field roots sample the visible
      // triangle rather than a different bilinear surface cutting through it.
      const surface =
        fx + fy <= 1
          ? a + (d - a) * fx + (b - a) * fy
          : c + (b - c) * (1 - fx) + (d - c) * (1 - fy);
      return Math.max(-1.5, surface * 0.0033);
    };
    const arrivalCenter = atlasPlace('xiyou');
    const startClose = element.clientWidth < 600;
    let mapZoom = startClose ? 0.72 : 0.68;
    let cameraDistance = 160;
    const viewCenter = new THREE.Vector2(startClose ? -32 : -28, -6);
    const renderedTarget = new THREE.Vector3(-28, 0, -6);
    let lastViewRequest: Props['viewRequest'];
    const clampView = () => {
      const view = constrainAtlasView(
        element.clientWidth / element.clientHeight,
        mapZoom,
        viewCenter.x,
        viewCenter.y,
      );
      mapZoom = view.zoom;
      viewCenter.set(view.x, view.z);
      cameraDistance = view.distance;
    };
    changeView.current = (action) => {
      if (action === 'reset') {
        mapZoom = element.clientWidth < 600 ? 0.72 : 0.68;
        viewCenter.set(element.clientWidth < 600 ? -32 : -28, -6);
      } else mapZoom *= action === 'in' ? 0.8 : 1.25;
      clampView();
    };
    const heightAt = (u: number, v: number) => {
      let raw = rawHeightAt(u, v);
      if (liveProps.current.mode !== 'arrival') {
        // Local building terraces keep foundations grounded. Their geographic
        // centers and the surrounding DEM stay in the original projection.
        for (const id of ids) {
          const place = atlasPlace(id);
          const du = (u - place.left / 100) * worldWidth;
          const dv = (v - place.top / 100) * worldDepth;
          const radius = id === 'xiyou' || id === 'honglou' ? 12 : 10;
          const distance = Math.hypot(du, dv);
          if (distance < radius + 6)
            raw = THREE.MathUtils.lerp(
              rawHeightAt(place.left / 100, place.top / 100),
              raw,
              THREE.MathUtils.smoothstep(distance, radius - 2, radius + 6),
            );
        }
        return raw;
      }
      const du = (u - arrivalCenter.left / 100) * worldWidth;
      const dv = (v - arrivalCenter.top / 100) * worldDepth;
      const blend = THREE.MathUtils.smoothstep(Math.hypot(du, dv), 24, 60);
      return THREE.MathUtils.lerp(
        rawHeightAt(arrivalCenter.left / 100, arrivalCenter.top / 100),
        raw,
        blend,
      );
    };
    const positionAt = (u: number, v: number) =>
      new THREE.Vector3((u - 0.5) * worldWidth, heightAt(u, v), (v - 0.5) * worldDepth);
    const geoAt = (lon: number, lat: number) =>
      positionAt(
        (lon - geometry.west) / (geometry.east - geometry.west),
        (geometry.north - lat) / (geometry.north - geometry.south),
      );
    const updateCamera = (seconds: number, snap = false, elapsed = 1 / 30) => {
      const width = element.clientWidth,
        height = element.clientHeight;
      const compact = width < 600;
      const city = anchors.get('xiyou') ?? new THREE.Vector3(-32, 3, -10);
      if (liveProps.current.mode === 'arrival') {
        fog.near = 50;
        fog.far = 280;
        const t = liveProps.current.reducedMotion ? 1 : THREE.MathUtils.smoothstep(seconds, 0, 4.2);
        camera.position.set(city.x + 26 - t * 8, city.y + 17 - t * 5, city.z + 32 - t * 9);
        camera.lookAt(city.x - 2, city.y + 4, city.z);
        camera.fov = compact ? 58 : 47;
      } else {
        const request = liveProps.current.viewRequest;
        if (request && request !== lastViewRequest && anchors.has(request.id)) {
          const point = anchors.get(request.id)!;
          viewCenter.set(point.x, point.z + 5);
          mapZoom = compact ? 0.66 : 0.55;
          lastViewRequest = request;
        }
        clampView();
        const distance = cameraDistance;
        fog.near = distance * 1.25;
        fog.far = distance * 3.2;
        basePosition.set(
          viewCenter.x,
          distance * atlasViewElevation.y,
          distance * atlasViewElevation.z + viewCenter.y,
        );
        target.set(viewCenter.x, 0, viewCenter.y);
        if (liveProps.current.departing) {
          basePosition.set(city.x + 3, city.y + 23, city.z + 37);
          target.copy(city);
        }
        const easing = liveProps.current.reducedMotion || snap ? 1 : atlasViewEasing(elapsed);
        camera.position.lerp(basePosition, easing);
        renderedTarget.lerp(target, easing);
        camera.lookAt(renderedTarget);
        camera.fov = atlasViewFov;
      }
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    clampView();
    renderedTarget.set(viewCenter.x, 0, viewCenter.y);
    camera.position.set(
      viewCenter.x,
      cameraDistance * atlasViewElevation.y,
      viewCenter.y + cameraDistance * atlasViewElevation.z,
    );
    const resize = new ResizeObserver(() => {
      renderer.setSize(element.clientWidth, element.clientHeight);
      updateCamera(0, true);
    });
    resize.observe(element);
    const pointers = new Map<number, THREE.Vector2>();
    const dragOrigin = new THREE.Vector2(),
      dragLast = new THREE.Vector2();
    let suppressClick = false,
      pinchDistance = 0;
    const down = (event: PointerEvent) => {
      if (liveProps.current.mode === 'arrival' || event.button !== 0) return;
      pointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      renderer.domElement.setPointerCapture(event.pointerId);
      if (pointers.size === 1) {
        dragOrigin.set(event.clientX, event.clientY);
        dragLast.copy(dragOrigin);
        suppressClick = false;
      } else {
        const [a, b] = [...pointers.values()];
        pinchDistance = a.distanceTo(b);
        suppressClick = true;
      }
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (renderer.domElement.hasPointerCapture(event.pointerId))
        renderer.domElement.releasePointerCapture(event.pointerId);
    };
    const wheel = (event: WheelEvent) => {
      if (liveProps.current.mode === 'arrival') return;
      event.preventDefault();
      mapZoom *= Math.exp(THREE.MathUtils.clamp(event.deltaY, -100, 100) * 0.002);
      clampView();
    };
    const move = (event: PointerEvent) => {
      if (liveProps.current.mode === 'arrival') return;
      // A release outside the window may never arrive on the canvas. A later
      // mouse hover must not keep dragging the world with a stale pointer.
      if (event.pointerType === 'mouse' && event.buttons === 0) {
        pointers.delete(event.pointerId);
        pinchDistance = 0;
      }
      if (pointers.has(event.pointerId)) {
        pointers.get(event.pointerId)!.set(event.clientX, event.clientY);
        if (pointers.size > 1) {
          const [a, b] = [...pointers.values()];
          const distance = a.distanceTo(b);
          if (pinchDistance > 0 && distance > 0) mapZoom *= pinchDistance / distance;
          pinchDistance = distance;
          clampView();
          return;
        }
        if (Math.hypot(event.clientX - dragOrigin.x, event.clientY - dragOrigin.y) > 5) {
          suppressClick = true;
          const units =
            (2 * cameraDistance * Math.tan(THREE.MathUtils.degToRad(atlasViewFov / 2))) /
            element.clientHeight;
          viewCenter.x -= (event.clientX - dragLast.x) * units;
          viewCenter.y -= ((event.clientY - dragLast.y) * units) / atlasViewElevation.y;
          pointer.set(0, 0);
          clampView();
        }
        dragLast.set(event.clientX, event.clientY);
        if (suppressClick) return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      pointer.copy(mouse);
      if (event.pointerType !== 'mouse') pointer.set(0, 0);
      ray.setFromCamera(mouse, camera);
      if (ray.ray.intersectPlane(windPlane, windPoint)) atmosphere?.pointAt(windPoint);
      const surface = waterLife
        ? ray.intersectObjects(waterLife.surfaces).find((hit) => waterLife!.isWater(hit.point))
        : undefined;
      if (surface && !liveProps.current.reducedMotion) {
        waterLife?.disturb(surface.point, motionSeconds);
        renderer.domElement.dataset.waterInteraction = motionSeconds.toFixed(2);
        soundAtlas('water');
      }
      const hit = ray.intersectObjects(picks)[0]?.object.userData.id as GameId | undefined;
      const next = hit ?? null;
      renderer.domElement.style.cursor = next ? 'pointer' : surface ? 'crosshair' : 'grab';
      if (next !== lastHover) {
        lastHover = next;
        setHover(next);
        if (next) {
          liveProps.current.onSelect?.(next);
          soundAtlas('town');
        } else soundAtlas('wind');
      }
    };
    const click = (event: MouseEvent) => {
      if (liveProps.current.mode === 'arrival') return;
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(mouse, camera);
      const id = ray.intersectObjects(picks)[0]?.object.userData.id as GameId | undefined;
      if (!id) {
        const hit = waterLife
          ? ray
              .intersectObjects(waterLife.surfaces)
              .find((surface) => waterLife!.isWater(surface.point))
          : undefined;
        if (hit && !liveProps.current.reducedMotion) {
          waterLife?.disturb(hit.point, motionSeconds);
          renderer.domElement.dataset.waterInteraction = motionSeconds.toFixed(2);
          soundAtlas('water');
        } else soundAtlas('birds');
      }
      if (id) {
        liveProps.current.onSelect?.(id);
        liveProps.current.onEnter?.(id);
      }
    };
    const leave = () => {
      pointer.set(0, 0);
      lastHover = null;
      setHover(null);
      atmosphere?.pointAt(new THREE.Vector3(999, 0, 999));
    };
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);
    renderer.domElement.addEventListener('lostpointercapture', up);
    renderer.domElement.addEventListener('wheel', wheel, { passive: false });
    renderer.domElement.addEventListener('pointerleave', leave);
    renderer.domElement.addEventListener('click', click);
    const lost = (event: Event) => {
      event.preventDefault();
      fallback();
    };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    let motionSeconds = 0;
    let sceneSeconds = 0,
      readyReported = false,
      arrivalReported = false;
    loadTerrain()
      .then((grid) => {
        if (disposed) return;
        heights = grid;
        const terrain = new THREE.PlaneGeometry(worldWidth, worldDepth, columns - 1, rows - 1);
        terrain.rotateX(-Math.PI / 2);
        const positions = terrain.getAttribute('position'),
          colors = new Float32Array(positions.count * 3);
        for (let i = 0; i < positions.count; i++) {
          const u = (i % columns) / (columns - 1),
            v = Math.floor(i / columns) / (rows - 1);
          const h = heightAt(u, v);
          positions.setY(i, h);
          atlasGroundColor(positions.getX(i), positions.getZ(i), h, palette).toArray(colors, i * 3);
        }
        terrain.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        terrain.computeVertexNormals();
        const terrainMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 1,
          flatShading: false,
        });
        materials.push(terrainMat);
        addMesh(scene, terrain, terrainMat, 0, 0, 0, false);
        waterLife = createAtlasWater({ scene, positionAt, palette });
        for (const id of ids) {
          const p = atlasPlace(id),
            anchor = positionAt(p.left / 100, p.top / 100);
          anchors.set(id, anchor);
          const town = new THREE.Group();
          town.position.copy(anchor);
          scene.add(town);
          towns.set(id, town);
          if (id === 'xiyou' || id === 'sanguo') {
            flag(town, -9, 3);
            flag(town, 9, 3);
          }
          const ringMat = new THREE.MeshBasicMaterial({
            color: gold,
            transparent: true,
            opacity: 0.8,
          });
          materials.push(ringMat);
          const ring = addMesh(
            town,
            new THREE.TorusGeometry(id === 'xiyou' || id === 'honglou' ? 15 : 13, 0.08, 4, 64),
            ringMat,
            0,
            0.25,
            0,
            false,
          );
          ring.rotation.x = -Math.PI / 2;
          rings.set(id, ring);
          const pickMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
          });
          materials.push(pickMat);
          const pick = addMesh(
            scene,
            new THREE.SphereGeometry(id === 'xiyou' || id === 'honglou' ? 13 : 11, 8, 6),
            pickMat,
            anchor.x,
            anchor.y + 2,
            anchor.z,
            false,
          );
          pick.userData.id = id;
          picks.push(pick);
        }
        const marshCenter = anchors
          .get('shuihu')!
          .clone()
          .add(new THREE.Vector3(1, 0, 5));
        waterLife.addLiteraryWater(marshCenter, 28, 19);
        waterLife.addLiteraryWater(
          anchors
            .get('honglou')!
            .clone()
            .add(new THREE.Vector3(-12, 0, 7)),
          18,
          9,
        );
        atmosphere = createAtlasAtmosphere({
          scene,
          anchors,
          palette,
          compact: element.clientWidth < 600,
          arrival: liveProps.current.mode === 'arrival',
          ground: (x, z) => heightAt(x / worldWidth + 0.5, z / worldDepth + 0.5),
        });
        for (const [lon, lat] of [
          [119.8, 32.1],
          [121.1, 31.4],
        ]) {
          const p = geoAt(lon, lat);
          const boat = new THREE.Group();
          boat.position.copy(p).add(new THREE.Vector3(0, 0.6, 0));
          const hull = box(boat, 2.2, 0.5, 0.8, 0, 0.3, 0, woodMat);
          hull.rotation.z = 0.05;
          box(boat, 0.08, 2.3, 0.08, 0, 1.3, 0, woodMat);
          const sail = addMesh(boat, new THREE.PlaneGeometry(1.1, 1.6), wallMat, 0.45, 1.5, 0);
          sail.rotation.y = 0.3;
          scene.add(boat);
          let nearest = Infinity;
          for (const path of waterLife.channels) {
            path.forEach((point, index) => {
              const distance = point.distanceToSquared(p);
              if (distance >= nearest) return;
              nearest = distance;
              boat.userData.route = path.slice(
                Math.max(0, index - 22),
                Math.min(path.length, index + 23),
              );
            });
          }
          boats.push(boat);
        }
        landscape = populateAtlasLandscape({
          scene,
          towns,
          anchors,
          positionAt,
          heightAt,
          isWater: waterLife.isWater,
          palette,
          width: worldWidth,
          depth: worldDepth,
          arrival: liveProps.current.mode === 'arrival',
          compact: element.clientWidth < 600,
        });
        if (liveProps.current.mode !== 'arrival')
          biomes = populateAtlasBiomes({
            scene,
            anchors,
            ground: (x, z) => heightAt(x / worldWidth + 0.5, z / worldDepth + 0.5),
            channels: waterLife.channels,
            compact: element.clientWidth < 600,
            palette,
            isWater: waterLife.isWater,
          });
        if (liveProps.current.mode !== 'arrival')
          countryside = populateAtlasCountryside({
            scene,
            anchors,
            ground: (x, z) => heightAt(x / worldWidth + 0.5, z / worldDepth + 0.5),
            isWater: waterLife.isWater,
            palette,
            compact: element.clientWidth < 600,
            occupied: [...(biomes?.footprints ?? []), ...landscape.villageFootprints],
          });
        Promise.all([landscape.ready, biomes?.ready, countryside?.ready])
          .then(() => {
            if (disposed) return;
            inkLife = finishAtlasInInk(scene, palette);
            artReady = true;
            setReady(true);
            renderer.domElement.dataset.artState = 'ready';
            renderer.domElement.dataset.forestInstances = String(
              landscape?.root.userData.forestInstances,
            );
            renderer.domElement.dataset.villageInstances = String(
              landscape?.root.userData.villageInstances,
            );
            renderer.domElement.dataset.biomeInstances = JSON.stringify(
              biomes?.root.userData.instances ?? {},
            );
            renderer.domElement.dataset.regionalCoverage = JSON.stringify(
              biomes?.root.userData.regions ?? {},
            );
            renderer.domElement.dataset.countryside = JSON.stringify(
              countryside?.root.userData ?? {},
            );
          })
          .catch(() => {
            if (!disposed) fallback();
          });
      })
      .catch(() => {
        if (!disposed) fallback();
      });
    const projected = new THREE.Vector3();
    const visibility = () => {
      pointers.clear();
      pinchDistance = 0;
      pointer.set(0, 0);
      clock.reset();
      previous = 0;
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', visibility);
    function draw(now: number) {
      if (disposed) return;
      frame = requestAnimationFrame(draw);
      if (document.hidden || now - previous < 32) return;
      const cameraElapsed = (now - previous) / 1000;
      previous = now;
      const time = clock.advance(
        now,
        liveProps.current.reducedMotion,
        Boolean(heights && artReady),
      );
      sceneSeconds = time.scene;
      const seconds = sceneSeconds;
      updateCamera(seconds, false, cameraElapsed);
      const animate = !liveProps.current.reducedMotion;
      motionSeconds = time.environment;
      waterLife?.tick(motionSeconds);
      inkLife?.tick(motionSeconds);
      atmosphere?.tick(motionSeconds, element.clientHeight, !animate);
      flags.forEach((flag, i) => {
        if (!animate) return;
        const position = flag.geometry.getAttribute('position');
        for (let v = 0; v < position.count; v++)
          position.setZ(v, Math.sin(position.getX(v) * 2 + motionSeconds * 2.3 + i) * 0.18);
        position.needsUpdate = true;
      });
      boats.forEach((boat, i) => {
        const path = boat.userData.route as THREE.Vector3[] | undefined;
        if (path && path.length > 1) {
          const t = (Math.sin(motionSeconds * 0.055 + i * 2) + 1) * 0.5 * (path.length - 1);
          const index = Math.min(path.length - 2, Math.floor(t));
          boat.position.lerpVectors(path[index], path[index + 1], t - index);
          boat.position.y += 0.35;
          const direction = path[index + 1].clone().sub(path[index]);
          boat.rotation.y = -Math.atan2(direction.z, direction.x);
        }
        if (animate) {
          boat.rotation.z = Math.sin(motionSeconds * 0.8 + i) * 0.04;
        }
      });
      rings.forEach((ring, id) => {
        (ring.material as THREE.MeshBasicMaterial).opacity =
          id === liveProps.current.selected?.valueOf() ? 0.7 : 0.04;
      });
      for (const id of ids) {
        const label = labels.current[id],
          anchor = anchors.get(id);
        if (!label || !anchor) continue;
        projected
          .copy(anchor)
          .add(new THREE.Vector3(0, 12, 0))
          .project(camera);
        label.style.left = `${(projected.x * 0.5 + 0.5) * 100}%`;
        label.style.top = `${(-projected.y * 0.5 + 0.5) * 100}%`;
        label.style.visibility =
          projected.z < 1 &&
          Math.abs(projected.x) < 0.95 &&
          projected.y > -0.9 &&
          projected.y < 0.95
            ? 'visible'
            : 'hidden';
      }
      renderer.render(scene, camera);
      if (heights && artReady && !readyReported) {
        readyReported = true;
        liveProps.current.onAvailability?.(true);
        liveProps.current.onReady?.();
      }
      if (
        heights &&
        artReady &&
        liveProps.current.mode === 'arrival' &&
        seconds >= 4.2 &&
        !arrivalReported
      ) {
        arrivalReported = true;
        liveProps.current.onArrivalComplete?.();
      }
      renderer.domElement.dataset.motion = animate ? 'full' : 'reduced';
      renderer.domElement.dataset.environmentTime = motionSeconds.toFixed(2);
      renderer.domElement.dataset.cloudBanks = String(atmosphere?.cloudCount ?? 0);
      renderer.domElement.dataset.cloudPosition = atmosphere?.firstCloudPosition() ?? '';
      renderer.domElement.dataset.mistBanks = String(atmosphere?.mistCount ?? 0);
      renderer.domElement.dataset.canopyMaterials = String(inkLife?.canopyMaterials ?? 0);
      renderer.domElement.dataset.waterSurfaces = String(waterLife?.surfaces.length ?? 0);
      renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
      renderer.domElement.dataset.triangles = String(renderer.info.render.triangles);
      renderer.domElement.dataset.viewScale = mapZoom.toFixed(3);
      renderer.domElement.dataset.viewCenter = `${viewCenter.x.toFixed(1)},${viewCenter.y.toFixed(1)}`;
    }
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      landscape?.dispose();
      biomes?.dispose();
      countryside?.dispose();
      waterLife?.dispose();
      atmosphere?.dispose();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', visibility);
      changeView.current = null;
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      renderer.domElement.removeEventListener('lostpointercapture', up);
      renderer.domElement.removeEventListener('wheel', wheel);
      renderer.domElement.removeEventListener('pointerleave', leave);
      renderer.domElement.removeEventListener('click', click);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="living-atlas" ref={host} data-mode={props.mode ?? 'map'}>
      {!ready && !error && (
        <p className="living-loading" role="status">
          {text.compile}…
        </p>
      )}
      {error && (
        <div className="living-fallback">
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            aria-label={text.title}
            role="img"
          >
            <g className="atlas-land">
              {data.land.map((d, i) => (
                <path d={d} key={i} />
              ))}
            </g>
            <g className="atlas-rivers">
              {data.rivers.map((r, i) => (
                <path d={r.d} key={i} />
              ))}
            </g>
          </svg>
          <p>
            {props.locale === 'en'
              ? 'Choose a town below to continue.'
              : '可通过下方城镇入口继续。'}
          </p>
        </div>
      )}
      {props.mode !== 'arrival' && ready && !error && (
        <div
          className="living-view-controls"
          data-atlas-interface
          inert={props.resting}
          aria-hidden={props.resting}
        >
          <Button
            variant="icon"
            aria-label={text.zoomIn}
            title={text.zoomIn}
            onClick={() => changeView.current?.('in')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M12 5v14" />
            </svg>
          </Button>
          <Button
            variant="icon"
            aria-label={text.zoomOut}
            title={text.zoomOut}
            onClick={() => changeView.current?.('out')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </Button>
          <Button
            variant="icon"
            aria-label={text.overview}
            title={text.overview}
            onClick={() => changeView.current?.('reset')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
            </svg>
          </Button>
          {props.onRest && (
            <Button variant="icon" aria-label={text.rest} title={text.rest} onClick={props.onRest}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z" />
                <circle cx="12" cy="12" r="2.7" />
              </svg>
            </Button>
          )}
        </div>
      )}
      {props.mode !== 'arrival' &&
        ready &&
        !error &&
        ids.map((id) => (
          <div
            className={`living-town living-town--${id}`}
            ref={(node) => {
              labels.current[id] = node;
            }}
            key={id}
            data-longitude={atlasPlace(id).longitude}
            data-latitude={atlasPlace(id).latitude}
            data-active={hover === id || props.selected === id}
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
              <small>
                {text.eras[id]}
                {hover === id ? ' ↗' : ''}
              </small>
            </Button>
          </div>
        ))}
    </div>
  );
}
