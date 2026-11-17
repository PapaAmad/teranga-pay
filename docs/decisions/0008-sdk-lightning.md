# 0008 | Choix du SDK Lightning mobile

- Date : 7 novembre 2026, Dakar. L'échéance prévue était le 5 novembre.
- Tâche : T10.
- Responsable : Salam ; relecture et décision commune avec PAN.
- État : **option B (LDK Node) retenue par Salam le 7 novembre et validée par l'essai réel du 11 novembre** (voir « Résultats de l'essai »). La validation de PAN reste attendue en relecture ; le plan B LND n'est pas nécessaire.

Les numéros 0004 à 0007 sont réservés par des PR ouvertes le 7 novembre : 0004 et 0005 par la PR #38, 0006 par la PR #47 et 0007 par la PR #48 (T13).

## Problème

Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf) demande un SDK Lightning éprouvé, utilisable depuis l'application Expo/React Native, qui garde les clés dans le téléphone. Il prévoit un plan B si le SDK n'est pas prêt : un nœud LND côté serveur. [AGENTS.md](../../AGENTS.md) impose de faire la démonstration en regtest uniquement. Le réseau regtest local de T12 (bitcoind et deux nœuds LND) est déjà prêt.

## Candidats écartés d'emblée

- **react-native-ldk (Synonym)** : le dépôt est archivé depuis le 9 février 2026 et se décrit comme « pre-alpha ». Il ne reçoit plus de correctifs.
- **Breez SDK Liquid (Nodeless)** : Breez demande à ses partenaires de passer à Breez SDK Spark. Le choisir aujourd'hui exposerait le projet à un abandon.

## Les deux options évaluées

| Critère                       | A. Breez SDK Spark                                                                                            | B. LDK Node dans un module Expo                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Intégration React Native/Expo | Paquet officiel `@breeztech/breez-sdk-spark-react-native` (0.28) avec plugin Expo                             | Pas de paquet React Native : module Kotlin à écrire autour des liaisons Android    |
| Expo Go                       | Non : build de développement (`expo prebuild`)                                                                | Non : build de développement                                                       |
| Clés                          | Dans le téléphone (phrase de 12 mots)                                                                         | Dans le téléphone, à condition de fournir la graine depuis le coffre sécurisé      |
| Modèle de confiance           | Non custodial, mais repose sur les opérateurs Spark (au moins un honnête) et une sortie on-chain              | Vrai nœud Lightning sur le téléphone, sans tiers                                   |
| Regtest                       | Regtest hébergé par Lightspark **sans Lightning** ; environnement local lourd (3 opérateurs, SSP, ldk-server) | Utilise le bitcoind regtest et les nœuds LND de T12, une fois leurs ports exposés  |
| Liquidité entrante            | Gérée par le fournisseur (SSP)                                                                                | À organiser : canal ouvert par `lnd-teranga`, qui joue le fournisseur de liquidité |
| Lightning Address             | Service intégré (LNURL)                                                                                       | À fournir par l'API (T19, comme prévu)                                             |
| Maturité                      | Maintenu, versions fréquentes avec des changements de configuration (exemple de Blink)                        | API instable avant la v1.0 ; pas de retour en arrière de version                   |
| Effort estimé                 | Faible côté code, fort côté environnement de test Lightning                                                   | Fort côté natif (Kotlin, Android d'abord), faible côté réseau de test              |
| Clé d'API                     | Aucune en regtest ; clé Breez requise sur mainnet                                                             | Aucune                                                                             |

## Principal risque de chaque option

- **A. Spark** : les parcours Lightning (recevoir de la diaspora, payer un marchand par QR) **ne fonctionnent pas sur le regtest hébergé**. La documentation conseille le mainnet, ce qu'interdit la règle « regtest uniquement ». Il faudrait l'environnement local de Breez, dont la compatibilité avec nos nœuds LND n'est pas confirmée et dont le démarrage est lent.
- **B. LDK Node** : il faut écrire et maintenir un module natif. Pour recevoir, le téléphone doit rester en ligne. Il doit aussi joindre la chaîne regtest depuis le réseau local, ce qui demande d'exposer bitcoind ou un serveur Esplora au téléphone, uniquement pendant la démo.

## Décision

**Option B : LDK Node dans un module Expo natif, Android d'abord.** C'est la seule option qui garde les clés dans le téléphone tout en faisant de vrais paiements Lightning sur le regtest de T12. Le travail natif (Kotlin) est accepté par l'équipe.

1. **Essai borné à 2 jours** : un module Expo Android minimal crée le nœud, affiche son solde et reçoit un paiement de `lnd-diaspora`.
2. Si l'essai échoue le 9 novembre, Salam et PAN décident ensemble et explicitement du **plan B LND**, comme l'exige [AGENTS.md](../../AGENTS.md). Une note complémentaire documente alors la garde des clés, qui ne sont plus dans le téléphone.
3. **T11 isole le wallet derrière une interface commune**, pour que les écrans ne dépendent pas de ce choix.
4. `lnd-teranga` joue le fournisseur de liquidité : il ouvre un canal vers le téléphone pour que celui-ci puisse recevoir.
5. Pendant la démo seulement, la chaîne regtest (bitcoind ou Esplora) et le port Lightning `9735` de `lnd-teranga` sont exposés au téléphone sur le réseau local, puis refermés. Le `compose.yaml` de T12 ne publie pas encore ces ports ; l'essai doit les ajouter. Le RPC de bitcoind n'est exposé qu'avec une adresse IP autorisée et un mot de passe dédié à la démo.
6. La graine de LDK Node est générée puis lue dans le coffre sécurisé du téléphone et transmise au nœud. Par défaut, LDK Node l'écrit en clair dans son dossier de stockage : ce réglage par défaut est exclu.

Option A (Breez Spark) écartée : sur son regtest hébergé, les paiements Lightning ne fonctionnent pas, ce qui est incompatible avec la règle « regtest uniquement ».

## Protocole des essais

Chaque essai consigne ses résultats dans cette note : version testée, téléphone ou émulateur, captures et durée.

- Créer le wallet, sauvegarder la phrase de récupération et redémarrer l'application : le solde doit être retrouvé.
- Restaurer la phrase sur une installation neuve. Avec LDK Node, la phrase seule rend les fonds on-chain, mais pas l'état des canaux : le solde Lightning ne revient qu'après la fermeture du canal par `lnd-teranga`, sauf sauvegarde de l'état des canaux. Consigner ce comportement.
- Recevoir 10 000 sats depuis `lnd-diaspora`, puis payer une facture de `lnd-teranga`.
- Couper le réseau pendant un paiement : un message utile s'affiche et le paiement n'est pas compté deux fois.
- Mesurer la taille ajoutée à l'APK et le temps de démarrage sur un Android modeste.

## Résultats de l'essai (11 novembre 2026)

- **Version testée** : LDK Node 0.7.0 (`ldk-node-android`) dans le module Expo `teranga-wallet`, branche de la #66 (`f277fc8`). APK de debug compilé en 4 min 21 s, architecture arm64-v8a.
- **Appareil** : émulateur `teranga-test` (Android 16, arm64, 3 Go de mémoire) sur Mac, relié au regtest T12 par `10.0.2.2` (Electrum `:50001`, `lnd-teranga` `:9735`).

| Étape du protocole                                  | Résultat                                                                                                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Créer le wallet                                     | ✅ nœud démarré, état « Prêt ». La phrase est chiffrée dans le coffre (PIN + Keystore) et n'est jamais écrite en clair par LDK.                                   |
| Protection de la phrase                             | ✅ la capture d'écran est entièrement noire tant que la phrase est affichée (`FLAG_SECURE`).                                                                      |
| Canal entrant de `lnd-teranga`                      | ✅ canal privé de 2 000 000 sats, actif.                                                                                                                          |
| Recevoir 10 000 sats depuis `lnd-diaspora`          | ✅ trois fois 10 000 sats. Solde envoyable : 10 000, car la réserve de canal de 20 000 sats (1 %) est exclue.                                                     |
| Payer une facture                                   | ✅ 2 000 sats vers `lnd-diaspora` (via `lnd-teranga`), 2 sats de frais.                                                                                           |
| Adresse Lightning (T19 + T21)                       | ✅ réception de 5 000 sats sur `mame@teranga.example` ; envoi de 1 500 sats à `ousmane@teranga.example`.                                                          |
| Redémarrer l'application                            | ✅ solde de 11 497 sats retrouvé ; déverrouillage et démarrage du nœud en **5 s** sur l'émulateur.                                                                |
| Restaurer la phrase sur une installation neuve      | ⏳ pas encore fait.                                                                                                                                               |
| Couper le réseau pendant un paiement                | ⏳ pas encore fait sur l'appareil. Couvert par les tests Jest du wallet : `PAYMENT_TIMEOUT` avec `paymentId`, pas de second envoi.                                |
| Taille de l'APK et démarrage sur un Android modeste | ⏳ APK de **debug** de 68,6 Mo (non minifié, arm64 seul). La taille de l'APK de release sera mesurée avec T35 ; pas encore d'essai sur un vrai téléphone modeste. |

Constat utile pour l'interface : un canal neuf impose une réserve d'environ 1 % de sa capacité. Un téléphone qui a reçu moins que cette réserve affiche un solde envoyable de 0 ; l'accueil (T16) doit montrer ce montant comme « réservé », pas comme perdu.

## Sources consultées le 7 novembre 2026

- [Breez SDK Spark | installation](https://sdk-doc-spark.breez.technology/guide/install.html) et [tests](https://sdk-doc-spark.breez.technology/guide/testing.html)
- [Paquet npm Breez Spark React Native](https://www.npmjs.com/package/@breeztech/breez-sdk-spark-react-native)
- [Environnement local Spark, PR breez/spark-sdk#1152](https://github.com/breez/spark-sdk/pull/1152)
- [Mise à niveau Spark chez Blink, PR #4335](https://github.com/blinkbitcoin/blink-mobile/pull/4335)
- [LDK Node](https://github.com/lightningdevkit/ldk-node) et [ses liaisons](https://github.com/lightningdevkit/ldk-node-bindings)
- [react-native-ldk, archivé](https://github.com/synonymdev/react-native-ldk)
- [Avis Breez SDK Liquid](https://sdk-doc-liquid.breez.technology/guide/regtest.html)
