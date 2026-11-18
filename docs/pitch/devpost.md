# Page Devpost | brouillon

> **Brouillon de travail | Salam et PAN.** Cette page prépare une future soumission. Les promesses de parcours complet, sécurité, APK, somme de contrôle, accès au code et répétitions sont des conditions à vérifier avant publication. Le dépôt reste privé ; le raccordement natif #120, la sauvegarde #10, la sécurité #26 et l’APK #30 restent ouverts. Aucune page Devpost ni vidéo n’a été publiée par cette consolidation.

- Tâche : T40 (soumission le 20 novembre au matin). Auteur : Salam ; relecture : PAN.
- **Brouillon** préparé le 7 novembre. Avant de le coller dans Devpost, relire chaque phrase avec la liste « À vérifier avant de jouer » du [script](script-3-minutes.md) : ne décrire que ce qui tourne dans l'APK `v1.0.0`.
- Les champs suivent le formulaire Devpost habituel. Version anglaise en fin de page pour les juges non francophones.

## Nom et accroche

**Teranga Pay**. L'argent de la famille, sans détour : un wallet Lightning en FCFA pour le Sénégal.

## Inspiration

Mame Diarra vit à Thiès ; son fils Ousmane est chauffeur à Milan. Chaque mois, l'argent qu'il envoie passe par un opérateur : frais de 2,5 à 3,8 % depuis la France (jusqu'à 10 à 15 % hors zone CFA), taux de change peu lisible, attente. La diaspora a envoyé plus de 2 200 milliards de FCFA au Sénégal en 2024. Au marché, Awa encaisse en espèces, sans suivi ni monnaie à rendre. Nous voulions un outil aussi simple que Wave, mais où l'utilisateur garde son argent et voit chaque frais.

## Ce que fait le projet

- **Recevoir de l'étranger** : Ousmane paie `mame@teranga.example` depuis n'importe quel wallet Lightning ; l'argent arrive en quelques secondes, affiché en FCFA.
- **Encaisser au marché** : Awa tape un montant, montre un QR ; le client paie ; reçu et total du jour.
- **Retirer en cash** : vers Wave ou Orange Money, frais affichés avant confirmation (**simulé** dans le prototype).
- **Alerte fraude** : nouveau destinataire, montant inhabituel, presque tout le solde… l'application avertit et redemande le PIN, sans bloquer.
- **Estimation d'économies** : une fourchette avec sa formule (frais classiques estimés − frais payés), y compris quand Teranga ne fait pas mieux.

## Comment nous l'avons construit

- **Téléphone** : React Native (Expo), wallet **LDK Node** embarqué dans un module Kotlin ; phrase secrète chiffrée deux fois (PIN + Android Keystore), captures d'écran bloquées sur la phrase.
- **Serveur** : Node.js 24 et Fastify, sans garde des fonds. L'adresse Lightning relaie la demande de facture au téléphone du destinataire ; taux BTC/FCFA figé 5 minutes ; score de fraude explicable ; journaux sans aucune donnée personnelle.
- **Réseau de démonstration** : Bitcoin Core, deux nœuds LND et Electrum en regtest, lancés par Docker Compose et préparés par un script relançable.
- **Qualité** : CI GitHub à chaque PR (format, lint, types, tests, secrets) et un **vrai paiement Lightning** sur un réseau regtest neuf ; revue de sécurité confrontée à notre modèle de menace ; APK signé avec somme SHA-256.
- Deux personnes, deux agents IA (Claude Code et Codex), une règle : une tâche = une issue = une branche = une PR relue par l'autre.

## Difficultés

- Choisir un SDK Lightning mobile en 2026 : react-native-ldk est archivé et Breez Liquid remplacé ; nous avons retenu LDK Node pour rester compatibles avec notre regtest (décision 0008).
- Recevoir sur une adresse Lightning **sans garder les fonds** : le serveur ne fait que relayer la facture créée par le téléphone.
- Ne jamais payer deux fois : une adresse Lightning donne une nouvelle facture à chaque demande, donc un envoi incertain bloque le suivant tant que son issue est inconnue.
- Réseau faible et outils lents : nos propres téléchargements Android ont parfois calé, comme ceux de nos futurs utilisateurs.

## Ce dont nous sommes fiers

- Un parcours qui fonctionne vraiment, de bout en bout, sur un vrai réseau Lightning de test, prouvé automatiquement à chaque modification.
- Aucun nom ni numéro dans nos journaux ; aucune clé utilisateur sur le serveur.
- Une estimation d'économies honnête, qui dit aussi quand le mobile money local reste moins cher.

## Ce que nous avons appris

- Lightning : canaux, liquidité entrante, LNURL et ses vérifications.
- Qu'un bon texte d'erreur (« Le paiement n'est pas passé. Votre argent n'a pas bougé. ») compte autant que le code.

## Et ensuite

Un pilote avec vingt commerçants d'un même marché, un partenaire agréé pour le cash-out réel, l'interface en wolof relue par des locuteurs natifs, et un audit de sécurité indépendant avant tout usage avec de vrais fonds.

## Construit avec

`react-native` · `expo` · `typescript` · `kotlin` · `ldk-node` · `lightning-network` · `bitcoin` · `lnd` · `electrs` · `node.js` · `fastify` · `docker` · `github-actions`

## Liens (à vérifier le 20 au matin)

| Lien                   | Valeur                                      | Vérifié |
| ---------------------- | ------------------------------------------- | ------- |
| Code                   | à compléter (visibilité du dépôt à décider) | ☐       |
| APK et somme SHA-256   | Release `v1.0.0` (T35, T39)                 | ☐       |
| Vidéo de démonstration | à compléter (T39)                           | ☐       |

> ⚠️ Le dépôt est **privé** (décision 0002). Avant la soumission, décider ensemble s'il devient public ou si l'on donne un accès aux juges : un lien vers un dépôt privé ne s'ouvre pas pour eux.

## English summary

**Teranga Pay** is a non-custodial Lightning wallet for Senegal, priced in FCFA. Families receive diaspora remittances in seconds through a Lightning Address, market vendors get paid by QR code, and users can cash out to Wave or Orange Money (simulated in this prototype). Keys stay encrypted on the phone (LDK Node, Android Keystore); the server never holds funds and logs no personal data. An explainable fraud score warns before risky sends, and a savings estimate shows its formula, even when local mobile money is cheaper. Every pull request runs a real Lightning payment on a fresh regtest network in CI. Demo only: regtest, no real funds.

## Répétitions de la soumission

| Date | Qui | Durée du pitch | Liens vérifiés | Remarques |
| ---- | --- | -------------- | -------------- | --------- |
|      |     |                |                |           |
|      |     |                |                |           |
