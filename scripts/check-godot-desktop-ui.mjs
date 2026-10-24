import { readFile, writeFile, readdir, realpath, stat, unlink, rmdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = await realpath(path.resolve(import.meta.dirname, '..'));
const qaFlag = process.argv.find(arg => arg.startsWith('--qa-dir='))?.slice(9);
const qa = qaFlag ? path.resolve(root, qaFlag) : path.join(root, '.local/qa/godot-desktop-ui');
assert(qa.toLowerCase().startsWith(path.join(root, '.local/qa').toLowerCase() + path.sep));
const canonical = path.join(root, 'packages/godot-desktop-ui');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const manifest = await json(path.join(root, 'source/godot-desktop-ui/source-manifest.json'));
const runtime = [];
for (const entry of manifest.outputs) {
  const target = path.join(root, entry.path);
  const actual = await realpath(target);
  assert(actual.toLowerCase().startsWith(root.toLowerCase() + path.sep));
  const bytes = await readFile(target);
  assert.equal(digest(bytes), entry.sha256, entry.path);
  runtime.push({ path: entry.path, sha256: entry.sha256, bytes: bytes.length });
}
const tests = [];
for (const game of ['xiyou', 'shuihu']) {
  const project = path.join(root, 'apps', game, 'godot');
  assert((await readFile(path.join(project, 'project.godot'), 'utf8')).includes('run/main_scene="res://shared_desktop_ui/desktop_boot.tscn"'));
  assert((await realpath(path.join(project, '.godot'))).toLowerCase().startsWith('h:\\codex\\cache\\'));
  for (const [kind, count] of [['ui-controls', 24], ['ui-edges', 31], ['game-flow', 24], ['restart', 8]]) {
    const file = path.join(qa, `${game}-${kind}.json`);
    const result = await json(file);
    assert.equal(result.failed, 0, file);
    assert.equal(result.checks.length, count, file);
    assert(result.checks.every(check => check.ok));
    if (kind === 'game-flow') assert(result.adapter.save_path.replaceAll('\\', '/').toLowerCase().startsWith('h:/codex/app-data/cfgcn-shared-ui-qa/'));
    tests.push({ game, suite: kind, checks: count, failed: 0, path: relative(file), sha256: digest(await readFile(file)) });
  }
  if (process.argv.includes('--with-polish')) {
    const file = path.join(qa, `${game}-visual-polish.json`);
    const result = await json(file);
    assert.equal(result.failed, 0, file);
    assert(result.checks.length >= 27 && result.checks.every(check => check.ok));
    assert(result.audio.after_next_tab > result.audio.after_open_settings && result.audio.after_open_settings > result.audio.before);
    tests.push({ game, suite: 'visual-polish', checks: result.checks.length, failed: 0, path: relative(file), sha256: digest(await readFile(file)) });
  }
}
const unitFile = path.join(qa, 'settings-tests.json');
const unit = await json(unitFile);
assert.equal(unit.failed, 0);
assert.equal(unit.checks.length, 20);
tests.push({ suite: 'settings', checks: 20, failed: 0, path: relative(unitFile), sha256: digest(await readFile(unitFile)) });
const runFile = path.join(qa, 'runs/all-both.json');
const run = await json(runFile);
assert.equal(run.records.length, 9);
assert(run.records.every(record => record.code === 0));
if (process.argv.includes('--with-polish')) {
  const polish = await json(path.join(qa, 'runs/visual_polish-both.json'));
  assert.equal(polish.records.length, 2);
  assert(polish.records.every(record => record.code === 0 && record.engineErrors === false));
  run.records.push(...polish.records);
}
const logs = [];
for (const record of run.records) {
  const file = path.join(qa, `${record.game}-${record.suite}-isolated.log`);
  const text = await readFile(file, 'utf8');
  assert(!/SCRIPT ERROR:|^ERROR:|^WARNING:/m.test(text), file);
  logs.push({ path: relative(file), sha256: digest(Buffer.from(text)) });
}

const removed = [];
const skipped = [];
async function removeCopy(file, retained, reason) {
  try { await stat(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const absolute = await realpath(file);
  assert(absolute.toLowerCase().startsWith(root.toLowerCase() + path.sep));
  const bytes = await readFile(file);
  if (retained && digest(bytes) !== digest(await readFile(retained))) {
    skipped.push({ path: relative(file), reason: 'Older or different staging content; retained until its own source identity is reviewed.' });
    return;
  }
  if (process.argv.includes('--cleanup')) {
    await unlink(file);
    removed.push({ path: relative(file), retained: retained ? relative(retained) : null, sha256: digest(bytes), bytes: bytes.length, reason,
      ...(retained ? {} : { generatedMetadata: bytes.toString('utf8') }) });
  } else skipped.push({ path: relative(file), reason: 'Add --cleanup after checking active processes.' });
}
for (const game of ['xiyou', 'shuihu']) {
  const staging = path.join(root, 'apps', game, 'godot/shared_desktop_ui');
  const testsDir = path.join(staging, 'tests');
  for (const entry of await readdir(testsDir, { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))) {
    if (!entry.isFile()) continue;
    const name = entry.name.replace(/\.uid$/, '');
    const source = path.join(canonical, name === 'render_shuihu_cover.gd' ? 'tools' : 'tests', name);
    try { await stat(source); } catch { skipped.push({ path: relative(path.join(testsDir, entry.name)), reason: 'Unknown staging file, retained.' }); continue; }
    await removeCopy(path.join(testsDir, entry.name), entry.name.endsWith('.uid') ? null : source, entry.name.endsWith('.uid') ? 'Generated test UID; canonical test retained.' : 'Unreferenced QA staging; canonical source retained.');
  }
  if (process.argv.includes('--cleanup')) await rmdir(testsDir).catch(error => { if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error; });
  const other = game === 'xiyou' ? 'shuihu' : 'xiyou';
  for (const entry of await readdir(path.join(staging, 'assets'))) {
    if (!entry.startsWith(other + '-') || entry.endsWith('.import')) continue;
    const file = path.join(staging, 'assets', entry);
    await removeCopy(file, path.join(canonical, 'assets', entry), 'Other game cover is not referenced by this game.');
    await removeCopy(file + '.import', null, 'Generated import metadata for removed unreferenced cover.');
  }
}
const pngs = (await readdir(qa)).filter(name => name.endsWith('.png')).sort((a, b) => Number(b.includes('-final')) - Number(a.includes('-final')) || b.localeCompare(a));
const retainedImages = new Map();
for (const name of pngs) {
  const file = path.join(qa, name), sha = digest(await readFile(file));
  if (retainedImages.has(sha)) await removeCopy(file, retainedImages.get(sha), 'Byte-identical own QA image; full retained image and mapping preserved.');
  else retainedImages.set(sha, file);
}
const report = {
  date: new Date().toISOString(), scope: 'Shared native desktop UI only; two main gameplay projects remain separately owned.',
  checks: tests.reduce((sum, item) => sum + item.checks, 0), failed: 0, tests, logs, runtime,
  cleanup: { removed, skipped, logicalBytes: { C: 0, G: removed.reduce((sum, item) => sum + item.bytes, 0), H: 0 },
    kept: 'Canonical assets, all unique screenshots, representative failures, settings/saves/history, runtime imports and other tasks remain.' },
  boundaries: ['No Git commit/push or production deployment.', 'No final Windows package acceptance; owners retain export responsibility.', 'No full Shuihu campaign acceptance.', 'OS window activation unavailable; no external mouse acceptance claimed.'],
};
await writeFile(path.join(qa, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ checks: report.checks, failed: 0, runtimeFiles: runtime.length, removedFiles: removed.length, deletedLogicalBytes: report.cleanup.logicalBytes, pending: skipped.length }));
