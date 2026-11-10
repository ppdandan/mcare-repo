/**
 * Simple in-memory cache for Next.js client-side requests
 * to avoid refetching static clinic services, doctors, and specialties.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryStore = new Map<string, CacheEntry<unknown>>();

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 10 * 60 * 1000 // 10 minutes default
): Promise<T> {
  const cached = memoryStore.get(key);
  const now = Date.now();

  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  const fresh = await fetcher();
  memoryStore.set(key, { data: fresh, timestamp: now });
  return fresh;
}

export function invalidateWebCache(prefix?: string): void {
  if (!prefix) {
    memoryStore.clear();
    return;
  }
  for (const k of memoryStore.keys()) {
    if (k.startsWith(prefix)) {
      memoryStore.delete(k);
    }
  }
}
