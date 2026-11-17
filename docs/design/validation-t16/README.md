# Validation visuelle T16 | Accueil confirmé par PAN

Projet de Salam et PAN. PAN porte l’interface ; Salam relit le branchement du wallet.
**PAN a confirmé ces nouveaux écrans le 9 novembre 2026 avant commit et PR T16.**
Ouvrir la [galerie HTML](index.html) dans un navigateur, ou directement
[l’accueil proposé](02-accueil.png).

Les 16 captures du 9 novembre 2026 montrent les vrais composants React Native
rendus avec React Native Web dans Edge sans fenêtre visible. Elles couvrent
l’entrée sans wallet, l’aperçu nominal, les trois opérations, le masquage, le taux,
une modale, le vrai zéro, l’absence de taux, le mode hors connexion, une erreur,
l’actualisation et les largeurs 390, 360 et 320 pixels. Les
[mesures](mesures.json) ne relèvent aucun débordement horizontal ni erreur de console
pendant ce parcours. Les trois actions ont été ouvertes et leur limite vérifiée.

L’aperçu utilise uniquement des nombres et opérations fictifs en mémoire. Aucun
portefeuille, clé, facture ou paiement n’est créé. L’entrée normale indique que le
wallet n’est pas branché ; elle ne montre pas un faux solde nul. Les actions
Recevoir, Envoyer et Encaisser expliquent leur disponibilité future.

| Avant                                                           | Proposition actuelle                                                                     | Raison                                                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| L’ancien accueil présentait le socle technique.                 | Une estimation FCFA domine, suivie des sats, de trois actions nommées et des opérations. | Répondre à T16 et faciliter la lecture quotidienne.                                          |
| Une erreur du solde seule pouvait manquer de réessai.           | Le solde et l’historique gardent chacun un réessai adapté.                               | Permettre de récupérer une ressource sans annoncer que l’autre a échoué.                     |
| Une entrée initiale en arrière-plan pouvait lancer une lecture. | L’écran suspend les lectures et masque les montants dès cette entrée.                    | Éviter d’exposer des données avant le retour actif.                                          |
| Une valeur extrême pouvait dépasser 320 pixels.                 | Le nombre complet revient à la ligne entre les groupes de milliers.                      | Garder tous les chiffres, ainsi qu’un libellé accessible complet, sans points de suspension. |

La capture du très grand montant est un test de format, sans signification
financière. La valeur `4 053 239 664 633 445 FCFA` reste complète sur deux lignes
à 320 pixels. Les nombres masqués sont retirés du texte visible et des libellés
accessibles, y compris dans les opérations.

Commande utile : `npm run mobile:web -- --offline --port 8092`, puis ouvrir
`http://localhost:8092`. Depuis l’onboarding, choisir « Découvrir le projet », puis
« Essayer l’accueil fictif ». Les commandes en bas de l’atelier donnent accès aux
sept scénarios. « Voir l’accueil du portefeuille » montre l’entrée sans wallet.

Jest vérifie les erreurs partielles, le cycle de vie, les données invalides,
le masquage, les états et les actions, dont une largeur de 320 avec texte agrandi.
Cette vérification ne mesure pas le rendu des polices Android. Le rendu sur
appareil, TalkBack et les événements d’un wallet natif restent à vérifier avec
Salam. Les images ne constituent pas une compilation Android ni une preuve de
paiement. Consulter la [recherche](../accueil-recherche.md), la
[direction](../accueil-direction.md) et le [suivi T16](../../planning/suivi-t16.md)
pour les choix, les résultats des contrôles et les limites d’intégration.

Contrôles locaux : 196 tests mobiles réussis ; 112 tests des outils réussis et un
cas ignoré sous Windows. Format, ESLint, TypeScript et cohérence du dépôt passent.
L’export JavaScript Android de diagnostic sans bytecode réussit ; il ne constitue
pas une compilation APK et ne valide pas le compilateur Hermes bloqué sous Windows.
