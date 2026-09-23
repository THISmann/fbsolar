import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher';
import './Header.scss';

export function Header() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/projets', label: t('nav.projects') },
    { to: '/produits', label: t('nav.products') },
    { to: '/a-propos', label: t('nav.about') },
    { to: '/expertises', label: t('nav.expertises') },
    { to: '/contact', label: t('nav.contact') },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle('nav-open', open);
    return () => document.documentElement.classList.remove('nav-open');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`header ${scrolled || !isHome || open ? 'header--solid' : ''} ${open ? 'header--open' : ''}`}>
      <div className="header__inner container--wide">
        <Link to="/" className="brand" aria-label={t('nav.brandHome')}>
          <img
            className="brand__logo"
            src="/brand/fb-solar-logo.png"
            alt={t('common.brandFull')}
            width={220}
            height={72}
          />
        </Link>

        <button
          type="button"
          className="header__toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? t('nav.closeMenu') : t('nav.openMenu')}</span>
          <span className="header__toggle-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <nav id="site-nav" className="header__nav" aria-label={t('nav.main')}>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'}>
              {link.label}
            </NavLink>
          ))}
          <div className="header__nav-lang">
            <LanguageSwitcher compact />
          </div>
          <a className="header__nav-phone" href="tel:+33123456789">
            01 23 45 67 89
          </a>
        </nav>

        <div className="header__end">
          <div className="header__lang-mobile">
            <LanguageSwitcher compact />
          </div>
          <a className="header__phone" href="tel:+33123456789">
            01 23 45 67 89
          </a>
        </div>
      </div>
    </header>
  );
}
