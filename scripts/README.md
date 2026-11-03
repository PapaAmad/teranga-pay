# Scripts du dépôt

`check-repository.mjs` vérifie la documentation de chaque dossier maintenu et les liens relatifs Markdown, hors exemples de code et commentaires HTML. `markdown-it` interprète le Markdown, notamment les références et images ; aucun HTML n'est rendu ou exécuté. Cette dépendance est réservée au développement, selon la [décision 0005](../docs/decisions/0005-parseur-markdown.md).

Les exclusions Git sont respectées ; hors dépôt Git, les exclusions prédéfinies sont signalées. Les chemins sont comparés en NFC, sans remplacer leurs noms physiques. Les README qui sont des liens symboliques vers des fichiers sont acceptés, sans traverser les liens de dossiers ni les gitlinks de sous-modules.

L'arbre réservé `.github` utilise `GUIDE.md`, sauf `ISSUE_TEMPLATE` qui utilise `GUIDE.txt`. Le script refuse les README documentaires dans cet arbre, afin de préserver l'accueil du projet et le sélecteur de modèles ; un workflow `readme.yml` reste autorisé. Lancer `npm run repo:check` depuis la racine ; `npm run test:tooling` exécute aussi ses tests de non-régression.

`github/` contient la préparation du dépôt distant, ses réglages, labels et issues. Ces outils restent en prévisualisation tant qu'une application explicite n'est pas demandée.
