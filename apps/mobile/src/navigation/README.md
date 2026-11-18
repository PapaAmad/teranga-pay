# Navigation

`RootNavigator.tsx` déclare la pile native et ses titres, lus avec `useTranslation` pour suivre la langue courante. `types.ts` liste les routes et leurs paramètres pour que TypeScript vérifie chaque changement d’écran. La pile reste stable pendant une mise à jour des textes.

La pile démarre sur `Onboarding` et conserve `Home`, `About` et la galerie T08
`DesignSystem`. `Home` utilise l’écran de lecture T16 et un port natif absent par
défaut ; il ne transforme pas cette absence en solde nul.
`OnboardingPreview` et `HomePreview` sont enregistrés uniquement en développement :
leurs données fictives restent séparées de l’entrée normale. La présentation du
projet permet d’ouvrir ces accueils. `initialRoute` et l’injection des services
permettent les vérifications isolées ; ils ne constituent pas une authentification
du wallet. `Receive` ouvre T18 depuis Recevoir ; `ReceivePreview`, réservé au
développement, garde un fournisseur fictif distinct. La perte de focus suspend la
lecture de l’adresse. Sans fournisseur T19, l’entrée normale annonce son
indisponibilité. Envoyer et Encaisser gardent leur explication, sans transfert,
jusqu’à T20 et T22. PAN maintient la navigation ; Salam relit.
Lancer `npm test -- --ci` depuis la racine pour vérifier les parcours.
