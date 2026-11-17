# Onboarding T14 | Recherche et intentions de conception

Recherche documentaire du 8 novembre 2026, actualisée le 9 novembre, pour le projet de Salam et PAN. PAN porte les écrans ; Salam porte la sécurité et la logique du wallet T15. Cette note explique les choix proposés pour T14. Elle ne rapporte aucun entretien, test utilisateur local, essai TalkBack ou essai sur appareil effectué. La proposition visuelle reste à montrer à PAN avant tout commit ou PR.

## Ce que l'on cherche à rendre possible

Le parcours doit permettre de choisir sa langue, comprendre ce qui va être créé, définir son PIN, sauvegarder les mots fournis par le wallet et vérifier cette copie. C'est le périmètre des PDF : conception, pages 9 et 10 pour les principes et la première utilisation, puis sécurité pages 14 et 15 ; plan d'équipe, table de T14 et T15. Les originaux restent dans [sources](../sources/README.md). Le PIN précède ici la création des mots parce que l'API `create(pin)` protège le coffre dès sa création ; cet ajustement de l'ordre du PDF découle du contrat technique, pas d'une loi psychologique. L'[ADR 0012](../decisions/0012-onboarding-protection-et-integration.md) en décrit les conséquences.

La personne doit pouvoir expliquer la différence entre le code qui ouvre l'application et la phrase qui protège l'accès aux clés. Elle doit savoir qu'une personne se présentant comme le support ne doit pas recevoir cette phrase. Une interface séduisante ou un quiz réussi ne démontre pas ces deux compréhensions.

Les personas des PDF donnent des situations à explorer. Ils ne prouvent ni un niveau de lecture, ni une préférence de couleur, ni une habitude numérique commune à tous les utilisateurs sénégalais. Les références graphiques locales de `references/ecrans/` servent à examiner des compositions ; elles restent ignorées par Git. Leur présence ne constitue pas une étude de terrain.

## Nature des preuves

Les études ci-dessous donnent des observations dans leurs contextes. Les recommandations W3C et Android donnent des repères de conception et d'implémentation. Les documents de wallets décrivent leurs mécanismes techniques. Les décisions Teranga Pay sont des propositions à vérifier : aucune de ces sources ne démontre qu'un nombre précis d'écrans ou notre palette sera optimal pour notre public.

### 1 | La sauvegarde est aussi un problème d'accessibilité

**Zhou et al., SOUPS, août 2023 :** [Iterative Design of An Accessible Crypto Wallet for Blind Users](https://www.usenix.org/conference/soups2023/presentation/zhou), [article original](https://www.usenix.org/system/files/soups2023-zhou.pdf).

**Observation.** Plusieurs évaluations de MetaMask puis d'une refonte impliquent 44 novices au total, dont 23 personnes aveugles et une malvoyante. Les auteurs observent des difficultés combinant apprentissage, sauvegarde et accès aux commandes, notamment des boutons insuffisamment nommés et la transcription des mots. La refonte améliore l'expérience observée.

**Limite.** Ce n'est pas un essai d'un wallet Lightning sur Android au Sénégal. L'export chiffré proposé dans leur prototype ne valide pas l'ajout d'un export dans Teranga Pay.

**Décision T14.** Numéroter chaque mot, conserver l'ordre de lecture et donner un nom aux commandes. Le test vérifie quelques positions à partir de la copie ; il ne demande pas de réciter toute la phrase. Son accessibilité et une aide adaptée restent à éprouver humainement.

### 2 | Simplifier le texte ne suffit pas à rendre une interface comprise

**Medhi et al., ACM TOCHI, avril 2011 :** [Designing Mobile Interfaces for Novice and Low-Literacy Users](https://www.microsoft.com/en-us/research/publication/designing-mobile-interfaces-for-novice-and-low-literacy-users/).

**Observation.** Les auteurs présentent une enquête auprès de 90 personnes dans quatre pays, puis des comparaisons d'interfaces auprès de plus de 70 personnes en Inde. Dans leur contexte bancaire mobile, l'interface graphique donne le meilleur taux de réalisation ; la parole aide certains participants qui comprennent le système vocal.

**Limite.** Appareils, langues et populations diffèrent des nôtres. L'étude n'autorise pas à supprimer tous les textes ou à supposer qu'une icône originale sera comprise.

**Décision T14.** Associer un dessin utile à une phrase courte et une action nommée. Employer « noter les mots » avant d'expliquer le vocabulaire technique. Aucune voix ni traduction wolof improvisée ; la relecture native reste T33.

### 3 | La confiance perçue ne remplace pas la compréhension de la garde

**Yu et al., CHI, mai 2024 :** [« Don't Put All Your Eggs In One Basket » : How Cryptocurrency Users Choose and Secure Their Wallets](https://www.sauvikdas.com/uploads/paper/pdf/52/pdf.pdf), version diffusée par un auteur.

**Observation.** Des entretiens avec 24 utilisateurs montrent des choix liés à l'usage, à la commodité et aux risques perçus. L'aide de proches peut soutenir la sécurité et créer d'autres problèmes de confiance. Des participants expriment aussi des doutes sur la garde de leurs clés.

**Limite.** Les déclarations ne mesurent pas la résistance effective à une attaque ; l'échantillon n'est pas représentatif de nos futurs utilisateurs.

**Décision T14.** Expliquer qui conserve les clés sans badge de sécurité absolue, statistique inventée ou faux témoignage. Une aide peut expliquer le parcours, sans demander de montrer les mots. Un mode de démonstration doit être nommé explicitement.

### 4 | Montrer où l'on est et ce qui reste à faire

**W3C COGA, première publication le 29 avril 2021 :** [Make Each Step Clear](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p04-clear-steps/).

**Recommandation.** Dans un processus à plusieurs étapes, rendre visibles la position actuelle, les étapes achevées, celles qui restent et les choix importants. Cela aide à se réorienter après une distraction.

**Limite.** C'est un guide complémentaire aux WCAG, pas un résultat expérimental imposant une barre ou un nombre d'étapes. Il ne constitue pas une certification de l'application native.

**Décision T14.** Employer un titre de phase et un repère textuel de progression, compréhensibles sans couleur. Garder le même ordre et la même place pour le bouton principal. Séparer la préparation de la sauvegarde de l'affichage des mots sensibles.

### 5 | Une erreur doit indiquer comment continuer

**W3C WAI, documentation consultée le 8 novembre 2026 :** [User Notification | Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/notifications/) et [Help Users Avoid Mistakes and Know How to Correct Them](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o4-minimize-mistakes/).

**Recommandation.** Associer les erreurs aux champs et décrire la correction, sans se limiter à une bordure rouge. Le guide cognitif préconise un retour possible et l'absence de délais inutiles qui font perdre le travail.

**Limite.** Les exemples Web demandent une adaptation aux annonces et au focus natifs. Une protection du wallet peut légitimement imposer un verrouillage ; supprimer tout délai n'est pas une règle de sécurité.

**Décision T14.** Au quiz, expliquer quelle position vérifier et proposer de revoir la phrase. Pas de score humiliant, de compte à rebours ni de pénalité de verrouillage pour une erreur de copie. Pour la confirmation du PIN, une erreur de correspondance invite à recommencer la confirmation ; les limites d'authentification relèvent de T15.

### 6 | Le PIN local est distinct d'un mot de passe de compte

**NIST SP 800-63B-4, édition 2025, section 3.2.10 :** [Activation Secrets](https://pages.nist.gov/800-63-4/sp800-63b.html#activation-secrets).

**Recommandation.** Le NIST distingue les secrets vérifiés localement de ceux transmis à un serveur. Pour les secrets d'activation, il exige au moins quatre caractères, recommande au moins six, accepte un PIN numérique et prévoit une limitation des essais.

**Limite.** Ce texte traite de l'authentification numérique, pas d'une certification des wallets Bitcoin. Ses règles de mots de passe serveur ne se transposent pas au PIN de Teranga Pay. Un délai d'interface n'est pas une protection du coffre.

**Décision T14.** Présenter clairement un code de six chiffres et une confirmation, avec libellé et aide persistants. Ne jamais stocker le PIN dans les préférences de langue, la navigation ou un journal. La dérivation, la vérification, les limites d'essais et la récupération effective restent des responsabilités du module T15.

### 7 | Protéger l'écran ne signifie pas empêcher toute observation

**Android Developers, documentation consultée le 8 novembre 2026 :** [Secure sensitive activities](https://developer.android.com/security/fraud-prevention/activities?hl=en).

**Recommandation.** `FLAG_SECURE` protège la fenêtre des captures et de certains affichages non sûrs. Android en documente des limites, notamment face aux superpositions et à certaines formes d'enregistrement.

**Limite.** Ce mécanisme ne protège pas d'un appareil photo externe, d'une personne à proximité ou d'un téléphone compromis. Sa présence dans une configuration n'est pas un essai sur l'APK.

**Décision T14.** Demander un moment à l'abri des regards, révéler les mots volontairement, les masquer au passage en arrière-plan et ne pas proposer de copie ou de partage de la phrase. Vérifier la protection des écrans sensibles dans le build natif ; ne pas afficher « capture impossible » sans cette preuve. Ne pas annoncer spontanément les mots à haute voix.

### 8 | Demander une permission quand elle devient utile

**Android Developers, documentation consultée le 8 novembre 2026 :** [Request runtime permissions](https://developer.android.com/training/permissions/requesting).

**Recommandation.** Demander une permission dans le contexte de l'action concernée, permettre le refus et maintenir une utilisation dégradée raisonnable.

**Limite.** La documentation décrit des principes de plateforme ; elle ne prouve pas qu'une permission particulière est nécessaire à notre onboarding.

**Décision T14.** Aucun accès caméra, contacts ou localisation pour découvrir l'application et noter les mots. La caméra sera demandée lors de l'usage réel du scanner dans la tâche concernée. Le choix de langue se conserve localement sans demander de compte personnel.

### 9 | Une phrase seule n'est pas une sauvegarde de tous les états Lightning

**ZEUS, documentation de son wallet LDK Node, consultée le 8 novembre 2026 :** [Backup and Recovery](https://docs.zeusln.app/for-users/local-wallets/ldk-node/backup-and-recovery/). **Lightning Labs, documentation LND, même date de consultation :** [Secure Your Lightning Network Node](https://docs.lightning.engineering/lightning-network-tools/lnd/secure-your-lightning-network-node).

**Constat technique.** ZEUS distingue les clés récupérables depuis la phrase et les états de canaux sauvegardés par VSS. LND décrit séparément phrase et sauvegarde de canaux. Les mécanismes sont propres à chaque implémentation.

**Limite.** Lire ces documents ne signifie pas que Teranga Pay possède VSS ou une procédure de restauration opérationnelle. Les fichiers de sauvegarde ne sont pas interchangeables entre SDK.

**Décision T14.** Ne jamais écrire « vos douze mots récupèrent tout votre argent ». Expliquer que la récupération Lightning dépend aussi de la sauvegarde prévue par le wallet. La formulation finale et toute promesse de restauration doivent être vérifiées avec Salam et le module T15 ; T14 n'ajoute pas son propre protocole de sauvegarde.

## Traduction en parcours et en direction artistique

Les décisions suivantes sont des choix de conception de PAN, motivés par les éléments précédents et par la [charte T08](charte.md). Elles restent à éprouver dans le parcours réellement construit.

| Moment            | Intention et contenu                                                       | Conséquence visuelle ou comportementale                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Découvrir         | Dire ce que l'application permet et identifier le réseau de démonstration. | Une composition de marque forte, puis une action principale. Pas de carrousel promotionnel obligatoire ni d'animation de 6,5 secondes avant de pouvoir agir.                |
| Choisir la langue | Présenter les choix et ce qui est effectivement traduit.                   | Français initial et mémorisé. Wolof explicitement à venir, non sélectionnable avant T33 et sa relecture native ; aucune traduction fabriquée.                               |
| Préparer          | Expliquer création, sauvegarde et PIN avant de montrer un secret.          | Surface calme et texte court ; liste numérotée, matériel de copie et intimité. L'illustration aide à comprendre une action, pas à remplir l'espace.                         |
| Définir le PIN    | Distinguer ouverture de l'application et récupération des clés.            | Champ masqué, clavier adapté, six positions accessibles et confirmation explicite. Pas d'annonce du contenu du code par le lecteur d'écran.                                 |
| Noter les mots    | Aider à copier sans perdre l'ordre et rappeler leur caractère privé.       | Grille numérotée lisible et défilable, ordre accessible explicite, révélation volontaire. Aucun bouton de partage de la phrase.                                             |
| Vérifier la copie | Confirmer quelques positions à partir de la sauvegarde.                    | Une question précise à la fois ou un petit groupe clairement nommé, retour pour revoir, erreur près de la réponse. Réussir ne prouve pas la conservation future du support. |
| Terminer          | Résumer les actions effectivement accomplies.                              | Confirmation sobre, bouton de suite clair. Ne pas annoncer « wallet prêt » si seul un prototype ou un adaptateur de démonstration a répondu.                                |

La palette marine, papier et citron est conservée parce que Salam et PAN l'ont choisie. Le citron sert à guider l'action et à souligner un détail ; il ne devient pas une preuve scientifique de confiance. Le [travail couleur T08](recherche.md) en explique déjà les limites. La typographie Noto porte les instructions, Manrope les titres. Les cibles visent 48 dp ; le texte doit pouvoir grandir sans découpe ni boutons qui sortent du parcours.

La cohérence de placement, les états de chargement nommés et les retours d'erreur construisent une expérience prévisible. Le mouvement éventuel accompagne une transition et respecte la réduction des animations. Une phrase sensible ne doit jamais apparaître dans une animation automatique, une capture de validation ou une télémétrie. Les planches publiées emploient uniquement des repères de démonstration non utilisables comme phrase de wallet.

## Ce qu'il faudra réellement vérifier

Les contrôles de code peuvent établir les transitions, les erreurs, la persistance de langue et l'absence de secrets dans les données persistées. Ils ne valident pas la compréhension ni la sécurité de l'appareil.

Pour une revue humaine, demander de réaliser le parcours avec du matériel de démonstration, sans confier d'argent ni de secret réel. Faire expliquer avec ses propres mots le rôle du PIN, celui de la phrase et ce que l'aide peut demander. Observer la capacité à corriger une erreur de copie et à reprendre après interruption. Recueillir séparément l'impression de sérieux et la réussite de ces actions. Consigner les difficultés réellement constatées ; aucun taux de réussite ou nombre de participants n'est annoncé ici.

La vérification native devra couvrir écran étroit et grand texte, défilement avec clavier, ordre TalkBack, retours Android, arrière-plan, capture d'écran, démarrage sans réseau et reprise d'un wallet déjà créé. Une sauvegarde Lightning et une restauration de bout en bout demandent leur propre preuve côté wallet. Tant que ces essais ne sont pas effectués, les signaler comme restant à conduire.
