# Collaborer sur Teranga Pay

Le [plan d'équipe](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf) fixe les responsabilités. PAN est Papa Amadou Niang, compte GitHub `PapaAmad`. Salam est Alioune Abdou Salam Kane, compte GitHub `AliouneKane`.

Le dépôt est privé et le tableau Projects doit l'être dès sa création par décision de PAN ; voir la [note 0002](../decisions/0002-visibilite-privee.md). Le [guide du dépôt distant](depot-distant.md) décrit la procédure actuelle et le [relevé GitHub](../planning/publication-github.md) en conserve les résultats vérifiés. Salam a accepté l'invitation et dispose d'un accès en écriture. Les rulesets indisponibles sur l'offre actuelle n'appliquent pas de blocage technique ; les règles de PR et de relecture restent les engagements de l'équipe.

| Domaine                                                      | Responsable  | Relecture          |
| ------------------------------------------------------------ | ------------ | ------------------ |
| Dépôt, configuration GitHub, CI, hooks, interface et visuels | PAN          | Salam              |
| Wallet, clés, SDK Lightning, réseau regtest, API, sécurité   | Salam        | PAN                |
| Passerelle simulée et parcours e2e                           | PAN          | Salam              |
| Contrat entre écrans et logique (T11)                        | PAN et Salam | Validation commune |
| README final, APK, pitch et soumission                       | Salam        | PAN                |

## Une tâche jusqu'à sa fusion

1. Choisir une issue Txx et vérifier ses critères d'acceptation.
2. Créer une branche depuis `main` à jour, par exemple `chore/T06-initialisation-expo` ou `ci/T07-github-actions`.
3. Garder des commits ciblés et relire le diff, y compris le code proposé par un agent.
4. Lancer `npm run format:check`, `npm run lint`, `npm run typecheck` et `npm test`.
5. Ouvrir une PR avec le modèle ; la partie « En clair » explique le résultat en trois à cinq phrases. Ajouter des captures pour les changements visibles.
6. Lier l'issue réelle avec `Closes #N`, obtenir la CI verte et l'approbation de l'autre membre, résoudre les conversations, puis fusionner par squash.

`T06` est l'identifiant du plan ; il n'est pas nécessairement le numéro GitHub de l'issue. Vérifier le numéro généré avant d'écrire `Closes #N`.

Le titre de PR et les commits suivent `type(zone): description`, par exemple `chore(mobile): initialise la navigation Expo`. Garder les descriptions courtes et les PR centrées sur une tâche. Ouvrir une PR en brouillon tant que le travail n'est pas prêt à être relu.

## Relecture et agents

PAN travaille avec Codex ; Salam avec Claude Code. Les règles communes sont dans [AGENTS.md](../../AGENTS.md) et importées par [CLAUDE.md](../../CLAUDE.md). Une revue par l'autre agent aide à détecter les erreurs ; l'approbation humaine de l'autre membre reste nécessaire.

Ne pas pousser directement sur `main`, ni déclarer une tâche terminée parce que ses fichiers existent. Un service doit être exécuté et testé ; un réglage distant doit être appliqué et vérifié. Le [suivi T01 à T07](../planning/suivi-t01-t07.md) distingue les deux.

Chaque auteur explique les dépendances ajoutées, tient la documentation à jour et utilise uniquement des données fictives. Les clés du wallet restent dans le téléphone dans l'architecture cible. Toute éventuelle démo avec LND côté serveur devra être décrite honnêtement après une décision commune en T10.

## Coordination

- Point écrit quotidien à 21 h, heure de Dakar : réalisé, prochaine étape, blocage.
- Points vocaux le mardi et le vendredi ; revue de sprint le dimanche soir.
- Signaler un blocage après deux heures et préciser ce qui a été essayé.
- Prévenir l'autre avant de modifier une interface partagée ; formaliser les types et fonctions en T11.

L'exception d'urgence de la section 5.6 du plan reste exceptionnelle : elle est documentée dans la PR et suivie d'une revue humaine. Aucun script de préparation n'applique automatiquement cette exception.
