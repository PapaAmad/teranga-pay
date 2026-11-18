# Historique T24 | Recherche et principes

Note du 11 novembre 2026 pour le projet de Salam et PAN. PAN porte l’interface de l’issue [#19](https://github.com/PapaAmad/teranga-pay/issues/19) ; Salam porte les services et la relecture. Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf), page 8, demande une liste d’opérations et un reçu simple à partager ; sa page 14 prévoit la consultation quand le réseau manque. Le [plan d’équipe](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf), page 9, confie T24 à PAN pour le 13 novembre. Le [backlog](../../scripts/github/backlog.json) précise T11, T22 et T23 comme dépendances, avec type, montant, date, état, détail et total journalier cohérent. Les sources primaires suivantes ont été consultées le 11 novembre 2026.

## 1 | Retrouver une opération sans surcharger la liste

Bitcoin Design distingue la liste, utile pour parcourir rapidement les mouvements, de leur détail. Le guide recommande de choisir des informations pertinentes, des signes de montant lisibles et des regroupements adaptés aux longues listes. Il présente la recherche et les filtres comme des outils qui dépendent de la qualité des données. [Bitcoin Design | Activité](https://bitcoin.design/guide/daily-spending-wallet/activity/).

**Application T24 :** grouper par date d’opération et proposer Tout, Reçus, Envoyés et Simulés. Une ligne donne type, montant, heure et état ; un appui ouvre le détail. Les signes + et −, les mots et les icônes originales T08 complètent la couleur. Aucun contact, commerce ou motif n’est déduit d’un identifiant technique. La recherche libre, les catégories et l’export comptable ne sont pas ajoutés au périmètre T24.

Le journal reste une surface de lecture. La palette marine et citron, les polices locales et les signes T08 assurent sa continuité avec l’accueil. Les captures de référence peuvent guider la hiérarchie et la densité ; elles ne justifient ni une copie d’identité visuelle ni une promesse de confiance liée à une couleur. Une photographie ou une illustration raster n’apporte ici aucune information nécessaire à l’opération.

## 2 | Une liste adaptée aux longues consultations

Android recommande des composants qui créent les éléments nécessaires à la zone visible pour les grands ensembles. React Native fournit `SectionList`, fondée sur `VirtualizedList`, pour les listes groupées ; son rendu par fenêtre demande notamment des clés stables et des données explicites. [Android | Listes](https://developer.android.com/develop/ui/compose/lists), [React Native | SectionList](https://reactnative.dev/docs/sectionlist).

**Application T24 :** utiliser une liste virtualisée avec groupes de jours, identifiants préfixés par leur source et chargement explicite de la suite. La carte du jour, les filtres et les messages font partie de son en-tête défilant pour laisser place aux opérations sur petit écran. La virtualisation limite le rendu ; elle ne prouve pas, à elle seule, la fluidité sur Android modeste. Cette dernière exige un essai sur appareil.

## 3 | Les états doivent rester compréhensibles sans couleur

Le W3C demande une information visible complémentaire lorsque la couleur porte une signification. Les messages importants ajoutés sans déplacement de focus doivent aussi pouvoir être annoncés aux technologies d’assistance. Android recommande des cibles tactiles d’au moins 48 × 48 dp et des descriptions utiles des commandes. [W3C | Utilisation de la couleur](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [W3C | Messages d’état](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [Android | Accessibilité](https://developer.android.com/guide/topics/ui/accessibility/apps).

**Application T24 :** écrire Terminée, En attente, Échouée ou À vérifier. Le bouton de partage annonce son résultat propre sans transformer l’ouverture du menu en envoi effectif. Prévoir des messages distincts pour le chargement, le filtre sans résultat, l’absence de portefeuille, le verrouillage, la panne d’une source et la lecture ancienne. Les lignes, filtres et commandes conservent des cibles utilisables ; les montants passent sur une autre ligne quand l’espace ou le grand texte le demande. Les annonces TalkBack et les mesures sur téléphone restent à vérifier séparément des captures Web.

## 4 | La confidentialité continue dans le détail et le partage

Bitcoin Design décrit le risque d’exposition des informations financières dans les lieux publics et plusieurs moyens de masquer les données sensibles, notamment lorsque l’application devient inactive. Ces exemples sont des pistes de conception, pas une garantie de sécurité de notre application. [Bitcoin Design | Confidentialité du portefeuille](https://bitcoin.design/guide/daily-spending-wallet/privacy/).

**Application T24 :** le verrouillage et l’interruption masquent liste, cumul et détail et invalident les retours d’actions périmés. Le partage volontaire contient source, type, état, montants disponibles, frais connus, date d’opération et référence. Il exclut note personnelle, facture Lightning et identité de destinataire. Un détail en attente ou incertain indique qu’il ne confirme aucun règlement ; un retrait fictif indique explicitement la simulation. Aucun envoi externe n’est déclenché par un test de partage intercepté.

## 5 | Un cumul dont la base reste visible

**Décision propre au projet :** les contrats disponibles donnent `createdAt`, sans garantir l’instant effectif du règlement. La carte utilise donc les opérations datées de ce jour dans `Africa/Dakar`, dont la source indique la réussite. Reçus et envoyés hors frais restent séparés ; les retraits T23 constituent un autre journal et ne débitent pas le wallet de démonstration. Une confirmation observée aujourd’hui pour une opération créée hier ne rejoint pas automatiquement le cumul d’aujourd’hui. Cette convention et ses limites figurent dans l’[ADR 0018](../decisions/0018-historique-et-totaux.md).

Une valeur FCFA historique absente ne devient ni zéro ni une conversion au taux courant. Le cumul signale les montants inconnus, les pages non lues et les données anciennes. Un total complet signifie que la source a été parcourue jusqu’au bout ; cela ne certifie pas la conservation historique du taux par son fournisseur. T22 garde son prix marchand figé sans créer une deuxième opération pour la même réception.

PAN a confirmé les nouveaux écrans le 11 novembre 2026 avant commit et PR. La [direction](historique-direction.md) décrit la composition ; le [suivi T24](../planning/suivi-t24.md) distingue les vérifications réalisées et les preuves encore attendues. Aucun essai physique Android ni branchement natif achevé n’est établi par cette recherche.
