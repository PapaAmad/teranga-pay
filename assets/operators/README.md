# Logos des opérateurs | T25

PAN conserve ces ressources pour identifier les opérateurs dans le retrait
**simulé** ; Salam relit. Les noms restent écrits à côté des images.

- `wave.png` est le pictogramme de 192 × 192 pixels servi par le
  [site officiel de Wave](https://www.wave.com/fr/).
- `orange-money.svg` est la variante noire et orange à deux flèches, diffusée
  [sur Commons](https://commons.wikimedia.org/wiki/File:Logo_Orange_Money.svg),
  attribuée à Orange Money avec pour source sa
  [page officielle](https://www.orange.ci/fr/n-orange-money.html).
- `artwork.json` contient exactement le XML de ce SVG pour le composant natif
  `SvgXml`, sans transformer Metro ou ajouter une dépendance.
- `sources.json` conserve URLs d’origine, date et empreintes SHA-256. Les deux
  fichiers source conservent leurs octets, couleurs et tracés. Le rendu Orange
  Money cadre seulement le pictogramme dans `viewBox="0 0 221 115"`, sans
  recoloration ni redessin ; son nom reste écrit à côté.

Ces logos et marques appartiennent à leurs propriétaires respectifs. La licence
MIT du code Teranga Pay ne leur est pas attribuée ; leur présence ne déclare
aucune affiliation ni aucun service de transfert réel. Les règles d’Orange
demandent d’utiliser le dessin original :
[Orange Brand Basics](https://brand.orange.com/en/brand-basics/orange-brand-basics).

Commande utile : `node --test scripts/operator-logos.test.mjs`.
Le composant `OperatorLogo` charge ces fichiers localement ; aucun téléchargement
de logo n’est nécessaire pendant le parcours utilisateur.
