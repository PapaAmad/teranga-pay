# Charte visuelle v1 | Teranga Pay

Charte T08 du 5 novembre 2026. Projet de Salam et PAN ; création portée par PAN, relecture par Salam. **La direction B, « Le courant commun », est retenue au niveau artistique.** PAN a communiqué ce choix le 5 novembre après discussion avec Salam. Cette décision de création ne constitue ni une approbation de PR ni une validation utilisateur. Le [brief](brief.md), la [recherche](recherche.md) et le [benchmark](benchmark.md) conservent leurs constats et leurs limites.

La [planche de création](../../assets/brand/exploration.html) présente les directions et leurs applications. Les exports [PNG](../../assets/brand/exports/planche.png) et [PDF](../../assets/brand/exports/charte.pdf) servent à la revue ; les fichiers éditables et références restent dans [assets/brand](../../assets/brand/README.md).

## Intention et directions

La marque exprime l'accueil, la clarté et la maîtrise de l'argent. Le lien avec le quotidien se construit par des formes simples, une hiérarchie stable et un langage compréhensible. Les signes Bitcoin ou Lightning restent disponibles dans les contextes techniques utiles ; le symbole principal porte l'identité propre de Teranga Pay.

| Direction                  | Parti pris                                                                                         | Intérêt pour le projet                                                                                                                                                         | Point à éprouver                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **A \| La porte ouverte**  | Piste explorée, non retenue : vert profond, papier chaud, or ; signe architectural autour du T.    | Prolonge le vert et l'or déjà présents dans les PDF. L'ouverture représentait l'accueil et le passage comme intention créative.                                                | Les explorations restent conservées pour expliquer le choix, sans constituer une identité active.                |
| **B \| Le courant commun** | Direction retenue : base marine, accent citron et monogramme entre T et P composé de deux modules. | Le choix artistique communiqué par PAN après discussion avec Salam privilégie ce signe et cette direction. Les usages conservent une hiérarchie précise et un accent ponctuel. | Reconnaissance du monogramme, différenciation avec d'autres marques et compréhension des usages à tester.        |
| **C \| Terre cuite**       | Piste explorée, non retenue : tons terre cuite et surfaces claires.                                | Ouvrait une piste de proximité par la matière et la chaleur.                                                                                                                   | Confusion possible avec les codes orange d'autres services ; proximité d'une couleur de marque avec les alertes. |

**B est la direction artistique retenue ; A et C sont des alternatives explorées non choisies.** La décision repose sur un arbitrage humain de création. Elle ne transforme pas la palette marine/citron en preuve de confiance, ni le monogramme en signe déjà reconnu par les utilisateurs. Les observations documentaires ne sont pas réécrites pour attribuer après coup une supériorité scientifique à B.

## Système de logo

Le symbole retenu compose **deux modules formant un monogramme entre T et P**. Conserver leur géométrie et leur relation comme un seul signe. Le nom éditorial s'écrit **Teranga Pay** ; le logotype dessiné emploie les minuscules « teranga pay ». Le symbole peut être autonome dans une icône d'application et accompagné du nom lorsqu'une reconnaissance préalable ne peut pas être supposée.

Les variantes nécessaires sont le signe seul, la signature avec le nom, la version monochrome sombre et la version inversée claire. Employer les sources vectorielles fournies pour conserver la géométrie. Une version décorative ou un rendu de planche ne remplace pas les fichiers de marque.

Règles proposées pour la revue :

- Conserver autour du signe ou de la signature un espace libre d'au moins un quart de la hauteur du symbole. Aucun texte, bord ou autre marque n'entre dans cette zone.
- Viser au moins **24 px de hauteur pour le symbole** dans un support numérique. Cette valeur reste une taille minimale proposée, à confirmer par l'inspection du rendu à taille réelle. Le nom doit demeurer lisible dans chaque signature ; si l'espace manque, utiliser le symbole seul avec le nom accessible dans le contexte.
- Dans l'icône Android, garder le signe dans une zone centrale avec une marge généreuse, pour que les masques circulaires ou arrondis ne coupent pas la forme. Le fichier de marque n'est pas, à lui seul, la validation d'une icône adaptative Android.
- Sur fond sombre, utiliser la variante claire ; sur photographie ou motif, placer la signature sur une surface unie suffisamment contrastée.
- Ne pas étirer, incliner ou recomposer le symbole. Conserver ses proportions et l'espacement de la signature. Éviter les ombres ajoutées, contours décoratifs et substitutions de couleurs non documentées.

La réussite en monochrome et à 24 px doit être examinée séparément de la beauté d'un grand logo. Le symbole doit aussi être présenté sans explication pour recueillir les interprétations spontanées.

## Palette et rôles

La source des valeurs est [tokens.json](../../assets/brand/tokens.json). Les noms décrivent un rôle d'interface ; les composants doivent utiliser ce rôle plutôt qu'un code couleur recopié sans contexte.

| Rôle                              | Valeur                | Usage proposé                                               |
| --------------------------------- | --------------------- | ----------------------------------------------------------- |
| `canvas`                          | `#FAFAF5`             | Fond clair principal.                                       |
| `surface`                         | `#FFFFFF`             | Cartes et champs sur le fond principal.                     |
| `ink`                             | `#142631`             | Texte principal et montants.                                |
| `muted`                           | `#4F616B`             | Texte secondaire lisible, aides et métadonnées.             |
| `primary`                         | `#172A36`             | Identité marine, zones fortes, action principale.           |
| `primaryPressed`                  | `#0D1E28`             | Retour visuel de pression.                                  |
| `onPrimary`                       | `#FFFFFF`             | Texte sur la couleur principale, selon les mesures.         |
| `accent` / `onAccent`             | `#E5EE73` / `#172A36` | Citron ponctuel avec contenu sombre.                        |
| `outline` / `line`                | `#61727D` / `#D5DFE2` | Limite utile des contrôles / séparation décorative.         |
| `success` / `successSurface`      | `#186346` / `#EAF5EA` | Confirmation, accompagnée d'un libellé et d'un pictogramme. |
| `warning` / `warningSurface`      | `#795100` / `#FFF0CB` | Attention ou attente à expliquer.                           |
| `error` / `errorSurface`          | `#A22D32` / `#FCECED` | Erreur avec explication et correction possible.             |
| `focus`                           | `#255BA6`             | Repère de focus, vérifié contre ses fonds adjacents.        |
| `selectionSurface`                | `#D5E6D8`             | Fond de sélection Android, distinct du curseur et du focus. |
| `disabledSurface` / `disabledInk` | `#E5E8E1` / `#4F616B` | Contrôle indisponible avec état explicite.                  |

Une répartition indicative peut consacrer environ 65 % de l'espace aux surfaces claires, 25 % au marine et aux contenus sombres, et 10 % au citron et aux repères. C'est une aide de composition, à adapter au support ; elle n'est ni un résultat de recherche ni une contrainte à appliquer à chaque écran.

Le citron sert d'accent lumineux. Il ne sert pas à écrire un petit texte clair sur un fond clair. **Ne pas employer de texte blanc sur le citron.** La ligne décorative ne doit pas devenir l'unique limite d'un champ si son contraste ne suffit pas. Les mesures doivent être régénérées pour la palette B : consulter la [validation](validation.md) et le [rapport de contraste](../../assets/brand/contrast.json) en vérifiant les valeurs et la version concernées.

La couleur d'état ne suffit jamais seule : garder un mot, une forme ou une icône significative. Une attente ne porte pas le libellé « Payé ». L'absence de réseau ne doit pas prendre l'apparence d'une confirmation. Le message décrit l'état connu ; les futures tâches de paiement relieront les composants aux informations réelles du wallet.

## Typographie

Les fichiers locaux sont **Noto Sans Regular**, **Noto Sans SemiBold** et **Manrope Bold**. Les versions, URL d'origine, tailles et empreintes sont consignées dans [sources.json](../../assets/brand/fonts/sources.json). Les licences [Noto Sans](../../assets/brand/fonts/OFL-NotoSans.txt) et [Manrope](../../assets/brand/fonts/OFL-Manrope.txt) sont conservées avec les fichiers. Leur présence évite de dépendre d'un téléchargement de police pendant une démonstration.

| Fonction                           | Police                                           | Taille / interligne de départ |
| ---------------------------------- | ------------------------------------------------ | ----------------------------- |
| Texte courant, aide et champ       | Noto Sans Regular                                | 16 / 24                       |
| Libellé d'action et emphase courte | Noto Sans SemiBold                               | 16 / 24                       |
| Titre d'écran ou de section        | Manrope Bold                                     | 28 / 36                       |
| Montant principal                  | Manrope Bold, chiffres tabulaires si disponibles | 36 / 44                       |

Ces valeurs sont des bases de composition. Dans l'application Android, la taille de texte doit respecter les réglages utilisateur et la mise en page doit accepter l'agrandissement ; aucune hauteur rigide ne doit couper un libellé. Employer les FCFA au premier plan et les sats en information secondaire. Les chiffres tabulaires sont à vérifier dans le moteur de rendu employé, sans espacement ajouté entre chaque chiffre.

Tester les accents français et les caractères utiles au wolof dans les fichiers effectivement chargés. Le contrôle de présence des glyphes et la relecture linguistique sont deux vérifications différentes : une police capable d'afficher un mot ne valide pas sa traduction. La substitution temporaire par une police système doit préserver une interface utilisable, même si les métriques changent.

## Iconographie, rythme et composants

La collection proposée contient **16 pictogrammes SVG dessinés pour le projet**, sur une grille de 24 × 24 avec un trait de 2. Employer une épaisseur et des terminaisons cohérentes, sans mélanger plusieurs familles. Les pictogrammes fonctionnels accompagnent un libellé dès que leur sens pourrait être ambigu. Une icône visible de 24 n'autorise pas une zone tactile de 24 : la cible interactive visée est d'au moins 48 × 48 dp sur Android.

« Envoyer » fait sortir une flèche diagonale du cadre ouvert ; « Recevoir » la fait entrer. Le sens reste visible à 24 px, avec des pointes franches. Le libellé est conservé ; la reconnaissance sans explication reste à tester humainement. « Scanner » et « Encaisser » utilisent des signes distincts, y compris dans les maquettes comparatives.

Sur Android, le fond de sélection du texte utilise `selectionSurface` (`#D5E6D8`), distinct du bleu de focus et du curseur. Le texte reste sombre et lisible quand une valeur est sélectionnée. iOS conserve son comportement de teinte de sélection natif.

Le rythme des espacements suit 4, 8, 12, 16, 24 et 32 unités. Les arrondis proposés sont 14 pour un contrôle, 22 pour une carte et 8 pour un petit élément. Adapter la mise en page au texte et à sa fonction, en conservant l'ordre de lecture et les marges lors de l'agrandissement.

| Composant | États à montrer et à vérifier                                         | Règle de comportement                                                                                                                                                             |
| --------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bouton    | Disponible, pressé, focus, chargement, indisponible.                  | Libellé stable et compréhensible, retour de pression, indication d'activité ; l'état indisponible empêche l'action. La logique métier décide de la prévention des envois répétés. |
| Champ     | Repos, focus, rempli, erreur, indisponible.                           | Étiquette persistante, aide distincte de la valeur, erreur expliquée et associée au champ. Une couleur de bord seule ne suffit pas.                                               |
| Carte     | Information, attente, confirmation, erreur, consultation sans réseau. | Montant dominant, statut textuel, contexte et date si utiles. Distinguer contenu informatif et carte réellement activable.                                                        |

Les planches et composants de démonstration permettent d'examiner ces états ; ils ne réalisent aucun paiement. Les exemples regtest et les retraits simulés restent identifiés. Les états exacts, les essais effectués et ceux restant à conduire sont consignés dans la [validation](validation.md).

## Mouvement de marque

La [source animée et le MP4](../../assets/brand/motion/README.md) prolongent B : les deux modules se tracent sur place, puis le logotype et la signature apparaissent. La géométrie finale conserve le monogramme partagé. Cette introduction muette de 6,5 secondes sert au pitch ou à la communication ; elle ne devient pas un écran d’attente obligatoire dans l’application. Le HTML prévoit pause, reprise, parcours de la durée et mouvement réduit. Les exports graphiques ne prouvent pas leur lecture sur téléphone physique.
