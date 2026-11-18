# Suivi T25 | Retirer en cash simulé

Projet de Salam et PAN. PAN porte l’issue [#20](https://github.com/PapaAmad/teranga-pay/issues/20) ; Salam relit. État au 12 novembre 2026 : **écrans confirmés par PAN avant commit et PR ; publication autorisée**. La carte du Project privé est « En cours » pendant la publication. Le plan prévoit T25 pour le 13 novembre et sa dépendance métier est T23. La PR et sa CI seront consignées dans l’issue après vérification distante.

La branche `feat/T25-retirer-cash` part de T24 `24a871fa2ee0df2bd6e16cc58cd0c115cd8d346c`, proposé dans la [PR #77](https://github.com/PapaAmad/teranga-pay/pull/77). Le contrôle distant du 12 novembre confirme cette PR ouverte et le même head. Le serveur T23 reste dans la [PR #75](https://github.com/PapaAmad/teranga-pay/pull/75), head `c0b8b40975e623c685c1f48d1ba6968a23a21907`, également confirmé sans fusion déduite. Le checkout serveur séparé ne fait pas entrer Node ou SQLite dans le bundle mobile.

## Parcours livré pour relecture

Une entrée distincte conserve les trois actions de l’accueil. Le parcours choisit Wave ou Orange Money, saisit un montant entier en FCFA, prépare un prix puis affiche principal, frais fictifs et total avant la confirmation explicite. Les logos locaux gardent le pingouin Wave et les deux flèches orange et noire d’Orange Money ; [sources et empreintes](../../assets/operators/README.md) sont conservées. La mention de simulation reste visible.

Le montant saisi est destiné au compte de démonstration ; 100 FCFA fictifs s’y ajoutent. Ce n’est pas un tarif commercial. Le prix dure au plus cinq minutes et sa préparation ne soumet aucun retrait. Aucun téléphone personnel, clé, phrase secrète ou PIN wallet n’est demandé. L’[ADR 0019](../decisions/0019-retrait-simule-et-reprise.md) documente les écarts au PDF : pas de PIN de façade, frais ajoutés et réponse perdue conservée comme incertaine. Lire aussi la [recherche](../design/retirer-recherche.md) et la [direction](../design/retirer-direction.md).

Le journal de reprise acquitte le prix et son UUID avant la première confirmation. Une réponse perdue réutilise exactement le même couple ; une référence connue est relue ou reprise explicitement sans nouvelle réservation. Une intention ne peut pas être écrasée ; un état terminal reste stable, et une nouvelle préparation exige un effacement acquitté. La session conserve un service stable par compte ; le journal reçoit un scope distinct à chaque identité. Sa file sérialise les instances d’un même processus, pas plusieurs processus ou onglets simultanés.

Perte de focus et arrière-plan masquent les informations sans annuler la demande engagée. Le suivi distingue attente, refus, incertitude et succès fictif. Aucune égalité de montant ni seul code HTTP ne remplace la validation du prix et de la référence. L’atelier reste isolé des services normaux et ne sollicite aucun opérateur réel.

## Vérifications exécutées

Les six commandes du dépôt passent : `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test -- --ci`, `npm run test:tooling` et `npm run repo:check`.

- **919 tests mobiles dans 27 suites**, dont **179 cas T25** : 84 modèle, 63 journal, 20 écran, huit aperçu et quatre navigation. Une régression supplémentaire T22 capture l’horloge une fois pour empêcher un prix de durer accidentellement 300 001 ms.
- **114 tests d’outillage réussis**, dont deux contrôles de provenance des logos ; un cas de lien symbolique reste ignoré faute de droit Windows.
- **113 documents aux liens valides**, **57 fichiers mobiles sans texte visible en dur** et aucune fuite détectée par Gitleaks dans les sources mobiles examinées.
- [**27 captures inspectées**](../design/validation-t25/README.md) des composants Web à 390, 360 et 320 pixels, plus une fenêtre de 360 × 460. Aucun débordement horizontal ni erreur console détecté ; les actions fixes restent visibles et mesurent au moins 48 pixels. La fenêtre réduite ne prouve pas le clavier Android. Le facteur de texte 2 et le retour matériel sont exercés avec leurs API remplacées en test.

La [preuve HTTP locale](../design/validation-t25/integration.json), reproduite le 12 novembre avec les sources dont les empreintes figurent dans le rapport, utilise deux processus client et deux processus serveur distincts par scénario. Le journal fichier est écrit et synchronisé avant le premier POST ; aucun état WeakMap n’est partagé après reprise. Une réponse 201 de succès est volontairement écartée avant le modèle : après redémarrages et expiration du prix, le même couple retrouve le même retrait, avec une ligne de retrait, une ligne opérateur et un crédit de 2 500 FCFA fictifs. Le chargement seul ne soumet rien.

Le second scénario commence avec 5 000 FCFA fictifs incertains. Après redémarrages, une lecture seule retrouve l’incertitude, puis la reprise explicite du même identifiant réussit. Le disponible reste 1 988 666 sats fictifs ; les 11 334 réservés passent à zéro, avec une seule ligne et un seul crédit fictif de 5 000 FCFA. Le jeton éphémère passe par l’environnement enfant, jamais par les arguments, les fichiers ou les sorties. Cette preuve est un parcours de processus local avec journal fichier, pas une exécution d’AsyncStorage sur Android.

## Intégration et limites

T23 a été relu au head exact ci-dessus pour options, arithmétique, expiration, idempotence, conflits de propriétaire, lecture et reprise. Aucun nouveau défaut actionnable n’a été retenu après déduplication des points de Salam déjà corrigés. Cette relecture assistée ne remplace pas son approbation humaine.

L’entrée normale reste indisponible sans service authentifié, journal et fabrique d’UUID composés. Le jeton reste hors des composants et des variables publiques Expo. Le serveur impose loopback : Expo en réseau local ne branche pas seul l’API sur un téléphone. Session, changement de compte et invalidation d’authentification restent à vérifier avec la composition ; aucune protection wallet réelle n’est déduite des seuls états de l’atelier.

TalkBack, clavier réel, retour physique, interruption, long délai et reprise sur téléphone restent à observer. Le bundle servi par Metro, les captures Web, les tests et le parcours HTTP local ne constituent ni APK, ni compilation Hermes, ni paiement regtest effectif. Aucun wallet ou opérateur réel n’a été utilisé. PAN a confirmé les écrans le 12 novembre 2026 ; la relecture de Salam et une CI verte restent nécessaires avant fusion squash.
