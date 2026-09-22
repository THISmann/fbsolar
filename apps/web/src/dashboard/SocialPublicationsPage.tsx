import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  api,
  type SocialNetwork,
  type SocialOverview,
  type SocialPublication,
} from '../lib/api';
import { IconButton, IconLink } from './AdminIcons';

export function SocialPublicationsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SocialOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const networkLabel = (network: SocialNetwork) => {
    if (network === 'FACEBOOK') return t('admin.social.facebook');
    if (network === 'INSTAGRAM') return t('admin.social.instagram');
    return t('admin.social.linkedin');
  };

  function statusBadge(pub: SocialPublication | null | undefined, enabled: boolean) {
    if (!enabled) {
      return <span className="admin-badge">{t('admin.social.soon')}</span>;
    }
    if (!pub) {
      return <span className="admin-badge">{t('admin.social.notPublished')}</span>;
    }
    if (pub.status === 'PUBLISHED') {
      return <span className="admin-badge admin-badge--ok">{t('common.published')}</span>;
    }
    if (pub.status === 'PENDING') {
      return <span className="admin-badge">{t('admin.social.pending')}</span>;
    }
    return <span className="admin-badge admin-badge--warn">{t('admin.social.failed')}</span>;
  }

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.socialOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.catalog.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.items.some((row) =>
      Object.values(row.publications).some((p) => p?.status === 'PENDING'),
    )) {
      return;
    }
    const timer = window.setInterval(() => {
      void load();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [data, load]);

  async function publish(productId: string, network: SocialNetwork, force = false) {
    const net = data?.networks.find((n) => n.id === network);
    if (!net?.enabled) return;

    const current = data?.items.find((i) => i.product.id === productId)?.publications[network];
    let useForce = force;
    if (current?.status === 'PUBLISHED' && !useForce) {
      if (!window.confirm(t('admin.social.republishConfirm', { network: networkLabel(network) }))) return;
      useForce = true;
    }

    setBusyId(`${productId}:${network}`);
    setError(null);
    try {
      await api.publishSocial(productId, { networks: [network], force: useForce });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.social.publishError'));
    } finally {
      setBusyId(null);
    }
  }

  const facebookConfigured = data?.networks.find((n) => n.id === 'FACEBOOK')?.configured;

  return (
    <div>
      <h1>{t('admin.social.title')}</h1>
      <p className="lead">{t('admin.social.lead')}</p>

      {facebookConfigured === false && (
        <p className="status status--error">{t('admin.social.notConfigured')}</p>
      )}

      {error && <p className="status status--error">{error}</p>}
      {loading && <p className="status">{t('common.loading')}</p>}

      {!loading && data && (
        <div className="admin-panel">
          <div className="admin-toolbar" style={{ marginBottom: '1rem' }}>
            <p className="lead" style={{ margin: 0, flex: 1 }}>
              {t('admin.social.count', { count: data.items.length })}
            </p>
            <div className="actions">
              <button type="button" className="btn" onClick={() => void load()}>
                {t('common.refresh')}
              </button>
              <Link className="btn btn--solid" to="/admin/projets">
                {t('admin.social.manageProjects')}
              </Link>
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.social.project')}</th>
                <th>{t('admin.social.facebook')}</th>
                <th>{t('admin.social.instagram')}</th>
                <th>{t('admin.social.linkedin')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const fb = row.publications.FACEBOOK;
                const busyFb = busyId === `${row.product.id}:FACEBOOK` || fb?.status === 'PENDING';
                return (
                  <tr key={row.product.id}>
                    <td>
                      <strong>{row.product.name}</strong>
                      <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{row.product.slug}</div>
                    </td>
                    <td>
                      {statusBadge(fb, true)}
                      {fb?.error && (
                        <div style={{ color: '#9b2c2c', fontSize: '0.78rem', marginTop: '0.25rem', maxWidth: '14rem' }}>
                          {fb.error}
                        </div>
                      )}
                      {fb?.postUrl && fb.status === 'PUBLISHED' && (
                        <div style={{ marginTop: '0.35rem' }}>
                          <a href={fb.postUrl} target="_blank" rel="noreferrer noopener">
                            {t('admin.social.viewPost')}
                          </a>
                        </div>
                      )}
                    </td>
                    <td>{statusBadge(row.publications.INSTAGRAM, false)}</td>
                    <td>{statusBadge(row.publications.LINKEDIN, false)}</td>
                    <td className="actions">
                      <IconButton
                        icon="plus"
                        label={
                          fb?.status === 'PUBLISHED'
                            ? t('admin.social.republishFb')
                            : t('admin.social.publishFb')
                        }
                        tone="ok"
                        disabled={Boolean(busyFb || facebookConfigured === false)}
                        onClick={() => void publish(row.product.id, 'FACEBOOK')}
                      />
                      <IconLink
                        to={`/admin/projets/${row.product.id}`}
                        icon="edit"
                        label={t('admin.social.editProject')}
                      />
                    </td>
                  </tr>
                );
              })}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={5}>{t('admin.social.empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
