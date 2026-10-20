import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const art = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(art, '../../../..');
const lib = path.join(root, 'node_modules/three');
const files = {
  '/': path.join(art, 'preview.html'),
  '/theme.css': path.join(root, 'packages/ui/src/tokens.css'),
  '/director.mjs': path.join(art, 'director.mjs'),
  '/catalog.json': path.join(art, 'manifest.json'),
};
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = files[pathname];
      if (!file) {
        const prefix = pathname.startsWith('/assets/')
          ? '/assets/'
          : pathname.startsWith('/lib/')
            ? '/lib/'
            : null;
        if (!prefix) throw Error('not found');
        const base = prefix === '/assets/' ? art : lib;
        file = path.resolve(base, pathname.slice(prefix.length));
        if (!file.startsWith(base + path.sep)) throw Error('outside root');
      }
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  })
  .listen(8883, '127.0.0.1', () => console.log('Shadow action library http://127.0.0.1:8883/'));
