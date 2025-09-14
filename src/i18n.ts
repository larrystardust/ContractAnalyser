import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(HttpBackend) // Load translations from http (public/locales)
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    fallbackLng: 'en', // Use 'en' if a translation is not found for the current language
    lng: localStorage.getItem('i18nextLng') || 'en', // Default language, try to load from localStorage
    debug: false, // Set to true for development to see logs
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json', // Path to your translation files
    },
    react: {
      useSuspense: false, // Set to true if you want to use React.Suspense for loading translations
    },
  });

export default i18n;