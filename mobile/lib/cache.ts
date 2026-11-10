/**
 * Simple in-memory cache with TTL (Time-To-Live) for frequently accessed,
 * rarely-changing clinic data (e.g., Services list, Clinic Doctors, Clinic Info).
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const cacheStore = new Map<string, CacheItem<unknown>>();

// Default cache duration: 10 minutes
const DEFAULT_TTL_MS = 10 * 60 * 1000;

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = cacheStore.get(key);
  const now = Date.now();

  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  const freshData = await fetcher();
  cacheStore.set(key, {
    data: freshData,
    timestamp: now,
  });

  return freshData;
}

export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.startsWith(keyPrefix)) {
      cacheStore.delete(key);
    }
  }
}
