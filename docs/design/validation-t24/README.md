# Validation visuelle | Historique T24

Projet de Salam et PAN. PAN réalise T24 et a confirmé les nouveaux écrans le
11 novembre 2026 avant commit et PR ; Salam relit. La publication est autorisée ;
la relecture humaine et les essais natifs restent distincts.

Ouvrir [la galerie](index.html) pour parcourir les **25 captures** des vrais
composants React Native rendus sur le Web. [Les mesures](mesures.json) consignent
les dimensions et les contrôles du parcours. Les données sont entièrement
fictives ; aucun paiement, retrait ou partage externe n’a été effectué.

| Avant                                                    | Après                                                                                                     | Pourquoi                                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| L’accueil montre seulement trois opérations.             | « Tout voir » ouvre une liste groupée par date et filtrable.                                              | Retrouver une opération sans surcharger l’accueil.                                    |
| Le détail d’un mouvement n’a pas d’écran dédié.          | Montant, état, frais connus, date et référence ont leur détail ; seul un succès porte le titre de reçu.   | Éviter de présenter une attente ou un échec comme une preuve de règlement.            |
| Aucun cumul quotidien consultable.                       | Reçus et envois hors frais restent distincts, avec couverture complète ou partielle.                      | Montrer ce qui est réellement connu, sans additionner le journal fictif des retraits. |
| Les situations difficiles ne sont pas exposées ensemble. | L’atelier réunit absence de données, panne, pagination, FCFA inconnus, montants extrêmes et verrouillage. | Permettre une validation du comportement autant que de l’apparence.                   |

## Parcours vérifié le 11 novembre 2026

- Journal, filtres, reçu, détails en attente, en échec et incertain.
- Retraits simulés, frais fictifs et journal distinct du wallet.
- Trois pages, erreur intermédiaire puis reprise sans perdre la première page.
- FCFA inconnus laissés inconnus ; aucune conversion historique au taux courant.
- Largeurs 390, 360 et 320 pixels, montant extrême complet et action de partage
  fixe de 48 pixels minimum dans le cadre visible. Aucun débordement horizontal
  ni erreur console détecté pendant ce parcours.
- Partages interceptés en mémoire : contexte fictif et année conservés, aucune
  note privée, facture Lightning ou coupure visuelle U+200B dans le message.
  Annulation et indisponibilité ne modifient pas l’état du paiement.

Le cumul du jour utilise la date d’opération `createdAt` et le fuseau de Dakar,
sans prétendre connaître l’heure effective du règlement. « Lecture complète »
décrit la couverture de la lecture, pas un instantané transactionnel de services
distants. Les réponses de paiement et les destinataires restent fictifs.

## Revoir l’application

Depuis la racine : `npm run start --workspace @teranga-pay/mobile -- --lan --web`.
Choisir « Découvrir le projet », « Essayer l’accueil fictif », puis « Tout voir »
près des dernières opérations. L’atelier au bas de la liste change la situation.
Commande de tests ciblés :
`npm test -- --ci --runTestsByPath tests/history-model.test.ts tests/history-preview.test.ts tests/history-screen.test.tsx tests/navigation.test.tsx`.

Le grand texte est exercé par le test d’écran à 320 pixels et un facteur 2 ; les
captures Web ne reproduisent pas l’agrandissement système Android. Restent à
vérifier sur téléphone : TalkBack, partage natif, retour matériel, longues listes,
interruption et grand texte. L’API de partage interceptée ne prouve aucun envoi.
La composition du wallet natif et du port T23 authentifié reste à réaliser avec
Salam. Le [suivi T24](../../planning/suivi-t24.md) détaille ces limites.
