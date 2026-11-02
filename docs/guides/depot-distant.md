# Publier et configurer le dépôt privé

Ce guide est la procédure de référence pour le dépôt **privé**
[PapaAmad/teranga-pay](https://github.com/PapaAmad/teranga-pay). PAN a autorisé la
mise en place GitHub le 2 novembre 2026, puis précisé que le dépôt et son tableau
doivent rester privés. La [décision 0002](../decisions/0002-visibilite-privee.md)
remplace la visibilité publique prévue dans les PDF.

Le dépôt privé existe avec un README initial sur `main`. Salam a accepté
l'invitation et son accès en écriture est confirmé. Les réglages squash et suppression des
branches fusionnées ainsi que les 16 labels ont été appliqués. Les 35 issues
T06 à T40 sont créées (#1 à #35) et affectées à leurs responsables. À la rédaction
de ce guide, le code du socle, sa PR et le Project sont en préparation. Les
rulesets et l'analyse native des secrets sont refusés par GitHub avec l'offre
actuelle ; aucune protection de branche n'est annoncée active. Le
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

## 2. Vérifier et commiter le socle local

Rester sur la branche de tâche `chore/T01-fondations`. Les PDF sources, fichiers
cachés `.github` et `.husky`, exemple neutre `.env.example` et lockfile font partie
du travail à relire. Les `.env` réels, `.tmp`, `node_modules` et sorties générées
restent ignorés.

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test -- --ci
npm.cmd run test:tooling
npm.cmd run repo:check
git add --all
git diff --cached --check
git diff --cached --stat
git diff --cached
```

Après inspection du contenu, le message du premier commit local est :

```powershell
git commit -m "chore(repo): initialise le socle de Teranga Pay"
```

Il respecte le format et la limite de 72 caractères. Les hooks contrôlent les
fichiers indexés et le message. Corriger tout échec avant de réessayer ; conserver
le résultat des vérifications dans la PR. Le premier socle regroupe T01 à T07 et
doit le préciser ; les tâches suivantes gardent chacune leur issue, branche et PR.
Si ce commit existe déjà, le vérifier au lieu de le refaire.

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
répéter un repositionnement de branche. Le commit du socle sera créé sur cette
base, puis publié uniquement sur `chore/T01-fondations`. Aucun push direct sur
`main` n'est requis.

## 4. Publier la branche et ouvrir la PR

Publier uniquement la branche de tâche :

```powershell
git push -u origin chore/T01-fondations
gh pr create --base main --head chore/T01-fondations --draft --title "chore(repo): initialise le socle de Teranga Pay" --template pull_request_template.md
```

Si une PR existe déjà, reprendre cette PR au lieu d'en créer une seconde.
Remplir les explications « En clair », le périmètre, les validations, les limites
et l'assistance de Codex. Utiliser les vrais numéros d'issues dans `Closes #N`,
une fois leur correspondance avec les identifiants TXX connue.

Attendre les contrôles **Format**, **Lint**, **Types**, **Tests**, **Titre PR** et
**Secrets**. Un workflow présent sur la branche n'est pas encore une CI verte.
Le CODEOWNERS de la première PR n'est pas encore sur `main` ; demander la revue
de Salam manuellement après passage en revue.
Aucune fusion ne doit être déclarée effectuée avant la revue humaine requise.

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

Pour le Project, vérifier les droits du compte puis utiliser la section dédiée :

```powershell
gh auth refresh -s project
node scripts/github/setup.mjs --apply --section=project
```

Vérifier explicitement la visibilité **Private** du Project. Elle est distincte
de celle du dépôt : aucune publication du tableau n'est prévue. Vérifier son lien
au dépôt, l'accès de Salam et le champ `Avancement`. La vue Board et ses colonnes
**À faire | En cours | En revue | Terminé** se finalisent dans GitHub si elles ne
sont pas configurées par la version courante du script. Les données et les accès
ne sont déclarés en place qu'après vérification dans le relevé de publication.

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

Les contrôles CI et les hooks restent à vérifier séparément. Le contrôle Secrets
de la CI ne se confond pas avec l'analyse native de GitHub : Gitleaks est préparé
mais son premier résultat distant reste à venir. Les alertes Dependabot et leurs
mises à jour ont été activées ; les permissions Actions sont réglées en lecture.
Vérifier la reconnaissance de la configuration Dependabot après sa présence sur
`main`.

## 7. Relecture, fusion et suivi

La PR reste en attente tant que la CI, les conversations et la relecture humaine
requises ne sont pas satisfaites. Une limitation du compte GitHub doit être
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
