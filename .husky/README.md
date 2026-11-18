# Hooks Git

`pre-commit` formate et vérifie les fichiers indexés avec lint-staged. `commit-msg` vérifie Conventional Commits et la limite de 72 caractères. `npm ci` les installe via Husky après l'initialisation Git.

Le dossier `_`, généré par Husky, est ignoré. Les contrôles complets restent exécutés par GitHub Actions ; les hooks facilitent le travail local.

Les deux scripts sont enregistrés comme exécutables dans Git (mode `100755`) par cohérence. Avec Husky 9, ce mode n'est pas indispensable : Git appelle les petits scripts générés dans `.husky/_`, qui lancent `.husky/pre-commit` et `.husky/commit-msg` avec `sh`. Si Git affiche « hook was ignored because it's not set as executable » ou si les hooks ne se lancent pas, vérifier que `git config core.hooksPath` affiche `.husky/_`, puis réinstaller les hooks avec `npm run prepare`.
