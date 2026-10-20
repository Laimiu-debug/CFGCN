// Content-addressed game resources. This iframe alone owns the fetch wrapper;
// game saves and the other three worlds are independent of this optional cache.
const CACHE = 'cfgcn:xiyou:assets:v1';
const LIMIT = 48_000_000;
const deadline = (promise, ms = 400) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('CACHE_TIMEOUT')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
};
const digest = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export function installAssetCache(resources, scope = globalThis) {
  const network = scope.fetch.bind(scope);
  const stats = {
    enabled: false,
    hits: 0,
    misses: 0,
    bytesRead: 0,
    bytesDownloaded: 0,
    corruptions: 0,
    writeFailures: 0,
    prefetched: 0,
  };
  if (!globalThis.crypto?.subtle)
    return { stats, prefetch: async () => {}, prepare: async () => {} };
  const base = new URL('./assets/', scope.location.href);
  const entries = new Map();
  for (const entry of Array.isArray(resources) ? resources : []) {
    if (!entry || typeof entry !== 'object') continue;
    if (
      !/^[a-z0-9_/-]+\.(glb|png|jpg|wesl)$/.test(entry.path) ||
      entry.path.includes('..') ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes <= 0 ||
      entry.bytes > 5_000_000
    )
      continue;
    const url = new URL(entry.path, base);
    if (!url.href.startsWith(base.href)) continue;
    entries.set(url.href, { ...entry, url: url.href, key: `${url.href}?cfgcn-v=${entry.sha256}` });
  }
  let writable = true;
  const cache = Promise.resolve()
    .then(() => scope.caches.open(CACHE))
    .then((c) => {
      stats.enabled = true;
      return c;
    })
    .catch(() => null);
  const inFlight = new Map();
  const prepared = new Map();
  const valid = async (bytes, entry) =>
    bytes.byteLength === entry.bytes && (await digest(bytes)) === entry.sha256;
  const response = (bytes, headers) => {
    const clean = new Headers(headers);
    clean.delete('content-encoding');
    clean.delete('transfer-encoding');
    clean.set('content-length', String(bytes.byteLength));
    return new Response(bytes.slice(0), { status: 200, headers: clean });
  };
  const load = async (entry, request, init) => {
    const staged = prepared.get(entry.key);
    if (staged) {
      prepared.delete(entry.key);
      stats.hits++;
      stats.bytesRead += staged.bytes.byteLength;
      return response(staged.bytes, staged.headers);
    }
    let store;
    try {
      store = await deadline(cache);
      if (store) {
        const cached = await deadline(store.match(entry.key));
        if (cached) {
          const bytes = await cached.arrayBuffer();
          if (await valid(bytes, entry)) {
            stats.hits++;
            stats.bytesRead += bytes.byteLength;
            return response(bytes, cached.headers);
          }
          stats.corruptions++;
          void store.delete(entry.key).catch(() => {});
        }
      }
    } catch {
      /* A slow/unavailable cache must not prevent play. */
    }
    stats.misses++;
    // Revalidate stable asset paths on a miss; a new build cannot silently read
    // yesterday's GLB from HTTP cache. The manifest binds bytes to this build.
    const fetched = await network(request, {
      ...init,
      cache: 'no-cache',
      signal: AbortSignal.timeout(60000),
    });
    if (!fetched.ok) return fetched;
    const bytes = await fetched.arrayBuffer();
    if (!(await valid(bytes, entry))) throw Error(`INVALID_RESOURCE_${entry.path}`);
    stats.bytesDownloaded += bytes.byteLength;
    const result = response(bytes, fetched.headers);
    if (store && writable) {
      void store.put(entry.key, result.clone()).catch(() => {
        stats.writeFailures++;
        writable = false;
      });
    }
    return result;
  };
  scope.fetch = async (request, init) => {
    let url;
    try {
      url = new URL(
        typeof request === 'string' || request instanceof URL ? request : request.url,
        scope.location.href,
      );
    } catch {
      return network(request, init);
    }
    const entry = entries.get(url.href);
    const method = init?.method ?? request?.method ?? 'GET';
    const headers = new Headers(init?.headers ?? request?.headers);
    if (!entry || method.toUpperCase() !== 'GET' || headers.has('range'))
      return network(request, init);
    const signal = init?.signal ?? request?.signal;
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    // The shared fetch has its own timeout. One cancelled scene must not cancel
    // another scene loading the same mesh/animation root.
    let pending = inFlight.get(entry.key);
    if (!pending) {
      pending = load(entry, request, init).finally(() => inFlight.delete(entry.key));
      inFlight.set(entry.key, pending);
    }
    const result = await pending;
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    return result.clone();
  };
  // Keep current content plus the most recently used older entries under a
  // modest budget. Only this cache is ever pruned; local saves are untouched.
  const prune = async () => {
    try {
      const store = await deadline(cache);
      if (!store) return;
      const keys = await store.keys();
      const current = new Set([...entries.values()].map((e) => e.key));
      let bytes = 0;
      for (const key of keys.reverse()) {
        const item = await store.match(key);
        const length = Number(item?.headers.get('content-length')) || 0;
        if (bytes + length > LIMIT && !current.has(key.url)) await store.delete(key);
        else bytes += length;
      }
    } catch {
      /* Storage is best-effort. */
    }
  };
  let warming;
  let preparing;
  return {
    stats,
    // Read only already-cached launch content while WASM is downloading or
    // compiling. Bevy's synchronous GPU initialization can block callbacks for
    // longer than the ordinary cache timeout on a slow CPU; these bytes must
    // not be misclassified as a missing cache entry and downloaded again.
    // No cache miss starts a network request, and the staging set is bounded.
    prepare: (paths) =>
      (preparing ??= (async () => {
        try {
          const store = await deadline(cache);
          if (!store) return;
          const requested = new Set(Array.isArray(paths) ? paths : []);
          let budget = 0;
          const targets = [...entries.values()].filter((entry) => {
            if (!requested.has(entry.path) || budget + entry.bytes > 1_500_000) return false;
            budget += entry.bytes;
            return true;
          });
          await Promise.all(
            targets.map(async (entry) => {
              try {
                const cached = await deadline(store.match(entry.key));
                if (!cached) return;
                const bytes = await cached.arrayBuffer();
                if (await valid(bytes, entry))
                  prepared.set(entry.key, { bytes, headers: cached.headers });
              } catch {
                /* Demand loading retains its normal fallback. */
              }
            }),
          );
          void prune();
        } catch {
          /* An unavailable disk cache never prevents startup. */
        }
      })()),
    prefetch: () =>
      (warming ??= (async () => {
        // Start after play is ready. Sequential requests leave bandwidth for
        // actual player navigation; these bytes do not create GPU resources.
        for (const entry of entries.values()) {
          if (entry.group !== 'river' || scope.navigator?.connection?.saveData) continue;
          try {
            await scope.fetch(entry.url, { priority: 'low' });
            stats.prefetched++;
          } catch {
            /* Demand loading can retry later. */
          }
        }
        await prune();
      })()),
  };
}
