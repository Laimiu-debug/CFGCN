// Author navigation against the accepted painting, with a full hull footprint.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { format } from 'prettier';

const art = 'apps/website/art/fine-ink/';
const output = 'apps/website/src/fine-ink-home/';
const maskPath = 'apps/website/public/art/atlas/fine-ink/water-mask-v2.webp';
const width = 1586,
  height = 992,
  cell = 2;
const cols = Math.ceil(width / cell),
  rows = Math.ceil(height / cell);
const { data } = await sharp(maskPath)
  .extractChannel('alpha')
  .median(3)
  .threshold(150)
  .raw()
  .toBuffer({ resolveWithObject: true });
// Explicit bridge openings are water below a painted deck, never a shortcut over land.
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
function portalAt(x, y) {
  return portals.some(([a, b]) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < 15;
  });
}
function wet(x, y) {
  x = Math.round(x);
  y = Math.round(y);
  return (
    x >= 0 && y >= 0 && x < width && y < height && (data[y * width + x] > 150 || portalAt(x, y))
  );
}
const footprint = [
  [0, 0],
  [-9, 0],
  [9, 0],
  [-6, -2],
  [6, -2],
  [-6, 2],
  [6, 2],
  [0, -3],
  [0, 3],
];
const safe = (x, y) =>
  footprint.every(([dx, dy]) =>
    [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].every(([mx, my]) => wet(x + dx + mx, y + dy + my)),
  );
const grid = new Uint8Array(cols * rows);
for (let y = 0; y < rows; y++)
  for (let x = 0; x < cols; x++) grid[y * cols + x] = safe(x * cell + 1, y * cell + 1) ? 1 : 0;
const neighbors = (i) => {
  const x = i % cols,
    y = Math.floor(i / cols),
    out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || x + dx < 0 || x + dx >= cols || y + dy < 0 || y + dy >= rows) continue;
      const n = i + dy * cols + dx;
      if (grid[n] && (!dx || !dy || (grid[i + dx] && grid[i + dy * cols]))) out.push(n);
    }
  return out;
};
const components = new Int32Array(grid.length).fill(-1),
  areas = [];
for (let i = 0; i < grid.length; i++)
  if (grid[i] && components[i] < 0) {
    const group = areas.length,
      q = [i];
    components[i] = group;
    for (let head = 0; head < q.length; head++)
      for (const n of neighbors(q[head]))
        if (components[n] < 0) {
          components[n] = group;
          q.push(n);
        }
    areas.push(q.length);
  }
const clear = new Float32Array(grid.length);
for (let i = 0; i < grid.length; i++) clear[i] = grid[i] ? 999 : 0;
for (let y = 1; y < rows; y++)
  for (let x = 1; x < cols; x++) {
    const i = y * cols + x;
    clear[i] = Math.min(clear[i], clear[i - 1] + 1, clear[i - cols] + 1);
  }
for (let y = rows - 2; y >= 0; y--)
  for (let x = cols - 2; x >= 0; x--) {
    const i = y * cols + x;
    clear[i] = Math.min(clear[i], clear[i + 1] + 1, clear[i + cols] + 1);
  }
const point = (i) => [(i % cols) * cell + 1, Math.floor(i / cols) * cell + 1];
function snap(p, group = null) {
  let best = -1,
    score = Infinity;
  for (
    let yy = Math.max(0, Math.floor(p[1] / cell) - 65);
    yy < Math.min(rows, Math.floor(p[1] / cell) + 66);
    yy++
  )
    for (
      let xx = Math.max(0, Math.floor(p[0] / cell) - 65);
      xx < Math.min(cols, Math.floor(p[0] / cell) + 66);
      xx++
    ) {
      const i = yy * cols + xx;
      if (!grid[i] || areas[components[i]] < 100 || (group !== null && components[i] !== group))
        continue;
      const v =
        Math.hypot(xx * cell + 1 - p[0], yy * cell + 1 - p[1]) +
        16 / (1 + clear[i]) -
        (group === null ? 12 * Math.log(areas[components[i]]) : 0);
      if (v < score) {
        score = v;
        best = i;
      }
    }
  if (best < 0) throw new Error('No safe water near ' + p);
  return best;
}
class Heap {
  items = [];
  push(i, score) {
    let n = this.items.length;
    this.items.push([i, score]);
    while (n) {
      const p = (n - 1) >> 1;
      if (this.items[p][1] <= score) break;
      this.items[n] = this.items[p];
      n = p;
    }
    this.items[n] = [i, score];
  }
  pop() {
    const result = this.items[0],
      last = this.items.pop();
    if (this.items.length) {
      let n = 0;
      while (2 * n + 1 < this.items.length) {
        let c = 2 * n + 1;
        if (c + 1 < this.items.length && this.items[c + 1][1] < this.items[c][1]) c++;
        if (this.items[c][1] >= last[1]) break;
        this.items[n] = this.items[c];
        n = c;
      }
      this.items[n] = last;
    }
    return result;
  }
}
function route(a, b) {
  const cost = new Float64Array(grid.length).fill(Infinity),
    parent = new Int32Array(grid.length).fill(-1),
    heap = new Heap(),
    done = new Uint8Array(grid.length);
  cost[a] = 0;
  heap.push(a, 0);
  const [tx, ty] = point(b);
  while (heap.items.length) {
    const [i] = heap.pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === b) break;
    const [ix, iy] = point(i);
    for (const n of neighbors(i)) {
      const [x, y] = point(n);
      const next = cost[i] + Math.hypot(x - ix, y - iy) * (1 + 3 / (1 + clear[n]));
      if (next < cost[n]) {
        cost[n] = next;
        parent[n] = i;
        heap.push(n, next + Math.hypot(x - tx, y - ty));
      }
    }
  }
  if (!Number.isFinite(cost[b])) throw new Error('Safe channel is disconnected');
  const result = [];
  for (let i = b; i >= 0; i = parent[i]) {
    result.push(point(i));
    if (i === a) break;
  }
  return result.reverse();
}
function lineSafe(a, b) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
  for (let i = 0; i <= n; i++)
    if (!safe(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n)) return false;
  return true;
}
const seeds = JSON.parse(await fs.readFile(art + 'water-routes-source.json', 'utf8'));
const result = {},
  checks = [];
for (const [name, source] of Object.entries(seeds)) {
  const votes = new Map();
  for (const p of source) {
    const g = components[snap(p)];
    votes.set(g, (votes.get(g) ?? 0) + 1);
  }
  const group = [...votes].sort((a, b) => b[1] - a[1] || areas[b[0]] - areas[a[0]])[0][0];
  const knots = [];
  for (const p of source) {
    let i;
    try {
      i = snap(p, group);
    } catch {
      continue;
    }
    const q = point(i);
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= 60 && i !== knots.at(-1)) knots.push(i);
  }
  if (knots.length < 2) throw new Error('Too little connected open water: ' + name);
  let dense = [];
  for (let i = 1; i < knots.length; i++)
    dense.push(...route(knots[i - 1], knots[i]).slice(i === 1 ? 0 : 1));
  const points = [dense[0]];
  for (let i = 0; i < dense.length - 1;) {
    let j = Math.min(dense.length - 1, i + 35);
    while (j > i + 1 && !lineSafe(dense[i], dense[j])) j--;
    if (!lineSafe(dense[i], dense[j])) throw new Error('Unsafe segment: ' + name);
    points.push(dense[j]);
    i = j;
  }
  result[name] = points;
  const samples = points
    .slice(1)
    .reduce(
      (n, p, i) => n + Math.ceil(Math.hypot(p[0] - points[i][0], p[1] - points[i][1]) * 2),
      0,
    );
  checks.push({
    name,
    points: points.length,
    samples,
    connectedSeeds: knots.length,
    sourceSeeds: source.length,
    fullHullSafe: true,
    bridgePassages: points.filter(([x, y]) => portalAt(x, y)).length,
  });
}
await fs.writeFile(
  output + 'boat-routes.json',
  await format(JSON.stringify(result), { parser: 'json' }),
);
const sha = async (p) =>
  crypto
    .createHash('sha256')
    .update(await fs.readFile(p))
    .digest('hex');
await fs.writeFile(
  art + 'navigation-manifest.json',
  JSON.stringify(
    {
      version: 'home-navigation-v1',
      sourceSize: [width, height],
      waterMask: maskPath,
      waterMaskSha256: await sha(maskPath),
      hullFootprint: footprint,
      bridgeOpenings: portals,
      sourceSeeds: 'water-routes-source.json',
      output: output + 'boat-routes.json',
      checks,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(checks, null, 2));
