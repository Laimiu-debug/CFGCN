import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root = new URL('../', import.meta.url);
const g = JSON.parse(await readFile(new URL('apps/website/src/atlas-geometry.json', root), 'utf8'));
const dir = new URL('.local/references/atlas/terrain/', root);
await mkdir(dir, { recursive: true });
const tileX = (lon) => ((lon + 180) / 360) * 32;
const tileY = (lat) => (1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) * 16;
const tiles = new Map();
const jobs = [];
for (let x = Math.floor(tileX(g.west)); x <= Math.floor(tileX(g.east)); x++) {
  for (let y = Math.floor(tileY(g.north)); y <= Math.floor(tileY(g.south)); y++) jobs.push([x, y]);
}
await Promise.all(
  jobs.map(async ([x, y]) => {
    const file = new URL(`5-${x}-${y}.png`, dir);
    let bytes;
    try {
      bytes = await readFile(file);
    } catch {
      const response = await fetch(
        `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/5/${x}/${y}.png`,
      );
      if (!response.ok) throw new Error(`Terrain tile ${x}/${y}: ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(file, bytes);
    }
    const { data, info } = await sharp(bytes)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== 256 || info.height !== 256 || info.channels !== 3)
      throw new Error('Unexpected terrain tile format');
    tiles.set(`${x}/${y}`, { data, hash: createHash('sha256').update(bytes).digest('hex') });
  }),
);
const columns = 193,
  rows = 113;
const result = Buffer.alloc(columns * rows * 2);
for (let row = 0; row < rows; row++)
  for (let col = 0; col < columns; col++) {
    const lon = g.west + (col / (columns - 1)) * (g.east - g.west);
    const lat = g.north - (row / (rows - 1)) * (g.north - g.south);
    const tx = tileX(lon),
      ty = tileY(lat);
    const px = Math.min(255, Math.floor((tx % 1) * 256)),
      py = Math.min(255, Math.floor((ty % 1) * 256));
    const data = tiles.get(`${Math.floor(tx)}/${Math.floor(ty)}`).data;
    const i = (py * 256 + px) * 3;
    const height = Math.round(data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768);
    result.writeInt16LE(height, (row * columns + col) * 2);
  }
await writeFile(new URL('apps/website/public/art/atlas/terrain-v1.bin', root), result);
await writeFile(
  new URL('.local/references/atlas/terrain-manifest.json', root),
  JSON.stringify(
    {
      accessed: '2026-10-19',
      provider: 'Mapzen / AWS Terrain Tiles',
      projection: 'terrarium web mercator sampled onto north-up geographic grid',
      columns,
      rows,
      bounds: g,
      tiles: [...tiles].map(([tile, value]) => ({ tile, sha256: value.hash })),
      bytes: result.length,
      sha256: createHash('sha256').update(result).digest('hex'),
    },
    null,
    2,
  ),
);
console.log(
  `Terrain ready: ${columns} × ${rows}, ${tiles.size} verified tiles, ${result.length} bytes`,
);
