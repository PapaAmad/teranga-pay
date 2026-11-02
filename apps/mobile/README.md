# Application mobile

Socle React Native et Expo en TypeScript, destiné d’abord à Android. PAN en est responsable ; Salam apporte ensuite la logique du wallet.

Depuis la racine du dépôt : `npm ci`, puis `npm run mobile`. Scanner le QR avec Expo Go compatible SDK57, ou utiliser un émulateur Android. `npm run android --workspace @teranga-pay/mobile` ouvre directement Android ; iOS nécessite macOS pour le simulateur.

La navigation relie l’accueil de préparation à une page de présentation. Elle utilise React Navigation et sa pile native ; les identifiants d’écran sont typés. Aucun wallet, paiement ou retrait ne fonctionne encore à ce stade T06.

Les textes sont centralisés dans `src/translations/fr.ts`. Le système complet français/wolof reste T09. La charte visuelle, les composants et les assets de marque restent T08 ; les styles présents servent uniquement à rendre le socle utilisable.

`npm run typecheck --workspace @teranga-pay/mobile` vérifie les types. `npm test --workspace @teranga-pay/mobile -- --ci` vérifie le parcours accueil → à propos → retour avec le véritable navigateur et des remplacements des appels natifs dans Jest.

Les versions proviennent du template officiel `expo-template-blank-typescript@sdk-57`. SDK57 suit la recommandation Expo Go au moment de l’initialisation. Les tests restent sur Jest29 et Testing Library13, compatibles avec `jest-expo`57.

Sources : [création Expo](https://docs.expo.dev/get-started/create-a-project/), [navigation native](https://reactnavigation.org/docs/native-stack-navigator/), [tests Expo](https://docs.expo.dev/develop/unit-testing/).
