import { readFile, mkdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const manifestPath = process.argv[2];
if (!manifestPath)
  throw new Error('Usage: node scripts/prepare-art.mjs <private-source-manifest.json>');
const sources = JSON.parse(await readFile(manifestPath, 'utf8'));
const destination = path.resolve('apps/website/public/art');
const originals = path.resolve('.local/art-originals');
await mkdir(destination, { recursive: true });
await mkdir(originals, { recursive: true });
for (const id of ['xiyou', 'shuihu', 'sanguo', 'honglou']) {
  if (!sources[id]) throw new Error(`Missing source: ${id}`);
  await copyFile(sources[id], path.join(originals, `${id}.png`));
  const full = path.join(destination, `${id}.webp`);
  const card = path.join(destination, `${id}-card.webp`);
  await sharp(sources[id]).webp({ quality: 84, effort: 6 }).toFile(full);
  await sharp(sources[id])
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 81, effort: 6 })
    .toFile(card);
  const metadata = await sharp(full).metadata();
  console.log(
    JSON.stringify({
      asset: id,
      width: metadata.width,
      height: metadata.height,
      fullBytes: (await stat(full)).size,
      cardBytes: (await stat(card)).size,
    }),
  );
}
