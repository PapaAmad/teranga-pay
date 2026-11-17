import type { fr } from './fr';

/** Une traduction peut arriver par étapes ; ses feuilles restent des textes. */
type PartialCatalog<T> = {
  [Key in keyof T]?: T[Key] extends string ? string : PartialCatalog<T[Key]>;
};

export type TranslationCatalog = PartialCatalog<typeof fr>;

export const supportedLanguages = ['fr', 'wo'] as const;
export type AppLanguage = (typeof supportedLanguages)[number];

/** Les préférences externes inconnues utilisent le français. */
export function resolveLanguage(language: unknown): AppLanguage {
  if (typeof language !== 'string') return 'fr';
  const base = language.trim().toLowerCase().replaceAll('_', '-').split('-')[0];
  return base === 'wo' ? 'wo' : 'fr';
}
