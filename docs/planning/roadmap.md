# Feuille de route T01–T40

Reprise du [plan d'équipe v1.0](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf), pages 7 à 10. Les dates ci-dessous sont des objectifs de novembre 2026, en heure de Dakar. Ce tableau décrit le travail prévu ; seul le [suivi T01–T07](suivi-t01-t07.md) décrit le socle préparé dans cette livraison.

La visibilité a été adaptée après le plan : PAN a choisi un dépôt et un Project **privés** le 2 novembre 2026. La [décision 0002](../decisions/0002-visibilite-privee.md) explique cet écart aux PDF ; le [relevé GitHub](publication-github.md) décrit les opérations réellement vérifiées.

PAN porte l'interface, le dépôt et les visuels ; Salam porte le wallet, Lightning et le serveur. L'autre membre relit chaque tâche, sauf les tâches explicitement communes.

## Phase 0 — Démarrage, 1er–2 novembre

| Tâche | Livrable attendu                                                    | Responsable | Pour le  |
| ----- | ------------------------------------------------------------------- | ----------- | -------- |
| T01   | Dépôt privé selon décision 0002, licence MIT, README, collaborateur | PAN         | 1er nov. |
| T02   | Protection de main, squash, suppression des branches, secrets       | PAN         | 2 nov.   |
| T03   | Modèles, labels, CODEOWNERS, GitHub Projects                        | PAN         | 2 nov.   |
| T04   | AGENTS.md et CLAUDE.md                                              | PAN         | 2 nov.   |
| T05   | Issues T06–T40 dans le tableau                                      | PAN         | 2 nov.   |
| T06   | Expo TypeScript, navigation, ESLint/Prettier communs                | PAN         | 2 nov.   |

## Phase 1 — Fondations, 3–8 novembre

| Tâche | Livrable attendu                                                         | Responsable | Pour le |
| ----- | ------------------------------------------------------------------------ | ----------- | ------- |
| T07   | CI format, lint, types, tests, titre et secrets ; hooks                  | PAN         | 3 nov.  |
| T08   | Charte v1 et composants de base                                          | PAN         | 4 nov.  |
| T09   | i18n et textes français                                                  | PAN         | 4 nov.  |
| T10   | Comparaison de deux SDK Lightning et note de décision                    | Salam       | 5 nov.  |
| T11   | Contrat de types et fonctions entre écrans et logique                    | Les deux    | 5 nov.  |
| T12   | Bitcoin regtest, deux nœuds Lightning, données de test Docker            | Salam       | 6 nov.  |
| T13   | Squelette API : santé, validation, débit, logs sans données personnelles | Salam       | 7 nov.  |
| T14   | Onboarding : langue, wallet, sauvegarde, test et PIN                     | PAN         | 8 nov.  |
| T15   | Wallet : clés, coffre sécurisé, PIN, première réception                  | Salam       | 8 nov.  |
| T16   | Accueil : solde FCFA, actions, dernières opérations                      | PAN         | 8 nov.  |

**J1, dimanche 8 novembre :** installer l'application, créer un wallet et recevoir un premier paiement en regtest. T10 commence dès le démarrage, en parallèle du socle du dépôt. Si le SDK n'est pas utilisable le 5 novembre, décider ensemble du repli LND et documenter sa différence de garde des clés.

## Phase 2 — Fonctions clés, 9–15 novembre

| Tâche | Livrable attendu                                             | Responsable | Pour le |
| ----- | ------------------------------------------------------------ | ----------- | ------- |
| T17   | Taux BTC/FCFA configurable et devis de cinq minutes          | Salam       | 9 nov.  |
| T18   | Recevoir : QR, adresse, copie et partage                     | PAN         | 10 nov. |
| T19   | Lightning Address via LNURL-pay                              | Salam       | 11 nov. |
| T20   | Envoyer : caméra, collage, confirmation PIN et frais         | PAN         | 11 nov. |
| T21   | Décodage, paiement et gestion des échecs                     | Salam       | 11 nov. |
| T22   | Encaisser : montant, QR, attente, confirmation et reçu       | PAN         | 12 nov. |
| T23   | Passerelle simulée et protection contre les doubles retraits | PAN         | 12 nov. |
| T24   | Historique, reçus et total du jour                           | PAN         | 13 nov. |
| T25   | Retirer : opérateur, frais et confirmation                   | PAN         | 13 nov. |
| T26   | Alerte fraude : règles et score serveur                      | Salam       | 14 nov. |
| T27   | Confirmation d'alerte dans l'application                     | PAN         | 14 nov. |
| T28   | États hors connexion, chargements et erreurs utiles          | PAN         | 15 nov. |
| T29   | Paiement regtest complet en intégration CI                   | Salam       | 15 nov. |

**J2, dimanche 15 novembre :** recevoir, payer un marchand par QR et retirer en simulation. Les fonctions indispensables doivent être intégrées et testées ; aucune nouvelle fonction majeure ne commence ensuite.

## Phase 3 — Finition, 16–18 novembre

| Tâche | Livrable attendu                                                        | Responsable | Pour le |
| ----- | ----------------------------------------------------------------------- | ----------- | ------- |
| T30   | Parcours nominal mobile automatisé avec Maestro                         | PAN         | 17 nov. |
| T31   | Revue sécurité, dépendances, secrets et journaux                        | Salam       | 17 nov. |
| T32   | Performance et accessibilité sur téléphone modeste                      | PAN         | 17 nov. |
| T33   | Wolof traduit et relu par des locuteurs natifs                          | PAN         | 17 nov. |
| T34   | Estimation d'économies et explications, souhaitable                     | Salam       | 17 nov. |
| T35   | APK signé en GitHub Release et somme de contrôle                        | Salam       | 18 nov. |
| T36   | Documentation complète : installation, architecture, limites, métriques | Salam       | 18 nov. |
| T37   | Couverture et captures de soumission                                    | PAN         | 18 nov. |
| T38   | Script du pitch de trois minutes                                        | Salam       | 18 nov. |

## Phase 4 — Démo et soumission, 19–20 novembre

| Tâche | Livrable attendu                                                               | Responsable | Pour le          |
| ----- | ------------------------------------------------------------------------------ | ----------- | ---------------- |
| T39   | Gel à midi, tag v1.0.0, vidéo ; Salam au script/voix, PAN à la capture/montage | Les deux    | 19 nov.          |
| T40   | Devpost, deux répétitions, soumission et liens vérifiés                        | Salam       | 20 nov. au matin |

L'heure exacte et le fuseau de la clôture Devpost restent à confirmer sur la page officielle. Le plan interne prévoit la soumission le 20 au matin pour garder de la marge ; aucune soumission n'est effectuée par la préparation de ce dépôt.

## Réduire le périmètre en cas de retard

Suivre l'ordre du plan : Nostr, suggestions de montants, menu USSD simulé, estimation d'économies, notifications, wolof complet, puis alerte détaillée. Conserver le wallet, recevoir, payer, encaisser, retrait simulé, sécurité de base, README et vidéo. Si J1 ou J2 est manqué, faire la revue à deux et actualiser les issues et cette feuille de route.
