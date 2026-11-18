# Historique T24 | Direction et états

Projet de Salam et PAN, proposition du 11 novembre 2026. PAN conçoit l’interface ; Salam fournit les services et relit. Cette direction prolonge T08 et l’accueil T16 selon la [recherche](historique-recherche.md). PAN a confirmé les nouveaux écrans le 11 novembre 2026 avant commit et PR. La [galerie de validation](validation-t24/README.md) présente les 25 captures et leurs limites.

## Composition

L’entrée de l’accueil conduit à Historique. La barre supérieure contient Retour, le titre de navigation et Actualiser. Le contenu suit cet ordre : titre court « Vos mouvements. », carte compacte du jour, convention de date et de couverture, messages de réseau ou de source, filtres, puis liste groupée par date. La carte défile avec la liste pour laisser de la place aux opérations. Les commandes d’atelier sont réservées à l’aperçu de développement.

La carte marine met « Reçus confirmés » au premier niveau et « Envoyés hors frais » au second. Elle donne le jour et distingue Lecture complète, Total partiel ou Dernière lecture connue. Elle n’affiche aucun solde net calculé en mélangeant paiements et retraits fictifs. Le filtre Simulés révèle un récapitulatif séparé des retraits et rappelle leur absence de débit du portefeuille.

Les filtres Tout, Reçus, Envoyés et Simulés utilisent la même grammaire de boutons arrondis que les parcours précédents. Le libellé accessible développe « Retraits simulés ». Une sélection est décrite par son état en plus de son fond. Les cibles visent au moins 48 × 48 dp. La ligne d’opération est entièrement actionnable ; une icône décorative de 44 pixels n’en réduit pas la cible.

Chaque ligne comporte une icône T08, un type simple, le montant signé, l’heure et l’état écrit. Les FCFA connus dominent ; quand ils manquent, « FCFA non connus » et les sats disponibles les remplacent. Le vert peut accompagner une réception réussie, sans porter seul son sens ; les envois ordinaires ne deviennent pas des erreurs par leur couleur. Une ligne T23 porte « Simulé » même au sein de la liste Tout. Aucun nom ni avatar n’est inventé.

Les fonds clairs, surfaces peu chargées, séparateurs fins, typographies locales et chiffres alignés reprennent les fondations de la [charte](charte.md). Les icônes originales évitent une nouvelle bibliothèque. Aucun média raster n’est requis pour ce journal. Aucun effet de mouvement n’est nécessaire à sa compréhension.

## Détail et reçu

Un appui ouvre la même opération, identifiée par source et référence ; Retour retrouve la liste et son filtre. Le détail présente montant disponible, sats, état, frais connus, date d’opération et référence. Une note wallet peut être consultée localement sans être incluse dans le partage. Le DTO de retrait peut aussi fournir sa dernière vérification et son total fictif.

Le titre « Reçu de paiement » est réservé à la réussite rapportée par le wallet. Les autres états ouvrent « Détail de l’opération ». L’aperçu et les retraits portent respectivement « Reçu fictif » et « Reçu de retrait simulé ». La date demeure « Date de l’opération » : elle ne prouve pas l’instant effectif du règlement. Les frais wallet connus uniquement en sats ne reçoivent aucune contre-valeur FCFA inventée.

L’action du bas est « Partager le reçu » ou « Partager le détail », selon l’état. Le texte partagé indique source, état, montants disponibles, frais, date et référence, avec la limite propre à l’attente, à l’incertitude ou à la simulation. Il ne contient ni note, facture Lightning, donnée de personne ou demande de paiement réutilisable. Ouvrir les options, annuler et échouer produisent des retours distincts. Une action n’est pas répétée pendant son ouverture ; une ancienne sélection ne reçoit pas son résultat.

## États à montrer

| Situation                         | Présentation et action                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Première lecture                  | Message court de chargement ; aucun faux total nul.                                              |
| Liste vide vérifiée               | Invitation sobre à retrouver les prochaines opérations.                                          |
| Filtre sans résultat              | Expliquer l’absence parmi les opérations consultées, même si des pages restent à lire.           |
| Pages restantes                   | Total partiel et commande pour lire la suite de chaque source.                                   |
| Panne d’une source                | Message et réessai de cette lecture ; les données connues de l’autre source restent utilisables. |
| Hors connexion ou synchronisation | Dernière lecture connue ; aucune nouvelle confirmation de retrait à distance.                    |
| FCFA absents                      | Valeur inconnue explicite, sats disponibles et nombre d’opérations concernées.                   |
| Somme trop grande                 | Indisponibilité précise ; aucun arrondi silencieux.                                              |
| Retrait incertain                 | À vérifier ; relire la même demande avant de recommencer.                                        |
| Portefeuille verrouillé ou absent | Masquer les données et proposer le parcours d’ouverture du portefeuille.                         |
| Application interrompue           | Masquer liste, carte et détail ; relire à la reprise.                                            |
| Port natif non composé            | Expliquer l’indisponibilité ; aperçu fictif seulement dans le développement autorisé.            |

## Vérification locale

Le parcours Web vérifie liste, reçu et détails d’attente, d’échec et
d’incertitude aux largeurs 390, 360 et 320 pixels, ainsi que grand montant,
FCFA absent, filtres, pagination et reprise après panne. Les mesures ne
détectent aucun débordement horizontal ; les actions fixes de détail restent
visibles avec une hauteur d’au moins 48 pixels. Partage annulé et indisponible
sont testés séparément, sans envoi externe. Les tests d’écran exercent aussi
le facteur de texte 2 et les callbacks périmés. Les preuves et leurs limites
figurent dans la galerie et le suivi.

Les captures Web, les tests de composants et un export Android sont des preuves différentes d’un essai Expo Go sur téléphone. La lecture TalkBack, le partage natif, la fluidité d’une longue liste et le masquage lors d’une interruption Android restent à observer sur appareil. L’intégration des ports de Salam exige ensuite ses propres preuves regtest et API ; aucun retrait réel Wave ou Orange Money n’est prévu.

Le [suivi T24](../planning/suivi-t24.md) conserve les résultats effectivement obtenus et les limites. Tous les textes visibles passent par T09 ; le français sert de repli et aucun texte wolof non relu n’est ajouté.
