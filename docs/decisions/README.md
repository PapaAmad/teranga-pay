# Notes de décision

Une note garde la raison d'un choix pour l'autre membre et les agents. Son auteur est le responsable de la tâche ; l'autre membre relit. Les décisions communes, notamment T10/T11, se discutent à deux.

| Note                                                 | Sujet                                                     | État                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [0001](0001-structure-du-depot.md)                   | Organisation du dépôt jusqu'à T07                         | Livrée via la PR #36 et la décision 0003                                      |
| [0002](0002-visibilite-privee.md)                    | Dépôt et Project privés                                   | Visibilité privée et accès vérifiés sur le dépôt et le Project #3             |
| [0003](0003-initialisation-main.md)                  | Initialisation exceptionnelle de main                     | Fusion initiale autorisée explicitement par PAN                               |
| [0004](0004-correction-accueil-github.md)            | Correction exceptionnelle de l'accueil                    | Autorisation distincte pour la PR #37 ; suivi dans la PR #38                  |
| [0005](0005-parseur-markdown.md)                     | Parseur Markdown pour les contrôles du dépôt              | Dépendance de développement proposée dans la seconde revue T07                |
| [0006](0006-identite-visuelle.md)                    | Identité et signes propres à Teranga Pay                  | Direction B choisie, réalisation à relire                                     |
| [0007](0007-squelette-api.md)                        | Socle d'exécution de l'API (T13)                          | Proposée par Salam, relecture de PAN attendue                                 |
| [0008](0008-sdk-lightning.md)                        | Choix du SDK Lightning mobile (T10)                       | LDK Node retenu par Salam, validation de PAN attendue                         |
| [0009](0009-i18n-francais-wolof.md)                  | Traduction française et préparation du wolof              | T09 proposée, relecture Salam attendue                                        |
| [0010](0010-adresse-lightning.md)                    | Adresse Lightning sans garde (T19)                        | Proposée par Salam, relecture de PAN attendue                                 |
| [0011](0011-estimation-economies.md)                 | Estimation d'économies (T34)                              | Proposée par Salam, relecture de PAN attendue                                 |
| [0012](0012-onboarding-protection-et-integration.md) | Onboarding, protection et frontière du wallet             | Proposition locale T14 ; validation visuelle de PAN avant commit ou PR        |
| [0013](0013-accueil-lecture-wallet.md)               | Accueil, valeurs inconnues et port de lecture             | Écrans T16 confirmés par PAN avant publication ; relecture Salam attendue     |
| [0014](0014-recevoir-adresse-et-qr.md)               | Adresse publique, QR fidèle et résultats du partage       | Écrans T18 confirmés par PAN avant publication ; relecture Salam attendue     |
| [0015](0015-envoyer-confirmation-et-session.md)      | Envoi, plafond de frais, clavier et barrière de session   | Écrans T20 confirmés par PAN avant publication ; relecture Salam attendue     |
| [0016](0016-encaisser-demande-et-recu.md)            | Demande marchande, règlement correspondant et reçu simple | Proposition locale T22 ; nouveaux écrans à présenter à PAN avant commit et PR |
| [0017](0017-passerelle-simulee-et-idempotence.md)    | Retraits simulés, réservation durable et réconciliation   | Proposition T23 de PAN ; vérifications et relecture Salam attendues           |
| [0018](0018-historique-et-totaux.md)                 | Historique, reçus et convention des cumuls du jour        | Écrans T24 confirmés par PAN avant publication ; relecture Salam attendue     |
| [0019](0019-retrait-simule-et-reprise.md)            | Retrait simulé, confirmation et reprise durable           | Écrans T25 confirmés par PAN avant publication ; relecture Salam attendue     |
| [0020](0020-alerte-et-consentement.md)               | Alerte explicable et décision avant le PIN                | État et limites décrits dans la note                                          |
| [0021](0021-attentes-et-reprises.md)                 | Attentes bornées et reprises sans double opération        | État et limites décrits dans la note                                          |
| [0022](0022-maestro-et-preuve-native.md)             | Maestro et portée de la preuve Android                    | État et limites décrits dans la note                                          |

La numérotation tient compte des branches encore ouvertes : les notes 0004 à 0016 sont utilisées ou réservées dans les autres tâches du projet. Vérifier les PR avant de choisir le prochain numéro. Préciser : date, tâche, état, problème, choix, solutions écartées et conséquences. Une décision proposée n'est pas une validation de l'autre membre. Mettre à jour l'index lorsqu'une note est ajoutée ou remplacée.

Notes attendues ensuite : contrat écrans/logique en T11 et choix structurants d'exécution du backend en T13.
