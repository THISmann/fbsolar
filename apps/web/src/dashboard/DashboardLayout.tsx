import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { type Permission } from '../lib/permissions';
import { AdminIcon, type IconName } from './AdminIcons';
import './dashboard.scss';

const COLLAPSE_KEY = 'solar.admin.navCollapsed';

type NavLinkItem = {
  to: string;
  end?: boolean;
  labelKey: string;
  icon: IconName;
  permission?: Permission;
  superOnly?: boolean;
};

type NavGroup = {
  id: string;
  labelKey: string;
  icon: IconName;
  children: NavLinkItem[];
};

const topLinks: NavLinkItem[] = [
  { to: '/admin/visites', labelKey: 'admin.nav.visits', icon: 'visits', permission: 'visits.read' },
  { to: '/admin/produits', labelKey: 'admin.nav.products', icon: 'products', permission: 'products.write' },
  { to: '/admin/projets', labelKey: 'admin.nav.projects', icon: 'projects', permission: 'projects.write' },
  { to: '/admin/reseaux', labelKey: 'admin.nav.social', icon: 'social', permission: 'projects.write' },
];

const siteGroup: NavGroup = {
  id: 'site',
  labelKey: 'admin.nav.site',
  icon: 'site',
  children: [
    { to: '/admin/accueil', labelKey: 'admin.nav.home', icon: 'home', permission: 'pages.write' },
    { to: '/admin/a-propos', labelKey: 'admin.nav.about', icon: 'about', permission: 'pages.write' },
    { to: '/admin/contacts', labelKey: 'admin.nav.contacts', icon: 'contacts', permission: 'contacts.read' },
  ],
};

const afterSiteLinks: NavLinkItem[] = [
  { to: '/admin/expertises', labelKey: 'admin.nav.expertises', icon: 'expertises', permission: 'pages.write' },
  { to: '/admin/whatsapp', labelKey: 'admin.nav.whatsapp', icon: 'whatsapp', permission: 'pages.write' },
  { to: '/admin/utilisateurs', labelKey: 'admin.nav.users', icon: 'users', superOnly: true },
  { to: '/admin/audit', labelKey: 'admin.nav.audit', icon: 'audit', superOnly: true },
];

function canSee(
  link: NavLinkItem,
  can: (p: Permission) => boolean,
  isSuperAdmin: boolean,
): boolean {
  if (link.superOnly) return isSuperAdmin;
  if (link.permission) return can(link.permission);
  return true;
}

export function DashboardLayout() {
  const { t } = useTranslation();
  const { user, logout, can, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [siteOpen, setSiteOpen] = useState(true);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle('admin-nav-open', menuOpen);
    return () => document.documentElement.classList.remove('admin-nav-open');
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const visibleTop = useMemo(
    () => topLinks.filter((link) => canSee(link, can, isSuperAdmin)),
    [can, isSuperAdmin],
  );
  const visibleSite = useMemo(
    () => siteGroup.children.filter((link) => canSee(link, can, isSuperAdmin)),
    [can, isSuperAdmin],
  );
  const visibleAfter = useMemo(
    () => afterSiteLinks.filter((link) => canSee(link, can, isSuperAdmin)),
    [can, isSuperAdmin],
  );

  const siteActive = visibleSite.some((link) => location.pathname.startsWith(link.to));

  useEffect(() => {
    if (siteActive) setSiteOpen(true);
  }, [siteActive]);

  const roleLabel = user?.role
    ? t(`admin.roles.${user.role === 'ADMIN' ? 'SUPER_ADMIN' : user.role}`)
    : '';

  function renderLink(link: NavLinkItem) {
    const label = t(link.labelKey);
    return (
      <li key={link.to}>
        <NavLink to={link.to} end={link.end} title={label} aria-label={label}>
          <AdminIcon name={link.icon} size={18} />
          <span className="admin-nav__label">{label}</span>
        </NavLink>
      </li>
    );
  }

  return (
    <div
      className={[
        'admin-shell',
        menuOpen ? 'admin-shell--open' : '',
        collapsed ? 'admin-shell--collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-topbar__toggle"
          aria-expanded={menuOpen}
          aria-controls="admin-nav"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="sr-only">{menuOpen ? t('admin.closeMenu') : t('admin.openMenu')}</span>
          <span />
          <span />
          <span />
        </button>
        <div className="admin-topbar__brand">
          <img src="/brand/fb-solar-logo.png" alt={t('common.brandFull')} width={160} height={52} />
        </div>
      </header>

      <button
        type="button"
        className="admin-backdrop"
        aria-label={t('admin.closeMenu')}
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />

      <aside id="admin-nav" className="admin-side">
        <div className="admin-side__brand">
          <img src="/brand/fb-solar-logo.png" alt={t('common.brandFull')} width={180} height={60} />
          <span className="admin-nav__label">{t('admin.brandSub')}</span>
        </div>

        <button
          type="button"
          className="admin-side__collapse"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? t('admin.expandNav') : t('admin.collapseNav')}
          aria-label={collapsed ? t('admin.expandNav') : t('admin.collapseNav')}
          aria-pressed={collapsed}
        >
          <AdminIcon name={collapsed ? 'expand' : 'collapse'} size={18} />
          <span className="admin-nav__label">{collapsed ? t('admin.expandNav') : t('admin.collapseNav')}</span>
        </button>

        <nav aria-label={t('admin.navAria')}>
          <ul className="admin-nav">
            {visibleTop.map(renderLink)}

            {visibleSite.length > 0 && (
              <li
                className={[
                  'admin-nav__group',
                  siteOpen ? 'is-open' : '',
                  siteActive ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="admin-nav__group-head">
                  <button
                    type="button"
                    className="admin-nav__group-title"
                    title={t(siteGroup.labelKey)}
                    aria-expanded={siteOpen}
                    aria-controls="admin-nav-site"
                    onClick={() => setSiteOpen((open) => !open)}
                  >
                    <AdminIcon name={siteGroup.icon} size={18} />
                    <span className="admin-nav__label">{t(siteGroup.labelKey)}</span>
                  </button>
                  <button
                    type="button"
                    className="admin-nav__group-toggle"
                    aria-expanded={siteOpen}
                    aria-controls="admin-nav-site"
                    onClick={() => setSiteOpen((open) => !open)}
                    title={siteOpen ? t('admin.collapseSection') : t('admin.expandSection')}
                    aria-label={siteOpen ? t('admin.collapseSection') : t('admin.expandSection')}
                  >
                    <AdminIcon name="chevron" size={14} />
                  </button>
                </div>
                <ul id="admin-nav-site" className="admin-nav__sub">
                  {visibleSite.map(renderLink)}
                </ul>
              </li>
            )}

            {visibleAfter.map(renderLink)}
          </ul>
        </nav>

        <div className="admin-side__foot">
          <LanguageSwitcher compact />
          <span className="admin-side__email admin-nav__label">{user?.email}</span>
          <span className="admin-nav__label">
            {roleLabel}
            {user?.jobTitle ? ` · ${user.jobTitle}` : ''}
          </span>
          <button type="button" onClick={() => void logout()} title={t('common.logout')}>
            <AdminIcon name="logout" size={16} />
            <span className="admin-nav__label">{t('common.logout')}</span>
          </button>
          <a href="/" target="_blank" rel="noreferrer" title={t('common.seeSite')}>
            <AdminIcon name="external" size={16} />
            <span className="admin-nav__label">{t('common.seeSite')}</span>
          </a>
        </div>
      </aside>

      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
}
