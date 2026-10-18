import { createServer } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { handleRequest } from './app.mjs';

const server = createServer(handleRequest);
let base;
beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});
it('serves a real health response and rejects unsupported operations', async () => {
  const health = await fetch(`${base}/api/health`);
  expect(health.status).toBe(200);
  expect(await health.json()).toMatchObject({ status: 'ok', service: 'cfgcn-api' });
  expect(health.headers.get('x-content-type-options')).toBe('nosniff');
  expect((await fetch(`${base}/api/health`, { method: 'POST' })).status).toBe(405);
  expect((await fetch(`${base}/api/auth/login`, { method: 'POST' })).status).toBe(404);
});
