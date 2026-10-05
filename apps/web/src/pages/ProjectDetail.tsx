import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import { api, productImage, type Product } from '../lib/api';
import { clip, useSeo } from '../lib/seo';
import { useRealtime, useRealtimeRefresh } from '../realtime/RealtimeProvider';
import './Page.scss';

export function ProjectDetailPage() {
  const { t, i18n } = useTranslation();
  const { slug = '' } = useParams();
  const { revision } = useRealtime();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';

  const load = () =>
    api
      .product(slug)
      .then((data) => {
        setProduct(data);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message || t('projects.notFound'));
      });

  useEffect(() => {
    void load();
  }, [slug, t]);

  useRealtimeRefresh(['project', 'product'], () => void load(), { slugs: slug ? [slug] : undefined });

  useSeo(
    product
      ? {
          title: t('seo.projectTitle', { name: product.name }),
          description: clip(product.description || product.name),
          path: `/projets/${encodeURIComponent(product.slug)}`,
          image: product.images?.[0],
        }
      : error
        ? { title: t('projects.notFound'), noindex: true }
        : null,
  );

  if (error) {
    return (
      <div className="page">
        <div className="container page-section">
          <p className="status status--error">{error}</p>
          <Link className="btn btn--solid" to="/projets">
            {t('projects.back')}
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

  const price = product.price.toLocaleString(locale, { style: 'currency', currency: 'EUR' });

  return (
    <div className="page project-detail">
      <div className="project-detail__hero">
        <img src={productImage(product, 0, revision)} alt={product.name} />
        <div className="project-detail__hero-copy container">
          <p className="eyebrow">{product.category?.name ?? t('projects.fallbackCategory')}</p>
          <h1>{product.name}</h1>
        </div>
      </div>
      <section className="page-section">
        <div className="container project-detail__body">
          <Reveal>
            <p>{product.description}</p>
            <p className="project-detail__price">{t('projects.priceFrom', { price })}</p>
            <Link className="btn btn--solid" to="/contact">
              {t('projects.ctaContact')}
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
