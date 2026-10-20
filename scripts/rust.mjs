import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
const command = windows ? 'powershell.exe' : 'cargo';
const args = windows
  ? [
      '-NoProfile',
      '-File',
      fileURLToPath(new URL('./rust.ps1', import.meta.url)),
      ...process.argv.slice(2),
    ]
  : process.argv.slice(2);
const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
