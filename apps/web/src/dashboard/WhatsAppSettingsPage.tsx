import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toWhatsAppNumber } from '../components/WhatsAppFloat';
import { api, sanitizeText, type SitePage } from '../lib/api';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function WhatsAppSettingsPage() {
  const { t } = useTranslation();
  const [pageTitle, setPageTitle] = useState('');
  const [data, setData] = useState<Record<string, unknown>>({});
  const [enabled, setEnabled] = useState(true);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .page('home')
      .then((page: SitePage) => {
        if (!alive) return;
        const payload = page.data ?? {};
        setPageTitle(page.title || t('admin.nav.home'));
        setData(payload);
        setEnabled(payload.whatsappEnabled !== false);
        setPhone(asString(payload.whatsappPhone, '+33 6 12 34 56 78'));
        setMessage(asString(payload.whatsappMessage, ''));
        setError(null);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : t('admin.pages.loadError'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [t]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);

    const cleanPhone = sanitizeText(phone, 30);
    const cleanMessage = sanitizeText(message, 500);

    if (enabled && !toWhatsAppNumber(cleanPhone)) {
      setError('Numéro WhatsApp invalide (format international, 8 à 15 chiffres)');
      setSaving(false);
      return;
    }

    try {
      await api.savePage('home', {
        title: pageTitle,
        data: {
          ...data,
          whatsappEnabled: enabled,
          whatsappPhone: cleanPhone,
          whatsappMessage: cleanMessage,
        },
      });
      setData((prev) => ({
        ...prev,
        whatsappEnabled: enabled,
        whatsappPhone: cleanPhone,
        whatsappMessage: cleanMessage,
      }));
      setOk(t('admin.whatsapp.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.whatsapp.saveError'));
    } finally {
      setSaving(false);
    }
  }

  const preview = toWhatsAppNumber(phone);

  return (
    <div>
      <h1>{t('admin.whatsapp.title')}</h1>
      <p className="lead">{t('admin.whatsapp.lead')}</p>

      {loading && <p className="status">{t('common.loading')}</p>}

      {!loading && (
        <form className="admin-form" onSubmit={onSubmit}>
          <div className="admin-panel">
            <div className="admin-form__checks">
              <label>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                {t('admin.whatsapp.enabled')}
              </label>
            </div>

            <label>
              {t('admin.whatsapp.phone')}
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                maxLength={30}
                required={enabled}
                inputMode="tel"
                autoComplete="tel"
              />
            </label>

            <label>
              {t('admin.whatsapp.message')}
              <textarea
                rows={3}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>

            {preview && (
              <p className="status status--ok">
                <a
                  href={`https://wa.me/${preview}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  wa.me/{preview}
                </a>
              </p>
            )}
          </div>

          {error && <p className="status status--error">{error}</p>}
          {ok && <p className="status status--ok">{ok}</p>}

          <button className="btn btn--solid" type="submit" disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      )}
    </div>
  );
}
