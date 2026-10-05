import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ProjectTile } from '../components/ProjectTile';
import { Reveal } from '../components/Reveal';
import { api, fallbackImages, withCacheBust, type Product } from '../lib/api';
import { useSeo } from '../lib/seo';
import { useRealtime, useRealtimeRefresh } from '../realtime/RealtimeProvider';
import './Home.scss';

type HomeData = {
  heroEyebrow?: string;
  heroTitle?: string;
  heroLead?: string;
  heroImage?: string;
  aboutEyebrow?: string;
  aboutTitle?: string;
  aboutText?: string;
  expertiseEyebrow?: string;
  expertiseTitle?: string;
  expertises?: Array<{ title: string; text: string }>;
  projectsEyebrow?: string;
  projectsTitle?: string;
  projectsText?: string;
  storyTitle?: string;
  storyText?: string;
  storyImage?: string;
  teamTitle?: string;
  teamText?: string;
};

function buildDefaults(t: (key: string) => string): HomeData {
  return {
    heroEyebrow: t('home.defaults.heroEyebrow'),
    heroTitle: t('home.defaults.heroTitle'),
    heroLead: t('home.defaults.heroLead'),
    heroImage: fallbackImages[0],
    aboutEyebrow: t('home.defaults.aboutEyebrow'),
    aboutTitle: t('home.defaults.aboutTitle'),
    aboutText: t('home.defaults.aboutText'),
    expertiseEyebrow: t('home.defaults.expertiseEyebrow'),
    expertiseTitle: t('home.defaults.expertiseTitle'),
    expertises: [
      { title: t('home.defaults.exp0Title'), text: t('home.defaults.exp0Text') },
      { title: t('home.defaults.exp1Title'), text: t('home.defaults.exp1Text') },
      { title: t('home.defaults.exp2Title'), text: t('home.defaults.exp2Text') },
      { title: t('home.defaults.exp3Title'), text: t('home.defaults.exp3Text') },
    ],
    projectsEyebrow: t('home.defaults.projectsEyebrow'),
    projectsTitle: t('home.defaults.projectsTitle'),
    projectsText: t('home.defaults.projectsText'),
    storyTitle: t('home.defaults.storyTitle'),
    storyText: t('home.defaults.storyText'),
    storyImage: fallbackImages[2],
    teamTitle: t('home.defaults.teamTitle'),
    teamText: t('home.defaults.teamText'),
  };
}

function mergeHomeCms(
  defaults: HomeData,
  cmsData: HomeData,
  preferI18nText: boolean,
): HomeData {
  if (!preferI18nText) {
    return { ...defaults, ...cmsData };
  }
  return {
    ...defaults,
    heroImage: cmsData.heroImage ?? defaults.heroImage,
    storyImage: cmsData.storyImage ?? defaults.storyImage,
  };
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const { revision } = useRealtime();
  const [projects, setProjects] = useState<Product[]>([]);
  const defaults = useMemo(() => buildDefaults(t), [t, i18n.language]);
  const [cms, setCms] = useState<HomeData>(() => defaults);
  useEffect(() => {
    setCms(defaults);
  }, [defaults]);

  const loadHome = () => {
    const preferText = i18n.language.startsWith('en');
    return Promise.all([
      api
        .page('home')
        .then((page) => {
          setCms(mergeHomeCms(defaults, page.data as HomeData, preferText));
        })
        .catch(() => undefined),
      api
        .products({ limit: 6, kind: 'PROJECT' })
        .then((data) => setProjects(data.items))
        .catch(() => setProjects([])),
    ]);
  };

  useEffect(() => {
    let alive = true;
    void loadHome().finally(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload via realtime + language
  }, [defaults, i18n.language]);

  useRealtimeRefresh(['page', 'project', 'product'], () => void loadHome(), { keys: ['home'] });
  useSeo({ title: t('seo.homeTitle'), description: t('seo.homeDescription'), path: '/', image: cms.heroImage });

  const expertises = cms.expertises?.length ? cms.expertises : defaults.expertises!;
  const heroSrc = withCacheBust(cms.heroImage || defaults.heroImage || '', revision);
  const storySrc = withCacheBust(cms.storyImage || defaults.storyImage || '', revision);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero__media" aria-hidden="true">
          <img src={heroSrc} alt="" fetchPriority="high" />
        </div>
        <div className="hero__veil" aria-hidden="true" />
        <div className="hero__content container--wide">
          <p className="eyebrow hero__brand">{cms.heroEyebrow}</p>
          <h1>{cms.heroTitle}</h1>
          <p className="hero__lead">{cms.heroLead}</p>
          <div className="hero__actions">
            <Link className="btn btn--light" to="/projets">
              {t('home.ctaProjects')}
            </Link>
            <Link className="btn btn--ghost-light" to="/contact">
              {t('home.ctaStudy')}
            </Link>
          </div>
        </div>
      </section>

      <section className="about-strip">
        <div className="container about-strip__grid">
          <Reveal>
            <p className="eyebrow">{cms.aboutEyebrow}</p>
            <h2>{cms.aboutTitle}</h2>
          </Reveal>
          <Reveal delay={120}>
            <p>{cms.aboutText}</p>
            <Link className="text-link" to="/a-propos">
              {t('home.ctaAbout')}
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="expertise-block">
        <div className="container">
          <Reveal>
            <p className="eyebrow">{cms.expertiseEyebrow}</p>
            <h2>{cms.expertiseTitle}</h2>
          </Reveal>
          <div className="expertise-block__list">
            {expertises.map((item, i) => (
              <Reveal key={`${item.title}-${i}`} delay={i * 80}>
                <article>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <Link className="btn btn--solid" to="/expertises">
              {t('home.ctaAllExpertises')}
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="projects-block">
        <div className="container projects-block__intro">
          <Reveal>
            <p className="eyebrow">{cms.projectsEyebrow}</p>
            <h2>{cms.projectsTitle}</h2>
          </Reveal>
          <Reveal delay={100}>
            <p>{cms.projectsText}</p>
          </Reveal>
        </div>
        <div className="container--wide projects-block__grid">
          {projects.length > 0
            ? projects.map((product, index) => (
                <Reveal key={product.id} delay={(index % 4) * 70}>
                  <ProjectTile product={product} index={index} />
                </Reveal>
              ))
            : fallbackImages.slice(0, 5).map((src, index) => (
                <Reveal key={src} delay={(index % 4) * 70}>
                  <Link to="/projets" className="project-tile">
                    <div className="project-tile__media">
                      <img src={src} alt="" loading="lazy" />
                    </div>
                    <div className="project-tile__meta">
                      <span>{t('projects.fallbackCategory')}</span>
                      <h3>Projet solaire {index + 1}</h3>
                    </div>
                  </Link>
                </Reveal>
              ))}
        </div>
        <div className="container projects-block__more">
          <Link className="btn btn--solid" to="/projets">
            {t('home.ctaAllProjects')}
          </Link>
        </div>
      </section>

      <section className="story-block">
        <div className="story-block__media" aria-hidden="true">
          <img src={storySrc} alt="" loading="lazy" />
        </div>
        <div className="container story-block__copy">
          <Reveal>
            <h2>{cms.storyTitle}</h2>
            <p>{cms.storyText}</p>
            <Link className="btn btn--ghost-light" to="/projets">
              {t('home.ctaExplore')}
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="team-teaser">
        <div className="container team-teaser__grid">
          <Reveal>
            <h2>{cms.teamTitle}</h2>
          </Reveal>
          <Reveal delay={100}>
            <p>{cms.teamText}</p>
            <Link className="text-link" to="/a-propos">
              {t('home.ctaTeam')}
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
