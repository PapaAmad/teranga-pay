# Recevoir T18 | Recherche et principes

Note du 9 novembre 2026 pour le projet de Salam et PAN. T18 couvre le QR de réception, l’adresse Lightning, la copie et le partage. Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf), section 6, pages 10 et 11, décrit le parcours où une personne partage son adresse. Le [plan d’équipe](../sources/Teranga_Pay_Plan_equipe_et_regles.pdf), pages 8 et 9, confie T18 à PAN et le service d’adresse T19 à Salam. Cette recherche prolonge la [charte T08](charte.md) et les [principes de l’accueil T16](accueil-recherche.md). Les sources externes ont été consultées le 9 novembre 2026.

Les règles ci-dessous distinguent les contraintes de lecture et de protocole des choix artistiques. Elles ne démontrent ni une préférence du public sénégalais pour cette composition, ni une confiance provoquée par la couleur marine.

## 1 | Une adresse et une demande de paiement sont différentes

LUD-16 définit un identifiant lisible de la forme `nom@domaine`, que le portefeuille émetteur résout vers un service LNURL-pay. LUD-06 décrit ensuite l’obtention d’une demande de paiement adaptée au montant choisi. L’adresse est donc un point d’entrée réutilisable ; elle n’est pas elle-même une facture BOLT11. [LUD-16 | Identifiants statiques](https://github.com/lnurl/luds/blob/luds/16.md), [LUD-06 | LNURL-pay](https://github.com/lnurl/luds/blob/luds/06.md).

**Application :** titrer « Mon adresse Lightning », afficher l’adresse complète et expliquer que la personne qui paie utilise un portefeuille compatible avec les adresses Lightning. Le QR encode cette adresse brute, en ASCII, à l’identique de la valeur copiée ou partagée ; il n’ajoute aucun préfixe. L’interface lit l’adresse actuelle fournie par le service prévu pour T19 ; elle ne fabrique ni adresse, ni facture, ni preuve de réception. Le choix de montant et le prix marchand figé appartiennent à T22.

BOLT11 possède une durée de validité ; passé son terme, le protocole recommande de ne plus tenter le paiement ni l’accepter. T18 ne crée aucune de ces demandes et n’expose donc ni renouvellement ni compte à rebours. L’adresse réutilisable ne prend pas une expiration de cinq minutes par analogie avec le prix marchand. [BOLT11 | Encodage des paiements](https://github.com/lightning/bolts/blob/master/11-payment-encoding.md).

**Choix de format :** LUD-17 décrit des schémas d’URL tels que `lnurlp://` et reste marqué comme brouillon ; il ne définit pas `lightning:nom@domaine`. T18 conserve donc l’adresse brute comme contenu du QR. Ce choix ne constitue pas une preuve de compatibilité universelle des lecteurs : les essais T19 doivent vérifier la reconnaissance et la résolution par le portefeuille retenu. [LUD-17 | Schémas de protocole](https://github.com/lnurl/luds/blob/luds/17.md).

**Limite :** la présence d’une adresse ou d’un QR ne garantit ni la disponibilité du service, ni la capacité de réception, ni la compatibilité de chaque portefeuille. Le branchement T19 et les essais regtest doivent établir ces propriétés séparément.

## 2 | Le QR est une donnée lisible avant d’être un objet de marque

DENSO WAVE impose un espace vide de quatre modules sur chacun des quatre côtés du symbole. Un module est une cellule du QR, pas une marge fixe de quatre pixels. Le fabricant prévient aussi qu’un code déformé ou décoré peut ne plus être lisible. [DENSO | Zone du QR](https://www.qrcode.com/en/howto/code.html/index.html), [DENSO | Génération et problèmes de lecture](https://www.qrcode.com/howto/generate.html).

**Application :** modules sombres nets sur un carré blanc, marge calculée avec le nombre de modules et aucune superposition de logo. Le cadre, les arrondis, le citron et les textes restent hors de cette zone. Une largeur généreuse et adaptative garde le code central ; aucune animation ne le trace, ne le déforme ou ne le remplace pendant sa lecture.

**Limite :** une taille en points et un contraste calculé ne prouvent pas une lecture par caméra. Décoder le rendu pour comparer sa charge utile attendue, puis tester un autre téléphone avec le QR affiché sur Android à plusieurs luminosités. Un aperçu Web et un test du générateur ne remplacent pas ce scan physique.

## 3 | Copier et partager ont des résultats précis

Android attend un retour visuel lors d’une copie. Android 13 et les versions suivantes affichent déjà une confirmation système ; le guide recommande d’éviter les toasts ou snackbars supplémentaires. Les versions antérieures nécessitent un retour fourni par l’application. [Android | Retour de copie](https://developer.android.com/develop/ui/views/touch-and-input/copy-paste).

**Application :** copier l’adresse intégrale après un appui explicite. Confirmer uniquement après réussite de l’écriture ; proposer un nouvel essai si elle échoue. Adapter le retour à la plateforme et prévoir une annonce accessible sans multiplier les notifications. Un retour de copie ne signifie jamais « Argent reçu ».

L’API `Share` de React Native ouvre la feuille de partage ; sur Android, sa promesse renvoie toujours `sharedAction`. Ce retour ne permet donc pas d’affirmer qu’une personne a reçu le message. **Application :** ouvrir le partage du texte vérifié, traiter les erreurs et garder l’écran utilisable au retour. Éviter « Adresse envoyée » et toute célébration de paiement. [React Native | Share](https://reactnative.dev/docs/share).

## 4 | Le QR ne doit pas être le seul moyen de recevoir

Android demande des libellés compréhensibles pour les éléments utiles. WCAG recommande d’exposer les messages d’état aux aides techniques sans déplacer systématiquement le focus. **Application :** adresse accessible en texte intégral, boutons nommés « Copier l’adresse » et « Partager l’adresse », cibles tactiles d’au moins 48 × 48 dp et retour de copie localisé. La lecture suit le titre, l’explication, le QR, l’adresse, puis les actions. Le texte et la forme complètent les couleurs d’état. [Android | Accessibilité](https://developer.android.com/guide/topics/ui/accessibility/principles), [Android | Cibles tactiles](https://support.google.com/accessibility/android/answer/7101858?hl=en), [W3C | Messages d’état](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

**Limite :** TalkBack, le grand texte, le contraste en extérieur et les confirmations système doivent être vérifiés sur appareil. Tous les libellés passent par T09. Le français reste la langue disponible ; le catalogue wolof ne sera rempli et relu qu’en T33.

## Hypothèse de composition à présenter à PAN

Une page calme, un grand QR blanc au centre, l’adresse immédiatement dessous et une action de copie dominante devraient permettre de montrer l’écran à une autre personne ou d’envoyer son identifiant sans changer de parcours. C’est une hypothèse de design, à examiner dans les captures et les essais ; aucun résultat utilisateur n’est inventé. La [direction T18](recevoir-direction.md) décrit cette proposition. **PAN a confirmé les nouveaux écrans le 9 novembre 2026 avant commit et PR.** Cet accord visuel ne constitue pas un test de compréhension avec les publics concernés.
