# Contribuer à Teranga Pay

Salam (`@AliouneKane`) et PAN (`@PapaAmad`) se relisent mutuellement. Les responsabilités et les échéances viennent du [plan d'équipe](docs/sources/Teranga_Pay_Plan_equipe_et_regles.pdf).

Le dépôt est privé par décision de PAN ; le Project doit également l'être dès sa création. Salam a accepté l'invitation et son accès en écriture est confirmé. La [décision 0002](docs/decisions/0002-visibilite-privee.md) remplace la visibilité publique prévue dans le plan ; elle conserve le fichier de licence MIT.

Les rulesets ne sont pas disponibles pour ce dépôt privé avec l'offre actuelle : la règle d'équipe impose néanmoins une PR verte, une relecture humaine et une fusion squash. Ne pas confondre cet engagement avec un blocage technique actif sur `main`.

1. Choisir une issue du backlog, confirmer son périmètre et son responsable.
2. Partir de `main` à jour et créer `feat/T18-ecran-recevoir`, `ci/T07-github-actions` ou une branche équivalente.
3. Installer avec `npm ci`, travailler par petits changements, mettre à jour les README concernés.
4. Vérifier `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test -- --ci`, `npm run test:tooling` et `npm run repo:check`.
5. Ouvrir une PR, remplir « En clair », détailler les vérifications, joindre une capture pour l'interface et indiquer `Closes #N`.
6. Attendre la CI et l'approbation de l'autre membre, résoudre les conversations, puis fusionner en squash.

Les commits et titres de PR suivent `type(zone): description` en moins de 73 caractères. Exemples : `feat(mobile): ajoute le parcours recevoir`, `docs(architecture): précise les limites du socle`. Une PR vise moins de 400 lignes ; le premier socle devra être relu par ensembles T01 à T07 avant publication.

Les dépendances ajoutées doivent être justifiées dans la PR. Ne pas copier de secret ni de donnée personnelle dans une issue, une capture ou une conversation avec un agent. Pour une vulnérabilité, suivre [SECURITY.md](SECURITY.md).

Le [guide du dépôt distant](docs/guides/depot-distant.md) est la procédure de référence. Les [scripts GitHub](scripts/github/README.md) détaillent les commandes et le [relevé de publication](docs/planning/publication-github.md) distingue les opérations vérifiées des travaux en cours. Le catalogue local ne prouve pas que toutes les issues sont créées ou ajoutées au Project.
