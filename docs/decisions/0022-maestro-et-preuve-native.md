# 0022 | Maestro et portée de la preuve Android

Créée le 12 novembre 2026, actualisée le 13 novembre 2026 | T30 | proposition
de PAN, à relire par Salam.

## Problème

T30 demande un parcours reproductible sur l’application installée. Les preuves
Web et Jest des tâches précédentes ne vérifient pas la présentation Android.
Cependant, la pile mobile n’a pas encore composé le wallet LDK et les services
natifs portés par Salam ; un test d’atelier ne peut pas tenir lieu de paiement
regtest depuis le téléphone.

## Choix

Ajouter des parcours Maestro visant un APK Android debug isolé, identifié par
`pay.teranga.demo.e2e` et construit avec `TERANGA_E2E_BUILD=1`. Ce paquet utilise
les aperçus déjà validés, avec des données fictives, sans modifier la navigation
normale pour y simuler un wallet. Le mode debug conserve `__DEV__` et charge son
JavaScript depuis Metro sur le port 8081.

Retenir Maestro 2.12.1 et vérifier l’archive par SHA256 avant son extraction dans
`.tmp/tooling`. Le banc utilise JDK 21 pour compiler Android. Maestro et Java
restent des outils de test externes : aucun SDK de test n’est injecté dans le bundle.
Le lanceur vérifie la cible et l’identité du paquet avant toute remise à zéro.
Il distingue le contrôle de syntaxe du test Android et exige un rapport JUnit
complet pour la sélection exécutée, sans échec ni cas ignoré, avant d’écrire un
relevé d’exécution réussie. La commande CLI sélectionne les quatre parcours ;
un essai interne ciblé conserve sa liste et son nombre de cas, sans valider les
autres fichiers.
Les rapports et diagnostics sont conservés dans un dossier local ignoré.

Les scripts `e2e:install`, `e2e:check`, `e2e:build:android` et `e2e:android`
exposent la même préparation en local et dans le workflow Maestro. Le build
produit un APK debug x86_64 ; l’installation dans la cible reste explicite.
Aucun écran nouveau n’est ajouté. Des identifiants techniques de champs
permettent à Maestro de viser leurs entrées natives. Le premier essai local a
aussi révélé une valeur `accessibilityRole="status"` incompatible avec le SDK
React Native utilisé : le correctif conserve le sens accessible via
`role="status"` et `accessibilityLiveRegion="polite"`, sans changer le rendu.

Le premier essai CI a compilé l’APK, puis saturé le disque en préparant l’image
Android. Séparer désormais la compilation et les tests dans deux jobs sur des
machines virtuelles fraîches : `android` dépend de `build`. Les deux checkouts
visent `github.sha`. La sortie de compilation transmise contient l’APK debug,
le SHA source et leurs empreintes ; le job Android contrôle l’ensemble avant
l’installation. Le nom de cet artefact utilise le `run_id` et son remplacement
est permis pour une relance complète du même run.

L’artefact APK reste privé et expire au bout d’un jour. Les diagnostics sans APK
restent séparés pendant sept jours. `actions/download-artifact@v4` est ajouté
comme outil de CI pour ce transfert contrôlé ; aucune dépendance de production
n’est ajoutée.

Le second essai CI a installé l’image, mais son besoin réel de partition de
données dépassait l’espace restant. Retirer le paramètre de partition à 2 048 Mo,
ineffectif avec cette image, et demander 2 560 Mo de RAM conformément au minimum
observé. Préparer l’espace uniquement dans la VM Android GitHub hébergée : le
script refuse les autres contextes et exige le SDK canonique
`/usr/local/lib/android/sdk`. Son mode `prepare` retire uniquement le dossier
des NDK préinstallés inutilisés par ce job puis exige 13 Gio libres avant
l’image. Une étape GitHub distincte installe les cinq paquets du runtime
Android puis crée le dossier `ANDROID_AVD_HOME` et appelle `check-boot`.
Ce mode ne supprime rien et exige 9 Gio libres sur le système de fichiers du
dossier avant la création et le lancement de l’AVD. L’étape échoue de façon
bloquante avant l’action émulateur si le seuil n’est pas atteint. Le hook
`pre-emulator-launch-script` est écarté, car l’action intercepte son échec et
continue son lancement. Aucun NDK du job de compilation ni SDK local ne fait
partie de ce nettoyage.

Les parcours omettent le champ YAML `name` : Maestro 2.12.1 l’emploie dans un
chemin de dossier et le séparateur `|` n’y est pas accepté sous Windows. Les
noms techniques ASCII des fichiers servent donc aux rapports ; les descriptions
françaises restent dans le README des parcours.

Séparer trois résultats : validation des fichiers de parcours, exécution Maestro
sur un paquet installé, puis validation financière du wallet du téléphone.
Une réussite à un niveau ne vaut pas réussite aux niveaux suivants. Le suivi
conserve les prérequis manquants et les exécutions réellement observées, y compris
l’absence de preuve Android lorsqu’un test n’a pas pu être lancé.

## Dépendances et garde des clés

T29 vérifie deux nœuds LND dans Docker. L’outil `phone.mjs` de cette pile prépare
un canal privé vers le téléphone et peut faire payer une facture du téléphone
par diaspora. Il suppose que le wallet natif du téléphone est composé et déjà
connecté. Les certificats, cookies et macaroons du serveur ne sont pas des
paramètres à embarquer dans l’APK Maestro.

Les PR de Salam restent séparées et soumises à relecture. La PR #76 comporte des
demandes de correction sur la conservation des reçus et l’arrêt d’une écoute.
La relecture T29 vérifie aussi qu’un refus attendu ne soit pas confondu avec une
exception de transport ou un statut `IN_FLIGHT`. Les scripts et ateliers T30 ne
prétendent pas corriger ou intégrer silencieusement ces dépendances.

## Solutions écartées

- Annoncer une validation Android après un simple contrôle de syntaxe YAML.
- Assimiler les réponses d’atelier à un vrai paiement regtest du téléphone.
- Effacer les données d’un paquet personnel pour faciliter la reproduction.
- Ajouter un wallet de façade à l’entrée normale pour faire passer les tests.
- Exiger un compte EAS Cloud ou des jetons de service pour cette vérification.
- Copier les macaroons LND ou une phrase de récupération dans les données de test.
- Conserver compilation et émulateur sur un disque déjà saturé ou effacer le
  constat de cette saturation en annonçant les parcours réussis.

## Conséquences

Les parcours peuvent contrôler la navigation, la saisie et les états des vrais
composants Android, avec des fixtures explicitement fictives. La première
validation financière de bout en bout restera une preuve distincte, après
composition avec Salam et contrôle du réseau regtest. Ni l’APK debug ni ses
rapports ne constituent une Release signée T35 ou un essai sur téléphone modeste
T32.

L’attente initiale de chaque parcours autorise 240 secondes pour la compilation
Metro à froid du build debug. Les attentes métier restent inchangées. Cette
marge ne constitue pas une mesure de performance et ne valide pas l’objectif
de démarrage sur téléphone modeste de T32.

Le [run CI 43429461356](https://github.com/PapaAmad/teranga-pay/actions/runs/43429461356)
valide ce banc sur `3dd2347` : les quatre parcours Android réussissent ensemble,
en 378,38 secondes, avec dix captures et un relevé d’exécution native fictive.
Les gardes disque et les vérifications d’identité de l’APK réussissent aussi.
Cette observation valide l’interface sur ce commit, sans paiement du wallet du
téléphone ni validation d’un commit postérieur.

Le dernier essai Windows complet conserve trois réussites et un échec de
défilement du parcours 04. Le correctif préparé donne 60 secondes au seul
défilement vers le bouton libérant sa réponse fictive. Les assertions du
résultat incertain et les délais métier T28 restent inchangés. Sa relance ciblée
réussit avec un cas JUnit sans échec en 236,56 secondes ; la CI du prochain
commit doit encore vérifier les quatre parcours. Le
[suivi T30](../planning/suivi-t30.md) conserve les rapports exacts et la
[PR #81](https://github.com/PapaAmad/teranga-pay/pull/81) l’état courant de la
relecture.

Voir le [guide Maestro](../guides/tests-maestro.md) et le
[suivi T30](../planning/suivi-t30.md). La
[documentation Maestro React Native](https://docs.maestro.dev/get-started/supported-platform/react-native)
distingue notamment le lancement d’Expo Go et celui d’un paquet installé ; le
choix du paquet isolé est celui de l’équipe pour T30.
