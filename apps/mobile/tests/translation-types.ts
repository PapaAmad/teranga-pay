import type { TFunction } from 'i18next';

import type { TranslationCatalog } from '../src/translations';

// Vérification de compilation uniquement : cette fonction n'est jamais exécutée.
// Une perte du typage des clés rend les @ts-expect-error invalides et casse tsc.
export function checkTranslationTypes(t: TFunction) {
  t('home.title', { appName: 'Nom témoin' });
  t('about.description', { appName: 'Nom témoin' });

  // @ts-expect-error Le nom interpolé doit être fourni au titre de l’accueil.
  t('home.title');
  // @ts-expect-error Le chargement ne doit pas exposer un paramètre non résolu.
  t('fonts.loading');

  // @ts-expect-error Une clé inconnue ne doit pas passer dans le code mobile.
  t('home.unknownKey');
  // @ts-expect-error Un texte de repli ne doit pas cacher une faute de clé.
  t('home.unknownKey', { defaultValue: 'Texte témoin' });

  const partial: TranslationCatalog = { home: { title: 'Titre témoin' } };
  // @ts-expect-error Une traduction partielle ne peut pas inventer une clé.
  const unknown: TranslationCatalog = { home: { unknownKey: 'Texte témoin' } };
  // @ts-expect-error Une feuille du catalogue doit rester un texte.
  const number: TranslationCatalog = { home: { title: 42 } };
  return [partial, unknown, number];
}
