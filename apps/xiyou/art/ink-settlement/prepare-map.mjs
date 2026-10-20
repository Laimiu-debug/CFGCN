// Map illustrations are reductions of the actual accepted scenery art.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../../..');
const here = resolve(root, 'apps/xiyou/art');
const world = JSON.parse(readFileSync(resolve(here, 'ink-world/packing.json')));
const marks = JSON.parse(readFileSync(resolve(here, 'ink-landmarks/packing.json')));
const inputs = [
  ...[1, 0, 2].map((i) => ({ path: 'ink-world/scenery-source-v2.png', rect: world.parts[i].rect })),
  { path: 'ink-hamlet/willow-source-v1.png' },
  { path: 'ink-settlement/elm-source-v1.png' },
  { path: 'ink-settlement/bamboo-source-v1.png' },
  { path: 'ink-hamlet/house-source-v1.png' },
  ...['cottage', 'mountain_house', 'riverside_house'].map((n) => ({
    path: `ink-settlement/${n}-source-v1.png`,
  })),
  ...marks.parts.map((p) => ({ path: 'ink-landmarks/source-v1.png', rect: p.rect })),
  ...['temple_gate', 'temple_hall', 'bell_pavilion', 'sealed_cave', 'court_wall'].map((n) => ({
    path: `ink-heifeng/${n}-source-${n === 'court_wall' ? 'v2' : 'v1'}.png`,
  })),
  ...['willow', 'reeds', 'slate'].map((n) => ({ path: `ink-river/${n}-source-v1.png` })),
  ...['estate_gate', 'bamboo_fence', 'apricot'].map((n) => ({
    path: `ink-gaolao/${n}-source-v1.png`,
  })),
];
const composite = [];
for (const [i, input] of inputs.entries()) {
  let source = sharp(resolve(here, input.path));
  if (input.rect) {
    const [x, y, r, b] = input.rect;
    source = source.extract({ left: x, top: y, width: r - x, height: b - y });
  }
  const cropped = await source.png().toBuffer();
  const image = await sharp(cropped)
    .trim({ threshold: 8 })
    .resize(120, 120, { fit: 'contain', background: '#00000000' })
    .png()
    .toBuffer();
  composite.push({ input: image, left: (i % 4) * 128 + 4, top: Math.floor(i / 4) * 128 + 4 });
}
const path = resolve(root, 'apps/website/public/games/xiyou/assets/ink-map-symbols.png');
const height = Math.ceil(inputs.length / 4) * 128;
await sharp({ create: { width: 512, height, channels: 4, background: '#00000000' } })
  .composite(composite)
  .png()
  .toFile(path);
writeFileSync(
  resolve(here, 'ink-settlement/map-symbols.json'),
  JSON.stringify(
    {
      path: 'ink-map-symbols.png',
      size: [512, height],
      cell: 128,
      sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
      inputs,
    },
    null,
    2,
  ),
);
console.log('Scenery-derived map illustrations saved');
