# Exports de présentation | T08

`planche.png` présente les trois directions, `charte.pdf` conserve le dossier illustré et `icones.png` permet d'examiner les dessins à plusieurs tailles. Ces exports viennent de `../exploration.html` et des SVG ; les sources restent éditables dans le dépôt.

La présentation montre une proposition, avec données fictives et paiements simulés. Elle ne prouve pas l'exécution sur Android ni une validation par des utilisateurs. Ouvrir `../exploration.html` localement pour l'exploration complète. PAN produit, Salam relit ; `npm run repo:check` vérifie l'organisation.

Les exports peuvent être régénérés avec `npm run brand:document -- --help`, puis les chemins d’un navigateur Chromium et du module Puppeteer. Le fichier `validation.json` conserve le SHA-256 du HTML source et les vérifications de composition et de largeur : il permet d’identifier la source réellement rendue. Les outils restent externes au mobile ; voir les [commandes de rendu](../../../scripts/README.md).
