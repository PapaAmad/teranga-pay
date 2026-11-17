# Initialisation de démo

Introduite en **T12** par Salam ; PAN relit. `seed.mjs` prépare le réseau regtest décrit dans [lightning](../lightning/README.md). Il tourne dans le service Docker `seed` (image `node:24.22.0-alpine`), sans dépendance npm.

## Étapes, toutes relançables

1. Crée ou recharge le portefeuille de minage `teranga-seed` dans bitcoind.
2. Crée 101 blocs si ce portefeuille n'a pas assez de bitcoins de test.
3. Envoie 1 BTC de test à chaque nœud dont le solde est sous 0,5 BTC, puis confirme avec 6 blocs.
4. Connecte `lnd-diaspora` à `lnd-teranga` s'ils ne sont pas déjà pairs.
5. Ouvre un canal de 5 000 000 sats de diaspora vers teranga, dont 1 000 000 sats poussés côté teranga. Teranga peut ainsi recevoir et payer. Un canal existant ou en attente n'est jamais dupliqué.
6. Paie une facture de 1 000 sats de diaspora vers teranga pour prouver que le réseau fonctionne. Les refus temporaires juste après l'ouverture (solde insuffisant, pas de route) sont réessayés 15 fois ; tout autre refus arrête le seed avec un code d'erreur. `SEED_VERIFY_PAYMENT=0` désactive ce paiement.

Une deuxième exécution ne crée ni bloc, ni envoi, ni canal : elle vérifie l'état et refait seulement le paiement de vérification. Si une exécution a été interrompue après un envoi de fonds, la suivante confirme ce virement (6 blocs) sans le renvoyer. Une réponse de nœud coupée en cours de route fait échouer le seed avec un message, au lieu de le laisser bloqué.

## Fichiers

- `seed.mjs` : enchaînement des étapes (`runSeed`) et point d'entrée du conteneur.
- `phone.mjs` : canal privé de `lnd-teranga` vers le wallet du téléphone (relançable, refuse si le téléphone n'est pas connecté) et paiement d'une facture du téléphone par `lnd-diaspora`. Testé par `phone.test.mjs`.
- `clients.mjs` : clients JSON-RPC de bitcoind et REST de LND, sans dépendance. `clients.test.mjs` vérifie le rejet d'une réponse tronquée avec un vrai serveur HTTP local.
- `seed.test.mjs` : tests sur un faux réseau en mémoire (relance sans doublon, canal en attente, réessais, refus définitif, délai dépassé). Lancés par `npm run test:tooling`, sans Docker.
- `demo-data.json` : Awa, Mame Diarra et Ousmane, repris du document de conception. Les numéros utilisent le préfixe inexistant `+221 00` et ne désignent personne. Le taux BTC/FCFA viendra avec T17.
