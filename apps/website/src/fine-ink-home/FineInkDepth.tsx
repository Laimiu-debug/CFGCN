import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GameId } from '@cfgcn/shared';
import type { InkLifeFrame, InkActorFrame } from './FineInkLife';
import { inkGroundDepth, inkImagePoint, inkLayerDepth, type DepthLayer } from './ink-depth';
import { inkPaintDepth } from './ink-surface';

export type DepthPlace = {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  hitWidth: number;
  hitHeight: number;
};
export type InkDepthLayout = {
  version: string;
  width: number;
  height: number;
  ground: string;
  layers: DepthLayer[];
  places: Record<GameId, DepthPlace>;
  probes: { id: string; layer: string; x: number; y: number }[];
  life: { water: string[]; waterMask: string; shoreFront: string };
};
export type DepthPose = { x: number; y: number; zoom: number; whole: boolean };
export type DepthProjection = Record<
  GameId,
  { x: number; y: number; left: number; top: number; width: number; height: number }
>;
export type InkDepthApi = {
  pick: (x: number, y: number) => { x: number; y: number } | null;
  frame: (frame: InkLifeFrame) => void;
};
type Props = {
  layout: InkDepthLayout;
  size: { width: number; height: number };
  view: DepthPose;
  pointer: { x: number; y: number };
  reducedMotion: boolean;
  inspect: boolean;
  api: { current: InkDepthApi | null };
  onReady: () => void;
  onError: () => void;
  onProject: (p: DepthProjection) => void;
};
type LayerPixels = { data: Uint8ClampedArray; width: number; height: number };

function makeDepthGeometry(
  bounds: [number, number, number, number],
  depth: (x: number, y: number) => number,
  localUv = true,
  segments = 64,
) {
  const [left, top, width, height] = bounds;
  const nx = segments,
    ny = Math.max(8, Math.round((segments * height) / width));
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const x = left + (width * i) / nx,
        y = top + (height * j) / ny;
      positions.push(...inkImagePoint(x, y, depth(x, y)));
      uv.push(localUv ? i / nx : x / 2400, localUv ? 1 - j / ny : 1 - y / 1501);
    }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i,
        b = a + 1,
        c = a + nx + 1,
        d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
function actorGeometry(entity: InkActorFrame) {
  const { tile } = entity,
    left = -tile.width / 2,
    right = tile.width / 2,
    top = tile.foot,
    bottom = tile.foot - tile.height;
  const uvLeft = tile.x / 1024,
    uvRight = (tile.x + tile.width) / 1024,
    uvTop = 1 - tile.y / 512,
    uvBottom = 1 - (tile.y + tile.height) / 512;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [left, bottom, 0, right, bottom, 0, right, top, 0, left, top, 0],
      3,
    ),
  );
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      [uvLeft, uvBottom, uvRight, uvBottom, uvRight, uvTop, uvLeft, uvTop],
      2,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

export function FineInkDepth(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(props);
  current.current = props;
  useEffect(() => {
    const element = host.current!;
    let disposed = false,
      raf = 0,
      last = 0,
      sceneClock = 0,
      lastReport = 0;
    const scene = new THREE.Scene();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: false,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      current.current.onError();
      return;
    }
    const paper = getComputedStyle(element).getPropertyValue('--paper-raised').trim();
    renderer.setClearColor(new THREE.Color(paper));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    element.appendChild(renderer.domElement);
    renderer.domElement.className = 'fine-ink-depth-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const camera = new THREE.PerspectiveCamera(33, 1, 4, 10000),
      ray = new THREE.Raycaster();
    const assets: THREE.Texture[] = [],
      geometries: THREE.BufferGeometry[] = [],
      materials: THREE.Material[] = [];
    const pixelData = new Map<string, LayerPixels>(),
      staticMeshes: THREE.Mesh[] = [];
    let groundMesh: THREE.Mesh,
      paintReady = false;
    const dynamic = new Map<string, { texture: THREE.CanvasTexture; mesh: THREE.Mesh }>();
    const actors = new Map<string, THREE.Mesh>();
    let actorTexture: THREE.CanvasTexture | null = null,
      actorMaterial: THREE.MeshBasicMaterial | null = null;
    let latestFrame: InkLifeFrame | null = null,
      frameVersion = 0,
      lastFrameVersion = -1;
    let cameraX = 0,
      cameraY = 0,
      orbitX = 0,
      orbitY = 0,
      renderWidth = 0,
      renderHeight = 0;
    let lastCameraKey = '',
      lastDrawVersion = -1,
      lastProjectionKey = '';
    let lastProjectionCallback: Props['onProject'] | undefined;
    const target = new THREE.Vector3(),
      eye = new THREE.Vector3();
    const { layout } = props;
    const sampler = (layer: DepthLayer, x: number, y: number) => {
      const pixels = pixelData.get(layer.id);
      if (!pixels) return false;
      const [lx, ly, lw, lh] = layer.bounds,
        u = (x - lx) / lw,
        v = (y - ly) / lh;
      if (u < 0 || v < 0 || u > 1 || v > 1) return false;
      const px = Math.min(pixels.width - 1, Math.floor(u * pixels.width)),
        py = Math.min(pixels.height - 1, Math.floor(v * pixels.height));
      return pixels.data[(py * pixels.width + px) * 4 + 3] > 32;
    };
    const surfaceAt = (x: number, y: number, water = false) =>
      inkPaintDepth(layout.layers, x, y, sampler, water);
    const addMesh = (
      texture: THREE.Texture,
      bounds: [number, number, number, number],
      depth: (x: number, y: number) => number,
      transparent: boolean,
      localUv = true,
      segments = 64,
    ) => {
      const geometry = makeDepthGeometry(bounds, depth, localUv, segments);
      geometries.push(geometry);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent,
        alphaTest: transparent ? 0.035 : 0,
        depthWrite: true,
        side: THREE.FrontSide,
        toneMapped: false,
      });
      materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      return mesh;
    };
    const load = async (url: string, layer?: DepthLayer) => {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      if (disposed) {
        texture.dispose();
        return texture;
      }
      assets.push(texture);
      if (layer) {
        const image = texture.image as HTMLImageElement;
        const temp = document.createElement('canvas');
        temp.width = image.naturalWidth;
        temp.height = image.naturalHeight;
        const c = temp.getContext('2d')!;
        c.drawImage(image, 0, 0);
        pixelData.set(layer.id, {
          data: c.getImageData(0, 0, temp.width, temp.height).data,
          width: temp.width,
          height: temp.height,
        });
      }
      return texture;
    };
    void (async () => {
      try {
        const [ground, loaded] = await Promise.all([
          load(layout.ground),
          Promise.all(
            layout.layers.map(async (layer) => ({
              layer,
              texture: await load(layer.image, layer),
            })),
          ),
        ]);
        if (disposed) return;
        groundMesh = addMesh(
          ground,
          [-200, -160, 2800, 1821],
          (_, y) => inkGroundDepth(y),
          false,
          false,
          150,
        );
        groundMesh.name = 'inpainted continuous ground';
        for (const { layer, texture } of loaded) {
          const mesh = addMesh(
            texture,
            layer.bounds,
            (x, y) => inkLayerDepth(layer, x, y),
            true,
            true,
            layer.kind === 'far' ? 110 : 70,
          );
          mesh.name = layer.id;
          staticMeshes.push(mesh);
        }
        paintReady = true;
        element.dataset.ready = 'true';
        element.dataset.meshes = String(staticMeshes.length + 1);
        current.current.onReady();
      } catch {
        if (!disposed) current.current.onError();
      }
    })();
    const updateLife = () => {
      if (!latestFrame || !paintReady || lastFrameVersion === frameVersion) return;
      lastFrameVersion = frameVersion;
      for (const [id, source] of Object.entries({
        water: latestFrame.water,
        effects: latestFrame.effects,
        clouds: latestFrame.clouds,
      })) {
        let item = dynamic.get(id);
        if (!item) {
          const texture = new THREE.CanvasTexture(source);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearFilter;
          assets.push(texture);
          const geometry = makeDepthGeometry(
            [0, 0, 2400, 1501],
            (x, y) =>
              id === 'water'
                ? surfaceAt(x, y, true) + 0.5
                : id === 'clouds'
                  ? inkGroundDepth(y) + 280
                  : surfaceAt(x, y) + 0.75,
            true,
            id === 'effects' ? 150 : 90,
          );
          geometries.push(geometry);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            side: THREE.FrontSide,
            toneMapped: false,
          });
          materials.push(material);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = id;
          mesh.renderOrder = id === 'clouds' ? 40 : 5;
          scene.add(mesh);
          item = { texture, mesh };
          dynamic.set(id, item);
        }
        item.texture.needsUpdate = true;
      }
      if (!actorTexture) {
        actorTexture = new THREE.CanvasTexture(latestFrame.actors);
        actorTexture.colorSpace = THREE.SRGBColorSpace;
        actorTexture.generateMipmaps = false;
        actorTexture.minFilter = THREE.LinearFilter;
        assets.push(actorTexture);
        actorMaterial = new THREE.MeshBasicMaterial({
          map: actorTexture,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          alphaTest: 0.02,
          side: THREE.FrontSide,
          toneMapped: false,
        });
        materials.push(actorMaterial);
      }
      actorTexture.needsUpdate = true;
      for (const entity of latestFrame.entities) {
        let mesh = actors.get(entity.id);
        // Walker draw order can change; its atlas cell follows the current stable id.
        if (mesh) {
          const { tile } = entity,
            u = tile.x / 1024,
            r = (tile.x + tile.width) / 1024,
            t = 1 - tile.y / 512,
            b = 1 - (tile.y + tile.height) / 512;
          const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
          uv.setXY(0, u, b);
          uv.setXY(1, r, b);
          uv.setXY(2, r, t);
          uv.setXY(3, u, t);
          uv.needsUpdate = true;
        } else {
          const geometry = actorGeometry(entity);
          geometries.push(geometry);
          mesh = new THREE.Mesh(geometry, actorMaterial!);
          mesh.name = entity.id;
          mesh.renderOrder = 20;
          scene.add(mesh);
          actors.set(entity.id, mesh);
        }
        const z = surfaceAt(entity.x, entity.y, entity.kind === 'boat') + 0.75;
        mesh.position.set(...inkImagePoint(entity.x, entity.y, z));
        const factor = (2600 - z) / 2600;
        mesh.scale.setScalar(factor);
      }
    };
    props.api.current = {
      frame: (frame) => {
        latestFrame = frame;
        frameVersion++;
      },
      pick: (x, y) => {
        if (!groundMesh) return null;
        ray.setFromCamera(
          new THREE.Vector2(
            (x / current.current.size.width) * 2 - 1,
            1 - (y / current.current.size.height) * 2,
          ),
          camera,
        );
        for (const hit of ray.intersectObjects([groundMesh, ...staticMeshes], false)) {
          if (!hit.uv) continue;
          if (hit.object === groundMesh) return { x: hit.uv.x * 2400, y: (1 - hit.uv.y) * 1501 };
          const layer = layout.layers.find((l) => l.id === hit.object.name)!;
          const [left, top, width, height] = layer.bounds;
          const x = left + hit.uv.x * width,
            y = top + (1 - hit.uv.y) * height;
          if (sampler(layer, x, y)) return { x, y };
        }
        return null;
      },
    };
    const project = (x: number, y: number, z: number) => {
      const p = new THREE.Vector3(...inkImagePoint(x, y, z)).project(camera);
      return {
        x: (p.x * 0.5 + 0.5) * current.current.size.width,
        y: (0.5 - p.y * 0.5) * current.current.size.height,
      };
    };
    const draw = (now: number) => {
      if (disposed) return;
      const v = current.current,
        dt = last ? Math.min(60, now - last) : 0;
      last = now;
      if (document.hidden) {
        raf = requestAnimationFrame(draw);
        return;
      }
      if (!v.reducedMotion && !document.hidden) sceneClock += dt / 1000;
      const inspect = v.inspect && !v.reducedMotion && !v.view.whole;
      const goalX = v.view.whole
        ? 0
        : inspect
          ? Math.sin(sceneClock * 0.36) * 230
          : v.reducedMotion
            ? orbitX
            : v.pointer.x * 105;
      const goalY = v.view.whole
        ? 0
        : inspect
          ? Math.sin(sceneClock * 0.23) * 48
          : v.reducedMotion
            ? orbitY
            : v.pointer.y * 30;
      const ease = v.reducedMotion ? 1 : 0.08;
      orbitX += (goalX - orbitX) * ease;
      orbitY += (goalY - orbitY) * ease;
      // Frame a town by shifting the perspective frustum. Large camera dollies
      // expose unpainted sides; only the bounded orbit changes the viewing angle.
      const px = v.view.x - 1200,
        py = v.view.y - 750.5;
      cameraX += (px - cameraX) * (v.reducedMotion ? 1 : 0.14);
      cameraY += (py - cameraY) * (v.reducedMotion ? 1 : 0.14);
      const aspect = v.size.width / v.size.height,
        extent = v.view.whole
          ? Math.max(1501, 2400 / aspect)
          : Math.min(1501, 2400 / aspect) * 0.88;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(extent / (2 * 2600)));
      camera.aspect = aspect;
      camera.zoom = v.view.zoom;
      const amount = v.size.width < 700 ? 0.55 : 1;
      target.set(0, 0, 0);
      eye.set(orbitX * amount, orbitY * amount, 2600);
      camera.position.copy(eye);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[8] += (cameraX * 2 * v.view.zoom) / (extent * aspect);
      camera.projectionMatrix.elements[9] -= (cameraY * 2 * v.view.zoom) / extent;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      camera.updateMatrixWorld();
      if (renderWidth !== v.size.width || renderHeight !== v.size.height) {
        renderer.setSize(v.size.width, v.size.height, false);
        renderWidth = v.size.width;
        renderHeight = v.size.height;
      }
      if (paintReady) {
        const cameraKey = [
          cameraX,
          cameraY,
          orbitX,
          orbitY,
          v.view.zoom,
          extent,
          renderWidth,
          renderHeight,
        ]
          .map((value) => Math.round(value * 1000))
          .join(',');
        if (
          cameraKey === lastCameraKey &&
          frameVersion === lastDrawVersion &&
          lastProjectionCallback === v.onProject
        ) {
          raf = requestAnimationFrame(draw);
          return;
        }
        updateLife();
        for (const mesh of actors.values()) mesh.quaternion.copy(camera.quaternion);
        renderer.render(scene, camera);
        lastCameraKey = cameraKey;
        lastDrawVersion = frameVersion;
        if (lastProjectionKey !== cameraKey || lastProjectionCallback !== v.onProject) {
          const projected = {} as DepthProjection;
          for (const [id, p] of Object.entries(layout.places)) {
            const layer = layout.layers.find((l) => l.town === id && l.kind === 'city')!;
            const label = project(p.labelX, p.labelY, inkLayerDepth(layer, p.x, p.y));
            const corners = [
              [-1, -1],
              [-1, 1],
              [1, -1],
              [1, 1],
            ].map(([sx, sy]) => {
              const xx = p.x + (sx * p.hitWidth) / 2,
                yy = p.y + (sy * p.hitHeight) / 2;
              return project(xx, yy, inkLayerDepth(layer, xx, yy));
            });
            const left = Math.min(...corners.map((p) => p.x)),
              top = Math.min(...corners.map((p) => p.y));
            projected[id as GameId] = {
              ...label,
              left,
              top,
              width: Math.max(...corners.map((p) => p.x)) - left,
              height: Math.max(...corners.map((p) => p.y)) - top,
            };
          }
          v.onProject(projected);
          lastProjectionKey = cameraKey;
          lastProjectionCallback = v.onProject;
        }
        if (now - lastReport > 500) {
          const report = {
            pose: JSON.stringify({
              x: +cameraX.toFixed(1),
              y: +cameraY.toFixed(1),
              orbit: +orbitX.toFixed(1),
              zoom: v.view.zoom,
            }),
            triangles: String(renderer.info.render.triangles),
            drawCalls: String(renderer.info.render.calls),
            actors: String(actors.size),
            probes: JSON.stringify(
              layout.probes.map((p) => {
                const l = layout.layers.find((l) => l.id === p.layer)!;
                const z = inkLayerDepth(l, p.x, p.y);
                const screen = project(p.x, p.y, z);
                return {
                  id: p.id,
                  x: +screen.x.toFixed(2),
                  y: +screen.y.toFixed(2),
                  z: +z.toFixed(1),
                };
              }),
            ),
            anchors: JSON.stringify(
              [...actors].map(([id, mesh]) => {
                const entity = latestFrame?.entities.find((e) => e.id === id);
                if (!entity) return { id };
                const water = entity.kind === 'boat';
                const foot = mesh.position.clone().project(camera);
                const at = project(entity.x, entity.y, surfaceAt(entity.x, entity.y, water));
                return {
                  id,
                  x: +((foot.x * 0.5 + 0.5) * v.size.width).toFixed(2),
                  y: +((0.5 - foot.y * 0.5) * v.size.height).toFixed(2),
                  drift: +Math.hypot(
                    (foot.x * 0.5 + 0.5) * v.size.width - at.x,
                    (0.5 - foot.y * 0.5) * v.size.height - at.y,
                  ).toFixed(3),
                };
              }),
            ),
          };
          for (const [key, value] of Object.entries(report))
            if (element.dataset[key] !== value) element.dataset[key] = value;
          lastReport = now;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      props.api.current = null;
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      assets.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.layout]);
  return (
    <div
      ref={host}
      className="fine-ink-depth"
      data-ready="false"
      data-kind="perspective-relief-scene"
    />
  );
}
