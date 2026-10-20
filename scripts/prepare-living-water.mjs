import fs from 'node:fs/promises';
import sharp from 'sharp';
import crypto from 'node:crypto';

const art = 'apps/website/art/fine-ink/';
const runtime = 'apps/website/public/art/atlas/fine-ink/';
const { data } = await sharp(art + 'plate-v2-clean.png')
  .resize(1586, 992)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const w = 1586,
  h = 992;
const regions = [
  [
    [460, 128],
    [1586, 95],
    [1586, 467],
    [1380, 455],
    [1280, 430],
    [1090, 385],
    [860, 270],
    [690, 220],
    [460, 180],
  ],
  [
    [1586, 450],
    [1586, 952],
    [1400, 943],
    [1180, 904],
    [985, 843],
    [929, 780],
    [954, 725],
    [1080, 670],
    [1180, 600],
    [1300, 552],
    [1400, 505],
  ],
  [
    [500, 690],
    [584, 709],
    [585, 752],
    [690, 772],
    [826, 740],
    [980, 711],
    [1020, 756],
    [904, 800],
    [740, 836],
    [574, 826],
    [473, 780],
    [477, 726],
  ],
];
const inside = (x, y, poly) => {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i],
      [bx, by] = poly[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) yes = !yes;
  }
  return yes;
};
const wet = new Uint8Array(w * h);
for (let y = 90; y < h; y++)
  for (let x = 450; x < w; x++) {
    const i = y * w + x,
      k = i * 3,
      r = data[k],
      g = data[k + 1],
      b = data[k + 2];
    if (
      g > r + 4 &&
      b > r + 9 &&
      b >= g - 4 &&
      g > 80 &&
      regions.some((poly) => inside(x, y, poly))
    )
      wet[i] = 1;
  }
// Small roof / clothing flecks do not become water. Keep connected channel surfaces.
const visited = new Uint8Array(w * h),
  queue = new Int32Array(w * h);
let components = 0;
for (let start = 0; start < wet.length; start++) {
  if (!wet[start] || visited[start]) continue;
  let tail = 1;
  queue[0] = start;
  visited[start] = 1;
  for (let head = 0; head < tail; head++) {
    const i = queue[head],
      x = i % w;
    for (const n of [i - 1, i + 1, i - w, i + w])
      if (n >= 0 && n < wet.length && Math.abs((n % w) - x) < 2 && wet[n] && !visited[n]) {
        visited[n] = 1;
        queue[tail++] = n;
      }
  }
  if (tail < 160) for (let j = 0; j < tail; j++) wet[queue[j]] = 0;
  else components++;
}
const rgba = Buffer.alloc(w * h * 4, 255);
for (let i = 0; i < wet.length; i++) rgba[i * 4 + 3] = wet[i] ? 255 : 0;
await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
  .blur(0.65)
  .webp({ lossless: true })
  .toFile(runtime + 'water-mask-v2.webp');
// Near banks cover hulls passing behind reeds. Extracted colors stay exactly the same.
const shore = Buffer.alloc(w * h * 4);
for (let y = 20; y < h; y++)
  for (let x = 450; x < w; x++) {
    const i = y * w + x;
    if (wet[i]) continue;
    let above = false;
    for (let k = 2; k <= 18; k += 2)
      if (wet[(y - k) * w + x]) {
        above = true;
        break;
      }
    if (!above) continue;
    shore[i * 4] = data[i * 3];
    shore[i * 4 + 1] = data[i * 3 + 1];
    shore[i * 4 + 2] = data[i * 3 + 2];
    shore[i * 4 + 3] = 255;
  }
await sharp(shore, { raw: { width: w, height: h, channels: 4 } })
  .webp({ lossless: true })
  .toFile(runtime + 'shore-front-v2.webp');

// A small navigation grid uses the same water classification. Bridges are portals,
// not dry-land shortcuts; the extracted bridge fronts occlude the hulls at runtime.
const cell = 4,
  cols = Math.ceil(w / cell),
  rows = Math.ceil(h / cell),
  grid = new Uint8Array(cols * rows);
for (let gy = 0; gy < rows; gy++)
  for (let gx = 0; gx < cols; gx++) {
    let n = 0;
    for (const [dx, dy] of [
      [2, 2],
      [0, 2],
      [3, 2],
      [2, 0],
      [2, 3],
    ])
      n += wet[Math.min(h - 1, gy * cell + dy) * w + Math.min(w - 1, gx * cell + dx)];
    grid[gy * cols + gx] = n >= 2 ? 1 : 0;
  }
const portals = [
  [
    [524, 738],
    [537, 770],
  ],
  [
    [1194, 634],
    [1198, 679],
  ],
  [
    [1275, 791],
    [1290, 844],
  ],
];
for (const [a, b] of portals)
  for (let j = 0; j <= 40; j++) {
    const px = a[0] + ((b[0] - a[0]) * j) / 40,
      py = a[1] + ((b[1] - a[1]) * j) / 40;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const gx = Math.floor(px / cell) + dx,
          gy = Math.floor(py / cell) + dy;
        if (gx >= 0 && gy >= 0 && gx < cols && gy < rows) grid[gy * cols + gx] = 1;
      }
  }
const seeds = JSON.parse(await fs.readFile(art + 'water-routes-source.json', 'utf8'));
const componentAt = new Int32Array(grid.length).fill(-1),
  areas = [];
for (let start = 0; start < grid.length; start++) {
  if (!grid[start] || componentAt[start] >= 0) continue;
  const group = areas.length,
    q = [start];
  componentAt[start] = group;
  for (let head = 0; head < q.length; head++)
    for (const n of neighbors(q[head]))
      if (componentAt[n] < 0) {
        componentAt[n] = group;
        q.push(n);
      }
  areas.push(q.length);
}
function snap([x, y], component = null, minArea = 400) {
  let best = -1,
    distance = Infinity;
  for (
    let yy = Math.max(0, Math.floor(y / cell) - 20);
    yy < Math.min(rows, Math.floor(y / cell) + 21);
    yy++
  )
    for (
      let xx = Math.max(0, Math.floor(x / cell) - 20);
      xx < Math.min(cols, Math.floor(x / cell) + 21);
      xx++
    ) {
      const index = yy * cols + xx;
      if (
        !grid[index] ||
        areas[componentAt[index]] < (component === null ? minArea : 80) ||
        (component !== null && componentAt[index] !== component)
      )
        continue;
      const d = (xx * cell + 2 - x) ** 2 + (yy * cell + 2 - y) ** 2;
      if (d < distance) {
        distance = d;
        best = yy * cols + xx;
      }
    }
  if (best < 0) throw new Error('No water near route seed ' + [x, y]);
  return best;
}
function neighbors(i) {
  const x = i % cols,
    y = Math.floor(i / cols),
    result = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    const xx = x + dx,
      yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
    const n = yy * cols + xx;
    if (grid[n] && (!dx || !dy || (grid[y * cols + xx] && grid[yy * cols + x]))) result.push(n);
  }
  return result;
}
function findPath(start, end) {
  const prior = new Int32Array(grid.length).fill(-1),
    q = new Int32Array(grid.length);
  let tail = 1;
  q[0] = start;
  prior[start] = start;
  for (let head = 0; head < tail && prior[end] < 0; head++)
    for (const n of neighbors(q[head]))
      if (prior[n] < 0) {
        prior[n] = q[head];
        q[tail++] = n;
      }
  if (prior[end] < 0) throw new Error('Disconnected water route ' + start + ' to ' + end);
  const result = [end];
  while (result.at(-1) !== start) result.push(prior[result.at(-1)]);
  return result.reverse();
}
const routes = {};
for (const [id, points] of Object.entries(seeds)) {
  const start = snap(
      points[0],
      null,
      id === 'han-valley-ferry' || id === 'garden-ferry' ? 80 : 400,
    ),
    component = componentAt[start];
  console.log(id, 'water cells', areas[component]);
  const nodes = points.map((p) => snap(p, component)),
    result = [];
  for (let i = 1; i < nodes.length; i++)
    result.push(...findPath(nodes[i - 1], nodes[i]).slice(i === 1 ? 0 : 1));
  // Merge only collinear grid steps; no straight shortcut may cut across an island.
  const simple = result.filter(
    (n, i) =>
      i === 0 || i === result.length - 1 || result[i] - result[i - 1] !== result[i + 1] - result[i],
  );
  routes[id] = simple.map((n) => [(n % cols) * cell + 2, Math.floor(n / cols) * cell + 2]);
}
await fs.writeFile(
  'apps/website/src/fine-ink-water-routes.json',
  JSON.stringify(routes, null, 2) + '\n',
);
await fs.writeFile(
  '.local/living-ink/water-navigation.json',
  JSON.stringify(
    { cell, cols, rows, components, routes, portals, wet_pixels: wet.reduce((a, b) => a + b, 0) },
    null,
    2,
  ),
);
const layout = JSON.parse(await fs.readFile(runtime + 'layout-v2.json', 'utf8'));
layout.waterMask = '/art/atlas/fine-ink/water-mask-v2.webp';
layout.shoreFront = '/art/atlas/fine-ink/shore-front-v2.webp';
await fs.writeFile(runtime + 'layout-v2.json', JSON.stringify(layout, null, 2) + '\n');
const manifest = JSON.parse(await fs.readFile(art + 'manifest-v2.json', 'utf8'));
const assetInfo = async (filename) => {
  const bytes = await fs.readFile(filename);
  return { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
};
manifest.water_surface = {
  method:
    'Color extraction within authored channel regions; small isolated flecks excluded; feathered alpha edge.',
  mask: await assetInfo(runtime + 'water-mask-v2.webp'),
  near_bank_cutout: await assetInfo(runtime + 'shore-front-v2.webp'),
};
manifest.water_navigation = {
  source: 'water-routes-source.json',
  prepared: 'apps/website/src/fine-ink-water-routes.json',
  grid_source_pixels: cell,
  components,
  bridge_portals: portals,
  route_count: Object.keys(routes).length,
  scope: 'Prepared paint-space routes; not historical hydrology or full river physics.',
};
manifest.preparation = [
  'node scripts/prepare-living-ink.mjs <clean-source.png>',
  'node scripts/prepare-living-water.mjs',
];
manifest.runtime_v2_art_bytes =
  manifest.runtime_bytes +
  manifest.water_surface.mask.bytes +
  manifest.water_surface.near_bank_cutout.bytes;
for (const o of manifest.occluders)
  manifest.runtime_v2_art_bytes += (await fs.stat('apps/website/public' + o.image)).size;
await fs.writeFile(art + 'manifest-v2.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    components,
    routes: Object.fromEntries(Object.entries(routes).map(([id, p]) => [id, p.length])),
  }),
);
