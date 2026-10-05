import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import { api, productImage, type Product } from '../lib/api';
import { formatFcfa } from '../lib/money';
import { parseProductDescription } from '../lib/productContent';
import { clip, useSeo } from '../lib/seo';
import { useRealtime, useRealtimeRefresh } from '../realtime/RealtimeProvider';
import './Page.scss';
import './ProductDetail.scss';

export function ProductDetailPage() {
  const { t, i18n } = useTranslation();
  const { slug = '' } = useParams();
  const { revision } = useRealtime();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';

  const load = () =>
    api
      .product(slug)
      .then((data) => {
        setProduct(data);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message || t('products.notFound'));
      });

  useEffect(() => {
    setActiveImage(0);
    void load();
  }, [slug, t]);

  useRealtimeRefresh(['product'], () => void load(), { slugs: slug ? [slug] : undefined });

  const content = useMemo(() => parseProductDescription(product?.description ?? ''), [product?.description]);

  useSeo(
    product
      ? {
          title: t('seo.productTitle', { name: product.name }),
          description: clip(content.summary.join(' ') || product.name),
          path: `/produits/${encodeURIComponent(product.slug)}`,
          image: product.images?.[0],
        }
      : error
        ? { title: t('products.notFound'), noindex: true }
        : null,
  );

  if (error) {
    return (
      <div className="page">
        <div className="container page-section">
          <p className="status status--error">{error}</p>
          <Link className="btn btn--solid" to="/produits">
            {t('products.back')}
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page">
        <div className="container page-section">
          <p className="status">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const imageCount = Math.max(product.images?.length ?? 0, 1);
  const current = Math.min(activeImage, imageCount - 1);
  const currentSrc = productImage(product, current, revision);
  const hasPrice = Number(product.price) > 0;

  return (
    <div className="page product-page">
      <section className="page-section product-page__top">
        <div className="container">
          <Link className="product-page__back" to="/produits">
            {t('products.back')}
          </Link>
          <div className="product-page__grid">
            <div className="product-gallery">
              <a
                className="product-gallery__main"
                href={currentSrc}
                target="_blank"
                rel="noopener noreferrer"
                title={t('products.openImage')}
              >
                <img src={currentSrc} alt={product.name} />
              </a>
              {imageCount > 1 && (
                <div className="product-gallery__thumbs">
                  {product.images.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={index === current ? 'is-active' : undefined}
                      aria-label={t('products.showImage', { index: index + 1 })}
                      aria-pressed={index === current}
                      onClick={() => setActiveImage(index)}
                    >
                      <img
                        src={productImage(product, index, revision)}
                        alt={`${product.name} — ${t('products.showImage', { index: index + 1 })}`}
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Reveal>
              <div className="product-page__info">
                <p className="eyebrow">{product.category?.name ?? t('products.fallbackCategory')}</p>
                <h1>{product.name}</h1>
                {content.summary.map((paragraph, index) => (
                  <p key={index} className="product-page__summary">
                    {paragraph}
                  </p>
                ))}
                <div className="product-page__price">
                  <span>{t('products.priceLabel')}</span>
                  <strong>{hasPrice ? formatFcfa(product.price, locale) : t('products.priceOnRequest')}</strong>
                </div>
                <div className="product-page__actions">
                  <Link className="btn btn--solid" to="/contact">
                    {t('products.ctaContact')}
                  </Link>
                  <Link className="btn" to="/produits">
                    {t('products.allProducts')}
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {content.sections.length > 0 && (
        <section className="page-section product-page__details">
          <div className="container product-sections">
            {content.sections.map((section, index) => (
              <Reveal
                key={`${section.title}-${index}`}
                className={section.specs.length ? 'product-sections__wide' : undefined}
              >
                <article className="product-section">
                  <h2>{section.title}</h2>
                  {section.paragraphs.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                  {section.items.length > 0 && (
                    <ul>
                      {section.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {section.specs.length > 0 && (
                    <div className="spec-table__wrap">
                      <table className="spec-table">
                        {section.specs.map((group, g) => (
                          <tbody key={g}>
                            {group.title && (
                              <tr className="spec-table__group">
                                <th colSpan={2} scope="colgroup">
                                  {group.title}
                                </th>
                              </tr>
                            )}
                            {group.rows.map(([label, value], r) => (
                              <tr key={r}>
                                <th scope="row">{label}</th>
                                <td>{value}</td>
                              </tr>
                            ))}
                          </tbody>
                        ))}
                      </table>
                    </div>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
