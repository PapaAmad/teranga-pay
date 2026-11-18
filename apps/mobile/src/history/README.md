# Historique et reçus | T24

PAN porte la lecture et la présentation ; Salam fournit le wallet et relit. `ports.ts` reprend les lectures T11 et décrit une liste authentifiée des retraits T23, sans importer de code serveur dans l’app. L’intégration native et son contrôle d’accès restent à composer avec Salam.

`controller.ts` garde en mémoire les deux sources indépendantes, avec pagination de vingt éléments, validation des réponses, limite de mille éléments par source et protection des réponses tardives. Un doublon ou un curseur sans progression interrompt la pagination avec une couverture partielle. Verrouillage, absence de wallet et suspension effacent toutes les données visibles. Hors connexion, seule la lecture locale du wallet est demandée et signalée comme ancienne ; la passerelle n’est pas appelée.

`summary.ts` regroupe les opérations d’après leur `createdAt` et le jour `Africa/Dakar`. Les réceptions, envois et retraits simulés réussis restent séparés. Les montants FCFA inconnus, frais en sats, couvertures partielles et dépassements numériques ne deviennent pas des totaux inventés. La date d’opération n’est pas rebaptisée heure réelle de règlement ; aucune conversion au taux courant n’est effectuée.

`HistoryScreen.tsx` rend la liste virtualisée, les filtres, le détail et le reçu
avec une action de partage fixe. `format.ts` conserve les chiffres complets et
inclut l’année ; les coupures de présentation ne modifient ni libellé accessible
ni message partagé. `preview.ts` propose uniquement des situations fictives en
mémoire. Le retour Android ferme d’abord le détail ; un ancien callback ne peut
pas partager une autre opération. Aucune action de paiement n’est exposée.

Commande utile depuis la racine :
`npm test -- --ci --runTestsByPath tests/history-model.test.ts tests/history-preview.test.ts tests/history-screen.test.tsx`.
La [galerie de validation](../../../../docs/design/validation-t24/README.md)
documente les captures et leurs limites. PAN a confirmé les nouveaux écrans T24 le 11 novembre 2026 avant commit et PR.
