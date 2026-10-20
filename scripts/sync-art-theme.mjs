import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rustPalette } from './art-theme.mjs';
const source = fileURLToPath(new URL('../packages/ui/src/tokens.css', import.meta.url));
const target = fileURLToPath(
  new URL('../apps/website/public/games/xiyou/series.css', import.meta.url),
);
const bytes = readFileSync(source);
if (!existsSync(target) || !bytes.equals(readFileSync(target))) writeFileSync(target, bytes);
const rustTarget = fileURLToPath(new URL('../apps/xiyou/rust/src/palette.rs', import.meta.url));
const rust = Buffer.from(rustPalette(bytes.toString('utf8')));
if (!existsSync(rustTarget) || !rust.equals(readFileSync(rustTarget)))
  writeFileSync(rustTarget, rust);
