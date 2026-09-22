import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, isSafeHttpUrl, sanitizeText, type SitePage } from '../lib/api';
import { toWhatsAppNumber } from '../components/WhatsAppFloat';
import { ImageUploadField } from './ImageUploadField';

type Props = {
  pageKey: 'home' | 'about' | 'expertises';
};

const HEADING_KEYS: Record<Props['pageKey'], string> = {
  home: 'admin.pages.homeHeading',
  about: 'admin.pages.aboutHeading',
  expertises: 'admin.pages.expertisesHeading',
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asItems(value: unknown): Array<{ title: string; text: string }> {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return { title: '', text: '' };
    const row = item as Record<string, unknown>;
    return { title: asString(row.title), text: asString(row.text) };
  });
}

function asParagraphs(value: unknown): string[] {
  if (!Array.isArray(value)) return [''];
  return value.map((p) => asString(p));
}

export function PageEditor({ pageKey }: Props) {
  const { t } = useTranslation();
  const heading = useMemo(() => t(HEADING_KEYS[pageKey]), [pageKey, t]);
  const [title, setTitle] = useState('');
  const [data, setData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .page(pageKey)
      .then((page: SitePage) => {
        if (!alive) return;
        setTitle(page.title);
        setData(page.data ?? {});
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : t('admin.pages.loadError'));
      });
    return () => {
      alive = false;
    };
  }, [pageKey, t]);

  function setField(key: string, value: unknown) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);

    const next: Record<string, unknown> = { ...data };
    for (const [key, value] of Object.entries(next)) {
      if (typeof value === 'string') {
        const cleaned = sanitizeText(value, key.toLowerCase().includes('image') ? 1000 : 5000);
        if (key.toLowerCase().includes('image') && cleaned && !isSafeHttpUrl(cleaned)) {
          setError(`URL invalide pour ${key}`);
          setSaving(false);
          return;
        }
        next[key] = cleaned;
      }
    }

    if (pageKey === 'home' && next.whatsappEnabled !== false) {
      const phone = typeof next.whatsappPhone === 'string' ? next.whatsappPhone : '';
      if (!toWhatsAppNumber(phone)) {
        setError('Numéro WhatsApp invalide (format international, 8 à 15 chiffres)');
        setSaving(false);
        return;
      }
    }

    try {
      await api.savePage(pageKey, { title: sanitizeText(title, 200), data: next });
      setOk(t('admin.pages.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.pages.saveError'));
    } finally {
      setSaving(false);
    }
  }

  const expertises = asItems(data.expertises ?? data.items);
  const paragraphs = asParagraphs(data.paragraphs);

  return (
    <div>
      <h1>{heading}</h1>
      <p className="lead">Modifier les textes et images affichés sur la vitrine.</p>

      <form className="admin-form" onSubmit={onSubmit}>
        <label>
          {t('admin.pages.title')}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </label>

        {pageKey === 'home' && (
          <>
            <div className="admin-panel">
              <h2>WhatsApp</h2>
              <div className="admin-form__checks">
                <label>
                  <input
                    type="checkbox"
                    checked={data.whatsappEnabled !== false}
                    onChange={(e) => setField('whatsappEnabled', e.target.checked)}
                  />
                  Afficher le bouton WhatsApp sur l’accueil
                </label>
              </div>
              <label>
                Numéro WhatsApp (format international, ex. +33 6 12 34 56 78)
                <input
                  value={asString(data.whatsappPhone)}
                  onChange={(e) => setField('whatsappPhone', e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                  maxLength={30}
                />
              </label>
              <label>
                Message prérempli (optionnel)
                <textarea
                  rows={2}
                  maxLength={500}
                  value={asString(data.whatsappMessage)}
                  onChange={(e) => setField('whatsappMessage', e.target.value)}
                />
              </label>
            </div>
            <label>
              Hero — eyebrow
              <input value={asString(data.heroEyebrow)} onChange={(e) => setField('heroEyebrow', e.target.value)} />
            </label>
            <label>
              Hero — titre
              <input value={asString(data.heroTitle)} onChange={(e) => setField('heroTitle', e.target.value)} />
            </label>
            <label>
              Hero — texte
              <textarea rows={3} value={asString(data.heroLead)} onChange={(e) => setField('heroLead', e.target.value)} />
            </label>
            <ImageUploadField
              label="Hero — image"
              value={asString(data.heroImage)}
              onChange={(url) => setField('heroImage', url)}
              hint={t('admin.media.hint')}
            />
            <label>
              À propos — titre
              <input value={asString(data.aboutTitle)} onChange={(e) => setField('aboutTitle', e.target.value)} />
            </label>
            <label>
              À propos — texte
              <textarea rows={3} value={asString(data.aboutText)} onChange={(e) => setField('aboutText', e.target.value)} />
            </label>
            <label>
              Expertises — titre
              <input value={asString(data.expertiseTitle)} onChange={(e) => setField('expertiseTitle', e.target.value)} />
            </label>
            {expertises.map((item, index) => (
              <div className="admin-form__row" key={`exp-${index}`}>
                <label>
                  Expertise {index + 1} — titre
                  <input
                    value={item.title}
                    onChange={(e) => {
                      const next = [...expertises];
                      next[index] = { ...next[index], title: e.target.value };
                      setField('expertises', next);
                    }}
                  />
                </label>
                <label>
                  Texte
                  <input
                    value={item.text}
                    onChange={(e) => {
                      const next = [...expertises];
                      next[index] = { ...next[index], text: e.target.value };
                      setField('expertises', next);
                    }}
                  />
                </label>
              </div>
            ))}
            <label>
              Projets — titre
              <input value={asString(data.projectsTitle)} onChange={(e) => setField('projectsTitle', e.target.value)} />
            </label>
            <label>
              Projets — texte
              <textarea
                rows={3}
                value={asString(data.projectsText)}
                onChange={(e) => setField('projectsText', e.target.value)}
              />
            </label>
            <label>
              Story — titre
              <input value={asString(data.storyTitle)} onChange={(e) => setField('storyTitle', e.target.value)} />
            </label>
            <label>
              Story — texte
              <textarea rows={2} value={asString(data.storyText)} onChange={(e) => setField('storyText', e.target.value)} />
            </label>
            <ImageUploadField
              label="Story — image"
              value={asString(data.storyImage)}
              onChange={(url) => setField('storyImage', url)}
              hint={t('admin.media.hint')}
            />
            <label>
              Équipe — titre
              <input value={asString(data.teamTitle)} onChange={(e) => setField('teamTitle', e.target.value)} />
            </label>
            <label>
              Équipe — texte
              <textarea rows={3} value={asString(data.teamText)} onChange={(e) => setField('teamText', e.target.value)} />
            </label>
          </>
        )}

        {pageKey === 'about' && (
          <>
            <label>
              Eyebrow
              <input value={asString(data.eyebrow)} onChange={(e) => setField('eyebrow', e.target.value)} />
            </label>
            <label>
              Titre
              <input value={asString(data.title)} onChange={(e) => setField('title', e.target.value)} />
            </label>
            <ImageUploadField
              label={t('admin.pages.image')}
              value={asString(data.image)}
              onChange={(url) => setField('image', url)}
              hint={t('admin.media.hint')}
            />
            {paragraphs.map((p, index) => (
              <label key={`p-${index}`}>
                Paragraphe {index + 1}
                <textarea
                  rows={4}
                  value={p}
                  onChange={(e) => {
                    const next = [...paragraphs];
                    next[index] = e.target.value;
                    setField('paragraphs', next);
                  }}
                />
              </label>
            ))}
          </>
        )}

        {pageKey === 'expertises' && (
          <>
            <label>
              Eyebrow
              <input value={asString(data.eyebrow)} onChange={(e) => setField('eyebrow', e.target.value)} />
            </label>
            <label>
              Titre
              <input value={asString(data.title)} onChange={(e) => setField('title', e.target.value)} />
            </label>
            <label>
              Chapô
              <textarea rows={2} value={asString(data.lead)} onChange={(e) => setField('lead', e.target.value)} />
            </label>
            {expertises.map((item, index) => (
              <div key={`item-${index}`} className="admin-panel">
                <label>
                  Titre
                  <input
                    value={item.title}
                    onChange={(e) => {
                      const next = [...expertises];
                      next[index] = { ...next[index], title: e.target.value };
                      setField('items', next);
                    }}
                  />
                </label>
                <label>
                  Texte
                  <textarea
                    rows={3}
                    value={item.text}
                    onChange={(e) => {
                      const next = [...expertises];
                      next[index] = { ...next[index], text: e.target.value };
                      setField('items', next);
                    }}
                  />
                </label>
              </div>
            ))}
          </>
        )}

        {error && <p className="status status--error">{error}</p>}
        {ok && <p className="status status--ok">{ok}</p>}

        <button className="btn btn--solid" type="submit" disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </div>
  );
}
