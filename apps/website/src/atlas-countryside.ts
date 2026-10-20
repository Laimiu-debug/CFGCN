import * as THREE from 'three';
import type { GameId } from '@cfgcn/shared';
import { atlasGroundColor, atlasHabitat } from './atlas-ink';
import { atlasViewBounds } from './atlas-view';
import { disposeAtlasAsset, instanceAtlasAsset, loadAtlasAsset } from './atlas-art';
import type { SceneryPlacement } from './atlas-art';

// Rectangular footprints follow the model extents. A large circular exclusion
// around every city used to remove almost all countryside between neighbours.
export const atlasTownFootprints: Record<GameId, [number, number]> = {
  xiyou: [12.5, 12.5],
  sanguo: [9.5, 9.5],
  shuihu: [11, 11],
  honglou: [12, 12],
};
export function atlasTownClearance(x: number, z: number, anchors: Map<GameId, THREE.Vector3>) {
  let clearance = Infinity;
  for (const [id, town] of anchors) {
    const [width, depth] = atlasTownFootprints[id];
    const dx = Math.abs(x - town.x) - width,
      dz = Math.abs(z - town.z) - depth;
    clearance = Math.min(
      clearance,
      Math.hypot(Math.max(0, dx), Math.max(0, dz)) + Math.min(0, Math.max(dx, dz)),
    );
  }
  return clearance;
}
const noise = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

type Options = {
  scene: THREE.Scene;
  anchors: Map<GameId, THREE.Vector3>;
  ground: (x: number, z: number) => number;
  isWater: (point: THREE.Vector3) => boolean;
  palette: (name: string) => THREE.Color;
  compact: boolean;
  occupied: { x: number; z: number; radius: number }[];
};

export function populateAtlasCountryside({
  scene,
  anchors,
  ground,
  isWater,
  palette,
  compact,
  occupied,
}: Options) {
  const root = new THREE.Group();
  root.name = 'Continuous fields, Studio tree belts and bank undergrowth';
  scene.add(root);
  let disposed = false;
  const trees: SceneryPlacement[] = [],
    shrubs: SceneryPlacement[] = [];
  const point = new THREE.Vector3();
  const dry = (x: number, z: number) => !isWater(point.set(x, ground(x, z), z));
  const slope = (x: number, z: number) =>
    Math.max(
      Math.abs(ground(x + 2, z) - ground(x - 2, z)),
      Math.abs(ground(x, z + 2) - ground(x, z - 2)),
    );
  const outside = (x: number, z: number, margin: number) =>
    atlasTownClearance(x, z, anchors) > margin;
  const bounds = atlasViewBounds;
  const positions: number[] = [],
    colors: number[] = [];
  const pigments = [
    palette('gold').lerp(palette('gold-ink'), 0.08),
    palette('jade').lerp(palette('gold'), 0.56).lerp(palette('paper-shade'), 0.2),
    palette('gold-ink').lerp(palette('paper-shade'), 0.56),
    palette('scene-mist').lerp(palette('jade'), 0.4),
  ];
  let fields = 0;
  // Curving adjoining parcels are actual DEM-conforming ground surfaces.
  // Water and building footprints clip each triangle, not just each cell centre.
  for (let row = 0, z = bounds.north - 10; z < bounds.south + 10; row++, z += 8.5) {
    for (let col = 0, x = bounds.left - 12; x < bounds.right + 12; col++, x += 10.5) {
      const seed = row * 47 + col,
        h = ground(x, z);
      if (atlasHabitat(x, z, h) > 0.62 || slope(x, z) > 2.2 || h > 15) continue;
      const sample = (u: number, v: number) => {
        const pz = z + (v - 0.5) * 8.2;
        const px =
          x +
          (u - 0.5) * 10.15 +
          Math.sin(pz * 0.055) * 3.7 +
          Math.sin(pz * 0.15 + col * 0.3) * 0.6;
        return new THREE.Vector3(
          px,
          ground(px, pz) + 0.035 + Math.sin(u * Math.PI * 12) * 0.015,
          pz,
        );
      };
      const pigment = pigments[Math.floor(noise(seed + 90) * pigments.length)];
      let triangles = 0;
      for (let j = 0; j < 4; j++)
        for (let i = 0; i < 8; i++) {
          const quad = [
            sample(i / 8, j / 4),
            sample((i + 1) / 8, j / 4),
            sample(i / 8, (j + 1) / 4),
            sample((i + 1) / 8, (j + 1) / 4),
          ];
          for (const indices of [
            [0, 2, 1],
            [1, 2, 3],
          ]) {
            const corners = indices.map((index) => quad[index]);
            if (corners.some((p) => !outside(p.x, p.z, 0.65) || !dry(p.x, p.z))) continue;
            for (let k = 0; k < corners.length; k++) {
              const p = corners[k],
                vertex = indices[k];
              const u = (i + (vertex % 2)) / 8,
                v = (j + (vertex > 1 ? 1 : 0)) / 4;
              const edge = THREE.MathUtils.smoothstep(Math.min(u, 1 - u, v, 1 - v), 0, 0.13);
              positions.push(p.x, p.y, p.z);
              const furrow = i % 3 === 0 ? 0.7 : 0.82;
              atlasGroundColor(p.x, p.z, p.y, palette)
                .lerp(pigment, furrow * edge)
                .toArray(colors, colors.length);
            }
            triangles++;
          }
        }
      if (triangles) fields++;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const fieldsMesh = new THREE.Mesh(geometry, material);
  fieldsMesh.receiveShadow = true;
  root.add(fieldsMesh);
  // A connected habitat field creates groves; finer stems fill the gaps between
  // the large Studio modules instead of duplicating complete dioramas per cell.
  const step = compact ? 7.4 : 5.8;
  for (let row = 0, z = bounds.north - 5; z < bounds.south + 6; row++, z += step * 0.86) {
    for (
      let col = 0, x = bounds.left - 5 + (row % 2) * step * 0.5;
      x < bounds.right + 6;
      col++, x += step
    ) {
      const seed = row * 109 + col;
      const px = x + (noise(seed) - 0.5) * step * 0.7,
        pz = z + (noise(seed + 73) - 0.5) * step * 0.6;
      const y = ground(px, pz),
        wooded = atlasHabitat(px, pz, y);
      if (!outside(px, pz, 1.65) || !dry(px, pz) || slope(px, pz) > 5) continue;
      if (occupied.some((p) => Math.hypot(p.x - px, p.z - pz) < p.radius)) continue;
      const bank =
        !dry(px - 2.2, pz) || !dry(px + 2.2, pz) || !dry(px, pz - 2.2) || !dry(px, pz + 2.2);
      const choice = noise(seed + 20);
      const tree = wooded > 0.39 || bank || choice > 0.82;
      if (!tree && choice < 0.42) continue;
      const target = tree ? trees : shrubs;
      target.push({
        position: new THREE.Vector3(px, y - 0.015, pz),
        scale: tree ? 0.8 + noise(seed + 3) * 0.5 : 1.0 + noise(seed + 3) * 0.55,
        rotation: noise(seed + 34) * Math.PI * 2,
        tint: palette('paper').lerp(palette('gold'), 0.05 + noise(seed + 23) * 0.1),
      });
      if (tree && wooded > 0.58 && choice > 0.3) {
        const dx = px + 1.8 + noise(seed + 55),
          dz = pz - 1.4;
        if (outside(dx, dz, 1.5) && dry(dx, dz))
          shrubs.push({
            position: new THREE.Vector3(dx, ground(dx, dz), dz),
            scale: 0.6 + noise(seed + 6) * 0.5,
            rotation: choice * 6,
          });
      }
    }
  }
  root.userData.fields = fields;
  root.userData.canopyInstances = trees.length;
  root.userData.shrubInstances = shrubs.length;
  const ready = Promise.all(
    (
      [
        ['canopy', trees],
        ['shrub', shrubs],
      ] as const
    ).map(async ([name, placements]) => {
      const asset = await loadAtlasAsset(name);
      if (disposed) {
        disposeAtlasAsset(asset);
        return;
      }
      const instances = instanceAtlasAsset(asset, placements);
      instances.traverse((node) => {
        if (node instanceof THREE.Mesh) node.castShadow = !compact && name === 'canopy';
      });
      root.add(instances);
      asset.visible = false;
      root.add(asset);
    }),
  );
  return {
    root,
    ready,
    dispose() {
      disposed = true;
      scene.remove(root);
      disposeAtlasAsset(root);
    },
  };
}
