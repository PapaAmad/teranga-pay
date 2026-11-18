# Scripts du dépôt

`operator-logos.test.mjs` vérifie les empreintes des ressources T25 et l’identité
du SVG utilisé par le composant avec son original conservé. Il s’exécute dans
`npm run test:tooling`, sans ajouter de dépendance Node au projet mobile.

`check-repository.mjs` vérifie la documentation de chaque dossier maintenu et les liens relatifs écrits en syntaxe Markdown, hors exemples de code et commentaires HTML. `markdown-it` interprète notamment les références et les images Markdown ; les attributs du HTML brut (`<a href>`, `<img src>`) ne sont pas vérifiés. Aucun HTML n'est rendu ou exécuté. Cette dépendance est réservée au développement, selon la [décision 0005](../docs/decisions/0005-parseur-markdown.md).

Les exclusions Git sont respectées ; hors dépôt Git, les exclusions prédéfinies sont signalées. Les chemins sont comparés en NFC, sans remplacer leurs noms physiques. Les README qui sont des liens symboliques vers des fichiers sont acceptés, sans traverser les liens de dossiers ni les gitlinks de sous-modules.

L'arbre réservé `.github` utilise `GUIDE.md`, sauf `ISSUE_TEMPLATE` qui utilise `GUIDE.txt`. Le script refuse les README documentaires dans cet arbre, afin de préserver l'accueil du projet et le sélecteur de modèles ; un workflow `readme.yml` reste autorisé. Lancer `npm run repo:check` depuis la racine ; `npm run test:tooling` exécute aussi ses tests de non-régression.

`github/` contient la préparation du dépôt distant, ses réglages, labels et issues. Ces outils restent en prévisualisation tant qu'une application explicite n'est pas demandée.

## Piloter Android avec Maestro | T30

`npm run e2e:install` utilise `install-maestro.mjs` pour télécharger Maestro
2.12.1, vérifier le SHA256 de l’archive avant extraction et le conserver dans
`.tmp/tooling`. Java et les outils Android restent des prérequis externes ;
aucune dépendance n’est ajoutée au bundle mobile ni au `PATH` global.

`npm run e2e:check` lance `mobile-e2e.mjs check` : le script vérifie la version
du CLI, le paquet déclaré dans les quatre parcours et leur syntaxe Maestro.
Il ne lance pas d’appareil. `npm run e2e:build:android` utilise
`build-mobile-e2e.mjs` pour générer et compiler un APK debug x86_64 portant
l’identifiant isolé `pay.teranga.demo.e2e`, sans l’installer.

Après installation explicite de cet APK et démarrage de Metro sur le port 8081,
`npm run e2e:android -- --device emulator-5554` vérifie la cible et le paquet
installé, établit le relais ADB et exécute les quatre parcours fictifs. Un rapport
JUnit complet et réussi pour la sélection est requis avant le relevé de succès ;
la syntaxe seule ou un cas ignoré ne suffisent pas. Les essais internes ciblés
du lanceur conservent leur liste `flows` et leur nombre `cases` dans le relevé ;
deux cas réussis n’y prouvent pas une suite de quatre. Les rapports restent dans `.tmp/e2e`, ignoré.
Les tests Node de ces scripts participent à `npm run test:tooling`.

`android-e2e-space.mjs` prépare uniquement le job Android d’une VM Linux GitHub
hébergée, avec le SDK canonique `/usr/local/lib/android/sdk`. Le mode `prepare`
retire ses NDK préinstallés inutilisés par les tests, sans toucher au job de
compilation, puis exige 13 Gio libres avant l’image Android. Le mode
`check-boot`, appelé dans une étape GitHub distincte après installation de
l’image et création du dossier `ANDROID_AVD_HOME`, ne supprime rien et exige
9 Gio sur son système de fichiers. Son échec bloque cette étape avant l’action
émulateur ; le contrôle n’utilise pas son hook de pré-lancement. Les autres
contextes, dont Windows
local et les runners autohébergés, sont refusés. Ce script ne sert pas à nettoyer
un SDK de développement. Ses tests vérifient ces refus, le périmètre de
suppression et les deux seuils ; les relevés vont dans `.tmp/e2e`.

Le [guide Maestro](../docs/guides/tests-maestro.md) décrit les prérequis JDK 21,
Android et les commandes. Le [suivi T30](../docs/planning/suivi-t30.md) consigne
les exécutions réelles. Ces parcours de composants natifs utilisent les ateliers
de démonstration ; ils ne prouvent pas un paiement du wallet du téléphone.

`brand-colors.mjs` définit les 18 couples fonctionnels de la charte : 12 paires de texte à 4,5:1 et 6 indices graphiques à 3:1, dont la sélection Android. `node scripts/export-brand-contrast.mjs` régénère `assets/brand/contrast.json` depuis les tokens, avec les couleurs exactes, les ratios non arrondis et les seuils. La sortie est reproductible sans date variable, sans appel réseau et sans dépendance ajoutée ; une paire insuffisante produit un code de sortie 1.

`brand.test.mjs` compare le rapport livré au calcul courant pour détecter un rapport périmé, vérifie les bornes et seuils du calcul ainsi que la cohérence des SVG. Il contrôle aussi les tailles et SHA-256 des trois polices et deux licences livrées, selon le manifeste des sources : aucun nettoyage des fichiers de licence n'est autorisé par ces tests. Lancer `npm run test:tooling` ; ces vérifications ne constituent pas une certification d'accessibilité de l'application.

`subset-brand-fonts.py` produit les deux sous-ensembles Noto avec Python et FontTools 4.68.0 fournis séparément. Il exige les originaux dont les SHA-256 sont épinglés, conserve les plages latines, contrôle les glyphes requis et leurs avances, puis actualise le manifeste et le relevé de glyphes. Aucun téléchargement automatique ; voir la [reproduction des polices](../assets/brand/fonts/README.md). La commande n'appartient pas au démarrage ni au bundle mobile.

## Vérifier les textes mobiles | T09

`npm run i18n:check` analyse `apps/mobile/App.tsx` et les sources TypeScript et JavaScript de `apps/mobile/src` avec l'AST du compilateur TypeScript. La racine déclare directement TypeScript 6.0.3 en dépendance de développement, à la même version que le workspace mobile. `repo:check` exécute aussi le garde, donc la CI existante conserve ce contrôle. PAN porte T09 ; Salam relit.

Le garde refuse les textes JSX, les chaînes directement affichées dans les enfants JSX et les libellés visibles ou accessibles écrits en dur, dont `aria-label`, `children` et `accessibilityValue.text`. Il examine les titres et `tabBarLabel` des options de navigation, les messages et boutons de `Alert.alert`, ainsi que les messages des méthodes `ToastAndroid.show`, `showWithGravity` et `showWithGravityAndOffset`. Ces appels sont reconnus depuis leurs imports React Native et leurs alias ; les arguments techniques et les fonctions homonymes restent autorisés.

Les imports directs des catalogues français/wolof sont contrôlés avec ou sans extension TypeScript ou JavaScript, y compris les réexports et les appels `import()` ou `require()`. Les parenthèses, assertions, concaténations, branches conditionnelles et gabarits ne masquent pas les chaînes affichées. Seuls les dossiers `src/translations`, `src/tests`, les dossiers `__tests__`, déclarations de types et fichiers de test sont exclus ; un dossier fonctionnel imbriqué nommé `translations` ou `tests` reste contrôlé. Les identifiants techniques de routes, rôles accessibles et styles restent autorisés. Les diagnostics donnent fichier et emplacement sans recopier le texte.

Ce contrôle ciblé n'est pas une analyse complète des flux de données : il ne détermine pas l'origine d'un texte placé dans une variable ou renvoyé par une fonction quelconque. Les valeurs de données telles que les montants et codes de couleur restent autorisées. La revue humaine et les tests du changement de langue complètent cette limite. `npm run test:tooling` exerce les régressions sur des fixtures isolées, sans modifier les sources mobiles.

## Reproduire les exports T08

`npm run brand:build` régénère les 16 SVG d’icônes et le rapport des 18 couples de contraste sans réseau ni outil externe. `npm run brand:contrast` et `npm run brand:icons` restent disponibles séparément. `npm run test:tooling` détecte les sources graphiques ou rapports périmés et les fichiers de police ou de licence altérés.

Les exports de présentation utilisent des outils de développement externes déjà installés : Chromium/Edge et le module Puppeteer ; FFmpeg s’ajoute pour les vidéos. Ces outils ne sont ni des dépendances mobiles ni téléchargés automatiquement par les scripts. Fournir leurs chemins explicitement, entre guillemets s’ils contiennent des espaces :

```sh
npm run brand:document -- --browser "chemin/Chromium" --puppeteer-module "chemin/puppeteer.js"
npm run brand:motion -- --browser "chemin/Chromium" --puppeteer-module "chemin/puppeteer.js" --ffmpeg "chemin/ffmpeg" --format portrait
```

`--help` décrit les options, dont `--output` pour une sortie distincte. Le document produit PNG, PDF et un relevé `validation.json` lié au SHA-256 du HTML ; il vérifie les erreurs navigateur, la composition imprimée et l’absence de débordement à 390 px. Document et motion exigent les faces attendues dans l'état `loaded` et refusent une ressource indisponible avant les exports ; un repli disponible ne suffit pas. Le rendu motion vérifie aussi la géométrie finale, le format et le décodage de la vidéo. Une génération documentaire ne valide ni le clavier natif, ni TalkBack, ni un paiement réel.
