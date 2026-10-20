// One painted surface derived from the same water, relief, courts and lanes as the 3D scene.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import sharp from 'sharp';
import { paintScrollSurface } from './paint-scroll-surface.mjs';
const layout = JSON.parse(await fs.readFile('apps/website/src/scroll-layout.json', 'utf8'));
await fs.mkdir('.local/scroll-refinement', { recursive: true });
for (const name of ['terrain', 'settlements']) {
  let source = await fs.readFile('apps/website/src/scroll-' + name + '.ts', 'utf8');
  source = source
    .replace(
      "import layout from './scroll-layout.json';",
      'const layout=' + JSON.stringify(layout) + ';',
    )
    .replace("from './scroll-terrain'", "from './terrain.mjs'");
  await fs.writeFile(
    '.local/scroll-refinement/' + name + '.mjs',
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  );
}
const {
  waterDistance,
  townDistance,
  mountainHeight,
  sampleCurve,
  smooth,
  cultivationWeight,
  lowlandHeight,
} = await import(pathToFileURL(path.resolve('.local/scroll-refinement/terrain.mjs')));
const { settlementPlan } = await import(
  pathToFileURL(path.resolve('.local/scroll-refinement/settlements.mjs'))
);
const plan = settlementPlan();
const tokens = await fs.readFile('packages/ui/src/tokens.css', 'utf8');
const hex = (n) => tokens.match(new RegExp('--' + n + ':\\s*(#[a-fA-F0-9]{6})'))[1];
const mix = (a, b, t) =>
  '#' +
  [1, 3, 5]
    .map((i) =>
      Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const paper = hex('paper-raised'),
  ink = hex('ink'),
  gold = hex('gold'),
  jade = hex('jade');
let seed = 431176;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const b = layout.bounds,
  w = b.east - b.west,
  h = b.south - b.north;
const point = ([x, z]) => [(x - b.west).toFixed(3), (z - b.north).toFixed(3)].join(',');
const textureWidth = 4096,
  textureHeight = Math.round((textureWidth * h) / w);
const routeMask = [];
const line = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + point(p)).join('');
const terrain = {
  waterDistance,
  townDistance,
  mountainHeight,
  sampleCurve,
  smooth,
  cultivationWeight,
  lowlandHeight,
};
const { defs, fields, fieldEdges, detail, parcels, landUrl, rockStrokes, bankMarks } =
  await paintScrollSurface({
    layout,
    terrain,
    hex,
    mix,
    sharp,
    random,
    point,
    line,
  });
const paths = [],
  shadows = [];
const lane = (points, width, paved = false) => {
  const d = line(sampleCurve(points));
  routeMask.push(
    '<path d="' +
      d +
      '" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="' +
      (width + 0.35) +
      '"/>',
  );
  paths.push(
    '<path d="' +
      d +
      '" fill="none" stroke="' +
      mix(paper, hex('gold-ink'), 0.5) +
      '" stroke-width="' +
      (width + 0.28) +
      '"/><path d="' +
      d +
      '" fill="none" stroke="' +
      mix(paper, paved ? hex('muted') : gold, paved ? 0.19 : 0.45) +
      '" stroke-width="' +
      width +
      '"/>',
  );
};
for (const road of layout.roads) lane(road.points, road.width);
for (const canal of layout.irrigation) {
  const d = line(sampleCurve(canal));
  paths.push(
    '<path d="' +
      d +
      '" fill="none" stroke="' +
      mix(paper, jade, 0.43) +
      '" stroke-width=".35"/><path d="' +
      d +
      '" fill="none" stroke="' +
      mix(paper, hex('accent-shuihu'), 0.55) +
      '" stroke-width=".16"/>',
  );
}
for (const p of Object.values(layout.places)) {
  if (p === layout.places.shuihu) continue;
  paths.push(
    '<rect x="' +
      (p.x - p.width / 2 - b.west) +
      '" y="' +
      (p.z - p.depth / 2 - b.north) +
      '" width="' +
      p.width +
      '" height="' +
      p.depth +
      '" fill="' +
      mix(paper, hex('gold-ink'), 0.23) +
      '"/>',
  );
}
for (const c of plan.courts) {
  const angle = c.angle || 0;
  const polygon = [
    [-c.w / 2, -c.d / 2],
    [c.w / 2, -c.d / 2],
    [c.w / 2, c.d / 2],
    [-c.w / 2, c.d / 2],
  ].map(([u, v]) => [
    c.x + Math.cos(angle) * u + Math.sin(angle) * v,
    c.z - Math.sin(angle) * u + Math.cos(angle) * v,
  ]);
  paths.push(
    '<path d="' +
      line(polygon) +
      'Z" fill="' +
      mix(paper, c.garden ? jade : gold, c.garden ? 0.29 : 0.25) +
      '" stroke="' +
      mix(paper, ink, 0.25) +
      '" stroke-width=".1"/>',
  );
}
for (const p of plan.lanes) lane(p.points, p.width, p.paved);
for (const building of plan.buildings) {
  if (building.tier) continue;
  const { x, z, w: width, d, angle } = building;
  const polygon = [
    [-width * 0.6, -d * 0.6],
    [width * 0.6, -d * 0.6],
    [width * 0.6, d * 0.6],
    [-width * 0.6, d * 0.6],
  ].map(([a, c]) => [
    x + a * Math.cos(angle) + c * Math.sin(angle),
    z - a * Math.sin(angle) + c * Math.cos(angle),
  ]);
  const shadow = polygon.map(([a, c]) => [a + building.h * 0.48, c + building.h * 0.42]);
  shadows.push(
    '<path d="' +
      line(shadow) +
      'Z" fill="' +
      ink +
      '" fill-opacity=".18"/><path d="' +
      line(polygon) +
      'Z" fill="' +
      ink +
      '" fill-opacity=".13"/>',
  );
}
// Paving joints stay inside cities and yards; no bright rectangular plate below the town.
for (const p of [layout.places.xiyou, layout.places.sanguo])
  for (let i = 0; i < 1200; i++) {
    const x = p.x + (random() - 0.5) * p.width,
      z = p.z + (random() - 0.5) * p.depth;
    paths.push(
      '<path d="M' +
        point([x, z]) +
        'h.25" stroke="' +
        mix(paper, ink, 0.38) +
        '" stroke-opacity=".25" stroke-width=".04"/>',
    );
  }
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="' +
  textureWidth +
  '" height="' +
  textureHeight +
  '" viewBox="0 0 ' +
  w +
  ' ' +
  h +
  '"><defs>' +
  defs.join('') +
  '</defs><image preserveAspectRatio="none" width="' +
  w +
  '" height="' +
  h +
  '" href="data:image/png;base64,' +
  landUrl +
  '"/><g mask="url(#cultivated)">' +
  fields.join('') +
  '</g>' +
  detail.join('') +
  paths.join('') +
  shadows.join('') +
  '</svg>';
const out = 'apps/website/public/art/atlas/scroll';
await fs.writeFile('.local/scroll-refinement/ground-source.svg', svg);
await sharp(Buffer.from(svg))
  .webp({ quality: 90 })
  .toFile(out + '/earth.webp');
const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${textureWidth}" height="${textureHeight}" viewBox="0 0 ${w} ${h}"><defs>${defs.join('')}</defs><rect width="${w}" height="${h}" fill="black"/><g mask="url(#cultivated)">${fieldEdges.join('')}</g>${routeMask.join('').replaceAll('white', '#ff0000')}</svg>`;
const packedMask = await sharp(Buffer.from(maskSvg)).raw().toBuffer({ resolveWithObject: true });
// Field-bank heights need only sixteen levels. R stays byte-identical to the
// original route mask, while G compresses without adding another GPU texture.
for (let i = 1; i < packedMask.data.length; i += packedMask.info.channels)
  packedMask.data[i] = Math.round(packedMask.data[i] / 17) * 17;
await sharp(packedMask.data, {
  raw: { width: textureWidth, height: textureHeight, channels: packedMask.info.channels },
})
  .webp({ lossless: true })
  .toFile(out + '/routes.webp');
const size = 128,
  noise = Buffer.alloc(size * size * 4);
for (let i = 0; i < size * size; i++) {
  const value = 190 + Math.floor(random() * 65);
  noise.set([value, value, value, 255], i * 4);
}
await sharp(noise, { raw: { width: size, height: size, channels: 4 } })
  .webp({ lossless: true })
  .toFile(out + '/grain.webp');
const result = {
  method:
    'Planar rock masses with cross-face bedding, continuous talus and scrub; complete valley fields clipped per pixel against the real slopes and banks, shared raised-bank normal channel and crop rows; code-authored surface, no parcel-centre cutoff or generated background.',
  width: textureWidth,
  height: textureHeight,
  fieldCount: parcels.length,
  rockBrushPaths: rockStrokes,
  bankMarks,
  buildingFootprints: plan.buildings.filter((p) => !p.tier).length,
  bounds: b,
  textureBytes: (await fs.stat(out + '/earth.webp')).size,
  routeMaskBytes: (await fs.stat(out + '/routes.webp')).size,
  roads: 'One ground material; R=routes, G=field-bank relief. No coplanar road geometry.',
};
await fs.writeFile(out + '/surface.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
