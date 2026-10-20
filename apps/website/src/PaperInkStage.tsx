import { useEffect, useRef, type ComponentProps } from 'react';
import * as THREE from 'three';
import type { GameId } from '@cfgcn/shared';
import type { FineInkDepth, InkDepthApi, DepthPose, DepthProjection } from './FineInkDepth';
import type { InkLifeFrame } from './FineInkLife';
import type { DepthLayer } from './ink-depth';
import { createInkShore } from './ink-shore';
import {
  paperCardPoint,
  paperLimitView,
  paperMap,
  paperPlainHeight,
  paperPoint,
  paperWorld,
} from './paper-stage';

type Pixel = { x: number; y: number };
export type PaperStageApi = InkDepthApi & {
  zoomAt: (factor: number, point?: Pixel) => DepthPose;
  pan: (from: Pixel, to: Pixel) => DepthPose;
};
type Props = Omit<ComponentProps<typeof FineInkDepth>, 'api'> & {
  api: { current: PaperStageApi | null };
};
type Paint = {
  texture: THREE.Texture;
  canvas: HTMLCanvasElement;
  rgba: Uint8ClampedArray;
  w: number;
  h: number;
};
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const heroParts: Record<string, { box: [number, number, number, number]; path: number[][] }> = {
  'changan-city': {
    box: [547, 225, 140, 75],
    path: [
      [0, 27],
      [34, 17],
      [45, 3],
      [90, 4],
      [103, 13],
      [138, 23],
      [122, 31],
      [130, 45],
      [124, 73],
      [8, 73],
      [6, 45],
    ],
  },
  'hanzhong-city': {
    box: [299, 610, 75, 57],
    path: [
      [0, 19],
      [20, 13],
      [29, 0],
      [50, 5],
      [56, 17],
      [74, 28],
      [61, 31],
      [64, 55],
      [12, 56],
      [11, 31],
    ],
  },
  'liangshan-town': {
    box: [1109, 250, 87, 71],
    path: [
      [0, 34],
      [19, 26],
      [24, 17],
      [39, 11],
      [45, 0],
      [61, 17],
      [66, 31],
      [85, 37],
      [77, 41],
      [77, 69],
      [12, 69],
      [12, 42],
    ],
  },
  'jinling-garden-city': {
    box: [1405, 590, 58, 165],
    path: [
      [0, 55],
      [15, 42],
      [16, 23],
      [26, 7],
      [27, 0],
      [37, 20],
      [40, 44],
      [55, 56],
      [45, 63],
      [53, 80],
      [44, 91],
      [53, 106],
      [44, 116],
      [52, 132],
      [42, 143],
      [43, 162],
      [12, 164],
      [11, 145],
      [3, 133],
      [12, 121],
      [3, 107],
      [12, 96],
      [4, 81],
      [14, 68],
    ],
  },
};

export function PaperInkStage(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(props);
  current.current = props;
  useEffect(() => {
    const element = host.current!;
    let disposed = false,
      raf = 0,
      last = 0,
      clock = 0,
      ready = false,
      frames = 0,
      report = 0;
    const scene = new THREE.Scene();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      current.current.onError();
      return;
    }
    renderer.setClearColor(
      new THREE.Color(getComputedStyle(element).getPropertyValue('--paper-raised').trim()),
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    element.appendChild(renderer.domElement);
    renderer.domElement.className = 'fine-ink-depth-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const camera = new THREE.OrthographicCamera(-1200, 1200, 750, -750, 3, 30000),
      ray = new THREE.Raycaster();
    const resources: { dispose(): void }[] = [],
      meshes: THREE.Mesh[] = [];
    const paint = new Map<string, Paint>(),
      actors = new Map<string, THREE.Mesh>();
    const dynamic = new Map<string, { texture: THREE.CanvasTexture; mesh: THREE.Mesh }>();
    const mists = new Map<string, THREE.Mesh>();
    const { layout } = props;
    let shore: ReturnType<typeof createInkShore>, ground: THREE.Mesh;
    let latest: InkLifeFrame | null = null,
      version = 0,
      drawnVersion = -1;
    let actorTexture: THREE.CanvasTexture | null = null,
      actorMaterial: THREE.MeshBasicMaterial | null = null;
    let pose = { ...props.view },
      lastView = '',
      width = 0,
      height = 0,
      renderedKey = '';
    let manual = false;
    const intervals: number[] = [];
    const land = (x: number, row: number) => shore.height(x, row, paperPlainHeight(x, row));
    const point = (x: number, row: number, lift = 0) => paperPoint(x, row, land(x, row) + lift);
    const make = (positions: number[], uv: number[], indices: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(indices);
      g.computeBoundingSphere();
      resources.push(g);
      return g;
    };
    const surface = (
      bounds: number[],
      position: (x: number, row: number, u: number, v: number) => readonly number[],
      columns = 90,
      rows = 60,
      occupied?: (u: number, v: number) => boolean,
    ) => {
      const p: number[] = [],
        uv: number[] = [],
        ids: number[] = [];
      for (let j = 0; j <= rows; j++)
        for (let i = 0; i <= columns; i++) {
          const u = i / columns,
            v = j / rows;
          p.push(...position(bounds[0] + u * bounds[2], bounds[1] + v * bounds[3], u, v));
          uv.push(u, 1 - v);
        }
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < columns; i++) {
          if (
            occupied &&
            ![
              [0, 0],
              [1, 0],
              [0, 1],
              [1, 1],
              [0.5, 0.5],
            ].some(([du, dv]) => occupied((i + du) / columns, (j + dv) / rows))
          )
            continue;
          const a = j * (columns + 1) + i,
            b = a + columns + 1;
          ids.push(a, b, a + 1, a + 1, b, b + 1);
        }
      return make(p, uv, ids);
    };
    const material = (texture: THREE.Texture, transparent = false) => {
      const m = new THREE.MeshBasicMaterial({
        map: texture,
        transparent,
        alphaTest: transparent ? 0 : 0.065,
        depthWrite: !transparent,
        depthTest: true,
        side: THREE.DoubleSide,
        toneMapped: false,
        alphaToCoverage: !transparent,
        forceSinglePass: true,
      });
      resources.push(m);
      return m;
    };
    const add = (
      geometry: THREE.BufferGeometry,
      texture: THREE.Texture,
      name: string,
      transparent = false,
    ) => {
      const mesh = new THREE.Mesh(geometry, material(texture, transparent));
      mesh.name = name;
      scene.add(mesh);
      meshes.push(mesh);
      return mesh;
    };
    const readPaint = (canvas: HTMLCanvasElement, texture?: THREE.Texture): Paint => {
      const t = texture ?? new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      resources.push(t);
      return {
        texture: t,
        canvas,
        rgba: canvas
          .getContext('2d', { willReadFrequently: true })!
          .getImageData(0, 0, canvas.width, canvas.height).data,
        w: canvas.width,
        h: canvas.height,
      };
    };
    const load = async (url: string): Promise<Paint> => {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      if (disposed) {
        texture.dispose();
        throw new Error('Scene disposed');
      }
      const image = texture.image as HTMLImageElement,
        c = document.createElement('canvas');
      c.width = image.naturalWidth;
      c.height = image.naturalHeight;
      c.getContext('2d')!.drawImage(image, 0, 0);
      return readPaint(c, texture);
    };
    const alpha = (p: Paint, u: number, v: number) =>
      p.rgba[
        (Math.max(0, Math.min(p.h - 1, Math.floor(v * p.h))) * p.w +
          Math.max(0, Math.min(p.w - 1, Math.floor(u * p.w)))) *
          4 +
          3
      ];
    const card = (layer: DepthLayer, image: Paint, lift: number, fold = 0) => {
      // Each column has a persistent ground root. Above it the artwork stands in
      // world-up, with a short slope run. No inverse projection or camera-facing mountain.
      const roots = Array.from({ length: 97 }, (_, i) => {
        const px = Math.min(image.w - 1, Math.round((i / 96) * (image.w - 1)));
        let bottom = image.h - 1;
        while (bottom > 0 && image.rgba[(bottom * image.w + px) * 4 + 3] < 90) bottom--;
        return layer.bounds[1] + (bottom / Math.max(1, image.h - 1)) * layer.bounds[3];
      });
      const rootAt = (u: number) => {
        const k = Math.min(95.999, u * 96),
          i = Math.floor(k),
          f = k - i;
        return roots[i] * (1 - f) + roots[i + 1] * f;
      };
      const pos = (x: number, row: number, u: number) => {
        const root = Math.max(row, rootAt(u));
        const bend =
          fold * Math.sin(u * Math.PI * 3.4) * smooth(0, layer.bounds[3] * 0.55, root - row);
        return paperCardPoint(x, row, root, land(x, root) + 0.9, lift, bend);
      };
      const g = surface(
        layer.bounds,
        pos,
        Math.min(112, Math.max(16, Math.ceil(layer.bounds[2] / 16))),
        Math.min(70, Math.max(12, Math.ceil(layer.bounds[3] / 14))),
        (u, v) => alpha(image, u, v) > 9,
      );
      const mesh = add(g, image.texture, layer.id);
      mesh.userData.rootAt = rootAt;
      mesh.userData.positionAt = pos;
      return mesh;
    };
    void (async () => {
      try {
        const [base, loaded, mask] = await Promise.all([
          load(layout.ground),
          Promise.all(layout.layers.map(async (l) => ({ l, p: await load(l.image) }))),
          load(layout.life.waterMask),
        ]);
        if (disposed) return;
        for (const { l, p } of loaded) paint.set(l.id, p);
        shore = createInkShore({ data: mask.rgba, width: mask.w, height: mask.h });
        ground = add(
          surface([0, 0, 2400, 1501], (x, row) => point(x, row), 144, 92),
          base.texture,
          'continuous ground and low foothills',
        );
        // Recover the connective brushwork between the major mountains, without
        // leaving flat duplicates of the elevated ranges underneath them.
        const baseLayer = layout.layers.find((l) => l.id === 'connected-western-landform');
        if (baseLayer) {
          const source = paint.get(baseLayer.id)!;
          const c = document.createElement('canvas');
          c.width = source.w;
          c.height = source.h;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(source.canvas, 0, 0);
          ctx.globalCompositeOperation = 'destination-out';
          const sx = c.width / baseLayer.bounds[2],
            sy = c.height / baseLayer.bounds[3];
          for (const { l, p } of loaded)
            if (l.id !== baseLayer.id && ['mountain', 'city', 'facade'].includes(l.kind))
              ctx.drawImage(
                p.canvas,
                (l.bounds[0] - baseLayer.bounds[0]) * sx,
                (l.bounds[1] - baseLayer.bounds[1]) * sy,
                l.bounds[2] * sx,
                l.bounds[3] * sy,
              );
          const terrainPaint = readPaint(c);
          add(
            surface(
              baseLayer.bounds,
              (x, row) => point(x, row, 0.5),
              110,
              90,
              (u, v) => alpha(terrainPaint, u, v) > 12,
            ),
            terrainPaint.texture,
            'continuous foothill brushwork',
          );
        }
        for (const { l, p } of loaded) {
          if (l.id === 'connected-western-landform') continue;
          if (l.kind === 'city') {
            const c = document.createElement('canvas');
            c.width = p.w;
            c.height = p.h;
            const ctx = c.getContext('2d')!;
            ctx.drawImage(p.canvas, 0, 0);
            const face = loaded.find((a) => a.l.kind === 'facade' && a.l.town === l.town);
            if (face) {
              ctx.globalCompositeOperation = 'destination-out';
              ctx.drawImage(
                face.p.canvas,
                ((face.l.bounds[0] - l.bounds[0]) / l.bounds[2]) * p.w,
                ((face.l.bounds[1] - l.bounds[1]) / l.bounds[3]) * p.h,
                (face.l.bounds[2] / l.bounds[2]) * p.w,
                (face.l.bounds[3] / l.bounds[3]) * p.h,
              );
              ctx.globalCompositeOperation = 'source-over';
            }
            const hero = heroParts[l.id];
            if (hero) {
              const unit = 2400 / 1586,
                b = hero.box.map((n) => n * unit) as [number, number, number, number];
              const h = document.createElement('canvas');
              h.width = Math.ceil(b[2]);
              h.height = Math.ceil(b[3]);
              const hc = h.getContext('2d')!;
              hc.beginPath();
              hero.path.forEach(([x, y], i) =>
                i ? hc.lineTo(x * unit, y * unit) : hc.moveTo(x * unit, y * unit),
              );
              hc.closePath();
              hc.clip();
              hc.drawImage(
                p.canvas,
                ((b[0] - l.bounds[0]) / l.bounds[2]) * p.w,
                ((b[1] - l.bounds[1]) / l.bounds[3]) * p.h,
                (b[2] / l.bounds[2]) * p.w,
                (b[3] / l.bounds[3]) * p.h,
                0,
                0,
                h.width,
                h.height,
              );
              ctx.save();
              ctx.globalCompositeOperation = 'destination-out';
              ctx.drawImage(
                h,
                ((b[0] - l.bounds[0]) / l.bounds[2]) * p.w,
                ((b[1] - l.bounds[1]) / l.bounds[3]) * p.h,
                (b[2] / l.bounds[2]) * p.w,
                (b[3] / l.bounds[3]) * p.h,
              );
              ctx.restore();
              card({ ...l, id: l.id + '-landmark', bounds: b }, readPaint(h), 0.93, 1.5);
            }
            const cityPaint = readPaint(c);
            add(
              surface(
                l.bounds,
                (x, row) => point(x, row, 1.4),
                60,
                32,
                (u, v) => alpha(cityPaint, u, v) > 12,
              ),
              cityPaint.texture,
              l.id + '-streets',
            );
          } else if (l.kind === 'far') card(l, p, 0.82, 1);
          else if (l.kind === 'mountain')
            card(
              l,
              p,
              l.id === 'foreground-ridge' ? 0.67 : 0.72,
              l.id === 'qinling-main-spine' ? 3 : 2,
            );
          else if (l.kind === 'facade') card(l, p, 0.94, 0);
          else if (l.kind === 'bridge') card(l, p, 0.8, 0);
          else card(l, p, 0.28, 2);
        }
        ready = true;
        element.dataset.ready = 'true';
        element.dataset.meshes = String(meshes.length);
        element.dataset.worldUp = 'Y';
        element.dataset.geometry = 'ground-and-rooted-folded-surfaces';
        current.current.onReady();
      } catch (error) {
        if (!disposed) {
          console.error('Paper ink assets failed', error);
          current.current.onError();
        }
      }
    })();
    const configure = (p: DepthPose, yaw = 0) => {
      const v = current.current,
        aspect = v.size.width / v.size.height;
      const extent = Math.min(1320, 2180 / aspect),
        distance = 4600;
      camera.left = (-extent * aspect) / 2;
      camera.right = (extent * aspect) / 2;
      camera.top = extent / 2;
      camera.bottom = -extent / 2;
      camera.zoom = p.zoom;
      const down =
        paperWorld.down + (v.inspect && !v.reducedMotion ? Math.sin(clock * 0.16) * 0.035 : 0);
      const t = paperPoint(p.x, p.y, 28);
      camera.position.set(
        t[0] + Math.sin(yaw) * distance * Math.cos(down),
        t[1] + distance * Math.sin(down),
        t[2] + Math.cos(yaw) * distance * Math.cos(down),
      );
      camera.lookAt(...t);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    };
    const groundHit = (p: Pixel) => {
      if (!ground) return null;
      ray.setFromCamera(
        new THREE.Vector2(
          (p.x / current.current.size.width) * 2 - 1,
          1 - (p.y / current.current.size.height) * 2,
        ),
        camera,
      );
      return ray.intersectObject(ground, false)[0]?.point ?? null;
    };
    const limited = (p: DepthPose) =>
      paperLimitView(p.x, p.y, p.zoom, current.current.size.width / current.current.size.height);
    const api: PaperStageApi = {
      frame: (f) => {
        latest = f;
        version++;
      },
      pick: (x, y) => {
        const h = groundHit({ x, y });
        return h ? paperMap(h.toArray() as [number, number, number]) : null;
      },
      pan: (from, to) => {
        configure(pose);
        const a = groundHit(from),
          b = groundHit(to);
        if (!a || !b) return pose;
        const target = paperPoint(pose.x, pose.y);
        const map = paperMap([target[0] + a.x - b.x, 0, target[2] + a.z - b.z]);
        pose = limited({ ...pose, x: map.x, y: map.y });
        manual = true;
        configure(pose);
        return { ...pose };
      },
      zoomAt: (
        factor,
        p = { x: current.current.size.width / 2, y: current.current.size.height / 2 },
      ) => {
        configure(pose);
        const a = groundHit(p);
        const next = limited({ ...pose, zoom: pose.zoom * factor });
        configure(next);
        const b = groundHit(p);
        if (a && b) {
          const t = paperPoint(next.x, next.y);
          const m = paperMap([t[0] + a.x - b.x, 0, t[2] + a.z - b.z]);
          next.x = m.x;
          next.y = m.y;
        }
        pose = limited(next);
        manual = true;
        configure(pose);
        return { ...pose };
      },
    };
    props.api.current = api;
    const life = () => {
      if (!latest || version === drawnVersion) return;
      drawnVersion = version;
      for (const [id, source] of Object.entries({ water: latest.water, effects: latest.effects })) {
        let item = dynamic.get(id);
        if (!item) {
          const texture = new THREE.CanvasTexture(source);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearFilter;
          resources.push(texture);
          const geometry = surface(
            [0, 0, 2400, 1501],
            (x, row) => (id === 'water' ? paperPoint(x, row, 0.8) : point(x, row, 2.6)),
            100,
            66,
          );
          const mesh = add(geometry, texture, id, true);
          mesh.renderOrder = 2;
          item = { texture, mesh };
          dynamic.set(id, item);
        }
        item.texture.needsUpdate = true;
      }
      for (const mist of latest.mists) {
        let mesh = mists.get(mist.id);
        if (!mesh) {
          const texture = new THREE.CanvasTexture(mist.image);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearFilter;
          resources.push(texture);
          const g = surface(
            [0, 0, 1, 1],
            (_, __, u, v) => [
              (u - 0.5) * mist.bounds[2],
              0,
              ((v - 0.5) * mist.bounds[3]) / Math.sin(paperWorld.down),
            ],
            1,
            1,
          );
          mesh = add(g, texture, mist.id, true);
          (mesh.material as THREE.MeshBasicMaterial).opacity = 0.65;
          mesh.renderOrder = 35;
          mists.set(mist.id, mesh);
        }
        mesh.position.set(
          ...paperPoint(
            mist.bounds[0] + mist.bounds[2] / 2,
            mist.bounds[1] + mist.bounds[3] / 2,
            52 + mist.lift * 0.35,
          ),
        );
      }
      if (!actorTexture) {
        actorTexture = new THREE.CanvasTexture(latest.actors);
        actorTexture.colorSpace = THREE.SRGBColorSpace;
        actorTexture.generateMipmaps = false;
        actorTexture.minFilter = THREE.LinearFilter;
        resources.push(actorTexture);
        actorMaterial = material(actorTexture);
      }
      actorTexture.needsUpdate = true;
      for (const entity of latest.entities) {
        let mesh = actors.get(entity.id);
        const t = entity.tile;
        if (!mesh) {
          const g = make(
            [
              -t.width / 2,
              t.foot - t.height,
              0,
              t.width / 2,
              t.foot - t.height,
              0,
              t.width / 2,
              t.foot,
              0,
              -t.width / 2,
              t.foot,
              0,
            ],
            new Array(8).fill(0),
            [0, 1, 2, 0, 2, 3],
          );
          mesh = new THREE.Mesh(g, actorMaterial!);
          mesh.name = entity.id;
          scene.add(mesh);
          actors.set(entity.id, mesh);
        }
        const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
        const l = t.x / 1024,
          r = (t.x + t.width) / 1024,
          top = 1 - t.y / 512,
          b = 1 - (t.y + t.height) / 512;
        uv.setXY(0, l, b);
        uv.setXY(1, r, b);
        uv.setXY(2, r, top);
        uv.setXY(3, l, top);
        uv.needsUpdate = true;
        const h = entity.kind === 'boat' ? 1.7 : land(entity.x, entity.y) + 2;
        mesh.position.set(...paperPoint(entity.x, entity.y, h));
      }
    };
    const project = (p: readonly number[]) => {
      const v = new THREE.Vector3(...p).project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * current.current.size.width,
        y: (0.5 - v.y * 0.5) * current.current.size.height,
      };
    };
    const draw = (now: number) => {
      if (disposed) return;
      const v = current.current,
        dt = last ? Math.min(150, now - last) : 16;
      last = now;
      const viewKey = JSON.stringify(v.view);
      if (viewKey !== lastView) {
        pose = limited(v.view);
        lastView = viewKey;
      }
      if (!v.reducedMotion && !document.hidden) clock += dt / 1000;
      const yaw = v.reducedMotion
        ? 0
        : v.inspect
          ? Math.sin(clock * 0.23) * 0.07
          : v.ambient
            ? Math.sin(clock * 0.05) * 0.006
            : 0;
      configure(pose, manual ? 0 : yaw);
      manual = false;
      if (width !== v.size.width || height !== v.size.height) {
        width = v.size.width;
        height = v.size.height;
        renderer.setSize(width, height, false);
      }
      const key = [pose.x, pose.y, pose.zoom, yaw, width, height].join(',');
      if (ready && !(v.reducedMotion && key === renderedKey && drawnVersion === version)) {
        life();
        for (const actor of actors.values())
          actor.rotation.y = Math.atan2(
            camera.position.x - paperPoint(pose.x, pose.y)[0],
            camera.position.z - paperPoint(pose.x, pose.y)[2],
          );
        renderer.render(scene, camera);
        frames++;
        renderedKey = key;
        if (!v.reducedMotion && dt > 0) {
          intervals.push(dt);
          if (intervals.length > 180) intervals.shift();
        }
        const projected = {} as DepthProjection;
        for (const [id, p] of Object.entries(layout.places)) {
          const label = project(point(p.labelX, p.labelY, 18));
          const corners = [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ].map(([a, b]) =>
            project(point(p.x + (a * p.hitWidth) / 2, p.y + (b * p.hitHeight) / 2, 35)),
          );
          const xs = corners.map((c) => c.x),
            ys = corners.map((c) => c.y),
            left = Math.min(...xs),
            top = Math.min(...ys);
          projected[id as GameId] = {
            ...label,
            left,
            top,
            width: Math.max(...xs) - left,
            height: Math.max(...ys) - top,
          };
        }
        v.onProject(projected);
        if (now - report > 200 || v.reducedMotion) {
          element.dataset.pose = JSON.stringify({ ...pose, yaw: +yaw.toFixed(4) });
          element.dataset.renderedFrames = String(frames);
          element.dataset.triangles = String(renderer.info.render.triangles);
          element.dataset.drawCalls = String(renderer.info.render.calls);
          element.dataset.actors = String(actors.size);
          const sorted = [...intervals].sort((a, b) => a - b);
          element.dataset.frameTime = JSON.stringify({
            samples: sorted.length,
            median: +(sorted[Math.floor(sorted.length * 0.5)] ?? 0).toFixed(1),
            p95: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1),
          });
          element.dataset.probes = JSON.stringify(
            layout.probes.map((p) => {
              const mesh = meshes.find((m) => m.name === p.layer);
              const pos = mesh?.userData.positionAt as
                ((x: number, y: number, u: number) => readonly number[]) | undefined;
              const l = layout.layers.find((l) => l.id === p.layer)!;
              const world = pos
                ? pos(p.x, p.y, (p.x - l.bounds[0]) / l.bounds[2])
                : point(p.x, p.y);
              const screen = project(world);
              return { id: p.id, ...screen, height: world[1] };
            }),
          );
          report = now;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      props.api.current = null;
      resources.forEach((r) => r.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.layout]);
  return (
    <div ref={host} className="fine-ink-depth" data-ready="false" data-kind="paper-stage-world" />
  );
}
