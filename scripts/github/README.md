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
CLI, la création du dépôt privé, l’invitation de Salam, le raccordement de la
branche de tâche à `origin/main`, la première PR et les vérifications distantes.
Le script ne crée pas le dépôt et ne pousse aucun fichier. Aucun commit ni
réglage distant n’est effectué par une simple prévisualisation.

## Appliquer les réglages

Le mode `--apply` écrit sur GitHub. Il exige `gh`, une session authentifiée,
le dépôt existant et les droits d’administration pour les réglages. Les comptes
assignables reçoivent leurs tâches ; une invitation en attente laisse les
responsabilités dans le corps de l’issue et signale l’assignation à compléter.
Une relance après acceptation ajoute les responsables disponibles sans retirer
les personnes ajoutées manuellement.
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
Project. Les labels sont reconnus sans tenir compte de la casse et mis à jour sans suppression.
Les anciens noms de rulesets et de Projects utilisant le séparateur historique
sont reconnus par la même normalisation que les titres d'issues. La ressource
existante est réutilisée et renommée avec `|` ; si plusieurs variantes existent,
le script s'arrête avant de créer une autre ressource.
Les issues existantes TXX sont conservées avec leurs discussions et
leur état, y compris fermé. Le marqueur canonique `teranga-task:TXX` du corps
reste prioritaire lorsqu’un titre est renommé ; le titre ne sert de repli que
pour une issue sans marqueur. Plusieurs marqueurs distincts sur une même issue
ou plusieurs issues pour une tâche interrompent l’exécution. Un échec arrête le
script mais n’annule pas les étapes précédentes : il est possible de relancer la
section après correction. Les règles appliquées n’accordent aucun contournement.
L’exception d’urgence du plan d’équipe se gère explicitement dans GitHub avec une
trace dans la PR, jamais automatiquement.

Le [Project privé n°3](https://github.com/users/PapaAmad/projects/3) existe déjà
avec ses 35 cartes et l’accès de Salam en écriture. Ne pas le recréer : le script
le retrouve par le titre de la configuration ou sa variante historique et ajoute seulement les issues
absentes. Son champ intégré `Status` porte les quatre étapes françaises :
À faire → En cours → En revue → Terminé.

Lors d’une relance, le script réutilise `Avancement` s’il existe, sinon `Status`.
Il crée un champ `Avancement` seulement si les deux sont absents. Les options
des champs existants restent inchangées ; si `Status` n’a pas encore les quatre
étapes françaises, un avertissement demande de les finaliser dans GitHub.
Aucun second champ de suivi n’est créé pour remplacer `Status`.

La vue Board doit être groupée par le nom réel du champ retenu. Le script
conserve l’état des cartes existantes et ne prétend pas configurer les vues ni
les automatismes du tableau. Finaliser seulement les nouvelles cartes dans
GitHub. Le jeton doit autoriser les Projects. Les Projects, cartes et champs
sont lus par pages GraphQL de 100 éléments jusqu’à `pageInfo.hasNextPage=false`,
sans plafond global et sans déduire la fin d’un compteur `totalCount`.
Les cartes archivées sont incluses explicitement dans la lecture : elles
restent archivées et ne sont pas ajoutées de nouveau. Un avertissement donne
le lien de chaque issue attendue qui reste archivée et invite à restaurer sa
carte manuellement si elle doit revenir sur le tableau, uniquement si aucune
carte active de cette même issue n'est déjà présente. Les requêtes utilisées
ont été vérifiées en lecture seule sur le Project existant ; les tests simulent
les pages supplémentaires et les erreurs sans écrire sur GitHub.

## Vérification humaine restante

Les relances incluent les Projects fermés et refusent leur réouverture implicite.
Un Project public ou de visibilité inconnue est refusé avant modification.
Une erreur GraphQL, une page sans métadonnées de pagination, un curseur absent
ou répété et un nœud inaccessible interrompent le script avant modification
du Project existant. Une carte dont le contenu est masqué impose de vérifier
les permissions, afin de ne pas traiter une issue invisible comme absente.
Une carte supprimée peut aussi rendre son contenu illisible : le message donne
le Project à vérifier et la section à relancer après correction manuelle.
Le script ne supprime ni n’ignore automatiquement ces cartes.
Le mode `--section=project` vérifie les doublons sur l'ensemble des issues,
même sans lancer la section `issues`.

- Conserver le dépôt et le Project privés, vérifier le collaborateur et la branche `main`.
- Confirmer squash seul, suppression automatique et protection contre force push.
- Vérifier les six contrôles et l’approbation obligatoire de l’autre membre.
- Ouvrir une PR de test et vérifier qu’un échec de CI bloque la fusion.
- Vérifier l’analyse des secrets et la protection au push dans Settings selon les fonctions disponibles pour le dépôt privé.
- Finaliser la vue du Project et fermer seulement les tâches réellement terminées.

Documentation de référence : [rulesets REST](https://docs.github.com/en/rest/repos/rules),
[règles disponibles](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
[GitHub Projects CLI](https://cli.github.com/manual/gh_project),
[schéma GraphQL Projects](https://docs.github.com/en/graphql/reference/projects),
[pagination GraphQL](https://docs.github.com/en/graphql/guides/using-pagination-in-the-graphql-api).
