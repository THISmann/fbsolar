import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, isSafeHttpUrl, mediaFileUrl, resolveMediaDisplayUrl } from '../lib/api';

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** Called after a successful MinIO upload (in addition to onChange). */
  onUploaded?: (url: string) => void;
  hint?: string;
};

export function ImageUploadField({ label, value, onChange, onUploaded, hint }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);

  const displayUrl = resolveMediaDisplayUrl(value);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(t('admin.media.invalidType'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('admin.media.tooLarge'));
      return;
    }

    setUploading(true);
    setError(null);
    setPreviewBroken(false);
    try {
      const uploaded = await api.uploadMedia(file);
      if (!uploaded?.id) throw new Error(t('admin.media.uploadError'));
      // Always build the public URL from the Vite API base (Traefik), not MinIO.
      const url = mediaFileUrl(uploaded.id);
      onChange(url);
      onUploaded?.(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.media.uploadError'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="image-upload">
      <label>
        {label}
        <input
          type="url"
          value={value}
          onChange={(e) => {
            setError(null);
            setPreviewBroken(false);
            onChange(e.target.value);
          }}
          placeholder="https://…"
          maxLength={1000}
        />
      </label>

      <div className="image-upload__actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={(e) => void onFile(e)}
        />
        <button
          type="button"
          className="btn"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? t('admin.media.uploading') : t('admin.media.importFile')}
        </button>
        {value ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPreviewBroken(false);
              onChange('');
            }}
          >
            {t('admin.media.clear')}
          </button>
        ) : null}
      </div>

      {hint ? <p className="image-upload__hint">{hint}</p> : null}
      {error ? <p className="status status--error">{error}</p> : null}
      {previewBroken ? <p className="status status--error">{t('admin.media.previewError')}</p> : null}

      {displayUrl && isSafeHttpUrl(displayUrl) ? (
        <div className="image-upload__preview">
          <img
            src={displayUrl}
            alt=""
            onLoad={() => setPreviewBroken(false)}
            onError={() => setPreviewBroken(true)}
          />
        </div>
      ) : null}
    </div>
  );
}
