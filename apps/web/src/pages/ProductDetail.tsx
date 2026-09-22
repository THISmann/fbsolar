import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import { api, productImage, type Product } from '../lib/api';
import { formatFcfa } from '../lib/money';
import './Page.scss';

export function ProductDetailPage() {
  const { t, i18n } = useTranslation();
  const { slug = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';

  useEffect(() => {
    let alive = true;
    api
      .product(slug)
      .then((data) => {
        if (alive) setProduct(data);
      })
      .catch((err: Error) => {
        if (alive) setError(err.message || t('products.notFound'));
      });
    return () => {
      alive = false;
    };
  }, [slug, t]);

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

  return (
    <div className="page project-detail">
      <div className="project-detail__hero">
        <img src={productImage(product)} alt="" />
        <div className="project-detail__hero-copy container">
          <p className="eyebrow">{product.category?.name ?? t('products.fallbackCategory')}</p>
          <h1>{product.name}</h1>
        </div>
      </div>
      <section className="page-section">
        <div className="container project-detail__body">
          <Reveal>
            <p>{product.description}</p>
            <p className="project-detail__price">{formatFcfa(product.price, locale)}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Link className="btn btn--solid" to="/contact">
                {t('products.ctaContact')}
              </Link>
              <Link className="btn" to="/produits">
                {t('products.allProducts')}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
