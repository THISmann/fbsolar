/**
 * Builds a static sitemap.xml for Cloudflare Pages (SPA cannot serve dynamic XML).
 * Uses VITE_API_BASE / PUBLIC_SITE_URL when available.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outFile = join(root, 'public', 'sitemap.xml');

const SITE = (process.env.SEO_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://fb-solar.com').replace(/\/+$/, '');
const API = (process.env.VITE_API_BASE || 'https://api.fb-solar.com').replace(/\/+$/, '');

const STATIC = [
  { path: '/', priority: '1.0' },
  { path: '/produits', priority: '0.9' },
  { path: '/projets', priority: '0.8' },
  { path: '/expertises', priority: '0.7' },
  { path: '/a-propos', priority: '0.6' },
  { path: '/contact', priority: '0.8' },
];

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchKind(kind) {
  try {
    const res = await fetch(`${API}/api/catalog/products?kind=${kind}&limit=200`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    console.warn(`[sitemap] Could not load ${kind}:`, error.message);
    return [];
  }
}

const [products, projects] = await Promise.all([fetchKind('PRODUCT'), fetchKind('PROJECT')]);
const now = new Date().toISOString();

const urls = [
  ...STATIC.map((entry) => ({
    loc: `${SITE}${entry.path}`,
    lastmod: now,
    priority: entry.priority,
    images: [],
  })),
  ...products.map((item) => ({
    loc: `${SITE}/produits/${encodeURIComponent(item.slug)}`,
    lastmod: item.updatedAt || now,
    priority: '0.8',
    images: (item.images || []).slice(0, 5).map((src) => ({
      loc: src.startsWith('http') ? src : `${SITE}${src.startsWith('/') ? '' : '/'}${src}`,
      title: item.name,
    })),
  })),
  ...projects.map((item) => ({
    loc: `${SITE}/projets/${encodeURIComponent(item.slug)}`,
    lastmod: item.updatedAt || now,
    priority: '0.7',
    images: (item.images || []).slice(0, 5).map((src) => ({
      loc: src.startsWith('http') ? src : `${SITE}${src.startsWith('/') ? '' : '/'}${src}`,
      title: item.name,
    })),
  })),
];

const body = urls
  .map((entry) => {
    const images = entry.images
      .map(
        (img) =>
          `<image:image><image:loc>${esc(img.loc)}</image:loc><image:title>${esc(img.title)}</image:title></image:image>`,
      )
      .join('');
    return `<url><loc>${esc(entry.loc)}</loc><lastmod>${esc(entry.lastmod)}</lastmod><priority>${entry.priority}</priority>${images}</url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, xml, 'utf8');
console.log(`[sitemap] Wrote ${urls.length} URLs → ${outFile}`);
