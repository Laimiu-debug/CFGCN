export interface GameResource {
  path: string;
  sha256: string;
  bytes: number;
  group: string;
}
export interface ResourceCacheStats {
  enabled: boolean;
  hits: number;
  misses: number;
  bytesRead: number;
  bytesDownloaded: number;
  corruptions: number;
  writeFailures: number;
  prefetched: number;
}
export interface CacheScope {
  fetch: typeof fetch;
  location: { href: string };
  caches: Pick<CacheStorage, 'open'>;
  navigator?: { connection?: { saveData?: boolean } };
}
export function installAssetCache(
  resources?: readonly GameResource[],
  scope?: CacheScope,
): {
  stats: ResourceCacheStats;
  prepare(paths: readonly string[]): Promise<void>;
  prefetch(): Promise<void>;
};
