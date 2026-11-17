# Navigation

`RootNavigator.tsx` déclare la pile native et ses titres, lus avec `useTranslation` pour suivre la langue courante. `types.ts` liste les routes et leurs paramètres pour que TypeScript vérifie chaque changement d’écran. La pile reste stable pendant une mise à jour des textes.

Le socle contient `Home`, `About` et la galerie T08 `DesignSystem`. Les parcours wallet seront ajoutés aux tâches prévues, sans logique de paiement dans le navigateur. PAN maintient la navigation ; Salam relit. Lancer `npm test -- --ci` depuis la racine pour vérifier la navigation.
