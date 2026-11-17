# Accueil T16 | Recherche et direction

Note du 9 novembre 2026 pour le projet de Salam et PAN. T16 couvre le solde en FCFA, les trois actions et les dernières opérations. Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf), sections 4 à 6, et le [plan d’équipe](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf), page 8, définissent ce périmètre. La [feuille de route](../planning/roadmap.md), la [charte T08](charte.md) et la [direction T14](onboarding-direction.md) restent les références internes. Les sources externes ont été consultées le 9 novembre 2026.

Cette recherche fournit des règles de conception et des hypothèses à vérifier. Elle ne démontre ni une préférence du public sénégalais pour cette composition, ni un effet de confiance causé par une couleur.

## Six principes à appliquer

### 1 | Donner une place claire au solde et aux actions

Le W3C recommande de rendre le but d’une page explicite et d’organiser son contenu en régions compréhensibles. **Application :** un bloc de solde dominant, trois actions nommées, puis une section « Dernières opérations ». La marque et les commandes secondaires restent discrètes. L’ordre de lecture assistée suit ce même ordre. La hiérarchie se construit avec les tailles, les espacements et les titres, sans multiplier les cartes décoratives. [W3C | But de la page](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p01-clear-purpose/), [W3C | Structure de page](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o2p03-page-structure/).

**Limite :** ces recommandations d’accessibilité cognitive ne prouvent pas qu’un montant centré est supérieur à un montant aligné à gauche. Ce choix de composition doit être examiné sur les écrans réels.

### 2 | Distinguer l’argent détenu de sa contre-valeur

Le Bitcoin Design Guide recommande de rendre les unités et la monnaie locale compréhensibles, avec un format adapté au public. CLDR définit les conventions de nombres et de devises ; XOF utilise zéro décimale par défaut. **Application :** « Estimation en FCFA » au premier plan et quantité de sats lisible en dessous. Garder l’unité à côté du nombre, regrouper les milliers selon la langue et signaler une petite valeur positive par « moins de 1 FCFA » plutôt que par un faux zéro. Le taux et son ancienneté doivent pouvoir être expliqués. [Bitcoin Design | Unités et symboles](https://bitcoin.design/guide/designing-products/units-and-symbols/), [Unicode | Nombres](https://www.unicode.org/reports/tr35/tr35-numbers.html), [Unicode | Données XOF](https://github.com/unicode-cldr/cldr-core/blob/master/supplemental/currencyData.json).

**Limite :** un arrondi d’affichage n’est pas une règle de calcul comptable. La contre-valeur ne garantit pas un retrait à ce prix. La source et la validité du taux relèvent de T17 ; un taux de démonstration doit être nommé comme tel.

### 3 | Conserver les données connues et montrer leur fraîcheur

Android préconise une source locale consultable sans attendre une requête réseau, avec une interface qui reflète son état. **Application :** conserver la dernière observation exploitable pendant une actualisation, accompagnée de sa date et d’un état explicite. Sans observation disponible, afficher une indisponibilité, jamais un solde nul inventé. Un échec d’actualisation ne vide pas l’historique et propose une commande « Réessayer ». [Android | Applications utilisables hors connexion](https://developer.android.com/topic/architecture/data-layer/offline-first).

**Limite :** ce guide décrit une architecture générale ; il n’autorise pas à présenter une donnée financière ancienne comme actuelle. Réseau du téléphone, synchronisation du wallet et fraîcheur du taux sont des états distincts. Une consultation possible ne promet pas qu’un paiement pourra être exécuté.

### 4 | Garder trois actions compréhensibles et atteignables

Les recommandations Android demandent des libellés utiles et des cibles tactiles d’au moins 48 × 48 dp. **Application :** « Recevoir », « Envoyer » et « Encaisser » accompagnent les icônes originales de T08. Le dessin seul ne porte pas le sens. Aucun appui long, défilement horizontal ou geste découvert par hasard n’est nécessaire. Une action qui attend une autre tâche explique cette limite ; elle n’affiche pas une réussite fictive. [Android | Principes d’accessibilité](https://developer.android.com/guide/topics/ui/accessibility/principles), [Android | Cibles tactiles](https://support.google.com/accessibility/android/answer/7101858?hl=en).

**Limite :** 48 dp est une recommandation de taille, pas une preuve d’utilisabilité. Les cibles et leur espacement restent à vérifier avec le grand texte et sur un téléphone Android modeste.

### 5 | Rendre les opérations vérifiables sans dépendre de la couleur

WCAG demande une alternative visuelle lorsque la couleur porte une information. **Application :** chaque opération montre son sens, son montant avec unité, sa date et son état textuel : reçue, envoyée, en attente ou échouée. Une opération en attente ne devient pas « Payée » par simple animation. La liste reste courte sur l’accueil ; le détail complet appartient à T24. [W3C | Usage de la couleur](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

**Limite :** le texte d’état dépend du contrat métier confirmé. L’écran ne peut pas conclure seul qu’un paiement échoué n’a jamais débité de fonds. Les exemples et captures utilisent exclusivement des données fictives identifiées.

### 6 | Informer sans interrompre ni masquer la tâche

WCAG recommande que les changements d’état importants soient exposés aux aides techniques sans déplacement de focus systématique. **Application :** annoncer le résultat d’une actualisation et les erreurs utiles, sans relire constamment tout le solde. Garder le texte agrandissable, les titres explicites et les messages proches du contenu concerné. Pas de compteur animé qui fait défiler l’argent, d’attente artificielle ou d’illustration lourde devant les commandes quotidiennes. [W3C | Messages d’état](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

**Limite :** les propriétés Web ne se transposent pas mécaniquement à React Native. L’ordre, la fréquence des annonces et le maintien du focus doivent être vérifiés avec TalkBack sur appareil ; une capture Web ne suffit pas.

## Traduction artistique des références

Les captures locales `references/ecrans/ref_16.webp` et `ref_17.webp`, fournies par PAN comme références Revolut, ont été inspectées. La première fait dominer le montant et regroupe les actions avant les opérations ; la seconde utilise quelques surfaces très lisibles et une commande forte. Ce sont des observations de composition, sans mesure d’efficacité. Les captures restent ignorées et ne sont pas des ressources de l’application.

Pour Teranga Pay, retenir une grande surface marine T08, un montant ample, les trois commandes avec leurs icônes originales et une liste sur le fond papier. Le citron intervient comme accent ponctuel ; le bleu électrique, les produits de carte bancaire et la navigation promotionnelle de la référence ne sont pas repris. La présence de marque repose sur le monogramme, la typographie et les proportions. L’illustration de l’onboarding peut rester propre à la découverte ; l’accueil quotidien doit surtout donner accès aux informations utiles.

## Vérification avant publication

Présenter à PAN les rendus normal, vide, actualisation, erreur et données anciennes, sur écran étroit et avec grand texte. Vérifier les trois actions et les annonces accessibles avec les moyens réellement disponibles. Noter séparément les essais sur appareil restant à conduire et le branchement effectif des données T15/T17. **PAN doit confirmer les écrans avant tout commit et toute PR T16** ; son accord sur T14 ne vaut pas approbation du nouvel accueil.
