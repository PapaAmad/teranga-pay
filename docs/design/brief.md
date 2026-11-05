# Brief de création | Teranga Pay

## Mission et sources

L'identité doit rendre reconnaissable un outil de paiement du quotidien pensé pour le Sénégal : recevoir un envoi, présenter un QR pour encaisser et comprendre son solde en FCFA. Elle accompagne la maîtrise de l'argent par l'utilisateur, avec des informations lisibles et des frais expliqués.

Les références sont le [document de conception v1.0](../sources/Teranga_Pay_Document_de_conception.pdf), pages 3, 6 à 11 et 12 à 14, et le [plan d'équipe v1.0](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf), pages 3 à 5 et 8. La couverture de conception, page 1, présente une identité et une maquette d'accueil préexistantes.

Cette page contient une gamme verte, notamment `#031F15`, `#0B5D3B` et `#14804F`, un or `#E8B33A`, un fond `#F5F9F6` et un texte `#1B2A24`. Le PDF contient les polices Poppins et Carlito. Cela permet d'étudier la continuité, sans prouver l'approbation d'une charte ni les droits de redistribution des polices ; documenter les variantes et licences retenues.

## Publics et situations

Les trois personnages du document, page 6, sont explicitement **fictifs**. Ils aident à concevoir des situations ; ils ne constituent pas les résultats d'entretiens ni une description exhaustive des Sénégalais.

| Profil de travail                      | Situation à comprendre                                             | Conséquence pour le design                                                                       |
| -------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Awa, commerçante à Dakar               | Encaisser rapidement, montrer un QR et retrouver ses ventes.       | Montant dominant, action évidente, état d'attente distinct de la confirmation, reçu lisible.     |
| Mame Diarra, destinataire à Thiès      | Recevoir un envoi familial et comprendre ce qu'elle peut utiliser. | FCFA au premier plan, mots courants, frais et montant reçu compréhensibles.                      |
| Ousmane, membre de la diaspora à Milan | Payer depuis un autre wallet Lightning avec un coût clair.         | Adresse et demande de paiement partageables, continuité du nom de marque entre lien, QR et reçu. |

Ces situations donnent trois critères de réussite : reconnaître l'application, lire le montant sans hésiter et distinguer l'état d'une opération. La préférence esthétique seule ne suffit pas pour choisir une direction.

## Contraintes qui façonnent l'identité

La conception, pages 7 à 11, demande des FCFA dominants, des sats secondaires, des mots simples et une action principale par écran. Préserver cette hiérarchie avec des montants et traductions longs. Le français est le point de départ ; T09 prépare la traduction. Le wolof nécessite une relecture de locuteurs natifs, selon la page 11.

Les téléphones modestes, les données limitées et les coupures réseau sont des contraintes du brief, pages 5 et 9. Les objectifs d'ouverture et de poids d'application restent à mesurer. Privilégier formes simples, contrastes robustes et reconnaissance sans texture, animation ou image téléchargée. Sans réseau, conserver les repères et expliquer les possibilités réelles.

La page 9 évoque des textes d'au moins 16 points et des cibles de 48 points. Lors de la réalisation Android, les unités natives doivent être précisées : taille de texte adaptée aux réglages utilisateur et zones tactiles d'au moins 48 dp. Le brief ne transforme pas automatiquement les unités du PDF en conformité mesurée ; les références et essais sont détaillés dans la [recherche](recherche.md).

## Promesse, ton et états

L'intention proposée associe **accueil, clarté et maîtrise**. Accueil signifie aider à comprendre le prochain geste ; clarté signifie rendre visibles montant, coût et résultat ; maîtrise signifie laisser l'utilisateur décider avec l'information nécessaire. Ces notions se traduisent par la hiérarchie, le vocabulaire et les états des composants, autant que par les couleurs.

Le nom est écrit **Teranga Pay**. Les variantes doivent fonctionner dans une icône Android, un écran, un reçu et une présentation. La création prévoit un symbole autonome, un logotype, une version monochrome et des usages sur fonds clairs ou sombres. La singularité culturelle doit être examinée avec des personnes concernées : aucun motif ou symbole ne sera qualifié de sénégalais uniquement parce qu'il paraît « africain » au designer.

Les messages distinguent préparation, attente, confirmation, échec et absence de réseau. Le texte décrit ce que l'application sait effectivement ; la future logique de paiement devra confirmer les états annoncés. Les principes de sécurité et de transparence de la conception ne deviennent pas une garantie visuelle de paiement réussi.

## Livraison T08 et limites

T08 appartient à PAN avec relecture de Salam, selon le plan, page 8. Elle couvre logo, couleurs, typographie, icônes et composants de base : bouton, carte et champ, avec leurs états et leurs contrastes. La recherche, la comparaison des directions, les sources éditables et les règles d'utilisation rendent la proposition révisable.

La démonstration prévue reste sur **Bitcoin regtest** et le retrait Wave/Orange Money demeure **simulé**, conformément à la conception, pages 8 et 12 à 14. Une maquette doit l'indiquer lorsqu'elle montre ces opérations. Les montants d'exemple ne constituent ni un tarif ni un solde réel. Les slogans, statistiques, prix et promesses de rapidité du PDF ne sont pas repris comme preuves d'un service disponible.

La direction, la reconnaissance du symbole, les associations locales et le wolof attendent une validation humaine. Dépôt et Project restent privés selon la [décision 0002](../decisions/0002-visibilite-privee.md). T08 ne présume pas la fusion de T07.
