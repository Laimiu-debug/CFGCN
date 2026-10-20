import * as THREE from 'three';
import type { GameId } from '@cfgcn/shared';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadAtlasAsset, disposeAtlasAsset } from './atlas-art';
import type { AtlasAsset, SceneryPlacement } from './atlas-art';
import { geometry as atlas, atlasRegion } from './atlas';
import { atlasGroundColor, atlasHabitat } from './atlas-ink';
import { atlasViewBounds } from './atlas-view';
import { atlasTownClearance } from './atlas-countryside';

type Options = {
  scene: THREE.Scene;
  anchors: Map<GameId, THREE.Vector3>;
  ground: (x: number, z: number) => number;
  channels: THREE.Vector3[][];
  compact: boolean;
  palette: (name: string) => THREE.Color;
  isWater: (point: THREE.Vector3) => boolean;
};
const random = (n: number) => {
  const v = Math.sin(n * 127.1 + 73.7) * 43758.5453;
  return v - Math.floor(v);
};

// Studio features share one geographic ground. No per-cell water patches or
// enlarged diorama rings outside the authored camera boundary.
export function populateAtlasBiomes({
  scene,
  anchors,
  ground,
  channels,
  compact,
  palette,
  isWater,
}: Options) {
  const root = new THREE.Group();
  root.name = 'Tripo countryside with baked terrain roots';
  scene.add(root);
  let disposed = false;
  const depth = (360 * atlas.height) / atlas.width;
  const places: Partial<Record<AtlasAsset, SceneryPlacement[]>> = {
    ridge: [],
    woodland: [],
    farmland: [],
    riverbank: [],
    marsh: [],
    jiangnan: [],
  };
  const regionAt = (x: number, z: number) =>
    atlasRegion(
      atlas.west + (x / 360 + 0.5) * (atlas.east - atlas.west),
      atlas.north - (z / depth + 0.5) * (atlas.north - atlas.south),
    );
  const regionCounts: Record<GameId, number> = { xiyou: 0, sanguo: 0, shuihu: 0, honglou: 0 };
  const townClear = (x: number, z: number, extra = 0) =>
    atlasTownClearance(x, z, anchors) > 8 + extra;
  const riverPoints = channels.flat().filter((_, i) => i % 3 === 0);
  const riverDistance = (x: number, z: number) => {
    let best = Infinity;
    for (const p of riverPoints) best = Math.min(best, (p.x - x) ** 2 + (p.z - z) ** 2);
    return Math.sqrt(best);
  };
  const step = compact ? 23 : 21;
  const bounds = atlasViewBounds;
  for (let row = 0, z = bounds.north - 18; z < bounds.south + 20; row++, z += step * 0.87) {
    for (
      let col = 0, x = bounds.left - 18 + (row % 2) * step * 0.5;
      x < bounds.right + 20;
      col++, x += step
    ) {
      const seed = row * 43 + col;
      const px = x + (random(seed) - 0.5) * 10,
        pz = z + (random(seed + 70) - 0.5) * 10;
      const y = ground(px, pz);
      const slope = Math.max(
        Math.abs(ground(px + 4, pz) - ground(px - 4, pz)),
        Math.abs(ground(px, pz + 4) - ground(px, pz - 4)),
      );
      if (!townClear(px, pz) || isWater(new THREE.Vector3(px, y, pz))) continue;
      const region = regionAt(px, pz),
        choice = random(seed + 20);
      const river = riverDistance(px, pz);
      const marsh = anchors.get('shuihu')!,
        garden = anchors.get('honglou')!;
      let type: AtlasAsset;
      // A sparse ridge line follows real relief. Western land is not all rock.
      if (y > 5.5 && slope > 1.2 && choice > 0.56) type = 'ridge';
      else if (slope > 3.8) continue;
      else if (river < 6 && region === 'shuihu') type = 'marsh';
      else if (river < 6 && region === 'honglou' && places.riverbank!.length < 8)
        type = 'riverbank';
      else if (river < 7.5) continue;
      else if (region === 'shuihu' && Math.hypot(px - marsh.x, pz - marsh.z) < 31 && choice > 0.4)
        type = 'marsh';
      else if (
        region === 'honglou' &&
        Math.hypot(px - garden.x, pz - garden.z) < 32 &&
        choice > 0.55 &&
        places.jiangnan!.length < 4
      )
        type = 'jiangnan';
      else if (atlasHabitat(px, pz, y) > 0.55 || choice > (region === 'sanguo' ? 0.7 : 0.88))
        type = 'woodland';
      else type = 'farmland';
      if (type === 'woodland' && !townClear(px, pz, 2)) continue;
      if (
        type === 'farmland' &&
        (river < 9 ||
          !townClear(px, pz, 3) ||
          places.farmland!.some((p) => Math.hypot(p.position.x - px, p.position.z - pz) < 18))
      )
        continue;
      regionCounts[region]++;
      places[type]!.push({
        position: new THREE.Vector3(px, y - 0.12, pz),
        scale:
          type === 'ridge'
            ? 0.65 + random(seed + 90) * 0.2
            : type === 'woodland'
              ? 0.9 + random(seed + 90) * 0.18
              : type === 'farmland'
                ? 0.83 + random(seed + 90) * 0.13
                : 0.58 + random(seed + 90) * 0.2,
        heightScale: type === 'ridge' ? 0.6 : type === 'woodland' ? 0.85 : 1,
        rotation:
          type === 'ridge'
            ? Math.sin(px * 0.02 + pz * 0.035) * 0.4
            : random(seed + 30) * Math.PI * 2,
      });
    }
  }
  // A few garden features belong to Jinling's outskirts, not every eastern
  // countryside cell. Keep its local identity even when river exclusions win.
  const garden = anchors.get('honglou')!;
  for (const [dx, dz] of [
    [-24, 16],
    [-27, -8],
    [7, 25],
    [-8, -25],
  ]) {
    if (places.jiangnan!.length >= 3) break;
    const x = garden.x + dx,
      z = garden.z + dz,
      y = ground(x, z);
    if (!townClear(x, z) || isWater(new THREE.Vector3(x, y, z))) continue;
    places.jiangnan!.push({
      position: new THREE.Vector3(x, y - 0.12, z),
      scale: 0.65,
      rotation: Math.atan2(dx, dz),
    });
    regionCounts.honglou++;
  }
  root.userData.instances = Object.fromEntries(
    Object.entries(places).map(([k, v]) => [k, v.length]),
  );
  root.userData.regions = regionCounts;
  const ready = Promise.all(
    Object.entries(places).map(async ([name, placements]) => {
      if (!placements.length) return;
      const asset = await loadAtlasAsset(name as AtlasAsset);
      if (disposed) {
        disposeAtlasAsset(asset);
        return;
      }
      asset.updateMatrixWorld(true);
      asset.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const cells = new Map<string, THREE.BufferGeometry[]>();
        const transform = new THREE.Object3D(),
          matrix = new THREE.Matrix4();
        for (const place of placements) {
          transform.position.copy(place.position);
          transform.rotation.set(0, place.rotation, 0);
          transform.scale.set(place.scale, place.scale * (place.heightScale ?? 1), place.scale);
          transform.updateMatrix();
          matrix.multiplyMatrices(transform.matrix, node.matrixWorld);
          const geometry = node.geometry.clone();
          const source = node.geometry.getAttribute('position');
          geometry.applyMatrix4(matrix);
          const positions = geometry.getAttribute('position');
          node.geometry.computeBoundingBox();
          const box = node.geometry.boundingBox!;
          const halfX = Math.max(Math.abs(box.min.x), Math.abs(box.max.x));
          const halfZ = Math.max(Math.abs(box.min.z), Math.abs(box.max.z));
          const soil = new Float32Array(positions.count * 3),
            roots = new Float32Array(positions.count);
          for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i),
              z = positions.getZ(i),
              y = ground(x, z);
            // Bake ground displacement and rebuild normals. Shadow, bounds and
            // visible geometry agree; the vertex shader no longer squashes it.
            positions.setY(
              i,
              positions.getY(i) + y - place.position.y + (name === 'farmland' ? 0.06 : -0.12),
            );
            atlasGroundColor(x, z, y, palette).toArray(soil, i * 3);
            roots[i] = 1 - THREE.MathUtils.smoothstep(source.getY(i), 0.05, 1.3);
            if (name === 'farmland')
              roots[i] *= THREE.MathUtils.smoothstep(
                Math.hypot(source.getX(i) / halfX, source.getZ(i) / halfZ),
                0.52,
                1.02,
              );
          }
          geometry.setAttribute('atlasSoil', new THREE.BufferAttribute(soil, 3));
          geometry.setAttribute('atlasRoot', new THREE.BufferAttribute(roots, 1));
          geometry.computeVertexNormals();
          const normals = geometry.getAttribute('normal');
          const normal = new THREE.Vector3(),
            landNormal = new THREE.Vector3();
          for (let i = 0; i < positions.count; i++) {
            if (roots[i] === 0) continue;
            const x = positions.getX(i),
              z = positions.getZ(i);
            landNormal
              .set(
                ground(x - 0.5, z) - ground(x + 0.5, z),
                1,
                ground(x, z - 0.5) - ground(x, z + 0.5),
              )
              .normalize();
            normal.fromBufferAttribute(normals, i).lerp(landNormal, roots[i]).normalize();
            normals.setXYZ(i, normal.x, normal.y, normal.z);
          }
          const key = `${Math.floor(place.position.x / 70)},${Math.floor(place.position.z / 70)}`;
          const bucket = cells.get(key) ?? [];
          bucket.push(geometry);
          cells.set(key, bucket);
        }
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (!(material instanceof THREE.MeshStandardMaterial)) continue;
          material.userData.atlasConforming = true;
          material.onBeforeCompile = (shader) => {
            shader.vertexShader =
              'attribute vec3 atlasSoil; attribute float atlasRoot; varying vec3 atlasGroundPigment; varying float atlasRootMix;\n' +
              shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              '#include <begin_vertex>\natlasGroundPigment=atlasSoil; atlasRootMix=atlasRoot;',
            );
            shader.fragmentShader =
              'varying vec3 atlasGroundPigment; varying float atlasRootMix;\n' +
              shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              '#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,atlasGroundPigment,atlasRootMix);',
            );
          };
          material.customProgramCacheKey = () => 'atlas-baked-root-v2';
        }
        for (const bucket of cells.values()) {
          const geometry = mergeGeometries(bucket)!;
          bucket.forEach((g) => g.dispose());
          geometry.computeBoundingSphere();
          const mesh = new THREE.Mesh(geometry, node.material);
          mesh.receiveShadow = true;
          root.add(mesh);
        }
      });
      asset.visible = false;
      root.add(asset);
    }),
  );
  return {
    root,
    ready,
    footprints: Object.entries(places).flatMap(([name, placements]) =>
      placements.map((p) => ({
        x: p.position.x,
        z: p.position.z,
        radius: (name === 'woodland' ? 9 : name === 'farmland' ? 9.5 : 6) * p.scale,
      })),
    ),
    dispose() {
      disposed = true;
      scene.remove(root);
      disposeAtlasAsset(root);
    },
  };
}
