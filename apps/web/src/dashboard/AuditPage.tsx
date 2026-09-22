import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type AdminSession, type AuditLog } from '../lib/api';
import { type StaffRole } from '../lib/permissions';

export function AuditPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function formatDate(value?: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleString(locale);
  }

  function duration(loginAt: string, endAt?: string | null) {
    const start = new Date(loginAt).getTime();
    const end = endAt ? new Date(endAt).getTime() : Date.now();
    const mins = Math.max(0, Math.round((end - start) / 60_000));
    if (mins < 60) return t('admin.audit.min', { count: mins });
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return t('admin.audit.hours', { h, m });
  }

  function roleLabel(role: StaffRole) {
    const key = role === 'ADMIN' ? 'SUPER_ADMIN' : role;
    return t(`admin.roles.${key}`);
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.listAudit(1, 100), api.listSessions(1, 100)])
      .then(([audit, sess]) => {
        if (!alive) return;
        setAudits(audit.items);
        setSessions(sess.items);
        setError(null);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : t('admin.audit.loadError'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [t]);

  return (
    <div>
      <h1>{t('admin.audit.title')}</h1>
      <p className="lead">{t('admin.audit.lead')}</p>

      {error && <p className="status status--error">{error}</p>}
      {loading && <p className="status">{t('common.loading')}</p>}

      {!loading && (
        <>
          <div className="admin-panel">
            <h2>{t('admin.audit.sessions')}</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.audit.user')}</th>
                  <th>{t('admin.audit.role')}</th>
                  <th>{t('admin.audit.login')}</th>
                  <th>{t('admin.audit.lastSeen')}</th>
                  <th>{t('admin.audit.logoutAt')}</th>
                  <th>{t('admin.audit.duration')}</th>
                  <th>{t('admin.audit.ip')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{session.user?.email ?? session.userId}</td>
                    <td>
                      {session.user?.role
                        ? roleLabel(session.user.role as StaffRole)
                        : '—'}
                    </td>
                    <td>{formatDate(session.loginAt)}</td>
                    <td>{formatDate(session.lastSeenAt)}</td>
                    <td>{formatDate(session.logoutAt)}</td>
                    <td>{duration(session.loginAt, session.logoutAt)}</td>
                    <td>{session.ip || '—'}</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={7}>{t('common.none')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="admin-panel">
            <h2>{t('admin.audit.actions')}</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.audit.date')}</th>
                  <th>{t('admin.audit.actor')}</th>
                  <th>{t('admin.audit.action')}</th>
                  <th>{t('admin.audit.resource')}</th>
                  <th>{t('admin.audit.ip')}</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.actorEmail}</td>
                    <td>{item.action}</td>
                    <td>
                      {item.resource}
                      {item.resourceId ? ` · ${item.resourceId}` : ''}
                    </td>
                    <td>{item.ip || '—'}</td>
                  </tr>
                ))}
                {audits.length === 0 && (
                  <tr>
                    <td colSpan={5}>{t('common.none')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
