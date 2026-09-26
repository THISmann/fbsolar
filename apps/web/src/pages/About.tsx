import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import { api, fallbackImages, withCacheBust } from '../lib/api';
import { useRealtime, useRealtimeRefresh } from '../realtime/RealtimeProvider';
import './Page.scss';

type AboutData = {
  eyebrow?: string;
  title?: string;
  image?: string;
  paragraphs?: string[];
};

export function AboutPage() {
  const { t } = useTranslation();
  const { revision } = useRealtime();
  const defaults = useMemo<AboutData>(
    () => ({
      eyebrow: t('about.eyebrow'),
      title: t('about.fallbackTitle'),
      image: fallbackImages[1],
      paragraphs: [],
    }),
    [t],
  );
  const [cms, setCms] = useState<AboutData>(defaults);

  useEffect(() => {
    setCms(defaults);
  }, [defaults]);

  const load = () =>
    api
      .page('about')
      .then((page) => {
        setCms({ ...defaults, ...(page.data as AboutData) });
      })
      .catch(() => undefined);

  useEffect(() => {
    void load();
  }, [defaults]);

  useRealtimeRefresh(['page'], () => void load(), { keys: ['about'] });

  const paragraphs = cms.paragraphs?.length ? cms.paragraphs : defaults.paragraphs!;
  const imageSrc = withCacheBust(cms.image || defaults.image || '', revision);

  return (
    <div className="page">
      <header className="page-hero">
        <div className="container">
          <p className="eyebrow">{cms.eyebrow}</p>
          <h1>{cms.title}</h1>
        </div>
      </header>

      <section className="page-section">
        <div className="container split">
          <Reveal>
            <img className="split__media" src={imageSrc} alt="" />
          </Reveal>
          <Reveal delay={100}>
            {paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <Link className="btn btn--solid" to="/contact">
              {t('about.ctaContact')}
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
