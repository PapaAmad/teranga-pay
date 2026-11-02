# Contrôles automatiques

`ci.yml` vérifie le format, le lint, TypeScript, les tests, le titre de PR et les
secrets. Les six noms de jobs sont ceux attendus par `main-ruleset.json`.
Les PR de forks tournent sous `pull_request`, avec un jeton en lecture seule.
Une modification du titre relance aussi les contrôles.

Le déclencheur `workflow_dispatch` permet aussi un lancement manuel depuis
Actions, avec **Run workflow**, ou via l'API. GitHub exige que le fichier soit
présent sur la branche par défaut pour ce déclenchement. Voir la
[documentation officielle](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

Le test Lightning Docker viendra avec T29 ; aucun faux test de paiement n'est
présent dans ce socle. Les résultats et les éventuels refus de démarrage sont
consignés dans le [relevé de publication](../../docs/planning/publication-github.md).
