import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export type AtlasAsset =
  | 'changan'
  | 'hanzhong'
  | 'liangshan'
  | 'jinling'
  | 'village'
  | 'pine'
  | 'ridge'
  | 'woodland'
  | 'farmland'
  | 'riverbank'
  | 'marsh'
  | 'jiangnan'
  | 'canopy'
  | 'shrub';

// Cache network bytes, not GPU objects. Each mounted scene owns and releases its
// geometry, textures and materials, including assets that finish after departure.
const downloads = new Map<AtlasAsset, Promise<ArrayBuffer>>();
export async function loadAtlasAsset(name: AtlasAsset) {
  let pending = downloads.get(name);
  if (!pending) {
    pending = fetch(`/art/atlas/models/${name}.glb`).then(async (response) => {
      if (!response.ok) throw new Error(`Atlas model unavailable: ${name}`);
      return response.arrayBuffer();
    });
    downloads.set(name, pending);
    pending.catch(() => downloads.delete(name));
  }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(await pending, '');
  gltf.scene.userData.asset = name;
  gltf.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.receiveShadow = true;
    node.castShadow = true;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.userData.atlasAsset = name;
        material.roughness = 0.94;
        material.metalness = 0;
      }
    }
  });
  return gltf.scene;
}

export function disposeAtlasAsset(root: THREE.Object3D) {
  const geometry = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (node instanceof THREE.InstancedMesh) node.dispose();
    geometry.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometry.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
  textures.forEach((value) => {
    if (typeof ImageBitmap !== 'undefined' && value.image instanceof ImageBitmap)
      value.image.close();
    value.dispose();
  });
}

export type SceneryPlacement = {
  position: THREE.Vector3;
  scale: number;
  heightScale?: number;
  rotation: number;
  tint?: THREE.Color;
};
export function instanceAtlasAsset(source: THREE.Object3D, places: SceneryPlacement[]) {
  const group = new THREE.Group();
  source.updateMatrixWorld(true);
  const transform = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  const tinted = places.some((place) => place.tint);
  const cells = new Map<string, SceneryPlacement[]>();
  for (const place of places) {
    const key =
      places.length < 32
        ? 'nearby'
        : `${Math.floor(place.position.x / 80)},${Math.floor(place.position.z / 80)}`;
    const bucket = cells.get(key) ?? [];
    bucket.push(place);
    cells.set(key, bucket);
  }
  source.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    // Small spatial batches let a close phone camera cull distant hills.
    // Material, geometry, texture and download are still shared.
    for (const bucket of cells.values()) {
      const instances = new THREE.InstancedMesh(node.geometry, node.material, bucket.length);
      instances.receiveShadow = true;
      instances.castShadow = false;
      bucket.forEach((place, index) => {
        transform.position.copy(place.position);
        transform.rotation.set(0, place.rotation, 0);
        transform.scale.set(place.scale, place.scale * (place.heightScale ?? 1), place.scale);
        transform.updateMatrix();
        matrix.multiplyMatrices(transform.matrix, node.matrixWorld);
        instances.setMatrixAt(index, matrix);
        if (tinted) instances.setColorAt(index, place.tint ?? new THREE.Color());
      });
      instances.instanceMatrix.needsUpdate = true;
      instances.computeBoundingSphere();
      // Conforming vertices can rise above the undeformed source's bounds.
      if (instances.boundingSphere) instances.boundingSphere.radius += 10;
      group.add(instances);
    }
  });
  return group;
}
