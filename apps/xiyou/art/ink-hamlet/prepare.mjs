// Crop transparent margins and pack original imagegen art; no semantic repaint.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const parts = [];
const composite = [];
for (const [name, width, height, top] of [
  ['house', 736, 400, 12],
  ['willow', 570, 570, 440],
]) {
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
    throw Error('Clipped drawing ' + name);
  const crop = { left: x0 - 3, top: y0 - 3, width: x1 - x0 + 7, height: y1 - y0 + 7 };
  const { data: input, info: packed } = await sharp(path)
    .extract(crop)
    .resize(width, height, { fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.floor((768 - packed.width) / 2);
  composite.push({ input, left, top });
  // The willow's actual root, rather than its asymmetric crown, is the anchor.
  let anchor = 0.5;
  if (name === 'willow') {
    let total = 0,
      weighted = 0;
    for (let y = y1 - 20; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const a = data[(y * info.width + x) * 4 + 3];
        if (a < 80) continue;
        total += a;
        weighted += x * a;
      }
    anchor = (weighted / total - crop.left) / crop.width;
  }
  parts.push({
    id: name,
    rect: [left, top, left + packed.width, top + packed.height],
    anchorX: left + packed.width * anchor,
    metres: name === 'house' ? 8.8 : 6.0,
    source: name + '-source-v1.png',
    source_sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  });
}
const runtime = resolve(here, 'runtime.png');
await sharp({ create: { width: 768, height: 1024, channels: 4, background: '#00000000' } })
  .composite(composite)
  .png({ palette: true, colours: 128, dither: 0, effort: 10 })
  .toFile(runtime);
const bytes = readFileSync(runtime);
if (bytes.length > 260000) throw Error('Hamlet image budget exceeded');
writeFileSync(
  resolve(here, 'packing.json'),
  JSON.stringify(
    {
      width: 768,
      height: 1024,
      parts,
      bytes: bytes.length,
      runtime_sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ bytes: bytes.length, parts }));
