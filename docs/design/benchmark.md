# Benchmark et directions artistiques | Teranga Pay

Recherche du **5 novembre 2026**. Tâche T08, responsable PAN, relecture Salam.
Ce document distingue les observations sur les marques, leur interprétation pour
Teranga Pay et les pistes à tester. Aucun test utilisateur n'a encore départagé
ces pistes.

## Méthode et limites

Les sites, feuilles de style et pictogrammes officiels ont été consultés. Les
codes hexadécimaux relevés dans une feuille de style décrivent le site à cette
date : ils ne constituent pas tous une charte officielle de l'entreprise. Le
système Orange publie, lui, des couleurs nommées et leur usage.

La présence d'une couleur chez un concurrent ne la rend pas inutilisable.
L'objectif est de comparer les ensembles : symbole, palette, proportions,
typographie et langage. Les actifs concurrents servent à l'observation ; ils ne
sont ni repris ni adaptés dans les livrables Teranga Pay.

## Paysage visuel observé

| Marque                | Observation vérifiée                                                                                                                                                                                                      | Interprétation pour Teranga Pay                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wave                  | Pingouin noir et blanc sur une vignette cyan, avec de petites touches orange. Le CSS contient notamment `#1AB3E5` et le marine `#0E0D5D`. La page présente des usages quotidiens : déposer, retirer, payer et transférer. | Cyan lumineux et mascotte donneraient peu de distance. Retenir la clarté des usages, sans reprendre cette expression visuelle.                                    |
| Orange / Orange Money | Le système Orange distingue orange de marque `#FF7900`, orange accessible `#F16E00`, noir et blanc. Orange Sénégal présente Money comme un service pour payer, acheter et transférer depuis le téléphone.                 | Une identité orange vif et noir rappellerait un acteur local bien identifiable. La distinction entre teinte de marque et teinte accessible est une méthode utile. |
| Phoenix               | L'icône officielle inspectée est une aile blanche bordée de vert. Le CSS du site utilise notamment vert `#1AC486`, blanc et bleu gris sombre `#24333E`.                                                                   | Le territoire du wallet vert existe déjà. La profondeur du vert, les surfaces, le symbole et la typographie doivent construire la différence ensemble.            |
| Wallet of Satoshi     | L'icône officielle est un éclair or sur noir. Le CSS nomme `--primary: #DFAB29`, `--background: #000000` et `--btc-orange: #F7931A`. Le message central insiste sur la simplicité du paiement Bitcoin.                    | Éclair isolé, noir et or formeraient un ensemble très proche. Teranga Pay peut exprimer la relation entre personnes plutôt que le réseau électrique.              |
| Breez                 | Le site utilise notamment bleu `#0085FB`, marine `#00091C` et blanc. Son positionnement actuel porte sur un SDK intégré à d'autres applications.                                                                          | Référence de clarté technique, à présenter comme un acteur d'infrastructure actuel. Le bleu technologique ne constitue pas à lui seul une identité distinctive.   |

Sources primaires consultées :

- Wave : [site français](https://www.wave.com/fr/), [logo inspecté](https://www.wave.com/img/nav-logo.png), [feuille de style](https://www.wave.com/main.css).
- Orange : [palette publiée dans Boosted](https://boosted.orange.com/docs/5.2/customize/color/), [site Orange Sénégal](https://www.orange.sn/).
- Phoenix : [site](https://phoenix.acinq.co/), [icône inspectée](https://phoenix.acinq.co/apple-touch-icon.png), [feuille de style consultée](https://phoenix.acinq.co/css/app.8fd26bdc.css), [présentation officielle ACINQ](https://github.com/ACINQ/phoenix).
- Wallet of Satoshi : [site](https://www.walletofsatoshi.com/), [icône inspectée](https://www.walletofsatoshi.com/assets/images/icon.png), [feuille de style](https://www.walletofsatoshi.com/assets/css/wos.css).
- Breez : [site](https://breez.technology/), [feuille de style consultée](https://breez.technology/styles/main.439707380f461a8d9ae657b65b53921e.css).

Les adresses des feuilles de style versionnées peuvent changer. Leur relevé est
une observation datée, pas une garantie de stabilité des liens.

## Ancrage culturel et traduction visuelle

L'[Agence sénégalaise de promotion touristique](https://www.visitezlesenegal.com/esprit-teranga/)
présente la teranga à travers l'échange, le respect, la solidarité et la place des
voisins dans la vie quotidienne. Cette source institutionnelle décrit une valeur
culturelle ; elle ne mesure pas les préférences graphiques des futurs utilisateurs.

**Interprétation proposée :** représenter une valeur qui circule entre personnes,
avec une forme ouverte et un espace partagé. Cet ancrage n'impose ni un baobab,
ni le drapeau, ni un motif textile. Un marqueur culturel décoratif ne remplace pas
la compréhension d'un paiement et peut perdre sa lisibilité à petite taille.

Les valeurs d'accueil et de proximité peuvent aussi guider le langage : actions
simples, destinataire identifiable, aide facile à trouver. Leur efficacité devra
être vérifiée avec les personnes concernées, notamment pour les textes wolof.

## Trois directions à comparer

Les palettes suivantes sont des hypothèses créatives. Aucune ne découle d'une
règle universelle de psychologie des couleurs.

### A | La porte ouverte

- Palette : vert profond `#123F36`, ivoire `#F5F0E6`, accent ambre `#E6B85C`.
- Expression : calme, disponibilité, proximité ; formes ouvertes et surfaces claires.
- Symbole : deux montants et une traverse laissant apparaître un T dans l'espace.
- Intérêt : construire une lecture humaine de l'accueil et poursuivre la piste
  verte et dorée présente dans les documents du projet.
- Risque de lecture : immobilier, bâtiment ou institution. Comparer la silhouette
  sans le nom et éviter le dessin littéral d'une maison.

### B | Le courant commun

- Palette : marine `#172A36`, citron `#E5EE73`, blanc chaud `#FAFAF5`.
- Expression : directe, urbaine, technique ; composition nette et circulation horizontale.
- Symbole : un ruban court reliant deux points, sans maillon de chaîne ni éclair.
- Intérêt : exprimer la circulation de valeur avec une énergie différente du noir
  et de l'or observés chez Wallet of Satoshi.
- Risque de lecture : énergie ou télécommunications. Éviter le zigzag électrique
  et les effets lumineux ; vérifier que le symbole reste financier par son contexte.

### C | La terre ouverte

- Palette : terre cuite profonde `#8C4030`, sable `#EFE2CD`, encre `#26251F`.
- Expression : chaleureuse, éditoriale, matérielle ; aplats francs et formes mesurées.
- Symbole : une ouverture formée par deux modules imbriqués, sans détail folklorique.
- Intérêt : explorer une distance visuelle plus forte avec les wallets observés.
- Risque de lecture : restauration ou artisanat. Séparer la teinte de marque des
  messages d'erreur et tester le contexte de paiement.

Ces risques sont des hypothèses de lecture à examiner, pas des confusions
constatées auprès d'utilisateurs. Les contrastes de chaque rôle fonctionnel
doivent être vérifiés séparément : une palette de marque ne valide pas un écran.

## Iconographie propriétaire

La demande de PAN exclut Lucide et les paquets de pictogrammes génériques. La
famille Teranga Pay est dessinée pour le projet, avec des sources vectorielles
éditables et une géométrie commune au logo. Son originalité vient d'une
construction cohérente, sans transformer les actions en énigmes.

Base de travail proposée : grille de 24 unités, trait de 2 unités, marge visuelle
régulière, rayons et terminaisons constants. Dériver du logo une seule
caractéristique, par exemple une ouverture ou une rencontre de segments, plutôt
que d'insérer sa silhouette dans chaque pictogramme.

Les actions restent reconnaissables : envoyer, recevoir, scanner, historique et
aide. Les flèches d'envoi et de réception portent un libellé visible pour éviter
de dépendre de leur interprétation seule. Prévoir des dessins adaptés aux tailles
20 et 24, puis les inspecter à leur taille réelle ; la réduction automatique d'un
grand dessin ne suffit pas à valider les détails.

## Départager les pistes

Comparer chaque direction dans les mêmes conditions, sans score présenté comme
scientifique :

- Reconnaissance : silhouette monochrome à 24 px et icône d'application parmi
  d'autres applications, sans explication préalable du symbole.
- Compréhension : retrouver envoyer et recevoir à partir des mêmes montants et
  libellés, avec la même hiérarchie d'écran.
- Lisibilité : contrastes des rôles, petits écrans, agrandissement des textes et
  information de réseau faible.
- Singularité : différence visible avec les marques observées, sans demander au
  participant de connaître la technologie Lightning.
- Pertinence : ce que les personnes pensent pouvoir faire dans l'application,
  avant de leur raconter l'intention du designer.

Le choix A est une proposition de travail cohérente avec les sources du projet.
Sa préférence par PAN et Salam et sa compréhension par les utilisateurs restent
à confirmer. Les planches doivent distinguer les exemples de démonstration des
paiements réels et présenter Wave/Orange Money comme un cash-out simulé.
