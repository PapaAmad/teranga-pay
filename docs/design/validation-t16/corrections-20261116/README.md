# Accueil | Corrections de relecture

PAN a confirmé ce rendu le 16 novembre 2026 avant commit : disponible distinct du
montant en attente, absence de conversion inventée sans taux et masquage commun.

Ouvrir [la galerie](index.html) pour voir les composants Web à 390 et 320 pixels.
La fixture fournit zéro disponible et 10 000 sats fictifs en attente ; les étapes
montrent aussi l’absence de taux et le masquage. Elle a été restaurée après capture.

Ces images ne prouvent ni un wallet natif, ni TalkBack, ni une réception regtest.
Le [relevé](proof.json) conserve cette portée. Commande de logique utile depuis
`apps/mobile` : `npm test -- --runTestsByPath tests/home-model.test.ts tests/home-screen.test.tsx --ci`.
