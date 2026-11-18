# Réseau et reprises | Recherche T28

12 novembre 2026 | PAN | projet de Salam et PAN.

## Besoin et limites

Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf),
sections 6.5 et 7, demande des messages utiles, la consultation locale quand le
réseau manque et des parcours qui restent compréhensibles. Le
[plan d’équipe](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf) confie T28 à PAN,
avec relecture de Salam, après Recevoir, Envoyer, Encaisser et Retirer.

Le PDF propose aussi une file d’attente et des réessais automatiques. Une attente
de réponse ne prouve pourtant pas qu’un paiement a échoué. T28 conserve donc les
barrières des tâches précédentes : pas d’envoi automatique au retour du réseau,
pas de nouvelle facture ni de nouveau retrait pour remplacer une issue inconnue.
La [décision 0021](../decisions/0021-attentes-et-reprises.md) formalise cette limite.

## Sources consultées

| Source primaire | Apport                                                                                                 | Application et limite                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| [Android        | Build an offline-first app](https://developer.android.com/topic/architecture/data-layer/offline-first) | Distinguer données locales, réseau, lectures et écritures ; rester utile sans connexion fiable.     | Conserver les valeurs connues avec leur ancienneté et distinguer une nouvelle lecture d’une nouvelle opération. T28 n’ajoute pas de cache financier sur disque ; la disponibilité après redémarrage dépend du wallet natif.                                     |
| [W3C            | Status Messages, 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)              | Rendre les états de progression et de résultat accessibles sans déplacer systématiquement le focus. | Le message de délai est un statut poli ; les boutons de reprise restent explicites. Les captures Web et tests de composants ne prouvent pas les annonces TalkBack.                                                                                              |
| [W3C            | Error Suggestion, 3.3.3](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)            | Associer une erreur de saisie à une correction connue.                                              | Continuer à proposer une correction du montant ou de l’adresse ; pour une erreur de transport, étendre ce principe à une prochaine action précise. Cette extension est notre choix de conception, pas une exigence de ce critère pour toutes les pannes réseau. |

Consultées le 12 novembre 2026. Aucune de ces sources ne fixe dix secondes comme
durée universelle. Ce budget d’interface est un choix technique T28, testable et
révisable après des observations sur Android modeste ; l’alerte T27 conserve son
budget global de huit secondes.

## Trois situations distinctes

Un état `hors_ligne` fourni par le wallet permet d’expliquer la connexion absente.
Une lecture qui ne répond pas dans le délai ne prouve ni une panne réseau, ni une
indisponibilité du serveur. Enfin, une opération déjà remise au fournisseur peut
encore aboutir : son suivi continue et son résultat tardif est intégré sans
nouvelle remise.

Les phrases indiquent ce qui est connu et l’action suivante. Elles ne promettent
pas que les fonds n’ont pas bougé si le résultat manque. Le vocabulaire français
passe par T09 ; le catalogue wolof reste vide jusqu’à sa relecture T33.
