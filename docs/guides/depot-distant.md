# Publier et configurer le dépôt privé

Ce guide est la procédure de référence pour le dépôt **privé**
[PapaAmad/teranga-pay](https://github.com/PapaAmad/teranga-pay). PAN a autorisé la
mise en place GitHub le 2 novembre 2026, puis précisé que le dépôt et son tableau
doivent rester privés. La [décision 0002](../decisions/0002-visibilite-privee.md)
remplace la visibilité publique prévue dans les PDF.

Le socle est livré sur `main` par la [PR #36](https://github.com/PapaAmad/teranga-pay/pull/36). PAN a autorisé cette première fusion squash comme [exception d’initialisation](../decisions/0003-initialisation-main.md). Salam a accepté l’invitation et son accès en écriture est confirmé ; son approbation de la PR n’est pas prétendue. Les 16 labels et 35 issues
T06 à T40 (#1 à #35) sont créés et affectés. Le
[Project privé #3](https://github.com/users/PapaAmad/projects/3) est créé et lié,
avec 35 cartes et l'accès `WRITER` de Salam. Après la levée du verrouillage du compte par le support GitHub, la [CI manuelle sur `main`](https://github.com/PapaAmad/teranga-pay/actions/runs/41490101961) est verte, y compris Gitleaks. Le titre de PR doit être vérifié sur un événement `pull_request`. Les rulesets
et l'analyse native des secrets sont refusés avec l'offre actuelle. Le
[relevé GitHub](../planning/publication-github.md) est la référence pour l'état
vérifié et les liens réels : ne pas rejouer une création déjà effectuée.

| Membre | Compte GitHub | Rôle                                                 |
| ------ | ------------- | ---------------------------------------------------- |
| Salam  | `AliouneKane` | Accès en écriture confirmé, relecture et approbation |
| PAN    | `PapaAmad`    | Propriétaire, publication et réglages                |

## 1. Vérifier l'existant

Depuis le dossier courant, vérifier le dépôt, la branche et les remotes sans
modifier leur état :

```powershell
git status --short --untracked-files=all
git branch --show-current
git remote -v
gh auth status
gh repo view PapaAmad/teranga-pay --json nameWithOwner,isPrivate,defaultBranchRef,url
```

Le compte de publication est `PapaAmad`, le dépôt doit avoir `isPrivate: true`
et sa branche par défaut doit être `main`. L'accès de Salam est déjà confirmé ;
aucune invitation n'est en attente et aucune seconde invitation n'est nécessaire.

Le dépôt actuel étant déjà créé, la commande de création suivante n'est qu'un
exemple pour une éventuelle recréation décidée séparément. **Ne pas l'exécuter
pour le dépôt existant.** Elle ne publie aucun fichier local :

```powershell
gh repo create PapaAmad/teranga-pay --private
```

Aucun passage en public n'est nécessaire pour terminer la préparation. Le fichier
`LICENSE` local reste MIT ; ne pas générer une autre licence ou un `.gitignore`
concurrent dans GitHub. Les commandes de connexion et de création sont décrites
dans la [documentation GitHub CLI](https://cli.github.com/manual/gh_repo_create).

## 2. Vérifier le commit du socle et ses contrôles

Le premier commit a déjà été créé et publié :
`2024572407e2df6e6d8b9d0de34fd277e27d61c9`, message
`chore(repo): initialise le socle de Teranga Pay`. Ne pas le recréer.
Les hooks ont contrôlé les changements indexés : 20 fichiers JavaScript/TypeScript
et 64 documents/configurations via lint-staged, puis commitlint a accepté le message.
Les 17 tests des outils et le test mobile passent localement.

Les commandes communes restent utiles avant chaque mise à jour de la branche :

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test -- --ci
npm.cmd run test:tooling
npm.cmd run repo:check
```

Le premier socle regroupe T01 à T07 ; la PR en indique le périmètre et les limites.
Les tâches suivantes gardent chacune leur issue, branche et PR. Les `.env` réels,
`.tmp`, `node_modules` et sorties générées restent ignorés. Le
[rapport de validation](validation-du-socle.md) détaille les preuves locales.

## 3. Raccorder la branche à la base distante

Le README créé lors de l'initialisation de GitHub doit rester dans l'ascendance
de la PR. Avec l'arbre de travail propre :

```powershell
git fetch origin
git log -1 --oneline origin/main
git branch --show-current
```

Si `origin` n'existe pas encore, le créer une seule fois avec l'URL
`https://github.com/PapaAmad/teranga-pay.git`. S'il existe, vérifier son URL et
conserver le bon remote. Ne pas créer de nouveau clone pour cette procédure.

La branche locale a déjà été rattachée à la base distante `main`, dont le commit
d'initialisation commence par `4df760e`. Les fichiers du socle ont été conservés.
Il n'est donc pas nécessaire de fusionner des historiques indépendants ou de
répéter un repositionnement de branche. Le commit du socle est déjà publié sur
`chore/T01-fondations`, à partir de cette base. Aucun push direct sur
`main` n'est requis.

## 4. Suivre la PR existante

La branche et la PR sont déjà publiées. Consulter la PR existante au lieu de
créer une seconde PR :

```powershell
gh pr view 36 --repo PapaAmad/teranga-pay
```

La PR #36 représente la livraison initiale autorisée par PAN. Vérifier son statut réel sur GitHub. Les changements suivants partent de `origin/main` dans une nouvelle branche de tâche. Utiliser les vrais numéros d'issues dans les liens de PR, distincts des
identifiants TXX ; ne pas fermer une tâche dont les critères restent incomplets.

Les contrôles attendus sont **Format**, **Lint**, **Types**, **Tests**, **Titre PR**
et **Secrets**. Les premiers lancements avaient échoué en `startup_failure` avant les jobs. Le support GitHub a levé le verrouillage du compte ; la CI manuelle sur `main` a ensuite réussi. Le job **Titre PR** n'y vérifie aucun titre : une PR doit confirmer les six contrôles réellement applicables. Vérifier ses résultats et la relecture humaine avant fusion.

Pour relancer les contrôles du code présent sur `main` sans créer de commit :

```powershell
gh workflow run ci.yml --ref main --repo PapaAmad/teranga-pay
gh run list --workflow ci.yml --repo PapaAmad/teranga-pay --limit 5
```

## 5. Régler les issues et le Project privé

Les 16 labels et les 35 issues T06 à T40 (#1 à #35) sont déjà créés, avec leurs
affectations PAN/Salam. Leur création n'est pas à rejouer. Le mode de
prévisualisation permet de relire le catalogue sans rien créer :

```powershell
node scripts/github/setup.mjs --dry-run
```

Vérifier les responsables, les dates et les critères. Si une synchronisation
ultérieure est nécessaire, la section `--apply --section=issues` conserve les
issues existantes. Les affectations et l'accès en écriture de Salam sont
confirmés. Ne pas fermer une tâche dont les étapes restent à réaliser.

Le [Project #3](https://github.com/users/PapaAmad/projects/3) existe et sa
visibilité **Private** est confirmée. Il est lié au dépôt et Salam possède le
rôle `WRITER`. Ne pas créer de second Project.

Le champ natif `Status` porte les quatre options françaises : **À faire**,
**En cours**, **En revue**, **Terminé**. Il n'est pas nécessaire de le renommer
ou de créer un second champ `Avancement`. Les 35 cartes sont présentes : T06 et
T07 en revue, les 33 autres à faire. Les tâches restent ouvertes jusqu'à leur
validation, même lorsqu'une carte figure en revue.

La vue Board [Tableau équipe](https://github.com/users/PapaAmad/projects/3/views/2) est créée et ses colonnes sont regroupées par `Status`. Ce regroupement a été vérifié dans le champ API `verticalGroupByFields`. Le script de synchronisation réutilise le champ natif existant et ne crée pas de doublon `Avancement`.

## 6. Vérifier les protections disponibles pour le dépôt privé

Squash et suppression automatique des branches ont déjà été réglés lors de la
création. Revérifier leur état après le passage en privé. La configuration de
protection de `main` vise une PR, une approbation de l'autre membre, des
conversations résolues, des contrôles requis et l'interdiction des force push et
de la suppression de branche.

```powershell
node scripts/github/setup.mjs --apply --section=settings
```

Les vérifications effectuées ont confirmé une réponse **403** pour les rulesets,
avec une demande de passage à GitHub Pro pour ce dépôt privé. La demande
d'analyse native des secrets a reçu une réponse **422**, fonction indisponible.
Les rulesets, l'analyse native des secrets et la protection native au push ne
sont donc pas actifs. Le dépôt demeure privé ; ces limites sont consignées dans
le relevé de publication. Le fichier
[main-ruleset.json](../../.github/main-ruleset.json) décrit l'objectif, sans
constituer une protection effective. Relancer sa configuration ne supprime pas
la limite de l'offre.

Les contrôles CI et les hooks se vérifient séparément. Le contrôle **Secrets** de la CI a réussi avec Gitleaks ; il ne se confond pas avec l'analyse native de GitHub. Les hooks ont été observés localement sur les changements indexés. Les alertes Dependabot et leurs mises à jour ont été activées ; le workflow **Dependabot Updates** est enregistré et actif depuis la publication sur `main`. Les permissions Actions restent réglées en lecture.

## 7. Relecture, fusion et suivi

Pour les prochaines PR, attendre la CI verte, les conversations résolues et la relecture humaine. La première initialisation de main bénéficie uniquement de l’exception explicite décrite dans la décision 0003. Une limitation du compte GitHub doit être
visible dans le [suivi T01 à T07](../planning/suivi-t01-t07.md) et le
[relevé de publication](../planning/publication-github.md). Le dépôt demeure
privé pendant ces opérations.

Après une fusion squash réellement effectuée, vérifier le contenu de `main`, la
CI, la licence MIT, les accès, la visibilité privée du dépôt et du Project, et les
liens entre issues et cartes. Fermer uniquement les tâches validées. La charte,
les paiements, le réseau Lightning et l'APK restent les étapes ultérieures.

Pour une nouvelle tâche après la fusion, partir de `origin/main` avec un arbre
propre et une nouvelle branche :

```powershell
git fetch origin --prune
git switch -c feat/T08-charte-visuelle origin/main
```

Les [scripts GitHub](../../scripts/github/README.md) détaillent leur comportement
actuel. Le relevé de publication reste la source de vérité pour ce qui a été
appliqué, refusé ou laissé en attente.
