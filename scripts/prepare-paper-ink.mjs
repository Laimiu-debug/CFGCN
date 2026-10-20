import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
} from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.local/paper-ink/site');
const baseline = resolve(root, '.local/depth-ink/site');
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
if (!existsSync(resolve(output, 'index.html')))
  throw new Error('Build the isolated paper-ink site first');
if (!existsSync(resolve(baseline, 'index.html')))
  throw new Error('The preserved v3 reference must exist; do not substitute v4');
mkdirSync(resolve(output, 'flat-v3'), { recursive: true });
copyFileSync(resolve(baseline, 'index.html'), resolve(output, 'flat-v3/index.html'));
const archived = [];
for (const entry of readdirSync(resolve(baseline, 'assets'), { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const from = resolve(baseline, 'assets', entry.name),
    to = resolve(output, 'assets', entry.name);
  if (existsSync(to) && hash(from) !== hash(to))
    throw new Error(`Reference asset collision: ${entry.name}`);
  if (!existsSync(to)) copyFileSync(from, to);
  archived.push({
    file: `assets/${entry.name}`,
    bytes: readFileSync(from).length,
    sha256: hash(from),
  });
}
const sources = [
  'apps/website/src/PaperInkStudy.tsx',
  'apps/website/src/PaperInkStage.tsx',
  'apps/website/src/paper-stage.ts',
  'apps/website/src/paper-ink-study.css',
  'apps/website/art/fine-ink/plate-v1.png',
  'apps/website/art/fine-ink/underpaint-v3.png',
  'apps/website/art/fine-ink/manifest-v3.json',
  'scripts/prepare-paper-ink.mjs',
].map((file) => ({ file, sha256: hash(resolve(root, file)) }));
const manifest = {
  version: 'paper-stage-v5',
  date: '2026-10-20',
  status: 'trial did not improve visual continuity; default restored to preserved v3',
  construction:
    'world-up Y; continuous low terrain; rooted folded surfaces; orthographic camera; separate city frontage and landmarks; no inverse camera projection',
  art: 'Existing accepted painting and v3 local cutouts, mechanically masked / split at runtime; no new image generation, Studio tasks or paid tools',
  original: {
    url: '/flat-v3/?atlas=fine-ink#/',
    indexSha256: hash(resolve(baseline, 'index.html')),
    assets: archived,
  },
  sources,
};
const manifestFile = resolve(root, '.local/paper-ink/manifest.json');
mkdirSync(dirname(manifestFile), { recursive: true });
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    output: relative(root, output),
    originalAssets: archived.length,
    originalIndexSha256: manifest.original.indexSha256,
    sourceCount: sources.length,
  }),
);
