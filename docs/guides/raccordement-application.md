# Raccordement de l'application | #120

L'entrée normale compose les écrans avec le coffre Android/LDK regtest, les taux et devis de l'API et la passerelle Wave/Orange Money **simulée**. PAN et Salam portent l'intégration. Les ateliers Maestro restent des preuves séparées sur fixtures.

## Préparer les services locaux

Avec Docker Desktop actif :

```sh
npm ci
npm run regtest:up
npm run regtest:seed
npm run bridge:setup
npm run bridge:demo
```

`bridge:setup` conserve la configuration existante dans `services/api/.env.bridge-sim`, ignorée par Git. Pour un téléphone USB ou un émulateur, ADB reverse évite d'ouvrir les ports au réseau local :

```sh
adb reverse tcp:3000 tcp:3000
adb reverse tcp:50001 tcp:50001
adb reverse tcp:9735 tcp:9735
```

Configurer `apps/mobile/.env` avec API `http://127.0.0.1:3000`, Electrum `tcp://127.0.0.1:50001`, pair `127.0.0.1:9735` et la clé publique obtenue par `npm run regtest:phone -- info`. Côté API, `PUBLIC_BASE_URL=http://127.0.0.1:3000` doit correspondre à l'origine vue par le téléphone. Une clé de pair vide rend le parcours indisponible avant toute création de coffre.

Les paramètres `EXPO_PUBLIC_*` sont inclus dans le bundle : ne jamais y placer le jeton de passerelle. Le client autorise HTTP uniquement sur loopback ou l'adresse hôte de l'émulateur ; une origine distante exige HTTPS.

## Installer et provisionner Android

Expo Go ne contient pas le coffre. Utiliser le build Android de développement normal `pay.teranga.demo`, avec les exigences SDK 58 du [guide Maestro](tests-maestro.md) :

```sh
npm run mobile:android
```

Sous Windows, le [plugin natif local](../../apps/mobile/plugins/README.md) borne les chemins CMake, utilise un dossier de compilation court et impose le pilote C++ correct. Ces réglages ne changent aucune version du SDK ou des bibliothèques. Pour un dossier Android déjà généré avant l'ajout du plugin, exécuter d'abord `npx expo prebuild --platform android --no-install` depuis `apps/mobile`, en dehors d'une compilation en cours. Le plugin ne modifie pas les sources du coffre.

Juste avant de déverrouiller, provisionner le compte simulé :

```sh
npm run mobile:provision
# Plusieurs appareils : npm run mobile:provision -- --serial=emulator-5554
```

Le script exige un APK débogable via `run-as`. Il transmet la configuration par stdin, sans l'afficher ni la placer dans les arguments du processus. Un fichier temporaire privé reste présent jusqu'au premier accès au coffre déverrouillé ; le module chiffre l'import et efface le clair. L'écriture canonique acquitte l'import chiffré. Cette procédure de développement ne constitue pas l'authentification d'une version publique.

## Parcours Android à vérifier

1. Créer le coffre, noter et vérifier les mots sans capture, puis ouvrir l'accueil.
2. Fermer/redémarrer et retrouver le même nœud après PIN ; un PIN erroné ne donne pas accès aux secrets.
3. Ouvrir le canal avec `regtest:phone -- canal`, puis payer l'adresse LNURL depuis regtest. Vérifier solde et historique.
4. Envoyer vers une facture regtest avec PIN ; comparer prix et plafond affichés avec le paiement et le reçu conservé.
5. Encaisser un prix FCFA : seul le règlement de la facture correspondante confirme la vente.
6. Retirer en **simulation**, interrompre et retrouver le même devis, la même clé et la même opération. Le solde simulé reste distinct du wallet.
7. Revenir de l'arrière-plan par le PIN. Une ancienne confirmation suspendue pendant une écriture ne doit pas partir à la réouverture.

## Preuves

Les suites `apps/mobile/tests/runtime-*.test.*` vérifient les adaptateurs et les courses de session. Les tests d'API couvrent le rejeu d'adresse. Le stockage chiffré dispose de tests JVM exécutables avec `node scripts/verify-native-integration.mjs --java <exécutable> --gradle-cache <cache Kotlin existant>`.

Les vérifications HTTP sur le serveur local ont réussi : santé, taux, devis, enregistrement et rejeu de la même capacité d'adresse, refus d'une autre capacité, solde de simulation authentifié. Les neuf tests JVM du chiffrement passent également.

Le 19 novembre 2026, l'application Android normale a passé la création et la vérification de sauvegarde, le refus d'un mauvais PIN, le déverrouillage après arrêt complet, une réception LNURL de 100 000 sats de test, un envoi avec PIN de 2 000 sats confirmé côté destinataire, un encaissement de 2 500 FCFA (5 556 sats de test), et un retrait Wave **simulé** de 2 500 FCFA avec 100 FCFA de frais fictifs. Voir les [captures natives](../design/validation-integration/README.md).

Le retrait terminé a également été retrouvé après arrêt complet et déverrouillage : même référence, même résultat et une seule opération côté API, sans nouvelle confirmation financière.

Les six contrôles locaux passent : 1 352 tests mobiles, 139 API, 66 passerelle, 21 contrats et 205 tests d'outillage réussis ; un cas de lien symbolique est ignoré sous Windows. Les neuf contrôles JVM du chiffrement passent séparément.

Deux APK de développement ont été préparés : x86_64 pour l'émulateur et ARM64 pour téléphone. Ils exigent Metro et l'accès au serveur regtest. L'assemblage ARM64 a réutilisé les bibliothèques natives déjà compilées, le cache Gradle local dépassant la limite de chemins de Ninja sous Windows. Garder un chemin court pour le cache Gradle, comme celui du profil utilisateur par défaut. Ce sont des APK de développement ; aucune release signée n'est publiée ici.

## Limites liées au temps disponible

La récupération authentifiée de la sauvegarde après interruption (#10), la revue de sécurité complète sur le dépôt consolidé (#26), les mesures sur téléphone physique (#27), la relecture native du wolof (#28) et la livraison de l'APK signé (#30) restent suivies séparément. Le provisionnement de la passerelle est réservé aux builds débogables ; l'appairage d'une version publique reste à préparer avec la livraison signée. Ces limites ne remettent pas en service un transfert réel Wave/Orange Money : la passerelle reste simulée.

La CI hébergée reste suivie dans [#125](https://github.com/PapaAmad/teranga-pay/issues/125), avec un blocage de compte/plafond confirmé lors de la consolidation. Aucune exécution non démarrée n'est présentée comme réussie.
