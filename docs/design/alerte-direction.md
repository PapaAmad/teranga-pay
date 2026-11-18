# Alerte avant envoi | Direction T27

Projet de Salam et PAN | PAN porte l’écran, Salam porte le serveur T26.

L’avertissement fait partie d’Envoyer. Il conserve le fond clair, les caractères
Manrope/Noto et les signes T08. Les motifs apparaissent dans une carte ambre avant
le récapitulatif. Le bouton principal permet d’annuler ; continuer reste une
action visible dans le pied fixe, sans compte à rebours ni animation insistante.

| Avant                                                                | Après                                                                           | Pourquoi                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Une note de nouveau destinataire précède directement le PIN.         | La confirmation du destinataire déclenche la lecture des signaux T26.           | L’accord porte aussi sur les raisons remontées par le service.   |
| Aucun écran ne distingue l’absence d’analyse d’une absence d’alerte. | Un état indisponible présente ses limites et trois choix explicites.            | Une panne ne vaut pas un avis rassurant.                         |
| Les motifs serveur ne sont pas présentés.                            | Chaque code connu devient une phrase locale et un conseil concret.              | L’utilisateur peut comprendre et agir sans interpréter un score. |
| Le récapitulatif et le PIN T20 existent déjà.                        | Ils restent requis après l’avertissement ; les données et délais restent figés. | Une décision de continuer ne déclenche pas le paiement.          |

## États et actions

| État                              | Présentation                                                | Actions possibles                                                          |
| --------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Vérification en cours             | Indicateur de lecture et récapitulatif, sans saisie de PIN. | Annuler ; après huit secondes, présenter l’indisponibilité.                |
| `confirmationRequired: false`     | Passer au PIN déjà demandé dans le parcours T20.            | Modifier ou confirmer avec le PIN ; aucun message « sans risque ».         |
| `confirmationRequired: true`      | Raisons dans l’ordre du serveur, conseil, montant et frais. | Annuler ou continuer avec son code.                                        |
| Analyse indisponible              | Limite explicite, données de l’envoi consultables.          | Réessayer l’analyse, annuler ou continuer sans analyse puis saisir le PIN. |
| PIN après décision                | Rappel discret du choix effectué, montant inchangé.         | Saisie locale du PIN puis appui d’envoi ; modifier invalide l’accord.      |
| Devis expiré                      | Erreur T20 et préparation à refaire.                        | Aucun accord antérieur ne permet l’envoi.                                  |
| Écran masqué ou wallet verrouillé | Données de la demande et motifs retirés.                    | Repréparer au retour ; ignorer les réponses tardives.                      |

Le niveau `moyen` ne signifie pas forcément qu’une confirmation est nécessaire.
Le mobile suit le booléen du serveur sans recalculer son seuil. Les réponses
malformées ou contenant un motif inconnu sont traitées comme indisponibles.

## Vérification visuelle

Les [captures et limites](validation-t27/README.md) proviennent des composants
réels rendus sur le Web, avec des ports fictifs clairement signalés. Les grandes
polices et les transitions d’arrière-plan sont également vérifiées dans les tests
de composants. Ces preuves ne remplacent pas les essais Android et TalkBack.

PAN a confirmé les nouveaux écrans T27 le 12 novembre 2026 avant commit ou PR.
Cette confirmation est distincte de T25 et ne remplace pas la relecture de Salam.
