import { Controller, Get, Headers, Injectable, Logger, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from './catalog';

type HeaderBag = Record<string, string | string[] | undefined>;

type SeoProduct = {
  slug: string;
  name: string;
  description: string;
  price: { toString(): string };
  images: string[];
  kind: string;
  updatedAt: Date;
  category: { name: string; slug: string } | null;
};

type PageMeta = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'product' | 'article';
  noindex?: boolean;
  jsonLd?: Record<string, unknown>[];
};

type Rendered = { status: number; meta: PageMeta; body: string; location?: string };

type SpecGroup = { title?: string; rows: Array<[string, string]> };
type ProductSection = { title: string; paragraphs: string[]; items: string[]; specs: SpecGroup[] };

const HEAD_START = '<!--seo:head-->';
const HEAD_END = '<!--/seo:head-->';
const BODY_MARK = '<!--seo:body-->';
const TEMPLATE_TTL_MS = 5_000;

const CATALOG_ORDER = ['panneaux-solaires', 'batteries', 'onduleurs', 'accessoires-outils', 'solar-kits'];

// Wording mirrors the "seo" keys of apps/web/src/i18n/locales/fr.json so crawlers and the SPA agree.
const TEXT = {
  homeTitle: 'FB Solar Power Ltd | Panneaux solaires, batteries et onduleurs',
  homeDescription:
    'Installateur photovoltaïque : étude, fourniture et pose de panneaux solaires, batteries lithium, onduleurs hybrides et kits solaires. Devis gratuit.',
  productsTitle: 'Produits solaires : batteries lithium, onduleurs et kits | FB Solar Power Ltd',
  productsDescription:
    'Catalogue FB Solar Power Ltd : batteries lithium LiFePO4, onduleurs hybrides et off-grid, kits solaires et panneaux. Fiches techniques complètes, devis sur demande.',
  projectsTitle: 'Réalisations photovoltaïques | FB Solar Power Ltd',
  projectsDescription:
    'Installations solaires résidentielles, tertiaires et agricoles réalisées par FB Solar Power Ltd : étude, pose et suivi de performance.',
  aboutTitle: 'À propos | FB Solar Power Ltd',
  expertisesTitle: 'Expertises : étude, pose et suivi solaire | FB Solar Power Ltd',
  contactTitle: 'Contact et devis solaire gratuit | FB Solar Power Ltd',
  contactDescription:
    'Contactez FB Solar Power Ltd pour une étude ou un devis d’installation solaire : panneaux, batteries, onduleurs. Réponse rapide par téléphone, e-mail ou WhatsApp.',
  notFoundTitle: 'Page introuvable | FB Solar Power Ltd',
  adminTitle: 'Administration | FB Solar Power Ltd',
};

const NAV: Array<[string, string]> = [
  ['/', 'Accueil'],
  ['/projets', 'Projets'],
  ['/produits', 'Produits'],
  ['/a-propos', 'À propos'],
  ['/expertises', 'Expertises'],
  ['/contact', 'Contact'],
];

function env(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function business() {
  return {
    name: env('SEO_BUSINESS_NAME', 'FB Solar Power Ltd'),
    slogan: 'Solar is the Solution',
    phone: env('SEO_BUSINESS_PHONE', '+33 1 23 45 67 89'),
    email: env('SEO_BUSINESS_EMAIL', 'contact@fbsolar.local'),
    street: env('SEO_BUSINESS_STREET', '12 avenue du Soleil'),
    postalCode: env('SEO_BUSINESS_POSTAL_CODE', '69003'),
    city: env('SEO_BUSINESS_CITY', 'Lyon'),
    country: env('SEO_BUSINESS_COUNTRY', 'FR'),
    currency: env('SEO_CURRENCY', 'XOF'),
    sameAs: env('SEO_SAME_AS', '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//.test(s)),
  };
}

function header(headers: HeaderBag, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Canonical origin: explicit config first, otherwise the host the visitor used. */
export function resolveSiteUrl(headers: HeaderBag): string {
  const explicit = process.env.SEO_SITE_URL || process.env.PUBLIC_SITE_URL || '';
  if (explicit && !/\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(explicit)) return explicit.replace(/\/+$/, '');
  const host = header(headers, 'x-forwarded-host') ?? header(headers, 'host');
  const proto = header(headers, 'x-forwarded-proto') === 'https' ? 'https' : 'http';
  if (host && /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return `${proto}://${host}`;
  return explicit.replace(/\/+$/, '') || 'http://localhost';
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonLd(data: Record<string, unknown>, scope: 'site' | 'page'): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/ld+json" data-seo="${scope}">${json}</script>`;
}

export function clip(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, '')}…`;
}

export function parseDescription(raw: string): { summary: string[]; sections: ProductSection[] } {
  const summary: string[] = [];
  const sections: ProductSection[] = [];
  let current: ProductSection | null = null;
  for (const rawLine of (raw ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      current = { title: line.slice(3).trim(), paragraphs: [], items: [], specs: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      summary.push(line);
      continue;
    }
    if (line.startsWith('### ')) {
      current.specs.push({ title: line.slice(4).trim(), rows: [] });
      continue;
    }
    if (line.startsWith('- ')) {
      current.items.push(line.slice(2).trim());
      continue;
    }
    const pipe = line.indexOf(' | ');
    if (pipe > 0) {
      let group = current.specs[current.specs.length - 1];
      if (!group) {
        group = { rows: [] };
        current.specs.push(group);
      }
      group.rows.push([line.slice(0, pipe).trim(), line.slice(pipe + 3).trim()]);
      continue;
    }
    current.paragraphs.push(line);
  }
  return { summary, sections };
}

function absoluteUrl(base: string, src: string | undefined): string | undefined {
  if (!src) return undefined;
  const media = /\/api\/media\/file\/([^/?#]+)/.exec(src);
  if (media) return `${base}/api/media/file/${media[1]}`;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/') && !src.startsWith('//')) return `${base}${src}`;
  return undefined;
}

function priceOf(product: SeoProduct): number {
  const value = Number(product.price.toString());
  return Number.isFinite(value) ? value : 0;
}

function formatFcfa(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`;
}

function brandOf(name: string): string | undefined {
  if (/\baurora\b/i.test(name)) return 'Aurora';
  if (/\bSOO-/i.test(name)) return 'SOOBAAJO';
  return undefined;
}

function pageData<T>(row: { data: unknown } | null): T {
  return row && row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? (row.data as T) : ({} as T);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
}

function titledItems(value: unknown): Array<{ title: string; text: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is { title?: unknown; text?: unknown } => !!v && typeof v === 'object')
    .map((v) => ({ title: String(v.title ?? ''), text: String(v.text ?? '') }))
    .filter((v) => v.title || v.text);
}

function breadcrumbs(base: string, trail: Array<[string, string]>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([path, name], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: `${base}${path === '/' ? '/' : path}`,
    })),
  };
}

function breadcrumbNav(trail: Array<[string, string]>): string {
  const parts = trail.map(([path, name], index) =>
    index === trail.length - 1 ? `<span aria-current="page">${esc(name)}</span>` : `<a href="${esc(path)}">${esc(name)}</a>`,
  );
  return `<nav aria-label="Fil d’Ariane" class="seo-breadcrumb">${parts.join(' › ')}</nav>`;
}

function renderSections(sections: ProductSection[]): string {
  return sections
    .map((section) => {
      const paragraphs = section.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('');
      const items = section.items.length ? `<ul>${section.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
      const specs = section.specs.length
        ? `<table>${section.specs
            .map(
              (group) =>
                `<tbody>${group.title ? `<tr><th colspan="2" scope="colgroup">${esc(group.title)}</th></tr>` : ''}${group.rows
                  .map(([label, value]) => `<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`)
                  .join('')}</tbody>`,
            )
            .join('')}</table>`
        : '';
      return `<section><h2>${esc(section.title)}</h2>${paragraphs}${items}${specs}</section>`;
    })
    .join('');
}

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);
  private template: { html: string; at: number; etag?: string } | null = null;

  constructor(private readonly db: PrismaService) {}

  /** Returns null when the SPA shell is unavailable so nginx serves its static copy. */
  async renderPage(rawUri: string, base: string): Promise<{ status: number; html: string; location?: string } | null> {
    const template = await this.loadTemplate();
    if (!template) return null;
    const rendered = await this.route(rawUri, base);
    if (rendered.location) return { status: rendered.status, html: '', location: rendered.location };
    const html = template
      .replace(new RegExp(`${HEAD_START}[\\s\\S]*?${HEAD_END}`), () => this.head(rendered.meta, base))
      .replace(BODY_MARK, () => this.layout(rendered.body));
    return { status: rendered.status, html };
  }

  async sitemap(base: string): Promise<string> {
    const [items, pages] = await Promise.all([
      this.db.product.findMany({
        where: { published: true },
        select: { slug: true, name: true, kind: true, images: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5000,
      }),
      this.db.sitePage.findMany({ select: { key: true, updatedAt: true } }),
    ]);
    const pageDate = (key: string) => pages.find((p) => p.key === key)?.updatedAt;
    const latest = (kind: string) => items.find((i) => i.kind === kind)?.updatedAt;
    const entries: Array<{ path: string; lastmod?: Date; priority: string; images?: Array<{ loc: string; title: string }> }> = [
      { path: '/', lastmod: pageDate('home'), priority: '1.0' },
      { path: '/produits', lastmod: latest('PRODUCT'), priority: '0.9' },
      { path: '/projets', lastmod: latest('PROJECT'), priority: '0.7' },
      { path: '/expertises', lastmod: pageDate('expertises'), priority: '0.6' },
      { path: '/a-propos', lastmod: pageDate('about'), priority: '0.5' },
      { path: '/contact', priority: '0.6' },
    ];
    for (const item of items) {
      entries.push({
        path: `${item.kind === 'PROJECT' ? '/projets' : '/produits'}/${encodeURIComponent(item.slug)}`,
        lastmod: item.updatedAt,
        priority: item.kind === 'PROJECT' ? '0.6' : '0.8',
        images: item.images
          .map((src) => absoluteUrl(base, src))
          .filter((loc): loc is string => !!loc)
          .slice(0, 10)
          .map((loc) => ({ loc, title: item.name })),
      });
    }
    const urls = entries
      .map((entry) => {
        const images = (entry.images ?? [])
          .map((img) => `<image:image><image:loc>${esc(img.loc)}</image:loc><image:title>${esc(img.title)}</image:title></image:image>`)
          .join('');
        const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod.toISOString()}</lastmod>` : '';
        return `<url><loc>${esc(`${base}${entry.path}`)}</loc>${lastmod}<priority>${entry.priority}</priority>${images}</url>`;
      })
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`;
  }

  robots(base: string): string {
    return ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', '', `Sitemap: ${base}/sitemap.xml`, ''].join('\n');
  }

  private async loadTemplate(): Promise<string | null> {
    if (this.template && Date.now() - this.template.at < TEMPLATE_TTL_MS) return this.template.html;
    const url = process.env.SEO_TEMPLATE_URL || 'http://web/index.html';
    try {
      const res = await fetch(url, {
        headers: this.template?.etag ? { 'If-None-Match': this.template.etag } : {},
        signal: AbortSignal.timeout(2_000),
      });
      if (res.status === 304 && this.template) {
        this.template.at = Date.now();
        return this.template.html;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (!html.includes(HEAD_START) || !html.includes(BODY_MARK)) throw new Error('SEO markers missing from index.html');
      this.template = { html, at: Date.now(), etag: res.headers.get('etag') ?? undefined };
      return html;
    } catch (error) {
      // A stale shell would reference hashed assets that no longer exist after a web deploy.
      this.template = null;
      this.logger.warn(`SPA template unavailable (${url}): ${(error as Error).message}`);
      return null;
    }
  }

  private async route(rawUri: string, base: string): Promise<Rendered> {
    let path: string;
    try {
      path = decodeURIComponent((rawUri || '/').split(/[?#]/)[0] || '/');
    } catch {
      path = '/';
    }
    if (path.length > 1 && path.endsWith('/')) {
      const query = rawUri.includes('?') ? rawUri.slice(rawUri.indexOf('?')) : '';
      return { status: 301, meta: this.notFoundMeta(path), body: '', location: `${path.replace(/\/+$/, '') || '/'}${query}` };
    }
    if (path === '/admin' || path.startsWith('/admin/')) {
      return { status: 200, meta: { title: TEXT.adminTitle, description: TEXT.homeDescription, path, noindex: true }, body: '' };
    }
    if (path === '/') return this.home();
    if (path === '/produits') return this.productList();
    if (path === '/projets') return this.projectList();
    if (path === '/a-propos') return this.about();
    if (path === '/expertises') return this.expertises();
    if (path === '/contact') return this.contact();
    const detail = /^\/(produits|projets)\/([^/]+)$/.exec(path);
    if (detail?.[2]) return this.detail(detail[1] === 'projets' ? 'PROJECT' : 'PRODUCT', detail[2], base);
    return this.notFound(path);
  }

  private notFoundMeta(path: string): PageMeta {
    return { title: TEXT.notFoundTitle, description: TEXT.homeDescription, path, noindex: true };
  }

  private notFound(path: string): Rendered {
    return {
      status: 404,
      meta: this.notFoundMeta(path),
      body: `<h1>Page introuvable</h1><p>La page demandée n’existe pas ou a été déplacée.</p><p><a href="/">Retour à l’accueil</a> · <a href="/produits">Voir nos produits</a></p>`,
    };
  }

  private listProducts(kind: 'PRODUCT' | 'PROJECT', take: number): Promise<SeoProduct[]> {
    return this.db.product.findMany({
      where: { published: true, kind },
      include: { category: true },
      orderBy: { updatedAt: 'desc' },
      take,
    });
  }

  private async home(): Promise<Rendered> {
    const [row, projects] = await Promise.all([
      this.db.sitePage.findUnique({ where: { key: 'home' } }),
      this.listProducts('PROJECT', 6),
    ]);
    const data = pageData<Record<string, unknown>>(row);
    const text = (key: string) => (typeof data[key] === 'string' ? (data[key] as string) : '');
    const expertises = titledItems(data.expertises);
    const body = [
      `<section>${text('heroEyebrow') ? `<p>${esc(text('heroEyebrow'))}</p>` : ''}<h1>${esc(text('heroTitle') || TEXT.homeTitle)}</h1>${
        text('heroLead') ? `<p>${esc(text('heroLead'))}</p>` : ''
      }<p><a href="/projets">Voir les projets</a> · <a href="/contact">Demander une étude</a></p></section>`,
      text('aboutTitle') ? `<section><h2>${esc(text('aboutTitle'))}</h2><p>${esc(text('aboutText'))}</p><p><a href="/a-propos">Qui sommes-nous</a></p></section>` : '',
      expertises.length
        ? `<section><h2>${esc(text('expertiseTitle') || 'Nos expertises')}</h2><ul>${expertises
            .map((e) => `<li><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></li>`)
            .join('')}</ul><p><a href="/expertises">Toutes les expertises</a></p></section>`
        : '',
      projects.length
        ? `<section><h2>${esc(text('projectsTitle') || 'Nos projets récents')}</h2>${text('projectsText') ? `<p>${esc(text('projectsText'))}</p>` : ''}<ul>${projects
            .map((p) => `<li><a href="/projets/${esc(encodeURIComponent(p.slug))}">${esc(p.name)}</a></li>`)
            .join('')}</ul><p><a href="/projets">Tous les projets</a></p></section>`
        : '',
      text('teamTitle') ? `<section><h2>${esc(text('teamTitle'))}</h2><p>${esc(text('teamText'))}</p></section>` : '',
    ].join('');
    return {
      status: 200,
      meta: { title: TEXT.homeTitle, description: TEXT.homeDescription, path: '/', image: text('heroImage') || undefined },
      body,
    };
  }

  private async productList(): Promise<Rendered> {
    const products = (await this.listProducts('PRODUCT', 500))
      .filter((p) => !p.category?.slug.startsWith('cat-'))
      .sort((a, b) => {
        const rank = (p: SeoProduct) => {
          const index = CATALOG_ORDER.indexOf(p.category?.slug ?? '');
          return index === -1 ? CATALOG_ORDER.length : index;
        };
        return rank(a) - rank(b);
      });
    const trail: Array<[string, string]> = [['/', 'Accueil'], ['/produits', 'Produits']];
    const body = `${breadcrumbNav(trail)}<h1>Produits &amp; équipements</h1><p>Parcourez notre catalogue — panneaux, batteries, onduleurs et kits, avec tarifs en FCFA.</p><ul class="seo-list">${products
      .map((p) => {
        const price = priceOf(p);
        const summary = parseDescription(p.description).summary[0] ?? '';
        return `<li><article><p>${esc(p.category?.name ?? 'Produit')}</p><h2><a href="/produits/${esc(encodeURIComponent(p.slug))}">${esc(p.name)}</a></h2>${
          summary ? `<p>${esc(summary)}</p>` : ''
        }<p>Prix : ${price > 0 ? esc(formatFcfa(price)) : 'Prix sur demande'}</p></article></li>`;
      })
      .join('')}</ul>`;
    return {
      status: 200,
      meta: {
        title: TEXT.productsTitle,
        description: TEXT.productsDescription,
        path: '/produits',
        image: products[0]?.images[0],
        jsonLd: [
          breadcrumbs('', trail),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Produits & équipements',
            itemListElement: products.map((p, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              url: `/produits/${encodeURIComponent(p.slug)}`,
              name: p.name,
            })),
          },
        ],
      },
      body,
    };
  }

  private async projectList(): Promise<Rendered> {
    const projects = await this.listProducts('PROJECT', 100);
    const trail: Array<[string, string]> = [['/', 'Accueil'], ['/projets', 'Projets']];
    const body = `${breadcrumbNav(trail)}<h1>Nos projets</h1><p>Installations résidentielles, tertiaires et agricoles — conception, pose et suivi.</p><ul class="seo-list">${projects
      .map(
        (p) =>
          `<li><article><h2><a href="/projets/${esc(encodeURIComponent(p.slug))}">${esc(p.name)}</a></h2><p>${esc(
            clip(p.description, 200),
          )}</p></article></li>`,
      )
      .join('')}</ul>`;
    return {
      status: 200,
      meta: {
        title: TEXT.projectsTitle,
        description: TEXT.projectsDescription,
        path: '/projets',
        image: projects[0]?.images[0],
        jsonLd: [breadcrumbs('', trail)],
      },
      body,
    };
  }

  private async detail(kind: 'PRODUCT' | 'PROJECT', slug: string, base: string): Promise<Rendered> {
    const item = await this.db.product.findFirst({ where: { slug, published: true }, include: { category: true } });
    if (!item) return this.notFound(`/${kind === 'PROJECT' ? 'projets' : 'produits'}/${slug}`);
    if (item.kind !== kind) {
      const target = `/${item.kind === 'PROJECT' ? 'projets' : 'produits'}/${encodeURIComponent(item.slug)}`;
      return { status: 301, meta: this.notFoundMeta(target), body: '', location: target };
    }
    const segment = kind === 'PROJECT' ? 'projets' : 'produits';
    const path = `/${segment}/${encodeURIComponent(item.slug)}`;
    const trail: Array<[string, string]> = [
      ['/', 'Accueil'],
      [`/${segment}`, kind === 'PROJECT' ? 'Projets' : 'Produits'],
      [path, item.name],
    ];
    const images = item.images.map((src) => absoluteUrl(base, src)).filter((src): src is string => !!src);
    const content = parseDescription(item.description);
    const summary = content.summary.join(' ') || item.name;
    const price = priceOf(item);
    const category = item.category?.name ?? (kind === 'PROJECT' ? 'Installation' : 'Produit');
    const imageTag = images[0] ? `<img src="${esc(images[0])}" alt="${esc(item.name)}">` : '';

    if (kind === 'PROJECT') {
      return {
        status: 200,
        meta: {
          title: `${item.name} — Réalisation | FB Solar Power Ltd`,
          description: clip(summary),
          path,
          image: images[0],
          imageAlt: item.name,
          type: 'article',
          jsonLd: [breadcrumbs('', trail)],
        },
        body: `${breadcrumbNav(trail)}<article>${imageTag}<p>${esc(category)}</p><h1>${esc(item.name)}</h1><p>${esc(
          item.description,
        )}</p><p><a href="/contact">Discuter d’un projet similaire</a></p></article>`,
      };
    }

    const brand = brandOf(item.name);
    const offer =
      price > 0
        ? {
            '@type': 'Offer',
            price: price.toFixed(0),
            priceCurrency: business().currency,
            availability: 'https://schema.org/InStock',
            url: path,
            seller: { '@id': '/#business' },
          }
        : undefined;
    return {
      status: 200,
      meta: {
        title: `${item.name} | FB Solar Power Ltd`,
        description: clip(summary),
        path,
        image: images[0],
        imageAlt: item.name,
        type: 'product',
        jsonLd: [
          breadcrumbs('', trail),
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            '@id': `${path}#product`,
            name: item.name,
            description: clip(summary, 5000),
            sku: item.slug,
            category,
            image: images.length ? images : undefined,
            url: path,
            brand: brand ? { '@type': 'Brand', name: brand } : undefined,
            offers: offer,
          },
        ],
      },
      body: `${breadcrumbNav(trail)}<article>${imageTag}<p>${esc(category)}</p><h1>${esc(item.name)}</h1>${content.summary
        .map((p) => `<p>${esc(p)}</p>`)
        .join('')}<p>Prix : ${price > 0 ? esc(formatFcfa(price)) : 'Prix sur demande'}</p><p><a href="/contact">Demander un devis</a> · <a href="/produits">Tous les produits</a></p>${renderSections(
        content.sections,
      )}</article>`,
    };
  }

  private async about(): Promise<Rendered> {
    const data = pageData<Record<string, unknown>>(await this.db.sitePage.findUnique({ where: { key: 'about' } }));
    const title = typeof data.title === 'string' && data.title ? data.title : 'Des penseurs créatifs. Des installateurs techniques.';
    const paragraphs = strings(data.paragraphs);
    const trail: Array<[string, string]> = [['/', 'Accueil'], ['/a-propos', 'À propos']];
    return {
      status: 200,
      meta: {
        title: TEXT.aboutTitle,
        description: clip(paragraphs[0] ?? TEXT.homeDescription),
        path: '/a-propos',
        image: typeof data.image === 'string' ? data.image : undefined,
        jsonLd: [breadcrumbs('', trail)],
      },
      body: `${breadcrumbNav(trail)}<h1>${esc(title)}</h1>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}<p><a href="/contact">Nous contacter</a></p>`,
    };
  }

  private async expertises(): Promise<Rendered> {
    const data = pageData<Record<string, unknown>>(await this.db.sitePage.findUnique({ where: { key: 'expertises' } }));
    const title = typeof data.title === 'string' && data.title ? data.title : 'Du premier calcul au dernier connecteur';
    const lead = typeof data.lead === 'string' ? data.lead : '';
    const items = titledItems(data.items);
    const trail: Array<[string, string]> = [['/', 'Accueil'], ['/expertises', 'Expertises']];
    return {
      status: 200,
      meta: {
        title: TEXT.expertisesTitle,
        description: clip([lead, ...items.map((i) => i.title)].filter(Boolean).join(' · ') || TEXT.homeDescription),
        path: '/expertises',
        jsonLd: [breadcrumbs('', trail)],
      },
      body: `${breadcrumbNav(trail)}<h1>${esc(title)}</h1>${lead ? `<p>${esc(lead)}</p>` : ''}${items
        .map((i) => `<section><h2>${esc(i.title)}</h2><p>${esc(i.text)}</p></section>`)
        .join('')}<p><a href="/contact">Parler de votre projet</a></p>`,
    };
  }

  private contact(): Rendered {
    const biz = business();
    const trail: Array<[string, string]> = [['/', 'Accueil'], ['/contact', 'Contact']];
    return {
      status: 200,
      meta: {
        title: TEXT.contactTitle,
        description: TEXT.contactDescription,
        path: '/contact',
        jsonLd: [breadcrumbs('', trail)],
      },
      body: `${breadcrumbNav(trail)}<h1>Parlons de votre installation</h1><p>Décrivez votre projet — nous revenons vers vous avec une première lecture technique.</p><address><strong>${esc(
        biz.name,
      )}</strong><br>${esc(biz.street)}<br>${esc(`${biz.postalCode} ${biz.city}`.trim())}<br><a href="tel:${esc(
        biz.phone.replace(/[^\d+]/g, ''),
      )}">${esc(biz.phone)}</a><br><a href="mailto:${esc(biz.email)}">${esc(biz.email)}</a></address>`,
    };
  }

  private head(meta: PageMeta, base: string): string {
    const biz = business();
    const canonical = `${base}${meta.path}`;
    const image = absoluteUrl(base, meta.image) ?? `${base}/brand/fb-solar-logo.png`;
    const absolutize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(absolutize);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, (k === 'item' || k === 'url' || k === '@id') && typeof v === 'string' && v.startsWith('/') ? `${base}${v}` : absolutize(v)]),
        );
      }
      return value;
    };
    const site = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'LocalBusiness',
          '@id': `${base}/#business`,
          name: biz.name,
          slogan: biz.slogan,
          description: TEXT.homeDescription,
          url: `${base}/`,
          logo: `${base}/brand/fb-solar-logo.png`,
          image: `${base}/brand/fb-solar-logo.png`,
          telephone: biz.phone,
          email: biz.email,
          currenciesAccepted: biz.currency,
          address: {
            '@type': 'PostalAddress',
            streetAddress: biz.street,
            postalCode: biz.postalCode,
            addressLocality: biz.city,
            addressCountry: biz.country,
          },
          sameAs: biz.sameAs.length ? biz.sameAs : undefined,
        },
        {
          '@type': 'WebSite',
          '@id': `${base}/#website`,
          url: `${base}/`,
          name: biz.name,
          inLanguage: 'fr-FR',
          publisher: { '@id': `${base}/#business` },
        },
      ],
    };
    const google = process.env.SEO_GOOGLE_VERIFICATION?.trim();
    const bing = process.env.SEO_BING_VERIFICATION?.trim();
    const tags = [
      `<title>${esc(meta.title)}</title>`,
      `<meta name="description" content="${esc(meta.description)}" />`,
      `<meta name="robots" content="${meta.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}" />`,
      meta.noindex ? '' : `<link rel="canonical" href="${esc(canonical)}" />`,
      `<meta property="og:type" content="${meta.type ?? 'website'}" />`,
      `<meta property="og:site_name" content="${esc(biz.name)}" />`,
      `<meta property="og:locale" content="fr_FR" />`,
      `<meta property="og:title" content="${esc(meta.title)}" />`,
      `<meta property="og:description" content="${esc(meta.description)}" />`,
      `<meta property="og:url" content="${esc(canonical)}" />`,
      `<meta property="og:image" content="${esc(image)}" />`,
      `<meta property="og:image:alt" content="${esc(meta.imageAlt ?? meta.title)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(meta.title)}" />`,
      `<meta name="twitter:description" content="${esc(meta.description)}" />`,
      `<meta name="twitter:image" content="${esc(image)}" />`,
      google ? `<meta name="google-site-verification" content="${esc(google)}" />` : '',
      bing ? `<meta name="msvalidate.01" content="${esc(bing)}" />` : '',
      meta.noindex ? '' : jsonLd(site, 'site'),
      ...(meta.noindex ? [] : (meta.jsonLd ?? []).map((data) => jsonLd(absolutize(data) as Record<string, unknown>, 'page'))),
    ];
    return tags.filter(Boolean).join('\n    ');
  }

  private layout(main: string): string {
    if (!main) return '';
    const biz = business();
    const nav = NAV.map(([href, label]) => `<a href="${href}">${esc(label)}</a>`).join('');
    return `<div class="seo-snapshot"><header><a href="/" class="seo-brand">${esc(biz.name)}</a><nav aria-label="Principale">${nav}</nav></header><main>${main}</main><footer><p><strong>${esc(
      biz.name,
    )}</strong> — ${esc(biz.slogan)}. Installateur photovoltaïque · conception, pose &amp; suivi.</p><address>${esc(biz.street)}, ${esc(
      `${biz.postalCode} ${biz.city}`.trim(),
    )} · <a href="tel:${esc(biz.phone.replace(/[^\d+]/g, ''))}">${esc(biz.phone)}</a> · <a href="mailto:${esc(biz.email)}">${esc(
      biz.email,
    )}</a></address></footer></div>`;
  }
}

/** Internal endpoints for the web container's nginx — not exposed through Traefik. */
@ApiExcludeController()
@Controller('seo')
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  private internal(headers: HeaderBag, res: Response): boolean {
    if (header(headers, 'x-forwarded-prefix')) {
      res.status(404).end();
      return false;
    }
    return true;
  }

  @Get('render')
  async render(@Headers() headers: HeaderBag, @Res() res: Response): Promise<void> {
    if (!this.internal(headers, res)) return;
    const result = await this.seo.renderPage(header(headers, 'x-original-uri') ?? '/', resolveSiteUrl(headers));
    if (!result) {
      res.status(503).end();
      return;
    }
    if (result.location) {
      res.redirect(result.status, result.location);
      return;
    }
    res.status(result.status).type('html').set('Cache-Control', 'no-cache').send(result.html);
  }

  @Get('sitemap.xml')
  async sitemap(@Headers() headers: HeaderBag, @Res() res: Response): Promise<void> {
    if (!this.internal(headers, res)) return;
    const xml = await this.seo.sitemap(resolveSiteUrl(headers));
    res.status(200).type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
  }

  @Get('robots.txt')
  robots(@Headers() headers: HeaderBag, @Res() res: Response): void {
    if (!this.internal(headers, res)) return;
    res.status(200).type('text/plain').set('Cache-Control', 'public, max-age=3600').send(this.seo.robots(resolveSiteUrl(headers)));
  }
}
