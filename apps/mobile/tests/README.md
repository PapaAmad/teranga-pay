# Tests mobiles

`navigation.test.tsx` vérifie un parcours réel : arrivée sur l’accueil, ouverture de la présentation puis retour. Une rupture de route ou un bouton débranché fait échouer le test.

`design-system.test.tsx` exerce les états des composants, leurs styles de cible minimale de 48 dp et le chargement des polices. Le passage du repli aux polices de marque doit conserver la navigation et la saisie. Le test d’accueil vérifie que les deux commandes appartiennent à un contenu défilable pouvant grandir ; Jest ne mesure pas le défilement ou le texte agrandi sur un appareil Android.

Les parcours T09 utilisent de vraies instances de traduction isolées, sans remplacement de `t`. `navigation.test.tsx` vérifie notamment le texte français interpolé dans la présentation du projet. `i18n.test.tsx` couvre le moteur, son repli français et la mise à jour des textes ; une fixture de catalogue n'est pas une traduction wolof validée. PAN maintient ces tests, Salam relit.

`translation-types.ts` est une vérification de compilation, sans exécution Jest. Ses cas négatifs échouent si une clé inconnue, un texte de repli masquant cette clé ou une feuille de catalogue non textuelle deviennent acceptés. Lancer `npm run typecheck` ; aucun de ces cas n'est ajouté au nombre de tests Jest.

Jest utilise `jest-expo` et les remplacements natifs fournis pour les zones de sécurité. Lancer depuis la racine `npm test --workspace @teranga-pay/mobile -- --ci`. Les tests de paiement et les parcours Maestro seront ajoutés aux tâches correspondantes.

T14 ajoute `onboarding-controller.test.ts` pour les transitions, interruptions et
courses asynchrones, `onboarding-platform.test.ts` pour la persistance validée et
la protection attendue, et `onboarding-screen.test.tsx` pour le parcours fictif
complet, les erreurs, Retour et l’agrandissement du texte. Les anciens tests
de l’accueil technique demandent désormais `initialRoute="Home"` explicitement.
Les jetons de test ne forment pas une phrase Bitcoin et les codes sont fictifs.
Les [captures Web](../../../docs/design/validation-t14/README.md) complètent ces tests
sans prouver le rendu ou les protections sur un Android physique.

T16 ajoute `home-model.test.ts` pour la validation des lectures, les événements,
les erreurs partielles, les données précédentes, les formats et les réponses
tardives ; `home-screen.test.tsx` couvre le masquage, les unités, les trois actions,
les réessais et les interruptions. Les anciens tests de navigation et de polices
visent désormais le titre de marque et l’accueil de lecture, sans faux wallet.
La [validation T16](../../../docs/design/validation-t16/README.md) distingue les
captures Web des essais Android encore attendus.
