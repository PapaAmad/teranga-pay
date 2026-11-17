# Code source de l'API

- `app.ts` construit le serveur Fastify : journaux sans donnée personnelle, limite de débit, en-têtes et format d'erreur commun. Les tests l'utilisent sans ouvrir de port.
- `server.ts` lit la configuration, démarre l'écoute et gère l'arrêt propre (SIGINT, SIGTERM).
- `config.ts` lit et valide les variables d'environnement.
- `errors.ts` liste les codes d'erreur renvoyés à l'application et fournit `sendError`.
- `rates.ts` fournit le taux BTC/FCFA (`fixe` ou `kraken`, parité 655,957 FCFA/€) ; `quotes.ts` convertit en sats et garde les devis figés (T17).
- `lightning-address.ts` : annuaire des adresses Lightning, relais des demandes de facture vers le téléphone et lecture du montant d'une facture regtest (T19).
- `fraud.ts` : règles d'alerte fraude explicables et score (T26).
- `savings.ts` calcule l'estimation d'économies (T34) et lit ses hypothèses configurables.
- `routes/` contient une fonction d'enregistrement par groupe de routes.
- `bridge.ts` monte le module fictif T23 et associe le jeton à une identité de démonstration ; aucun secret wallet.
- `setup-bridge.ts` crée un fichier de configuration ignoré sans afficher son jeton ; `demo-bridge.ts` vérifie le parcours HTTP local des deux opérateurs.

Les tests sont à côté du code (`*.test.ts`) et se lancent avec `npm test --workspace @teranga-pay/api`. Salam porte T13/T17 ; PAN porte les ajouts de retrait T23, relus par Salam.
