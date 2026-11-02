# Publication GitHub | état vérifié

Relevé du 2 novembre 2026, heure de Dakar. Les résultats ci-dessous proviennent des réponses GitHub, pas de la seule présence des fichiers de configuration. La publication du socle est en cours ; ce relevé sera complété après création de la PR et exécution de la CI.

| Élément                    | État constaté                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Dépôt                      | [PapaAmad/teranga-pay](https://github.com/PapaAmad/teranga-pay), **privé**.                                                           |
| Branche par défaut         | `main`, initialisée sur GitHub ; le socle est préparé sur `chore/T01-fondations`.                                                     |
| Salam                      | `AliouneKane` a accepté l'invitation ; accès `write` confirmé.                                                                        |
| Fusion                     | Squash seul, fusion classique et rebase désactivés, suppression automatique des branches fusionnées active.                           |
| Actions                    | GitHub Actions activé ; permissions de workflow par défaut en lecture.                                                                |
| Labels                     | Les 16 labels du plan sont créés.                                                                                                     |
| Issues                     | Les 35 tâches T06 à T40 sont créées et assignées à leurs responsables ; correspondance ci-dessous.                                    |
| Dependabot                 | Alertes activées ; corrections de sécurité automatiques activées. Le fichier de mises à jour régulières arrivera avec la PR du socle. |
| Protection de `main`       | **Non activée** : GitHub renvoie HTTP 403 et demande GitHub Pro pour cette fonction sur ce dépôt privé.                               |
| Analyse native des secrets | **Indisponible** : GitHub renvoie HTTP 422, « Secret scanning is not available for this repository. »                                 |
| Gitleaks                   | Contrôle CI préparé ; son résultat distant sera ajouté après l'exécution de la PR.                                                    |
| Project                    | Autorisation `project` validée par PAN ; création du tableau privé en cours.                                                          |
| PR et CI                   | Publication de la branche et première exécution en cours. Aucune fusion du socle effectuée.                                           |

## Limites à conserver visibles

La visibilité privée a été demandée explicitement par PAN. La [décision de visibilité](../decisions/0002-visibilite-privee.md) explique cet écart au plan PDF initial. La visibilité ne sera pas changée pour contourner les limites de l'offre GitHub.

Les règles locales de `main` sont prêtes dans [main-ruleset.json](../../.github/main-ruleset.json), mais **elles ne sont pas appliquées**. Sans protection distante, la CI et la relecture restent des règles d'équipe ; GitHub ne les impose pas à la fusion. Une offre compatible devra être activée par le propriétaire avant de pouvoir exiger ces contrôles sur ce dépôt privé.

La CI Gitleaks est distincte de l'analyse native GitHub et de la protection au push. Aucune de ces protections ne sera déclarée active avant vérification de son résultat effectif. L'offre payante et ses éventuelles options ne sont pas modifiées par cette intervention.

## Correspondance des tâches et des issues

Les numéros GitHub ne suivent pas les numéros du plan. Utiliser cette correspondance pour les références `Closes #N`, puis fermer seulement les tâches réellement terminées.

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
