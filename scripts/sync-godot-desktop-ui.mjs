import { readFile, writeFile, mkdir, readdir, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
assert.ok(!/^c:/i.test(root), 'Project sources must stay off C:');
const canonical = path.join(root, 'packages/godot-desktop-ui');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const changed = [];
async function writeChanged(file, bytes) {
  await mkdir(path.dirname(file), { recursive: true });
  let existing;
  try { existing = await readFile(file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (existing && hash(existing) === hash(bytes)) return;
  await writeFile(file, bytes);
  changed.push(path.relative(root, file).replaceAll('\\', '/'));
}
const sourceAssets = [
  ['apps/website/public/art/entrances/ink-v1/xiyou-poster.webp', 'assets/xiyou-background.webp'],
  ['apps/website/public/games/xiyou/assets/shadow/wukong/standee.png', 'assets/xiyou-figure.png'],
  ['apps/website/public/art/entrances/ink-v1/shuihu-poster.webp', 'assets/shuihu-background.webp'],
  ['apps/shuihu/ui-study/assets/ls001.webp', 'assets/shuihu-figure.webp'],
  ['node_modules/@fontsource/ma-shan-zheng/LICENSE', 'assets/fonts/OFL.txt'],
];
const provenance = [];
for (const [source, destination] of sourceAssets) {
  const from = path.join(root, source);
  const bytes = await readFile(from);
  await writeChanged(path.join(canonical, destination), bytes);
  provenance.push({ source, destination, sha256: hash(bytes), bytes: bytes.length });
}
const css = await readFile(path.join(root, 'packages/ui/src/tokens.css'), 'utf8');
const rootTokens = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
assert.ok(rootTokens, 'Canonical root theme was not found');
const tokenMap = new Map([...rootTokens.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
function token(name) {
  const value = tokenMap.get(name);
  assert.ok(value, 'Missing visual token: ' + name);
  const reference = value.match(/^var\(--([\w-]+)\)$/);
  if (reference) return token(reference[1]);
  assert.ok(/^#[0-9a-f]{3,8}$/i.test(value), 'Expected a color token: ' + name);
  return value;
}
const palette = {
  paper: token('paper'), paper_raised: token('paper-raised'), ink: token('ink'),
  muted: token('muted'), jade: token('jade'), line: token('line'),
  gold: tokenMap.has('gold') ? token('gold') : token('line-strong'),
  seal: tokenMap.has('seal') ? token('seal') : token('accent-xiyou'),
  xiyou: token('accent-xiyou'), shuihu: token('accent-shuihu'),
};
await writeChanged(path.join(canonical, 'palette.json'), Buffer.from(JSON.stringify(palette, null, 2) + '\n'));
const titleCharacters = new Set([...'西游记西遊記聚义梁山聚義梁山系统设置系統設定稍作歇息山河将启山河將啟选择存档選擇存檔制作信息製作資訊开启新的旅程開啟新的旅程显示效果是否正常顯示效果是否正常退出游戏離開遊戲'].map(c => c.codePointAt(0)));
const fontCss = await readFile(path.join(root, 'node_modules/@fontsource/ma-shan-zheng/400.css'), 'utf8');
const fonts = [];
for (const block of fontCss.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)) {
  const file = block[1].match(/url\(['"]?\.\/files\/([^'")]+\.woff2)/)?.[1];
  const ranges = block[1].match(/unicode-range:\s*([^;]+)/)?.[1];
  if (!file || !ranges) continue;
  const included = ranges.split(',').some(range => {
    const bounds = range.trim().replace(/^U\+/i, '').split('-').map(x => parseInt(x, 16));
    return [...titleCharacters].some(code => code >= bounds[0] && code <= (bounds[1] ?? bounds[0]));
  });
  if (!included || fonts.includes(file)) continue;
  fonts.push(file);
  const source = 'node_modules/@fontsource/ma-shan-zheng/files/' + file;
  const bytes = await readFile(path.join(root, source));
  await writeChanged(path.join(canonical, 'assets/fonts', file), bytes);
  provenance.push({ source, destination: 'assets/fonts/' + file, sha256: hash(bytes), bytes: bytes.length });
}
assert.ok(fonts.length > 0, 'No licensed title font subsets found');
await writeChanged(path.join(canonical, 'fonts.json'), Buffer.from(JSON.stringify(fonts, null, 2) + '\n'));
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['games', 'tests', 'tools', '.godot'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(full));
    else if (!entry.name.endsWith('.uid') && !entry.name.endsWith('.import')) result.push(full);
  }
  return result;
}
const managed = await files(canonical);
const requested = process.argv.find(a => a.startsWith('--game='))?.split('=')[1];
const games = requested ? [requested] : ['xiyou', 'shuihu'];
assert.ok(games.every(game => ['xiyou', 'shuihu'].includes(game)));
const outputs = [];
for (const game of games) {
  const project = path.join(root, 'apps', game, 'godot');
  assert.ok(!/^c:/i.test(await realpath(project)), 'Godot project must stay off C:');
  const destination = path.join(project, 'shared_desktop_ui');
  for (const file of managed) {
    const relative = path.relative(canonical, file);
    const assetGame = path.basename(relative).match(/^(xiyou|shuihu)-(?:background|figure)\./)?.[1];
    if (assetGame && assetGame !== game) continue;
    const bytes = await readFile(file);
    await writeChanged(path.join(destination, relative), bytes);
    outputs.push({ game, path: path.relative(root, path.join(destination, relative)).replaceAll('\\', '/'), sha256: hash(bytes) });
  }
  const gameBytes = await readFile(path.join(canonical, 'games', game + '.json'));
  await writeChanged(path.join(destination, 'game.json'), gameBytes);
  const gameDefinition = JSON.parse(gameBytes);
  // Runtime data is a referenced Godot resource, independent of raw-file export filters.
  const dataSource = 'extends RefCounted\n\nconst CONFIG = ' + JSON.stringify(gameDefinition, null, '\t') + '\n\nconst PALETTE = ' + JSON.stringify(palette, null, '\t') + '\n\nconst ART = {\n\t"background": preload("' + gameDefinition.background + '"),\n\t"figure": preload("' + gameDefinition.figure + '"),\n\t"brush": preload("res://shared_desktop_ui/assets/brush.svg")\n}\n\nconst TITLE_FONTS = [\n' + fonts.map(file => '\tpreload("res://shared_desktop_ui/assets/fonts/' + file + '")').join(',\n') + '\n]\n';
  const dataBytes = Buffer.from(dataSource);
  await writeChanged(path.join(destination, 'game_data.gd'), dataBytes);
  for (const [name, bytes] of [['game.json', gameBytes], ['game_data.gd', dataBytes]]) {
    outputs.push({ game, path: path.relative(root, path.join(destination, name)).replaceAll('\\', '/'), sha256: hash(bytes) });
  }
  if (gameDefinition.gameplay_scene_source) {
    const sceneBytes = await readFile(path.join(canonical, 'games', gameDefinition.gameplay_scene_source));
    await writeChanged(path.join(destination, 'gameplay.tscn'), sceneBytes);
    outputs.push({ game, path: path.relative(root, path.join(destination, 'gameplay.tscn')).replaceAll('\\', '/'), sha256: hash(sceneBytes) });
  }
  if (process.argv.includes('--activate')) {
    const projectFile = path.join(project, 'project.godot');
    let text = await readFile(projectFile, 'utf8');
    const previous = text.match(/^run\/main_scene="([^"]+)"/m)?.[1];
    assert.ok(['res://scenes/main.tscn', 'res://shared_desktop_ui/desktop_boot.tscn'].includes(previous), 'Review a changed gameplay entry before activation');
    text = text.replace(/^run\/main_scene="[^"]+"/m, 'run/main_scene="res://shared_desktop_ui/desktop_boot.tscn"');
    await writeChanged(projectFile, Buffer.from(text));
  }
}
const report = {
  version: 1, revision: 'desktop-ui-v2.1', date: '2026-10-24', source: 'packages/godot-desktop-ui',
  paletteSource: 'packages/ui/src/tokens.css', paletteSha256: hash(Buffer.from(css)),
  scope: 'Shared menu, real loading, pause and preferences; gameplay and campaign saves remain game-owned.',
  provenance, outputs,
};
await writeChanged(path.join(root, 'source/godot-desktop-ui/source-manifest.json'), Buffer.from(JSON.stringify(report, null, 2) + '\n'));
console.log(JSON.stringify({ games, canonicalFiles: managed.length, fontSubsets: fonts.length, changed: changed.length, activated: process.argv.includes('--activate') }));
