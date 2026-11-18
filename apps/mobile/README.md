# Application mobile | Teranga Pay

Projet de Salam et PAN. Socle React Native et Expo en TypeScript, destiné d’abord
à Android. PAN porte les écrans ; Salam apporte le wallet, Lightning et le coffre.

Depuis la racine : `npm ci`, puis `npm run mobile`. Le projet utilise **Expo SDK 58**,
avec React 19.3.0 et React Native 0.88.1, suite à la migration de PAN pour son Expo Go
Android. Utiliser une version d’Expo Go compatible SDK 58. Le téléphone et le PC
doivent pouvoir communiquer sur le même réseau ; scanner le QR affiché par Expo.
Pour demander explicitement le réseau local :
`npm run start --workspace @teranga-pay/mobile -- --lan`.
Depuis le terminal Expo, `a` ouvre Android si un appareil ou un émulateur est prêt.
Le simulateur iOS nécessite macOS.

L’ouverture T14 propose un accueil illustré, le choix de langue et la préparation
de la sauvegarde. **La création réelle n’est pas branchée** : l’entrée normale
s’arrête avant le PIN avec une explication. Le bouton de développement
« Essayer le parcours fictif » permet d’examiner le PIN, sa confirmation, la copie
et sa vérification avec des jetons non Bitcoin et un état uniquement en mémoire.
Il reste explicitement marqué comme aperçu et n’existe pas dans une version de
production. Aucun portefeuille, clé ou paiement n’est créé par cet aperçu.

La [recherche T14](../../docs/design/onboarding-recherche.md) et la
[direction](../../docs/design/onboarding-direction.md) motivent le parcours.
Les [captures](../../docs/design/validation-t14/README.md) permettent de le relire.
**PAN a confirmé les écrans le 9 novembre 2026 avant commit et PR.** Le branchement natif attend
la reprise authentifiée de la sauvegarde et les essais convenus avec Salam :
[ADR 0012](../../docs/decisions/0012-onboarding-protection-et-integration.md).
Les dépendances du coffre ne sont pas ajoutées ici ; Expo Go sert à examiner l’UI,
pas à prouver le fonctionnement d’un futur module wallet personnalisé.

Pour revoir les vrais composants dans un navigateur :
`npm run mobile:web -- --offline --port 8092`, puis ouvrir
`http://localhost:8092`. Le Web est une cible de prévisualisation ; il ne valide
pas les protections Android. La galerie T08 et la présentation du projet restent
accessibles via « Découvrir le projet ». T16 ajoute l’accueil de lecture du wallet :
depuis cette présentation, choisir « Voir l’accueil du portefeuille » pour l’entrée
normale ou « Essayer l’accueil fictif » pour l’atelier de développement.
L’entrée normale ne dispose pas encore du port natif et n’invente aucun solde.
L’aperçu permet de vérifier le solde, le masquage, les opérations et les états de
lecture avec des données fictives. Recevoir ouvre T18 et Envoyer ouvre T20 ;
Encaisser conserve une explication jusqu’à T22. Ces routes ne branchent pas seules
un wallet natif. Les tâches du [plan](../../docs/planning/roadmap.md) précisent
les frontières d’intégration. Démonstration en regtest uniquement,
cash-out Wave/Orange Money simulé.

Lire la [recherche T16](../../docs/design/accueil-recherche.md), la
[direction](../../docs/design/accueil-direction.md), les
[captures](../../docs/design/validation-t16/README.md) et la
[décision 0013](../../docs/decisions/0013-accueil-lecture-wallet.md).
PAN a confirmé les écrans T16 le 9 novembre 2026 avant commit et PR. La relecture
de Salam et les vérifications d’intégration restent nécessaires.

T08 fournit l’identité B « Le courant commun », les icônes originales, les polices
locales et les composants. T09 fournit le contexte i18next et les ressources FR.
Le français est actif et mémorisé ; le wolof est annoncé mais non sélectionnable
avant traduction et relecture native T33. Tous les textes de l’UI viennent des
[ressources de traduction](src/translations/README.md).

T18 relie Recevoir à un écran dédié : QR fidèle à l’adresse, copie et partage avec
retours accessibles. Depuis l’accueil fictif, choisir Recevoir pour examiner les
scénarios. L’entrée normale attend son fournisseur d’adresse T19 ; elle n’invente
aucune destination. PAN a confirmé les écrans le 9 novembre 2026 avant commit et
PR ; la relecture de Salam reste attendue. Lire le [module](src/receive/README.md), la
[recherche](../../docs/design/recevoir-recherche.md) et le
[suivi T18](../../docs/planning/suivi-t18.md). `qrcode-generator` et `expo-clipboard`
servent l’encodage et la copie ; `jsqr` vérifie le décodage dans les tests seulement.

T20 relie Envoyer à la saisie ou au scan d’une demande, au montant FCFA si
nécessaire, au récapitulatif et à l’autorisation PIN explicite. Depuis l’accueil
fictif, choisir Envoyer pour l’atelier ; l’entrée normale explique l’absence de
fournisseur T21. Le plafond de frais montré est transmis au wallet et une
estimation FCFA inconnue bloque le PIN. Un timeout reste incertain et ne propose
aucun nouvel envoi. Le bouton des formulaires reste hors du contenu défilant,
dans le cadre adapté au clavier ; sa géométrie doit encore être vérifiée sur
Android. PAN a confirmé les nouveaux écrans le 10 novembre 2026 avant commit et PR
et autorisé la publication ; la relecture de Salam et la CI distante restent attendues.
Lire le [module Envoyer](src/send/README.md), la
[recherche](../../docs/design/envoyer-recherche.md) et le
[suivi T20](../../docs/planning/suivi-t20.md).

Le scanner ajoute `expo-camera@58.0.14`, compatible avec le SDK 58 conservé.
L’accès est demandé depuis Scanner ; Coller reste une alternative. Le plugin
configure la caméra sans microphone ni permission audio et lit l’explication
système française dans les ressources T09. Une nouvelle construction native est
nécessaire pour appliquer ces réglages ; l’aperçu Web et Expo Go ne prouvent pas
le fonctionnement du wallet de Salam ni celui d’un APK construit pour le projet.

Commandes utiles : `npm run typecheck --workspace @teranga-pay/mobile` et
`npm test --workspace @teranga-pay/mobile -- --ci`. Les tests utilisent
`jest-expo` 58, Jest 30, le preset React Native 0.88 et un renderer React 19.3 aligné.
Ces tests et les captures Web ne remplacent pas un essai clavier, texte agrandi,
TalkBack, interruption et capture d’écran sur un téléphone Android.

Sources : [migration Expo](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/),
[tests Expo](https://docs.expo.dev/develop/unit-testing/),
[navigation native](https://reactnavigation.org/docs/native-stack-navigator/).

## Wallet Lightning (T15)

Le wallet tourne dans le téléphone grâce au module natif [teranga-wallet](modules/teranga-wallet/README.md) (LDK Node). Ce module **ne fonctionne pas dans Expo Go** : il faut un build de développement Android.

1. Démarrer le réseau regtest (T12), puis copier `.env.example` en `.env` et y renseigner la clé de `lnd-teranga`.
2. `npx expo run:android` (JDK 17 et SDK Android requis), sur l'émulateur ou un téléphone.
3. Ouvrir l'atelier : `adb shell am start -d terangapay://labo-wallet`. Cet écran de test n'existe qu'en développement.

Sans module natif (Expo Go, tests Jest), l'atelier affiche un message d'indisponibilité. Les écrans peuvent alors utiliser le faux wallet de `@teranga-pay/contracts/fake`.
