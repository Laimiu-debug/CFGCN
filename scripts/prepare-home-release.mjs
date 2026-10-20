// Package a homepage update while keeping the deployed games on their accepted build.
// Run against a verified production snapshot, never the mutable local games folder.
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    baseline: { type: 'string' },
    build: { type: 'string' },
    out: { type: 'string' },
  },
});
assert(values.baseline && values.build && values.out, '--baseline, --build and --out are required');
const baseline = path.resolve(values.baseline);
const build = path.resolve(values.build);
const out = path.resolve(values.out);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function files(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...(await files(path.join(dir, entry.name), name + '/')));
    else if (entry.isFile()) result.push(name);
    else throw new Error('Unexpected non-file entry: ' + name);
  }
  return result.sort();
}
function entry(html) {
  const script = html.match(/<script type="module" crossorigin src="([^\"]+)"><\/script>/)?.[1];
  const styles = [...html.matchAll(/<link rel="stylesheet" crossorigin href="([^\"]+)"/g)].map(
    (match) => match[1],
  );
  assert(script?.startsWith('/assets/') && styles.length, 'Expected Vite entry and stylesheet');
  return { script, styles };
}

const originalHtml = await readFile(path.join(baseline, 'index.html'), 'utf8');
const newHtml = await readFile(path.join(build, 'index.html'), 'utf8');
const baselineHome = await readFile(path.join(baseline, 'home-release.json'), 'utf8').catch(
  () => null,
);
const original = baselineHome ? JSON.parse(baselineHome).gameBaseline : entry(originalHtml);
const home = entry(newHtml);
const originalFiles = await files(baseline);
assert(originalFiles.includes('games/xiyou/pkg/manifest.json'), 'Missing deployed game manifest');
assert(!(await stat(out).catch(() => null)), 'Output must be a fresh directory');
await mkdir(out, { recursive: true });
for (const name of originalFiles) {
  if (['release.json', 'files.sha256.json', 'index.html', 'index.html.gz'].includes(name)) continue;
  const target = path.join(out, name);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(baseline, name), target);
}
// New immutable bundles may coexist with the old entry and its lazy imports.
for (const name of await files(path.join(build, 'assets'))) {
  const bytes = await readFile(path.join(build, 'assets', name));
  const target = path.join(out, 'assets', name);
  const existing = await readFile(target).catch(() => null);
  assert(!existing || sha(existing) === sha(bytes), 'Immutable asset collision: ' + name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
}
const layoutPath = '/art/atlas/fine-ink/depth-v3/layout.json';
const layout = JSON.parse(await readFile(path.join(build, layoutPath), 'utf8'));
assert.equal(layout.version, 'fine-ink-depth-scene-v3');
const art = new Set([layoutPath]);
const collect = (value) => {
  if (typeof value === 'string' && value.startsWith('/art/atlas/fine-ink/')) art.add(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
};
collect(layout);
for (const name of art) {
  assert(!name.includes('..'));
  const target = path.join(out, name);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(build, name), target);
}
const gameExitFile = (await files(path.join(build, 'assets'))).find((name) =>
  /^GameHomeReturn-.*\.js$/.test(name),
);
assert(gameExitFile, 'Missing independent game return navigation module');
const gameExit = '/assets/' + gameExitFile;
const bootstrap = `// Homepage-only release: game entries stay on the verified production baseline.
const gameHost = /^(xiyou|sanguo|shuihu|honglou)\\.fourealms\\.com$/.test(location.hostname.toLowerCase().replace(/\\.$/, ''));
const gameRoute = /^#\\/world\\/(xiyou|sanguo|shuihu|honglou)$/.test(location.hash);
const entry = gameHost || gameRoute ? ${JSON.stringify(original)} : ${JSON.stringify(home)};
document.documentElement.dataset.siteSurface = gameHost || gameRoute ? 'game-baseline' : 'fine-ink-home-v3';
document.documentElement.dataset.siteEntry = entry.script;
await Promise.all(entry.styles.map(href => new Promise((resolve, reject) => {
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = href;
  link.onload = resolve; link.onerror = reject;
  document.head.append(link);
})));
if (location.hostname.toLowerCase().startsWith('xiyou.') || location.hash === '#/world/xiyou')
  await import(${JSON.stringify(gameExit)}).then(module => module.installGameHomeReturn());
await import(entry.script);
`;
const bootstrapName = `home-entry-${sha(bootstrap).slice(0, 12)}.js`;
await writeFile(path.join(out, 'assets', bootstrapName), bootstrap);
const html = newHtml
  .replace(/\s*<script type="module"[^>]*><\/script>/g, '')
  .replace(/\s*<link rel="(?:stylesheet|modulepreload)"[^>]*>/g, '')
  .replace(
    '</head>',
    `  <script type="module" crossorigin src="/assets/${bootstrapName}"></script>\n  </head>`,
  );
await writeFile(path.join(out, 'index.html'), html);
let verifiedGameFiles = 0;
for (const name of originalFiles.filter((name) => name.startsWith('games/'))) {
  assert.equal(
    sha(await readFile(path.join(out, name))),
    sha(await readFile(path.join(baseline, name))),
  );
  verifiedGameFiles++;
}
const report = {
  kind: 'homepage-only',
  baselineIndexSha256: sha(originalHtml),
  indexSha256: sha(html),
  home,
  gameBaseline: original,
  gameExit,
  verifiedGameFiles,
  art: [...art],
  bootstrap: `/assets/${bootstrapName}`,
  source: 'apps/website/src/fine-ink-home; restored accepted v3, no trial route or iframe',
};
await writeFile(path.join(out, 'home-release.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
