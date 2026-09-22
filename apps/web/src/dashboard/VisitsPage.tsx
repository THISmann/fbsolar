import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type VisitStats } from '../lib/api';

export function VisitsPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let alive = true;
    setError(null);
    api
      .visitStats(days)
      .then((data) => {
        if (alive) setStats(data);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : t('admin.visits.loadError'));
      });
    return () => {
      alive = false;
    };
  }, [days, t]);

  const maxPath = Math.max(1, ...(stats?.byPath.map((p) => p.count) ?? [1]));

  return (
    <div>
      <h1>{t('admin.visits.title')}</h1>
      <p className="lead">{t('admin.visits.lead', { days })}</p>

      <div className="admin-toolbar">
        <label>
          {t('admin.visits.day')}{' '}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7</option>
            <option value={30}>30</option>
            <option value={90}>90</option>
          </select>
        </label>
      </div>

      {error && <p className="status status--error">{error}</p>}

      {stats && (
        <>
          <div className="admin-stats">
            <div className="admin-stat">
              <span>{t('admin.visits.total')}</span>
              <strong>{stats.totalViews}</strong>
            </div>
            <div className="admin-stat">
              <span>{t('admin.visits.unique')}</span>
              <strong>{stats.uniqueVisitors}</strong>
            </div>
            <div className="admin-stat">
              <span>{t('admin.visits.path')}</span>
              <strong>{stats.byPath.length}</strong>
            </div>
          </div>

          <div className="admin-panel">
            <h2>{t('admin.visits.byPath')}</h2>
            <div className="admin-bars">
              {stats.byPath.slice(0, 12).map((row) => (
                <div className="admin-bar" key={row.path}>
                  <span>{row.path}</span>
                  <div className="admin-bar__track">
                    <div
                      className="admin-bar__fill"
                      style={{ width: `${Math.round((row.count / maxPath) * 100)}%` }}
                    />
                  </div>
                  <strong>{row.count}</strong>
                </div>
              ))}
              {stats.byPath.length === 0 && <p className="status">{t('common.none')}</p>}
            </div>
          </div>

          <div className="admin-panel">
            <h2>{t('admin.visits.byDay')}</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.visits.day')}</th>
                  <th>{t('admin.visits.views')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.byDay.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
