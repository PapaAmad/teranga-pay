# Suivi du socle T01 à T07

État de mise en place au 2 novembre 2026, heure de Dakar. Responsable : PAN
(`PapaAmad`). Relecteur : Salam (`AliouneKane`). Le dépôt est **privé** selon la
[décision 0002](../decisions/0002-visibilite-privee.md), qui remplace la demande de
visibilité publique des PDF. Le tableau Projects doit également rester privé.

Le [relevé GitHub](publication-github.md) conserve les liens et les dernières
preuves vérifiées ; ce suivi résume les critères et les étapes encore ouvertes.
Salam a accepté l'invitation et son accès en écriture a été vérifié. Une PR
publiée ne constitue pas une fusion approuvée.

| Tâche | État connu                                                                                                                                                                 | Ce qui reste à vérifier ou terminer                                                                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01   | Dépôt privé et accès de Salam confirmés. Socle livré par la PR #36 avec exception d’initialisation autorisée par PAN. Licence MIT présente dans le commit publié.          | Initialisation autorisée selon la décision 0003 ; poursuivre la relecture du socle sans présenter une approbation de Salam comme acquise.                              |
| T02   | Squash seul et suppression des branches actifs. Rulesets refusés (403), analyse native des secrets refusée (422). Dependabot actif et permissions Actions en lecture.      | Protections techniques partiellement bloquées par l'offre actuelle du dépôt privé. Maintenir les règles d'équipe sans annoncer un blocage technique actif.             |
| T03   | 16 labels et modèles publiés dans la branche. Project privé #3 créé et lié, vue Board Tableau équipe présente, accès WRITER de Salam confirmé.                             | Les colonnes Status sont confirmées par l’API. Vérifier la reconnaissance de CODEOWNERS après fusion sur main. Aucun champ Avancement supplémentaire n'est nécessaire. |
| T04   | AGENTS.md et import CLAUDE.md publiés dans la PR #36.                                                                                                                      | Recueillir le retour de Salam ; la première fusion relève de la décision 0003.                                                                                         |
| T05   | 35 issues T06 à T40 (#1 à #35) créées, affectées et présentes dans le Project privé. T06/T07 en revue, 33 autres cartes à faire.                                           | Conserver la correspondance TXX/numéro GitHub et actualiser les cartes au fil des validations. Ne pas fermer les tâches métier par la seule création de leurs issues.  |
| T06   | Expo, TypeScript et navigation publiés dans la PR #36. Types, test mobile et export Android vérifiés localement.                                                           | Ouvrir l'application sur Android et obtenir la relecture ; les écrans métier viennent après T07.                                                                       |
| T07   | Contrôles locaux réussis, 17 tests des outils et 1 test mobile verts. Hooks observés sur le premier commit indexé. CI distante tentée mais startup_failure avant les jobs. | Résoudre le blocage de démarrage Actions puis vérifier les résultats distants, dont Gitleaks. Consigner les limites de protection et attendre la relecture humaine.    |

## Preuves locales et distantes

Le [rapport de validation](../guides/validation-du-socle.md) couvre l'installation
reproductible, le format, le lint, les types, les tests, l'export Android et les
essais des hooks. La navigation a été vérifiée par Jest et le bundle exporté,
sans ouverture sur appareil. Les messages de commit invalides sont refusés ;
le hook avant commit a contrôlé les changements indexés du premier commit :
20 fichiers JavaScript/TypeScript et 64 documents/configurations. Commitlint a
accepté son message.
L'audit npm signale encore des alertes de dépendances détaillées dans ce rapport.

La PR #36 livre le socle initial, avec une exception de fusion autorisée par PAN et consignée dans la décision 0003. Aucun accord de Salam n’est inventé. Le Project privé #3 et ses 35 cartes sont créés. La CI distante est
bloquée au démarrage avant les jobs, avec une cause précise non exposée par l'API ; un workflow minimal indépendant échoue également. Consulter le
relevé GitHub pour les derniers résultats et les liens. Une configuration préparée ou une commande lancée ne
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
