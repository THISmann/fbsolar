import { useTranslation } from 'react-i18next';
import { setAppLanguage, type AppLang } from '../i18n';

type Props = {
  compact?: boolean;
  className?: string;
};

export function LanguageSwitcher({ compact = false, className = '' }: Props) {
  const { i18n, t } = useTranslation();
  const current: AppLang = i18n.language.startsWith('en') ? 'en' : 'fr';

  return (
    <div className={`lang-switch ${compact ? 'lang-switch--compact' : ''} ${className}`.trim()} role="group" aria-label={t('common.language')}>
      <button
        type="button"
        className={current === 'fr' ? 'is-active' : undefined}
        aria-pressed={current === 'fr'}
        onClick={() => setAppLanguage('fr')}
      >
        FR
      </button>
      <button
        type="button"
        className={current === 'en' ? 'is-active' : undefined}
        aria-pressed={current === 'en'}
        onClick={() => setAppLanguage('en')}
      >
        EN
      </button>
    </div>
  );
}
