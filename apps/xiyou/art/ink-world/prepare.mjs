// Pack original generated paintings for the web; do not repaint source pixels.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, 'scenery-source-v2.png');
const original = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = original.info;
const rectangles = [
  [0, 0, Math.floor(width / 2), Math.floor(height * 0.54)],
  [Math.floor(width / 2), 0, width, Math.floor(height * 0.54)],
  [0, Math.floor(height * 0.54), Math.floor(width / 2), height],
  [Math.floor(width / 2), Math.floor(height * 0.54), width, height],
];
const parts = rectangles.map(([x0, y0, x1, y1], i) => {
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0,
    count = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (original.data[(y * width + x) * channels + 3] < 72) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      count++;
    }
  if (count < 1000 || minX <= x0 || maxX >= x1 - 1 || minY <= y0 || maxY >= y1 - 1)
    throw new Error('Clipped or missing scenery drawing ' + i);
  return {
    name: ['pine', 'boulder', 'young_pine', 'shrub'][i],
    rect: [minX - 3, minY - 3, maxX + 4, maxY + 4],
    solidPixels: count,
  };
});
const runtime = resolve(here, 'scenery-runtime.png');
await sharp(source)
  .resize(1024, 1024)
  .png({ palette: true, colours: 128, dither: 0, effort: 10 })
  .toFile(runtime);
const terrain = resolve(here, 'terrain-runtime.jpg');
await sharp(resolve(here, 'terrain-source.png'))
  .resize(768, 768)
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(terrain);
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const metadata = {
  version: 1,
  width,
  height,
  parts,
  art: 'Tripo Studio silhouettes projected in Blender; original imagegen ink redraw, hand-reviewed atlas layout',
  source_sha256: sha(source),
  runtime_sha256: sha(runtime),
  terrain_source_sha256: sha(resolve(here, 'terrain-source.png')),
  terrain_runtime_sha256: sha(terrain),
  atlasBytes: readFileSync(runtime).length,
  terrainBytes: readFileSync(terrain).length,
  runtimeSize: [1024, 1024],
  terrainRuntimeSize: [768, 768],
};
if (metadata.atlasBytes > 650000 || metadata.terrainBytes > 180000)
  throw new Error('Ink texture budget exceeded');
writeFileSync(resolve(here, 'packing.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata));
