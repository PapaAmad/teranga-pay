# Composants visuels | T08

Proposition de fondations portée par PAN, à relire par Salam : bouton, carte, champ et icônes de Teranga Pay. Les couleurs et mesures proviennent de `assets/brand/tokens.json` ; les icônes utilisent les tracés SVG du même dossier. Les polices sont chargées au démarrage de l'application.

Le démarrage permet de continuer avec les polices du téléphone pendant l'attente ; une erreur de chargement conserve aussi la navigation. `BrandTypographyProvider` transmet ce repli aux composants et à la galerie, sans demander une famille non chargée.

Les textes passent par les ressources de traduction ou les propriétés des composants. Les boutons ont des états appuyé, désactivé et occupé ; un bouton occupé bloque les appuis répétés. Les cartes associent chaque état à une icône et un texte. Les champs associent une étiquette permanente, une aide et un message d'erreur explicite. Les contrôles gardent une cible d'au moins 48 points et une hauteur adaptable au texte agrandi.

La galerie « Atelier visuel » présente ces fondations depuis l'accueil. Ses interactions sont des exemples locaux ; elles ne déclenchent aucun paiement. Lancer `npm run mobile` pour la consulter et `npm test -- --ci` pour vérifier les états et interactions. Les écrans de wallet et le système de traduction complet restent les tâches suivantes.

Après une saisie dans la galerie, le premier appui sur un bouton reste transmis
à ce bouton ; le défilement permet de fermer le clavier. Sous iOS, le contenu
défilant ajuste aussi ses marges à la taille du clavier. Ces réglages utilisent
les [propriétés clavier de ScrollView](https://reactnative.dev/docs/0.86/scrollview#keyboardshouldpersisttaps).
Le comportement avec le clavier et le texte agrandi reste à examiner sur appareil ;
les tests Jest ne remplacent pas cette vérification native.
