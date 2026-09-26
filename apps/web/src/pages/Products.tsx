import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import { api, productImage, type Category, type Product } from '../lib/api';
import { formatFcfa } from '../lib/money';
import { useRealtime, useRealtimeRefresh } from '../realtime/RealtimeProvider';
import './Page.scss';
import './Products.scss';

const CATALOG_ORDER = [
  'panneaux-solaires',
  'batteries',
  'onduleurs',
  'accessoires-outils',
  'solar-kits',
];

export function ProductsPage() {
  const { t, i18n } = useTranslation();
  const { revision } = useRealtime();
  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [active, setActive] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadCategories = () =>
    api
      .categories()
      .then((data) => {
        const ordered = [...data]
          .filter((c) => CATALOG_ORDER.includes(c.slug))
          .sort((a, b) => CATALOG_ORDER.indexOf(a.slug) - CATALOG_ORDER.indexOf(b.slug));
        setCategories(ordered);
      })
      .catch(() => setCategories([]));

  const loadProducts = () => {
    setLoading(true);
    return api
      .products({
        limit: 100,
        kind: 'PRODUCT',
        category: active === 'all' ? undefined : active,
        search: searchQuery || undefined,
      })
      .then((data) => {
        setProducts(data.items);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message || t('products.loadError'));
        setProducts([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [active, searchQuery, t]);

  useRealtimeRefresh(['product', 'category'], () => {
    void loadCategories();
    void loadProducts();
  });

  const filters = useMemo(
    () => [{ slug: 'all', name: t('products.filterAll') }, ...categories],
    [categories, t],
  );

  const visible = useMemo(
    () => products.filter((product) => !product.category?.slug.startsWith('cat-')),
    [products],
  );

  return (
    <div className="page page--shop">
      <header className="page-hero">
        <div className="container">
          <p className="eyebrow">{t('products.eyebrow')}</p>
          <h1>{t('products.title')}</h1>
          <p>{t('products.lead')}</p>
        </div>
      </header>

      <section className="page-section">
        <div className="container products-toolbar">
          <div className="products-filters" role="tablist" aria-label={t('products.eyebrow')}>
            {filters.map((filter) => (
              <button
                key={filter.slug}
                type="button"
                role="tab"
                aria-selected={active === filter.slug}
                className={active === filter.slug ? 'is-active' : undefined}
                onClick={() => setActive(filter.slug)}
              >
                {filter.name}
              </button>
            ))}
          </div>
          <label className="products-search">
            <span className="sr-only">{t('common.search')}</span>
            <input
              type="search"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        <div className="container">
          {!loading && !error && (
            <div className="products-meta">
              <span>{t('products.resultCount', { count: visible.length })}</span>
              <span>{t('products.currencyNote')}</span>
            </div>
          )}

          <div className="products-shop">
            {loading && <p className="status">{t('products.loadingCatalog')}</p>}
            {error && <p className="status status--error">{error}</p>}
            {!loading && !error && visible.length === 0 && (
              <p className="status">{t('products.emptyCategory')}</p>
            )}
            {!loading &&
              !error &&
              visible.map((product, index) => (
                <Reveal key={product.id} delay={(index % 4) * 50}>
                  <article className="product-card">
                    <Link to={`/produits/${product.slug}`} className="product-card__media">
                      <img src={productImage(product, index, revision)} alt="" loading="lazy" />
                    </Link>
                    <div className="product-card__body">
                      <span className="product-card__cat">
                        {product.category?.name ?? t('products.fallbackCategory')}
                      </span>
                      <h2>
                        <Link to={`/produits/${product.slug}`}>{product.name}</Link>
                      </h2>
                      <p>{product.description}</p>
                      <div className="product-card__foot">
                        <div className="product-card__price">
                          <span>{t('products.priceLabel')}</span>
                          <strong>{formatFcfa(product.price, locale)}</strong>
                        </div>
                        <Link className="btn btn--solid" to={`/produits/${product.slug}`}>
                          {t('products.details')}
                        </Link>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}
