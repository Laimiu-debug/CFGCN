import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const source = process.argv[2];
if (!source) throw new Error('Pass the image_gen hidden-ground source.');
const art = 'apps/website/art/fine-ink/';
const output = 'apps/website/public/art/atlas/fine-ink/depth-v3/';
await fs.mkdir(output, { recursive: true });
await fs.copyFile(source, art + 'underpaint-v3.png');
const config = JSON.parse(await fs.readFile(art + 'depth-layout-v3.json', 'utf8'));
const w = 1586,
  h = 992,
  u = 2400 / w;
const original = await sharp(art + 'plate-v2-clean.png')
  .resize(w, h)
  .removeAlpha()
  .raw()
  .toBuffer();
const underpaint = await sharp(art + 'underpaint-v3.png')
  .resize(w, h)
  .removeAlpha()
  .raw()
  .toBuffer();
const old = JSON.parse(
  await fs.readFile('apps/website/public/art/atlas/fine-ink/layout-v2.json', 'utf8'),
);
const bridgePaths = [
  'M1 21 L32 10 L57 11 L87 6 L122 2 L128 8 L126 21 L92 23 L62 29 L32 31 L2 40 Z',
  'M1 24 L16 14 L42 2 L62 0 L85 9 L111 19 L132 21 L132 35 L106 34 L80 25 L58 14 L43 16 L18 32 L1 42 Z',
  'M1 35 L14 18 L31 8 L43 8 L61 20 L78 32 L90 35 L90 48 L72 45 L56 33 L42 20 L31 22 L17 35 L7 50 L1 49 Z',
];
old.occluders.forEach((b, i) =>
  config.layers.push({
    id: 'bridge-' + i,
    kind: 'bridge',
    bounds: [b.x / u, b.y / u, b.width / u, b.height / u].map(Math.round),
    amplitude: 55,
    priority: 11,
    localPath: bridgePaths[i],
  }),
);

const claimed = new Uint8Array(w * h),
  removal = new Uint8Array(w * h);
const prepared = [];
// Assign each opaque painted pixel to one foreground object, rather than keeping
// a frozen duplicate of the same mountain / wall on a second depth plane.
for (const layer of [...config.layers].sort((a, b) => b.priority - a.priority)) {
  const [x, y, cw, ch] = layer.bounds;
  const shape = layer.localPath
    ? `<g transform="translate(${x},${y})"><path d="${layer.localPath}"/></g>`
    : `<path d="${layer.path}" stroke="white" stroke-width="${layer.stroke ?? 0}" stroke-linejoin="round"/>`;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g fill="white" fill-rule="evenodd">${shape}</g></svg>`,
  );
  const mask = await sharp(svg)
    .ensureAlpha()
    .blur(layer.feather ?? (layer.kind === 'bank' ? 2 : 0.5))
    .raw()
    .toBuffer();
  const pixels = Buffer.alloc(cw * ch * 4);
  let occupied = 0;
  for (let yy = 0; yy < ch; yy++)
    for (let xx = 0; xx < cw; xx++) {
      const index = (y + yy) * w + x + xx;
      let alpha = mask[index * 4 + 3];
      removal[index] = Math.max(removal[index], alpha);
      if (layer.key === 'cool-ink') {
        const r = original[index * 3],
          g = original[index * 3 + 1],
          b = original[index * 3 + 2];
        const cool =
          Math.min(1, Math.max(0, (g - r + 12) / 19)) * Math.min(1, Math.max(0, (b - r + 8) / 20));
        const dark = Math.max(0, Math.min(1, (139 - Math.max(r, g, b)) / 42));
        alpha *= Math.max(cool, dark);
      }
      alpha = Math.round(alpha * (1 - claimed[index] / 255));
      if (alpha > 0) {
        occupied++;
        claimed[index] = Math.min(255, claimed[index] + alpha);
      }
      const k = (yy * cw + xx) * 4;
      pixels[k] = original[index * 3];
      pixels[k + 1] = original[index * 3 + 1];
      pixels[k + 2] = original[index * 3 + 2];
      pixels[k + 3] = alpha;
    }
  const filename = layer.id + '.webp';
  await sharp(pixels, { raw: { width: cw, height: ch, channels: 4 } })
    .webp({ quality: 95, alphaQuality: 100 })
    .toFile(output + filename);
  prepared.push({
    id: layer.id,
    kind: layer.kind,
    town: layer.town,
    amplitude: layer.amplitude,
    bounds: layer.bounds.map((v) => v * u),
    image: '/art/atlas/fine-ink/depth-v3/' + filename,
    occupiedPixels: occupied,
  });
}
const expanded = await sharp(Buffer.from(removal), { raw: { width: w, height: h, channels: 1 } })
  .greyscale()
  .raw()
  .toBuffer();
if (expanded.length !== w * h) throw new Error('Ground removal mask must have one channel.');
const ground = Buffer.from(original);
for (let i = 0; i < w * h; i++)
  for (let c = 0; c < 3; c++)
    ground[i * 3 + c] = Math.round(
      original[i * 3 + c] * (1 - expanded[i] / 255) + (underpaint[i * 3 + c] * expanded[i]) / 255,
    );
await sharp(ground, { raw: { width: w, height: h, channels: 3 } })
  .webp({ quality: 94 })
  .toFile(output + 'ground.webp');
const layout = {
  version: 'fine-ink-depth-scene-v3',
  width: 2400,
  height: 1501,
  ground: '/art/atlas/fine-ink/depth-v3/ground.webp',
  layers: prepared.reverse(),
  referenceDistance: 2600,
  places: old.places,
  life: { water: old.water, waterMask: old.waterMask, shoreFront: old.shoreFront, occluders: [] },
  probes: [
    { id: 'far', layer: 'far-horizon', x: 500 * u, y: 53 * u },
    { id: 'city', layer: 'changan-city', x: 621 * u, y: 346 * u },
    { id: 'ridge', layer: 'qinling-main-spine', x: 666 * u, y: 520 * u },
    { id: 'bank', layer: 'jinling-near-shore', x: 1080 * u, y: 875 * u },
  ],
};
await fs.writeFile(output + 'layout.json', JSON.stringify(layout, null, 2) + '\n');
const hash = async (f) =>
  crypto
    .createHash('sha256')
    .update(await fs.readFile(f))
    .digest('hex');
const assets = [];
for (const name of await fs.readdir(output))
  if (name.endsWith('.webp'))
    assets.push({
      name,
      bytes: (await fs.stat(output + name)).size,
      sha256: await hash(output + name),
    });
const manifest = {
  version: layout.version,
  date: '2026-10-20',
  accepted_paint: 'plate-v1.png',
  cutout_source: 'plate-v2-clean.png',
  cutout_source_sha256: await hash(art + 'plate-v2-clean.png'),
  hidden_ground: 'underpaint-v3.png',
  hidden_ground_sha256: await hash(art + 'underpaint-v3.png'),
  hidden_ground_source: source,
  prompts: ['prompt-v3-underpaint.txt', 'prompt-v3-bridges.txt'],
  preparation: 'node scripts/prepare-depth-ink.mjs <hidden-ground-source.png>',
  config: 'depth-layout-v3.json',
  runtime_art_bytes: assets.reduce((a, b) => a + b.bytes, 0),
  assets,
  geometry_sources: await Promise.all(
    ['apps/website/src/ink-depth.ts', 'apps/website/src/FineInkDepth.tsx'].map(async (file) => ({
      file,
      sha256: await hash(file),
    })),
  ),
  scope:
    'Separate alpha cutouts and relief meshes reconstructed from the accepted painting, plus inpainted hidden ground; controlled perspective camera. Not a free-orbit complete 3D reconstruction or Blender model.',
};
await fs.writeFile(art + 'manifest-v3.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    layers: prepared.length,
    bytes: manifest.runtime_art_bytes,
    ground_sha256: assets.find((a) => a.name === 'ground.webp').sha256,
  }),
);
