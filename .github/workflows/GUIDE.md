# Contrôles automatiques

`ci.yml` vérifie le format, le lint, TypeScript, les tests et les secrets.
`pr-title.yml` vérifie le titre des PR sans installation des dépendances npm.
Les six noms de contrôles sur les PR sont ceux attendus par `main-ruleset.json`.
Les PR de forks tournent sous `pull_request`, avec un jeton en lecture seule.
Un changement de branche cible relance la qualité et les secrets sur la nouvelle
fusion de test. Une modification du titre ou de la description exécute seulement
`Titre PR` ; les deux jobs CI ignorés portent des noms distincts des contrôles
obligatoires, et leur groupe de concurrence est séparé. Ils ne peuvent donc ni
annuler la qualité en cours, ni remplacer un contrôle échoué par un résultat
ignoré. Le titre est toujours revérifié, même après une simple modification de
description, pour ne pas masquer un échec.

La matrice qualité partage la configuration des quatre contrôles. Chaque job
garde son runner et son installation `npm ci` ; le cache npm réduit les
téléchargements, sans partager des `node_modules` entre jobs.

Dependabot regroupe les versions npm dans `npm` et les correctifs de sécurité
dans `npmsec` ; les groupes des actions GitHub sont `ci` et `cisec`. Chaque type
de mise à jour possède son groupe, avec un identifiant court utilisé dans les
[titres automatiques](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#groups).
Cela réduit la longueur des titres des lots, sans garantir celle des mises à
jour d'une seule dépendance : Dependabot peut encore inclure son nom et ses
versions dans le titre. La limite de 72 caractères s'applique à tous. Si un titre
reste trop long, le raccourcir dans la PR avant la fusion, par exemple
`chore(deps): met à jour native-stack`. Seul le contrôle du titre sera exécuté.

Le déclencheur `workflow_dispatch` permet aussi un lancement manuel depuis
Actions, avec **Run workflow**, ou via l'API. GitHub exige que le fichier soit
présent sur la branche par défaut pour ce déclenchement. Voir la
[documentation officielle](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

Le test Lightning Docker viendra avec T29 ; aucun faux test de paiement n'est
présent dans ce socle. Les résultats et les éventuels refus de démarrage sont
consignés dans le [relevé de publication](../../docs/planning/publication-github.md).
