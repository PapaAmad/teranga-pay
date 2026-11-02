# Hooks Git

`pre-commit` formate et vérifie les fichiers indexés avec lint-staged. `commit-msg` vérifie Conventional Commits et la limite de 72 caractères. `npm ci` les installe via Husky après l'initialisation Git.

Le dossier `_`, généré par Husky, est ignoré. Les contrôles complets restent exécutés par GitHub Actions ; les hooks facilitent le travail local.
