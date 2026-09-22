import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import { api } from '../lib/api';
import './Page.scss';

type ExpertiseData = {
  eyebrow?: string;
  title?: string;
  lead?: string;
  items?: Array<{ title: string; text: string }>;
};

export function ExpertisesPage() {
  const { t } = useTranslation();
  const defaults = useMemo<ExpertiseData>(
    () => ({
      eyebrow: t('expertises.eyebrow'),
      title: t('expertises.fallbackTitle'),
      lead: '',
      items: [],
    }),
    [t],
  );
  const [cms, setCms] = useState<ExpertiseData>(defaults);

  useEffect(() => {
    setCms(defaults);
  }, [defaults]);

  useEffect(() => {
    let alive = true;
    api
      .page('expertises')
      .then((page) => {
        if (alive) setCms({ ...defaults, ...(page.data as ExpertiseData) });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [defaults]);

  const items = cms.items?.length ? cms.items : defaults.items!;

  return (
    <div className="page">
      <header className="page-hero">
        <div className="container">
          <p className="eyebrow">{cms.eyebrow}</p>
          <h1>{cms.title}</h1>
          {cms.lead ? <p>{cms.lead}</p> : null}
        </div>
      </header>
      <section className="page-section">
        <div className="container expertise-list">
          {items.map((item, i) => (
            <Reveal key={`${item.title}-${i}`} delay={i * 80}>
              <article>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="container" style={{ marginTop: '2.5rem' }}>
          <Link className="btn btn--solid" to="/contact">
            {t('expertises.ctaContact')}
          </Link>
        </div>
      </section>
    </div>
  );
}
