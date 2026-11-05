# 0006 | Identité et signes propres à Teranga Pay

- Date : 5 novembre 2026, Dakar.
- Tâche : T08, PAN ; relecture Salam.
- État : direction B retenue par PAN après échange avec Salam ; réalisation à relire.

## Problème et choix proposé

Le produit doit être reconnaissable et compréhensible sur Android. Le PDF montre déjà des verts et des dorés, sans charte approuvée. PAN demande une recherche argumentée et exclut Lucide et les catalogues d'icônes génériques.

Trois directions ont été comparées sur le même contenu. PAN confirme le 5 novembre, après échange avec Salam, le choix de la piste B « Le courant commun » : marine, blanc chaud, accent citron et monogramme entre T et P. La piste A verte et dorée reste une exploration liée au PDF initial ; elle n'est plus la recommandation active. Le [dossier de design](../design/README.md) distingue ce choix humain des faits de recherche. Aucune teinte n'est présentée comme créant automatiquement la confiance.

Livrer des logos éditables en SVG et 16 icônes dessinées pour ce projet. Envoyer et recevoir montrent une flèche sortant d'un cadre ou y entrant ; la première courbe ambiguë a été remplacée en revue visuelle. Scanner et encaisser gardent des signes distincts. Les commandes financières conservent un libellé.

Noto Sans sert à lire et saisir ; Manrope Bold porte les titres et le logotype. Les fichiers originaux, sources épinglées et licences OFL sont conservés. Les glyphes ciblés sont vérifiés ; cela ne valide pas les traductions wolof.

Les tokens sont partagés avec les composants natifs. Bouton, carte et champ ont des états explicites. La galerie reste une démonstration, sans paiements, onboarding ou système i18n complet.

## Dépendances nécessaires

- `react-native-svg` 15.15.4 rend nos tracés ; ce moteur n'est pas un catalogue d'icônes.
- `expo-font` ~57.0.4 charge les trois polices locales, avec attente lisible et repli vers les polices du téléphone.

Versions issues de `bundledNativeModules.json` d'Expo 57 puis installées par `expo install`. Le lockfile est mis à jour. Aucune bibliothèque Bitcoin, backend ou infrastructure ajoutée.

## Alternatives et conséquences

Un catalogue prêt à l'emploi contredirait le choix de PAN. Les images matricielles seules limiteraient variantes et petits formats : les SVG restent les sources. Les polices système seules réduiraient les ressources, mais pas avec la même cohérence visuelle.

Les polices ajoutent environ 1,36 Mo avant compression, détaillés dans leur manifeste ; ce n'est pas une mesure de l'APK. Rendu HTML et tests ne remplacent pas un essai Android sur appareil modeste, texte agrandi et lecteur d'écran. Le choix artistique de PAN après échange avec Salam ne constitue ni un test utilisateur ni l'approbation technique de la PR.

La branche T08 part de `docs/T07-validation-ci` au commit `862c493`, à la demande de PAN. Sa PR cible cette branche tant que la PR #38 n'est pas fusionnée. Après la fusion squash du parent, rebaser les seuls commits T08 sur `main`, puis changer la cible de PR et relancer les contrôles. Une simple réorientation pourrait conserver les anciens commits T07 dans le diff de comparaison.

## Animation de communication

PAN demande aussi un exemple de motion, puis précise que le signe doit se tracer sur place plutôt qu’arriver de deux côtés. La séquence conserve donc les deux modules à leur position finale et révèle progressivement leurs remplissages. Elle reste indépendante du démarrage mobile. Aucun paquet d’animation ni binaire d’encodage n’est ajouté aux dépendances du produit.
