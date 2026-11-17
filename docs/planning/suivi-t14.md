# Suivi T14 | Onboarding

PAN réalise les écrans ; Salam relit et porte le wallet T15. L’issue est
[#9](https://github.com/PapaAmad/teranga-pay/issues/9).
État au 9 novembre 2026 : **écrans confirmés par PAN avant commit et PR**,
conformément à sa demande. La branche `feat/T14-onboarding` part
du commit T09 `f78051f`, avec les fondations T08 et T09 encore en revue au démarrage.

## Préparé localement

Accueil illustré, choix du français et persistance, préparation, PIN à six chiffres
avec confirmation, copie numérotée et quiz des positions 2, 6 et 10, fin du parcours,
erreurs, refus de protection et interruption. Le wolof reste indisponible avant T33.
Les textes utilisent T09 et les icônes restent celles créées pour T08.

La [recherche](../design/onboarding-recherche.md) expose les faits et leurs limites.
La [direction artistique](../design/onboarding-direction.md) adapte la composition
des quatre références Revolut locales. Le
[visuel original généré](../../assets/brand/illustrations/README.md) remplace
l’esquisse de surfaces SVG. Les [captures des composants réels](../design/validation-t14/README.md)
ont été présentées à PAN pour sa confirmation ; elles ne constituent pas un test avec les publics concernés.

Le contrôleur n’implémente ni génération de clés ni cryptographie. Il attend un
port compatible avec T11, refuse les réponses périmées et sérialise les mutations
du wallet. Les préférences contiennent seulement langue et progression. Deux
courses relevées en autorevue ont reçu des tests de régression : interruption
avant création et nettoyage tardif d’un ancien déverrouillage.

La migration Expo 58 de PAN est conservée. Les outils de test, React DOM et le
lockfile ont été alignés ; la cible Web sert à prévisualiser les composants natifs.
Les nouvelles dépendances propres à T14 sont AsyncStorage 2.2.0 pour les préférences,
Screen Capture 58.0.6 pour attendre la protection, et trois outils de prévisualisation
Web. Leur justification figure dans l’[ADR 0012](../decisions/0012-onboarding-protection-et-integration.md).

## Limites avant intégration

L’entrée normale permet accueil, langue et préparation puis annonce l’absence
de wallet **avant le PIN**. L’aperçu de développement est explicite, en mémoire,
avec des jetons `exemple01` à `exemple12`, sans aucune clé ni paiement.

T11/T15, aux commits consultés, ne permettent pas encore de reprendre l’affichage
des mots après interruption. Le branchement réel attend une reprise authentifiée,
un état natif de sauvegarde et des essais Android avec Salam. Aucun coffre existant
n’est effacé pour contourner cette limite. La restauration n’a pas d’UI livrée ici.

Les contrôles locaux sont détaillés avec les [preuves de rendu](../design/validation-t14/README.md).
La validation visuelle de PAN est obtenue. La relecture humaine de Salam, les essais
sur appareil et la CI du commit publié restent à obtenir. La publication sera
vérifiée séparément ; aucun APK installé ni test de paiement n’est déduit de ce travail.

Commandes utiles : `npm run mobile`, `npm run mobile:web -- --offline --port 8092`,
`npm test -- --ci` et `npm run repo:check`.
