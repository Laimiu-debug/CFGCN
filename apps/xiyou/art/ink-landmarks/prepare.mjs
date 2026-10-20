import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)),
  source = resolve(here, 'source-v1.png');
const {
  data,
  info: { width, height, channels },
} = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const splitX = Math.floor(width / 2),
  splitY = Math.floor(height / 2),
  lowerX = Math.floor(width * 0.56);
const cells = [
  [0, 0, splitX, splitY],
  [splitX, 0, width, splitY],
  [0, splitY, lowerX, height],
  [lowerX, splitY, width, height],
];
const parts = cells.map(([x0, y0, x1, y1], index) => {
  let l = width,
    t = height,
    r = 0,
    b = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (data[(y * width + x) * channels + 3] < 100) continue;
      l = Math.min(l, x);
      r = Math.max(r, x);
      t = Math.min(t, y);
      b = Math.max(b, y);
    }
  if (l <= x0 || r >= x1 - 1 || t <= y0 || b >= y1 - 1) throw Error('Cutoff landmark ' + index);
  let anchorX = (l + r) / 2;
  if (index === 1) {
    const runs = [];
    let from = null;
    const band = Math.max(6, Math.floor((b - t) * 0.055));
    for (let x = l; x <= r + 1; x++) {
      let occupied = 0;
      for (let y = b - band; y <= b; y++)
        if (x <= r && data[(y * width + x) * channels + 3] > 100) occupied++;
      if (occupied > band * 0.25 && from === null) from = x;
      if (occupied <= band * 0.25 && from !== null) {
        if (x - from > 12) runs.push([from, x]);
        from = null;
      }
    }
    const candidates = runs
      .slice(0, -1)
      .map((v, i) => [v[1], runs[i + 1][0]])
      .filter(([a, b]) => b - a > 20);
    const gap = candidates.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    if (!gap) throw Error('Gate has no genuinely transparent passage');
    anchorX = (gap[0] + gap[1]) / 2;
    console.log(JSON.stringify({ gateBaseRuns: runs, gateGap: gap, anchorX }));
  }
  return {
    id: ['way_pavilion', 'stone_gate', 'five_peaks', 'ford_stele'][index],
    rect: [l - 2, t - 2, r + 3, b + 3],
    anchorX,
  };
});
const output = resolve(here, 'runtime.png');
await sharp(source)
  .resize(768, 768)
  .png({ palette: true, colours: 128, dither: 0, effort: 10 })
  .toFile(output);
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const result = {
  width,
  height,
  parts,
  bytes: readFileSync(output).length,
  source_sha256: sha(source),
  runtime_sha256: sha(output),
};
if (result.bytes > 280000) throw Error('Landmark atlas budget');
writeFileSync(resolve(here, 'packing.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
