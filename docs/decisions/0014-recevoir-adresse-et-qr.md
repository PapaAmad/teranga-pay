# 0014 | Recevoir, adresse publique et QR fidèle

- Date : 9 novembre 2026, Dakar.
- Tâche : [T18, issue #13](https://github.com/PapaAmad/teranga-pay/issues/13), PAN ; relecture Salam.
- État : écrans confirmés par PAN le 9 novembre 2026 avant commit et PR ; relecture de Salam attendue.
- Base : `feat/T18-recevoir` part du commit T16 `ec884a2`, proposé dans la [PR #71](https://github.com/PapaAmad/teranga-pay/pull/71), encore ouverte. Aucun travail de Salam n’est importé pour simuler une intégration.

## Besoin et choix

La conception, section 6.4, demande un QR, une adresse réutilisable et les actions Copier et Partager. T18 ne choisit pas un montant et ne crée aucune facture : les demandes marchandes, leur expiration et leur confirmation appartiennent à T22. La [recherche](../design/recevoir-recherche.md) distingue l’adresse LUD-16, sa résolution LNURL-pay et les factures BOLT11 ; la [direction](../design/recevoir-direction.md) explique la composition.

Le QR encode l’adresse ASCII brute, exactement identique à la destination affichée et copiée. Aucun préfixe non vérifié, aucune URL calculée et aucun logo ne sont insérés. Le lecteur doit prendre en charge Lightning Address ; le décodage du QR n’établit pas la compatibilité de tous les wallets ni la disponibilité du service T19.

## Frontière avec Salam

T11 #53 au commit `5a670f13a2aafb06805c946fc2c404e8fa53c13e` expose les états du wallet et les factures, mais aucune adresse permanente. T19 #56 au commit `7ee2a91ff29a24d6f638fab0e9db1b03cf2e718a` et la réception téléphone #66 au commit `127e951dd81a4ee0b4fda85751a1d0cb79c004e9` préparent l’enregistrement de l’adresse. T18 lit donc un petit [port distinct](../../apps/mobile/src/receive/ports.ts), sans dépendre de leurs branches non fusionnées :

```ts
type ReceiveAddressPort = {
  current(): Promise<HomeResult<{ address: string }>>;
};
```

L’adaptateur futur fournit l’adresse publique courante d’une session validée et son wallet. Il conserve le jeton d’enregistrement hors de l’interface, choisit uniquement la configuration regtest et n’invente aucune adresse lorsque la lecture échoue. Le contexte normal est `mode: 'unavailable'` jusqu’à cette composition. Une adresse reçue hors connexion peut être affichée avec sa limite ; une ancienne adresse conservée après erreur ne peut plus être copiée ou partagée avant relecture réussie.

Le [contrôleur](../../apps/mobile/src/receive/controller.ts) valide les réponses, regroupe les événements d’état et ignore les lectures obsolètes. Il efface l’adresse lors d’une interruption, d’un verrouillage, d’une absence de wallet ou de la destruction de l’écran. Le retour relit les ports ; il ne réserve pas d’adresse et n’appelle jamais `wallet.receive()`. Aucune clé, phrase de récupération ou saisie de PIN dans T18.

## Encodage et dépendances

- `qrcode-generator@2.0.4`, MIT, produit une matrice QR en JavaScript, sans module natif ou service externe. Le rendu utilise `react-native-svg` déjà installé : modules carrés, pixels entiers et marge blanche de quatre modules par côté. Nous évitons une grille décorative et une implémentation maison du QR. [Source du générateur](https://github.com/kazuhikoarase/qrcode-generator).
- `expo-clipboard@58.0.4` écrit dans le presse-papiers natif. Cette version est fixée dans le package et satisfait la plage `~58.0.4` du manifeste `bundledNativeModules.json` d’Expo 58.0.23 installé ; la migration Expo de PAN est conservée. Le chargement tardif permet de traiter un module absent sans faux succès. Sur Web, l’API navigateur doit confirmer l’écriture. [Documentation Expo](https://docs.expo.dev/versions/latest/sdk/clipboard/).
- `jsqr@1.4.0`, Apache-2.0, est une dépendance de développement uniquement. Un décodeur indépendant vérifie la charge utile et la géométrie, y compris une adresse longue ; il n’entre pas dans le bundle de l’application. [Source du décodeur](https://github.com/cozmo/jsQR).

Le partage de texte utilise `Share` de React Native déjà présent et, sur Web, l’API disponible du navigateur. Aucun paquet supplémentaire de partage n’est nécessaire. Un retour Android ne confirme pas l’envoi d’un message : l’écran indique seulement que les options ont été ouvertes. Un refus ou une annulation garde une explication locale ; aucune copie silencieuse de remplacement. [React Native Share](https://reactnative.dev/docs/share).

## Vérification et limites

La valeur complète reste accessible, même si l’adresse longue nécessite des coupures visuelles. Ces coupures ne traversent jamais la copie ou le partage. Les confirmations apparaissent après réussite réelle de l’API et sont invalidées pendant une relecture, un verrouillage ou une interruption. Un callback encore en file vérifie le snapshot actuel avant tout appel externe.

Les scénarios de développement utilisent seulement `exemple@teranga.example` et une variante longue sous le domaine réservé `.example`. Le bandeau et le message partagé précisent qu’ils ne sont pas payables. Ils ne remplacent jamais le fournisseur du contexte normal. Les [preuves T18](../planning/suivi-t18.md) distinguent tests, captures Web, validation visuelle de PAN, essais Android et intégration regtest. Aucun résultat de scan physique, TalkBack ou paiement n’est déduit d’un décodage en mémoire.
