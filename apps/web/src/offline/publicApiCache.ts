const PUBLIC_API_CACHE = 'solar-public-api-v1';

/** Paths safe to persist for offline vitrine browsing (GET only, no auth). */
const CACHEABLE_PATH =
  /^\/api\/catalog\/(pages(?:\/[^/?#]+)?|products(?:\/[^/?#]+)?|categories)(?:\?|$)/;

export function isPublicCacheablePath(path: string): boolean {
  const pathname = path.split('?')[0] ?? path;
  if (pathname.includes('/admin/') || pathname.includes('/social')) return false;
  return CACHEABLE_PATH.test(pathname);
}

function cacheAvailable(): boolean {
  return typeof caches !== 'undefined';
}

export async function putPublicApiCache(url: string, response: Response): Promise<void> {
  if (!cacheAvailable() || !response.ok) return;
  try {
    const cache = await caches.open(PUBLIC_API_CACHE);
    await cache.put(url, response.clone());
  } catch {
    /* quota / private mode — ignore */
  }
}

export async function matchPublicApiCache(url: string): Promise<Response | undefined> {
  if (!cacheAvailable()) return undefined;
  try {
    const cache = await caches.open(PUBLIC_API_CACHE);
    const hit = await cache.match(url);
    return hit ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Prefetch core vitrine payloads so first offline session still has content
 * even if the user never opened every page online.
 */
export async function warmPublicCache(apiBase: string): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  const base = apiBase.replace(/\/$/, '');
  const targets = [
    '/api/catalog/pages/home',
    '/api/catalog/pages/about',
    '/api/catalog/pages/expertises',
    '/api/catalog/categories',
    '/api/catalog/products?page=1&limit=24&kind=PRODUCT',
    '/api/catalog/products?page=1&limit=24&kind=PROJECT',
  ];

  await Promise.allSettled(
    targets.map(async (path) => {
      const url = `${base}${path}`;
      try {
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          credentials: 'omit',
        });
        if (res.ok) await putPublicApiCache(url, res);
      } catch {
        /* ignore warm failures */
      }
    }),
  );
}
