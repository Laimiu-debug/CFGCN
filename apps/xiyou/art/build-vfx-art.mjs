import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = `${root}apps/xiyou/art/source/spell-painting-v1.png`;
const out = `${root}apps/website/public/games/xiyou/assets/fx`;
await mkdir(out, { recursive: true });
const meta = await sharp(source).metadata();
const assets = [];
for (const [i, name] of ['lotus', 'staff', 'tide', 'warning'].entries()) {
  const left = Math.round(((i % 2) * meta.width) / 2);
  const top = Math.round((Math.floor(i / 2) * meta.height) / 2);
  const width = Math.round((((i % 2) + 1) * meta.width) / 2) - left;
  const height = Math.round(((Math.floor(i / 2) + 1) * meta.height) / 2) - top;
  const bytes = await sharp(source)
    .extract({ left, top, width, height })
    .resize(256, 256)
    .png({ compressionLevel: 9, palette: true, colours: 192, dither: 0.5 })
    .toBuffer();
  await writeFile(`${out}/${name}.png`, bytes);
  assets.push({
    name,
    bytes: bytes.length,
    width: 256,
    height: 256,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
await writeFile(
  `${out}/manifest.json`,
  `${JSON.stringify(
    {
      origin: 'original-builtin-imagegen',
      source: 'apps/xiyou/art/source/spell-painting-v1.png',
      source_sha256: createHash('sha256')
        .update(await readFile(source))
        .digest('hex'),
      assets,
      geometry:
        'Warning uses a shader-clipped exact gameplay radius; painting is its inner wash only.',
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Painted VFX: ${assets.length} textures, ${assets.reduce((n, a) => n + a.bytes, 0)} bytes.`,
);
