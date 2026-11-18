# Recevoir | T18

PAN porte cet écran ; Salam porte le wallet et l’adresse Lightning T19. PAN a confirmé les écrans le 9 novembre 2026 avant commit et PR ; la relecture de Salam reste attendue.

- `ports.ts` reprend seulement l’état et l’abonnement T11. Le fournisseur distinct `address.current()` retourne l’adresse publique, jamais le jeton T19, une clé ou un PIN.
- `controller.ts` valide l’adresse externe, distingue intégration absente et erreur, regroupe les notifications d’état et écarte les réponses périmées. Le passage en arrière-plan, le verrouillage, l’absence du wallet et la destruction effacent l’adresse du snapshot. Le retour relit les ports.
- `preview.ts` fournit cinq états explicitement fictifs, sans réseau : prêt, lecture contrôlée, hors ligne, erreur et adresse longue. Toutes les adresses utilisent `.example`.
- `ReceiveScreen.tsx` présente le QR, l’adresse complète et les actions, leurs erreurs et leurs confirmations. Un callback vérifie encore le snapshot avant toute copie ou tout partage ; une relecture ou une interruption invalide les confirmations précédentes.
- `qr.ts` et `ReceiveQr.tsx` encodent l’adresse brute avec `qrcode-generator` puis rendent les modules carrés et la marge blanche de quatre modules avec SVG. Aucun logo ne recouvre le code. `jsqr` vérifie sa charge utile dans les tests, sans entrer dans l’application.
- La largeur disponible est arrondie vers le bas et bornée avant la création du QR, y compris sur un Android à densité fractionnaire. Une relecture échouée masque le QR précédent et désactive sa copie et son partage ; le conseil hors ligne ne présente aucune adresse absente ou invalide comme partageable.
- `platform.ts` utilise `expo-clipboard` compatible SDK 58 et le partage de texte React Native ; les API Web sont utilisées lorsqu’elles sont disponibles. Un refus reste un échec explicite, sans faux succès ni copie de remplacement.

L’adresse est réutilisable. T18 ne crée aucune facture, ne lui invente pas d’expiration et ne déduit jamais un paiement reçu d’une ouverture du partage ou d’une copie. Une adresse réellement fournie peut rester visible hors ligne ; le contexte hors ligne doit être indiqué.

Contrats consultés : T11 PR #53 au commit `5a670f13a2aafb06805c946fc2c404e8fa53c13e`, T19 PR #56 au commit `7ee2a91ff29a24d6f638fab0e9db1b03cf2e718a` et réception téléphonique PR #66 au commit `127e951dd81a4ee0b4fda85751a1d0cb79c004e9`. Ces branches ne sont pas importées ni présentées comme intégrées.

Commande utile depuis `apps/mobile` : `npm test -- --runTestsByPath tests/receive-model.test.ts tests/receive-screen.test.tsx tests/receive-qr.test.ts tests/receive-platform.test.ts --ci`.
Les [captures et limites](../../../../docs/design/validation-t18/README.md) complètent les tests ; elles ne prouvent pas un scan Android ou une réception regtest.
Le déverrouillage depuis Recevoir réinitialise la navigation vers l’onboarding,
puis revient à un seul accueil. Les régressions du partage exercent `inactive`
et `background` avec des événements remplacés ; l’observation de la feuille de
partage native reste à conduire sur Android.
