# Contrôles automatiques

`ci.yml` vérifie le format, le lint, TypeScript, les tests et les secrets.
`pr-title.yml` vérifie le titre des PR sans installation des dépendances npm.
Les six noms de contrôles sur les PR sont ceux attendus par `main-ruleset.json`.
Les PR de forks tournent sous `pull_request`, avec un jeton en lecture seule.
Une modification du titre ou de la description relance uniquement `Titre PR` ;
elle n'annule pas la CI de qualité en cours. Le titre est toujours revérifié,
même après une simple modification de description, pour ne pas masquer un échec.

La matrice qualité partage la configuration des quatre contrôles. Chaque job
garde son runner et son installation `npm ci` ; le cache npm réduit les
téléchargements, sans partager des `node_modules` entre jobs.

Les titres Dependabot suivent aussi la limite de 72 caractères. Si un titre
automatique est trop long, le raccourcir dans la PR avant la fusion, par exemple
`chore(deps): met à jour native-stack`. Seul le contrôle du titre sera relancé.

Le déclencheur `workflow_dispatch` permet aussi un lancement manuel depuis
Actions, avec **Run workflow**, ou via l'API. GitHub exige que le fichier soit
présent sur la branche par défaut pour ce déclenchement. Voir la
[documentation officielle](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

Le test Lightning Docker viendra avec T29 ; aucun faux test de paiement n'est
présent dans ce socle. Les résultats et les éventuels refus de démarrage sont
consignés dans le [relevé de publication](../../docs/planning/publication-github.md).
