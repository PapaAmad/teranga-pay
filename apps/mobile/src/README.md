# Code de l’application

Le code TypeScript de l’interface vit ici. `navigation/` assemble les écrans, `screens/` contient les vues et `translations/` fournit les ressources locales et le contexte de traduction T09. `App.tsx` fournit les contextes partagés et `index.ts` enregistre l’application auprès d’Expo. Les textes affichés utilisent `useTranslation()` ; le français est la langue initiale et de repli. Lancer `npm run i18n:check` depuis la racine pour contrôler les textes en dur.

Ajouter les futurs dossiers de composants, de services et de fonctions lorsqu’ils auront une première implémentation. Chaque dossier source conserve un README court.

`onboarding/` contient les écrans T14, leur contrôleur et les adaptateurs de
préférences/protection. L’entrée normale n’a pas encore de wallet natif branché ;
l’aperçu complet de développement utilise un état fictif isolé en mémoire.
Consulter son [README](onboarding/README.md) pour la frontière portée avec Salam.

`home/` contient l’accueil T16, son port de lecture, ses formats et ses scénarios
fictifs. Le branchement réel attend la composition validée avec Salam ; les données
absentes ne deviennent pas un faux solde. Voir le [README](home/README.md).
