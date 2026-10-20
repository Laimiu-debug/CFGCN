/** Runtime sprites from our original, transparent gongbi painting atlas. */
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = `${root}apps/xiyou/art/source/skill-painting-v1.png`;
const out = `${root}apps/website/public/games/xiyou/ui/skills`;
await mkdir(out, { recursive: true });
const metadata = await sharp(source).metadata();
const names = [
  'sutra',
  'kasaya',
  'lotus',
  'lamp',
  'staff',
  'binding',
  'clones',
  'eye',
  'hooves',
  'surge',
  'scales',
  'spring',
  'sutra-staff',
  'three-companions',
  'staff-tide',
  'lotus-spring',
];
const assets = [];
for (const [i, name] of names.entries()) {
  const x = Math.round(((i % 4) * metadata.width) / 4);
  const y = Math.round((Math.floor(i / 4) * metadata.height) / 4);
  const right = Math.round((((i % 4) + 1) * metadata.width) / 4);
  const bottom = Math.round(((Math.floor(i / 4) + 1) * metadata.height) / 4);
  const bytes = await sharp(source)
    .extract({ left: x, top: y, width: right - x, height: bottom - y })
    .resize(192, 192, { fit: 'contain' })
    .webp({ quality: 85, alphaQuality: 92, effort: 6 })
    .toBuffer();
  await writeFile(`${out}/${name}.webp`, bytes);
  assets.push({
    name,
    bytes: bytes.length,
    width: 192,
    height: 192,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
await writeFile(
  `${out}/manifest.json`,
  `${JSON.stringify(
    {
      origin: 'original-builtin-imagegen',
      source: 'apps/xiyou/art/source/skill-painting-v1.png',
      source_sha256: createHash('sha256')
        .update(await readFile(source))
        .digest('hex'),
      prompt: 'apps/xiyou/art/skill-painting.json',
      assets,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Painted skills: ${assets.length} sprites, ${assets.reduce((n, a) => n + a.bytes, 0)} bytes.`,
);
