# Services

Processus serveur de Teranga Pay. Seule l'API dispose d'un squelette exécutable (T13) ; les autres dossiers restent réservés.

| Dossier                            | Rôle prévu                                   | Responsable | Tâche         |
| ---------------------------------- | -------------------------------------------- | ----------- | ------------- |
| [api](api/README.md)               | API Teranga : santé, validation, débit (T13) | Salam       | T13, T17, T19 |
| [bridge-sim](bridge-sim/README.md) | Retraits Wave/Orange Money fictifs           | PAN         | T23           |
| [ai](ai/README.md)                 | Règles d'alerte et estimation                | Salam       | T26, T34      |

Le framework de l'API est Fastify ([décision 0007](../docs/decisions/0007-squelette-api.md)). Le stockage et les contrats d'API seront décidés avec les tâches concernées. Voir la [vue d'architecture](../docs/architecture/vue-ensemble.md).
