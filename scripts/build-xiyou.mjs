import { spawnSync } from 'node:child_process';
import './sync-art-theme.mjs';
import './terrain-profile.mjs';
import './prepare-shadow-combat.mjs';
import './prepare-shadow-ui.mjs';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  cpSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameResources } from './xiyou-resources.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const benchmark = process.env.CFGCN_CROWD_BENCH;
if (benchmark && !/^(baseline|optimized)$/.test(benchmark)) throw Error('Invalid benchmark output');
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message ?? `${cmd} failed (${result.status})`);
};
const lock = readFileSync(join(root, 'Cargo.lock'), 'utf8');
const version = /name = "wasm-bindgen"\r?\nversion = "([^"]+)"/.exec(lock)?.[1];
if (!version) throw new Error('Run cargo generate-lockfile first.');
const toolRoot = join(root, '.local/rust-tools');
const executable = process.platform === 'win32' ? 'wasm-bindgen.exe' : 'wasm-bindgen';
let bindgen = process.env.CFGCN_WASM_BINDGEN;
for (const dir of [
  join(toolRoot, 'bin'),
  ...(existsSync(toolRoot)
    ? readdirSync(toolRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => join(toolRoot, e.name))
    : []),
]) {
  if (!bindgen && existsSync(join(dir, executable))) bindgen = join(dir, executable);
}
if (!bindgen) {
  run(process.execPath, [
    join(root, 'scripts/rust.mjs'),
    'install',
    'wasm-bindgen-cli',
    '--version',
    version,
    '--locked',
    '--root',
    toolRoot,
  ]);
  bindgen = join(toolRoot, 'bin', executable);
}
const toolVersion = spawnSync(bindgen, ['--version'], { encoding: 'utf8' });
if (!toolVersion.stdout?.includes(` ${version}`))
  throw new Error(`wasm-bindgen-cli must match locked version ${version}`);
run(process.execPath, [
  join(root, 'scripts/rust.mjs'),
  'build',
  '-p',
  'cfgcn-xiyou',
  '--target',
  'wasm32-unknown-unknown',
  '--release',
  '--locked',
  ...(benchmark ? ['--features', 'crowd-benchmark'] : []),
]);
const out = resolve(
  root,
  benchmark ? `.local/crowd-bench/${benchmark}/pkg` : 'apps/website/public/games/xiyou/pkg',
);
mkdirSync(out, { recursive: true });
if (benchmark)
  cpSync(
    join(root, 'apps/website/public/games/xiyou'),
    resolve(root, `.local/crowd-bench/${benchmark}/game`),
    { recursive: true },
  );
const intermediate = mkdtempSync(join(root, '.local/xiyou-bindgen-'));
run(bindgen, [
  join(root, '.local/cargo-target/wasm32-unknown-unknown/release/cfgcn-xiyou.wasm'),
  '--target',
  'web',
  '--out-name',
  'cfgcn_xiyou',
  '--out-dir',
  intermediate,
  '--no-typescript',
]);
const hash = (content) => createHash('sha256').update(content).digest('hex').slice(0, 12);
const writeStable = (path, content) => {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  if (!existsSync(path) || !readFileSync(path).equals(bytes)) writeFileSync(path, bytes);
};
const bytes = readFileSync(join(intermediate, 'cfgcn_xiyou_bg.wasm'));
const wasm = `client-${hash(bytes)}.wasm`;
const gzip = `${wasm}.gz`;
const gzipBytes = gzipSync(bytes, { level: 9 });
const glue = readFileSync(join(intermediate, 'cfgcn_xiyou.js'), 'utf8').replaceAll(
  'cfgcn_xiyou_bg.wasm',
  wasm,
);
const module = `client-${hash(glue)}.js`;
writeStable(join(out, wasm), bytes);
writeStable(join(out, gzip), gzipBytes);
writeStable(join(out, module), glue);
writeStable(
  join(out, 'manifest.json'),
  `${JSON.stringify({ protocolVersion: 1, wasm, module, bytes: bytes.byteLength, gzip, gzipBytes: gzipBytes.byteLength, resources: gameResources(root) }, null, 2)}\n`,
);
for (const file of readdirSync(out)) {
  if (
    file !== wasm &&
    file !== gzip &&
    file !== module &&
    /^(?:client-[a-f0-9]{12}\.(?:js|wasm(?:\.gz)?)|cfgcn_xiyou(?:_bg\.wasm|\.js))$/.test(file)
  )
    unlinkSync(join(out, file));
}
console.log(
  `西游 Rust / WASM client built: ${bytes.byteLength} bytes, gzip ${gzipBytes.byteLength} bytes (${wasm}).`,
);
