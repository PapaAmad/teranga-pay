# Services

Processus et modules serveur de Teranga Pay. L’API Fastify T13/T17 porte les routes HTTP ; le module T23 ajoute une passerelle de retrait entièrement simulée et son stockage local. Les règles T26 et l’estimation T34 sont hébergées dans l’API ; le dossier IA en décrit le rôle.

| Dossier                            | Rôle prévu                                                    | Responsable | Tâche         |
| ---------------------------------- | ------------------------------------------------------------- | ----------- | ------------- |
| [api](api/README.md)               | API Teranga : santé, validation, débit (T13)                  | Salam       | T13, T17, T19 |
| [bridge-sim](bridge-sim/README.md) | Retraits Wave/Orange Money fictifs et registre SQLite durable | PAN         | T23           |
| [ai](ai/README.md)                 | Règles d'alerte et estimation                                 | Salam       | T26, T34      |

Le framework de l’API est Fastify ([décision 0007](../docs/decisions/0007-squelette-api.md)). La passerelle T23 s’exécute comme module de cette API, avec activation explicite, accès contrôlé et registre SQLite ([décision 0017](../docs/decisions/0017-passerelle-simulee-et-idempotence.md)). Aucun service ne reçoit les clés ou un droit de dépense du wallet mobile. Voir la [vue d’architecture](../docs/architecture/vue-ensemble.md). Commande utile : `npm run api` depuis la racine du checkout.
