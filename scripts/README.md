# Scripts du dépôt

`check-repository.mjs` vérifie la documentation de chaque dossier maintenu et les liens relatifs écrits en syntaxe Markdown, hors exemples de code et commentaires HTML. `markdown-it` interprète notamment les références et les images Markdown ; les attributs du HTML brut (`<a href>`, `<img src>`) ne sont pas vérifiés. Aucun HTML n'est rendu ou exécuté. Cette dépendance est réservée au développement, selon la [décision 0005](../docs/decisions/0005-parseur-markdown.md).

Les exclusions Git sont respectées ; hors dépôt Git, les exclusions prédéfinies sont signalées. Les chemins sont comparés en NFC, sans remplacer leurs noms physiques. Les README qui sont des liens symboliques vers des fichiers sont acceptés, sans traverser les liens de dossiers ni les gitlinks de sous-modules.

L'arbre réservé `.github` utilise `GUIDE.md`, sauf `ISSUE_TEMPLATE` qui utilise `GUIDE.txt`. Le script refuse les README documentaires dans cet arbre, afin de préserver l'accueil du projet et le sélecteur de modèles ; un workflow `readme.yml` reste autorisé. Lancer `npm run repo:check` depuis la racine ; `npm run test:tooling` exécute aussi ses tests de non-régression.

`github/` contient la préparation du dépôt distant, ses réglages, labels et issues. Ces outils restent en prévisualisation tant qu'une application explicite n'est pas demandée.

`brand-colors.mjs` définit les 18 couples fonctionnels de la charte : 12 paires de texte à 4,5:1 et 6 indices graphiques à 3:1, dont la sélection Android. `node scripts/export-brand-contrast.mjs` régénère `assets/brand/contrast.json` depuis les tokens, avec les couleurs exactes, les ratios non arrondis et les seuils. La sortie est reproductible sans date variable, sans appel réseau et sans dépendance ajoutée ; une paire insuffisante produit un code de sortie 1.

`brand.test.mjs` compare le rapport livré au calcul courant pour détecter un rapport périmé, vérifie les bornes et seuils du calcul ainsi que la cohérence des SVG. Il contrôle aussi les tailles et SHA-256 des trois polices et deux licences livrées, selon le manifeste des sources : aucun nettoyage des fichiers de licence n'est autorisé par ces tests. Lancer `npm run test:tooling` ; ces vérifications ne constituent pas une certification d'accessibilité de l'application.

`subset-brand-fonts.py` produit les deux sous-ensembles Noto avec Python et FontTools 4.68.0 fournis séparément. Il exige les originaux dont les SHA-256 sont épinglés, conserve les plages latines, contrôle les glyphes requis et leurs avances, puis actualise le manifeste et le relevé de glyphes. Aucun téléchargement automatique ; voir la [reproduction des polices](../assets/brand/fonts/README.md). La commande n'appartient pas au démarrage ni au bundle mobile.

## Reproduire les exports T08

`npm run brand:build` régénère les 16 SVG d’icônes et le rapport des 18 couples de contraste sans réseau ni outil externe. `npm run brand:contrast` et `npm run brand:icons` restent disponibles séparément. `npm run test:tooling` détecte les sources graphiques ou rapports périmés et les fichiers de police ou de licence altérés.

Les exports de présentation utilisent des outils de développement externes déjà installés : Chromium/Edge et le module Puppeteer ; FFmpeg s’ajoute pour les vidéos. Ces outils ne sont ni des dépendances mobiles ni téléchargés automatiquement par les scripts. Fournir leurs chemins explicitement, entre guillemets s’ils contiennent des espaces :

```sh
npm run brand:document -- --browser "chemin/Chromium" --puppeteer-module "chemin/puppeteer.js"
npm run brand:motion -- --browser "chemin/Chromium" --puppeteer-module "chemin/puppeteer.js" --ffmpeg "chemin/ffmpeg" --format portrait
```

`--help` décrit les options, dont `--output` pour une sortie distincte. Le document produit PNG, PDF et un relevé `validation.json` lié au SHA-256 du HTML ; il vérifie les erreurs navigateur, la composition imprimée et l’absence de débordement à 390 px. Document et motion exigent les faces attendues dans l'état `loaded` et refusent une ressource indisponible avant les exports ; un repli disponible ne suffit pas. Le rendu motion vérifie aussi la géométrie finale, le format et le décodage de la vidéo. Une génération documentaire ne valide ni le clavier natif, ni TalkBack, ni un paiement réel.
