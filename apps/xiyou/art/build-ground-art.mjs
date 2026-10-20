import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('source/ground-painting-v1.png', import.meta.url));
const target = fileURLToPath(new URL('source/ground-runtime.jpg', import.meta.url));
await sharp(source).resize(512, 512).jpeg({ quality: 82 }).toFile(target);
const atlas = fileURLToPath(new URL('source/terrain-atlas-v2.png', import.meta.url));
const runtimeAtlas = fileURLToPath(new URL('source/terrain-atlas-runtime.jpg', import.meta.url));
await sharp(atlas).resize(768, 768).jpeg({ quality: 84 }).toFile(runtimeAtlas);
