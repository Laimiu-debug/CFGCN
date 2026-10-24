import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = await realpath(path.resolve(import.meta.dirname, '..'));
const qaFlag = process.argv.find(arg => arg.startsWith('--qa-dir='))?.slice(9);
const qa = qaFlag ? path.resolve(root, qaFlag) : path.join(root, '.local/qa/godot-desktop-ui');
assert(qa.toLowerCase().startsWith(path.join(root, '.local/qa').toLowerCase() + path.sep));
const namespace = process.argv.find(arg => arg.startsWith('--profile='))?.slice(10) ?? 'final-isolated';
assert(/^[a-z0-9-]+$/.test(namespace));
const profileRoot = `H:/codex/app-data/cfgcn-shared-ui-qa/${namespace}`;
const engine = 'H:/codex/tools/godot-4.7.2/Godot_v4.7.2-stable_win64_console.exe';
const suite = process.argv[2] ?? 'all';
const gameFlag = process.argv.find(arg => arg.startsWith('--game='))?.slice(7);
const games = gameFlag ? [gameFlag] : ['xiyou', 'shuihu'];
const suites = suite === 'all' ? ['settings_test', 'ui_controls', 'ui_edges', 'game_flow', 'restart'] : [suite];
assert(games.every(game => ['xiyou', 'shuihu'].includes(game)));
assert(suites.every(item => ['settings_test', 'ui_controls', 'ui_edges', 'game_flow', 'restart', 'capture', 'visual_polish'].includes(item)));
await mkdir(profileRoot, { recursive: true });
await mkdir(path.join(qa, 'runs'), { recursive: true });
assert((await realpath(profileRoot)).toLowerCase().startsWith('h:\\codex\\app-data\\cfgcn-shared-ui-qa\\'));
const runFile = path.join(qa, 'runs', `${suite}-${gameFlag ?? 'both'}.json`);
const records = process.argv.includes('--resume') ? JSON.parse(await readFile(runFile, 'utf8')).records : [];
for (const current of suites) {
  for (const game of current === 'settings_test' ? ['xiyou'] : games) {
    if (records.some(record => record.game === game && record.suite === current && record.code === 0)) continue;
    const project = path.join(root, 'apps', game, 'godot');
    assert((await realpath(path.join(project, '.godot'))).toLowerCase().startsWith('h:\\codex\\cache\\'));
    assert((await readFile(path.join(project, 'project.godot'), 'utf8')).includes('run/main_scene="res://shared_desktop_ui/desktop_boot.tscn"'));
    const staging = path.join(project, 'shared_desktop_ui/tests');
    await mkdir(staging, { recursive: true });
    for (const name of new Set(['ui_controls', current])) {
      await copyFile(path.join(root, 'packages/godot-desktop-ui/tests', name + '.gd'), path.join(staging, name + '.gd'));
    }
    const profile = path.join(profileRoot, game);
    const env = { ...process.env,
      APPDATA: path.join(profile, 'roaming'), LOCALAPPDATA: path.join(profile, 'local'),
      TEMP: path.join(profile, 'tmp'), TMP: path.join(profile, 'tmp'),
      CFGCN_DESKTOP_PROFILE_DIR: path.join(profile, 'preferences'),
      CFGCN_SHUIHU_USER_DIR: path.join(profile, 'saves'),
      CFGCN_DESKTOP_QA_DIR: qa,
    };
    for (const key of ['APPDATA', 'LOCALAPPDATA', 'TEMP', 'CFGCN_DESKTOP_PROFILE_DIR', 'CFGCN_SHUIHU_USER_DIR']) await mkdir(env[key], { recursive: true });
    const args = ['--path', project, '--log-file', path.join(qa, `${game}-${current}-isolated.log`)];
    if (process.argv.includes('--verbose')) args.push('--verbose');
    if (current === 'settings_test') args.push('--headless', '--script', 'res://shared_desktop_ui/tests/settings_test.gd');
    else args.push('--', `--desktop-qa=res://shared_desktop_ui/tests/${current}.gd`, '--desktop-window-label=隔离存档验收');
    const capturedOutput = [];
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(engine, args, { cwd: project, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', chunk => { capturedOutput.push(chunk); process.stdout.write(chunk); });
      child.stderr.on('data', chunk => { capturedOutput.push(chunk); process.stderr.write(chunk); });
      child.on('error', reject);
      child.on('close', code => resolve(code));
    });
    const log = Buffer.concat(capturedOutput).toString('utf8');
    await writeFile(path.join(qa, `${game}-${current}-isolated.log`), log);
    const engineErrors = /SCRIPT ERROR:|^ERROR:/m.test(log);
    const code = exitCode === 0 && engineErrors ? 1 : exitCode;
    records.push({ game, suite: current, code, exitCode, engineErrors, paths: { appdata: env.APPDATA, preferences: env.CFGCN_DESKTOP_PROFILE_DIR, nativeShuihuSave: env.CFGCN_SHUIHU_USER_DIR } });
    await writeFile(runFile, JSON.stringify({ date: new Date().toISOString(), records }, null, 2) + '\n');
    if (code !== 0) process.exit(code ?? 1);
  }
}
