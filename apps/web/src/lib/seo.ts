import { useEffect } from 'react';

export type SeoMeta = {
  title: string;
  description?: string;
  /** Site-relative path used for the canonical URL. */
  path?: string;
  image?: string;
  noindex?: boolean;
};

const SERVER_PATH = typeof window !== 'undefined' ? window.location.pathname : '/';

/** Keep the origin chosen by the server renderer (SEO_SITE_URL) rather than whatever host served the page. */
const SITE_ORIGIN = (() => {
  if (typeof document === 'undefined') return '';
  const href = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  try {
    return href ? new URL(href).origin : window.location.origin;
  } catch {
    return window.location.origin;
  }
})();

export function clip(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, '')}…`;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string | undefined) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

function absolute(src: string | undefined): string | undefined {
  if (!src) return undefined;
  try {
    return new URL(src, SITE_ORIGIN || window.location.origin).href;
  } catch {
    return undefined;
  }
}

/** Mirrors the server-rendered head so SPA navigation and JS-rendering crawlers see the same tags. */
export function useSeo(meta: SeoMeta | null) {
  const { title, description, path, image, noindex } = meta ?? {};
  useEffect(() => {
    if (!title) return;
    document.title = title;
    const canonical = !noindex && path ? `${SITE_ORIGIN}${path}` : undefined;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1');
    upsertCanonical(canonical);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    if (image) upsertMeta('property', 'og:image', absolute(image));
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    if (window.location.pathname !== SERVER_PATH) {
      document.head.querySelectorAll('script[data-seo="page"]').forEach((node) => node.remove());
    }
  }, [title, description, path, image, noindex]);
}
