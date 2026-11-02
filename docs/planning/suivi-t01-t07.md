# Suivi du socle T01 à T07

État de mise en place au 2 novembre 2026, heure de Dakar. Responsable : PAN
(`PapaAmad`). Relecteur : Salam (`AliouneKane`). Le dépôt est **privé** selon la
[décision 0002](../decisions/0002-visibilite-privee.md), qui remplace la demande de
visibilité publique des PDF. Le tableau Projects doit également rester privé.

Le [relevé GitHub](publication-github.md) conserve les liens et les dernières
preuves vérifiées ; ce suivi résume les critères et les étapes encore ouvertes.
Salam a accepté l'invitation et son accès en écriture a été vérifié. Une PR
publiée ne constitue pas une fusion approuvée.

| Tâche | État connu                                                                                                                                                                                                   | Ce qui reste à vérifier ou terminer                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01   | Dépôt privé `PapaAmad/teranga-pay` créé avec README initial sur `main`. Accès en écriture de Salam confirmé, aucune invitation en attente. MIT et README du socle préparés localement.                       | Publier le code par PR et obtenir la relecture. Ne pas recréer le dépôt ni l'invitation.                                                                                                                          |
| T02   | Squash seul et suppression des branches actifs. Rulesets refusés (403), analyse native des secrets refusée (422) ; ces protections ne sont pas actives. Dependabot activé et permissions Actions en lecture. | Tâche partiellement bloquée par l'offre actuelle du dépôt privé. Garder la règle d'équipe de PR et relecture, sans prétendre à un blocage technique. Consigner les limites dans le relevé GitHub.                 |
| T03   | 16 labels créés. Modèles et CODEOWNERS préparés localement.                                                                                                                                                  | Publier et vérifier les modèles et demandes de revue. Créer/configurer le Project privé, ses accès et ses colonnes ; vérifier son contenu dans le relevé GitHub.                                                  |
| T04   | `AGENTS.md` et import `CLAUDE.md` préparés.                                                                                                                                                                  | Publication par PR et relecture humaine de Salam.                                                                                                                                                                 |
| T05   | 35 issues T06 à T40 créées (#1 à #35) et affectées à PAN/Salam ; accès de Salam confirmé.                                                                                                                    | Ajouter et vérifier les cartes du Project privé sans doublons. Conserver la correspondance entre identifiants TXX et numéros GitHub.                                                                              |
| T06   | Expo, TypeScript et navigation initialisés. Types, parcours Jest et export Android vérifiés localement.                                                                                                      | Ouvrir l'application sur Android, faire relire le socle et le publier ; les écrans métier viennent après T07.                                                                                                     |
| T07   | Workflows et hooks configurés. Contrôles locaux exécutés avec succès selon le rapport de validation.                                                                                                         | Observer le premier passage CI distant et les hooks sur le commit indexé. Vérifier les contrôles requis et le blocage d'une PR non approuvée si les protections du compte le permettent ; consigner toute limite. |

## Preuves locales et distantes

Le [rapport de validation](../guides/validation-du-socle.md) couvre l'installation
reproductible, le format, le lint, les types, les tests, l'export Android et les
essais des hooks. La navigation a été vérifiée par Jest et le bundle exporté,
sans ouverture sur appareil. Les messages de commit invalides sont refusés ;
le hook avant commit a été testé sans fichier indexé lors de ce relevé.
L'audit npm signale encore des alertes de dépendances détaillées dans ce rapport.

La mise en place distante est en cours. Consulter le relevé GitHub pour les
résultats plus récents de CI, l'état des issues, le Project et la disponibilité
des fonctions de sécurité. Une configuration préparée ou une commande lancée ne
constitue pas à elle seule une protection effective.

## Avant de fermer les tâches

- T01 : dépôt privé vérifié, code publié et accès collaborateur confirmé.
- T02 : réglages réellement appliqués et testés ; fonctions indisponibles identifiées sans les déclarer actives.
- T03 : modèles et CODEOWNERS reconnus, labels vérifiés, Project privé et accès contrôlés.
- T04 : règles communes relues par Salam.
- T05 : 35 issues T06 à T40 et cartes correspondantes, affectations vérifiées.
- T06 : commandes de qualité réussies et application ouverte sur Android.
- T07 : contrôles locaux et CI distante verts, hooks observés sur les changements indexés, limites de protection explicites.

Le [guide du dépôt distant](../guides/depot-distant.md) est la procédure de
référence. Les opérations de mise en place déjà autorisées se poursuivent dans
ce cadre privé ; aucune nouvelle création ou publication publique n'est requise.

## Limite de cette livraison

T08 et les tâches suivantes restent planifiées : pas de charte finale, de SDK
choisi, de phrase secrète, d'API, de réseau regtest, de retrait, d'APK signé ou de
parcours de paiement opérationnel. Voir la [feuille de route](roadmap.md) et la
[vue d'architecture](../architecture/vue-ensemble.md).
