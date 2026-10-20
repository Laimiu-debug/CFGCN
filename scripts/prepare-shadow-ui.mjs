import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const source = new URL('../apps/xiyou/art/shadow-ui-v6/', import.meta.url);
const output = new URL('../apps/website/public/games/xiyou/ui/v6/', import.meta.url);
const fx = new URL('../apps/website/public/games/xiyou/assets/fx/', import.meta.url);
await mkdir(output, { recursive: true });
await mkdir(fx, { recursive: true });
const prompts = JSON.parse(await readFile(new URL('prompts.json', source), 'utf8'));
const manifest = [];
for (const { id } of prompts.entries) {
  const original = await readFile(new URL(id + '-original.png', source));
  const metadata = await sharp(original).metadata();
  const webp = await sharp(original)
    .resize(320, 320, { fit: 'inside' })
    .webp({ quality: 84 })
    .toBuffer();
  await writeFile(new URL(id + '.webp', output), webp);
  manifest.push({
    id,
    original: id + '-original.png',
    width: metadata.width,
    height: metadata.height,
    alpha: metadata.hasAlpha,
    source_sha256: createHash('sha256').update(original).digest('hex'),
    runtime_sha256: createHash('sha256').update(webp).digest('hex'),
    runtime_bytes: webp.length,
  });
  if (id === 'xiaobailong') {
    const png = await sharp(original)
      .resize(384, 384, { fit: 'inside' })
      .png({ palette: true, quality: 90 })
      .toBuffer();
    await writeFile(new URL('ultimate-dragon.png', fx), png);
  }
}
await writeFile(
  new URL('manifest.json', source),
  JSON.stringify(
    {
      created: '2026-10-20',
      generator: 'Built-in image_gen',
      transformations: 'Resize and encode only; no repainting',
      entries: manifest,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Prepared five dedicated ultimate illustrations; ' +
    manifest.reduce((n, e) => n + e.runtime_bytes, 0) +
    ' UI bytes.',
);
