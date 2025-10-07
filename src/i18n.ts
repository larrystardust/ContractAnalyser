import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector'; // ADDED

i18n
  .use(HttpBackend) // Load translations from http (public/locales)
  .use(LanguageDetector) // ADDED: Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    fallbackLng: 'en', // Use 'en' if a translation is not found for the current language
    supportedLngs: ['en', 'fr', 'es', 'ar'], // ADDED: Explicitly define supported languages
    // lng: localStorage.getItem('i18nextLng') || 'en', // REMOVED: LanguageDetector handles this
    debug: false, // <--- MODIFIED: Set to false for production
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json', // Path to your translation files
    },
    detection: { // ADDED: Language detection options
      order: ['localStorage', 'navigator'], // Order of detection methods
      caches: ['localStorage'], // Cache user language in localStorage
    },
    react: {
      useSuspense: true, // MODIFIED: Set to true to use React.Suspense for loading translations
    },
  });

export default i18n;