# Suivi T30 | Parcours Maestro

Actualisé le 13 novembre 2026 | PAN | issue
[#25](https://github.com/PapaAmad/teranga-pay/issues/25).

La branche `test/T30-parcours-maestro` part de T28, commit
`b1d06d5621e61c721510c74783fe75b5f8e1e9cf`. Les dépendances du plan sont T28 et
T29. Cette pile ne les déclare pas fusionnées dans `main` et ne constitue pas
une composition du wallet natif.

La [PR #81](https://github.com/PapaAmad/teranga-pay/pull/81) porte le travail et
son état courant de relecture. Les preuves ci-dessous sont rattachées à leurs
commits ou rapports exacts : une réussite antérieure ne valide pas un nouveau
commit. La relecture humaine de Salam et une CI verte sur le dernier commit
restent nécessaires avant toute fusion.

## Périmètre

L’APK isolé `pay.teranga.demo.e2e`, activé par `TERANGA_E2E_BUILD=1`, utilise les
ateliers T14 à T28 déjà validés. L’entrée normale conserve ses fournisseurs.
Maestro 2.12.1 pilote les composants Android installés avec des données fictives.
Le build debug x86_64 charge son JavaScript depuis Metro ; il ne constitue pas
une Release T35 ni un paquet pour le téléphone ARM de PAN.

Les changements mobiles ajoutent des identifiants de champs, la configuration du
paquet isolé et un correctif de rôles accessibles natifs. Aucun nouvel écran ni
changement du rendu n’est ajouté. La réception, l’envoi, l’encaissement, les
retraits Wave/Orange Money et leurs réponses restent simulés. Le reçu historique
préexiste dans une fixture indépendante des autres ateliers.

## État des preuves

| Vérification                                         | Résultat vérifié                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Six contrôles locaux avec l’ajustement de défilement | Passés : 1 117 tests mobiles, 154 tests d’outillage et un cas de lien symbolique ignoré sur Windows.                                        |
| Contrôles qualité CI sur `3dd2347`                   | Verts : format, lint, types, tests, secrets et titre de PR ; les 155 tests d’outillage passent sur Linux.                                   |
| Maestro CI sur `3dd2347`                             | Quatre parcours réussis ensemble, zéro échec, en 378,38 secondes ; dix captures et un relevé natif de quatre cas.                           |
| Préparation du disque dans ce run CI                 | Nettoyage NDK exécuté dans la VM de test ; environ 16,92 Gio avant image et 12,58 Gio avant démarrage, au-dessus des seuils de 13 et 9 Gio. |
| Dernière suite Windows complète                      | Trois cas réussis sur quatre ; le parcours 04 dépasse le délai de défilement vers le bouton de réponse fictive.                             |
| Ajustement Windows                                   | Délai de ce seul défilement porté à 60 secondes ; parcours 04 ciblé réussi en 236,56 secondes. La CI du prochain commit reste à relever.    |
| Paiement du wallet du téléphone                      | Non démontré par ces ateliers ; dépend de la composition native avec Salam.                                                                 |
| Téléphone physique, TalkBack et performance          | Non exécutés par cette preuve ; restent distincts de T30.                                                                                   |

Le contrôle `npm run e2e:check` valide les quatre fichiers avec Maestro 2.12.1,
mais son `syntax.json` conserve `nativeDeviceExecuted: false`. La commande
`npm run e2e:android -- --device emulator-5554` sélectionne les quatre parcours.
Un essai interne ciblé n’atteste que la liste `flows` et le nombre `cases` de son
propre relevé ; il ne vaut pas réussite de la suite complète.

## Réussite Android en CI sur `3dd2347`

Le [run Maestro 43429461356](https://github.com/PapaAmad/teranga-pay/actions/runs/43429461356)
réussit sur la branche au commit `3dd2347812c31917c9891cfb1718b22539dce318`.
Les deux jobs compilent puis installent l’APK fictif et exécutent les quatre
parcours sur l’émulateur Android 35. Le SHA source contrôlé dans les artefacts
est `87b80dbf084105b8d638bdf89fdf047418623b26`, fusion de test dont les parents
sont T28 et `3dd2347` ; son arbre est identique à celui du commit de branche.

Le rapport JUnit du dossier `2026-11-13T13-11-43-105Z` contient quatre cas
réussis, zéro échec, pour 378,38 secondes au total : onboarding fictif,
parcours nominal fictif, envoi à résultat tardif et retrait à résultat tardif.
L’artefact `maestro-android-fictif-43429461356-1` contient les dix captures
demandées et `execution.json` avec `cases: 4`, `nativeDeviceExecuted: true`,
`realWalletUsed: false` et `regtestPaymentProved: false`.

Les relevés disque confirment que `prepare` a retiré les NDK inutilisés dans la
seule VM Linux de test, avec 18 171 133 952 octets disponibles ensuite.
`check-boot` ne supprime rien et mesure 13 508 005 888 octets disponibles après
l’installation de l’image, avant la création de l’AVD. Les deux seuils sont
respectés. La vérification du SHA et des empreintes de l’APK précède son
installation. L’APK privé expire après un jour ; les rapports et captures,
séparés de cet APK, sont conservés sept jours.

Cette preuve porte sur l’interface native fictive et le code exact de ce run.
Elle n’atteste ni un règlement Lightning depuis le téléphone ni les modifications
préparées après `3dd2347`.

## Dernier essai Windows et ajustement ciblé

Le rapport local complet `2026-11-13T12-50-38-378Z` contient quatre cas : 01,
02 et 03 réussissent ; 04 échoue après environ 20 secondes de défilement vers
« Recevoir le résultat fictif ». Le diagnostic montre trois gestes lents ; le
bouton devient visible dans la capture de la dernière étape, après le délai.
Le lanceur conserve un échec et n’écrit pas de relevé de réussite globale.

Le correctif préparé ajoute `timeout: 60000` à ce seul `scrollUntilVisible` du
parcours 04. Il ne modifie ni les assertions du résultat incertain, ni le délai
métier T28, ni l’unique appui de confirmation financière. Le bouton libère la
réponse de la demande initiale ; il ne déclenche pas une deuxième opération.
La relance ciblée `2026-11-13T16-44-16-861Z` réussit : un cas JUnit sans échec,
en 236,56 secondes, et un relevé `execution.json` limité au parcours 04. La CI
du prochain commit doit encore vérifier cet ajustement avec les quatre cas.

L’APK local provient d’un build CI antérieur et charge le JavaScript du poste
depuis Metro. Ce rapport ne remplace donc pas la preuve du SHA exact exécuté
dans GitHub Actions. Aucun rapport Windows unique réussi de quatre cas n’est
annoncé à ce stade, même si chacun des quatre parcours avait déjà réussi dans
des essais locaux distincts.

## Défauts rencontrés et corrections

- Le [premier run CI](https://github.com/PapaAmad/teranga-pay/actions/runs/43326289782)
  compile l’APK en 12 min 49 s, puis remplit le disque en installant l’image
  Android. Aucun scénario n’est exécuté et aucun artefact n’est produit.
- Le [deuxième run CI](https://github.com/PapaAmad/teranga-pay/actions/runs/43332481132)
  sépare compilation et runtime. Le build réussit en 13 min 39 s ; l’émulateur
  refuse encore de démarrer, avec environ 6 421 Mo libres pour 7 373 Mo requis.
  Les diagnostics sont conservés, sans rapport de scénario exécuté.
- Le garde d’espace retire désormais seulement les NDK inutilisés du runner
  GitHub hébergé. Une étape distincte installe le runtime puis exige 9 Gio avant
  l’action émulateur : le hook précédent interceptait son erreur. La demande
  inefficace de partition à 2 048 Mo est retirée ; la RAM demandée est 2 560 Mo.
- Le troisième run révèle qu’un test du garde suppose `.tmp` déjà présent.
  Le test crée désormais son dossier avant `realpath`, comme dans un checkout
  Linux neuf. Cette correction est incluse dans le run réussi sur `3dd2347`.
- Android rejette quinze valeurs `accessibilityRole="status"` dans six
  composants. Elles utilisent désormais `role="status"` et une annonce
  `accessibilityLiveRegion="polite"`, sans changer le rendu ; trois tests
  vérifient ce contrat contre le SDK installé.
- Les aides PIN et certains titres de résultat sortent de la zone visible.
  Les parcours 02 et 03 les font défiler avant leurs assertions, sans retirer
  de contrôle financier.
- Maestro utilise le champ YAML `name` dans un chemin Windows, où `|` est
  interdit. Les quatre fichiers omettent ce champ ; les noms techniques ASCII
  des fichiers servent aux rapports et leurs descriptions restent dans le README.

L’attente initiale de chaque parcours autorise 240 secondes pour le bundle
Metro debug à froid. Un essai local de compilation a pris environ 178 secondes.
Cette marge et le défilement de diagnostic ne modifient pas les délais T28 et
ne mesurent pas le démarrage d’une version de livraison T32.

## Relecture des dépendances

La PR #58 reste au commit `9a15eac69515cc37f54f45f66666fb7b6f7c8095` lors de la
dernière vérification du 13 novembre. Ses huit tests Node passent localement
avec des nœuds remplacés et sa [CI serveur](https://github.com/PapaAmad/teranga-pay/actions/runs/42389586864)
est verte. Une reproduction en mémoire montre cependant qu’une exception de
transport ou `IN_FLIGHT` peut être annoncé comme un refus terminal dans les
cas négatifs. La [demande de correction](https://github.com/PapaAmad/teranga-pay/pull/58#pullrequestreview-5883185477)
reste non résolue. Aucun paiement Docker local ni module natif du téléphone
n’a été exécuté par cette relecture.

La PR #76 reste au commit `9e42c1703e3154a1305a381a73d6ed4facdf819b`, avec deux
demandes de correction non résolues : conservation des reçus réglés lors de la
purge et arrêt après une attente native. La PR #80 reste au commit de base T28
indiqué plus haut, avec la relecture de Salam demandée. T30 ne les déclare ni
approuvées ni intégrées.

Voir le [guide des tests](../guides/tests-maestro.md), la
[décision 0022](../decisions/0022-maestro-et-preuve-native.md) et les
[parcours](../../tests/e2e/README.md).
