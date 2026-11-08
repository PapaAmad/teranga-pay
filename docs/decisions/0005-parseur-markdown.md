# 0005 | Utiliser un parseur Markdown pour les contrôles du dépôt

- Date : 3 novembre 2026, Dakar.
- Tâche : T07, seconde revue de la PR #38.
- État : correctif proposé à la relecture de Salam.

## Problème

Le parseur local de liens utilisait des expressions régulières. Un backtick isolé pouvait supprimer un lien cassé dans un autre paragraphe. La gestion des références, des commentaires HTML et des images aurait ajouté d'autres règles de syntaxe difficiles à maintenir.

## Choix

Ajouter `markdown-it` **15.0.3**, sous licence MIT, comme dépendance de développement avec version exacte et lockfile. Le contrôle utilise uniquement les tokens produits par `parse`, sans rendu HTML ni exécution de contenu. Les tokens de commentaires et de code ne sont pas interprétés comme des liens ; les liens de référence et les images écrits en syntaxe Markdown sont résolus par le parseur.

Cette dépendance appartient aux outils du dépôt : elle n'est importée ni par l'application mobile ni par un service. Elle remplace le parseur maison plutôt que d'y ajouter de nouvelles exceptions.

## Alternatives et vérifications

- Conserver les expressions régulières aurait laissé à l'équipe la maintenance d'une partie de la syntaxe Markdown.
- Les parseurs fondés sur un arbre syntaxique restent possibles ; le flux de tokens de markdown-it suffit aux liens et images recherchés.
- Les tests vérifient les liens cassés après un backtick isolé, les références, les commentaires, les images et les exemples de code. Les extensions Markdown classiques sont analysées sans tenir compte de la casse.
- Le contrôle vérifie les chemins relatifs écrits en Markdown ; il ne vérifie pas les attributs du HTML brut (`<a href>`, `<img src>`), ne télécharge pas les destinations externes et n'analyse pas les composants MDX ou CoffeeScript. Écrire les liens à contrôler en syntaxe Markdown ; ajouter un parseur HTML relèverait d'un choix ultérieur documenté.

Référence : [architecture et tokens du projet markdown-it](https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md).
