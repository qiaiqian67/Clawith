import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { zh } from './messages/zh';
import { en } from './messages/en';

export const SUPPORTED_LANGUAGES = [
  { id: 'zh', label: '简体中文', nativeLabel: '简体中文', flag: '🇨🇳' },
  { id: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸' },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['id'];

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: 'zh',
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
});

export default i18n;
