# Identité visuelle | proposition T08

Projet de Salam et PAN. Après leur échange du 5 novembre 2026, PAN confirme le choix commun de la direction B « Le courant commun » et de son monogramme entre T et P. La réalisation reste à relire ; aucun test utilisateur ni approbation de PR n'est déduit de ce choix artistique.

Commencer par la [planche HTML](exploration.html), le [PDF de neuf pages](exports/charte.pdf) ou la [comparaison PNG](exports/planche.png). Le [dossier de recherche](../../docs/design/README.md) relie les choix au brief, aux sources et à leurs limites.

| Ressource                                | Contenu                                         |
| ---------------------------------------- | ----------------------------------------------- |
| [Logos](logos/README.md)                 | Six variantes SVG et trois signes exploratoires |
| [Icônes](icons/README.md)                | 16 dessins originaux et tracés partagés         |
| [Polices](fonts/README.md)               | Sous-ensembles latins, licences et provenance   |
| [Tokens](tokens.json)                    | Palette, espacements et échelle typographique   |
| [Contrastes](contrast.json)              | Mesures sRGB des couples documentés             |
| [Exports](exports/README.md)             | PNG de présentation et PDF                      |
| [Illustrations](illustrations/README.md) | Visuel original de l’accueil T14 et provenance  |

Les composants natifs et leur galerie sont dans [apps/mobile/src/ui](../../apps/mobile/src/ui/README.md). Les maquettes financières restent fictives : regtest uniquement, retraits Wave/Orange Money simulés. Aucune bibliothèque d'icônes génériques. Commandes utiles : `npm run test:tooling` et `npm run repo:check`.

La [motion de marque](motion/README.md) fournit une introduction vidéo et sa source HTML modifiable. Le monogramme se trace sur place ; cette séquence sert à la communication et au pitch, sans allonger le démarrage mobile.

Les icônes et le rapport de contraste se régénèrent avec `npm run brand:build`. Les présentations et vidéos disposent de scripts de rendu documentés dans [scripts](../../scripts/README.md). La motion comporte des [versions horizontale et verticale](motion/README.md), toutes deux tracées sur place.
