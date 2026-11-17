# Code source de l'API

- `app.ts` construit le serveur Fastify : journaux sans donnée personnelle, limite de débit, en-têtes et format d'erreur commun. Les tests l'utilisent sans ouvrir de port.
- `server.ts` lit la configuration, démarre l'écoute et gère l'arrêt propre (SIGINT, SIGTERM).
- `config.ts` lit et valide les variables d'environnement.
- `errors.ts` liste les codes d'erreur renvoyés à l'application et fournit `sendError`.
- `rates.ts` fournit le taux BTC/FCFA (`fixe` ou `kraken`, parité 655,957 FCFA/€) ; `quotes.ts` convertit en sats et garde les devis figés (T17).
- `routes/` contient une fonction d'enregistrement par groupe de routes.

Les tests sont à côté du code (`*.test.ts`) et se lancent avec `npm test --workspace @teranga-pay/api`. Responsable : Salam (T13).
