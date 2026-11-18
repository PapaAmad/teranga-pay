# 0016 | Encaisser, relier la demande au règlement et au reçu

- Date : 10 novembre 2026, Dakar.
- Tâche : [T22, issue #17](https://github.com/PapaAmad/teranga-pay/issues/17), PAN ; services et relecture Salam.
- État : proposition locale vérifiée et nouveaux écrans confirmés par PAN le 10 novembre 2026 avant commit et PR. Publication autorisée et en préparation ; relecture de Salam et CI distante attendues. L’intégration et les essais natifs restent à faire.
- Base : `feat/T22-encaisser` part du commit T20 `fe35e05ad579416ed06eeb234a84ec93f923d178`, proposé dans la [PR #73](https://github.com/PapaAmad/teranga-pay/pull/73), encore ouverte lors de la préparation.

## Besoin et choix

Le parcours marchand de la conception, pages 10 et 11, demande un prix FCFA figé cinq minutes, un QR, une attente puis Payé et le reçu. T22 construit ce parcours et son récapitulatif simple. T24 garde l’historique, les reçus détaillés et le total journalier. La [recherche](../design/encaisser-recherche.md) et la [direction](../design/encaisser-direction.md) expliquent le prix visible sans solde personnel, le QR fidèle et les annonces d’état mesurées.

Une vente doit conserver une relation vérifiable entre son devis, sa facture et sa réception. Le prix affiché n’est pas une adresse Lightning réutilisable T18. Le commerçant ne doit pas voir Payé parce qu’un autre client a envoyé le même montant ou parce qu’une variation de solde ressemble au prix attendu.

## Complément de contrat avec Salam

Le contrat T11 de la [PR #53](https://github.com/PapaAmad/teranga-pay/pull/53) fournit `Wallet.receive()` et `Invoice`, mais ne relie pas la facture renvoyée à `Payment.id`. L’adaptateur T15 consulté dans la [PR #61](https://github.com/PapaAmad/teranga-pay/pull/61) crée actuellement une facture valable une heure. T22 ne peut ni inventer cette corrélation ni raccourcir la validité native en dessinant un compteur.

Les [ports T22](../../apps/mobile/src/collect/ports.ts) proposent donc un complément à composer avec Salam :

```ts
interface CollectInvoicePort {
  create(request: { quote: SendQuote }): Promise<
    HomeResult<{
      invoice: CollectInvoice;
      paymentId: string;
    }>
  >;
  lookup(request: { paymentId: string; paymentRequest: string }): Promise<
    HomeResult<{
      paymentRequest: string;
      payment: HomePayment | null;
    }>
  >;
}
```

`create()` doit respecter le montant et l’échéance du devis et fournir un identifiant dont le lien exact à la facture est établi par l’adaptateur. `lookup()` relit cette même demande ; `null` signifie seulement qu’aucun règlement correspondant n’est confirmé par cette réponse. Le wallet apporte séparément son état et ses événements. Aucune recherche par montant seul, aucun décodage BOLT11 maison et aucun SDK supplémentaire ne remplacent ce contrat.

Cette évolution est à discuter avec Salam sur T11/T15 ; elle n’est pas déclarée implémentée ou approuvée dans ses branches. La [revue d’intégration publiée le 10 novembre](https://github.com/PapaAmad/teranga-pay/pull/53#pullrequestreview-5839032083) consigne ce besoin avec le statut `COMMENTED`, sans remplacer une approbation humaine. L’entrée normale T22 reste sans fournisseur jusqu’à une composition native autorisée ; l’atelier fictif reste isolé et non payable.

## Échéance, création et reprise

Le devis T17 fixe FCFA, sats, taux et expiration. La facture doit être cohérente avec ces valeurs ; la première échéance applicable détermine la fin de présentation du QR et des actions de paiement. Le compte à rebours est une indication locale de temps, pas une annulation native de facture ni une preuve que le client n’a rien payé. Son actualisation ne doit pas annoncer chaque seconde aux lecteurs d’écran.

Une barrière partagée par le même objet wallet protège la création contre doubles appuis, plusieurs contrôleurs et remontage pendant la session. En l’absence de ce port, la session utilise le port de factures puis l’objet des services. Si l’appel de création aboutit à une issue inconnue, le contrôleur ne tente pas silencieusement une nouvelle création : une facture a peut-être déjà été émise. Cette mémoire locale ne garantit pas une protection durable après arrêt du processus ; la reprise native doit être fournie par Salam.

Une nouvelle demande est toujours manuelle. Les demandes précédentes connues restent rattachées à leurs identifiants dans une liste bornée à vingt et leurs règlements peuvent encore être observés. La borne et l’état de ces demandes empêchent une création de faire disparaître silencieusement un suivi encore nécessaire. Une preuve observée après le terme est signalée par « Confirmation après le délai » ; cette indication décrit l’observation disponible, sans prétendre prouver quand le payeur a initié son envoi ou quand le règlement a effectivement abouti.

Les identifiants et factures déjà utilisés restent mémorisés pendant la session, indépendamment de la limite des dix reçus présentés. Une ancienne facture payée ne peut donc pas confirmer une nouvelle vente. Une preuve cohérente déjà observée reste acquise : les réponses et erreurs d’une lecture commencée avant cette confirmation ne la modifient plus.

Un verrouillage ou une interruption retire les données de présentation et invalide les callbacks. La reprise relit les références connues et recalcule le temps depuis les échéances ; elle ne relance pas automatiquement la création. La copie, le partage et une lecture de résultat ne créent jamais une autre facture.

## Reçu et valeur FCFA

Le reçu simple T22 conserve le **prix FCFA demandé au taux figé du devis**, les sats et la référence liée au règlement. `confirmedAt` est l’instant où T22 observe une preuve valide ; le libellé « Vérifié le » décrit cette date. `Payment.createdAt` ne garantit pas la date effective du règlement et n’est pas renommé pour le faire croire. Ce prix ne devient pas non plus une contre-valeur historique certifiée au moment du règlement. `Payment.amountXof` relève du contrat wallet et de sa conservation historique ; le défaut de réévaluation déjà signalé dans T15 n’est pas corrigé en réutilisant son taux courant dans le reçu marchand.

Payé exige une réception réussie correspondant à la demande suivie et des valeurs cohérentes. Une autre réception ne valide pas cette vente. Des frais inconnus, une identité de client, un numéro fiscal ou une facture commerciale ne sont jamais fabriqués. Le partage du récapitulatif n’est pas une nouvelle preuve de règlement.

## Réutilisation et vérification

T22 réutilise les dépendances déjà présentes : `qrcode-generator` et `react-native-svg` pour le code, `expo-clipboard` pour la copie, `Share` de React Native pour le partage et `jsqr` uniquement pour les vérifications de développement. Aucun nouveau paquet ou service externe n’est prévu. Le QR et les actions utilisent la même demande canonique complète, sans préfixe ou coupure de présentation ajoutés à sa charge utile.

La vérification doit couvrir les incohérences entre devis et facture, les opérations non correspondantes, l’expiration, la confirmation observée après le délai, les anciennes références, les lectures et créations concurrentes, le remontage, le résultat de création inconnu et les callbacks obsolètes. La [fiche T22](../planning/suivi-t22.md) distingue résultats réellement exécutés, captures Web, essais Android et paiement regtest. PAN a examiné et confirmé les nouveaux écrans le 10 novembre 2026 avant commit et PR ; la relecture de Salam et une CI verte restent nécessaires avant fusion.
