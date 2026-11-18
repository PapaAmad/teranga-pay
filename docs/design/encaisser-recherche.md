# Encaisser T22 | Recherche et principes

Note du 10 novembre 2026 pour le projet de Salam et PAN. PAN porte le mode marchand ; Salam porte le wallet, les taux et la relecture. Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf), section 6, pages 10 et 11, décrit le montant en FCFA, le prix figé cinq minutes, le QR, puis « Payé » et le reçu. Le [plan d’équipe](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf), page 9, confie T22 à PAN ; le détail de l’historique, des reçus et du total journalier relève de T24. Le backlog précise les dépendances T17, T18 et T21. Les sources primaires ci-dessous ont été consultées le 10 novembre 2026.

## 1 | Afficher le prix, préserver le reste

Bitcoin Design recommande une création de demande simple et signale qu’afficher le solde sur un écran présenté au payeur expose une information privée. [Bitcoin Design | Demander un paiement](https://bitcoin.design/guide/daily-spending-wallet/requesting/).

**Choix T22 :** l’écran marchand montre le prix de cette vente, sans reprendre le solde de l’accueil. Saisie entière en FCFA, révision du montant et action explicite pour créer la demande. Le prix FCFA domine ; les sats restent consultables. Le clavier et le bouton suivent le cadre établi en T20, avec contenu défilant, erreurs près du champ et action au-dessus du clavier.

La palette marine/citron, les polices locales et les icônes originales T08 maintiennent la continuité. Le montant et le QR constituent le contenu visuel ; aucune illustration ajoutée ne doit concurrencer la lecture du code. Ce choix artistique ne démontre aucune confiance causée par une couleur.

## 2 | Cinq minutes : une limite de prix explicite

Une facture Lightning porte une expiration. BOLT11 recommande de ne plus tenter ni accepter le paiement après `timestamp + expiry`. Cette durée ne définit pas, à elle seule, celle de notre prix en FCFA. [BOLT11 | Conditions d’expiration](https://github.com/lightning/bolts/blob/master/11-payment-encoding.md#payer--payee-requirements).

**Choix T22 :** le devis T17 fixe le montant FCFA, les sats et son terme. La demande fournie par le wallet doit correspondre à ces sats. Le QR, la copie et le partage ne restent proposés que jusqu’à la première échéance pertinente : devis ou facture. Un simple compte à rebours ne raccourcit pas une facture native encore valable ; cette cohérence doit être fournie par l’adaptateur de Salam. À expiration, retirer les moyens de payer l’ancienne demande et expliquer l’étape suivante. Ne pas remplacer silencieusement le prix ou la facture.

WCAG 2.2.1 rappelle que les limites temporelles peuvent empêcher certains utilisateurs de terminer une action. L’expiration financière n’autorise pas à déclarer automatiquement une exception de conformité. [W3C | Temps disponible](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html).

**Application :** indiquer la durée et l’heure limite dès la demande, conserver le montant saisi, puis proposer une nouvelle vérification volontaire si le contrat permet de renouveler sans ambiguïté. Le nouveau devis peut changer les sats ; le commerçant doit le voir. Une expiration ne prouve pas qu’aucun paiement déjà engagé ne peut encore être confirmé. En cas de résultat inconnu, vérifier la demande existante avant d’en présenter une autre comme son remplacement.

## 3 | Un compteur consultable, des annonces mesurées

Le rôle ARIA `timer` possède une valeur implicite `aria-live="off"`. Le W3C distingue ce compteur des messages importants à annoncer sans déplacer le focus. [WAI-ARIA 1.2 | Timer](https://www.w3.org/TR/wai-aria-1.2/#timer), [W3C | Messages d’état](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

**Choix T22 :** le temps restant demeure lisible et accessible à la demande, sans annonce toutes les secondes. Un texte d’état séparé annonce les transitions utiles : attente, perte de connexion, expiration et paiement confirmé. Pas de flash, de battement urgent ou de vibration répétée pour chaque seconde. Le compteur est dérivé d’une échéance et de l’heure courante ; après reprise, il ne repart pas de cinq minutes.

React Native fournit `accessibilityLiveRegion` sur Android, avec les valeurs `none`, `polite` et `assertive`. La correspondance Web et le comportement TalkBack doivent être vérifiés séparément. [React Native | Annonces accessibles](https://reactnative.dev/docs/accessibility#accessibilityliveregion).

## 4 | Un QR fidèle à une demande unique

DENSO WAVE prescrit une marge libre de quatre modules sur chaque côté du QR. Cette marge appartient au code fonctionnel et ne peut recevoir un logo, une légende ou un cadre décoratif. [DENSO WAVE | Zone du QR](https://www.qrcode.com/en/howto/code.html).

**Choix T22 :** encoder la demande canonique complète fournie par le port, avec modules carrés sombres sur blanc. Le même contenu exact alimente copie et partage ; les coupures de présentation ne modifient jamais sa valeur. Aucun préfixe ou lien de paiement n’est inventé par l’interface. La demande BOLT11 étant plus longue qu’une adresse T18, sa densité et sa taille doivent être contrôlées séparément, avec décodage indépendant et essai de téléphone à téléphone. Les commandes restent utilisables sans caméra chez le marchand.

Copier confirme une écriture dans le presse-papiers. Ouvrir les options de partage n’atteste ni message envoyé, ni paiement reçu. Après expiration ou changement de demande, un ancien callback ne doit plus copier ou partager la charge précédente.

## 5 | Seul le wallet confirme l’encaissement

Bitcoin Design distingue la réception effective et les contraintes de réseau ou de capacité entrante. Son architecture de référence ne doit pas être attribuée automatiquement à notre wallet. [Bitcoin Design | Recevoir un paiement](https://bitcoin.design/guide/daily-spending-wallet/requesting/receiving/).

**Choix T22 :** afficher « Payé » seulement après confirmation cohérente d’une réception rattachée à cette demande par un identifiant vérifiable fourni par le contrat. Un scan, un retour de partage, une variation de solde ou une autre opération du même montant ne constituent pas cette preuve. Le rapprochement par le montant seul est exclu. L’absence de port capable d’établir le lien est une limite d’intégration à expliquer, pas une raison de fabriquer une réussite.

Android distingue lectures locales et écritures nécessitant le réseau ; une donnée locale peut rester exploitable sans affirmer que le réseau confirme une opération. [Android | Applications et connexion intermittente](https://developer.android.com/topic/architecture/data-layer/offline-first).

**Application :** garder des états distincts pour attente, lecture indisponible, hors connexion, expiration et réussite. Un réessai relit la demande ou son règlement sans créer une facture supplémentaire à chaque appui. Une interruption masque les données selon la session ; la reprise vérifie l’opération suivie. Aucune promesse de réception hors ligne ou de paiement en quelques secondes n’est ajoutée.

## Reçu et validation

T22 fournit un récapitulatif après règlement confirmé : montant de la vente, sats, état, référence et date à laquelle l’application observe la confirmation. `Payment.createdAt` ne garantit pas l’instant effectif du règlement ; le reçu indique donc « Vérifié le » à partir de `confirmedAt`. Une confirmation observée après le terme reçoit un état distinct sans affirmer que le client a payé après l’expiration. Le récapitulatif ne prétend pas être une facture fiscale, ne révèle aucune donnée de client inventée et n’ajoute aucun frais inconnu. Les reçus détaillés, l’historique et les totaux relèvent de T24.

Les nouveaux écrans doivent être présentés à PAN avant commit et PR. Les tests, captures Web, essais Android, décodage du QR et paiement regtest restent des preuves distinctes. Aucun résultat de validation ou branchement natif achevé n’est annoncé par cette recherche. Tous les textes viennent de T09 ; aucun wolof non relu n’est publié.
