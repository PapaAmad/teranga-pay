# 0010 | Adresse Lightning sans garde des fonds

- Date : 7 novembre 2026, Dakar.
- Tâche : T19.
- Responsable : Salam ; relecture : PAN.
- État : proposée dans la PR T19, en attente de relecture.

Les numéros 0004 à 0009 sont pris par les PR #37, #38, #47, #48, #50 et #55.

## Problème

Une adresse Lightning (`mame@teranga.example`, LUD-16) repose sur LNURL-pay : le wallet du payeur demande une facture à un serveur web. Or, dans notre architecture, **seul le téléphone de Mame peut créer une facture qui la paie** : ses clés sont dans le téléphone (décision 0008). Le serveur ne doit pas recevoir les fonds à sa place.

## Choix

Le serveur **relaie** la demande au téléphone :

1. Le téléphone réserve un nom et reçoit un jeton secret. Le serveur ne garde que l'empreinte SHA-256 de ce jeton.
2. Le téléphone ouvert reste en **attente longue** (25 s par requête) sur `/v1/lightning-addresses/me/requests`.
3. Quand un payeur appelle le callback LNURL, le serveur transmet le montant et le hachage des métadonnées au téléphone. Celui-ci crée la facture avec son wallet et la renvoie.
4. Le serveur vérifie que c'est une facture regtest au montant exact, puis la transmet au payeur. Le paiement va directement au téléphone.

Si le téléphone ne répond pas dans les 15 s, le payeur reçoit une erreur LNURL : le destinataire doit avoir l'application ouverte. C'est cohérent avec un wallet non custodial, qui doit être en ligne pour recevoir.

## Solutions écartées

- **Facture créée par `lnd-teranga` puis réacheminée** : le serveur, ou l'opérateur du nœud, détiendrait les fonds pendant un temps. C'est contraire au modèle de confiance.
- **Factures pré-générées par le téléphone** : LNURL-pay exige le montant choisi par le payeur et le hachage des métadonnées ; des factures fixées à l'avance ne conviennent pas.
- **Notifications push** : elles demandent un service tiers (FCM) et un compte, ce qui est hors du périmètre du MVP. L'attente longue suffit pour la démo.
- **Vérification complète de la facture côté serveur** (bech32, signature, hachage) : il faudrait une bibliothèque Bitcoin hors de la liste retenue en T10. Le wallet du payeur fait cette vérification, comme l'exige LUD-06.

## Conséquences

- Aucune nouvelle dépendance. Annuaire et demandes en mémoire, perdus au redémarrage du serveur.
- Noms réservés au premier arrivé, sans preuve d'identité : acceptable pour la démo, à revoir avant tout usage réel.
- Le module natif T15 devra créer une facture avec un **hachage de description** (`Bolt11InvoiceDescription.Hash`) et assurer l'attente longue tant que l'application est ouverte.
- En démonstration locale, l'API est en HTTP ; LUD-16 exige HTTPS hors démonstration.
