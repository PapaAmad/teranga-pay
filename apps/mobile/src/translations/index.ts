import { createInstance, type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { fr } from './fr';
import { resolveLanguage, supportedLanguages } from './types';
import { wo } from './wo';

export { I18nextProvider as TranslationProvider, useTranslation } from 'react-i18next';
export { resolveLanguage, supportedLanguages } from './types';
export type { AppLanguage, TranslationCatalog } from './types';
export type AppI18n = i18n;

/** Ressources locales de textes uniquement : pas de backend ni de requête réseau. */
export function createAppI18n(language: unknown = 'fr'): AppI18n {
  const instance = createInstance();
  // Le moteur conserve ses ressources par référence. Chaque instance reçoit sa
  // copie pour que l'ajout d'une traduction ne modifie pas les autres instances.
  const resources = JSON.parse(
    JSON.stringify({ fr: { translation: fr }, wo: { translation: wo } }),
  );
  void instance.use(initReactI18next).init({
    resources,
    lng: resolveLanguage(language),
    supportedLngs: [...supportedLanguages],
    fallbackLng: 'fr',
    load: 'languageOnly',
    defaultNS: 'translation',
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

/** Point d'entrée pour une future préférence utilisateur, sans persistance T09. */
export function setAppLanguage(instance: AppI18n, language: unknown) {
  return instance.changeLanguage(resolveLanguage(language));
}

export const appI18n = createAppI18n();
