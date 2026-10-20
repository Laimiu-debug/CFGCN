import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const source = new URL('.local/references/atlas/', root);
const output = new URL('apps/website/public/art/atlas/', root);
const g = JSON.parse(await readFile(new URL('apps/website/src/atlas-geometry.json', root), 'utf8'));
const project = ([lon, lat]) => [
  ((lon - g.west) / (g.east - g.west)) * g.width,
  ((g.north - lat) / (g.north - g.south)) * g.height,
];
const point = (p) =>
  project(p)
    .map((n) => +n.toFixed(2))
    .join(',');
function clipRing(ring) {
  let points = ring;
  for (const [axis, limit, above] of [
    [0, g.west, true],
    [0, g.east, false],
    [1, g.south, true],
    [1, g.north, false],
  ]) {
    const input = points;
    points = [];
    if (!input.length) break;
    let a = input.at(-1);
    for (const b of input) {
      const ai = above ? a[axis] >= limit : a[axis] <= limit;
      const bi = above ? b[axis] >= limit : b[axis] <= limit;
      if (ai !== bi) {
        const t = (limit - a[axis]) / (b[axis] - a[axis]);
        points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
      if (bi) points.push(b);
      a = b;
    }
  }
  return points.length > 2 ? `M${points.map(point).join('L')}Z` : '';
}
const intersects = (line) =>
  line.some(([x, y]) => x >= g.west && x <= g.east && y >= g.south && y <= g.north);
const polygonPaths = (features) =>
  features.flatMap((f) => {
    const polygons =
      f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
    return polygons.map((poly) => poly.map(clipRing).join('')).filter(Boolean);
  });
const bytes = await Promise.all(
  ['land.geojson', 'lakes.geojson', 'rivers.geojson'].map((name) =>
    readFile(new URL(name, source)),
  ),
);
const [land, lakes, rivers] = bytes.map((b) => JSON.parse(b));
const riverPaths = rivers.features.flatMap((f) => {
  const lines =
    f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
  return lines.filter(intersects).map((line) => ({
    name: f.properties.name_en || f.properties.name || '',
    major: /Yangtze|Yellow|Huang|Chang Jiang|Wei|Han/i.test(
      `${f.properties.name} ${f.properties.name_en}`,
    ),
    d: `M${line.map(point).join('L')}`,
  }));
});
await mkdir(output, { recursive: true });
await writeFile(
  new URL('apps/website/src/atlas-data.json', root),
  JSON.stringify({
    land: polygonPaths(land.features),
    lakes: polygonPaths(lakes.features.filter((f) => f.geometry.coordinates.flat(5).length)),
    rivers: riverPaths,
  }),
);

// The source world file is 1/30 degree, pixel centers at -179.983333 / 89.983333.
// Extract pixel edges at our bounds; keep the original north-up projection unchanged.
const left = Math.round((g.west + 180) * 30);
const top = Math.round((90 - g.north) * 30);
const width = Math.round((g.east - g.west) * 30);
const height = Math.round((g.north - g.south) * 30);
const { data, info } = await sharp(
  new URL('relief/SR_50M.tif', source).pathname.replace(/^\/(\w:)/, '$1'),
)
  .extract({ left, top, width, height })
  .resize(g.width, g.height)
  .raw()
  .toBuffer({ resolveWithObject: true });
const tokens = await readFile(new URL('packages/ui/src/tokens.css', root), 'utf8');
const color = (key) =>
  tokens
    .match(new RegExp(`--${key}:\\s*(#[0-9a-f]{6});`, 'i'))[1]
    .slice(1)
    .match(/../g)
    .map((n) => parseInt(n, 16));
const shadow = color('jade');
const light = color('paper-raised');
const rgb = Buffer.alloc(info.width * info.height * 3);
for (let i = 0; i < info.width * info.height; i++) {
  const value = data[i * info.channels] / 255;
  const t = Math.max(0, Math.min(1, (value - 0.12) / 0.86));
  for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(shadow[c] * (1 - t) + light[c] * t);
}
await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } })
  .webp({ quality: 88 })
  .toFile(new URL('shanhe-relief-v1.webp', output).pathname.replace(/^\/(\w:)/, '$1'));
const hashes = bytes.map((b, i) => ({
  file: ['land.geojson', 'lakes.geojson', 'rivers.geojson'][i],
  sha256: createHash('sha256').update(b).digest('hex'),
}));
await writeFile(
  new URL('.local/references/atlas/derived.json', root),
  JSON.stringify(
    {
      projection: 'WGS84 / plate carree',
      geometry: g,
      sources: hashes,
      paths: { land: polygonPaths(land.features).length, rivers: riverPaths.length },
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ projection: 'north-up plate carree', bounds: g, rivers: riverPaths.length }),
);
