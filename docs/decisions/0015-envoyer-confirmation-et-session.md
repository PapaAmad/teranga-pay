# 0015 | Envoyer, confirmer les frais et conserver l’incertitude

- Date : 10 novembre 2026, Dakar.
- Tâche : [T20, issue #15](https://github.com/PapaAmad/teranga-pay/issues/15), PAN ; logique T21 et relecture Salam.
- État : écrans confirmés par PAN le 10 novembre 2026 avant commit et PR ; proposition prête à publier avec son autorisation explicite. Relecture de Salam et CI distante attendues.
- Base : `feat/T20-envoyer` part du commit T18 `13a35c3f1b7b6395632f6576c34f2b569a42a665`, proposé dans la [PR #72](https://github.com/PapaAmad/teranga-pay/pull/72), encore ouverte lors de la préparation.

## Besoin et frontière

Le plan, page 9, confie à PAN le scan, le collage, les frais visibles et la confirmation PIN. Le [parcours proposé](../design/envoyer-direction.md) et sa [recherche](../design/envoyer-recherche.md) prolongent T08, T16 et T18. T20 orchestre les écrans et les primitives de plateforme. Le décodage cryptographique, la résolution LNURL, la signature et le paiement restent dans T21 ; le coffre et la vérification du PIN restent dans T15.

Les [ports T20](../../apps/mobile/src/send/ports.ts) reprennent structurellement `Wallet.preview()`, `Wallet.send()`, les lectures et événements T11/T21, ainsi que la réponse publique des devis T17. Ils permettent de composer les branches encore ouvertes sans copier un SDK ni annoncer une intégration native achevée. Le contexte normal reste indisponible tant que les fournisseurs autorisés ne sont pas branchés ; l’atelier de développement utilise des opérations explicitement fictives et aucune clé.

## Montant et autorisation

Une facture à montant fixe conserve le montant décodé par T21. Une adresse Lightning ou une demande ouverte conduit à une saisie entière en FCFA ; `SendRatePort.quote()` fournit le nombre de sats et le taux figés par T17. Le contrôleur vérifie notamment le montant demandé, la cohérence de l’arrondi entier et les dates du devis avant de redemander un aperçu pour les mêmes sats. Il ne construit aucune facture et ne valide pas BOLT11 avec une expression régulière.

Le récapitulatif expose montant, `maxFeeSats` et total maximum, avec FCFA en premier et sats ensuite. Le plafond affiché est transmis à `send()` avec la destination et le montant revus. L’autorisation PIN est bloquée si la contre-valeur FCFA du montant ou des frais reste inconnue. Modifier la préparation invalide l’autorisation précédente ; l’expiration impose une nouvelle vérification. Le PIN n’entre ni dans les snapshots, ni dans les journaux, ni dans un stockage T20. Le dernier chiffre ne soumet pas automatiquement.

## Soumission et résultat incertain

Une barrière de session est posée avant l’appel externe d’envoi. Elle est indexée par l’objet wallet dans une `WeakMap` : deux contrôleurs partageant ce wallet, un retour à l’accueil et le remontage de l’écran ne doivent pas créer une seconde soumission pendant une attente ou une issue inconnue. Les réponses tardives renseignent l’opération de session sans repeupler un écran fermé avec une ancienne préparation.

Cette mémoire ne survit pas à la fin du processus et ne remplace pas une protection durable dans T21. La revue du commit `6e9342b4e146da0d44638d37ac798298fdc9fe9f` de la [PR #64](https://github.com/PapaAmad/teranga-pay/pull/64) a reproduit deux défauts introduits par son registre : appels concurrents acceptés avant réservation et registre oublié lors de la reconstruction du wallet malgré un paiement natif en attente. La [revue publiée le 10 novembre](https://github.com/PapaAmad/teranga-pay/pull/64#pullrequestreview-5834840718) demande ces deux corrections P1 avec le statut `CHANGES_REQUESTED`. Cette revue assistée ne remplace pas une approbation humaine et T20 ne déclare pas ces défauts corrigés dans T21.

Une attente munie d’un identifiant peut être relue par l’historique et rapprochée par cet identifiant, sans renvoyer. `PAYMENT_TIMEOUT` dans le contrat T21 consulté ne fournit aucun identifiant. Ce résultat garde donc sa barrière et une explication : aucune réconciliation inventée, aucun bouton de nouvel envoi, aucune affirmation que l’argent n’a pas bougé. Un succès exige un résultat cohérent fourni par le wallet. Une fermeture de l’écran ne promet jamais d’annuler ce qui a déjà été soumis.

## Caméra et clavier

`expo-camera@58.0.14`, MIT, est la seule nouvelle dépendance d’exécution T20. La version exacte satisfait `~58.0.14` dans `bundledNativeModules.json` d’Expo 58.0.23 installé. Le scanner utilise `CameraView`, la caméra arrière et le format QR ; aucun paquet d’icônes ni service de scan externe n’est ajouté. [Documentation Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/).

La configuration `app.config.ts` prolonge `app.json` et lit l’explication caméra dans `src/translations/native.json`, ressource française du système T09. Elle active le scan et désactive le microphone ainsi que `recordAudioAndroid`. L’utilisateur demande l’accès depuis Scanner ; il conserve Coller après refus. Une détection utile suspend la caméra avant le décodage ; l’arrière-plan et la perte d’activité retirent la vue. Le plugin doit être pris en compte par une nouvelle construction native ; modifier la configuration n’applique aucune permission à un APK déjà installé.

`FormFrame` sépare contenu défilant et bandeau inférieur dans le cadre adapté au clavier. Le bouton doit rester juste au-dessus de celui-ci, conformément à l’observation de PAN sur Wave ; les marges de sécurité ne doivent pas doubler la hauteur du clavier. Les champs conservent leurs erreurs proches, les cibles visent 48 dp et le texte peut grandir. Aucun pavé PIN dessiné ni hauteur de clavier supposée n’est ajouté.

## Alternatives et vérification

Une validation automatique après scan ou après six chiffres est écartée : elle supprimerait la décision explicite. Un nouvel envoi après timeout, un décodage Lightning maison et un paiement simulé injecté dans le contexte normal sont également écartés. Les conséquences sont une étape de révision, des états d’incertitude visibles et un branchement natif restant à coordonner avec Salam.

Le [suivi T20](../planning/suivi-t20.md) consigne les six contrôles locaux réussis, les 487 tests mobiles et les limites de l’intégration. Les [24 captures](../design/validation-t20/README.md) documentent le parcours Web sans débordement horizontal ni erreur de console relevés. Les tests ciblent notamment doubles appuis, deux contrôleurs, remontage, réponses tardives, devis périmé, frais inconnus, PIN refusé, permission refusée et résultats non définitifs. Les essais clavier, caméra et TalkBack sur Android ainsi que le parcours regtest restent distincts des captures Web. PAN a confirmé les nouveaux écrans le 10 novembre 2026 avant commit et PR et autorisé leur publication ; la relecture de Salam et une CI verte restent requises avant fusion. La PR et ses contrôles distants seront consignés après confirmation effective.
