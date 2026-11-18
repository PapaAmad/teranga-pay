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

T20 prépare Envoyer : [recherche](envoyer-recherche.md),
[direction et parcours](envoyer-direction.md), [décision](../decisions/0015-envoyer-confirmation-et-session.md)
et [captures confirmées par PAN](validation-t20/README.md), avec le [suivi](../planning/suivi-t20.md).
PAN a confirmé les nouveaux écrans le 10 novembre 2026 avant commit et PR et
autorisé la publication. La relecture de Salam et la CI distante restent attendues ;
le branchement natif et les essais sur Android restent distincts de l’atelier fictif.

T22 prépare Encaisser : [recherche](encaisser-recherche.md),
[direction et états](encaisser-direction.md), [décision](../decisions/0016-encaisser-demande-et-recu.md)
[24 captures inspectées](validation-t22/README.md) et [suivi](../planning/suivi-t22.md).
La galerie ne présente aucun débordement ni erreur console détectés et son QR est
décodé depuis le bitmap rendu à trois largeurs. PAN a confirmé les nouveaux écrans
le 10 novembre 2026 avant commit et PR et autorisé leur publication, en préparation.
La relecture de Salam et la CI distante restent attendues ; le contrat de
corrélation avec le règlement et les essais natifs restent à composer avec Salam.

T24 prépare Historique : [recherche](historique-recherche.md),
[direction et états](historique-direction.md), [décision](../decisions/0018-historique-et-totaux.md)
et [suivi](../planning/suivi-t24.md). Le cumul distingue la date d’opération,
les FCFA inconnus, les pages restantes et les retraits simulés. PAN a confirmé les nouveaux écrans le 11 novembre 2026 avant commit et PR. Les
[25 captures](validation-t24/README.md) et le suivi documentent les preuves Web ;
les essais Android et la relecture de Salam restent distincts.

T25 prépare Retirer en cash : [recherche](retirer-recherche.md),
[direction et états](retirer-direction.md) et [suivi](../planning/suivi-t25.md).
Le parcours prévoit opérateur, montant FCFA, devis avec frais fictifs et
confirmation explicite, puis reprise de la même demande en cas d’incertitude.
PAN a confirmé les écrans le 12 novembre 2026 avant commit et PR. Les
[27 captures](validation-t25/README.md) et le suivi décrivent les contrôles
exécutés ; la composition native et la relecture de Salam restent distinctes.

Depuis la racine : `npm run repo:check` vérifie les guides et les liens ; `npm run format:check` vérifie le format. Consulter la validation pour les preuves visuelles et leurs limites.
