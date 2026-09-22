import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import './Footer.scss';

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__cta">
        <div className="container">
          <p className="eyebrow">{t('footer.eyebrow')}</p>
          <h2>{t('footer.ctaTitle')}</h2>
          <div className="footer__cta-actions">
            <Link className="btn btn--light" to="/contact">
              {t('footer.ctaContact')}
            </Link>
            <a className="btn btn--ghost-light" href="tel:+33123456789">
              01 23 45 67 89
            </a>
          </div>
        </div>
      </div>

      <div className="footer__main">
        <div className="container footer__grid">
          <div>
            <Link to="/" className="footer__brand" aria-label={t('nav.brandHome')}>
              <img src="/brand/fb-solar-logo.png" alt={t('common.brandFull')} width={240} height={80} />
            </Link>
            <p className="footer__tagline">{t('common.tagline')}</p>
            <p>
              12 avenue du Soleil
              <br />
              69003 Lyon
            </p>
            <p>
              <a href="mailto:contact@fbsolar.local">contact@fbsolar.local</a>
            </p>
          </div>
          <nav aria-label={t('nav.footer')}>
            <Link to="/">{t('nav.home')}</Link>
            <Link to="/projets">{t('nav.projects')}</Link>
            <Link to="/produits">{t('nav.products')}</Link>
            <Link to="/a-propos">{t('nav.about')}</Link>
            <Link to="/expertises">{t('nav.expertises')}</Link>
            <Link to="/contact">{t('nav.contact')}</Link>
          </nav>
          <div>
            <p>{t('footer.blurb')}</p>
            <p className="footer__note">{t('footer.rights', { year })}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
