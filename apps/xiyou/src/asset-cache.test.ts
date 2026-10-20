import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  installAssetCache,
  type CacheScope,
  type GameResource,
} from '../../website/public/games/xiyou/asset-cache.js';

const origin = 'http://localhost/games/xiyou/';
const resource = (text: string, path = 'wolf.glb', group = 'core'): GameResource => ({
  path,
  group,
  bytes: Buffer.byteLength(text),
  sha256: createHash('sha256').update(text).digest('hex'),
});
function fixture(text = 'version one') {
  const saved = new Map<string, Response>();
  const key = (input: RequestInfo | URL) =>
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const store = {
    match: vi.fn(async (input: RequestInfo | URL) => saved.get(key(input))?.clone()),
    put: vi.fn(async (input: RequestInfo | URL, result: Response) => {
      saved.set(key(input), result.clone());
    }),
    delete: vi.fn(async (input: RequestInfo | URL) => saved.delete(key(input))),
    keys: async () => [...saved.keys()].map((k) => new Request(k)),
  };
  const fetcher = vi.fn<typeof fetch>(async () => new Response(text));
  const scope: CacheScope = {
    fetch: fetcher,
    location: { href: `${origin}index.html` },
    caches: { open: async () => store as unknown as Cache },
  };
  const entry = resource(text);
  const url = `${origin}assets/${entry.path}`;
  return { scope, store, saved, fetcher, entry, url, key: `${url}?cfgcn-v=${entry.sha256}` };
}
describe('persistent content-addressed game resources', () => {
  it('stages validated disk bytes before renderer startup without downloading cache misses', async () => {
    const f = fixture();
    const cold = installAssetCache([f.entry], f.scope);
    await cold.prepare([f.entry.path]);
    expect(f.fetcher).not.toHaveBeenCalled();
    await f.scope.fetch(f.url);
    const offline = vi.fn<typeof fetch>(async () => {
      throw Error('offline');
    });
    f.scope.fetch = offline;
    const warm = installAssetCache([f.entry], f.scope);
    await warm.prepare([f.entry.path]);
    f.store.match.mockRejectedValue(Error('disk temporarily busy during GPU initialization'));
    expect(await (await f.scope.fetch(f.url)).text()).toBe('version one');
    expect(offline).not.toHaveBeenCalled();
    expect(warm.stats.hits).toBe(1);
  });
  it('persists the terrain JPEG and reads it without a second download', async () => {
    const f = fixture('terrain atlas bytes');
    const terrain = resource('terrain atlas bytes', 'terrain-atlas.jpg', 'expedition');
    const url = `${origin}assets/${terrain.path}`;
    const first = installAssetCache([terrain], f.scope);
    await f.scope.fetch(url);
    expect(first.stats.bytesDownloaded).toBe(terrain.bytes);
    const offline = vi.fn<typeof fetch>(async () => {
      throw Error('offline');
    });
    f.scope.fetch = offline;
    const second = installAssetCache([terrain], f.scope);
    expect(await (await f.scope.fetch(url)).text()).toBe('terrain atlas bytes');
    expect(offline).not.toHaveBeenCalled();
    expect(second.stats.hits).toBe(1);
  });
  it('uses ordinary downloads on an insecure host without Web Crypto', async () => {
    const f = fixture();
    vi.stubGlobal('crypto', undefined);
    try {
      const cache = installAssetCache([f.entry], f.scope);
      expect(f.scope.fetch).toBe(f.fetcher);
      expect(await (await f.scope.fetch(f.url)).text()).toBe('version one');
      expect(cache.stats.enabled).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('shares a request and reuses the downloaded bytes in another session without network', async () => {
    const f = fixture();
    const first = installAssetCache([f.entry], f.scope);
    const results = await Promise.all([f.scope.fetch(f.url), f.scope.fetch(f.url)]);
    expect(await results[0].text()).toBe('version one');
    expect(await results[1].text()).toBe('version one');
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    const offline = vi.fn<typeof fetch>(async () => {
      throw Error('offline');
    });
    f.scope.fetch = offline;
    const second = installAssetCache([f.entry], f.scope);
    expect(await (await f.scope.fetch(f.url)).text()).toBe('version one');
    expect(offline).not.toHaveBeenCalled();
    expect(second.stats.hits).toBe(1);
    expect(first.stats.misses).toBe(1);
  });
  it('changes content at the same path safely and repairs corrupted cached bytes', async () => {
    const f = fixture();
    installAssetCache([f.entry], f.scope);
    await f.scope.fetch(f.url);
    const updated = resource('version two');
    f.scope.fetch = vi.fn<typeof fetch>(async () => new Response('version two'));
    const next = installAssetCache([updated], f.scope);
    expect(await (await f.scope.fetch(f.url)).text()).toBe('version two');
    expect(next.stats.hits).toBe(0);
    f.saved.set(`${f.url}?cfgcn-v=${updated.sha256}`, new Response('corrupted!!'));
    expect(await (await f.scope.fetch(f.url)).text()).toBe('version two');
    expect(next.stats.corruptions).toBe(1);
    expect(f.saved.size).toBe(2);
  });
  it('remains playable when cache access or quota is denied', async () => {
    const f = fixture();
    f.store.put.mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
    const cache = installAssetCache([f.entry], f.scope);
    expect(await (await f.scope.fetch(f.url)).text()).toBe('version one');
    expect(await (await f.scope.fetch(f.url)).text()).toBe('version one');
    expect(cache.stats.writeFailures).toBe(1);
    f.scope.fetch = f.fetcher;
    f.scope.caches.open = async () => {
      throw Error('disabled');
    };
    installAssetCache([f.entry], f.scope);
    expect(await (await f.scope.fetch(f.url)).text()).toBe('version one');
  });
  it('does not persist bytes from a mismatched release', async () => {
    const f = fixture();
    f.scope.fetch = vi.fn<typeof fetch>(async () => new Response('bad version'));
    installAssetCache([f.entry], f.scope);
    await expect(f.scope.fetch(f.url)).rejects.toThrow('INVALID_RESOURCE');
    expect(f.saved.size).toBe(0);
  });
  it('one cancelled consumer does not abort another and does not intercept unrelated requests', async () => {
    const f = fixture();
    const controller = new AbortController();
    installAssetCache([f.entry], f.scope);
    const one = f.scope.fetch(f.url, { signal: controller.signal });
    const two = f.scope.fetch(f.url);
    controller.abort();
    await expect(one).rejects.toMatchObject({ name: 'AbortError' });
    expect(await (await two).text()).toBe('version one');
    await f.scope.fetch('http://localhost/other/assets/wolf.glb');
    expect(f.fetcher).toHaveBeenCalledTimes(2);
  });
  it('only prefetches the next region and respects data saver', async () => {
    const f = fixture();
    const next = resource('version one', 'river_scene.glb', 'river');
    const cache = installAssetCache([f.entry, next], f.scope);
    await cache.prefetch();
    expect(cache.stats.prefetched).toBe(1);
    expect(f.fetcher.mock.calls[0][0]).toContain('river_scene.glb');
    f.scope.fetch = f.fetcher;
    f.scope.navigator = { connection: { saveData: true } };
    const saved = installAssetCache([next], f.scope);
    await saved.prefetch();
    expect(saved.stats.prefetched).toBe(0);
  });
});
