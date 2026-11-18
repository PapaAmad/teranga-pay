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

T18 ajoute `receive-model.test.ts` pour l’adresse, les événements et les lectures
obsolètes ; `receive-qr.test.ts` décode indépendamment la matrice QR et vérifie sa
marge ; `receive-platform.test.ts` traite les résultats et refus des API natives
et Web ; `receive-screen.test.tsx` couvre copie, partage, confidentialité, grand
texte et anciens callbacks après verrouillage. `navigation.test.tsx` vérifie le
trajet depuis Recevoir et la séparation de l’aperçu. Les destinations sont toutes
fictives. Consulter la [validation T18](../../../docs/design/validation-t18/README.md).

T20 ajoute `send-model.test.ts` pour la préparation liée au devis, le plafond de
frais, l’expiration, les réponses tardives et la barrière de soumission partagée
par wallet. Les cas de double appui, deux contrôleurs et remontage après résultat
incertain doivent rester sûrs sans stocker de PIN. `send-platform.test.ts` vérifie
la lecture volontaire du presse-papiers et ses erreurs, sans modifier le texte.

`send-form-frame.test.tsx` vérifie le cadre du formulaire, les marges du clavier
et le scanner réel avec primitives caméra remplacées : autorisation à la demande,
refus, erreur, interruption et première détection unique. `send-screen.test.tsx`
exerce le parcours avec les traductions réelles et un scanner remplacé pour
isoler l’orchestration : collage tardif, montant invalide corrigible, frais FCFA
inconnus, PIN effacé et jamais soumis au sixième chiffre, attente et timeout sans
fausse confirmation. Le grand texte garde Scanner et Coller lisibles et utilisables.

Les parcours de navigation T20 vérifient l’injection du fournisseur normal, la
séparation de l’atelier et la conservation de l’incertitude après retour à
l’accueil puis réouverture. Tous les résultats de paiement sont contrôlés et
fictifs. Le socle jusqu’à T20 a été vérifié le 10 novembre 2026 avec **487 tests
réussis dans seize suites**. Cette preuve locale ne valide ni permission système réelle,
ni scan physique, TalkBack, clavier Android ou paiement regtest. Le
[suivi T20](../../../docs/planning/suivi-t20.md) conserve les preuves et les limites.

T22 ajoute `collect-model.test.ts` pour la préparation sans création implicite,
la correspondance stricte devis/facture/paiement, les échéances, les courses et la
barrière de session. Les 68 cas ciblés couvrent aussi les vingt archives sans
éviction silencieuse, les anciennes demandes et la confirmation observée après
le délai. Le reçu conserve le prix demandé au devis et `confirmedAt` ; les tests
ne renomment pas `Payment.createdAt` en heure de règlement.

Les 61 tests QR et plateforme de `collect-qr.test.tsx` et
`collect-platform.test.ts` vérifient matrice, marge de quatre modules, charge
exacte, densité, facture longue, copie et refus des API. Une variante de 2 048
caractères peut requérir le repli du rendu sans perdre ses alternatives de copie
et de partage. Le décodage indépendant n’équivaut pas à un scan physique.

Les 24 tests de `collect-screen.test.tsx` utilisent le vrai contrôleur, les
ressources T09 et des services fictifs. Ils vérifient erreurs de montant,
création explicite, QR fidèle, copier/partager, callbacks périmés, expiration,
perte de focus, reprise, reçu fictif et confirmation d’une ancienne vente sans
valider la nouvelle. Quatre parcours T22 dans `navigation.test.tsx` couvrent
l’injection normale, l’atelier séparé, le fournisseur absent et le retour vers
la même facture sans recréation. Le helper attend la valeur contrôlée et le
bouton activé avant son unique appui, avec les événements asynchrones de RNTL.
La suite de navigation complète passe avec treize tests. L’exécution mobile
complète du 10 novembre 2026 passe avec **644 tests dans vingt suites**. Lire le
[suivi T22](../../../docs/planning/suivi-t22.md) pour les preuves et les essais
Android restant à conduire.

La [validation visuelle T22](../../../docs/design/validation-t22/README.md)
consigne 24 captures sans débordement ni erreur console détectés. Le vrai SVG
rendu est décodé depuis son bitmap aux largeurs 390, 360 et 320 pixels : demande
complète de 326 octets, version 13, modules de trois pixels et marge de quatre
modules. Les copies nominale et de 2 048 octets sont relues dans le navigateur ;
le partage et le reçu sont interceptés en mémoire sans envoi externe. La fenêtre
360 × 460 vérifie un espace réduit, pas un clavier Android.
