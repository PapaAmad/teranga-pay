# Réseau et reprises | Direction T28

PAN porte les écrans ; Salam porte le wallet et les transports natifs.

T28 prolonge les composants T08 et les cadres existants. Une carte ambre associe
un signe propre au projet, un titre court et une action expliquée. Les lectures
restent distinctes des mutations ; aucun écran de délai ne devient un reçu.

| Avant                                                                           | Après                                                                                         | Pourquoi                                                           |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Une promesse muette peut laisser un indicateur tourner sans fin.                | Chaque lecture est bornée à dix secondes et propose une reprise explicite.                    | Une attente ne retire pas durablement le contrôle à l’utilisateur. |
| L’erreur générique ne distingue pas une réponse lente d’un hors ligne avéré.    | Un message « La lecture prend trop de temps » conserve cette incertitude.                     | Éviter un diagnostic de réseau inventé.                            |
| Une confirmation silencieuse peut garder l’écran de soumission.                 | L’écran présente une issue à vérifier, garde la barrière et permet le retour au portefeuille. | Quitter l’écran ne signifie pas annuler le traitement.             |
| Une page d’historique ayant dépassé le délai peut repartir de la première page. | Le bouton de reprise conserve le curseur de la page manquante.                                | Préserver les pages et la position logique déjà obtenues.          |

## Matrice des parcours

| Parcours   | Lecture lente ou erreur                                                                             | Réseau absent                                                                                         | Reprise sûre                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Accueil    | Ressources indépendantes, dernières données marquées anciennes.                                     | Le wallet local peut fournir solde et opérations ; aucune valeur absente ne devient zéro.             | Relire, sans opération financière.                                                               |
| Recevoir   | Adresse antérieure conservée si l’état wallet est vérifié ; sinon retrait prudent des informations. | Adresse locale qualifiée et possibilité de partager, sans prétendre vérifier l’arrivée d’un paiement. | Relire l’adresse ; aucune facture créée.                                                         |
| Envoyer    | Destination conservée après lecture lente ; devis, frais et PIN toujours contrôlés.                 | Préparation bloquée si le wallet ne se dit pas prêt.                                                  | Après remise d’envoi, conserver la barrière et intégrer le résultat original, sans nouvel envoi. |
| Encaisser  | Devis lent sans facture ; rapprochements en lecture seule bornés en parallèle.                      | Pas de nouvelle demande depuis un wallet indisponible.                                                | Création incertaine conservée ; aucune facture de remplacement ni faux reçu.                     |
| Historique | Sources et pages indépendantes ; pages connues conservées si l’état wallet est confirmé.            | Consultation des opérations locales ; retraits distants qualifiés comme incomplets.                   | Même curseur après délai ; pas de mutation.                                                      |
| Retirer    | Prix lent sans réservation ; journal lu avant toute soumission.                                     | Pas de nouveau retrait tant que le service ne répond pas.                                             | Même intention et même référence ; écriture encore active conservée jusqu’à son acquittement.    |

Une vérification d’état wallet qui ne répond pas ne donne pas l’autorisation
d’afficher de nouvelles informations sensibles. Le verrouillage et l’arrière-plan
continuent de masquer les données selon les règles de chaque parcours.

## Validation

La [galerie](validation-t28/README.md) présente les composants réels avec des ports
fictifs, les messages, les réponses tardives et les petites largeurs. Les scénarios
ne déclenchent jamais de transfert réel. PAN a confirmé ces nouveaux états le
12 novembre 2026 avant commit ou PR T28 ; Salam assure ensuite la relecture humaine.
