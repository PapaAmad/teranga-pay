# Polices de marque | T08

Noto Sans Regular et SemiBold servent aux textes ; Manrope Bold sert aux titres et au logotype. Les deux Noto sont des sous-ensembles latins produits avec FontTools 4.68.0. Manrope reste le fichier original. Les sources épinglées, les empreintes amont et celles des fichiers livrés figurent dans `sources.json`.

Les deux Noto passent ensemble de 1 260 388 à 259 428 octets, soit environ 79 % de moins. Les trois fichiers totalisent 357 424 octets avant compression ; ce n'est pas une mesure de l'APK. Chaque Noto conserve 1 045 points de code : latin, accents, Ŋ/ŋ, signes combinants, espaces insécables, ponctuation et monnaies. Les avances horizontales des glyphes conservés sont vérifiées contre l'original. La couverture dépasse volontairement les seules chaînes de démonstration afin de garder des noms et textes français/wolof utilisables.

Pour les montants partagés avec Manrope, employer l'espace insécable U+00A0 : elle est présente dans les trois polices. Manrope ne possède pas l'espace fine U+202F ; la conserver dans le sous-ensemble Noto ne l'ajoute pas à Manrope. `glyphs.json` distingue le corpus commun des caractères supplémentaires vérifiés uniquement dans Noto.

Les deux familles sont distribuées sous SIL Open Font License 1.1 ; conserver les fichiers `OFL-NotoSans.txt` et `OFL-Manrope.txt` avec les polices. Ce dossier n'est pas couvert uniquement par la licence MIT du code.

Les licences sont conservées octet pour octet, y compris les espaces finaux présents en amont. Les attributs Git de ces deux fichiers évitent leur normalisation et limitent l'exception de blanc aux fins de ligne ; les sommes du manifeste servent à contrôler leur intégrité.

Pour reproduire les sous-ensembles, préparer Python avec FontTools 4.68.0, puis placer les deux originaux récupérés aux URL épinglées dans un dossier extérieur à celui-ci. Lancer `python scripts/subset-brand-fonts.py --originals "chemin/des/originaux"` depuis la racine. Le script vérifie les SHA-256 amont avant toute écriture, contrôle la couverture et les métriques, puis régénère les TTF et les deux relevés JSON sans réseau. Il ne télécharge et n'installe aucun outil. Ces outils de production graphique restent hors des dépendances mobiles.

Les fichiers locaux sont chargés par Expo sans téléchargement à l'ouverture. La charte HTML utilise les mêmes fichiers. Le contrôle du répertoire se lance avec `npm run repo:check`. PAN propose la typographie ; Salam relit. Le contrôle des glyphes ne constitue pas une traduction wolof ni sa validation linguistique.
