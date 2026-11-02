# 0001 — Organiser le dépôt pour les deux membres

- Date : 2 novembre 2026, Dakar.
- Tâches : T01–T07.
- Auteur : PAN, assisté de Codex.
- État : organisation livrée par la PR #36 pour initialiser main. Voir les décisions 0002 et 0003 ainsi que le relevé de publication.

## Contexte

Le dossier initial contenait les deux PDF de référence. PAN doit préparer le dépôt et initialiser l'application Expo. Salam commencera le SDK Lightning et ajoutera ensuite le réseau de démo et le serveur. L'organisation doit permettre ce partage sans inventer les contrats ou déclarer les services terminés.

## Choix

Adopter un monorepo npm avec `apps/mobile` pour Expo, `services/*` pour les services futurs et `packages/contracts` pour le futur contrat commun. Partager les outils TypeScript, ESLint et Prettier à la racine ; conserver un seul verrouillage npm. Les dossiers réservés n'ont pas de `package.json` avant leur implémentation.

Utiliser Node.js 24, npm 12 et Expo SDK 57 pour le socle. React Navigation porte la navigation explicite : les README demandés dans les dossiers de l'application ne deviennent pas des routes, comme ils pourraient le devenir avec une convention de routage par fichiers mal délimitée. Le test de navigation vérifie les destinations réellement proposées.

Les workspaces npm suffisent pour cette équipe et ce nombre de packages. Aucun orchestrateur Nx ou Turborepo n'est ajouté ; un tel outil devra répondre ultérieurement à un besoin constaté et expliqué dans une nouvelle note.

Regrouper les fichiers opérationnels GitHub dans `.github`, les automatisations dans `scripts` et le réseau de démonstration dans `infrastructure`. Préparer `tests/e2e` pour les tests mobile et `assets` pour les visuels. Chaque dossier versionné explique son usage dans un README.

Réorganiser `docs` en sources, guides, architecture, décisions et planning. Conserver les PDF d'origine dans `docs/sources`, sans changer leur contenu. Les résumés Markdown décrivent le travail courant ; ils ne remplacent pas les sources.

## Solutions écartées

- Dépôts séparés dès le départ : davantage de synchronisation pour deux personnes et un contrat à définir ensemble.
- Génération immédiate de tous les services : elle dépasserait T07 et figerait les choix de Salam avant T10/T13.
- Simple arborescence vide : elle ne fournirait ni application initialisée ni commandes de qualité vérifiables.

## Conséquences

Les commandes npm partagées s'exécutent à la racine. Ajouter un service signifie l'implémenter, ajouter sa configuration de package, ses vérifications et son README, puis le relier aux commandes communes. La présence de son répertoire n'a aucun effet d'exécution.

Le choix du SDK, le contrat wallet et le framework API restent ouverts. Aucun Docker Compose de paiement ou retrait n'est annoncé disponible avant T12/T23. Les paramètres GitHub doivent être appliqués et vérifiés séparément ; les fichiers locaux ne valent pas activation des protections distantes.

La [décision 0002](0002-visibilite-privee.md) précise désormais la visibilité privée du dépôt et du Project. L'[état des opérations GitHub](../planning/publication-github.md) complète cette note d'organisation.
