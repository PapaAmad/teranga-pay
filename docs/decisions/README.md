# Notes de décision

Une note garde la raison d'un choix pour l'autre membre et les agents. Son auteur est le responsable de la tâche ; l'autre membre relit. Les décisions communes, notamment T10/T11, se discutent à deux.

| Note                                              | Sujet                                                   | État                                                                |
| ------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| [0001](0001-structure-du-depot.md)                | Organisation du dépôt jusqu'à T07                       | Livrée via la PR #36 et la décision 0003                            |
| [0002](0002-visibilite-privee.md)                 | Dépôt et Project privés                                 | Visibilité privée et accès vérifiés sur le dépôt et le Project #3   |
| [0003](0003-initialisation-main.md)               | Initialisation exceptionnelle de main                   | Fusion initiale autorisée explicitement par PAN                     |
| [0004](0004-correction-accueil-github.md)         | Correction exceptionnelle de l'accueil                  | Autorisation distincte pour la PR #37 ; suivi dans la PR #38        |
| [0005](0005-parseur-markdown.md)                  | Parseur Markdown pour les contrôles du dépôt            | Dépendance de développement proposée dans la seconde revue T07      |
| [0006](0006-identite-visuelle.md)                 | Identité et signes propres à Teranga Pay                | Direction B choisie, réalisation à relire                           |
| [0007](0007-squelette-api.md)                     | Socle d'exécution de l'API (T13)                        | Proposée par Salam, relecture de PAN attendue                       |
| [0008](0008-sdk-lightning.md)                     | Choix du SDK Lightning mobile (T10)                     | LDK Node retenu par Salam, validation de PAN attendue               |
| [0009](0009-i18n-francais-wolof.md)               | Traduction française et préparation du wolof            | T09 proposée, relecture Salam attendue                              |
| [0010](0010-adresse-lightning.md)                 | Adresse Lightning sans garde (T19)                      | Proposée par Salam, relecture de PAN attendue                       |
| [0011](0011-estimation-economies.md)              | Estimation d'économies (T34)                            | Proposée par Salam, relecture de PAN attendue                       |
| [0017](0017-passerelle-simulee-et-idempotence.md) | Retraits simulés, réservation durable et réconciliation | Proposition T23 de PAN ; vérifications et relecture Salam attendues |

La numérotation tient compte des branches encore ouvertes : les notes 0004 à 0016 sont utilisées ou réservées dans les autres tâches du projet. Vérifier les PR avant de choisir le prochain numéro. Préciser : date, tâche, état, problème, choix, solutions écartées et conséquences. Une décision proposée n'est pas une validation de l'autre membre. Mettre à jour l'index lorsqu'une note est ajoutée ou remplacée.

Notes attendues ensuite : contrat écrans/logique en T11 et choix structurants d'exécution du backend en T13.
