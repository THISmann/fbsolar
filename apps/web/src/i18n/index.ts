import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGS = ['fr', 'en'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

const STORAGE_KEY = 'solar.lang';

function detectLang(): AppLang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  if (typeof navigator === 'undefined') return 'fr';
  // Crawlers report en-US; the indexed language must match the French catalogue content.
  if (/bot|crawl|spider|slurp|facebookexternalhit|whatsapp|lighthouse/i.test(navigator.userAgent)) return 'fr';
  const nav = navigator.language.toLowerCase();
  return nav.startsWith('en') ? 'en' : 'fr';
}

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: detectLang(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setAppLanguage(lang: AppLang) {
  void i18n.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language.startsWith('en') ? 'en' : 'fr';
}

export default i18n;
