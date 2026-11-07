# Mouvement de marque | direction B

Premier exemple de motion design porté par PAN pour T08, à relire avec Salam. Le monogramme « Le courant commun » se trace progressivement sur place, puis le nom Teranga Pay et la signature apparaissent en fondu. Les formes restent à leur position finale pendant tout le tracé. La composition finale reste visible pendant les trois dernières secondes. Aucun écran de paiement ni résultat de transfert n’est représenté.

Cette introduction accompagne une communication ou un pitch. Elle reste un livrable séparé du démarrage de l’application, dont l’objectif d’ouverture reste inférieur à trois secondes.

- `motion.html` : source unique modifiable, CSS et JavaScript inclus, sans bibliothèque ni appel réseau. Ouvrir le fichier dans un navigateur pour le format horizontal ; ajouter `?format=portrait` à son adresse pour le format vertical. Les deux polices locales sont lues dans `../fonts/`. Les commandes permettent de lire, mettre en pause, rejouer et parcourir la durée. La préférence de mouvement réduit affiche la composition finale sans lecture automatique.
- `intro-teranga-pay.mp4` : export muet en 1920 × 1080, 30 images par seconde, durée 6,5 secondes, H.264 et pixels YUV 4:2:0.
- `poster.png` : composition finale exportée en 1920 × 1080 pour une vignette ou une présentation fixe.
- `intro-teranga-pay-vertical.mp4` : même tracé et même narration en 1080 × 1920 pour le partage vertical, 30 images par seconde, 6,5 secondes, H.264 `yuv420p`, sans piste audio.
- `poster-vertical.png` : composition finale verticale en 1080 × 1920, avec des marges autour du symbole, du nom et de la signature.

Le symbole reprend la géométrie de `../logos/mark.json`. Le second sous-tracé commence en coordonnées absolues `M24 32` dans le HTML pour pouvoir révéler les deux parties séparément. Deux masques SVG révèlent les remplissages originaux avec un trait central dont le décalage de pointillé diminue progressivement. Le contour final reste celui du logo, indépendamment de la largeur du trait de révélation. La palette est marine `#172A36`, citron `#E5EE73` et blanc chaud `#FAFAF5`. Le logotype reste en minuscules `teranga pay`, en Manrope Bold ; le nom éditorial reste Teranga Pay. La signature utilise Noto Sans Regular ; les fichiers et licences des polices restent dans `../fonts/`.

Le [renderer portable](../../../scripts/render-brand-motion.mjs) produit les exports avec un navigateur Chromium/Edge, un module Puppeteer externe et FFmpeg. Fournir leurs chemins de fichiers, entre guillemets s’ils contiennent des espaces. Ces outils de fabrication ne sont pas des dépendances de l’application ; aucun binaire n’est distribué dans le dépôt.

```sh
node scripts/render-brand-motion.mjs --browser "chemin/vers/chromium" --puppeteer-module "chemin/vers/puppeteer.js" --ffmpeg "chemin/vers/ffmpeg" --format portrait
```

Pour l’horizontal, remplacer `portrait` par `landscape`, qui est aussi le format par défaut. `--output "dossier"` permet un autre dossier de sortie ; les noms des fichiers restent ceux listés ci-dessus. `--help` affiche l’usage sans charger les outils. Le renderer ne supprime aucun fichier : il régénère uniquement le MP4 et le poster du format demandé. Les preuves locales sont écrites dans `.tmp/t08-motion-proof-portrait.json` ou `.tmp/t08-motion-proof-landscape.json`.

Le renderer ouvre `motion.html?render=1&format=portrait` ou le format horizontal, charge explicitement Manrope 700 et Noto Sans 400 et exige leurs faces dans l’état `loaded`. Une ressource indisponible arrête le rendu avant tout poster ou vidéo ; `document.fonts.check()` seul ne suffit pas à valider une police. Le relevé de rendu conserve familles, poids et statuts. Le renderer appelle `window.brandMotion.seek(image / 30)` avant chaque capture. Il encode les 195 images en H.264, `yuv420p`, sans piste audio, avec l’index MP4 en début de fichier (`faststart`). Le poster correspond à la seconde 4,5. Il contrôle les marges, compare les pixels du symbole final à la source, décode le MP4, puis exerce pause, rejeu et mouvement réduit. Les outils utilisés pour les exports livrés restent temporaires dans `.tmp/`.

Cette vidéo est calculée à partir du SVG et du texte ; elle n’a pas été générée par un modèle vidéo. La vérification couvre le rendu navigateur et le décodage du MP4, pas une lecture sur téléphone physique ni une publication sur une plateforme externe. Aucun moteur d’animation n’est ajouté à l’application mobile.

Les vérifications de chaque export portent sur 195 images décodées, une durée exacte de 6,5 secondes, les dimensions du format à 30 images par seconde, H.264 `yuv420p`, sans piste audio. Le tracé terminé, avec ses masques, est comparé au symbole source en 640 × 640. Les posters sont inspectés et les commandes sont exercées dans Edge ; ces contrôles ne constituent pas un essai sur une plateforme de partage ou un appareil physique.
