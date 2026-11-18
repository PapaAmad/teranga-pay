# Tests Maestro | T30

PAN porte les parcours mobiles, Salam relit et porte le wallet et le réseau
Lightning. Ce guide concerne l’APK Android de test T30 et ses données fictives.
Il ne remplace pas la composition native T15/T21 ni le paiement regtest T29.

## Ce que ces tests peuvent prouver

Maestro pilote une application installée par sa couche d’accessibilité. Un
parcours exécuté contre cet APK peut donc prouver la navigation et les interactions
réelles de l’interface Android. Il utilise cependant les ateliers isolés déjà
validés en T14 à T28 : les soldes, factures et résultats y restent fictifs.

| Contrôle                                        | Preuve apportée                                                                                        | Ce qu’il ne prouve pas                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `npm run e2e:check`                             | Identité des parcours, version exacte de Maestro et validation de syntaxe des quatre fichiers.         | Une application lancée ou un scénario réussi sur Android.        |
| `npm run e2e:build:android`                     | Si la compilation réussit, APK debug Android avec l’identifiant de test isolé.                         | Un APK installé ou un test Maestro exécuté.                      |
| `npm run e2e:android -- --device emulator-5554` | Si l’exécution réussit, commandes Maestro sur le paquet de test installé et assertions de l’interface. | Un vrai wallet LDK relié à ces écrans ou un règlement Lightning. |
| T29 sur deux nœuds LND                          | Paiements et vérifications serveur sur regtest.                                                        | Le parcours du wallet du téléphone dans l’APK T30.               |

Le [suivi T30](../planning/suivi-t30.md) consigne les commandes effectivement
exécutées et leurs résultats. Un fichier YAML présent, un contrôle de syntaxe ou
un paquet JavaScript fourni par Metro ne doivent jamais être annoncés comme un
test Maestro Android réussi.

Le [run CI 43429461356](https://github.com/PapaAmad/teranga-pay/actions/runs/43429461356)
a exécuté les quatre parcours ensemble avec succès au commit `3dd2347` :
quatre cas JUnit, zéro échec, 378,38 secondes et dix captures. Son relevé
confirme une interface Android installée, avec `realWalletUsed: false` et
`regtestPaymentProved: false`. Cette preuve reste liée à ce commit ; consulter
la [PR #81](https://github.com/PapaAmad/teranga-pay/pull/81) pour l’état courant
et le suivi pour les ajustements postérieurs.

## Prérequis

- Node et npm aux versions du dépôt, puis `npm ci` depuis la racine.
- JDK **21** pour la compilation Android du projet, avec `JAVA_HOME` configuré.
  Maestro seul accepte Java 17 ou plus récent ; le banc complet utilise Java 21.
- SDK Android avec la plateforme et les outils de compilation requis par React
  Native, licences acceptées, `adb` et un émulateur Android x86_64 démarré. Avec
  le SDK Expo 58 verrouillé ici : compilation API 37, build-tools 37.0.0 et
  NDK 27.1.12297006. Définir `ANDROID_HOME` vers le dossier du SDK. Le
  workflow utilise une image Google APIs Android 35. Les chemins et les projets
  Android générés restent locaux ; ne pas les committer.
- Maestro **2.12.1**. L’archive retenue a l’empreinte SHA256
  `54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7`.
- L’APK debug construit avec `TERANGA_E2E_BUILD=1`, installé dans l’émulateur.
- Metro actif sur le port 8081 pour fournir le JavaScript de ce build debug.

Depuis la racine, `npm run e2e:install` télécharge l’archive Maestro épinglée,
vérifie son SHA256 avant extraction et installe le CLI sous
`.tmp/tooling/maestro/2.12.1`. Cette commande ne modifie pas le `PATH` global et
n’ajoute aucune dépendance au bundle mobile. Elle nécessite un accès réseau,
ainsi que PowerShell sous Windows ou `unzip` sous Linux/macOS.

Le lanceur accepte aussi `MAESTRO_BIN` et `ADB_BIN` pour désigner des exécutables
installés localement ; il exige toujours Maestro 2.12.1. Ces variables ne
contiennent aucune clé et ne modifient pas l’identité du paquet à tester.
`adb` doit sinon être disponible dans `PATH`.

Exemple PowerShell avec des chemins d’outils déjà installés, à adapter :

```powershell
$env:JAVA_HOME = 'C:\outils\jdk-21'
$env:ANDROID_HOME = 'C:\outils\android-sdk'
$env:ADB_BIN = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
```

`ADB_BIN` configure le lanceur Node ; pour les commandes manuelles `adb install`,
ajouter aussi `platform-tools` au `PATH` du terminal ou appeler cet exécutable
par son chemin complet. Aucun réglage global n’est requis.

La documentation officielle décrit une installation Windows directe ; WSL n’est
pas requis pour ce choix. Voir [installer Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli),
la [cible Android](https://docs.maestro.dev/get-started/supported-platform/android)
et les [applications React Native](https://docs.maestro.dev/get-started/supported-platform/react-native).
Sources consultées le 12 novembre 2026. Les prérequis peuvent évoluer ; la version
et l’empreinte retenues par le dépôt restent explicites.

## Construire et installer le paquet isolé

L’identifiant Android de test est **`pay.teranga.demo.e2e`**. Il est sélectionné
uniquement lorsque `TERANGA_E2E_BUILD=1` configure le build. Les parcours ne doivent
jamais être dirigés vers un wallet personnel ni vers le conteneur Expo Go.

Depuis la racine, avec les prérequis Android déjà installés :

```sh
npm run e2e:install
npm run e2e:check
npm run e2e:build:android
adb devices
adb -s emulator-5554 install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Le script de compilation active lui-même `TERANGA_E2E_BUILD=1`, génère Android
avec Expo puis assemble l’APK debug x86_64. Il conserve les scripts Expo Go du
manifeste et refuse une modification inattendue de ses dépendances. Le projet
Android généré est ignoré par Git. Ne pas ajouter ses fichiers pour contourner un
échec de génération. La compilation doit terminer avec un code de sortie nul
avant l’installation ; `e2e:build:android` n’installe ni ne lance l’application.

Remplacer `emulator-5554` par l’identifiant exact affiché par `adb devices` si
nécessaire. Le lanceur vérifie que le paquet de test est installé avant toute
remise à zéro. En l’absence de `--device`, il exige un unique émulateur prêt.
Les commandes Maestro de nettoyage effacent les données de ce paquet isolé ;
elles ne sont pas une procédure de réinitialisation d’un wallet réel.

L’APK produit ici et l’artefact CI sont **x86_64**, destinés à l’émulateur. Ils
ne s’installent pas sur un téléphone Android ARM classique. Le lanceur accepte
un appareil physique uniquement avec un `--device` explicite, mais il faudrait
préparer séparément un APK compatible et conserver le paquet isolé. T30
n’ajoute pas ce support ARM ; la vérification sur le téléphone de PAN et T32
restent à réaliser séparément.

## Exécuter les parcours

Depuis la racine, laisser Metro disponible dans un terminal dédié :

```powershell
npm run start --workspace @teranga-pay/mobile -- --lan --port 8081
```

Dans un autre terminal, vérifier d’abord les parcours, puis lancer le test sur
un seul émulateur explicitement choisi :

```powershell
npm run e2e:check
npm run e2e:android -- --device emulator-5554
```

Le port 8081 du téléphone ou de l’émulateur doit atteindre Metro. Le lanceur
vérifie son état local, puis configure le relais
`adb -s emulator-5554 reverse tcp:8081 tcp:8081` pour cette liaison.
Un émulateur portant un autre identifiant doit être sélectionné explicitement ;
ne pas remplacer le paquet de test par celui d’une autre application.

Le build debug conserve `__DEV__` et l’accès aux aperçus existants. Les fichiers
de parcours sont dans [tests/e2e/flows](../../tests/e2e/flows/README.md).
Ils doivent sélectionner les données d’atelier, vérifier les états affichés et
ne pas transformer une simple attente ou une issue inconnue en succès.

Les rapports JUnit et diagnostics locaux appartiennent à `.tmp/e2e`, ignoré par
Git. Le contrôle de syntaxe écrit `syntax.json` avec
`nativeDeviceExecuted: false`. L’exécution Android n’écrit `execution.json`
qu’après un rapport JUnit réussi comprenant tous les cas sélectionnés, sans
échec, erreur ou cas ignoré. La commande CLI normale
`npm run e2e:android -- --device emulator-5554` sélectionne les **quatre**
fichiers. Les essais internes ciblés peuvent fournir une liste réduite au
lanceur pour diagnostiquer un parcours : leur relevé indique alors cette liste
dans `flows` et le nombre exact dans `cases`. Un relevé de deux cas réussis
ne valide pas la suite complète de quatre. Le relevé conserve
`realWalletUsed: false` et
`regtestPaymentProved: false`. Les captures ne doivent contenir ni donnée de
compte réel, ni PIN ou phrase de récupération personnelle.

Les quatre parcours couvrent l’onboarding fictif, les écrans du parcours nominal,
un résultat d’envoi tardif et un résultat de retrait simulé tardif. Ils utilisent
un code inventé et les jetons `exemple01` à `exemple12`. Les fournisseurs des
ateliers sont indépendants : le reçu du journal de démonstration préexiste dans
sa fixture et ne prouve pas l’enregistrement d’une opération des autres écrans.

La première disponibilité de l’écran après `launchApp` peut attendre jusqu’à
240 secondes : un build debug charge son bundle depuis Metro, avec une
compilation JavaScript à froid. Cette marge concerne uniquement le chargement
initial des quatre parcours. Elle n’allonge pas les délais financiers T28 et ne
mesure pas le temps d’ouverture d’une version de livraison pour T32.

Le dernier essai complet Windows a réussi trois parcours sur quatre : le
dernier a dépassé le délai par défaut de 20 secondes en faisant défiler vers
« Recevoir le résultat fictif ». Le correctif préparé borne ce seul
`scrollUntilVisible` à 60 secondes pour laisser les gestes lents atteindre le
bouton. Il ne modifie aucune assertion ni attente métier T28. Le parcours 04
ciblé réussit ensuite en 236,56 secondes ; la CI du prochain commit reste à
confirmer. Un rapport local de trois cas
réussis ne doit pas être présenté comme une suite de quatre réussie.

## Exécution dans GitHub Actions

Le workflow [Maestro](../../.github/workflows/maestro.yml) utilise deux jobs
Ubuntu 24.04 sur deux machines virtuelles fraîches. `build` compile l’APK debug
x86_64 ; `android`, qui dépend de sa réussite, prépare l’émulateur et exécute les
parcours. La compilation native et l’image de l’émulateur ne s’accumulent ainsi
pas sur le même disque. Les deux jobs récupèrent exactement `github.sha`, qui
désigne la fusion de test pour un événement de PR.

Le premier job transmet un artefact nommé `maestro-apk-fictif-<run_id>` contenant
uniquement `app-debug.apk`, `source.sha` et `SHA256SUMS`. Il reste accessible dans
le dépôt privé pendant **un jour** ; `overwrite: true` permet de le remplacer
lors d’une relance complète du même run. Le second job le récupère avec
`actions/download-artifact@v4`, vérifie les empreintes et compare `source.sha`
à son propre checkout et à `GITHUB_SHA` avant l’installation. Cette action est
un outil de transfert entre jobs et n’ajoute rien au bundle mobile.

Le job `android` appelle `node scripts/android-e2e-space.mjs prepare` avant
l’installation de l’image. Ce mode est réservé à Linux sur un runner GitHub
hébergé, avec `ANDROID_HOME` exactement égal à
`/usr/local/lib/android/sdk`. Le script vérifie les chemins canoniques du SDK
et de son dossier `ndk` avant de retirer uniquement les NDK préinstallés,
inutilisés dans cette VM de test. Il relève ensuite l’espace et exige au moins
**13 Gio** libres. Il ne s’exécute pas dans le job de compilation, qui a besoin
du NDK.

Une étape GitHub distincte installe explicitement les cinq paquets nécessaires
au runtime : build-tools 37.0.0, platform-tools, plateforme Android 35,
émulateur et image Google APIs Android 35 x86_64. Elle crée le dossier
`ANDROID_AVD_HOME=/home/runner/.android/avd`, puis appelle
`node scripts/android-e2e-space.mjs check-boot` avant l’action qui créera et
lancera l’AVD. Ce mode ne supprime rien : il mesure le système de fichiers du
dossier et exige encore **9 Gio** libres. Un échec arrête cette étape et
empêche le lancement de l’action émulateur. Celle-ci retrouve ensuite les mêmes
paquets déjà installés ; aucun hook de pré-lancement n’est utilisé pour ce
garde. Les relevés JSON sont conservés
dans les diagnostics. Ces deux commandes refusent un contexte local, Windows,
un runner autohébergé ou un SDK différent ; elles ne sont pas une procédure de
nettoyage à lancer sur le poste de développement.

L’émulateur demande **2 560 Mo de RAM**. La taille de la partition de données
reste déterminée par l’image Android ; le paramètre auparavant demandé à
2 048 Mo n’a pas réduit le besoin réel de l’image et a été retiré. Les limites
restent de 35 minutes pour `build` et de 30 minutes pour `android`. Un échec de
préparation du disque ou de démarrage de l’AVD ne constitue pas un scénario
Maestro exécuté.

Les rapports, captures et journaux de `.tmp/e2e/` sont un artefact distinct,
conservé **sept jours**, sans copie de l’APK. Les fichiers de coffre, keystore et
SDK ne sont pas téléversés. L’APK debug ne constitue pas la Release T35 ni son
canal de distribution. Une réussite de compilation ou un transfert d’artefact
ne prouvent pas qu’un scénario a été exécuté ; consulter les deux jobs, le
rapport JUnit et le [suivi T30](../planning/suivi-t30.md).

## Diagnostic

| Situation                       | Action utile                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Java ou Maestro absent          | Installer les versions documentées ou renseigner les chemins locaux, puis relancer le contrôle.                                         |
| Aucun émulateur prêt            | Démarrer la cible Android, vérifier sa présence dans ADB et sélectionner son identifiant.                                               |
| Disque du runner insuffisant    | Lire les relevés `disk-prepare.json` et `disk-check-boot.json` ; conserver les seuils de 13 Gio avant image et 9 Gio avant démarrage.   |
| Préparation d’espace refusée    | Vérifier le contexte GitHub hébergé et le chemin du SDK ; ne pas adapter le script pour purger un SDK local ou un runner autohébergé.   |
| Artefact APK absent ou expiré   | Relancer le workflow complet afin de reconstruire et transmettre l’APK correspondant au même SHA ; ne pas substituer un APK local.      |
| Mauvais paquet ou APK absent    | Reconstruire avec `TERANGA_E2E_BUILD=1` et installer `pay.teranga.demo.e2e` ; ne pas désactiver la garde du lanceur.                    |
| Écran de connexion à Metro      | Vérifier Metro, le port 8081 et le relais ADB. Cela n’indique pas une erreur du paiement Lightning.                                     |
| Alerte du pare-feu pour ADB     | Vérifier le chemin du SDK Android utilisé. Le serveur ADB local utilise le port 5037 ; ne pas désactiver le pare-feu pour ce banc.      |
| Assertion absente ou différente | Lire le diagnostic du scénario et vérifier l’état réel de l’interface. Ne pas supprimer l’assertion ni ajouter un faux résultat réussi. |
| Résultat financier incertain    | Vérifier la barrière et le suivi de la même demande ; ne pas préparer une seconde opération pour faire passer le test.                  |

## Limites de la preuve financière

La dépendance T29 a une [exécution serveur verte](https://github.com/PapaAmad/teranga-pay/actions/runs/42389586864)
au commit `9a15eac69515cc37f54f45f66666fb7b6f7c8095`. Elle ne relie pas à elle seule
les écrans mobiles au wallet du téléphone. La validation mobile financière
nécessitera la composition avec Salam, le financement du canal du téléphone et
une preuve de réception/paiement issue de ce wallet.

Les corrections demandées sur la PR #76 et la classification des refus du test
T29 restent à suivre dans leurs branches. Les tests T30 d’interface n’approuvent
pas ces implémentations et ne les déclarent pas intégrées. Voir la
[décision 0022](../decisions/0022-maestro-et-preuve-native.md).
