# Retirer T25 | Recherche et principes

Note du 11 novembre 2026 pour le projet de Salam et PAN. PAN porte l’interface
de l’issue [#20](https://github.com/PapaAmad/teranga-pay/issues/20) ; Salam porte
les services et relit. Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf),
pages 6 à 11, prévoit le choix Wave ou Orange Money, un montant en FCFA, les
frais avant confirmation et un retrait explicitement simulé. Sa page 15 demande
idempotence, états et réconciliation contre le double retrait. Le
[plan d’équipe](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf), page 9,
confie T25 à PAN pour le 13 novembre. Le [backlog](../../scripts/github/backlog.json)
retient T23 comme dépendance et demande des erreurs permettant la reprise.

Les sources primaires ci-dessous ont été consultées le 11 novembre 2026.
Elles éclairent des choix d’interface ; elles ne prouvent ni une préférence
locale, ni un test utilisateur, ni la conformité de l’application.

## 1 | Relire le montant et le coût avant de confirmer

Le W3C décrit, pour les engagements importants et les opérations financières,
des moyens de corriger, vérifier ou confirmer les informations avant l’envoi.
Bitcoin Design recommande une revue des détails et une présentation claire des
frais. [W3C | Prévention des erreurs financières](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html),
[Bitcoin Design | Envoi, frais et confirmation](https://bitcoin.design/guide/daily-spending-wallet/sending/).

**Application T25 :** séparer la préparation du devis de sa confirmation. Le
récapitulatif expose opérateur, destination de démonstration, montant destiné,
frais fictifs et total réservé. Modifier les données reste possible avant cette
confirmation ; ouvrir l’écran ou obtenir un devis ne doit pas créer de retrait.
L’action finale nomme la simulation. Une échéance atteinte invite à obtenir un
nouveau devis puis à relire son prix ; elle ne valide jamais silencieusement un
prix différent.

T23 fournit un montant destiné auquel s’ajoutent **100 FCFA fictifs** : par
exemple, 2 500 FCFA destinés donnent un total de 2 600 FCFA fictifs. La maquette
de principe de la conception, page 11, soustrait au contraire des frais d’un
montant saisi. T25 suit le contrat T23 publié et doit documenter cet écart ;
aucun de ces exemples n’est présenté comme le tarif de Wave ou Orange Money.

## 2 | Expliquer ce que la reprise fait réellement

Le W3C demande de proposer une correction connue lorsqu’une erreur de saisie
est détectée. Bitcoin Design conseille d’indiquer le problème, l’état connu
de l’opération et la prochaine action. [W3C | Suggestion après erreur](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html),
[Bitcoin Design | Erreurs d’envoi](https://bitcoin.design/guide/daily-spending-wallet/sending/#errors).

**Application T25 :** un montant invalide se corrige avant la confirmation ; une
panne de lecture se relit. Une réponse perdue après confirmation reste une
issue inconnue : l’interface propose de retrouver cette demande, puis de
reprendre explicitement sa même référence si nécessaire. Elle n’invite pas à
créer un autre retrait et n’affirme pas que la réservation a été libérée sans
preuve. « Vérifier » et « Reprendre ce retrait » décrivent deux actions
différentes du contrat T23.

La conception, pages 10 et 11, propose un même texte pour échec et délai
dépassé. Ce raccourci ne suffit pas au contrat disponible : un délai dépassé
peut suivre un effet déjà produit. T25 doit conserver cette distinction et
la clé d’idempotence de la demande engagée. Une transition locale ne constitue
pas une preuve de réussite opérateur.

## 3 | Rendre les états compréhensibles et accessibles

Android recommande une cible tactile d’au moins **48 × 48 dp**, des descriptions
qui expliquent le résultat des commandes et une vérification des annonces
effectives. Le W3C explique comment rendre les messages d’état perceptibles
sans déplacer systématiquement le focus. [Android | Accessibilité des applications](https://developer.android.com/guide/topics/ui/accessibility/apps),
[W3C | Messages d’état](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

**Application T25 :** accompagner les couleurs par un état écrit : préparation,
en attente, à vérifier, terminé en simulation ou échec confirmé. Le chargement
du devis ne ressemble pas à une réussite. Les contrôles d’opérateur sont
nommés et leur sélection est exposée aux technologies d’assistance ; les icônes
décoratives ne créent pas des annonces répétées. Le compte à rebours reste
consultable sans lire chaque seconde à voix haute. Les changements importants
doivent être annoncés ; TalkBack reste à observer sur téléphone.

Les libellés et montants acceptent petit écran et grand texte. L’action principale
reste hors du contenu défilant et au-dessus du clavier, selon la règle déjà
retenue dans la [charte T08](charte.md). Les captures Web mesurent leur propre
rendu ; elles ne prouvent ni le clavier système ni une interaction physique.

## 4 | Conserver les frontières de la démonstration

**Décisions propres au projet :** le parcours T23 ne demande ni numéro personnel
ni PIN wallet. Ses seules destinations sont `wave-demo-001` et
`orange-demo-001` ; son compte est un registre fictif séparé du wallet. Le
serveur authentifie l’accès par la session composée hors des composants ; aucun
jeton n’est affiché ou embarqué dans une ressource de traduction.

La conception, page 10, prévoit une confirmation par PIN. Le contrat simulé
publié n’utilise pas cette autorisation wallet. Ajouter un écran de PIN sans
vérification réelle donnerait une protection trompeuse. T25 garde donc une
confirmation explicite de la simulation ; l’écart et les conditions d’une
future intégration réelle doivent être consignés dans la décision technique
de la tâche.

Le succès indique la fin de la **simulation**, sans annoncer de cash remis ou
de compte mobile money réel crédité. Les destinataires, soldes, frais et reçus
fictifs gardent leur qualification. L’absence du fournisseur composé produit
une indisponibilité expliquée ; l’atelier de développement reste isolé et ne
sollicite aucun opérateur réel.

La palette marine et citron, les polices locales et les signes originaux T08
prolongent l’application. Aucun effet psychologique n’est attribué à une
couleur et aucun logo d’opérateur n’est inventé. La hiérarchie doit aider à
comprendre le prix, la confirmation et l’état connu. La
[direction](retirer-direction.md) décrit la composition ; le
[suivi T25](../planning/suivi-t25.md) garde les vérifications et limites. PAN a confirmé les nouveaux écrans le 12 novembre 2026 avant commit et PR.
