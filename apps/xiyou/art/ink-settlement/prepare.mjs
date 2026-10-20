// Preserve original art; crop alpha margins, resize and pack without repainting.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const names = ['cottage', 'mountain_house', 'riverside_house', 'elm', 'bamboo'];
const metres = [6.8, 6, 9, 6.5, 4.8];
const parts = [],
  composite = [];
for (const [index, name] of names.entries()) {
  const path = resolve(here, name + '-source-v1.png');
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
    throw Error('Clipped art ' + name);
  const crop = { left: x0 - 3, top: y0 - 3, width: x1 - x0 + 7, height: y1 - y0 + 7 };
  const { data: input, info: packed } = await sharp(path)
    .extract(crop)
    .resize(992, 992, { fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = (index % 2) * 1024 + Math.floor((1024 - packed.width) / 2);
  const top = Math.floor(index / 2) * 1024 + 16;
  let anchor = 0.5;
  if (index >= 3) {
    let total = 0,
      weighted = 0;
    for (let y = y1 - 24; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const a = data[(y * info.width + x) * 4 + 3];
        if (a < 80) continue;
        total += a;
        weighted += x * a;
      }
    anchor = (weighted / total - crop.left) / crop.width;
  }
  composite.push({ input, left, top });
  parts.push({
    id: name,
    rect: [left, top, left + packed.width, top + packed.height],
    anchorX: left + packed.width * anchor,
    metres: metres[index],
    source: name + '-source-v1.png',
    source_sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  });
}
const runtime = resolve(here, 'runtime.png');
await sharp({ create: { width: 2048, height: 3072, channels: 4, background: '#00000000' } })
  .composite(composite)
  .png()
  .toFile(runtime);
writeFileSync(
  resolve(here, 'packing.json'),
  JSON.stringify(
    {
      width: 2048,
      height: 3072,
      parts,
      bytes: readFileSync(runtime).length,
      runtime_sha256: createHash('sha256').update(readFileSync(runtime)).digest('hex'),
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ parts: parts.map((p) => p.id), bytes: readFileSync(runtime).length }));
