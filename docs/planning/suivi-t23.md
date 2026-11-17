# Suivi T23 | Passerelle simulée

Projet de Salam et PAN. PAN porte [T23, issue #18](https://github.com/PapaAmad/teranga-pay/issues/18) ; Salam relit. État au 11 novembre 2026 : **implémentation proposée dans la [PR #75](https://github.com/PapaAmad/teranga-pay/pull/75), journal paginé complété pour T24, relecture humaine attendue**. La date prévue au plan est le 12 novembre 2026. La carte est confirmée **En revue** dans le [Project privé #3](https://github.com/users/PapaAmad/projects/3).

La branche `feat/T23-passerelle-simulee` part de la [PR T17 #52](https://github.com/PapaAmad/teranga-pay/pull/52), commit `802e61f721a75a2e927d62be541bbdeff3481aec`, dans un checkout séparé. Cette base inclut T13 et permet de relire le travail serveur indépendamment de la pile mobile. Le checkout principal porte la pile mobile issue de T22, proposé dans la [PR #74](https://github.com/PapaAmad/teranga-pay/pull/74). Aucune fusion de ces dépendances n’est déduite de leur utilisation locale.

## Périmètre

La tâche ajoute le module `services/bridge-sim` et son accès par l’API existante : deux opérateurs entièrement simulés, devis avec frais visibles, réservations, états, idempotence et réconciliation. Les données portent `simulation: true`. Les seuls destinataires sont `wave-demo-001` et `orange-demo-001` ; aucun numéro réel, fonds réel ou secret wallet n’entre dans ce parcours.

Les frais fixes de 100 FCFA sont une règle de démonstration, pas un tarif commercial. Le devis T23 reprend le taux T17, limite sa validité à cinq minutes et conserve durablement les montants confirmés. Une même clé et un même devis retrouvent l’opération existante, y compris après expiration ou redémarrage ; une clé réutilisée pour un autre devis est refusée. Le même devis ne peut pas créer deux retraits sous deux clés différentes.

L’[ADR 0017](../decisions/0017-passerelle-simulee-et-idempotence.md) décrit le stockage SQLite local, le contrôle d’accès et les transitions. Une issue incertaine garde sa réservation jusqu’à une preuve exploitable. Le journal opérateur est lui aussi fictif et durable : la réconciliation lit la même opération sans lancer un second transfert. Le wallet mobile et ses clés restent hors de cette simulation.

T24 porte ensuite l’historique, les reçus et le total du jour ; T25 porte l’écran Retirer en cash. T23 n’ajoute aucun nouvel écran mobile. L’accord donné par PAN pour publier T22 reste distinct de la relecture du code serveur T23.

## Dépendances

- [T13, PR #48](https://github.com/PapaAmad/teranga-pay/pull/48) fournit Fastify, validation stricte, contrôle du débit et journaux sans contenu personnel. T23 ajoute le contrôle d’accès propre aux retraits ; les routes publiques T13/T17 ne deviennent pas une authentification du wallet.
- [T17, PR #52](https://github.com/PapaAmad/teranga-pay/pull/52) fournit le taux et les conversions entières. Son magasin de devis mémoire ne sert pas de registre durable des retraits : T23 conserve son propre instantané validé.
- [T11, PR #53](https://github.com/PapaAmad/teranga-pay/pull/53) précise la frontière wallet. T23 ne lui ajoute aucun droit de dépense côté serveur et ne transforme pas le solde de démonstration en solde natif.

La vérification ciblée du 10 novembre a consulté T13 au commit `2ff32ded89ae09e25c64418ad9d404cef50501e8` et T17 au commit `802e61f721a75a2e927d62be541bbdeff3481aec`, en tenant compte des remarques déjà publiées. Les requêtes inconnues malformées consomment le quota, les en-têtes transmis ne le contournent pas et l’autorisation n’est pas journalisée. La lecture contrôlée vérifie quatre montants invalides, la conversion de 2 500 FCFA en 5 556 sats, l’expiration à sa borne, vingt cas de conversion et le partage d’un rafraîchissement entre vingt appels simultanés après panne et reprise. Ces contrôles exécutent les sources exactes en mémoire, sans réseau externe ni modification des branches de Salam ; ils ne remplacent ni les suites complètes ni une approbation humaine. Aucun nouveau défaut actionnable n’a été retenu. La [revue d’intégration publiée le 11 novembre](https://github.com/PapaAmad/teranga-pay/pull/52#pullrequestreview-5856475299), avec le statut COMMENTED, documente ce contrôle et les frontières T23.

## Vérifications exécutées

Les six commandes requises passent : format, lint, types, tests, outillage et structure du dépôt. `npm test -- --ci` réussit avec **66 tests de passerelle, 89 tests API et le test mobile du socle** ; les 89 tests API comprennent 58 cas ajoutés pour T23, dont deux exécutent réellement la configuration dans un processus séparé. Les **17 tests d’outillage** passent. La vérification documentaire trouve **57 documents aux liens valides**. Cette branche serveur se base sur T17 : ses comptes de tests mobiles sont distincts des 644 tests de la pile T22, conservée dans le checkout principal.

Pour T24, `GET /v1/withdrawals` expose le journal paginé de l’identité authentifiée : 20 éléments par défaut, 100 au maximum, curseur limité au propriétaire, ordre par création immuable puis identifiant. Une lecture n’appelle pas le simulateur et ne réconcilie pas de retrait. Les statuts sont relus mais les nouvelles créations demandent un rafraîchissement ; cette pagination n’est pas un snapshot figé entre pages. Les 27 régressions ajoutées couvrent limites, dates identiques, curseurs et casse UUID, reprise durable et absence d’effet financier pendant la lecture.

La review de Salam sur `907e0ce` conduit à une reprise explicite :
`POST /v1/withdrawals/:id/retry` lit d’abord le journal opérateur. Une lecture
échouée ne soumet rien ; une absence confirmée reprend la même référence et le
même prix, sans nouvelle réservation. Vingt reprises concurrentes conservent
un seul effet fictif. Les conflits retrouvent la référence propriétaire avant
l’expiration du devis ; les rejeux non terminaux répondent 202. Le contrat UUID,
les codes `WITHDRAWAL_NOT_FOUND` et `STORAGE_CLOSED`, la conversion directe T17
et le succès de `bridge:setup` déjà configuré sont documentés et testés.
Une simple expiration ne libère aucun retrait incertain. Aucune purge
automatique du journal n’est introduite ; la rétention des devis non engagés
reste à définir pour un usage dépassant cette démonstration locale.

La régression de concurrence utilise quatre vrais workers Node avec leurs propres connexions au même fichier SQLite. Elle vérifie une seule réservation, un seul résultat opérateur créditant 2 500 FCFA fictifs et une seule déduction de 5 778 sats fictifs. Le motif de découverte Jest utilise désormais un glob relatif au projet pour fonctionner aussi dans un checkout Windows, sans ignorer de test.

Le parcours HTTP réel sur loopback passe pour Wave et Orange Money : 2 500 FCFA plus 100 FCFA fictifs, même référence au réessai, puis même opération et même solde après fermeture/réouverture du serveur. La commande `bridge:setup` crée son fichier ignoré sans imprimer le jeton et conserve un fichier déjà présent. `bridge:check` vérifie les deux opérateurs avec l’API locale. Aucun opérateur réel, wallet ou téléphone n’est utilisé par cette preuve.

Gitleaks ne détecte aucune fuite dans les sources de services examinées. L’autoreview indépendante a identifié puis fait corriger les URI SQLite `file:` qui pouvaient ouvrir une base mémoire ; la configuration et le module les refusent, avec régressions. Le mode mémoire explicite reste réservé aux tests injectés.

Cas couverts par ces contrôles :

- Réessais simultanés de la même demande, depuis deux services ou connexions au même fichier SQLite : une réservation et un seul effet opérateur.
- Même clé avec un autre devis, ou même devis avec une autre clé : conflit sans deuxième débit fictif.
- Redémarrage, rejeu après expiration et réponse perdue après succès : même opération retrouvée ; compte de démonstration non rechargé silencieusement.
- Solde fictif insuffisant, devis invalide, expiré ou appartenant à une autre identité : aucune réservation indue.
- Échec certain : libération unique ; résultat incertain : réservation conservée ; réponses tardives : état terminal stable.
- Routes désactivées par défaut, jeton manquant ou refusé, accès à une autre identité, données de téléphone ou champs inconnus : refus sans fuite dans les réponses ou journaux.
- Format, lint, types, tests mobiles, tests API/module, outils et structure du dépôt.

Les commandes depuis la racine du checkout sont `npm test --workspace @teranga-pay/bridge-sim`, `npm test --workspace @teranga-pay/api` et les six contrôles communs. Pour le parcours local, utiliser `npm run bridge:setup`, `npm run bridge:demo`, puis `npm run bridge:check` dans un autre terminal. La PR et son issue consigneront les preuves distantes après publication. La relecture de Salam et une CI verte restent nécessaires avant fusion.
