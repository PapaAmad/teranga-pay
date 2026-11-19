# Raccordement de l'application | #120

PAN et Salam composent ici les écrans avec un seul coffre Android/LDK regtest et l'API.

- `RuntimeApp.tsx` est l'entrée normale : verrouillage au passage en arrière-plan.
- `composition.ts` partage le wallet, la session, les taux, les devis et les adaptateurs.
- `wallet.ts` adapte les ports des écrans et relie chaque vente à sa facture exacte.
- `api.ts` valide les réponses HTTP ; les retraits Wave/Orange Money restent simulés.
- `integration.ts` conserve les jetons dans le stockage chiffré du module natif, jamais dans AsyncStorage ou le bundle.
- `address.ts` réserve une adresse publique sans identité personnelle et répond aux demandes LNURL pendant la session ouverte.
- `random.ts` encode les 32 octets de capacité fournis par Expo Crypto, sans repli pseudo-aléatoire.

Un module natif absent ou ancien rend le parcours normal indisponible. Les ateliers restent des routes de développement distinctes, sans repli silencieux sur leurs fixtures. La récupération authentifiée de la sauvegarde reste suivie dans #10.

Vérifier : `npm test --workspace @teranga-pay/mobile -- --ci --runInBand runtime`.
