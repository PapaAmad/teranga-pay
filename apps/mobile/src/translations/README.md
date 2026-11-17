# Traductions de l’application | T09

`fr.ts` est le catalogue français canonique. `wo.ts` prépare les mêmes clés sous forme partielle : il reste vide tant que les textes wolof ne sont pas traduits et relus en T33. Le moteur i18next utilise explicitement le français lorsqu’une clé wolof manque ou contient une chaîne vide. Une structure prête pour le wolof ne signifie pas que la traduction est livrée.

`index.ts` initialise les ressources locales sans attente réseau et fournit `TranslationProvider`, `useTranslation`, l’instance `appI18n` et la fabrique isolée `createAppI18n`. Les écrans et la navigation consomment les clés à travers le provider ; ils ne lisent pas directement un catalogue. `i18next.d.ts` fait vérifier les clés et les paramètres par TypeScript. Les textes d’accueil, de présentation et de chargement partagent `appName`, par exemple `t('home.title', { appName: t('appName') })`.

Le français est la langue par défaut. `resolveLanguage` et `setAppLanguage` ramènent les variantes `fr-SN` et `wo-SN` à leur langue de base ; une préférence inconnue revient au français. Un appel direct au moteur avec une variante est aussi résolu par `load: 'languageOnly'` et le repli français, mais `setAppLanguage` est l’entrée recommandée pour une préférence externe. Chaque instance possède ses propres ressources : les fixtures de tests ne modifient pas les catalogues de production.

La sélection visible, la détection de la langue du téléphone et la conservation d’une préférence ne sont pas ajoutées ici. Le parcours de choix de langue appartient à T14 ; sa traduction wolof reste soumise à T33. Aucun texte wolof non relu n’est publié et aucun service de traduction distant n’est appelé.

Ajouter un texte dans le français, employer sa clé avec `useTranslation`, puis renseigner le même chemin dans `wo.ts` après validation linguistique. Éviter les phrases assemblées par concaténation ; utiliser les paramètres du moteur. Les montants FCFA gardent leurs espaces insécables U+00A0.

PAN réalise T09, Salam relit. Commandes : `npm run typecheck`, `npm test -- --ci` ; les tests `i18n.test.tsx` couvrent le repli, l’isolation, les paramètres et le changement de langue au cours du parcours existant. Le titre natif est contrôlé via la prop du composant remplacé par Jest ; son rendu sur Android reste à vérifier. Les essais Android réels et la relecture wolof restent distincts.
