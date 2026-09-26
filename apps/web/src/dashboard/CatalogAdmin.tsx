import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  api,
  isSafeHttpUrl,
  sanitizeText,
  type Category,
  type Product,
  type ProductInput,
  type ProductKind,
  type SocialPublication,
} from '../lib/api';
import { useRealtimeRefresh } from '../realtime/RealtimeProvider';
import { IconButton, IconLink } from './AdminIcons';
import { ImageUploadField } from './ImageUploadField';

type Props = {
  kind: ProductKind;
  basePath: string;
  title?: string;
};

const emptyForm = (kind: ProductKind): ProductInput => ({
  slug: '',
  name: '',
  description: '',
  price: 0,
  categoryId: '',
  images: [],
  published: true,
  kind,
});

export function CatalogListPage({ kind, basePath }: Props) {
  const { t } = useTranslation();
  const title = kind === 'PROJECT' ? t('admin.nav.projects') : t('admin.nav.products');
  const lead = kind === 'PROJECT' ? t('admin.catalog.projectsLead') : t('admin.catalog.productsLead');
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(q = search) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminProducts({ kind, limit: 100, search: q || undefined });
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.catalog.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('');
  }, [kind]);

  useRealtimeRefresh(
    kind === 'PROJECT' ? ['project', 'product'] : ['product'],
    () => void load(),
  );

  async function onDelete(id: string, name: string) {
    if (!window.confirm(t('admin.catalog.deleteConfirm', { name }))) return;
    try {
      await api.deleteProduct(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.catalog.deleteError'));
    }
  }

  return (
    <div>
      <h1>{title}</h1>
      <p className="lead">{lead}</p>

      <div className="admin-toolbar">
        <input
          type="search"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void load();
          }}
        />
        <div className="actions">
          <button type="button" className="btn" onClick={() => void load()}>
            {t('common.filter')}
          </button>
          <Link className="btn btn--solid" to={`${basePath}/nouveau`}>
            {t('admin.catalog.add')}
          </Link>
        </div>
      </div>

      {error && <p className="status status--error">{error}</p>}
      {loading && <p className="status">{t('common.loading')}</p>}

      {!loading && (
        <div className="admin-panel">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.catalog.name')}</th>
                <th>{t('admin.catalog.slug')}</th>
                <th>{t('admin.catalog.category')}</th>
                <th>{t('admin.catalog.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.slug}</td>
                  <td>{item.category?.name ?? '—'}</td>
                  <td>
                    <span className={`admin-badge ${item.published ? 'admin-badge--ok' : 'admin-badge--warn'}`}>
                      {item.published ? t('common.published') : t('common.draft')}
                    </span>
                  </td>
                  <td className="actions">
                    <IconLink to={`${basePath}/${item.id}`} icon="edit" label={t('common.edit')} />
                    <IconButton
                      icon="trash"
                      label={t('common.delete')}
                      tone="danger"
                      onClick={() => void onDelete(item.id, item.name)}
                    />
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5}>{t('admin.catalog.empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function latestFacebook(items: SocialPublication[]): SocialPublication | undefined {
  return items.find((row) => row.network === 'FACEBOOK');
}

export function CatalogEditPage({ kind, basePath }: Props) {
  const { t } = useTranslation();
  const entityTitle = kind === 'PROJECT' ? t('admin.nav.projects') : t('admin.nav.products');
  const { id } = useParams();
  const isNew = !id || id === 'nouveau';
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductInput>(emptyForm(kind));
  const [imageDraft, setImageDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [social, setSocial] = useState<SocialPublication[]>([]);
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialMsg, setSocialMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.categories().then((cats) => {
      if (!alive) return;
      setCategories(cats);
      setForm((prev) => ({
        ...prev,
        categoryId: prev.categoryId || cats[0]?.id || '',
      }));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (isNew) {
      setForm(emptyForm(kind));
      setSocial([]);
      return;
    }
    let alive = true;
    api
      .adminProduct(id!)
      .then((product) => {
        if (!alive) return;
        setForm({
          slug: product.slug,
          name: product.name,
          description: product.description,
          price: Number(product.price) || 0,
          categoryId: product.category?.id || product.categoryId || '',
          images: product.images ?? [],
          published: product.published,
          kind: (product.kind as ProductKind) || kind,
        });
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : t('admin.catalog.loadError'));
      });

    if (kind === 'PROJECT') {
      api
        .socialStatus(id!)
        .then((res) => {
          if (alive) setSocial(res.items);
        })
        .catch(() => {
          if (alive) setSocial([]);
        });
    }

    return () => {
      alive = false;
    };
  }, [id, isNew, kind, t]);

  useEffect(() => {
    if (isNew || kind !== 'PROJECT') return;
    const pending = social.some((row) => row.status === 'PENDING');
    if (!pending) return;
    const timer = window.setInterval(() => {
      void api
        .socialStatus(id!)
        .then((res) => setSocial(res.items))
        .catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [id, isNew, kind, social]);

  function update<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addImage(urlRaw?: string) {
    const url = sanitizeText(urlRaw ?? imageDraft, 1000);
    if (!url || !isSafeHttpUrl(url)) {
      setError(t('admin.catalog.invalidImage'));
      return;
    }
    // New image becomes primary (vitrine uses images[0])
    setForm((prev) => ({
      ...prev,
      images: [url, ...prev.images.filter((src) => src !== url)],
    }));
    setImageDraft('');
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const draft = sanitizeText(imageDraft, 1000);
    const draftOk = draft && isSafeHttpUrl(draft) ? draft : null;
    const images = [
      ...(draftOk ? [draftOk] : []),
      ...form.images.filter((src) => src !== draftOk && isSafeHttpUrl(src)),
    ];
    const payload: ProductInput = {
      slug: sanitizeText(form.slug, 120).toLowerCase().replace(/\s+/g, '-'),
      name: sanitizeText(form.name, 200),
      description: sanitizeText(form.description, 5000),
      price: Math.max(0, Number(form.price) || 0),
      categoryId: form.categoryId,
      images,
      published: form.published,
      kind,
    };
    if (!payload.slug || !payload.name || !payload.categoryId) {
      setError(t('admin.catalog.requiredFields'));
      setSaving(false);
      return;
    }
    try {
      if (isNew) await api.createProduct(payload);
      else await api.updateProduct(id!, payload);
      navigate(basePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.catalog.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function publishFacebook(force = false) {
    if (!id || isNew) return;
    const current = latestFacebook(social);
    let useForce = force;
    if (current?.status === 'PUBLISHED' && !useForce) {
      if (!window.confirm(t('admin.catalog.republishConfirm'))) return;
      useForce = true;
    }
    setSocialBusy(true);
    setSocialMsg(null);
    setError(null);
    try {
      const res = await api.publishSocial(id, { networks: ['FACEBOOK'], force: useForce });
      setSocial(res.items);
      setSocialMsg(t('admin.catalog.queued'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.catalog.fbError'));
    } finally {
      setSocialBusy(false);
    }
  }

  const fb = latestFacebook(social);
  const pageHeading = isNew
    ? t('admin.catalog.newTitle', { title: entityTitle })
    : t('admin.catalog.editTitle', { title: entityTitle });

  return (
    <div>
      <h1>{pageHeading}</h1>
      <p className="lead">
        <Link to={basePath}>{t('admin.catalog.backList')}</Link>
      </p>

      <form className="admin-form" onSubmit={onSubmit}>
        <div className="admin-form__row">
          <label>
            {t('admin.catalog.name')}
            <input required maxLength={200} value={form.name} onChange={(e) => update('name', e.target.value)} />
          </label>
          <label>
            {t('admin.catalog.slug')}
            <input required maxLength={120} value={form.slug} onChange={(e) => update('slug', e.target.value)} />
          </label>
        </div>
        <label>
          {t('admin.catalog.description')}
          <textarea
            required
            rows={5}
            maxLength={5000}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </label>
        <div className="admin-form__row">
          <label>
            {t('admin.catalog.price')}
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => update('price', Number(e.target.value))}
            />
          </label>
          <label>
            {t('admin.catalog.category')}
            <select required className="admin-select" value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)}>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <ImageUploadField
            label={t('admin.catalog.images')}
            value={imageDraft}
            onChange={setImageDraft}
            onUploaded={(url) => addImage(url)}
            hint={t('admin.media.hint')}
          />
          <button type="button" className="btn" style={{ marginTop: '0.5rem' }} onClick={() => addImage()}>
            {t('admin.catalog.addImage')}
          </button>
          <ul>
            {form.images.map((src, index) => (
              <li key={src} className="actions" style={{ marginTop: '0.4rem' }}>
                <span style={{ wordBreak: 'break-all' }}>
                  {index === 0 ? '★ ' : ''}
                  {src}
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => update('images', form.images.filter((img) => img !== src))}
                >
                  {t('admin.catalog.removeImage')}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="admin-form__checks">
          <label>
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => update('published', e.target.checked)}
            />
            {t('admin.catalog.published')}
          </label>
        </div>

        {error && <p className="status status--error">{error}</p>}

        <button className="btn btn--solid" type="submit" disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </form>

      {!isNew && kind === 'PROJECT' && (
        <div className="admin-panel" style={{ marginTop: '1.5rem' }}>
          <h2>{t('admin.catalog.socialTitle')}</h2>
          <p className="lead" style={{ marginTop: 0 }}>
            {t('admin.catalog.socialLead')}
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn btn--solid"
              disabled={socialBusy || fb?.status === 'PENDING'}
              onClick={() => void publishFacebook(false)}
            >
              {socialBusy || fb?.status === 'PENDING'
                ? t('admin.catalog.publishing')
                : fb?.status === 'PUBLISHED'
                  ? t('admin.catalog.republishFb')
                  : t('admin.catalog.publishFb')}
            </button>
            {fb?.postUrl && fb.status === 'PUBLISHED' && (
              <a className="btn" href={fb.postUrl} target="_blank" rel="noreferrer noopener">
                {t('admin.catalog.viewPost')}
              </a>
            )}
          </div>
          {socialMsg && <p className="status">{socialMsg}</p>}
          {fb && (
            <p className="status" style={{ marginTop: '0.75rem' }}>
              {t('admin.social.facebook')} :{' '}
              <span
                className={`admin-badge ${
                  fb.status === 'PUBLISHED'
                    ? 'admin-badge--ok'
                    : fb.status === 'FAILED'
                      ? 'admin-badge--warn'
                      : ''
                }`}
              >
                {fb.status === 'PUBLISHED'
                  ? t('common.published')
                  : fb.status === 'PENDING'
                    ? t('admin.social.pending')
                    : fb.status === 'FAILED'
                      ? t('admin.social.failed')
                      : fb.status}
              </span>
              {fb.error ? ` — ${fb.error}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
