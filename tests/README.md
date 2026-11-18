# Tests transversaux

Ce dossier accueille les scénarios traversant plusieurs composants. Les tests unitaires restent proches du code qu'ils vérifient ; ils ne nécessitent pas une copie centralisée.

Salam porte l’intégration regtest **T29** et PAN les parcours mobiles **T30**,
avec relecture croisée. [e2e](e2e/README.md) contient les quatre parcours Maestro
des ateliers fictifs sur un APK Android de test isolé. Lancer
`npm run e2e:check` depuis la racine pour leur syntaxe ; le
[guide Maestro](../docs/guides/tests-maestro.md) décrit le banc Android nécessaire
à `npm run e2e:android -- --device emulator-5554`.

La présence des parcours ne vaut pas preuve d’exécution native. Le
[suivi T30](../docs/planning/suivi-t30.md) donne les résultats observés et leurs
limites. Une réussite de ces ateliers ne prouve pas l’intégration financière du
wallet du téléphone ni un règlement Lightning ; le test serveur regtest T29
reste une vérification distincte.

Les vérifications du socle se lancent depuis la racine avec les commandes du [guide de démarrage](../docs/guides/demarrage.md).
