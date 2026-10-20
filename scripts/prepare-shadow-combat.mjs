import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Matrix4, Quaternion, Vector3 } from 'three';
const root = fileURLToPath(new URL('../', import.meta.url));
const art = join(root, 'apps/xiyou/art/shadow-actions-v6');
const target = join(root, 'apps/website/public/games/xiyou/assets/shadow');
const writeChanged = (path, value) => {
  if (!existsSync(path) || readFileSync(path, 'utf8') !== value) writeFileSync(path, value);
};
mkdirSync(target, { recursive: true });
const manifest = JSON.parse(readFileSync(join(art, 'manifest.json'), 'utf8'));
const metadata = manifest.characters.map((c) => {
  const path = join(art, c.id, c.runtime),
    raw = readFileSync(path);
  const gltf = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString());
  const binary = raw.subarray(28 + raw.readUInt32LE(12));
  const accessor = (index) => {
    const a = gltf.accessors[index],
      view = gltf.bufferViews[a.bufferView],
      size = { 5121: 1, 5123: 2, 5126: 4 }[a.componentType],
      components = { VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type],
      out = [];
    for (let i = 0; i < a.count; i++)
      for (let j = 0; j < components; j++) {
        const offset =
          (view.byteOffset ?? 0) +
          (a.byteOffset ?? 0) +
          i * (view.byteStride ?? size * components) +
          j * size;
        out.push(
          a.componentType === 5126
            ? binary.readFloatLE(offset)
            : a.componentType === 5123
              ? binary.readUInt16LE(offset)
              : binary.readUInt8(offset),
        );
      }
    return out;
  };
  const primitive = gltf.meshes[0].primitives[0],
    positions = accessor(primitive.attributes.POSITION),
    joints = accessor(primitive.attributes.JOINTS_0);
  const weaponJoint = gltf.skins[0].joints.indexOf(
    gltf.nodes.findIndex((n) => n.name === 'weapon'),
  );
  const weaponPoints = [];
  for (let i = 0; i < positions.length / 3; i++)
    if (joints[i * 4] === weaponJoint) weaponPoints.push(positions.slice(i * 3, i * 3 + 3));
  const weaponSize = [0, 1].map(
    (axis) =>
      Math.max(...weaponPoints.map((p) => p[axis])) - Math.min(...weaponPoints.map((p) => p[axis])),
  );
  const inverseBinds = accessor(gltf.skins[0].inverseBindMatrices);
  const inverseWeapon = new Matrix4().fromArray(inverseBinds, weaponJoint * 16);
  const localWeaponPoints = weaponPoints.map((p) =>
    new Vector3().fromArray(p).applyMatrix4(inverseWeapon),
  );
  localWeaponPoints.sort((a, b) => b.lengthSq() - a.lengthSq());
  const tip = localWeaponPoints[0].clone().add(localWeaponPoints[1]).multiplyScalar(0.5);
  const matrices = new Map();
  const visit = (index, parent) => {
    const node = gltf.nodes[index];
    const local = new Matrix4();
    if (node.matrix) local.fromArray(node.matrix);
    else
      local.compose(
        new Vector3().fromArray(node.translation ?? [0, 0, 0]),
        new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
        new Vector3().fromArray(node.scale ?? [1, 1, 1]),
      );
    const world = parent.clone().multiply(local);
    matrices.set(index, world);
    for (const child of node.children ?? []) visit(child, world);
  };
  for (const index of gltf.scenes[gltf.scene ?? 0].nodes) visit(index, new Matrix4());
  const index = gltf.nodes.findIndex((n) => n.name === 'pelvis');
  const pelvis = new Vector3().setFromMatrixPosition(matrices.get(index));
  cpSync(path, join(target, c.id + '.glb'));
  const ui = join(target, c.id);
  mkdirSync(ui, { recursive: true });
  cpSync(join(art, c.id, 'parts/head.png'), join(ui, 'head.png'));
  cpSync(join(art, c.id, 'parts/weapon.png'), join(ui, 'weapon.png'));
  if (existsSync(join(art, c.id, 'standee.png')))
    cpSync(join(art, c.id, 'standee.png'), join(ui, 'standee.png'));
  cpSync(
    join(art, c.id, existsSync(join(art, c.id, 'icons')) ? 'icons' : 'thumbnails'),
    join(ui, 'skills'),
    { recursive: true },
  );
  return {
    id: c.id,
    height: c.height,
    center: pelvis.x,
    walk_period: c.walk_period,
    walk_distance: c.walk_distance,
    weapon_size: weaponSize.map((v) => Math.round(v * 1e6) / 1e6),
    weapon_tip: tip.toArray().map((v) => Math.round(v * 1e6) / 1e6),
  };
});
writeChanged(join(art, 'runtime.json'), JSON.stringify(metadata, null, 2) + '\n');
const book = JSON.parse(readFileSync(join(art, 'skills.json'), 'utf8'));
const entries = book.entries
  .filter((e) => e.kind === 'active')
  .map((e) =>
    Object.fromEntries(
      ['id', 'actor', 'clip', 'kind', 'ultimate', 'motion', 'rehearsal_cooldown'].map((k) => [
        k,
        e[k],
      ]),
    ),
  );
if (entries.length !== 60) throw Error('Expected sixty hero combat actions');
writeChanged(join(art, 'combat.json'), JSON.stringify({ entries }) + '\n');
writeFileSync(join(target, 'skills.json'), readFileSync(join(art, 'skills.json')));
console.log('Prepared eight native puppets and sixty equipable combat actions.');
