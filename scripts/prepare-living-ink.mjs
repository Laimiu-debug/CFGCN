import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = process.cwd();
const source = process.argv[2];
if (!source) throw new Error('Pass the accepted image_gen clean-plate path.');
const art = path.join(root, 'apps/website/art/fine-ink');
const runtime = path.join(root, 'apps/website/public/art/atlas/fine-ink');
const original = path.join(art, 'plate-v2-clean.png');
// Versioned preparation only: never overwrite the accepted v1 source.
await fs.mkdir(art, { recursive: true });
await fs.copyFile(source, original);
const metadata = await sharp(original).metadata();
const normalized = await sharp(original).resize(1586, 992).png().toBuffer();
const plate = path.join(runtime, 'plate-v2-clean.webp');
await sharp(normalized).webp({ quality: 93 }).toFile(plate);
const u = 2400 / 1586;
const bridges = [
  {
    id: 'han-bridge-front',
    x: 474,
    y: 734,
    width: 129,
    height: 41,
    outline: 'M1 21 L32 10 L57 11 L87 6 L122 2 L128 8 L126 21 L92 23 L62 29 L32 31 L2 40 Z',
  },
  {
    id: 'garden-bridge-front',
    x: 1149,
    y: 634,
    width: 133,
    height: 43,
    outline:
      'M1 24 L16 14 L42 2 L62 0 L85 9 L111 19 L132 21 L132 35 L106 34 L80 25 L58 14 L43 16 L18 32 L1 42 Z',
  },
  {
    id: 'jinling-bridge-front',
    x: 1249,
    y: 790,
    width: 91,
    height: 51,
    outline:
      'M1 35 L14 18 L31 8 L43 8 L61 20 L78 32 L90 35 L90 48 L72 45 L56 33 L42 20 L31 22 L17 35 L7 50 L1 49 Z',
  },
];
const occluders = [];
for (const b of bridges) {
  const mask = Buffer.from(
    `<svg width="${b.width}" height="${b.height}" xmlns="http://www.w3.org/2000/svg"><path d="${b.outline}" fill="white"/></svg>`,
  );
  const cropped = await sharp(normalized)
    .extract({ left: b.x, top: b.y, width: b.width, height: b.height })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .webp({ lossless: true })
    .toBuffer();
  const filename = `${b.id}-v2.webp`;
  await fs.writeFile(path.join(runtime, filename), cropped);
  occluders.push({
    image: `/art/atlas/fine-ink/${filename}`,
    x: b.x * u,
    y: b.y * u,
    width: b.width * u,
    height: b.height * u,
  });
}
const previous = JSON.parse(await fs.readFile(path.join(runtime, 'layout.json'), 'utf8'));
const polygon = (points) =>
  points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${(x * u).toFixed(1)},${(y * u).toFixed(1)}`)
    .join('') + 'Z';
const patches = [
  [
    [648, 155],
    [747, 164],
    [845, 185],
    [1003, 207],
    [1147, 226],
    [1278, 235],
    [1426, 237],
    [1431, 262],
    [1304, 265],
    [1131, 252],
    [999, 235],
    [855, 213],
    [744, 190],
    [650, 178],
  ],
  [
    [1102, 340],
    [1179, 356],
    [1273, 369],
    [1380, 364],
    [1479, 355],
    [1486, 385],
    [1371, 397],
    [1275, 402],
    [1174, 387],
    [1100, 365],
  ],
  [
    [1385, 401],
    [1473, 401],
    [1586, 417],
    [1586, 448],
    [1483, 434],
    [1390, 426],
  ],
  [
    [506, 708],
    [533, 718],
    [519, 744],
    [542, 759],
    [592, 776],
    [664, 783],
    [737, 776],
    [827, 755],
    [839, 779],
    [743, 806],
    [666, 815],
    [586, 806],
    [517, 786],
    [482, 753],
    [488, 727],
  ],
  [
    [1006, 789],
    [1117, 825],
    [1200, 842],
    [1299, 867],
    [1411, 884],
    [1524, 892],
    [1586, 888],
    [1586, 923],
    [1510, 926],
    [1402, 916],
    [1284, 898],
    [1187, 878],
    [1102, 856],
    [1003, 822],
  ],
  [
    [1157, 619],
    [1221, 613],
    [1284, 597],
    [1349, 572],
    [1398, 550],
    [1415, 569],
    [1365, 596],
    [1300, 621],
    [1238, 638],
    [1176, 648],
  ],
];
const layout = {
  ...previous,
  version: 'fine-ink-living-world-v2',
  image: '/art/atlas/fine-ink/plate-v2-clean.webp',
  occluders,
  water: patches.map(polygon),
};
await fs.writeFile(path.join(runtime, 'layout-v2.json'), JSON.stringify(layout, null, 2) + '\n');
const hash = async (filename) =>
  crypto
    .createHash('sha256')
    .update(await fs.readFile(filename))
    .digest('hex');
const manifest = {
  version: layout.version,
  date: '2026-10-20',
  tool: 'Built-in image_gen precise-object-edit + deterministic Sharp compression / cutouts',
  source,
  accepted_reference: 'plate-v1.png',
  source_dimensions: [metadata.width, metadata.height],
  runtime_dimensions: [1586, 992],
  source_sha256: await hash(original),
  runtime_sha256: await hash(plate),
  runtime_bytes: (await fs.stat(plate)).size,
  clean_plate: 'plate-v2-clean.png',
  occluders,
  independent_layers: [
    'water surface / ripple',
    'route-based vessels / wakes / oars',
    'extracted bridge fronts',
    'joint-animated residents / pilgrims',
    'flags / smoke / birds',
    'drifting mist / pointer depth',
  ],
  editable_runtime_source: [
    'apps/website/src/fine-ink-life.ts',
    'apps/website/src/FineInkLife.tsx',
    'scripts/prepare-living-ink.mjs',
  ],
  scope:
    '2.5D painted homepage world. Static terrain remains painted; moving vessels and residents are independent runtime entities. Not a full 3D world or per-building interior simulation.',
};
await fs.writeFile(path.join(art, 'manifest-v2.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    version: layout.version,
    width: metadata.width,
    height: metadata.height,
    bytes: manifest.runtime_bytes,
    cutouts: occluders.length,
  }),
);
