# Routes de l'API

Un fichier par groupe de routes, enregistré dans `app.ts`. Chaque route déclare son schéma d'entrée (`querystring`, `params`, `body`) avec `additionalProperties: false` et son schéma de réponse.

- `health.ts` : `GET /health`, contrôle de santé sans détail interne (T13).

Les routes de taux (T17) et de Lightning Address (T19) viendront ici. Responsable : Salam.
