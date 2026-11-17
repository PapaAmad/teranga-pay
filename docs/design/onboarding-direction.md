# Onboarding T14 | Direction artistique et parcours

Proposition pour le projet de Salam et PAN, commencée le 8 novembre 2026 et actualisée le 9 novembre. Cette note relie les références fournies, la [charte T08](charte.md), la [recherche documentaire](onboarding-recherche.md) et les écrans T14. La décision technique est consignée dans l'[ADR 0012](../decisions/0012-onboarding-protection-et-integration.md). PAN a confirmé les écrans le 9 novembre 2026 avant commit et PR. La relecture technique de Salam reste à obtenir.

## Références retenues et transformation

PAN a recentré l'exploration sur les quatre dernières captures fournies dans `references/ecrans/`, présentées comme des écrans Revolut. Ce dossier reste local et ignoré. Les captures ne sont ni publiées dans le dépôt ni utilisées comme ressources de l'application. Elles permettent d'observer une composition, pas d'attribuer une efficacité mesurée à ces écrans ou de confirmer les fonctions du produit montré.

| Référence locale | Observation de composition                                         | Ce que Teranga Pay en retient                                                                                              |
| ---------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `ref_15.webp`    | Un démarrage avec logo centré et très peu d'éléments.              | Une marque identifiable et des espaces francs. L'animation de communication de T08 ne devient pas une attente obligatoire. |
| `ref_16.webp`    | Un montant dominant et une hiérarchie nette sur fond bleu.         | Des niveaux typographiques tranchés et peu de points d'attention. Le solde fonctionnel et ses données restent T16.         |
| `ref_17.webp`    | Des cartes de paiement lisibles et une action principale affirmée. | Un rythme de surfaces et un bouton facile à retrouver. Aucune offre de carte bancaire n'est promise.                       |
| `ref_18.webp`    | Un grand titre, un objet central et une action de démarrage.       | Une ouverture éditoriale : titre expressif, illustration originale propre au projet, puis invitation claire à commencer.   |

Il s'agit d'une adaptation de principes de composition. Les textes, signes, couleurs, tracés et fonctions ne sont pas repris à l'identique. La préférence artistique de PAN ne remplace pas une observation de compréhension chez les futurs utilisateurs.

## Une présence forte à l'accueil, puis de la place pour agir

L'ouverture associe un grand titre Manrope, les fonds clairs de T08, le marine de Teranga Pay et un accent citron ponctuel. Une **illustration matricielle originale** remplace la première esquisse SVG : un portefeuille bleu nuit et un ruban citron matérialisent le portefeuille personnel et le courant commun. Le [visuel et son prompt](../../assets/brand/illustrations/README.md) sont conservés dans le dépôt ; [OnboardingArtwork](../../apps/mobile/src/onboarding/OnboardingArtwork.tsx) utilise le dérivé transparent de 960 × 640 pixels. PAN a confirmé le visuel dans les écrans présentés. Les captures Revolut servent uniquement de repères de composition et ne deviennent pas la matière du visuel.

L'illustration prolonge la marque sans promettre de carte bancaire, de réseau de paiement partenaire ou de solde réel. Les tracés officiels du monogramme et des icônes restent ceux de T08. Les textes fonctionnels autour de l'image expliquent l'action ; le dessin décoratif est exclu de la lecture assistée. Il s'efface lorsque l’échelle typographique système atteint 1,5 pour garder la priorité au texte.

Une fois le parcours commencé, le décor s'efface devant les instructions. Les quatre phases visibles, langue, code, sauvegarde et vérification, donnent un repère textuel. Le titre décrit l'action en cours, le texte explique son utilité et le bouton dit ce qu'il fait. La préparation reste une étape distincte : disposer d'un support et d'un moment privé avant de manipuler les mots.

Le PIN vient avant la création, car `create(pin)` protège la graine immédiatement. Cet ordre découle du contrat technique ; la recherche ne prétend pas prouver une supériorité psychologique de cet ordre. Les mots restent numérotés, le test vérifie la copie et un retour permet de la revoir. Une erreur de copie reçoit une correction compréhensible ; elle ne devient pas une punition d'authentification.

## Règles de composition et d'interaction

- **Palette existante :** marine, papier et citron de T08. Le citron guide l'action et les repères ; il n'est pas une preuve de confiance ou de sécurité. Les états gardent un libellé au-delà de leur couleur.
- **Typographie :** Manrope pour les titres, Noto Sans pour les consignes, choix et champs. La hiérarchie doit survivre au repli des polices, à un écran étroit et à l'agrandissement du texte.
- **Commandes :** cibles d'au moins 48 dp, libellés persistants, aide et erreurs proches de la tâche. Le clavier et le défilement doivent laisser une suite atteignable. Aucun geste secret n'est nécessaire pour avancer.
- **Iconographie :** les signes originaux de T08 restent la famille utilisée. `react-native-svg` sert à rendre les tracés ; aucun catalogue Lucide ou substitut générique n'est ajouté.
- **Langue :** tous les textes passent par T09. Français disponible et mémorisé ; wolof indiqué comme à venir et non sélectionnable avant traduction et relecture T33. Les mots fournis par le wallet ne sont pas traduits.
- **Permissions :** aucune caméra, aucun contact et aucune localisation demandés pour découvrir l'application ou préparer la sauvegarde. La permission du scanner appartient à son usage ultérieur.

Les étapes non sensibles peuvent avoir une brève transition d'opacité de 160 ms. La réduction du mouvement est respectée. Pas de défilement promotionnel automatique, de délai artificiel ni d'animation des mots ou du PIN. Le mouvement accompagne un changement compréhensible ; il n'est pas un passage obligé pour lire ou appuyer.

## Montrer exactement ce qui fonctionne

L'entrée normale ne fabrique pas de wallet : sans port natif, elle permet l'accueil et la préparation, puis explique l'indisponibilité avant la saisie d'un PIN. Le parcours complet peut être examiné dans un aperçu de développement explicite, avec des jetons `exemple01` à `exemple12` et un état exclusivement en mémoire. Un aperçu réussi n'est pas annoncé comme une création de clés.

La sauvegarde de la phrase n'est pas présentée comme une garantie de récupération de tous les états Lightning. En cas d'interruption après création, le parcours doit protéger les secrets et bloquer une reprise que le module wallet ne sait pas encore garantir. Aucun reset silencieux n'est acceptable pour rendre la démonstration plus fluide.

Les ressources de validation et captures éventuelles doivent utiliser exclusivement l'aperçu et ses repères non utilisables comme phrase Bitcoin. Aucune phrase, aucun PIN et aucune donnée privée ne sont publiés dans les images, journaux ou discussions de revue.

## Revue à conduire

La prévisualisation Web affiche les vrais composants React Native ; elle peut servir à comparer les compositions et à parcourir les états. Jest vérifie les transitions et erreurs contrôlées. Ces moyens n'attestent ni un rendu Android physique, ni une sauvegarde réelle, ni une protection des captures.

La revue doit examiner l'équilibre du titre et de l'illustration à petite taille, la lecture en grand texte, la distinction PIN/phrase et la possibilité de corriger une erreur. PAN a vu le rendu local et confirmé les écrans avant commit et PR. Les essais natifs devront couvrir clavier, retours Android, ordre TalkBack, arrière-plan et capture d'écran. La compréhension des consignes doit être observée avec les publics concernés, puis la traduction wolof relue nativement. Les comptes rendus ne doivent mentionner que les essais effectivement conduits.
