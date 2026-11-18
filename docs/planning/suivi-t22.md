# Suivi T22 | Encaisser

Projet de Salam et PAN. PAN porte le mode marchand de l’issue [#17](https://github.com/PapaAmad/teranga-pay/issues/17) ; Salam fournit les services et relit. État au 10 novembre 2026 : **réalisation locale vérifiée, nouveaux écrans confirmés par PAN avant commit et PR et publication autorisée, en préparation**. T22 dépend de T17, T18 et T21 et sa date prévue au plan est le 12 novembre 2026.

La branche `feat/T22-encaisser` part du commit T20 `fe35e05ad579416ed06eeb234a84ec93f923d178`, proposé dans la [PR #73](https://github.com/PapaAmad/teranga-pay/pull/73), encore ouverte lors de la préparation. Cette base conserve les tâches d’interface précédentes non fusionnées ; elle ne signifie pas que les branches natives de Salam sont intégrées.

La carte T22 est confirmée **En cours** dans le [Project privé #3](https://github.com/users/PapaAmad/projects/3). PAN a confirmé les nouveaux écrans et autorisé la publication le 10 novembre 2026. Le commit et la PR T22 sont en préparation ; aucun changement de statut distant n’est déduit de cette autorisation.

## Périmètre

Le parcours prépare un montant en FCFA, son devis figé cinq minutes, une demande à montrer par QR ou transmettre, une attente puis Payé et un reçu simple après règlement correspondant confirmé. La [recherche](../design/encaisser-recherche.md) et la [direction](../design/encaisser-direction.md) motivent la composition et les états. Le prix de la vente est visible ; le solde personnel du commerçant n’est pas exposé au client. La saisie suit le cadre T20 avec action au-dessus du clavier.

Le QR, la copie et le partage utilisent la même demande canonique complète. Les retours de plateforme ne confirment que leur propre action : aucune copie ou ouverture du partage ne signifie Payé. La première échéance applicable, devis ou facture, retire les moyens de payer l’ancienne demande. Le compteur n’annonce pas chaque seconde aux lecteurs d’écran ; les changements importants conservent un texte accessible séparé.

L’[ADR 0016](../decisions/0016-encaisser-demande-et-recu.md) documente le complément de contrat nécessaire avec Salam. T22 ne rapproche pas une réception sur son seul montant. Le reçu conserve le prix FCFA demandé au taux figé, pas une contre-valeur historique recalculée au règlement. Sa date « Vérifié le » vient de `confirmedAt`, instant où l’application observe la confirmation ; `Payment.createdAt` ne garantit pas la date effective du règlement. L’historique, les reçus détaillés et le total du jour restent T24.

## Dépendances d’intégration

- [T17, PR #52](https://github.com/PapaAmad/teranga-pay/pull/52) fournit le devis avec montant, sats, taux et échéance. Son contrat doit rester cohérent jusqu’à la création de la facture.
- [T11, PR #53](https://github.com/PapaAmad/teranga-pay/pull/53) fournit `Wallet.receive()` sans identifiant permettant actuellement de relier `Invoice` à `Payment.id`. La [revue d’intégration du 10 novembre](https://github.com/PapaAmad/teranga-pay/pull/53#pullrequestreview-5839032083), publiée avec `COMMENTED`, consigne cette demande d’évolution sans déclarer le contrat corrigé ou approuvé.
- [T15, PR #61](https://github.com/PapaAmad/teranga-pay/pull/61) crée actuellement une facture valable une heure. L’adaptateur complémentaire devra respecter l’échéance commerciale ; un timer T22 seul ne modifie pas cette validité native. Les constats T15 déjà publiés ne sont pas présentés comme corrigés par ce travail d’interface.
- [T21, PR #64](https://github.com/PapaAmad/teranga-pay/pull/64) porte le paiement côté client et sa protection contre les répétitions. Son état de revue est à vérifier pendant l’intégration ; T22 ne déduit pas sa correction de la présence d’un atelier.

Le port proposé `CollectInvoicePort.create({ quote })` rend `{ invoice, paymentId }`. `lookup({ paymentId, paymentRequest })` rend la demande relue et un paiement correspondant ou `null`. Le fournisseur natif doit prouver la relation entre ces valeurs. Le wallet apporte son état et ses événements. Sans cette composition, le parcours normal explique son indisponibilité ; les scénarios fictifs restent réservés au développement.

Une création d’issue inconnue garde une barrière partagée par le même objet wallet pendant la session et interdit un renouvellement automatique. Les références précédentes connues, bornées à vingt sans éviction silencieuse, restent observées pour ne pas transformer une confirmation tardivement observée en paiement d’une autre vente. L’état « Confirmation après le délai » ne date pas le règlement lui-même. La barrière locale ne survit pas à l’arrêt du processus ; une reprise durable reste une responsabilité d’intégration native.

## Vérifications locales et preuves restantes

Vérifications déjà obtenues le 10 novembre 2026 :

- 644 tests mobiles réussis dans vingt suites, dont 68 tests du modèle marchand, 61 tests QR et plateforme et 24 tests d’écran T22. La suite de navigation complète passe avec treize tests, dont quatre parcours T22.
- 113 tests d’outillage : 112 réussis et un ignoré pour la création de lien symbolique sous Windows.
- Types, lint et vérification du dépôt réussis ; cette dernière couvre 100 documents aux liens valides et 45 fichiers mobiles sans texte littéral détecté.
- Gitleaks ne détecte aucune fuite dans les sources mobiles examinées.
- L’export Android de diagnostic `--no-bytecode` réussit : 1 081 modules, bundle de 1,8 Mo et 21 ressources. Ce contrôle n’exécute ni la compilation Hermes ni la construction d’un APK et ne remplace pas un essai sur appareil.

Le format final, le lint, les types et la vérification du dépôt passent. Cette dernière couvre 100 documents aux liens valides et 45 fichiers mobiles sans texte littéral détecté. Les contrôles locaux ne sont pas présentés comme une CI distante ou un paiement natif. Les dépendances QR, copie et partage sont réutilisées ; aucun nouveau paquet n’est ajouté.

Les cas utiles couvrent montant invalide corrigible, devis et facture incohérents, préparation répétée, création inconnue, copie exacte, partage annulé, callbacks périmés, expiration, reprise après interruption, réception non correspondante, confirmation tardive et nouvelle vente explicite. Les anciennes références ne doivent pas perdre leur suivi parce qu’une nouvelle demande devient visible.

La [galerie de validation](../design/validation-t22/README.md) réunit 24 captures inspectées du parcours et de ses états aux largeurs 390, 360 et 320 pixels, sans donnée réelle. Les [mesures](../design/validation-t22/mesures.json) ne détectent ni erreur console ni débordement horizontal ; les actions mesurées restent dans le viewport et atteignent au moins 48 pixels. À 320 pixels, un défilement de 115 pixels permet de voir le QR entier.

Le décodage indépendant du bitmap du vrai SVG retrouve exactement les 326 octets de la demande à chaque largeur : version 13, module entier de trois pixels et marge de quatre modules. Les copies de 326 et 2 048 octets sont relues à l’identique dans le presse-papiers du navigateur. Le partage et le reçu sont interceptés en mémoire, sans envoi externe ; le reçu indique son caractère fictif et ne contient pas la facture. La fenêtre de 360 × 460 montre un espace réduit, pas un clavier Android. Les essais grand texte, clavier, TalkBack, partage natif et scan de téléphone à téléphone restent nécessaires ; une capture Web ne les remplace pas.

PAN a confirmé les nouveaux écrans T22 et autorisé la publication le 10 novembre 2026 avant commit et PR, séparément de sa confirmation précédente sur T20. La relecture de Salam et une CI verte restent requises avant fusion ; la tâche n’est pas déclarée terminée par une proposition ou une publication. Les preuves distantes seront ajoutées après vérification.

Commandes utiles depuis la racine : `npm test -- --ci` et `npm run mobile:web -- --offline --port 8092`. Depuis la présentation, choisir Essayer l’accueil fictif puis Encaisser. Les situations contrôlées et les commandes de confirmation ou d’expiration fictives sont en bas du parcours ; aucun de ces contrôles ne sollicite le fournisseur du contexte normal.
