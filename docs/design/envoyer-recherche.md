# Envoyer T20 | Recherche et principes

Note du 9 novembre 2026 pour le projet de Salam et PAN. PAN porte l’interface T20 ; Salam porte la logique d’envoi T21 et relit. Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf), section 6, pages 10 et 11, demande des mots simples, des FCFA visibles et des erreurs utiles. Le [plan d’équipe](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf), page 9, prévoit scan, collage, frais et confirmation PIN. Les sources primaires ci-dessous ont été consultées le 9 novembre 2026. La [charte T08](charte.md) demeure la référence visuelle.

## 1 | Voir avant d’autoriser

Le critère WCAG 3.3.4 prévoit la possibilité de vérifier, corriger ou annuler une soumission financière. C’est un repère pertinent pour notre interface native, sans constituer une certification WCAG de l’application. [W3C | Prévention des erreurs financières](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html).

**Choix T20 :** séparer lecture de la demande, montant éventuel, récapitulatif et autorisation. Scanner, coller ou saisir six chiffres ne déclenche pas automatiquement un paiement. Le récapitulatif montre le destinataire connu, le montant, les frais et le total ; une action explicite permet de modifier avant le PIN. L’écran PIN rappelle les informations nécessaires à la décision.

COGA recommande des étapes repérables et des parcours qui n’obligent pas à mémoriser les informations d’une page précédente. Nous gardons un titre d’étape, le montant et la destination pendant la confirmation, avec un retour compréhensible. Ces recommandations d’accessibilité cognitive ne prouvent pas une réduction mesurée des erreurs dans notre public. [W3C | COGA, étapes et mémoire](https://www.w3.org/TR/coga-usable/).

## 2 | Les frais ont un sens précis

Bitcoin Design distingue transparence des coûts et choix de l’utilisateur. Une estimation n’est pas le coût finalement payé. [Bitcoin Design | Frais d’envoi](https://bitcoin.design/guide/daily-spending-wallet/sending/send-fees/).

**Choix T20 :** FCFA en premier, sats en second. Un plafond fourni par T21 s’affiche comme « Frais au maximum » et produit un « Total au maximum ». Un simple devis estimatif conserve son qualificatif ; il ne devient pas une garantie visuelle. L’autorisation doit porter sur une limite réellement applicable par le wallet. Sans information suffisante, demander une nouvelle vérification plutôt qu’afficher zéro. Les conversions restent des estimations, calculées depuis le taux fourni, et ne changent pas le montant Lightning de la demande.

## 3 | Lire un QR n’autorise rien

Android recommande de demander une permission au moment où la fonction est utilisée et de conserver une alternative après refus. [Android | Permissions à l’exécution](https://developer.android.com/training/permissions/requesting).

**Choix T20 :** l’entrée propose Scanner et Coller. Seul Scanner ouvre la demande caméra. Un refus explique comment continuer par collage ; un lien vers les réglages n’apparaît que s’il est utile. L’aperçu caméra est arrêté hors de l’écran actif. Le premier résultat utile suspend la lecture pour éviter de traiter chaque image comme une nouvelle demande. Aucun QR ne provoque un envoi ou l’ouverture automatique d’un site.

BOLT11 définit notamment checksum, signature, réseau, montant optionnel et expiration. [BOLT11 | Protocole des demandes](https://github.com/lightning/bolts/blob/master/11-payment-encoding.md).

**Limite technique :** le scanner fournit une chaîne non fiable au port T21. La présentation n’implémente pas son propre décodeur Lightning par expression régulière. Une demande expirée, d’un réseau non autorisé ou non reconnue reçoit une explication locale. La démo reste regtest. L’adresse Lightning requiert sa résolution prévue dans T21 ; ressembler à un e-mail ne prouve ni l’identité ni la disponibilité d’un destinataire.

## 4 | Attendre n’est pas échouer

Bitcoin Design recommande un état de traitement compréhensible, une confirmation distincte et une erreur expliquant quoi faire ensuite. [Bitcoin Design | Envoi et résultats](https://bitcoin.design/guide/daily-spending-wallet/sending/).

**Choix T20 :** distinguer envoi en cours, attente connue, réussite confirmée, échec connu et résultat incertain. Une interruption réseau après soumission ne permet pas d’affirmer que l’argent n’a pas bougé. La phrase proposée pour « timeout » page 10 du PDF n’est donc pas reprise dans ce cas. Conserver la référence disponible et vérifier la même opération seulement si le contrat le permet ; aucun réessai automatique ne crée un second paiement. Le `TIMEOUT` actuel de T21 ne fournit pas d’identifiant : l’écran doit conserver sa barrière d’incertitude et expliquer la limite, sans fabriquer un bouton de réconciliation. Après succès, afficher montant et frais connus sans fabriquer de reçu supplémentaire.

Les changements de statut doivent pouvoir être annoncés sans déplacement forcé du focus. Texte, rôle accessible et repère visuel accompagnent chaque état ; la couleur seule ne porte pas la conclusion. [W3C | Messages d’état](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

## 5 | L’action reste à portée pendant la saisie

PAN a demandé le comportement observé dans Wave : le bouton principal reste au-dessus du clavier. `KeyboardAvoidingView` adapte la zone disponible ; `keyboardShouldPersistTaps` permet aux contrôles concernés de recevoir l’appui sans première fermeture obligatoire du clavier. [React Native | Évitement du clavier](https://reactnative.dev/docs/keyboardavoidingview), [React Native | Appuis dans une vue défilante](https://reactnative.dev/docs/scrollview#keyboardshouldpersisttaps).

**Choix T20 :** contenu défilant et bandeau d’action séparés dans le cadre adapté au clavier. Pas de hauteur de clavier codée en dur. Les champs gardent une étiquette persistante et une erreur proche. Le PIN emploie une saisie native masquée, sans faux pavé dessiné ; le masquage ne remplace pas le coffre, la vérification et les limites d’essais de T15. [React Native | Saisie masquée](https://reactnative.dev/docs/textinput#securetextentry).

Les cibles visent au moins 48 × 48 dp. La taille des caractères suit les préférences utilisateur, avec contrôle de composition à un agrandissement de 2. [Android | Accessibilité des applications](https://developer.android.com/guide/topics/ui/accessibility/apps).

## Limites et validation

Le marine et le citron prolongent un choix artistique déjà retenu ; aucune psychologie de couleur ne garantit confiance ou sécurité. Les données financières constituent le visuel principal : aucune illustration nouvelle n’est nécessaire. Les icônes originales T08 restent accompagnées de mots. Tous les textes passent par T09 et le wolof reste vide avant T33.

PAN a examiné puis confirmé les nouveaux écrans le 10 novembre 2026 avant commit et PR et autorisé la publication. Les [24 captures](validation-t20/README.md) et les résultats des contrôles locaux sont consignés dans le [suivi T20](../planning/suivi-t20.md). Captures Web, tests de composants et tests de logique ne valent ni validation TalkBack ni essai réel du clavier, de la caméra ou d’un paiement regtest. La relecture de Salam et la CI distante restent attendues ; cette confirmation ne déclare pas les dépendances natives corrigées ou intégrées.
