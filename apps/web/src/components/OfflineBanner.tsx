import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '../offline/useOnlineStatus';
import './OfflineBanner.scss';

export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span className="offline-banner__dot" aria-hidden="true" />
      <p>{t('offline.banner')}</p>
    </div>
  );
}
