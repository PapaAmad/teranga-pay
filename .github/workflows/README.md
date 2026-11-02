# Contrôles automatiques

`ci.yml` vérifie le format, le lint, TypeScript, les tests, le titre de PR et les
secrets. Les six noms de jobs sont ceux attendus par `main-ruleset.json`.
Les PR de forks tournent sous `pull_request`, avec un jeton en lecture seule.
Une modification du titre relance aussi les contrôles.

Le test Lightning Docker viendra avec T29 ; aucun faux test de paiement n'est
présent dans ce socle. Le premier lancement GitHub reste à vérifier après push.
