# Vérification du socle T01 à T07

Vérifications du 2 novembre 2026 : contrôles locaux sous Windows avec Node.js 24.22.0 et npm 12.2.1, puis CI distante sur Linux après le déverrouillage du compte par le support GitHub. Ce relevé décrit les résultats observés ; il ne constitue pas une approbation de Salam.

| Vérification                 | Résultat observé                                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation des dépendances | Installation npm, puis réinstallation réussie depuis le verrouillage avec `npm ci --no-audit`. Dépendances sans conflit signalé par `npm ls --depth=0`.         |
| Format, lint et types        | Commandes communes exécutées sur le dépôt.                                                                                                                      |
| Parcours mobile Jest         | 1 test réussi : accueil, présentation et retour avec le vrai navigateur React Navigation ; les appels natifs sont adaptés à Jest.                               |
| Outillage après revue        | 35 tests : 34 réussis, 1 ignoré sur Windows faute de droit de création de liens symboliques. Backlog, migrations, confidentialité, structure et liens couverts. |
| Structure documentaire       | Documentation de chaque dossier maintenu et liens Markdown relatifs vérifiés ; `.github/GUIDE.md` conserve la priorité du README principal.                     |
| Export Android               | Metro et Hermes ont généré un bundle de 823 modules, environ 1,9 Mo, accompagné de 17 assets dans `.tmp/mobile-export`.                                         |
| Hook `commit-msg`            | Essais invalides refusés ; message réel `chore(repo): initialise le socle de Teranga Pay` accepté lors du premier commit.                                       |
| Hook `pre-commit`            | Exécuté sur les fichiers réellement indexés au premier commit : lint-staged a contrôlé 20 fichiers JavaScript/TypeScript et 64 documents/configurations.        |
| Gitleaks local               | Version 8.30.1 officielle : historique Git analysé avec `--redact`, code 0, aucune fuite détectée.                                                              |
| Syntaxe du workflow          | actionlint 1.7.12 officiel, archive vérifiée : code 0, aucune erreur.                                                                                           |

Les sorties temporaires et l'export sont ignorés par Git. L'export Android ne remplace pas une installation sur téléphone, une compilation APK ni les futurs tests de paiement.

Les 18 tests initiaux étaient verts. Après les correctifs de revue, le test mobile et les 34 tests des outils exécutables sur ce poste réussissent ; le test de liens symboliques attend la CI Linux. Le premier commit du socle est
`2024572407e2df6e6d8b9d0de34fd277e27d61c9`, publié sur `chore/T01-fondations`.
Le socle est livré via la [PR #36](https://github.com/PapaAmad/teranga-pay/pull/36). PAN a autorisé cette première fusion en exception selon la [décision 0003](../decisions/0003-initialisation-main.md) ; aucune approbation de Salam n’est inventée. Les premiers lancements distants, dont un workflow minimal faisant seulement `echo`, avaient échoué en `startup_failure` avant les jobs. Le support GitHub a ensuite confirmé et levé le verrouillage du compte lié à un échec d'autorisation du moyen de paiement.

La [CI manuelle du 2 novembre 2026 sur `main`](https://github.com/PapaAmad/teranga-pay/actions/runs/41490101961), commit `31c94ab16de3e863276ffc076beec643497d9d24`, a terminé avec `conclusion: success`. Les jobs **Format**, **Lint**, **Types**, **Tests** et **Secrets** ont réussi. Le job **Titre PR** y a seulement exécuté son étape de passage hors PR.

La [CI de la PR #38](https://github.com/PapaAmad/teranga-pay/actions/runs/41497845298), au commit `e0124c184052d5529dc306f184bc764ef7ac0f8b`, a ensuite réussi les six contrôles sur événement `pull_request`. L'étape **Vérifier le titre** est passée et **Sans PR** a été ignorée : le titre a donc été réellement validé. Les logs distants confirment 1 test mobile, 17 tests des outils et aucune fuite trouvée par Gitleaks sur `main`. Les preuves et les identifiants d'exécution figurent dans le [relevé GitHub](../planning/publication-github.md).

## Audit des dépendances

`npm audit --audit-level=high` a renvoyé **47 alertes : 6 faibles, 39 modérées et 2 élevées**, en comptant les paquets qui propagent une alerte transitive. Ce contrôle n'est donc pas vert. Les vérifications de code et la réussite de l'export ne corrigent pas ces alertes.

L'alerte élevée identifiée concerne Zod avant 4.6.6, dépendance de l'outillage Expo CLI 57. Le CLI installé utilise Zod 3.25.76 pour ses schémas de plugins DevTools et d'extensions ; le code applicatif du socle ne l'importe pas. Cette observation de portée ne vaut pas correction de la dépendance. L'[avis de sécurité](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) indique un correctif à partir de 4.6.6, et le [mainteneur de Zod](https://github.com/colinhacks/zod/issues/6653) indique l'arrêt des publications de la branche 3.

La contrainte Expo CLI 57 reste `^3.25.76` au moment du contrôle. Un remplacement forcé par une version majeure différente n'a pas été appliqué : les chemins d'extension concernés exigeraient leur propre validation. `npm audit fix --force` propose également des changements majeurs et une rétrogradation d'Expo ; ce n'est pas une procédure de maintenance retenue pour le dépôt.

Les alertes modérées se propagent notamment par les dépendances `glob` et `minimatch` des outils ; une alerte faible concerne `deepmerge`. Dependabot est configuré pour suivre les mises à jour. Salam devra examiner les alertes et les évolutions compatibles du SDK avant de clore T31. Une migration du SDK devra vérifier de nouveau la navigation, les types, les tests et l'export Android. Aucun plugin DevTools supplémentaire ni serveur MCP expérimental Expo n'est activé par ce socle.

## Contrôles encore nécessaires

- Installer et ouvrir l'application sur un téléphone Android ou un émulateur.
- Maintenir les six contrôles verts sur chaque nouvelle version des PR ; la PR #38 a validé les six, y compris son titre sur événement `pull_request`.
- Conserver les limites de l'offre visibles : les rulesets et l'analyse native des secrets ont été refusés et ne sont pas actifs. La levée du verrouillage de facturation ne les active pas.
- Obtenir la relecture humaine de Salam ; les hooks ont déjà été observés sur les premiers changements indexés.
- Réévaluer les alertes de dépendances avant les étapes de sécurité et de livraison.

Les paiements regtest, la passerelle simulée, les tests d'intégration et l'APK relèvent des tâches suivantes. Voir le [suivi T01 à T07](../planning/suivi-t01-t07.md).

Les opérations GitHub évoluent après ce relevé local : consulter leur [état vérifié](../planning/publication-github.md). La visibilité du dépôt et du Project reste privée selon la décision de PAN.

La preuve CI citée pour la PR #38 couvre précisément le commit `e0124c184052d5529dc306f184bc764ef7ac0f8b`, avant les correctifs de revue. Elle ne valide pas les commits suivants. Pour la version courante, consulter les [contrôles de la PR #38](https://github.com/PapaAmad/teranga-pay/pull/38/checks) et vérifier leur SHA.
