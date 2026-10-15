import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import { api, productImage, type Product } from '../lib/api';
import { clip, useSeo } from '../lib/seo';
import { useRealtime, useRealtimeRefresh } from '../realtime/RealtimeProvider';
import './Page.scss';

export function ProjectDetailPage() {
  const { t } = useTranslation();
  const { slug = '' } = useParams();
  const { revision } = useRealtime();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

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
    setActiveImage(0);
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

  const imageCount = Math.max(product.images?.length ?? 0, 1);
  const current = Math.min(activeImage, imageCount - 1);

  return (
    <div className="page project-detail">
      <div className="project-detail__hero">
        <img src={productImage(product, current, revision)} alt={product.name} />
        <div className="project-detail__hero-copy container">
          <p className="eyebrow">{product.category?.name ?? t('projects.fallbackCategory')}</p>
          <h1>{product.name}</h1>
        </div>
      </div>
      <section className="page-section">
        <div className="container project-detail__body">
          <Reveal>
            <p>{product.description}</p>
            {imageCount > 1 && (
              <div className="project-detail__gallery" role="list">
                {product.images.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    role="listitem"
                    className={index === current ? 'is-active' : undefined}
                    aria-label={t('products.showImage', { index: index + 1 })}
                    aria-pressed={index === current}
                    onClick={() => setActiveImage(index)}
                  >
                    <img src={productImage(product, index, revision)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            <Link className="btn btn--solid" to="/contact">
              {t('projects.ctaContact')}
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
