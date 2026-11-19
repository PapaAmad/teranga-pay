# Validation Android | Raccordement #120

Captures du 19 novembre 2026 sur émulateur Android 35, application normale `pay.teranga.demo`, Expo SDK 58. Salam et PAN portent le raccordement. Aucun atelier ni faux wallet ne compose ces écrans. Bitcoin et Lightning restent en regtest ; Wave reste entièrement simulé.

Les écrans de PIN, les mots de récupération et les jetons ne sont pas capturés.

## Accueil après réception regtest

![Accueil après réception regtest](03-home-received.png)

## Adresse Lightning du wallet Android

![Adresse Lightning du wallet Android](02-receive.png)

## Prix et plafond de frais avant PIN

![Prix et plafond de frais avant PIN](05-send-review.png)

## Paiement confirmé

![Paiement confirmé](06-send-paid.png)

## Encaissement marchand confirmé

![Encaissement marchand confirmé](08-collect-paid.png)

## Prix du retrait simulé

![Prix du retrait simulé](09-withdraw-review.png)

## Retrait simulé terminé

![Retrait simulé terminé](10-withdraw-done.png)

## Même retrait retrouvé après redémarrage

![Retrait simulé retrouvé après arrêt complet et déverrouillage](11-withdraw-resumed.png)

L'API conserve une seule opération pour ce retrait de 2 500 FCFA. Le redémarrage retrouve sa référence et son résultat sans nouvelle confirmation financière.

## Vérifications

Création et quiz des douze mots, PIN erroné refusé, déverrouillage après arrêt complet, réception LNURL de 100 000 sats de test, envoi avec PIN de 2 000 sats de test confirmé côté destinataire, encaissement de 2 500 FCFA (5 556 sats de test), retrait Wave simulé de 2 500 FCFA avec 100 FCFA de frais fictifs.

Voir le [guide de raccordement](../../guides/raccordement-application.md) pour les commandes et limites. Captures natives ; les anciennes galeries Web et les tests Maestro sur fixtures restent distincts.
