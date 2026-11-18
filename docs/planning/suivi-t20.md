# Suivi T20 | Envoyer

Projet de Salam et PAN. PAN porte l’interface de l’issue [#15](https://github.com/PapaAmad/teranga-pay/issues/15) ; Salam fournit la logique T21 et relit. État au 10 novembre 2026 : **écrans confirmés par PAN avant commit et PR, proposition prête à publier**. PAN a explicitement autorisé la création de la PR le 10 novembre. T20 dépend de T11 et T21. Sa date prévue au plan est le 11 novembre 2026.

La branche `feat/T20-envoyer` part du commit T18 `13a35c3f1b7b6395632f6576c34f2b569a42a665`, proposé dans la [PR #72](https://github.com/PapaAmad/teranga-pay/pull/72), encore ouverte lors de la préparation. Elle conserve le travail non fusionné de T18, T16 et T14 ; aucun code natif de Salam n’est déclaré intégré par la création de cette branche.

La carte T20 est confirmée **En cours** dans le [Project privé #3](https://github.com/users/PapaAmad/projects/3). La tâche reste ouverte ; la confirmation des écrans et l’autorisation de publier sont reçues. La création du commit et de la PR reste à consigner après confirmation distante.

## Périmètre et réalisation

Le parcours local relie le bouton Envoyer de l’accueil à une destination scannée ou collée, un montant FCFA si nécessaire, un récapitulatif avec frais, une autorisation PIN puis un résultat explicite. La [recherche](../design/envoyer-recherche.md) et la [direction](../design/envoyer-direction.md) expliquent les choix. Les données financières portent la composition ; les icônes originales T08, les polices et les traductions T09 sont conservées.

Les ports et l’orchestration locale distinguent lecture, devis T17, aperçu T21 et soumission. Les montants et plafonds autorisés sont transmis au wallet ; des FCFA inconnus empêchent d’ouvrir le PIN. Les erreurs et résultats non définitifs n’impliquent aucune absence de débit. Une barrière par objet wallet bloque les nouvelles soumissions incertaines dans la session, y compris après remontage de l’écran ; elle ne survit pas au redémarrage du processus.

Le scanner utilise la nouvelle dépendance exacte `expo-camera@58.0.14`, compatible avec Expo 58.0.23 installé. L’ajout est justifié dans l’[ADR 0015](../decisions/0015-envoyer-confirmation-et-session.md). La configuration caméra désactive microphone et permission audio ; les textes système viennent d’une ressource française T09. Le plugin nécessite une nouvelle construction native. L’interface garde Coller si la caméra est refusée, et le presse-papiers n’est lu qu’à la demande.

Le cadre de formulaire garde le bandeau d’action hors du contenu défilant, au-dessus du clavier. Ce comportement demandé par PAN doit être vérifié sur Android avec le champ actif, les erreurs, un petit écran et le grand texte ; une capture Web ne suffit pas à le confirmer sur téléphone.

Le contexte normal reste sans fournisseur natif branché et ne reçoit aucune donnée de démonstration par défaut. L’atelier est identifié comme fictif, avec une chaîne non payable et une adresse sous `.example`. Il permet d’examiner les états ; il ne vérifie aucun PIN réel et n’exécute aucun paiement.

## Dépendances et relecture parallèle

Conformément à la demande de PAN du 10 novembre, la lecture des PR dépendantes accompagne l’implémentation :

- [T21, PR #64](https://github.com/PapaAmad/teranga-pay/pull/64), commit `6e9342b4e146da0d44638d37ac798298fdc9fe9f` : deux défauts P1 reproduits dans le registre anti-doublon, sur les appels concurrents et la reconstruction de l’adaptateur pendant un paiement en attente. La [revue du 10 novembre](https://github.com/PapaAmad/teranga-pay/pull/64#pullrequestreview-5834840718) est publiée avec `CHANGES_REQUESTED` ; aucun statut `APPROVED` ne remplace la relecture humaine. La protection locale T20 ne permet pas de déclarer T21 corrigée.
- [T17, PR #52](https://github.com/PapaAmad/teranga-pay/pull/52), commit `802e61f721a75a2e927d62be541bbdeff3481aec` : déjà relue lors de T16 ; le contrat fournit le devis, son taux et ses dates. Les remarques existantes ne doivent pas être publiées une seconde fois.
- Le contrat T11 et le coffre T15 demeurent les frontières des données et de l’authentification. Les constats déjà publiés sur T15 ne sont pas réattribués au diff T21.

Le `PAYMENT_TIMEOUT` T21 consulté ne fournit pas d’identifiant. T20 conserve l’incertitude et empêche un nouvel envoi dans la session ; il ne prétend pas rapprocher automatiquement une ligne d’historique à partir du seul montant. Une attente avec un identifiant peut être relue sans soumettre à nouveau. La correction durable et la réconciliation après redémarrage restent à coordonner avec Salam.

## Preuves locales et vérifications restantes

Contrôles vérifiés le 10 novembre 2026 :

- `npm test -- --ci` : **487 tests mobiles réussis dans seize suites**.
- `npm run test:tooling` : **112 réussites, un test de lien symbolique ignoré faute de permission Windows, aucun échec**, sur 113 tests recensés.
- `npm run format:check`, `npm run lint`, `npm run typecheck` et `npm run repo:check` : réussis. La vérification du dépôt couvre 94 documents aux liens valides et 38 fichiers mobiles sans texte littéral détecté. Les six contrôles requis du dépôt passent, avec les résultats de tests détaillés ci-dessus.
- Gitleaks ne détecte aucune fuite dans les sources mobiles examinées.
- Export JavaScript Android de diagnostic réussi avec `expo export --platform android --no-bytecode` : **1 073 modules, un bundle de 1,7 Mo et 21 ressources**. Cet export ne constitue ni une compilation Hermes ni une construction ou une installation d’APK. Le blocage Windows Application Control du compilateur officiel observé lors de T14 n’est pas contourné.
- L’introspection native Expo conserve le SDK 58 : la configuration Android comprend `CAMERA` et aucune permission `RECORD_AUDIO` ; la configuration iOS reprend le texte caméra de T09 et ne demande pas de texte microphone. Ces résultats de configuration ne constituent pas un essai sur appareil.

Les tests traitent données externes invalides, taux ou frais inconnus, devis expiré, PIN refusé, doubles appuis, deux contrôleurs partageant un wallet, remontage après timeout, réponses tardives, caméra refusée et résultats en attente ou incertains. Les tests de composants vérifient aussi l’erreur de montant corrigible, les libellés Scanner et Coller avec grand texte et la cible tactile minimale. Ils ne mesurent pas la géométrie du clavier système.

La [galerie](../design/validation-t20/README.md) comprend 24 captures des composants réels, avec résultats fictifs et limites explicites. Les mesures ne détectent ni débordement horizontal ni erreur de console. Scanner et Coller restent sur une ligne, avec une hauteur identique de 60 pixels, aux largeurs 390, 360 et 320 pixels. Le parcours utilise le presse-papiers du navigateur, vérifie l’absence d’envoi automatique au sixième chiffre, l’attente après relecture et l’issue inconnue sans renvoi. La fenêtre réduite garde le bouton visible tandis que le champ est atteint par défilement ; elle ne simule pas un clavier Android.

L’inspection Web a reproduit puis corrigé une perte de focus lors du défilement automatique vers le PIN. Le mode de fermeture du clavier distingue maintenant Web et natif. L’auto-review a également corrigé l’erreur de montant invisible et le décalage haut compté deux fois ; les essais de clavier physique restent attendus.

Les essais clavier, scan physique, TalkBack et paiement regtest sur appareil restent distincts des tests et captures Web. PAN a confirmé les nouveaux écrans le 10 novembre 2026 avant commit et PR ; sa confirmation ne remplace pas la relecture de Salam et la CI avant fusion. La publication autorisée fera passer la carte en revue après confirmation distante, sans déclarer la tâche terminée. Aucune CI distante ni PR T20 n’est annoncée comme créée dans ce relevé préparatoire.

Commandes utiles depuis la racine : `npm test -- --ci` et `npm run mobile:web -- --offline --port 8092`. Depuis la présentation, choisir Essayer l’accueil fictif puis Envoyer pour l’atelier. Les commandes de scénarios sont en bas du parcours ; la demande et l’adresse proposées restent non payables.
