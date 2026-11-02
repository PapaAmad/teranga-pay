# Préparation du dépôt distant

Ce dossier prépare T02, T03 et T05 : réglages GitHub, labels, backlog T06 à T40 et
Project. Il ne contient aucun secret. Les noms et dates viennent du plan d’équipe ;
les critères d’acceptation en détaillent les objectifs pour la relecture.

## Prévisualiser

Depuis la racine, Node suffit. Cette commande ne fait aucun appel réseau et
n’écrit rien, même si GitHub CLI n’est pas installé :

```sh
node scripts/github/setup.mjs --dry-run
node --test scripts/github/*.test.mjs
```

Les identifiants sont dans [repository.json](../../.github/repository.json).
Adapter `repository` si un autre nom de dépôt est retenu. `--config=chemin.json`
permet une autre configuration avec les mêmes champs.

## Créer et relier le dépôt (T01)

Suivre le [guide du dépôt distant et du premier commit](../../docs/guides/depot-distant.md),
qui fait référence pour la première publication depuis le dossier courant.
Il détaille la relecture et le commit local proposés, l’installation de GitHub
CLI, la création du dépôt public, l’invitation de Salam, le raccordement de la
branche de tâche à `origin/main`, la première PR et les vérifications distantes.
Le script ne crée pas le dépôt et ne pousse aucun fichier. Aucun commit ni
réglage distant n’est effectué par une simple prévisualisation.

## Appliquer les réglages

Le mode `--apply` écrit sur GitHub. Il exige `gh`, une session authentifiée,
le dépôt existant et les droits d’administration pour les réglages. L’invitation
de `AliouneKane` doit être acceptée avant la section `issues`, qui lui assigne des tâches.
Exécuter d’abord la CI sur la PR qui ajoute les outils T06 à T07 pour enregistrer les six contrôles,
puis activer le ruleset et vérifier son effet.

```sh
node scripts/github/setup.mjs --apply --section=labels
node scripts/github/setup.mjs --apply --section=issues
node scripts/github/setup.mjs --apply --section=settings
gh auth refresh -s project
node scripts/github/setup.mjs --apply --section=project
```

`--section=all` applique ces quatre sections dans l’ordre réglages, labels, issues,
Project. Les labels sont mis à jour sans suppression ; le ruleset du même nom est
mis à jour ; les issues existantes TXX sont conservées avec leurs discussions et
leur état, y compris fermé. Un doublon interrompt l’exécution. Un échec arrête le
script mais n’annule pas les étapes précédentes : il est possible de relancer la
section après correction. Les règles appliquées n’accordent aucun contournement.
L’exception d’urgence du plan d’équipe se gère explicitement dans GitHub avec une
trace dans la PR, jamais automatiquement.

Le Project est retrouvé par son titre ou créé. Il est relié au dépôt et reçoit un
champ `Avancement` : À faire → En cours → En revue → Terminé. Les issues sont
ajoutées si absentes. Finaliser dans GitHub : vue Board groupée par Avancement,
cartes initiales dans À faire, règles de passage en revue/terminé. Le script ne
prétend pas configurer les vues ni les automatismes du tableau. Le jeton doit
autoriser les Projects. Au-delà de 100 Projects ou 1 000 cartes, vérifier les
limites avant de relancer la section Project.

## Vérification humaine restante

- Régler le dépôt sur public, vérifier le collaborateur et la branche `main`.
- Confirmer squash seul, suppression automatique et protection contre force push.
- Vérifier les six contrôles et l’approbation obligatoire de l’autre membre.
- Ouvrir une PR de test et vérifier qu’un échec de CI bloque la fusion.
- Confirmer l’analyse des secrets et la protection au push dans Settings.
- Finaliser la vue du Project et fermer seulement les tâches réellement terminées.

Documentation de référence : [rulesets REST](https://docs.github.com/en/rest/repos/rules),
[règles disponibles](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
[GitHub Projects CLI](https://cli.github.com/manual/gh_project).
