# Design | Teranga Pay

Ce dossier réunit les recherches et règles de l'identité T08 du projet de Salam et PAN. PAN crée, Salam relit. La direction B, « Le courant commun », est retenue artistiquement selon le choix communiqué par PAN le 5 novembre 2026 après discussion avec Salam. La relecture de la PR et les tests utilisateurs restent distincts de ce choix.

| Document                    | Utilité                                                                      |
| --------------------------- | ---------------------------------------------------------------------------- |
| [Brief](brief.md)           | Produit, publics, contraintes issues des PDF et limites de T08.              |
| [Recherche](recherche.md)   | Résultats scientifiques, implications possibles et règles d'accessibilité.   |
| [Benchmark](benchmark.md)   | Observation de marques et produits voisins, avec sources et limites.         |
| [Charte](charte.md)         | Directions comparées, logo, palette, typographie et principes de composants. |
| [Validation](validation.md) | Mesures, vérifications effectuées et essais humains restant à conduire.      |

Les fichiers graphiques vivent dans [assets/brand](../../assets/brand/README.md), les composants mobiles dans `apps/mobile`.

T14 prolonge ces fondations avec la [recherche sur l’onboarding](onboarding-recherche.md),
la [direction artistique et le parcours](onboarding-direction.md) et les
[captures du parcours](validation-t14/README.md). PAN a confirmé les écrans T14 le
9 novembre 2026 avant commit et PR ; cette validation visuelle ne remplace pas la
relecture du code par Salam ni les essais sur appareil.

T16 prépare l’accueil du wallet : [recherche](accueil-recherche.md),
[direction et états](accueil-direction.md), [captures confirmées par PAN](validation-t16/README.md)
et [suivi](../planning/suivi-t16.md). Les écrans T16 ont été confirmés le 9 novembre
2026 ; la relecture de Salam reste distincte.

T18 prépare Recevoir : [recherche](recevoir-recherche.md),
[direction](recevoir-direction.md), [captures confirmées par PAN](validation-t18/README.md)
et [suivi](../planning/suivi-t18.md). PAN a confirmé les écrans T18 le 9 novembre
2026 avant commit et PR ; aucune réception réelle n’est déduite de l’aperçu.

Depuis la racine : `npm run repo:check` vérifie les guides et les liens ; `npm run format:check` vérifie le format. Consulter la validation pour les preuves visuelles et leurs limites.
