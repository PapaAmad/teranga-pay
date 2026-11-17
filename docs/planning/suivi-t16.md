# Suivi T16 | Accueil

Projet de Salam et PAN. PAN porte l’écran ; Salam relit et porte le wallet et les taux. L’issue est [#11](https://github.com/PapaAmad/teranga-pay/issues/11).

État au 9 novembre 2026 : **écrans confirmés par PAN avant commit et PR T16**, séparément de son accord sur T14. La publication pour relecture est autorisée ; l’intégration native et la relecture de Salam restent attendues. La branche `feat/T16-accueil` part de T14 au commit `63feafa`, publié dans la [PR #70](https://github.com/PapaAmad/teranga-pay/pull/70), encore ouverte lors de la préparation de publication.

Pendant la préparation, la carte de l’issue #11 a été passée à **En cours** dans le [Project #3](https://github.com/users/PapaAmad/projects/3), puis relue par l’API pour confirmer le statut et la visibilité privée. Après confirmation de la PR publiée, la carte passe à **En revue**. L’issue et la description de PR consignent les preuves distantes ; la tâche n’est pas déclarée terminée par cette publication.

## Périmètre préparé

L’accueil place l’estimation en FCFA au premier plan, conserve les sats lisibles, regroupe Recevoir, Envoyer et Encaisser, puis présente les trois dernières opérations. La source et la date du taux, les données précédentes, les erreurs de lecture, l’absence de wallet, le verrouillage et le masquage des montants sont distingués. Un zéro reçu explicitement ne se confond pas avec une valeur inconnue.

La [recherche](../design/accueil-recherche.md) relie les choix aux sources et à leurs limites. La [direction artistique](../design/accueil-direction.md) décrit la composition. L’[ADR 0013](../decisions/0013-accueil-lecture-wallet.md) fixe le port de lecture et les conditions de l’intégration. Les textes passent par T09 ; le monogramme et les icônes viennent de T08. Aucune dépendance nouvelle, bibliothèque d’icônes ou illustration matricielle n’est ajoutée pour T16.

Le [module de lecture](../../apps/mobile/src/home/README.md) reprend quatre fonctions compatibles avec T11 : état, solde, historique et abonnement. Il valide les réponses et traite séparément les erreurs du solde et des opérations. Il écarte les réponses périmées, limite les lectures concurrentes et retire ses données lors d’une interruption. Il n’a ni coffre, ni PIN, ni fonction d’envoi.

## Ce qui est accessible et ce qui attend encore

L’entrée normale reste sans port natif et annonce l’indisponibilité du wallet. Elle n’invente pas un solde nul ou un historique réellement vide. La session native et le déverrouillage effectif restent à composer avec T14/T15.

La route de développement `HomePreview` fournit un aperçu explicitement fictif avec sept scénarios : `ready`, `empty`, `offline`, `rateUnavailable`, `loading`, `error` et `largeAmount`. Le scénario nominal montre 45 000 FCFA et 100 000 sats, au taux fixe de démonstration. La valeur extrême teste uniquement le format. Aucune donnée de compte réel, clé ou requête de paiement n’est nécessaire.

Les trois actions ouvrent actuellement une modale explicative, sans facture ou transfert fictivement réussi. Recevoir, Envoyer et Encaisser attendent les tâches T18, T20 et T22. La liste complète, les détails et les reçus attendent T24. Aucun paiement réel, retrait opérateur ou parcours financier complet n’est annoncé.

## Revues des dépendances effectuées

- [T11, PR #53](https://github.com/PapaAmad/teranga-pay/pull/53#pullrequestreview-5827415172) : 16 tests contrats réussis sur les sources exactes de `5a670f13`. Trois correctifs confirmés, réponses publiées et fils techniques résolus.
- [T17, PR #52](https://github.com/PapaAmad/teranga-pay/pull/52#pullrequestreview-5827415933) : 31 tests API réussis sur les sources exactes de `802e61f`. Rafraîchissement partagé confirmé, réponse publiée et fil technique résolu.
- [T15, PR #61](https://github.com/PapaAmad/teranga-pay/pull/61#pullrequestreview-5827414152) : demande de corrections publiée sur `e337e428`. Le solde dépensable, la conservation des montants FCFA historiques et la notification des échecs doivent être corrigés avant intégration réelle.

Les 16 et 31 tests ont été exécutés en mémoire sous Node 24 depuis les sources TypeScript des commits ; les tests API utilisent les dépendances déjà installées pour la revue. Ces preuves ne constituent pas des tests natifs ou un paiement reçu. Les revues assistées ne remplacent pas l’approbation de PAN et Salam, et n’ont posé aucun statut `APPROVED`.

## Validation visuelle et contrôles locaux

La [galerie locale](../design/validation-t16/index.html) contient 16 captures des composants React Native rendus dans Edge. Les [mesures](../design/validation-t16/mesures.json) confirment l’absence de débordement horizontal aux largeurs 390, 360 et 320 pixels et l’absence d’erreur de console pendant le parcours. Les trois modales expliquent leur limite et le masquage retire les nombres du texte visible. Une valeur extrême est affichée intégralement sur deux lignes à 320 pixels, avec un libellé accessible complet. Les tests couvrent aussi le grand texte, sans mesurer son rendu Android.

Contrôles locaux du 9 novembre 2026 :

- `npm test -- --ci` : **196 tests réussis dans huit suites**, dont 53 tests du modèle d’accueil et 20 tests des composants d’accueil. Les régressions couvrent notamment le réessai après erreur partielle, l’entrée initiale en arrière-plan et le montant long.
- `npm run test:tooling` : **112 réussites, un cas de lien fichier ignoré faute de permission Windows, aucun échec**, sur 113 tests recensés.
- `npm run format:check`, `npm run lint` et `npm run typecheck` : réussis.
- `npm run repo:check` : 82 documents aux liens valides, documentation des dossiers présente ; garde T09 réussi sur 24 fichiers mobiles.
- Galerie HTML ouverte dans Edge : 16 images chargées avec texte alternatif, aucun débordement du document à 390 pixels ni erreur JavaScript. L’aperçu local répond en HTTP 200.
- Export JavaScript Android de diagnostic réussi avec `expo export --platform android --no-bytecode` : 1 045 modules, un bundle de 1,6 Mo et 21 ressources. Aucune dépendance ou modification du lockfile ajoutée pour T16.

L’export sans bytecode est un contrôle de résolution et d’empaquetage JavaScript. Il ne valide ni APK ni démarrage Android de production. L’export Hermes standard reste à vérifier dans un environnement où le compilateur officiel est autorisé ; la politique Windows Application Control le bloquait lors de T14. Aucun réglage de sécurité du système n’a été changé.

Une dernière passe d’autoreview en lecture seule n’a pas identifié de nouveau défaut important reproductible dans le cycle de vie, la confidentialité, les erreurs partielles et les valeurs longues. Elle ne remplace ni les essais natifs ni la relecture humaine.

L’accord visuel de PAN a été recueilli avant la préparation du commit et de la PR. La relecture de Salam, une CI verte et les conversations résolues restent nécessaires avant une fusion. Le rendu Android, le fonctionnement de TalkBack et les événements du wallet réel devront être vérifiés séparément avec le build natif adapté.

Commandes utiles : `npm run mobile`, `npm run mobile:web -- --offline --port 8092`, `npm test -- --ci` et `npm run repo:check`. Les commandes lancées ne deviennent des preuves que lorsque leurs résultats ont été relevés.
