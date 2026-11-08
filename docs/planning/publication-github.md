# Publication GitHub | état vérifié

Relevé du 2 novembre 2026, heure de Dakar. Les résultats ci-dessous proviennent des réponses GitHub et des contrôles réellement exécutés. Le socle est livré sur `main` via la PR #36, avec l’exception d’initialisation autorisée explicitement par PAN et décrite dans la [décision 0003](../decisions/0003-initialisation-main.md). Après le déverrouillage du compte par le support, la CI a réussi sur `main` en lancement manuel, puis sur la PR #38 avec le contrôle du titre réellement exécuté. Les commentaires de Salam ont été reçus ; son approbation reste à obtenir.

| Élément                    | État constaté                                                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dépôt                      | [PapaAmad/teranga-pay](https://github.com/PapaAmad/teranga-pay), **privé**.                                                                                                                              |
| Branche par défaut         | `main`, contenant le socle intégré par la PR #36 et la correction du README par la PR #37.                                                                                                               |
| Socle                      | Livré par la [PR #36](https://github.com/PapaAmad/teranga-pay/pull/36), fusion squash initiale autorisée par PAN.                                                                                        |
| Premier commit du socle    | [2024572](https://github.com/PapaAmad/teranga-pay/commit/2024572407e2df6e6d8b9d0de34fd277e27d61c9), `chore(repo): initialise le socle de Teranga Pay`.                                                   |
| Salam                      | `AliouneKane` a accepté l'invitation ; accès `write` au dépôt confirmé et relecture demandée sur la PR.                                                                                                  |
| Fusion                     | Squash seul, fusion classique et rebase désactivés, suppression automatique des branches fusionnées active.                                                                                              |
| Actions                    | Activé, toutes les actions autorisées, permissions de workflow par défaut en lecture ; exécutions réussies sur `main` en lancement manuel et sur la PR #38 après intervention du support.                |
| Labels                     | Les 16 labels du plan sont créés.                                                                                                                                                                        |
| Issues                     | Les 35 tâches T06 à T40 sont créées et assignées à leurs responsables ; correspondance ci-dessous.                                                                                                       |
| Project                    | [Project #3](https://github.com/users/PapaAmad/projects/3), **privé**, lié au dépôt ; accès `WRITER` de Salam accordé.                                                                                   |
| Tableau                    | [Tableau équipe](https://github.com/users/PapaAmad/projects/3/views/2), vue Board regroupée par le champ natif `Status` ; quatre états français et 35 cartes : 2 en revue (T06/T07), 33 à faire.         |
| Dependabot                 | Alertes et corrections de sécurité automatiques activées. Configuration des mises à jour régulières présente sur `main` et reconnue ; workflow Dependabot actif confirmé.                                |
| Contrôles locaux           | Après revue : format, lint, types, 34 tests des outils et 1 parcours mobile réussis ; 1 test de liens symboliques ignoré sur Windows, à exécuter en CI Linux.                                            |
| Gitleaks local             | Version 8.30.1 officielle, archive vérifiée par SHA256 ; scan de l'historique Git avec `--redact` réussi, aucun secret détecté.                                                                          |
| CI et Gitleaks distants    | **Preuve avant correctifs de revue** : [41497845298](https://github.com/PapaAmad/teranga-pay/actions/runs/41497845298), commit e0124c1, six jobs verts. Pour les commits suivants : Checks de la PR #38. |
| Protection de `main`       | **Non activée** : HTTP 403, GitHub demande une offre compatible, notamment GitHub Pro pour cette fonction sur ce dépôt privé.                                                                            |
| Analyse native des secrets | **Indisponible** : HTTP 422, « Secret scanning is not available for this repository. »                                                                                                                   |

Le regroupement des colonnes a été vérifié dans `ProjectV2View.verticalGroupByFields`, qui renvoie le champ `Status`. L'absence de regroupement horizontal dans `groupByFields` ne signifie pas que la vue Board n'a pas de colonnes. Aucun second champ `Avancement` n'a été créé.

## Limites à conserver visibles

La visibilité privée a été demandée explicitement par PAN. La [décision de visibilité](../decisions/0002-visibilite-privee.md) explique cet écart au plan PDF initial. La visibilité n'est pas changée pour contourner les limites de l'offre GitHub.

Les règles de `main` sont prêtes dans [main-ruleset.json](../../.github/main-ruleset.json), mais **elles ne sont pas appliquées**. Sans protection distante, la PR, la relecture et l'attente des contrôles restent des règles d'équipe ; GitHub ne les impose pas à la fusion. La [documentation GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches) précise les offres compatibles avec les protections sur les dépôts privés.

La CI Gitleaks, le scan local et l'analyse native GitHub sont trois mécanismes distincts. Le scan local et le job distant `Secrets` ont réussi ; la protection native au push n'est pas activée. Le déverrouillage du compte rétablit l'exécution d'Actions, sans activer les protections de branche réservées à une offre compatible sur ce dépôt privé. Les opérations de configuration du dépôt n'ont modifié aucun abonnement ni moyen de paiement.

## Diagnostic du démarrage GitHub Actions

Les premières tentatives de la PR étaient les exécutions [41453527594](https://github.com/PapaAmad/teranga-pay/actions/runs/41453527594) et [41453528513](https://github.com/PapaAmad/teranga-pay/actions/runs/41453528513). GitHub renvoyait :

- `conclusion: startup_failure` ;
- workflow `404552097`, nom vide, chemin `BuildFailed`, état `deleted` ;
- zéro job, zéro check et aucune annotation exploitable ;
- message de la CLI : « This run likely failed because of a workflow file issue. »

Le fichier `.github/workflows/ci.yml` est valide selon **actionlint 1.7.12**, binaire officiel dont l'archive a été vérifiée par SHA256. La commande `actionlint -no-color -shellcheck= .github/workflows/ci.yml` se termine avec le code 0, sans erreur.

Un workflow indépendant faisant uniquement `echo`, sans action externe ni dépendance npm, a été testé sur une branche de diagnostic privée. L'exécution [41454587635](https://github.com/PapaAmad/teranga-pay/actions/runs/41454587635) présentait le même échec avant les jobs. Le commit de diagnostic est `0fda4ff594cacf6ce520bdd35d090a2d85d7468e` ; sa branche temporaire a été supprimée après le test, ses résultats restent disponibles.

Ce résultat montrait que le blocage ne se limitait pas aux commandes de l'application ou à l'installation npm. À ce stade, l'API ne précisait pas la cause exacte et aucun résultat CI vert ne pouvait être annoncé. La confirmation du support et la reprise des exécutions sont consignées ci-dessous.

### Test de la branche par défaut

L'hypothèse d'un blocage lié au `main` d'initialisation a été testée séparément. Le déclencheur manuel `workflow_dispatch` a été ajouté et validé par actionlint. La branche complète `chore/T01-fondations` a ensuite été définie temporairement comme branche par défaut, sans fusion ni modification de `main`.

GitHub a alors enregistré le vrai workflow **CI**, identifiant `404577210`, avec le chemin `.github/workflows/ci.yml` et l'état `active`. La demande de lancement manuel a reçu HTTP 204. L'exécution [41457174380](https://github.com/PapaAmad/teranga-pay/actions/runs/41457174380) a malgré tout terminé en `startup_failure` avant les jobs.

La branche par défaut a été rétablie sur `main` après le test, le dépôt est resté privé et le commit de `main` était alors resté `4df760e03fd75ff13183c6cbc488589a3236e71a`. Ce test avait corrigé le problème d'enregistrement manuel, mais montrait que l'absence du workflow sur `main` n'expliquait pas à elle seule le refus d'exécution.

PAN a autorisé explicitement la fusion squash de la PR #36 pour initialiser `main`, après avoir été informé du refus de CI distante et de l’absence d’approbation de Salam. Cette décision unique est consignée dans la décision 0003 ; elle ne constituait pas une réparation de GitHub Actions et ne modifie pas les règles des tâches suivantes. Le dépôt demeure privé.

### Résolution confirmée par le support

PAN a transmis la réponse de GitHub Support du **2 novembre 2026 à 16 h 54 UTC**. Le support y confirme qu'une vérification d'autorisation refusée avait entraîné un verrouillage temporaire du compte, puis qu'il a levé ce verrouillage manuellement. Ce retour établit la cause du refus d'exécution ; les anciens échecs `startup_failure` restent des preuves du diagnostic initial.

Après cette intervention, le workflow **CI** a été lancé manuellement sur `main`, au commit `31c94ab16de3e863276ffc076beec643497d9d24`. L'exécution [41490101961](https://github.com/PapaAmad/teranga-pay/actions/runs/41490101961) s'est terminée avec la conclusion `success` et les six jobs verts : `Format`, `Lint`, `Types`, `Tests`, `Titre PR` et `Secrets`. Les commandes de qualité et le scan Gitleaks ont donc réellement tourné sur GitHub.

Ce premier lancement utilisait `workflow_dispatch`. Le job `Titre PR` y a seulement exécuté le message indiquant que le contrôle s'applique aux PR : il n'a validé aucun titre sur cet événement.

La [PR #38](https://github.com/PapaAmad/teranga-pay/pull/38) a ensuite déclenché une vraie exécution `pull_request`. Le run [41497845298](https://github.com/PapaAmad/teranga-pay/actions/runs/41497845298), au commit `e0124c184052d5529dc306f184bc764ef7ac0f8b`, a terminé avec la conclusion `success` et les six jobs verts. Dans `Titre PR`, l'étape `Vérifier le titre` a réussi et l'étape `Sans PR` a été ignorée : le contrôle du titre est donc réellement validé sur cette PR. T07 reste en revue jusqu'à la relecture humaine ; les résultats CI ne constituent ni une approbation de Salam ni une clôture de la tâche.

La [PR #37](https://github.com/PapaAmad/teranga-pay/pull/37), fusionnée avec l'autorisation explicite de PAN, corrige également l'accueil du dépôt : `.github/GUIDE.md` documente la configuration GitHub et le README racine `README.md` est celui présenté pour le projet. Cette correction est incluse dans le commit validé ci-dessus.

## Correspondance des tâches et des issues

Les numéros GitHub ne suivent pas les numéros du plan. Utiliser cette correspondance pour les références `Closes #N`, puis fermer seulement les tâches réellement terminées. Aucune issue n'est fermée automatiquement par la mise en place.

| Tâche | Issue GitHub                                             | Responsable               |
| ----- | -------------------------------------------------------- | ------------------------- |
| T06   | [#1](https://github.com/PapaAmad/teranga-pay/issues/1)   | `PapaAmad`                |
| T07   | [#2](https://github.com/PapaAmad/teranga-pay/issues/2)   | `PapaAmad`                |
| T08   | [#3](https://github.com/PapaAmad/teranga-pay/issues/3)   | `PapaAmad`                |
| T09   | [#4](https://github.com/PapaAmad/teranga-pay/issues/4)   | `PapaAmad`                |
| T10   | [#5](https://github.com/PapaAmad/teranga-pay/issues/5)   | `AliouneKane`             |
| T11   | [#6](https://github.com/PapaAmad/teranga-pay/issues/6)   | `AliouneKane`, `PapaAmad` |
| T12   | [#7](https://github.com/PapaAmad/teranga-pay/issues/7)   | `AliouneKane`             |
| T13   | [#8](https://github.com/PapaAmad/teranga-pay/issues/8)   | `AliouneKane`             |
| T14   | [#9](https://github.com/PapaAmad/teranga-pay/issues/9)   | `PapaAmad`                |
| T15   | [#10](https://github.com/PapaAmad/teranga-pay/issues/10) | `AliouneKane`             |
| T16   | [#11](https://github.com/PapaAmad/teranga-pay/issues/11) | `PapaAmad`                |
| T17   | [#12](https://github.com/PapaAmad/teranga-pay/issues/12) | `AliouneKane`             |
| T18   | [#13](https://github.com/PapaAmad/teranga-pay/issues/13) | `PapaAmad`                |
| T19   | [#14](https://github.com/PapaAmad/teranga-pay/issues/14) | `AliouneKane`             |
| T20   | [#15](https://github.com/PapaAmad/teranga-pay/issues/15) | `PapaAmad`                |
| T21   | [#16](https://github.com/PapaAmad/teranga-pay/issues/16) | `AliouneKane`             |
| T22   | [#17](https://github.com/PapaAmad/teranga-pay/issues/17) | `PapaAmad`                |
| T23   | [#18](https://github.com/PapaAmad/teranga-pay/issues/18) | `PapaAmad`                |
| T24   | [#19](https://github.com/PapaAmad/teranga-pay/issues/19) | `PapaAmad`                |
| T25   | [#20](https://github.com/PapaAmad/teranga-pay/issues/20) | `PapaAmad`                |
| T26   | [#21](https://github.com/PapaAmad/teranga-pay/issues/21) | `AliouneKane`             |
| T27   | [#22](https://github.com/PapaAmad/teranga-pay/issues/22) | `PapaAmad`                |
| T28   | [#23](https://github.com/PapaAmad/teranga-pay/issues/23) | `PapaAmad`                |
| T29   | [#24](https://github.com/PapaAmad/teranga-pay/issues/24) | `AliouneKane`             |
| T30   | [#25](https://github.com/PapaAmad/teranga-pay/issues/25) | `PapaAmad`                |
| T31   | [#26](https://github.com/PapaAmad/teranga-pay/issues/26) | `AliouneKane`             |
| T32   | [#27](https://github.com/PapaAmad/teranga-pay/issues/27) | `PapaAmad`                |
| T33   | [#28](https://github.com/PapaAmad/teranga-pay/issues/28) | `PapaAmad`                |
| T34   | [#29](https://github.com/PapaAmad/teranga-pay/issues/29) | `AliouneKane`             |
| T35   | [#30](https://github.com/PapaAmad/teranga-pay/issues/30) | `AliouneKane`             |
| T36   | [#31](https://github.com/PapaAmad/teranga-pay/issues/31) | `AliouneKane`             |
| T37   | [#32](https://github.com/PapaAmad/teranga-pay/issues/32) | `PapaAmad`                |
| T38   | [#33](https://github.com/PapaAmad/teranga-pay/issues/33) | `AliouneKane`             |
| T39   | [#34](https://github.com/PapaAmad/teranga-pay/issues/34) | `AliouneKane`, `PapaAmad` |
| T40   | [#35](https://github.com/PapaAmad/teranga-pay/issues/35) | `AliouneKane`             |

Les étapes de référence se trouvent dans le [guide du dépôt distant](../guides/depot-distant.md) et les critères de clôture dans le [suivi T01 à T07](suivi-t01-t07.md).

La preuve CI citée pour la PR #38 couvre précisément le commit `e0124c184052d5529dc306f184bc764ef7ac0f8b`, avant les correctifs de revue. Elle ne valide pas les commits suivants. Pour la version courante, consulter les [contrôles de la PR #38](https://github.com/PapaAmad/teranga-pay/pull/38/checks) et vérifier leur SHA.
