# Suivi T18 | Recevoir

Projet de Salam et PAN. PAN porte les écrans ; Salam relit et fournit le wallet ainsi que l’adresse T19. L’issue [#13](https://github.com/PapaAmad/teranga-pay/issues/13) dépend de T11 et T16. État au 9 novembre 2026 : **écrans T18 confirmés par PAN avant commit et PR**, relecture de Salam et intégration native attendues.

La branche `feat/T18-recevoir` part de T16 au commit `ec884a2`, publié dans la [PR #71](https://github.com/PapaAmad/teranga-pay/pull/71), encore ouverte lors de la préparation de publication. L’accord propre à T18 a été recueilli séparément de celui sur T16.

Pendant la préparation, la carte de l’issue #13 est passée à **En cours** dans le [Project privé #3](https://github.com/users/PapaAmad/projects/3). Après confirmation de la PR publiée, elle passe à **En revue**. L’issue et la description de PR consignent les preuves distantes ; la tâche reste ouverte et n’est pas déclarée terminée par la publication.

## Réalisation

Le bouton Recevoir de l’accueil ouvre la page dédiée. Le QR encode l’adresse publique brute complète. Le texte et les boutons permettent aussi de copier ou partager sans caméra. L’adresse réutilisable n’a pas de minuterie inventée, de saisie de montant ou de facture créée automatiquement.

Le contexte normal reste sans adresse native branchée. Il explique l’indisponibilité au lieu d’inventer une destination. `ReceiveServices.address.current()` est le point de composition prévu avec T19, sans jeton d’enregistrement exposé. Le wallet fournit son état et ses événements ; une interruption, un verrouillage ou une perte de focus retire le QR et l’adresse. Les sources consultées et les nouvelles dépendances sont consignées dans l’[ADR 0014](../decisions/0014-recevoir-adresse-et-qr.md).

L’atelier `ReceivePreview` est réservé au développement : adresse nominale fictive, hors connexion, chargement contrôlé, erreur de lecture et adresse longue, auxquels s’ajoutent le refus de copie, l’annulation et l’indisponibilité du partage. Le texte partagé précise que la destination est fictive et non payable. Aucun appel n’enregistre un compte ou ne déclenche un paiement.

La [recherche](../design/recevoir-recherche.md) et la [direction](../design/recevoir-direction.md) relient la composition à ses contraintes : QR sans superposition, marge de quatre modules, destination accessible complète, retour de copie exact et absence de faux succès d’envoi. Les icônes restent celles de T08 et les libellés passent par T09 ; aucun wolof non relu n’est ajouté.

## Preuves et publication

Contrôles locaux du 9 novembre 2026 :

- `npm test -- --ci` : **340 tests mobiles réussis dans douze suites**. T18 ajoute 63 tests du modèle, 52 tests QR et plateforme, 26 tests des composants et trois parcours de navigation aux 196 tests précédents.
- `npm run test:tooling` : **112 réussites, un lien fichier ignoré faute de permission Windows, aucun échec**, sur 113 tests recensés.
- `npm run format:check`, `npm run lint` et `npm run typecheck` : réussis après préparation des écrans. `npm run repo:check` confirme la documentation des dossiers, 88 documents aux liens valides et 31 fichiers mobiles sans texte littéral détecté.
- Gitleaks ne détecte aucune fuite dans les sources mobiles examinées.
- Export JavaScript Android de diagnostic réussi avec `expo export --platform android --no-bytecode` : 1 058 modules, un bundle de 1,6 Mo et 21 ressources. Cet export ne valide ni APK ni bytecode Hermes ou démarrage Android de production ; le compilateur officiel restait bloqué par Windows Application Control lors de T14. Aucun réglage de sécurité du système n’est modifié.

Les tests traitent les adresses invalides, les lectures concurrentes et périmées, le cycle de vie, la copie brute d’une adresse longue, les refus et annulations de partage. Le QR est décodé indépendamment, jusqu’à une charge ASCII de 254 octets. Une relecture efface les anciennes confirmations ; un callback capturé avant verrouillage n’appelle aucune API externe quand il est exécuté après l’événement de fermeture. Aucun résultat d’API n’est présenté comme un paiement reçu.

La [galerie](../design/validation-t18/index.html) présente 18 captures des composants React Native rendus dans Edge. Les [mesures](../design/validation-t18/mesures.json) ne relèvent ni débordement horizontal aux largeurs 390, 360 et 320 pixels, ni erreur de console. Le QR nominal réellement rendu est décodé à 231 pixels et la variante longue à 320 pixels est décodée à 212 pixels ; leurs quatre modules de marge et leur charge utile exacte sont vérifiés. Le presse-papiers du navigateur a été lu après copie nominale et longue : les adresses restent strictement exactes, sans coupure visuelle ajoutée.

Le partage nominal a été intercepté en mémoire pour vérifier son texte fictif complet, sans envoi externe. Les scénarios contrôlés couvrent annulation et indisponibilité ; ils ne certifient pas l’ouverture d’une feuille native Android. Les états sans service et verrouillé sont présentés dans l’atelier ; l’entrée normale sans fournisseur est vérifiée séparément dans les tests. Ces captures ne valident ni Android ni TalkBack.

Les essais sur appareil, la reconnaissance du QR par les wallets retenus et la réception regtest après branchement T19 restent nécessaires. L’ouverture du partage ou une copie ne confirment jamais une réception. PAN a confirmé les nouveaux écrans avant commit et PR ; Salam doit relire et la CI doit passer avant toute fusion.

Commande utile : `npm run mobile:web -- --offline --port 8092`, puis Découvrir le projet, Essayer l’accueil fictif et Recevoir. Les commandes de scénarios sont en bas de l’atelier. Les tests se lancent depuis la racine avec `npm test -- --ci`.
