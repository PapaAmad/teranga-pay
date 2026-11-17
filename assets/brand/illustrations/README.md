# Illustrations | Teranga Pay

PAN prépare les visuels originaux de T14 pour le projet de Salam et PAN. Leur présence
locale ne valait pas validation des écrans ; PAN les a confirmés le 9 novembre 2026.
Aucun visuel de Revolut ni aucune image du
dossier privé `references` n’est inclus ici.

- `wallet-current-source.png` : génération originale du 9 novembre 2026, outil
  intégré `image_gen`, 1536 × 1024 pixels, fond transparent. Portefeuille bleu nuit
  et ruban citron pour évoquer la maîtrise de son argent et le courant commun.
- `wallet-current.png` : dérivé 960 × 640 pixels utilisé par l’accueil, même cadrage
  et transparence, redimensionné avec `@expo/image-utils` déjà fourni par Expo.
- [Prompt](prompt-wallet-current.txt) : consigne exacte de génération et contraintes.

L’image est décorative : aucun texte, montant, logo, code de paiement ou secret
n’y est intégré. Les textes restent traduisibles et le monogramme exact est rendu
séparément par `BrandMark`. L’objet illustré n’annonce pas une carte ou un produit
physique commercialisé. PAN a validé son intégration visuelle avant commit et PR ;
la relecture de Salam et les essais sur appareil restent distincts.

Commande utile : `npm run mobile:web -- --offline --port 8092`, puis ouvrir
`http://localhost:8092`. Voir aussi la [direction T14](../../../docs/design/onboarding-direction.md).
