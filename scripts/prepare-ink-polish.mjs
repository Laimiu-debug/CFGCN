import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const art = 'apps/website/art/fine-ink/';
const runtime = 'apps/website/public/art/atlas/fine-ink/';
const base = JSON.parse(await fs.readFile(runtime + 'depth-v3/layout.json', 'utf8'));
const previous = JSON.parse(await fs.readFile(art + 'manifest-v3.json', 'utf8'));
const layout = { ...base, version: 'fine-ink-elevated-world-v4' };
await fs.writeFile(runtime + 'layout-v4.json', JSON.stringify(layout, null, 2) + '\n');
const sha = async (file) =>
  crypto
    .createHash('sha256')
    .update(await fs.readFile(file))
    .digest('hex');
const images = [];
for (const asset of previous.assets) {
  const file = runtime + 'depth-v3/' + asset.name;
  if ((await sha(file)) !== asset.sha256) throw new Error('Accepted v3 art changed: ' + asset.name);
  images.push({ file, bytes: asset.bytes, sha256: asset.sha256 });
}
const files = [
  'FineInkStudy.tsx',
  'FineInkDepth.tsx',
  'FineInkLife.tsx',
  'fine-ink-life.ts',
  'ink-atmosphere.ts',
  'ink-depth.ts',
  'ink-ridge-layout.json',
  'ink-shore.ts',
  'fine-ink-study.css',
  'useAtlasRest.ts',
  'atlas-rest.ts',
];
const sources = [];
for (const name of files) {
  const file = 'apps/website/src/' + name;
  sources.push({ file, sha256: await sha(file) });
}
const manifest = {
  version: layout.version,
  date: '2026-10-20',
  accepted_base: 'v3 layered ink scene; user feedback: 很不错，继续打磨',
  base_manifest: { file: art + 'manifest-v3.json', sha256: await sha(art + 'manifest-v3.json') },
  static_paint_unchanged: true,
  images,
  water_mask: {
    file: 'apps/website/public' + base.life.waterMask,
    bytes: (await fs.stat('apps/website/public' + base.life.waterMask)).size,
    sha256: await sha('apps/website/public' + base.life.waterMask),
  },
  runtime_image_bytes:
    images.reduce((a, x) => a + x.bytes, 0) +
    (await fs.stat('apps/website/public' + base.life.waterMask)).size,
  sources,
  preparation: 'node scripts/prepare-ink-polish.mjs',
  additions: [
    'World-up elevation reconstructed at an illustrative 78 degree reference angle; continuous ridge and branch network, shoulders, passes and town basins.',
    'Shared 12-unit terrain triangulation across rock masks and ground; level river with a cached shore distance field for continuous bank transitions.',
    'Subtle vertex-normal ink shading with MeshBasicMaterial / NoToneMapping, bounded side and vertical views.',
    'Six cached, code-painted valley-mist textures on independently placed depth meshes.',
    'Water-masked fragmented boat reflections and heading-aligned wakes.',
    'Time-based camera easing and speed ramps at journey endpoints.',
    'Existing atlas resting controller reused for quiet wallpaper, wake and keyboard behavior.',
  ],
  scope:
    'Local terrain elevation reconstruction and atmosphere / interaction polish of the accepted v3 painting. Authored ridge geometry is code-created, not Tripo or Blender assets. No new image_gen, plugin purchases, full building reconstruction, game edits or production deployment.',
};
await fs.writeFile(art + 'manifest-v4.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    version: manifest.version,
    staticPaintUnchanged: true,
    imageBytes: manifest.runtime_image_bytes,
    sources: sources.length,
  }),
);
