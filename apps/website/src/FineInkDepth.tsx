import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GameId } from '@cfgcn/shared';
import type { InkLifeFrame, InkActorFrame } from './FineInkLife';
import {
  createInkTerrainField,
  inkHeightDepth,
  inkImagePoint,
  inkLayerDepth,
  inkWaterDepth,
  inkWorldElevation,
  type DepthLayer,
} from './ink-depth';
import { createInkShore } from './ink-shore';

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
  ambient?: boolean;
  api: { current: InkDepthApi | null };
  onReady: () => void;
  onError: () => void;
  onProject: (p: DepthProjection) => void;
};
type LayerPixels = { data: Uint8ClampedArray; width: number; height: number };
let sharedTerrain: ReturnType<typeof createInkTerrainField> | undefined;

function makeDepthGeometry(
  bounds: [number, number, number, number],
  depth: (x: number, y: number) => number,
  localUv = true,
  segments = 64,
  grid = 0,
) {
  const [left, top, width, height] = bounds;
  const axis = (start: number, length: number, count: number) => {
    if (!grid) return Array.from({ length: count + 1 }, (_, i) => start + (length * i) / count);
    const values = [start];
    for (let v = (Math.floor(start / grid) + 1) * grid; v < start + length; v += grid)
      values.push(v);
    values.push(start + length);
    return values;
  };
  const xs = axis(left, width, segments),
    ys = axis(top, height, Math.max(8, Math.round((segments * height) / width))),
    nx = xs.length - 1,
    ny = ys.length - 1;
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const x = xs[i],
        y = ys[j];
      positions.push(...inkImagePoint(x, y, depth(x, y)));
      uv.push(
        localUv ? (x - left) / width : x / 2400,
        localUv ? 1 - (y - top) / height : 1 - y / 1501,
      );
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
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
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
    const mists = new Map<string, THREE.Mesh>();
    let actorTexture: THREE.CanvasTexture | null = null,
      actorMaterial: THREE.MeshBasicMaterial | null = null;
    let latestFrame: InkLifeFrame | null = null,
      frameVersion = 0,
      lastFrameVersion = -1;
    let cameraX = 0,
      cameraY = 0,
      orbitX = 35,
      orbitY = 75,
      renderWidth = 0,
      renderHeight = 0;
    let cameraZoom = props.view.zoom,
      framingExtent = 0;
    let lastCameraKey = '',
      lastDrawVersion = -1,
      renderedFrames = 0;
    const target = new THREE.Vector3(),
      eye = new THREE.Vector3();
    const { layout } = props;
    const terrain = (sharedTerrain ??= createInkTerrainField());
    let shore: ReturnType<typeof createInkShore>;
    const landHeight = (x: number, y: number) => shore.height(x, y, terrain.height(x, y));
    const groundDepth = (x: number, y: number) => inkHeightDepth(y, landHeight(x, y));
    const layerDepth = (layer: DepthLayer, x: number, y: number) => {
      if (layer.kind === 'mountain') return groundDepth(x, y) + 0.8;
      if (layer.kind === 'far' || layer.kind === 'bridge') return inkLayerDepth(layer, x, y, 0);
      const rawHeight = terrain.height(x, y);
      const height = inkWorldElevation(inkImagePoint(x, y, inkLayerDepth(layer, x, y, rawHeight)));
      // Bring banks and rock roots into the river valley too. Architecture retains
      // its height above the local ground; only painted water is levelled.
      const h =
        layer.kind === 'bank'
          ? shore.height(x, y, height)
          : shore.wet(x, y)
            ? 0
            : landHeight(x, y) + height - rawHeight;
      return inkHeightDepth(y, h) + 0.8;
    };
    const sampler = (layer: DepthLayer, x: number, y: number) => {
      const pixels = pixelData.get(layer.id);
      if (!pixels) return false;
      const [lx, ly, lw, lh] = layer.bounds,
        u = (x - lx) / lw,
        v = (y - ly) / lh;
      if (u < 0 || v < 0 || u > 1 || v > 1) return false;
      const px = Math.min(pixels.width - 1, Math.floor(u * pixels.width)),
        py = Math.min(pixels.height - 1, Math.floor(v * pixels.height));
      return pixels.data[(py * pixels.width + px) * 4 + 3] > 140;
    };
    const surfaceAt = (x: number, y: number) => {
      let depth = groundDepth(x, y);
      for (const layer of layout.layers)
        if (['mountain', 'city', 'bank'].includes(layer.kind) && sampler(layer, x, y))
          depth = Math.max(depth, layerDepth(layer, x, y));
      return depth;
    };
    const addMesh = (
      texture: THREE.Texture,
      bounds: [number, number, number, number],
      depth: (x: number, y: number) => number,
      transparent: boolean,
      localUv = true,
      segments = 64,
      shade = 0,
    ) => {
      const geometry = makeDepthGeometry(bounds, depth, localUv, segments, 12);
      if (shade) {
        geometry.computeVertexNormals();
        const normals = geometry.getAttribute('normal');
        const light = new THREE.Vector3(-0.32, 0.58, 0.75).normalize();
        const colors = new Float32Array(normals.count * 3);
        for (let i = 0; i < normals.count; i++) {
          const dot = Math.max(
            0,
            normals.getX(i) * light.x + normals.getY(i) * light.y + normals.getZ(i) * light.z,
          );
          const value = 1 - shade * (1 - dot);
          colors.set([value, value, value], i * 3);
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      }
      geometries.push(geometry);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent,
        alphaTest: transparent ? 0.035 : 0,
        depthWrite: true,
        side: THREE.FrontSide,
        toneMapped: false,
        vertexColors: shade > 0,
      });
      materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      return mesh;
    };
    const load = async (url: string, layer?: DepthLayer) => {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
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
        const [ground, loaded, waterMask] = await Promise.all([
          load(layout.ground),
          Promise.all(
            layout.layers.map(async (layer) => ({
              layer,
              texture: await load(layer.image, layer),
            })),
          ),
          load(layout.life.waterMask),
        ]);
        if (disposed) return;
        const image = waterMask.image as HTMLImageElement;
        const temp = document.createElement('canvas');
        temp.width = image.naturalWidth;
        temp.height = image.naturalHeight;
        const c = temp.getContext('2d')!;
        c.drawImage(image, 0, 0);
        shore = createInkShore({
          data: c.getImageData(0, 0, temp.width, temp.height).data,
          width: temp.width,
          height: temp.height,
        });
        groundMesh = addMesh(ground, [-200, -160, 2800, 1821], groundDepth, false, false, 210, 0.1);
        groundMesh.name = 'inpainted continuous ground';
        for (const { layer, texture } of loaded) {
          const mesh = addMesh(
            texture,
            layer.bounds,
            (x, y) => layerDepth(layer, x, y),
            true,
            true,
            layer.kind === 'mountain' ? 118 : 80,
            layer.kind === 'mountain' ? 0.26 : layer.kind === 'bank' ? 0.1 : 0,
          );
          mesh.name = layer.id;
          staticMeshes.push(mesh);
        }
        paintReady = true;
        element.dataset.ready = 'true';
        element.dataset.meshes = String(staticMeshes.length + 1);
        element.dataset.terrain = 'connected-ridge-elevation';
        element.dataset.elevation = JSON.stringify({
          crest: +terrain.height((493 * 2400) / 1586, (477 * 1501) / 992).toFixed(1),
          basin: +terrain.height((577 * 2400) / 1586, (339 * 1501) / 992).toFixed(1),
          water: 0,
        });
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
            (x, y) => (id === 'water' ? inkWaterDepth(y) + 1.5 : surfaceAt(x, y) + 4),
            true,
            id === 'effects' ? 150 : 90,
            12,
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
          mesh.renderOrder = 5;
          scene.add(mesh);
          item = { texture, mesh };
          dynamic.set(id, item);
        }
        item.texture.needsUpdate = true;
      }
      for (const mist of latestFrame.mists) {
        let mesh = mists.get(mist.id);
        if (!mesh) {
          const texture = new THREE.CanvasTexture(mist.image);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearFilter;
          assets.push(texture);
          const geometry = makeDepthGeometry(
            mist.bounds,
            (_, y) => inkHeightDepth(y, mist.lift * 0.6),
            true,
            12,
          );
          geometries.push(geometry);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            opacity: 0.72,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            side: THREE.FrontSide,
            toneMapped: false,
          });
          materials.push(material);
          mesh = new THREE.Mesh(geometry, material);
          mesh.name = mist.id;
          mesh.renderOrder = 40;
          mesh.frustumCulled = false;
          scene.add(mesh);
          mists.set(mist.id, mesh);
        }
        const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
        for (let i = 0; i < positions.count; i++) {
          const x = mist.bounds[0] + uv.getX(i) * mist.bounds[2],
            y = mist.bounds[1] + (1 - uv.getY(i)) * mist.bounds[3];
          positions.setXYZ(i, ...inkImagePoint(x, y, inkHeightDepth(y, mist.lift * 0.6)));
        }
        positions.needsUpdate = true;
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
          depthWrite: true,
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
        const z =
          (entity.kind === 'boat' ? inkWaterDepth(entity.y) : surfaceAt(entity.x, entity.y)) + 8;
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
        const hit = ray.intersectObject(groundMesh, false)[0];
        return hit?.uv ? { x: hit.uv.x * 2400, y: (1 - hit.uv.y) * 1501 } : null;
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
      if (!v.reducedMotion && !document.hidden) sceneClock += dt / 1000;
      let goalX = orbitX,
        goalY = orbitY;
      if (v.view.whole) {
        goalX = 0;
        goalY = 0;
      } else if (!v.reducedMotion) {
        if (v.ambient) {
          goalX = 35 + Math.sin(sceneClock * 0.055) * 70;
          goalY = 75 + Math.sin(sceneClock * 0.041) * 14;
        } else if (v.inspect) {
          goalX = Math.sin(sceneClock * 0.36) * 340;
          goalY = 75 + Math.sin(sceneClock * 0.23) * 115;
        } else {
          goalX = 35 + v.pointer.x * 175;
          goalY = 75 + v.pointer.y * 65;
        }
      }
      const ease = v.reducedMotion ? 1 : 1 - Math.exp(-dt / 140);
      orbitX += (goalX - orbitX) * ease;
      orbitY += (goalY - orbitY) * ease;
      // Frame a town by shifting the perspective frustum. Large camera dollies
      // expose unpainted sides; only the bounded orbit changes the viewing angle.
      const px = v.view.x - 1200,
        py = v.view.y - 750.5;
      const frameEase = v.reducedMotion ? 1 : 1 - Math.exp(-dt / 180);
      cameraX += (px - cameraX) * frameEase;
      cameraY += (py - cameraY) * frameEase;
      cameraZoom += (v.view.zoom - cameraZoom) * frameEase;
      const aspect = v.size.width / v.size.height,
        targetExtent = v.view.whole
          ? Math.max(1501, 2400 / aspect)
          : Math.min(1501, 2400 / aspect) * 0.88;
      if (!framingExtent) framingExtent = targetExtent;
      framingExtent += (targetExtent - framingExtent) * frameEase;
      const extent = framingExtent;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(extent / (2 * 2600)));
      camera.aspect = aspect;
      camera.zoom = cameraZoom;
      const amount = v.size.width < 700 ? 0.55 : 1;
      target.set(0, 0, 0);
      eye.set(orbitX * amount, orbitY * amount, 2600);
      camera.position.copy(eye);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[8] += (cameraX * 2 * cameraZoom) / (extent * aspect);
      camera.projectionMatrix.elements[9] -= (cameraY * 2 * cameraZoom) / extent;
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
          cameraZoom,
          extent,
          renderWidth,
          renderHeight,
        ].join(',');
        if (v.reducedMotion && cameraKey === lastCameraKey && frameVersion === lastDrawVersion) {
          raf = requestAnimationFrame(draw);
          return;
        }
        updateLife();
        for (const mesh of actors.values()) mesh.quaternion.copy(camera.quaternion);
        renderer.render(scene, camera);
        lastCameraKey = cameraKey;
        lastDrawVersion = frameVersion;
        renderedFrames++;
        const projected = {} as DepthProjection;
        for (const [id, p] of Object.entries(layout.places)) {
          const layer = layout.layers.find((l) => l.town === id && l.kind === 'city')!;
          const label = project(p.labelX, p.labelY, layerDepth(layer, p.x, p.y));
          const corners = [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ].map(([sx, sy]) => {
            const xx = p.x + (sx * p.hitWidth) / 2,
              yy = p.y + (sy * p.hitHeight) / 2;
            return project(xx, yy, layerDepth(layer, xx, yy));
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
        if (v.reducedMotion || now - lastReport > 150) {
          element.dataset.pose = JSON.stringify({
            x: +cameraX.toFixed(1),
            y: +cameraY.toFixed(1),
            orbit: +orbitX.toFixed(1),
            orbitY: +orbitY.toFixed(1),
            zoom: +cameraZoom.toFixed(3),
          });
          element.dataset.triangles = String(renderer.info.render.triangles);
          element.dataset.drawCalls = String(renderer.info.render.calls);
          element.dataset.actors = String(actors.size);
          element.dataset.mists = String(mists.size);
          element.dataset.renderedFrames = String(renderedFrames);
          element.dataset.probes = JSON.stringify(
            layout.probes.map((p) => {
              const l = layout.layers.find((l) => l.id === p.layer)!;
              const z = layerDepth(l, p.x, p.y);
              const screen = project(p.x, p.y, z);
              return {
                id: p.id,
                x: +screen.x.toFixed(2),
                y: +screen.y.toFixed(2),
                z: +z.toFixed(1),
              };
            }),
          );
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
