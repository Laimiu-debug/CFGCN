// Packaging only: retain original RGBA paintings and their source hashes.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const here = import.meta.dirname;
const specs = [
  ['grass', 1.8],
  ['flowers', 1.4],
  ['fern', 1.4],
];
const parts = [],
  composite = [];
for (const [index, [id, metres]] of specs.entries()) {
  const source = `${id}-source-v1.png`;
  const path = resolve(here, source);
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = info.width,
    y0 = info.height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 48) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  if (x0 < 4 || y0 < 4 || x1 > info.width - 5 || y1 > info.height - 5)
    throw Error('Clipped art: ' + id);
  const crop = { left: x0 - 3, top: y0 - 3, width: x1 - x0 + 7, height: y1 - y0 + 7 };
  const packed = await sharp(path)
    .extract(crop)
    .resize(992, 992, { fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = (index % 2) * 1024 + Math.floor((1024 - packed.info.width) / 2);
  const top = Math.floor(index / 2) * 1024 + 16;
  let total = 0,
    weighted = 0;
  for (let y = y1 - 24; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha < 80) continue;
      total += alpha;
      weighted += alpha * x;
    }
  const anchor = (weighted / total - crop.left) / crop.width;
  composite.push({ input: packed.data, left, top });
  parts.push({
    id,
    metres,
    source,
    source_sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
    rect: [left, top, left + packed.info.width, top + packed.info.height],
    anchorX: left + packed.info.width * anchor,
  });
}
const runtime = resolve(here, 'runtime.png');
await sharp({ create: { width: 2048, height: 2048, channels: 4, background: '#00000000' } })
  .composite(composite)
  .png()
  .toFile(runtime);
writeFileSync(
  resolve(here, 'packing.json'),
  JSON.stringify(
    {
      width: 2048,
      height: 2048,
      parts,
      bytes: readFileSync(runtime).length,
      runtime_sha256: createHash('sha256').update(readFileSync(runtime)).digest('hex'),
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ parts: parts.map((p) => p.id), bytes: readFileSync(runtime).length }));

await sharp(runtime).toFile(
  resolve(here, '../../../../apps/website/public/games/xiyou/assets/ink-flora.png'),
);
const headSource = resolve(here, '../shadow-wukong/parts-source.png');
await sharp(headSource)
  .extract({ left: 47, top: 34, width: 298, height: 301 })
  .resize(192, 192, { fit: 'contain', background: '#00000000' })
  .png()
  .toFile(resolve(here, '../../../../apps/website/public/games/xiyou/assets/ink-map-wukong.png'));
writeFileSync(
  resolve(here, 'map-portrait.json'),
  JSON.stringify(
    {
      source: 'shadow-wukong/parts-source.png',
      rect: [47, 34, 345, 335],
      source_sha256: createHash('sha256').update(readFileSync(headSource)).digest('hex'),
    },
    null,
    2,
  ),
);
