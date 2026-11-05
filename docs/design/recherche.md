# Recherche | Couleur, confiance et lisibilité

Recherche documentaire du 5 novembre 2026 pour T08 : articles, rapport original et recommandations de leurs organismes auteurs. Aucune enquête locale n'est présentée comme effectuée. La [validation](validation.md) consignera les contrastes des couples et états réellement vérifiés.

## Ce que les études permettent de dire

Association émotionnelle, préférence et confiance financière sont trois mesures différentes. Associer une teinte à une émotion n'implique pas de la préférer ; aimer une interface ne prouve ni sa compréhension ni sa sécurité. Les recherches servent à comparer des hypothèses.

| Résultat observé                                                                                                                                                                                                                  | Implication possible pour Teranga Pay                                                                                             | Limite à conserver                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Jonauskaite et al. ont interrogé 4 598 personnes dans 30 nations et 22 langues. Les associations couleur/émotion comportent des motifs communs et des variations liées à la proximité linguistique et géographique. [S1]          | Comparer les associations spontanées de plusieurs directions avec le public visé, en français et avec l'appui de locuteurs wolof. | L'étude sur des termes de couleur ne mesure pas la confiance envers un wallet sénégalais. Elle ne fournit pas une palette universelle.           |
| Palmer et Schloss proposent et testent une théorie reliant les préférences aux réactions envers les objets associés aux couleurs. [S2]                                                                                            | Examiner les expériences déjà attachées aux couleurs des services quotidiens et les risques de confusion entre marques.           | C'est une explication étudiée des préférences, pas une formule de conversion ou une preuve de confiance financière.                              |
| Wilms et Oberfeld font varier séparément teinte, saturation et luminosité auprès de 62 participants exposés à des couleurs pendant 30 secondes. Les dimensions et leurs interactions influencent les réponses émotionnelles. [S3] | Comparer l'intensité des palettes, la surface occupée par l'accent et la hiérarchie visuelle, au-delà du seul nom de la teinte.   | Des stimuli de laboratoire ne reproduisent pas une opération financière. Limiter les grands aplats saturés reste un choix de direction à tester. |
| Le rapport Stanford de 2002 analyse les commentaires de 2 684 personnes évaluant des sites. L'apparence est mentionnée dans 46,1 % des commentaires. [S4]                                                                         | Soigner cohérence, structure et finitions ; rendre les informations financières faciles à retrouver.                              | Ce chiffre ne signifie pas « 46,1 % de confiance en plus ». L'étude ancienne sur le Web ne démontre pas un effet causal dans notre application.  |

On ne retient donc aucune formule du type « bleu = sécurité » ou « vert = confiance » comme justification suffisante. Les termes calme, chaleureux ou énergique nomment ici des intentions du designer. Leur réception par le public reste à observer. La crédibilité recherchée doit aussi venir de frais compréhensibles, de messages exacts et d'une distinction visible entre démonstration et opération réelle.

## Comparer les directions

Comparer les directions sur les mêmes contenus : montant en FCFA, action principale, champ en erreur, attente et reçu. Changer simultanément palette, textes et architecture empêcherait d'identifier ce qui aide.

Retenir reconnaissance, lisibilité, différenciation, compréhension des états et déploiement léger. Le [benchmark](benchmark.md) examine les proximités avec d'autres marques, sans constituer une recherche juridique d'antériorité.

## Contraintes d'accessibilité

Les WCAG sont des recommandations pour le contenu Web. Elles donnent ici des critères explicites de conception, à compléter par des essais sur l'application native et les recommandations Android. Un tableau de contrastes ne constitue pas, à lui seul, une déclaration de conformité de l'application.

- **Texte :** viser au moins 4,5:1 pour le texte courant. Le seuil WCAG des grands textes est 3:1 selon sa définition ; la règle interne peut garder 4,5:1 pour tous les textes fonctionnels afin de simplifier les usages. Vérifier libellés, aides, messages et texte des boutons. [S5]
- **Contrôles :** les indices visuels nécessaires pour identifier un composant ou son état visent 3:1 contre les couleurs adjacentes, selon les conditions et exceptions du critère. Un trait extrêmement fin peut rester difficile à voir. [S6]
- **Statuts :** conserver un mot et un indice de forme en plus de la couleur. Une opération en attente et une opération confirmée doivent rester distinguables en niveaux de gris. Les messages d'erreur décrivent aussi la correction attendue. [S7]
- **Cibles tactiles :** Android recommande au moins 48 × 48 dp pour les éléments interactifs. Une petite icône peut être contenue dans une zone plus grande. Les unités dp ne doivent pas être confondues avec le minimum Web WCAG de 24 pixels CSS et ses exceptions. [S8]
- **Agrandissement :** le repère WCAG est une taille de texte jusqu'à 200 % sans perte de contenu ou de fonction. Prévoir des essais avec les réglages Android, des montants longs et les traductions ; les libellés ne doivent pas dépendre de hauteurs rigides. [S9]

Une couleur lumineuse utilisable comme surface de marque peut exiger un texte sombre. Les contrastes se calculent pour des paires précises et pour chaque état utile ; ils ne se déduisent pas du nom de la palette. Les logos disposent d'exceptions dans le critère de contraste du texte, mais leur lisibilité en petit format reste un objectif de création. Les composants inactifs ont aussi des exceptions normatives : cela ne justifie pas de rendre leur état incompréhensible.

## Validation à conduire

Les entretiens doivent vérifier reconnaissance, marques évoquées et caractère perçu. Faire ensuite lire un montant, identifier l'action principale, comprendre une attente et retrouver les frais. Recueillir le ressenti de sérieux séparément de la réussite des tâches.

Des séances qualitatives avec les profils du brief pourront repérer des difficultés, sans valider statistiquement le marché. Consigner observations, erreurs et corrections. Prévoir Android modeste, grand réglage de texte et lecture en extérieur ; enregistrer conditions et résultats après les essais. Aucun test humain n'est annoncé comme réalisé ici.

## Références primaires

- **S1 | Jonauskaite et al., 2020.** [Universal Patterns in Color-Emotion Associations Are Further Shaped by Linguistic and Geographic Proximity](https://doi.org/10.1177/0956797620948810), Psychological Science.
- **S2 | Palmer et Schloss, 2010.** [An ecological valence theory of human color preference](https://doi.org/10.1073/pnas.0906172107), PNAS.
- **S3 | Wilms et Oberfeld, 2018.** [Color and emotion: effects of hue, saturation, and brightness](https://www.staff.uni-mainz.de/oberfeld/downloads/Wilms-Oberfeld2018_Article_ColorAndEmotionEffectsOfHueSat.pdf), Psychological Research, article disponible chez l'auteur.
- **S4 | Fogg et al., 2002.** [How Do People Evaluate a Web Site's Credibility?](https://credibility.stanford.edu/pdf/How_Do_People_Evaluate_a_Web_Site%27s_Credibility_v37.pdf), rapport original Stanford/Consumer WebWatch.
- **S5 | W3C.** [WCAG 2.2, comprendre le contraste du texte](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- **S6 | W3C.** [WCAG 2.2, comprendre le contraste non textuel](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- **S7 | W3C.** [WCAG 2.2, comprendre l'utilisation de la couleur](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).
- **S8 | Android Accessibility Help.** [Touch target size](https://support.google.com/accessibility/android/answer/7101858?hl=en).
- **S9 | W3C.** [WCAG 2.2, comprendre l'agrandissement du texte](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).
