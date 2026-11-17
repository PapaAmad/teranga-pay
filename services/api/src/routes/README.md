# Routes de l'API

Un fichier par groupe de routes, enregistré dans `app.ts`. Chaque route déclare son schéma d'entrée (`querystring`, `params`, `body`) avec `additionalProperties: false` et son schéma de réponse.

- `health.ts` : `GET /health`, contrôle de santé sans détail interne (T13).

- `rates.ts` : `GET /v1/rate`, `POST /v1/quotes`, `GET /v1/quotes/:id` (T17).

La Lightning Address (T19) viendra ici. Responsable : Salam.
