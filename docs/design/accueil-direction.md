# Accueil T16 | Direction artistique et états

Proposition du 9 novembre 2026 pour le projet de Salam et PAN. PAN porte l’interface ; Salam relit et porte les données du wallet. Cette note prolonge la [charte T08](charte.md), la [direction T14](onboarding-direction.md) et la [recherche pour l’accueil](accueil-recherche.md). Le contrat de lecture et les limites d’intégration figurent dans l’[ADR 0013](../decisions/0013-accueil-lecture-wallet.md). **PAN a confirmé les écrans T16 le 9 novembre 2026 avant commit et PR.**

## Intention | Lire son argent, puis choisir une action

L’accueil quotidien doit permettre d’identifier le montant connu, les actions proposées et les dernières opérations. L’illustration originale de T14 accompagne la découverte du produit ; ici, le nombre et son unité portent le contenu principal. Aucun nouveau visuel matriciel n’est nécessaire pour les remplacer. La marque reste présente par le monogramme entre T et P, le marine, le citron, Manrope et Noto Sans.

Les références Revolut locales `references/ecrans/ref_16.webp` et `ref_17.webp` servent de repères pour le montant dominant, le regroupement des commandes et les surfaces lisibles. Elles restent ignorées et ne sont ni copiées dans les ressources de l’application ni publiées. Cette lecture de composition ne prouve pas une préférence universelle ou un gain mesuré de confiance.

## Composition retenue

La barre supérieure reste claire : monogramme, nom Teranga Pay et accès à l’aide. La grande surface marine qui suit contient le montant, son estimation en FCFA, la quantité de sats, le statut du portefeuille et les trois actions. La liste des opérations retrouve le fond papier et une surface blanche. Le contenu suit cet ordre dans le défilement ; aucune promotion ni carte bancaire ne s’intercale entre le solde et les commandes.

Le montant utilise Manrope et des chiffres tabulaires. La taille s’adapte à la largeur, au grand texte et aux montants longs ; la valeur complète doit rester accessible. Noto Sans garde les libellés et les explications lisibles. Les espaces, la taille et les contrastes structurent la page sans attribuer à une couleur un pouvoir de sécurité.

Recevoir, Envoyer et Encaisser sont toujours accompagnés de leur nom. Les tracés restent les icônes originales T08 ; aucun catalogue générique ou nouveau logo n’est introduit. L’accent citron distingue Recevoir dans la composition proposée ; il ne signifie ni bonus, ni rendement, ni transaction garantie. Les commandes gardent des cibles utilisables et peuvent s’empiler lorsque le texte est agrandi.

Les opérations associent une icône, un libellé simple, la date, le statut et un montant avec unité. La couleur seule ne porte pas leur sens. Les montants reçus ou envoyés terminés ont un signe ; les opérations en attente ou échouées ne prennent pas l’apparence d’un débit définitivement confirmé. Les dates utilisent le fuseau de Dakar et les contre-valeurs historiques ne sont pas réévaluées par cet écran.

## Un affichage précis des états

| Situation                             | Présentation attendue                                                                                   | Limite à préserver                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Lecture disponible                    | Estimation FCFA dominante, sats en complément, trois dernières opérations et source du taux explicable. | Le wallet contient des sats ; l’estimation n’est pas un prix de conversion garanti.                                            |
| Solde et historique réellement vides  | `0 FCFA` reçu du port et message invitant à retrouver ici les prochaines opérations.                    | Cet état ne remplace jamais une lecture impossible.                                                                            |
| Taux FCFA absent                      | Contre-valeur inconnue, sats connus lisibles et explication proche du montant.                          | Ne pas appliquer un taux arbitraire ou celui d’une opération ancienne.                                                         |
| Données précédentes ou hors connexion | Dernière lecture identifiable et information de fraîcheur ; actions financières indisponibles.          | Une lecture locale ne prouve pas qu’un paiement pourra partir.                                                                 |
| Chargement                            | Indicateur de lecture, sans compteur qui anime l’argent ni délai imposé.                                | Le scénario contrôlé de développement n’imite pas un temps de réseau réel.                                                     |
| Erreur de lecture                     | Explication courte et réessai. Une ressource déjà connue reste distincte de celle en erreur.            | Ne pas effacer une observation encore utile sans indiquer sa limite, ni annoncer « aucun paiement » après un échec de lecture. |
| Wallet absent ou verrouillé           | Explication et accès au parcours approprié ; aucune donnée inventée.                                    | L’accueil ne crée pas de coffre et ne gère pas de PIN.                                                                         |
| Application interrompue               | Montants masqués et données retirées de l’état de l’écran ; nouvelle lecture à la reprise.              | Cela ne certifie ni l’effacement physique de mémoire ni le verrouillage natif du wallet.                                       |

Le taux possède son propre état : source fixe de démonstration ou Kraken, date de mesure et explication de l’arrondi. Le statut du wallet ne devient pas un indicateur réseau fictif : `pret` est décrit comme un portefeuille ouvert. Une panne de lecture et un taux absent ne sont pas confondus.

## Interactions de cette livraison

La commande de confidentialité masque les montants du solde et des opérations. Elle garde un libellé accessible « Afficher » ou « Masquer » au lieu de dépendre d’un pictogramme ambigu. Un passage en arrière-plan masque également les informations et ferme les éléments temporaires.

Les actions sont dessinées pour leur usage futur, mais ouvrent dans T16 une modale qui explique ce qui est disponible. Dans l’aperçu, le texte rappelle qu’il n’y a ni demande créée ni paiement envoyé. Recevoir, Envoyer et Encaisser deviendront des parcours financiers avec T18, T20 et T22 ; les opérations ne disposent pas encore de reçus ou de détail complet T24. Cette limite reste visible au moment de l’appui.

L’entrée normale explique que le wallet n’est pas encore fourni sur cette branche. L’atelier de développement `HomePreview` annonce explicitement ses données fictives. Il permet de passer entre `ready`, `empty`, `offline`, `rateUnavailable`, `loading`, `error` et `largeAmount`. Le dernier scénario éprouve le format avec une valeur extrême, sans signification financière. Son exemple nominal de 45 000 FCFA pour 100 000 sats ne constitue ni un compte crédité ni une preuve de liquidité. Le français utilise les ressources T09 ; aucune traduction wolof n’est inventée.

## Revue visuelle préparée

La [galerie T16](validation-t16/index.html) réunit 16 captures des composants React Native réels et de l’aperçu fictif. Le parcours vérifie le montant, l’unité, les trois actions, les statuts, les explications du taux, le réessai et les modales aux largeurs 390, 360 et 320 pixels. Une valeur extrême reste complète à 320 pixels en revenant à la ligne entre les groupes de milliers. Les tests de composants couvrent aussi le texte agrandi ; ils ne mesurent pas son rendu Android. La compréhension des états doit rester possible sans couleur et sans deviner une icône.

Les [mesures du parcours](validation-t16/mesures.json) ne relèvent ni débordement horizontal ni erreur de console. Les résultats et limites sont consignés dans le [suivi T16](../planning/suivi-t16.md). Une prévisualisation Web aide à examiner la composition ; elle ne remplace pas le rendu Android, TalkBack, le clavier ou les événements du wallet natif. PAN a confirmé ce nouvel accueil séparément de T14 ; cette validation visuelle ne remplace pas la relecture de Salam.
