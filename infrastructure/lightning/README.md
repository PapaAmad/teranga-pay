# Réseau Lightning regtest

Introduit en **T12** par Salam ; PAN relit. Le paiement d'intégration en CI vient en T29. Ce réseau est un outil de test : il ne choisit pas le SDK mobile (T10) et ne prouve pas l'architecture non custodiale du produit.

## Services

| Service        | Image                               | Rôle                                       | Accès depuis l'hôte           |
| -------------- | ----------------------------------- | ------------------------------------------ | ----------------------------- |
| `bitcoind`     | `bitcoin/bitcoin:29.5` (officielle) | Chaîne Bitcoin regtest, blocs à la demande | Aucun                         |
| `lnd-teranga`  | `lightninglabs/lnd:v0.21.6-beta`    | Nœud côté Sénégal (alias `teranga`)        | REST `https://127.0.0.1:8080` |
| `lnd-diaspora` | `lightninglabs/lnd:v0.21.6-beta`    | Nœud qui joue Ousmane (alias `diaspora`)   | REST `https://127.0.0.1:8082` |

Les versions sont figées pour que la démo reste reproductible. Chaque service a un contrôle de santé (`bitcoin-cli getblockchaininfo`, `lncli getinfo`) ; `docker compose up --wait` attend qu'ils répondent.

electrs 0.11.1 est retenu car la 0.12 exige des fonctions REST de Bitcoin Core 30. bitcoind active donc `-rest` (lecture seule, non publié). `lnd-teranga` utilise `--protocol.no-anchors` : le téléphone n'a pas de fonds on-chain pour la réserve des canaux à ancres.

## Téléphone ou émulateur (T15)

L'émulateur Android joint l'ordinateur à l'adresse `10.0.2.2`. Le wallet LDK Node y trouve Electrum (`10.0.2.2:50001`) et le pair `teranga` (`10.0.2.2:9735`). Pour un vrai téléphone sur le même Wi-Fi, lancer `REGTEST_BIND=0.0.0.0 npm run regtest:up` **pendant la démo seulement**, puis relancer sans cette variable.

```sh
npm run regtest:phone -- info               # clé publique et adresse du pair teranga
npm run regtest:phone -- canal <clé>        # teranga ouvre un canal privé de 2 000 000 sats vers le téléphone
npm run regtest:phone -- payer <facture>    # Ousmane (diaspora) paie une facture du téléphone
```

## Sécurité du réseau de test

- **Aucun mot de passe dans le dépôt** : bitcoind utilise l'authentification par cookie, un fichier régénéré à chaque démarrage et partagé en lecture seule avec les nœuds.
- Le RPC de bitcoind n'est publié sur aucune interface de l'hôte. Les API REST des nœuds sont publiées sur `127.0.0.1` uniquement, jamais sur le réseau local.
- `--noseedbackup` crée les portefeuilles des nœuds sans phrase de récupération. C'est acceptable seulement parce que ce réseau est jetable ; ne jamais réutiliser cette configuration hors regtest.
- Les macaroons (jetons d'accès LND) et certificats TLS restent dans les volumes Docker et ne sont jamais copiés dans le dépôt.

## Volumes et remise à zéro

`bitcoind-data`, `lnd-teranga-data` et `lnd-diaspora-data` conservent la chaîne et les nœuds entre deux démarrages. `npm run regtest:reset` les efface : il faut ensuite relancer `regtest:up` puis `regtest:seed` pour retrouver un réseau prêt.

## Commandes utiles

```sh
docker compose exec lnd-teranga lncli --network=regtest getinfo
docker compose exec lnd-diaspora lncli --network=regtest listchannels
docker compose exec bitcoind bitcoin-cli -regtest -datadir=/home/bitcoin/.bitcoin getblockcount
```
