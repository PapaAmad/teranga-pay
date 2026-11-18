# Accueil | T16

PAN porte cet écran et son modèle de lecture ; Salam porte le wallet T11/T15. Le branchement natif dépend de leur validation et ne transforme jamais un exemple en portefeuille réel.

- `ports.ts` décrit la partie lecture du contrat T11, sans SDK, clé, PIN ou envoi.
- `HomeScreen.tsx` rend l’estimation, les actions et les trois opérations. Il masque les montants à l’interruption et propose un réessai distinct pour une erreur partielle.
- Les callbacks `onReceive`, `onSend` et `onCollect` relient Recevoir à T18, Envoyer à T20 et Encaisser à T22. Sans callback, l’action explique sa limite. L’accueil ne déclenche aucun transfert, aucune création de facture et ne contourne pas le récapitulatif ni le PIN d’Envoyer.
- `controller.ts` charge le solde et les trois dernières opérations indépendamment, valide les données externes et signale les valeurs anciennes. Un changement wallet invalide les lectures précédentes et regroupe les rafales de notifications.
- `format.ts` formate les nombres entiers et les dates en français, dans le fuseau de Dakar. Les unités et libellés appartiennent au catalogue T09. Le montant FCFA historique est conservé tel que fourni par le wallet.
- Le montant en attente est distinct du disponible, estimé par calcul entier avec arrondi inférieur. Sans taux ou au-delà des entiers sûrs, aucune contre-valeur n’est inventée ; ses sats restent visibles et ce bloc suit le masquage des montants.
- `preview.ts` propose un atelier explicitement fictif en mémoire : solde disponible ou vide, hors ligne, taux absent, chargement contrôlé et erreur. Le scénario de chargement attend un changement de scénario, sans temporisation artificielle.

Le modèle distingue zéro, absence de taux et lecture indisponible. Il ne déduit jamais une connexion réseau de l'état `pret`. Les données ne sont pas persistées par l'accueil : le passage en arrière-plan, le verrouillage, l'absence du wallet et la destruction de l'écran effacent le snapshot. Les ressources ne conservent une ancienne lecture qu'en mémoire pendant un rafraîchissement ou une erreur ; l'interface doit l'indiquer.

Commande utile : `npm test -- --runTestsByPath tests/home-model.test.ts tests/home-screen.test.tsx --ci` depuis `apps/mobile`.
Une actualisation normale emploie l’indicateur de chargement ; les messages de
lecture précédente sont réservés aux données non vérifiées après une erreur ou
un état hors ligne. Après un retour au premier plan, un historique disponible peut
être révélé même si la lecture du solde a échoué. Le lecteur de paiements exporté
sert de frontière commune aux futures adaptations de T24 et T27.
Depuis la présentation du projet, « Essayer l’accueil fictif » ouvre l’atelier :
sept états, dont une valeur extrême pour vérifier le format sans perte de chiffres.
Les [captures et vérifications](../../../../docs/design/validation-t16/README.md)
documentent le parcours. PAN a confirmé les écrans le 9 novembre 2026 avant commit
et PR ; la relecture de Salam reste attendue.

Encaisser ouvre le fournisseur T22 injecté dans le contexte normal ou un atelier
marchand distinct depuis l’accueil fictif. L’absence du complément natif de
création et de corrélation des factures produit une explication, sans donnée de
démonstration injectée dans la route normale. Le prix de vente et le reçu T22
n’exposent pas le solde personnel de cet accueil. Lire le
[suivi T22](../../../../docs/planning/suivi-t22.md) pour les limites et la validation
visuelle reçue de PAN le 10 novembre 2026 avant commit et PR. La publication est
autorisée et en préparation ; la relecture de Salam et la CI restent attendues. Les
[24 captures T22](../../../../docs/design/validation-t22/README.md) montrent le
parcours et ses erreurs avec des données explicitement fictives ; aucun paiement
réel n’est déduit de l’atelier.
