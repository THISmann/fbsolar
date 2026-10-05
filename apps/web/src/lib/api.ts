import type { Permission, Role, StaffRole } from './permissions';
import { isPublicCacheablePath, matchPublicApiCache, putPublicApiCache } from '../offline/publicApiCache';
export type { Permission, Role, StaffRole } from './permissions';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || 'http://localhost';

/** Stable public URL for a media file id (served by Traefik → service-media). */
export function mediaFileUrl(id: string): string {
  return `${API_BASE}/api/media/file/${encodeURIComponent(id)}`;
}

/**
 * Prefer the API-relative public URL when the backend returned a localhost/minio URL
 * that the browser cannot load from the Vite origin.
 */
export function resolveMediaDisplayUrl(raw: string | undefined | null, id?: string): string {
  if (id && (!raw || /localhost:9000|\/\/minio(?::|\/)/i.test(raw))) {
    return mediaFileUrl(id);
  }
  if (!raw) return '';
  try {
    const u = new URL(raw);
    // Rewrite accidental MinIO port / host to the Traefik public path when path looks like our file route.
    if ((u.port === '9000' || u.hostname === 'minio') && /\/api\/media\/file\//.test(u.pathname)) {
      const fileId = u.pathname.split('/').pop();
      if (fileId) return mediaFileUrl(fileId);
    }
    if (u.pathname.includes('/api/media/file/')) {
      const fileId = u.pathname.split('/').pop();
      if (fileId) return mediaFileUrl(fileId);
    }
  } catch {
    /* keep raw */
  }
  return raw;
}

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  jobTitle?: string | null;
  active?: boolean;
  permissions?: Permission[];
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

export type StaffUser = {
  id: string;
  email: string;
  role: StaffRole;
  jobTitle?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  actorId?: string | null;
  actorEmail: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: string;
};

export type AdminSession = {
  id: string;
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  loginAt: string;
  lastSeenAt: string;
  logoutAt?: string | null;
  user?: { id: string; email: string; role: StaffRole; jobTitle?: string | null };
};

export type ProductKind = 'PRODUCT' | 'PROJECT';

export type SocialNetwork = 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN';
export type SocialPublishStatus = 'PENDING' | 'PUBLISHED' | 'FAILED';

export type SocialPublication = {
  id: string;
  productId: string;
  network: SocialNetwork;
  status: SocialPublishStatus;
  externalPostId?: string | null;
  postUrl?: string | null;
  error?: string | null;
  requestedBy?: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export type SocialOverview = {
  networks: Array<{
    id: SocialNetwork;
    label: string;
    enabled: boolean;
    configured: boolean;
  }>;
  items: Array<{
    product: {
      id: string;
      name: string;
      slug: string;
      images: string[];
      published: boolean;
      updatedAt: string;
    };
    publications: Record<SocialNetwork, SocialPublication | null>;
  }>;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number | string;
  images: string[];
  published: boolean;
  kind?: ProductKind;
  categoryId?: string;
  category?: { id: string; name: string; slug: string };
};

export type Article = {
  id: string;
  slug: string;
  title: string;
  content: string;
  tags: string[];
  published: boolean;
};

export type ProductsResponse = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
};

export type ContactPayload = {
  name: string;
  email: string;
  phone?: string;
  message: string;
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  readAt?: string | null;
  createdAt: string;
};

export type ContactsResponse = {
  items: ContactMessage[];
  total: number;
  unread: number;
  page: number;
  limit: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type SitePage = {
  key: string;
  title: string;
  data: Record<string, unknown>;
  updatedAt?: string;
};

export type VisitStats = {
  days: number;
  totalViews: number;
  uniqueVisitors: number;
  byPath: Array<{ path: string; count: number }>;
  byDay: Array<{ date: string; count: number }>;
};

export type ProductInput = {
  slug: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  images: string[];
  published: boolean;
  kind: ProductKind;
};

type TokenGetter = () => string | null;
type TokenRefresher = () => Promise<string | null>;

let getAccessToken: TokenGetter = () => null;
let refreshAccessToken: TokenRefresher = async () => null;

export function bindAuthTokenHandlers(getter: TokenGetter, refresher: TokenRefresher) {
  getAccessToken = getter;
  refreshAccessToken = refresher;
}

/** Current access JWT if the admin session is active (for Socket.IO auth). */
export function peekAccessToken(): string | null {
  return getAccessToken();
}

async function parseError(response: Response): Promise<string> {
  let message = `Erreur ${response.status}`;
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) message = body.message.join(', ');
    else if (body.message) message = body.message;
  } catch {
    /* ignore */
  }
  return message;
}

async function request<T>(
  path: string,
  init?: RequestInit & { auth?: boolean; retry?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init?.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (init?.auth !== false) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const method = (init?.method ?? 'GET').toUpperCase();
  const cacheable = init?.auth === false && method === 'GET' && isPublicCacheablePath(path);
  const url = `${API_BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    if (cacheable) {
      const cached = await matchPublicApiCache(url);
      if (cached) {
        if (cached.status === 204) return undefined as T;
        return cached.json() as Promise<T>;
      }
    }
    throw error;
  }

  if (response.status === 401 && init?.auth !== false && init?.retry !== false) {
    const next = await refreshAccessToken();
    if (next) {
      return request<T>(path, { ...init, retry: false });
    }
  }

  if (!response.ok) {
    if (cacheable) {
      const cached = await matchPublicApiCache(url);
      if (cached?.ok) {
        if (cached.status === 204) return undefined as T;
        return cached.json() as Promise<T>;
      }
    }
    throw new Error(await parseError(response));
  }

  if (cacheable) {
    void putPublicApiCache(url, response);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function qs(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  const raw = query.toString();
  return raw ? `?${raw}` : '';
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthTokens>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    }),
  refresh: (refreshToken: string) =>
    request<AuthTokens>('/api/auth/refresh', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ refreshToken }),
    }),
  logout: (refreshToken: string) =>
    request<unknown>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined),
  me: () => request<AuthUser>('/api/auth/me'),

  listStaff: () => request<StaffUser[]>('/api/auth/admin/users'),
  createStaff: (payload: {
    email: string;
    password: string;
    role: StaffRole;
    jobTitle?: string;
  }) =>
    request<AuthUser>('/api/auth/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateStaff: (
    id: string,
    payload: { role?: StaffRole; jobTitle?: string; active?: boolean; password?: string },
  ) =>
    request<AuthUser>(`/api/auth/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  disableStaff: (id: string) =>
    request<AuthUser>(`/api/auth/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listAudit: (page = 1, limit = 50) =>
    request<{ items: AuditLog[]; total: number; page: number; limit: number }>(
      `/api/auth/admin/audit${qs({ page, limit })}`,
    ),
  listSessions: (page = 1, limit = 50) =>
    request<{ items: AdminSession[]; total: number; page: number; limit: number }>(
      `/api/auth/admin/sessions${qs({ page, limit })}`,
    ),

  categories: () => request<Category[]>('/api/catalog/categories', { auth: false }),
  products: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    kind?: ProductKind;
  }) =>
    request<ProductsResponse>(
      `/api/catalog/products${qs({
        page: params?.page,
        limit: params?.limit,
        search: params?.search,
        category: params?.category,
        kind: params?.kind,
      })}`,
      { auth: false },
    ),
  product: (slug: string) =>
    request<Product>(`/api/catalog/products/${encodeURIComponent(slug)}`, { auth: false }),
  adminProducts: (params?: { page?: number; limit?: number; search?: string; kind?: ProductKind }) =>
    request<ProductsResponse>(
      `/api/catalog/products/admin/all${qs({
        page: params?.page,
        limit: params?.limit,
        search: params?.search,
        kind: params?.kind,
        includeDrafts: 'true',
      })}`,
    ),
  adminProduct: (id: string) => request<Product>(`/api/catalog/products/admin/id/${encodeURIComponent(id)}`),
  createProduct: (payload: ProductInput) =>
    request<Product>('/api/catalog/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id: string, payload: Partial<ProductInput>) =>
    request<Product>(`/api/catalog/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteProduct: (id: string) =>
    request<{ success: boolean }>(`/api/catalog/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  socialStatus: (productId: string) =>
    request<{ productId: string; items: SocialPublication[] }>(
      `/api/catalog/products/${encodeURIComponent(productId)}/social`,
    ),
  socialOverview: () => request<SocialOverview>('/api/catalog/products/social/overview'),
  publishSocial: (productId: string, payload: { networks: SocialNetwork[]; force?: boolean }) =>
    request<{ accepted: boolean; items: SocialPublication[] }>(
      `/api/catalog/products/${encodeURIComponent(productId)}/social/publish`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  page: (key: string) => request<SitePage>(`/api/catalog/pages/${encodeURIComponent(key)}`, { auth: false }),
  pages: () => request<SitePage[]>('/api/catalog/pages', { auth: false }),
  savePage: (key: string, payload: { title: string; data: Record<string, unknown> }) =>
    request<SitePage>(`/api/catalog/pages/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  contact: (payload: ContactPayload) =>
    request<unknown>('/api/interaction/contact', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(payload),
    }),
  contacts: (page = 1, limit = 20) =>
    request<ContactsResponse>(`/api/interaction/contact${qs({ page, limit })}`),
  contactOne: (id: string) => request<ContactMessage>(`/api/interaction/contact/${encodeURIComponent(id)}`),
  markContactRead: (id: string) =>
    request<ContactMessage>(`/api/interaction/contact/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  deleteContact: (id: string) =>
    request<{ success: boolean }>(`/api/interaction/contact/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  trackVisit: (payload: { path: string; referrer?: string; visitorId?: string }) =>
    request<unknown>('/api/interaction/visits', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(payload),
    }).catch(() => undefined),
  visitStats: (days = 30) => request<VisitStats>(`/api/interaction/visits/stats${qs({ days })}`),

  uploadMedia: async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ id: string; url: string; originalName?: string; mimeType?: string }>('/api/media/upload', {
      method: 'POST',
      body,
    });
  },
  mediaUrl: (id: string) =>
    request<{ id: string; url: string; publicUrl?: string; expiresIn: number }>(
      `/api/media/${encodeURIComponent(id)}`,
    ),
};

export const fallbackImages = [
  'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1497440001374-f26997328c1b?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1611365892117-00ac5ef43c90?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1600&q=80',
];

export function productImage(product: Product, index = 0, revision?: number | string): string {
  const base = product.images?.length
    ? product.images[index % product.images.length]
    : fallbackImages[index % fallbackImages.length];
  return withCacheBust(base, revision);
}

/** Bust browser/CDN cache after realtime content updates (same URL, new bytes). */
export function withCacheBust(url: string, revision?: number | string | null): string {
  if (revision === undefined || revision === null || revision === '' || revision === 0) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}r=${encodeURIComponent(String(revision))}`;
}

/** Strip control chars / trim — defense in depth before sending to API */
export function sanitizeText(value: string, max = 5000): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

export function isSafeHttpUrl(value: string): boolean {
  // Root-relative paths (e.g. /products/x.jpg) are served by the site itself.
  if (/^\/(?![/\\])/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
