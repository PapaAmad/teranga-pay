# Navigation

`RootNavigator.tsx` déclare la pile native et ses titres, lus avec `useTranslation` pour suivre la langue courante. `types.ts` liste les routes et leurs paramètres pour que TypeScript vérifie chaque changement d’écran. La pile reste stable pendant une mise à jour des textes.

La pile démarre sur `Onboarding` et conserve `Home`, `About` et la galerie T08
`DesignSystem`. `Home` reste l’accueil technique, sans données financières.
`OnboardingPreview` est enregistré uniquement en développement : son port fictif
reste séparé des services de l’entrée normale. `initialRoute` et l’injection des
services permettent les vérifications isolées ; ils ne constituent pas une
authentification du futur accueil T16. PAN maintient la navigation ; Salam relit.
Lancer `npm test -- --ci` depuis la racine pour vérifier les parcours.
