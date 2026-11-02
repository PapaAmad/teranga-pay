# Suivi du socle T01 à T07

État de mise en place au 2 novembre 2026, heure de Dakar. Responsable : PAN
(`PapaAmad`). Relecteur : Salam (`AliouneKane`). Le dépôt est **privé** selon la
[décision 0002](../decisions/0002-visibilite-privee.md), qui remplace la demande de
visibilité publique des PDF. Le tableau Projects doit également rester privé.

Le [relevé GitHub](publication-github.md) conserve les liens et les dernières
preuves vérifiées ; ce suivi résume les critères et les étapes encore ouvertes.
Salam a accepté l'invitation et son accès en écriture a été vérifié. Une PR
publiée ne constitue pas une fusion approuvée.

| Tâche | État connu                                                                                                                                                              | Ce qui reste à vérifier ou terminer                                                                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01   | Dépôt privé et accès de Salam confirmés. Socle livré par la PR #36 avec exception d’initialisation autorisée par PAN. Licence MIT présente dans le commit publié.       | Initialisation autorisée selon la décision 0003 ; poursuivre la relecture du socle sans présenter une approbation de Salam comme acquise.                              |
| T02   | Squash seul et suppression des branches actifs. Rulesets refusés (403), analyse native des secrets refusée (422). Dependabot actif et permissions Actions en lecture.   | Protections techniques partiellement bloquées par l'offre actuelle du dépôt privé. Maintenir les règles d'équipe sans annoncer un blocage technique actif.             |
| T03   | 16 labels et modèles publiés sur `main`. Project privé #3 créé et lié, vue Board Tableau équipe présente, accès WRITER de Salam confirmé.                               | Les colonnes Status sont confirmées par l’API. Vérifier la reconnaissance de CODEOWNERS après fusion sur main. Aucun champ Avancement supplémentaire n'est nécessaire. |
| T04   | AGENTS.md et import CLAUDE.md publiés dans la PR #36.                                                                                                                   | Recueillir le retour de Salam ; la première fusion relève de la décision 0003.                                                                                         |
| T05   | 35 issues T06 à T40 (#1 à #35) créées, affectées et présentes dans le Project privé. T06/T07 en revue, 33 autres cartes à faire.                                        | Conserver la correspondance TXX/numéro GitHub et actualiser les cartes au fil des validations. Ne pas fermer les tâches métier par la seule création de leurs issues.  |
| T06   | Expo, TypeScript et navigation publiés dans la PR #36. Types, test mobile et export Android vérifiés localement.                                                        | Ouvrir l'application sur Android et obtenir la relecture ; les écrans métier viennent après T07.                                                                       |
| T07   | Contrôles locaux réussis, 17 tests des outils et 1 test mobile verts. Hooks observés. CI réussie sur `main` en manuel et sur la PR #38, y compris Gitleaks et le titre. | Obtenir la relecture humaine avant de fermer la tâche. Les limites de protection du dépôt privé restent explicites.                                                    |

## Preuves locales et distantes

Le [rapport de validation](../guides/validation-du-socle.md) couvre l'installation
reproductible, le format, le lint, les types, les tests, l'export Android et les
essais des hooks. La navigation a été vérifiée par Jest et le bundle exporté,
sans ouverture sur appareil. Les messages de commit invalides sont refusés ;
le hook avant commit a contrôlé les changements indexés du premier commit :
20 fichiers JavaScript/TypeScript et 64 documents/configurations. Commitlint a
accepté son message.
L'audit npm signale encore des alertes de dépendances détaillées dans ce rapport.

La PR #36 livre le socle initial, avec une exception de fusion autorisée par PAN
et consignée dans la décision 0003. La PR #37 corrige le README affiché à
l'accueil, avec l'autorisation explicite de PAN. Aucun accord de Salam n'est
inventé. Le Project privé #3 et ses 35 cartes sont créés.

Le support a confirmé à PAN le 2 novembre 2026 à 16 h 54 UTC qu'une vérification
d'autorisation refusée avait verrouillé temporairement le compte, puis qu'il
l'avait déverrouillé. La CI sur `main` a ensuite réellement démarré et
l'exécution manuelle [41490101961](https://github.com/PapaAmad/teranga-pay/actions/runs/41490101961)
a réussi au commit `31c94ab16de3e863276ffc076beec643497d9d24`. Les six jobs
étaient verts, dont `Secrets` ; le job `Titre PR` affichait seulement un message
de passage hors événement `pull_request`.

La [PR #38](https://github.com/PapaAmad/teranga-pay/pull/38) a ensuite déclenché
le run [41491000731](https://github.com/PapaAmad/teranga-pay/actions/runs/41491000731)
sur événement `pull_request`, au commit
`03e7f24ecf56dbc9c9b2f792f8f53ed69d5410bf`. Les six jobs sont verts. L'étape
`Vérifier le titre` a réellement réussi, tandis que `Sans PR` a été ignorée.
La validation technique sur PR est acquise pour ce commit ; la relecture
humaine reste à obtenir et T07 demeure en revue. L'ouverture sur Android
attendue pour T06 reste une validation distincte.

Dependabot est configuré sur `main` et son workflow actif est reconnu. Le
déverrouillage d'Actions ne change ni la visibilité privée du dépôt ni les
limites de l'offre pour la protection de `main` et l'analyse native des secrets.
Consulter le relevé GitHub pour les preuves et les anciens diagnostics. Une
configuration préparée ou une commande lancée ne constitue pas à elle seule
une protection effective.

## Avant de fermer les tâches

- T01 : dépôt privé vérifié, code publié et accès collaborateur confirmé.
- T02 : réglages réellement appliqués et testés ; fonctions indisponibles identifiées sans les déclarer actives.
- T03 : modèles et CODEOWNERS reconnus, labels vérifiés, Project privé et accès contrôlés.
- T04 : règles communes relues par Salam.
- T05 : 35 issues T06 à T40 et cartes correspondantes, affectations vérifiées.
- T06 : commandes de qualité réussies et application ouverte sur Android.
- T07 : contrôles locaux et CI distante verts sur une PR, y compris son titre ; hooks observés sur les changements indexés, limites de protection explicites et relecture humaine obtenue.

Le [guide du dépôt distant](../guides/depot-distant.md) est la procédure de
référence. Les opérations de mise en place déjà autorisées se poursuivent dans
ce cadre privé ; aucune nouvelle création ou publication publique n'est requise.

## Limite de cette livraison

T08 et les tâches suivantes restent planifiées : pas de charte finale, de SDK
choisi, de phrase secrète, d'API, de réseau regtest, de retrait, d'APK signé ou de
parcours de paiement opérationnel. Voir la [feuille de route](roadmap.md) et la
[vue d'architecture](../architecture/vue-ensemble.md).
