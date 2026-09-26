import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type ContactMessage, type ContactsResponse } from '../lib/api';
import { useRealtimeRefresh } from '../realtime/RealtimeProvider';
import { IconButton } from './AdminIcons';

export function ContactsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR';
  const [data, setData] = useState<ContactsResponse | null>(null);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const next = await api.contacts(1, 50);
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.contacts.loadError'));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useRealtimeRefresh(['contact'], () => void load());

  async function openMessage(id: string) {
    try {
      const msg = await api.contactOne(id);
      setSelected(msg);
      if (!msg.readAt) {
        await api.markContactRead(id);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.contacts.readError'));
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t('admin.contacts.deleteConfirm'))) return;
    try {
      await api.deleteContact(id);
      if (selected?.id === id) setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.contacts.deleteError'));
    }
  }

  return (
    <div className="admin-contacts">
      <h1>{t('admin.contacts.title')}</h1>
      <p className="lead">
        {t('admin.contacts.lead')}
        {data ? t('admin.contacts.stats', { unread: data.unread, total: data.total }) : ''}
      </p>

      {error && <p className="status status--error">{error}</p>}

      <div className="admin-panel admin-contacts__table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.contacts.date')}</th>
              <th>{t('admin.contacts.name')}</th>
              <th>{t('admin.contacts.email')}</th>
              <th>{t('common.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.createdAt).toLocaleString(locale)}</td>
                <td>{item.name}</td>
                <td>
                  <a href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a>
                </td>
                <td>
                  <span className={`admin-badge ${item.readAt ? 'admin-badge--ok' : 'admin-badge--warn'}`}>
                    {item.readAt ? t('common.read') : t('common.new')}
                  </span>
                </td>
                <td className="actions">
                  <IconButton icon="eye" label={t('common.open')} onClick={() => void openMessage(item.id)} />
                  <IconButton
                    icon="trash"
                    label={t('common.delete')}
                    tone="danger"
                    onClick={() => void remove(item.id)}
                  />
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={5}>{t('admin.contacts.empty')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-contacts__cards">
        {data?.items.map((item) => (
          <article key={item.id} className="admin-contact-card">
            <div className="admin-contact-card__top">
              <div>
                <strong>{item.name}</strong>
                <p>{new Date(item.createdAt).toLocaleString(locale)}</p>
              </div>
              <span className={`admin-badge ${item.readAt ? 'admin-badge--ok' : 'admin-badge--warn'}`}>
                {item.readAt ? t('common.read') : t('common.new')}
              </span>
            </div>
            <a className="admin-contact-card__email" href={`mailto:${encodeURIComponent(item.email)}`}>
              {item.email}
            </a>
            <div className="actions">
              <IconButton icon="eye" label={t('common.open')} onClick={() => void openMessage(item.id)} />
              <IconButton
                icon="trash"
                label={t('common.delete')}
                tone="danger"
                onClick={() => void remove(item.id)}
              />
            </div>
          </article>
        ))}
        {data && data.items.length === 0 && (
          <p className="status">{t('admin.contacts.empty')}</p>
        )}
      </div>

      {selected && (
        <div className="admin-panel admin-contacts__detail">
          <h2>{selected.name}</h2>
          <p>
            <a href={`mailto:${encodeURIComponent(selected.email)}`}>{selected.email}</a>
            {selected.phone ? ` · ${selected.phone}` : ''}
          </p>
          <p className="admin-msg">{selected.message}</p>
        </div>
      )}
    </div>
  );
}
