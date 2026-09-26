import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectTile } from '../components/ProjectTile';
import { Reveal } from '../components/Reveal';
import { api, type Product } from '../lib/api';
import { useRealtimeRefresh } from '../realtime/RealtimeProvider';
import './Page.scss';

export function ProjectsPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    return api
      .products({ limit: 24, kind: 'PROJECT' })
      .then((data) => {
        setProducts(data.items);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message || t('projects.loadError'));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    void load();
    // Initial load only — realtime refresh handles later updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeRefresh(['project', 'product'], () => void load());

  return (
    <div className="page">
      <header className="page-hero">
        <div className="container">
          <p className="eyebrow">{t('projects.eyebrow')}</p>
          <h1>{t('projects.title')}</h1>
          <p>{t('projects.lead')}</p>
        </div>
      </header>

      <section className="page-section">
        <div className="container--wide projects-grid">
          {loading && <p className="status">{t('common.loading')}</p>}
          {error && <p className="status status--error">{error}</p>}
          {!loading && !error && products.length === 0 && (
            <p className="status">{t('projects.empty')}</p>
          )}
          {!loading &&
            !error &&
            products.map((product, index) => (
              <Reveal key={product.id} delay={(index % 4) * 60}>
                <ProjectTile product={product} index={index} />
              </Reveal>
            ))}
        </div>
      </section>
    </div>
  );
}
