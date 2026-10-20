import * as THREE from 'three';
import type { GameId } from '@cfgcn/shared';
import { disposeAtlasAsset, instanceAtlasAsset, loadAtlasAsset } from './atlas-art';
import type { AtlasAsset, SceneryPlacement } from './atlas-art';
import { geometry, atlasRegion } from './atlas';
import { atlasGroundColor } from './atlas-ink';
import { atlasTownClearance } from './atlas-countryside';

type Options = {
  scene: THREE.Scene;
  towns: Map<GameId, THREE.Group>;
  anchors: Map<GameId, THREE.Vector3>;
  positionAt: (u: number, v: number) => THREE.Vector3;
  heightAt: (u: number, v: number) => number;
  isWater: (point: THREE.Vector3) => boolean;
  palette: (token: string) => THREE.Color;
  width: number;
  depth: number;
  arrival: boolean;
  compact: boolean;
};

const townAssets: Record<GameId, AtlasAsset> = {
  xiyou: 'changan',
  sanguo: 'hanzhong',
  shuihu: 'liangshan',
  honglou: 'jinling',
};
const noise = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export function populateAtlasLandscape(options: Options) {
  const {
    scene,
    towns,
    anchors,
    positionAt,
    heightAt,
    isWater,
    palette,
    width,
    depth,
    arrival,
    compact,
  } = options;
  const root = new THREE.Group();
  root.name = 'Tripo towns and inhabited countryside';
  scene.add(root);
  let disposed = false;
  const ground = (x: number, z: number) => heightAt(x / width + 0.5, z / depth + 0.5);
  const slope = (x: number, z: number) =>
    Math.max(
      Math.abs(ground(x + 2, z) - ground(x - 2, z)),
      Math.abs(ground(x, z + 2) - ground(x, z - 2)),
    );
  const nearTown = (point: THREE.Vector3, radius: number) =>
    [...anchors.values()].some((a) => Math.hypot(a.x - point.x, a.z - point.z) < radius);
  const surfaces: number[] = [],
    surfaceColors: number[] = [];
  const fieldColors = [
    palette('gold').lerp(palette('paper-raised'), 0.3),
    palette('scene-mist').lerp(palette('jade'), 0.3),
    palette('gold-ink').lerp(palette('paper-shade'), 0.58),
  ];
  function field(x: number, z: number, size: number, seed: number) {
    if (isWater(new THREE.Vector3(x, 0, z))) return;
    // These are terrain surfaces, not pretend building models. Every corner
    // follows the DEM and fields are only placed on modest, dry slopes.
    const angle = Math.sin(x * 0.018 + z * 0.025) * 0.35;
    const sample = (u: number, v: number) => {
      const dx = (u - 0.5) * size * (1 + Math.sin(v * 3 + seed) * 0.1);
      const dz = (v - 0.5) * size * 0.78;
      return new THREE.Vector3(
        x + dx * Math.cos(angle) - dz * Math.sin(angle),
        0,
        z + dx * Math.sin(angle) + dz * Math.cos(angle),
      );
    };
    // Subdivided, gently curved strips follow the land rather than forming a
    // raised circular diorama. Edges wash into the same shared earth pigment.
    for (let row = 0; row < 15; row++)
      for (let col = 0; col < 15; col++) {
        const u0 = col / 15,
          u1 = (col + 1) / 15;
        const v0 = row / 15 + (row % 3 === 0 ? 0.003 : 0),
          v1 = (row + 1) / 15 - (row % 3 === 2 ? 0.003 : 0);
        for (const [u, v] of [
          [u0, v0],
          [u0, v1],
          [u1, v0],
          [u1, v0],
          [u0, v1],
          [u1, v1],
        ]) {
          const point = sample(u, v),
            h = ground(point.x, point.z);
          surfaces.push(point.x, h + 0.07, point.z);
          const edge = THREE.MathUtils.smoothstep(Math.min(u, 1 - u, v, 1 - v), 0, 0.16);
          atlasGroundColor(point.x, point.z, h, palette)
            .lerp(fieldColors[(Math.floor(row / 3) + seed) % fieldColors.length], 0.75 * edge)
            .toArray(surfaceColors, surfaceColors.length);
        }
      }
  }
  function lane(start: THREE.Vector3, end: THREE.Vector3, seed: number) {
    const middle = start.clone().lerp(end, 0.5);
    middle.z += (noise(seed) - 0.5) * 5;
    const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
    const points = curve.getPoints(24);
    const positions: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1];
      const tangent = b.clone().sub(a).setY(0).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(0.24);
      const corners = [
        a.clone().add(normal),
        a.clone().sub(normal),
        b.clone().add(normal),
        b.clone().sub(normal),
      ];
      for (const index of [0, 2, 1, 2, 3, 1]) {
        const point = corners[index];
        positions.push(point.x, ground(point.x, point.z) + 0.1, point.z);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: palette('gold').lerp(palette('paper-raised'), 0.4),
      roughness: 1,
    });
    root.add(new THREE.Mesh(geometry, material));
  }
  const villagePlaces: SceneryPlacement[] = [];
  const forestPlaces: SceneryPlacement[] = [];
  if (!arrival) {
    let seed = 0;
    for (const [id, anchor] of anchors) {
      for (let i = 0; i < (compact ? 15 : 26); i++) {
        seed++;
        const angle = i * 2.4 + noise(seed) * 0.5;
        const radius = 15 + noise(seed + 40) * 26;
        const x = anchor.x + Math.cos(angle) * radius;
        const z = anchor.z + Math.sin(angle) * radius * 0.7;
        const point = new THREE.Vector3(x, ground(x, z), z);
        if (
          isWater(point) ||
          point.y > 10 ||
          slope(x, z) > 2 ||
          atlasTownClearance(x, z, anchors) < 3.3
        )
          continue;
        if (villagePlaces.some((p) => Math.hypot(p.position.x - x, p.position.z - z) < 4)) continue;
        villagePlaces.push({
          position: point,
          scale: 0.78 + noise(seed + 17) * 0.3,
          rotation: angle,
        });
        lane(anchor, point, seed);
        if (id === 'xiyou' || id === 'sanguo') {
          if (slope(x + 4, z) < 1.1) field(x + 4, z, 3.5 + noise(seed) * 3, seed);
          if (i % 2 === 0) field(x - 5, z + 1, 4, seed + 1);
        }
      }
    }
    for (let grove = 0; grove < (compact ? 5 : 8); grove++) {
      const u = 0.08 + noise(grove * 3 + 201) * 0.86;
      const v = 0.08 + noise(grove * 3 + 202) * 0.84;
      const center = positionAt(u, v);
      const region = atlasRegion(
        geometry.west + u * (geometry.east - geometry.west),
        geometry.north - v * (geometry.north - geometry.south),
      );
      if (region === 'shuihu' || (region === 'honglou' && center.y < 10)) continue;
      if (center.y < 6 || center.y > 19 || nearTown(center, 15)) continue;
      for (let tree = 0; tree < 6; tree++) {
        const n = grove * 9 + tree;
        const x = center.x + (noise(n + 400) - 0.5) * 11;
        const z = center.z + (noise(n + 800) - 0.5) * 9;
        const p = new THREE.Vector3(x, ground(x, z) - 0.05, z);
        if (p.y < 0.05 || nearTown(p, 14)) continue;
        forestPlaces.push({
          position: p,
          scale: 0.9 + noise(n + 500) * 0.7,
          rotation: noise(n + 90) * Math.PI * 2,
        });
      }
    }
  } else {
    const city = anchors.get('xiyou')!;
    for (let i = 0; i < 26; i++) {
      const x = city.x - 13 - (i % 13) * 3.2;
      const z = city.z + (i < 13 ? -1 : 1) * (6 + noise(i) * 2);
      forestPlaces.push({
        position: new THREE.Vector3(x, ground(x, z), z),
        scale: 0.9 + noise(i + 2) * 0.4,
        rotation: noise(i) * Math.PI * 2,
      });
    }
    lane(city, new THREE.Vector3(city.x - 58, city.y, city.z), 1);
  }
  if (surfaces.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(surfaces, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(surfaceColors, 3));
    geometry.computeVertexNormals();
    root.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      ),
    );
  }
  root.userData.forestInstances = forestPlaces.length;
  root.userData.villageInstances = villagePlaces.length;
  const load = async (name: AtlasAsset, use: (asset: THREE.Group) => void) => {
    const asset = await loadAtlasAsset(name);
    if (disposed) {
      disposeAtlasAsset(asset);
      return;
    }
    use(asset);
  };
  const tasks = [...towns.entries()]
    .filter(([id]) => !arrival || id === 'xiyou')
    .map(([id, town]) =>
      load(townAssets[id], (asset) => {
        asset.updateMatrixWorld(true);
        const point = new THREE.Vector3();
        asset.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          const positions = node.geometry.getAttribute('position');
          const pigment = new Float32Array(positions.count * 3);
          const blend = new Float32Array(positions.count);
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
            const edge = Math.max(Math.abs(point.x), Math.abs(point.z));
            blend[i] =
              (1 - THREE.MathUtils.smoothstep(point.y, 0.12, 0.65)) *
              THREE.MathUtils.smoothstep(edge, 6, 11);
            if (blend[i] > 0)
              atlasGroundColor(
                point.x + town.position.x,
                point.z + town.position.z,
                town.position.y,
                palette,
              ).toArray(pigment, i * 3);
          }
          node.geometry.setAttribute('townPigment', new THREE.BufferAttribute(pigment, 3));
          node.geometry.setAttribute('townRootBlend', new THREE.BufferAttribute(blend, 1));
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;
            material.onBeforeCompile = (shader) => {
              shader.vertexShader =
                'attribute vec3 townPigment; attribute float townRootBlend; varying vec3 townSoil; varying float townEdge;\n' +
                shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\ntownSoil=townPigment;townEdge=townRootBlend;',
              );
              shader.fragmentShader =
                'varying vec3 townSoil; varying float townEdge;\n' + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                '#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,townSoil,townEdge);',
              );
            };
            material.customProgramCacheKey = () => 'atlas-town-ground-v1';
          }
        });
        asset.position.copy(town.position);
        asset.position.y -= 0.18;
        root.add(asset);
        town.userData.artLoaded = true;
      }),
    );
  tasks.push(
    load('pine', (asset) => {
      root.add(instanceAtlasAsset(asset, forestPlaces));
      asset.visible = false;
      root.add(asset);
    }),
  );
  if (!arrival)
    tasks.push(
      load('village', (asset) => {
        root.add(instanceAtlasAsset(asset, villagePlaces));
        asset.visible = false;
        root.add(asset);
      }),
    );
  return {
    root,
    villageFootprints: villagePlaces.map((p) => ({
      x: p.position.x,
      z: p.position.z,
      radius: 3.5 * p.scale,
    })),
    ready: Promise.all(tasks),
    dispose() {
      disposed = true;
      scene.remove(root);
      disposeAtlasAsset(root);
    },
  };
}
