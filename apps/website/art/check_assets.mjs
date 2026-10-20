import { readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const directory = resolve(root, 'apps/website/public/art/atlas/models');
const { assets } = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
const specifications = JSON.parse(
  await readFile(resolve(root, 'apps/website/art/sources.json'), 'utf8'),
);
const prompts = JSON.parse(await readFile(resolve(root, 'apps/website/art/prompts.json'), 'utf8'));
const hash = (value) => createHash('sha256').update(value).digest('hex');
assert.deepEqual(
  new Set(assets.map((a) => a.asset)),
  new Set([
    'changan',
    'hanzhong',
    'liangshan',
    'jinling',
    'village',
    'pine',
    'ridge',
    'woodland',
    'farmland',
    'riverbank',
    'marsh',
    'jiangnan',
    'canopy',
    'shrub',
  ]),
);
const report = [];
for (const asset of assets) {
  assert.equal(
    asset.triangle_budget,
    specifications[asset.asset].triangle_budget,
    'registered geometry budget',
  );
  assert.equal(
    asset.byte_budget,
    specifications[asset.asset].byte_budget,
    'registered download budget',
  );
  const source = await readFile(resolve(root, asset.source));
  assert.equal(hash(source), asset.source_sha256, `${asset.asset}: immutable source`);
  await stat(resolve(root, asset.editable_source));
  if (asset.derived_from) {
    assert.equal(
      hash(await readFile(resolve(root, asset.derived_from.input_blend))),
      asset.derived_from.input_sha256,
      'accepted Studio derivative input preserved',
    );
  }
  if (asset.ground_refinement) {
    const refinement = asset.ground_refinement;
    assert.equal(refinement.version, 2);
    assert.equal(
      hash(await readFile(resolve(root, refinement.input_blend))),
      refinement.input_sha256,
      'accepted editable input preserved',
    );
    assert.ok(refinement.cut_height > 0, 'display underside physically removed');
    assert.equal(refinement.weld_tolerance, 0.00005, 'seam positions welded before reduction');
    assert.ok(refinement.vertices_after_weld <= refinement.vertices_before_weld);
  }
  if (asset.asset !== 'pine')
    assert.ok(prompts[asset.asset]?.length > 100, 'Studio prompt retained');
  const bytes = await readFile(resolve(directory, `${asset.asset}.glb`));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(hash(bytes), asset.runtime_sha256);
  assert.ok(bytes.length <= asset.byte_budget, 'download budget');
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  const binary = bytes.subarray(28 + jsonLength);
  let triangles = 0,
    primitives = 0;
  for (const mesh of gltf.meshes)
    for (const primitive of mesh.primitives) {
      primitives++;
      triangles += gltf.accessors[primitive.indices].count / 3;
      const position = gltf.accessors[primitive.attributes.POSITION];
      if (asset.ground_refinement) {
        assert.ok(position.min[1] >= -0.0001, 'clipped root has no remaining display underside');
        assert.ok(position.max[1] > 0, 'above-ground scenery retained');
      }
      assert.equal(position.componentType, 5126);
      const view = gltf.bufferViews[position.bufferView];
      const offset = (view.byteOffset ?? 0) + (position.byteOffset ?? 0);
      const stride = view.byteStride ?? 12;
      for (let i = 0; i < position.count; i++)
        for (let axis = 0; axis < 3; axis++)
          assert.ok(
            Number.isFinite(binary.readFloatLE(offset + i * stride + axis * 4)),
            'finite vertex',
          );
    }
  assert.equal(triangles, asset.triangles);
  assert.ok(triangles <= asset.triangle_budget, 'geometry budget');
  assert.equal(primitives, 1, 'one draw primitive per reusable model');
  let maxTexture = 0;
  for (const image of gltf.images ?? []) {
    const view = gltf.bufferViews[image.bufferView];
    const metadata = await sharp(
      binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength),
    ).metadata();
    maxTexture = Math.max(maxTexture, metadata.width, metadata.height);
  }
  assert.ok(maxTexture <= asset.texture_max, 'texture budget');
  report.push({
    asset: asset.asset,
    triangles,
    primitives,
    bytes: bytes.length,
    maxTexture,
    sourceBytes: source.length,
  });
}
const result = {
  assets: report,
  runtimeBytes: report.reduce((sum, item) => sum + item.bytes, 0),
  status: 'passed',
};
await writeFile(
  resolve(root, '.local/qa/atlas-tripo-assets.json'),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result, null, 2));
