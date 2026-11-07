# Validation de l'identité | Teranga Pay

**État : EN REVUE.** Dossier T08 du 5 novembre 2026. PAN porte la création ; Salam relit. **La direction B, « Le courant commun », est retenue artistiquement**, selon le choix communiqué par PAN le 5 novembre après discussion avec Salam. Cette décision ne vaut ni approbation de PR, ni résultat de test utilisateur, ni validation de l'intégration Android. Aucun entretien, test de reconnaissance ou parcours utilisateur n'est annoncé comme effectué dans ce document.

## Supports et portée des preuves

La [charte](charte.md) expose les règles proposées. La [planche HTML](../../assets/brand/exploration.html), son [export PNG](../../assets/brand/exports/planche.png) et son [PDF](../../assets/brand/exports/charte.pdf) servent à examiner la composition et les variantes. La source des valeurs reste [tokens.json](../../assets/brand/tokens.json).

Un rendu HTML ou un export de planche ne constitue pas une vérification de l'application Android. La taille physique des contrôles, le chargement des polices, le lecteur d'écran et le comportement au toucher doivent être vérifiés dans le contexte où ils seront employés. Une image peut montrer un état cohérent sans prouver son comportement.

Les exemples d'opérations restent une **démonstration regtest** ; le retrait Wave/Orange Money est **simulé**. Les écrans, composants ou exports graphiques ne prouvent ni un paiement réel ni la disponibilité d'une passerelle réelle.

## Relevé technique déjà observé

Les vérifications suivantes ont été renouvelées le 7 novembre 2026 après les retours de Salam. Les résultats locaux ne valent ni approbation de PR ni essai sur appareil.

| Vérification observée           | Résultat constaté                                                    | Portée                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Tests mobiles                   | 24 tests réussis.                                                    | Composants, navigation et comportement de démonstration couverts par les tests ; aucun parcours sur appareil n'est déduit. |
| Tests d'outillage sous Windows  | 94 tests : 93 réussis, 1 ignoré faute de permission de lien fichier. | Le test ignoré n'est pas annoncé réussi. Les tests de jonctions restent distincts.                                         |
| Export de l'application Android | Bundle de 961 modules et 3 fichiers de police TTF intégrés.          | Vérifie la production du bundle et des ressources ; ne prouve pas le rendu ou le fonctionnement sur téléphone.             |
| Export documentaire             | PDF de 9 pages ; pages 3, 5 et 7 rasterisées et inspectées.          | Pages clés de la version B contrôlées dans le PDF réel ; le contenu des trois directions a aussi été extrait et vérifié.   |
| Rendu documentaire étroit       | Rendu à 390 px sans débordement horizontal constaté.                 | Vérifie ce support et cette largeur ; ne vaut pas test Android, TalkBack ou validation générale du texte agrandi.          |

**Contrastes B recalculés.** Le rapport utilise les tokens B : blanc/marine 14,78:1, marine/citron 11,83:1 et texte/fond de sélection Android 11,94:1. Les tests contrôlent également les autres couples fonctionnels ; cela ne certifie pas l’accessibilité globale.

## Vérifications techniques à consigner

Le tableau définit ce qu'il faut constater. Les résultats ne seront considérés comme acquis qu'avec une preuve datée sur les fichiers ou le commit concernés. Les valeurs de contraste sont calculées dans [contrast.json](../../assets/brand/contrast.json) ; aucun ratio n'est déduit visuellement d'une capture ou inventé dans ce document.

| Vérification            | Preuve attendue                                                                                                                     | État de référence pour la revue                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Sources et licences     | Fichiers locaux, licences et manifeste [sources.json](../../assets/brand/fonts/sources.json).                                       | Sources livrées ; vérifier que les fichiers employés correspondent au manifeste.         |
| Contrastes des paires   | Calcul à partir des valeurs B exactes des tokens pour texte/fond, bouton/libellé, aide, erreur, focus, sélection et limites utiles. | Rapport B régénéré ; les paires documentées passent les seuils retenus.                  |
| Chargement des polices  | Absence d'erreur, usage de la famille attendue et comportement lisible si une ressource manque.                                     | À vérifier sur le rendu final et lors de l'intégration native.                           |
| Glyphes français/wolof  | Présence dans les fichiers chargés, absence de caractère de remplacement et inspection du rendu.                                    | À consigner après contrôle ; distinct de la relecture par locuteur.                      |
| Symbole en petit format | Inspection à 24 px, en monochrome et en inversion, à taille réelle.                                                                 | À consigner sur les exports définitifs.                                                  |
| Masques d'icône         | Variantes circulaire et arrondie sans coupe du signe, avec marge centrale.                                                          | À vérifier dans les exports ; test Android natif restant distinct.                       |
| Export PNG/PDF          | Lisibilité des textes, absence de débordement et ressources disponibles.                                                            | Export précédent observé ; inspection à renouveler avec les fichiers B définitifs.       |
| Qualité du dépôt        | Format, lint, types, tests et liens sur le commit proposé.                                                                          | Résultats à reporter avec leur SHA ; aucune CI antérieure ne valide automatiquement T08. |

Le seuil de travail est 4,5:1 pour le texte courant et 3:1 pour les indices graphiques nécessaires selon les règles détaillées dans la [recherche](recherche.md). La conformité globale de l'application ne se résume pas à ces deux chiffres. Les surfaces décoratives et les contrôles inactifs ont des conditions normatives particulières ; conserver néanmoins une compréhension claire des états.

## Matrice des composants

| Élément              | Cas à exercer                                                                     | Résultat attendu                                                                                 | Limite à garder visible                                                                           |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Bouton indisponible  | Tenter une activation au pointeur, au clavier et au toucher selon le support.     | Aucune action déclenchée ; état annoncé et libellé compréhensible.                               | Un style atténué seul ne prouve pas un contrôle désactivé.                                        |
| Bouton en chargement | Déclencher l'état et vérifier son contenu, sa taille et ses activations répétées. | Activité explicite, absence de saut de mise en page, règle d'activation documentée.              | Le prototype ne garantit pas l'absence de double paiement dans la logique future.                 |
| Champ avec focus     | Parcourir les contrôles et saisir une valeur.                                     | Focus visible, libellé conservé, valeur lisible, cible utilisable.                               | Une simulation CSS ne valide pas le focus Android ou TalkBack.                                    |
| Champ en erreur      | Provoquer une erreur de saisie puis la corriger.                                  | Message utile lié au champ, correction possible et état mis à jour.                              | La couleur ne suffit pas et le message doit correspondre à une validation réellement implémentée. |
| Carte d'opération    | Examiner attente, confirmation, échec et absence de réseau.                       | Statuts distingués par texte et forme ; montant et contexte lisibles.                            | Une attente ou une demande préparée ne doit jamais être présentée comme « Payé ».                 |
| Police et repli      | Charger les fichiers locaux puis examiner le cas d'une ressource absente.         | Texte toujours utilisable ; absence de débordement bloquant malgré les différences de métriques. | Le repli de navigateur ne prouve pas la résolution des polices dans React Native.                 |
| Texte agrandi        | Doubler la taille du texte et utiliser des libellés longs.                        | Pas de perte de montant, d'action ni de message essentiel ; retour à la ligne possible.          | Une vérification au zoom du navigateur reste distincte des réglages natifs Android.               |

Ces cas guident les essais et les éventuels tests automatisés. Un test qui retrouve seulement les mêmes valeurs que les tokens ne prouve pas l'accessibilité ; il faut vérifier le rendu ou le comportement qui échouerait si la règle était mal appliquée. Les captures doivent préciser support, dimensions, réglage de texte et état présenté.

## Protocole de revue humaine

Prévoir **5 à 8 personnes**, pour une première exploration qualitative : personnes habituées à encaisser, à recevoir un envoi familial ou à en envoyer, avec des usages du français et du wolof. Ces séances repèrent des difficultés ; cet échantillon ne représente pas statistiquement le Sénégal ni l'ensemble du marché. Recueillir uniquement les informations nécessaires, sans donnée de paiement réelle.

1. **Reconnaissance sans explication.** Présenter le monogramme B seul, en monochrome et à 24 px, avant de montrer le nom. Demander ce qu'il évoque et les marques auxquelles il fait penser. Consigner les mots employés, sans annoncer d'abord les lettres T et P ou l'idée de courant commun.
2. **Choix artistique et réception.** Examiner B sur les situations du brief, puis distinguer compréhension et préférence esthétique. Si A et C sont montrées pour comparaison, conserver les mêmes contenus et alterner l'ordre ; rappeler qu'elles sont des explorations non retenues. Un retour utilisateur utile peut conduire à corriger B sans transformer la séance en validation statistique du choix artistique.
3. **Lecture de l'interface.** Demander de lire un montant en FCFA, trouver l'action principale et repérer les frais. Présenter un montant long et les réglages de texte agrandis. Aucun numéro personnel n'est saisi.
4. **Compréhension des états.** Faire expliquer une opération en attente, une confirmation, une erreur et une consultation sans réseau. Vérifier qu'une demande préparée n'est pas comprise comme un paiement terminé.
5. **Pictogrammes dans leur contexte.** Comparer la compréhension avec et sans libellés ; conserver un texte pour les commandes ambiguës. Demander ce que signifie le retrait indiqué comme simulé.
6. **Vocabulaire et wolof.** Faire relire les textes par des locuteurs natifs. Distinguer disponibilité des glyphes, qualité de la traduction et compréhension du parcours.

Une séance peut employer une planche ou un prototype sans opération financière. Pour les essais de parcours natifs, noter appareil Android, taille d'écran, réglage de texte, éclairage et conditions réseau. Prévoir un appareil modeste et une lecture en extérieur. Les personnes doivent savoir qu'elles évaluent une proposition et une démonstration.

## Compte rendu et décision

Pour chaque observation, enregistrer le support et sa version, la consigne, ce que la personne a compris, la difficulté rencontrée et la modification proposée. Une citation anonymisée peut aider à comprendre une interprétation ; elle ne doit pas être transformée en pourcentage de satisfaction. Regrouper les problèmes récurrents tout en gardant les contre-exemples.

Les critères de revue sont la reconnaissance, la lisibilité des montants, la compréhension des états, la différenciation et la facilité de déploiement. Si le monogramme T/P se lit mal à petite taille, revoir sa géométrie ; s'il évoque surtout une autre marque ou un autre secteur, revoir le signe ou son contexte ; si l'accent citron gêne la lecture, corriger son usage. Conserver la décision artistique B communiquée par PAN et dater les ajustements ainsi que le retour de Salam sur la livraison.

La livraison peut être présentée pour relecture avec des preuves techniques et des limites explicites. Le choix artistique B, l'approbation de la PR, les tests avec des utilisateurs et la vérification sur Android sont des étapes distinctes ; aucune case du protocole utilisateur n'est cochée par la seule génération d'une charte ou d'un export.

## Contrôles de la livraison B

Le 5 novembre, format, lint, types et contrôle du dépôt réussissent. Les deux suites mobiles totalisent 14 tests réussis. Les outils totalisent 88 tests : 87 réussis et un lien fichier ignoré faute de permission Windows ; les jonctions sont exercées. Les tests contrôlent aussi la cohérence des SVG avec les sources natives et les contrastes, dont le texte sélectionné sur Android.

L’export Android B produit un bundle de 961 modules avec les trois TTF. Le PDF B contient neuf pages ; le texte des pages clés et les trois directions sont vérifiés, les pages 3, 5 et 7 ont été rasterisées pour inspection. Le document HTML est vérifié à 390 px sans débordement horizontal. Aucun essai sur téléphone physique n’est déduit de ces contrôles.

L’introduction tracée est décodée sur 195 images : 6,5 secondes, 1920 × 1080, 30 images par seconde, H.264 yuv420p, sans audio. Sa forme finale masquée est identique au monogramme de référence en 640 × 640. Pause, rejeu et préférence de mouvement réduit sont exercés dans le navigateur.

La comparaison npm sur la base T07 et T08 relève les mêmes 27 alertes (9 faibles, 16 modérées, 2 élevées), sans nouveau paquet affecté. Ce relevé daté ne prétend pas résoudre les alertes préexistantes. La CI du commit publié reste à consulter dans sa PR ; aucune CI T07 n’est utilisée comme preuve de T08.

## Améliorations après la première revue T08

La galerie native conserve maintenant les appuis sur les commandes après une saisie (`keyboardShouldPersistTaps="handled"`), ferme le clavier au défilement et ajuste les insets sur iOS. Le comportement de capture du premier appui a été confirmé dans le code React Native ; Jest remplace ScrollView et ne permet pas de présenter cela comme un essai de clavier sur appareil.

Le rapport de contraste couvre 18 couples fonctionnels, avec les couleurs exactes, des ratios non arrondis pour les décisions de seuil et une génération reproductible depuis les tokens. Les tests vérifient les bornes connues, les seuils, l’actualité du rapport et les SHA-256/tailles des trois TTF livrées et deux licences originales. Les licences restent inchangées, espaces finaux amont inclus.

La motion verticale ajoute un format 1080 × 1920 au 1920 × 1080 : même durée de 6,5 secondes, 195 images à 30 images par seconde, H.264 yuv420p et absence d’audio. Le tracé reste sur place. Les deux formats disposent d’une source HTML unique, d’un script de rendu reproductible et d’une vérification de géométrie. Ils ne sont pas insérés dans le démarrage mobile.

Le rendu documentaire est aussi reproductible : son relevé d’export est lié au hash du HTML. Ces éléments améliorent la vérification et la maintenance ; les essais Android réels et l’approbation de la PR restent distincts.

## Dernière vérification locale

Après les correctifs, les six commandes requises réussissent : format, lint, types, tests mobiles, tests des outils et contrôle documentaire. Résultat : 14 tests mobiles réussis ; 88 tests d’outillage, dont 87 réussis et un lien fichier ignoré sous Windows. L’échec simulé d’une TTF interrompt le rendu documentaire avant toute sortie ; un rendu normal charge les trois faces attendues. Les régressions de flux FFmpeg couvrent fermeture sans drain, rejet et fin prématurée, avec nettoyage des écouteurs et attente bornée ; un rendu complet temporaire réussit également.

La relecture indépendante confirme les deux correctifs. La galerie utilise les composants et reste une ébauche du front ; aucun écran financier connecté ou paiement réel n’est déduit de ces résultats. Les six contrôles GitHub devront être vérifiés sur le commit publié de T08.

## Retours de Salam du 7 novembre

Les [six remarques](https://github.com/PapaAmad/teranga-pay/pull/47#issuecomment-6706268259) sont traitées dans la PR T08. La branche a été remise au-dessus du correctif T07 `8d10132`, sans mélanger les changements des deux tâches dans leur diff respectif.

- Les deux Noto passent de 1 260 388 à 259 428 octets. Les trois polices totalisent 357 424 octets avant compression. Le script FontTools 4.68.0 reproduit les mêmes empreintes, refuse un original altéré sans changer les sorties et vérifie les caractères requis. Une comparaison indépendante des 1 045 points de code conservés par Noto confirme les métriques et les contours inchangés. Manrope et les licences restent originales ; les empreintes amont sont conservées dans le manifeste.
- L’accueil utilise un contenu défilable, les boutons de marque et les tokens. Le parcours de navigation reste testé. Le contrôle de structure exige un contenu pouvant grandir ; il ne prouve pas la mesure physique du défilement avec le texte agrandi sur Android.
- Les tests exercent les cibles minimales de 48 dp dans plusieurs états du bouton et du champ, l’enregistrement des familles depuis les tokens et leur usage quand le chargement réussit.
- Le montant fictif utilise U+00A0 entre les milliers et avant FCFA. Ce caractère insécable existe dans les trois TTF ; il évite de prendre U+202F comme exemple pour Manrope, qui ne possède pas cette espace fine.
- Après « Continuer sans attendre », les polices de marque s’appliquent dès qu’elles sont prêtes. Un test conserve la route ouverte et le texte déjà saisi pendant ce changement ; le bandeau de repli disparaît.
- Le rendu vidéo exige les deux faces réellement utilisées dans l’état `loaded` et surveille les ressources indisponibles. Un essai Edge confirme qu’un simple `fonts.check()` accepte parfois le repli, tandis que le contrôle corrigé refuse une face absente avant tout poster ou MP4. Quatre nouveaux tests couvrent les familles absentes, les mauvais poids, l’attente du chargement et son échec.

Le PDF de neuf pages, ses PNG et les deux vidéos ont été régénérés. Les faces attendues sont chargées ; le document ne déborde pas à 390 px. Chaque MP4 contient 195 images décodables à 30 images par seconde, sans audio, avec une durée de 6,5 secondes ; le symbole final conserve zéro canal différent de la source. Les rendus PNG et MP4 restent identiques en octets à ceux précédant le sous-ensemble ; le PDF embarque les nouvelles ressources.

L’export Android produit 961 modules et les trois TTF allégées. Les contrôles locaux comprennent 24 tests mobiles réussis et 94 tests outils, dont 93 réussis et un lien fichier ignoré sous Windows. La CI publiée de T08 doit encore confirmer son propre commit ; les résultats verts T07 ne la remplacent pas. La relecture indépendante ne relève pas d’autre défaut actionnable. Les essais Android physiques, TalkBack et utilisateurs restent à mener.
