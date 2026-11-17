# Routes de l'API

Un fichier par groupe de routes, enregistré dans `app.ts`. Chaque route déclare son schéma d'entrée (`querystring`, `params`, `body`) avec `additionalProperties: false` et son schéma de réponse.

- `alerts.ts` : `POST /v1/alerts/payment-check`, score d'alerte fraude (T26).
- `health.ts` : `GET /health`, contrôle de santé sans détail interne (T13).
- `savings.ts` : `GET /v1/savings/assumptions` et `POST /v1/savings/estimate`, estimation d'économies (T34).

- `rates.ts` : `GET /v1/rate`, `POST /v1/quotes`, `GET /v1/quotes/:id` (T17).
- `withdrawals.ts` : options, solde fictif, devis, confirmation et réconciliation T23 ; accès Bearer propre à ce groupe, désactivé par défaut.

- `lightning-address.ts` : LNURL-pay (`/.well-known/lnurlp/:username`, callback) et routes du téléphone (`/v1/lightning-addresses…`) (T19). Responsable : Salam.
