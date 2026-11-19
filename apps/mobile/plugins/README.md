# Plugins Expo | Android Windows

PAN maintient ce dossier pour le raccordement T11, issue #120. `with-windows-native.cjs` utilise le mod `withProjectBuildGradle` fourni par `expo/config-plugins`, déjà inclus dans Expo SDK 58. Le plugin ne fait aucune écriture à son chargement : le mod agit pendant le prebuild Android, uniquement sous Windows.

Le bloc Gradle généré couvre l’application et les bibliothèques Android. Il impose `CMAKE_OBJECT_PATH_MAX=240`, place le staging CMake dans `.tmp/cxx/<projet>` à la racine du dépôt et ajoute `--driver-mode=g++` aux derniers `CMAKE_CXX_FLAGS` existants. La borne de 240 laisse à CMake la place de remplacer les chemins sources par leur empreinte ; une borne plus basse peut empêcher ce remplacement lorsque le préfixe du dossier est déjà long. Les autres arguments CMake et indicateurs C++ restent conservés. Le mode C++ explicite évite que l’alias Windows court de `clang++` fasse sélectionner le pilote C lors de l’édition des liens. Ces réglages ne changent ni Expo, ni le SDK Android, ni les dépendances.

L’entrée est déclarée dans [app.config.ts](../app.config.ts). Après une génération Android sous Windows, `npm run mobile:android` réutilise le bloc généré. Un dossier `android` déjà présent doit recevoir un prebuild après l’ajout de ce plugin ; ne pas régénérer pendant une compilation en cours. Aucun effet n’est ajouté lors d’un prebuild sous Linux ou macOS.

Vérification sans prebuild, SDK ou compilation : `node --test scripts/windows-native-plugin.test.mjs` depuis la racine. Les tests couvrent le vrai mod Expo en mémoire, la conservation des réglages Gradle, son remplacement idempotent et l’absence d’effet hors Windows. Le succès d’une compilation native doit être vérifié séparément.

Références : [plugins locaux Expo](https://docs.expo.dev/config-plugins/plugins/), [mods Expo](https://docs.expo.dev/config-plugins/mods/). L’API utilisée est aussi vérifiable dans les sources installées d’`expo/config-plugins`.
