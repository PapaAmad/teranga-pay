# Application mobile

Socle React Native et Expo en TypeScript, destiné d’abord à Android. PAN en est responsable ; Salam apporte ensuite la logique du wallet.

Depuis la racine du dépôt : `npm ci`, puis `npm run mobile`. Scanner le QR avec Expo Go compatible SDK57, ou utiliser un émulateur Android. `npm run android --workspace @teranga-pay/mobile` ouvre directement Android ; iOS nécessite macOS pour le simulateur.

La navigation relie l’accueil provisoire, la présentation du projet et la galerie T08. Elle utilise React Navigation et sa pile native ; les identifiants d’écran sont typés. Le front complet de l’application n’est pas encore développé : aucun wallet, paiement, encaissement ou retrait n’est opérationnel.

T08 fournit des fondations réutilisables : identité B « Le courant commun », icônes originales, polices locales et composants bouton/carte/champ avec leurs états. La galerie est un atelier de vérification ; ses interactions sont fictives. Les maquettes financières de la charte montrent une intention graphique, sans constituer les écrans métier connectés.

L’onboarding et le wallet, l’accueil financier, l’envoi, la réception, l’encaissement, l’historique et le retrait simulé restent les tâches suivantes du [plan](../../docs/planning/roadmap.md). PAN réalise les écrans ; Salam porte la logique wallet, Lightning et API. La démonstration financière future reste en regtest, avec cash-out Wave/Orange Money simulé.

T09 relie les textes au contexte i18next, y compris les titres de navigation et les messages de chargement. Les ressources françaises sont embarquées dans `src/translations/fr.ts` ; les clés viennent du [moteur de traduction](src/translations/README.md). Le catalogue wolof préparé est vide et se replie sur le français : sa traduction relue par des locuteurs reste T33. Le choix de langue dans l’onboarding et sa persistance restent T14. La présence des glyphes et du moteur ne constitue pas un système bilingue terminé. Voir la [charte et ses limites](../../docs/design/README.md).

`npm run typecheck --workspace @teranga-pay/mobile` vérifie les types. `npm test --workspace @teranga-pay/mobile -- --ci` vérifie la navigation, les composants, leurs états et le repli typographique dans Jest. Ces tests ne remplacent pas un essai clavier, texte agrandi ou TalkBack sur appareil Android.

Les versions proviennent du template officiel `expo-template-blank-typescript@sdk-57`. SDK57 suit la recommandation Expo Go au moment de l’initialisation. Les tests restent sur Jest29 et Testing Library13, compatibles avec `jest-expo`57.

Sources : [création Expo](https://docs.expo.dev/get-started/create-a-project/), [navigation native](https://reactnavigation.org/docs/native-stack-navigator/), [tests Expo](https://docs.expo.dev/develop/unit-testing/).

## Wallet Lightning (T15)

Le wallet tourne dans le téléphone grâce au module natif [teranga-wallet](modules/teranga-wallet/README.md) (LDK Node). Ce module **ne fonctionne pas dans Expo Go** : il faut un build de développement Android.

1. Démarrer le réseau regtest (T12), puis copier `.env.example` en `.env` et y renseigner la clé de `lnd-teranga`.
2. `npx expo run:android` (JDK 17 et SDK Android requis), sur l'émulateur ou un téléphone.
3. Ouvrir l'atelier : `adb shell am start -d terangapay://labo-wallet`. Cet écran de test n'existe qu'en développement.

Sans module natif (Expo Go, tests Jest), l'atelier affiche un message d'indisponibilité. Les écrans peuvent alors utiliser le faux wallet de `@teranga-pay/contracts/fake`.
