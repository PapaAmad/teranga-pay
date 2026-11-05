# Application mobile

Socle React Native et Expo en TypeScript, destiné d’abord à Android. PAN en est responsable ; Salam apporte ensuite la logique du wallet.

Depuis la racine du dépôt : `npm ci`, puis `npm run mobile`. Scanner le QR avec Expo Go compatible SDK57, ou utiliser un émulateur Android. `npm run android --workspace @teranga-pay/mobile` ouvre directement Android ; iOS nécessite macOS pour le simulateur.

La navigation relie l’accueil provisoire, la présentation du projet et la galerie T08. Elle utilise React Navigation et sa pile native ; les identifiants d’écran sont typés. Le front complet de l’application n’est pas encore développé : aucun wallet, paiement, encaissement ou retrait n’est opérationnel.

T08 fournit des fondations réutilisables : identité B « Le courant commun », icônes originales, polices locales et composants bouton/carte/champ avec leurs états. La galerie est un atelier de vérification ; ses interactions sont fictives. Les maquettes financières de la charte montrent une intention graphique, sans constituer les écrans métier connectés.

L’onboarding et le wallet, l’accueil financier, l’envoi, la réception, l’encaissement, l’historique et le retrait simulé restent les tâches suivantes du [plan](../../docs/planning/roadmap.md). PAN réalise les écrans ; Salam porte la logique wallet, Lightning et API. La démonstration financière future reste en regtest, avec cash-out Wave/Orange Money simulé.

Les textes sont centralisés dans `src/translations/fr.ts`. L’infrastructure de traduction vient en T09 ; les traductions wolof relues par des locuteurs sont prévues en T33. La présence des glyphes et d’un catalogue français ne constitue pas un système bilingue terminé. Voir la [charte et ses limites](../../docs/design/README.md).

`npm run typecheck --workspace @teranga-pay/mobile` vérifie les types. `npm test --workspace @teranga-pay/mobile -- --ci` vérifie la navigation, les composants, leurs états et le repli typographique dans Jest. Ces tests ne remplacent pas un essai clavier, texte agrandi ou TalkBack sur appareil Android.

Les versions proviennent du template officiel `expo-template-blank-typescript@sdk-57`. SDK57 suit la recommandation Expo Go au moment de l’initialisation. Les tests restent sur Jest29 et Testing Library13, compatibles avec `jest-expo`57.

Sources : [création Expo](https://docs.expo.dev/get-started/create-a-project/), [navigation native](https://reactnavigation.org/docs/native-stack-navigator/), [tests Expo](https://docs.expo.dev/develop/unit-testing/).
