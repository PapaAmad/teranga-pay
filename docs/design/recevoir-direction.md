# Recevoir T18 | Direction artistique et états

Proposition du 9 novembre 2026 pour le projet de Salam et PAN. PAN porte les écrans ; Salam relit et porte le wallet ainsi que le service d’adresse T19. La [recherche T18](recevoir-recherche.md) explique les contraintes de protocole, de lecture du QR et d’accessibilité. Cette direction prolonge la [charte T08](charte.md) et l’[accueil T16](accueil-direction.md). **PAN a confirmé les écrans T18 le 9 novembre 2026 avant commit et PR.**

## Intention | Donner son adresse, simplement

Le contenu principal devient le QR, puis l’adresse qu’il représente. Le marine, le citron et les polices locales conservent la continuité de marque ; le QR fonctionnel garde sa géométrie. Aucun nouveau visuel matriciel, photographie ou pictogramme de catalogue n’est nécessaire. Le monogramme entre T et P reste hors du code.

La barre supérieure propose un retour accessible et le titre « Recevoir ». Une courte phrase explique le geste : montrer le code ou partager l’adresse. Un grand carré blanc contient le QR sombre avec ses quatre modules de marge sur chaque côté. Le fond papier ou marine autour du carré reste distinct de la zone nécessaire au scan ; aucun cadre ne mange cette marge. Le contenu encodé est l’adresse ASCII brute, exactement identique à la valeur copiée et partagée, sans préfixe `lightning:` ajouté. Le texte précise la nécessité d’un portefeuille compatible avec les adresses Lightning.

Sous le code, le libellé « Mon adresse Lightning » précède la destination complète. Une adresse longue revient à la ligne sans ellipse et conserve une valeur accessible intégrale ; les retours visuels ne modifient jamais le texte copié ou partagé. « Copier l’adresse » porte l’accent citron et constitue l’action principale. « Partager l’adresse » garde un traitement secondaire marine ou bordé. Les boutons peuvent s’empiler pour préserver leurs libellés avec le grand texte. Seuls les dessins originaux T08 existants accompagnent les mots ; aucun nouveau symbole ambigu ne remplace un libellé.

## États à examiner

| Situation                           | Présentation attendue                                                                              | Action proposée                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Adresse disponible                  | QR net, destination complète, copie et partage disponibles.                                        | Montrer le code, copier ou ouvrir la feuille de partage.                                                           |
| Lecture en cours                    | Indicateur discret et texte de chargement dans la place du contenu attendu.                        | Attendre la réponse ; aucune fausse adresse n’est affichée.                                                        |
| Wallet ou service absent            | Message simple expliquant que l’adresse n’est pas encore disponible.                               | Revenir ou réessayer selon le contrat ; aucune destination de démo injectée dans le parcours normal.               |
| Hors connexion                      | État explicite. Une destination précédemment validée n’est conservée que si le contrat l’autorise. | Copier ou partager seulement si la donnée conservée reste autorisée ; préciser que la réception dépend du service. |
| Erreur de lecture                   | Explication locale, sans message technique brut ni donnée personnelle.                             | Réessayer avec une seule lecture en cours.                                                                         |
| Adresse invalidée ou session fermée | Ancien code retiré, limite exprimée en mots.                                                       | Obtenir une adresse valide dans une session autorisée ; aucune copie ni aucun partage de l’ancienne donnée.        |
| Copie réussie                       | Confirmation de copie après réussite, adaptée à la plateforme.                                     | Rester sur l’écran, sans état de paiement reçu.                                                                    |
| Copie ou partage impossible         | Retour local expliquant l’action qui a échoué.                                                     | Réessayer ou utiliser l’autre méthode ; l’erreur d’une action n’efface pas la destination valide.                  |
| Aperçu de développement             | Bandeau permanent annonçant une destination fictive, non payable.                                  | Examiner les interactions et les états sans paiement réel.                                                         |

L’adresse réutilisable n’expire pas du seul fait qu’elle reste affichée. T18 ne crée ni facture, ni renouvellement, ni minuterie : le prix marchand de cinq minutes et l’attente d’un client appartiennent à T22. Cette livraison ne conclut pas qu’un paiement est arrivé en observant un QR scanné, une copie ou le retour d’une feuille de partage. L’exemple nominal de développement est `exemple@teranga.example`, explicitement fictif et non payable.

## Détails à préserver

Les surfaces gardent le fond `canvas`, le blanc `surface`, le marine `primary` et l’accent `accent` documentés. Manrope sert le titre et l’adresse ; Noto Sans garde les explications et les commandes lisibles. Les erreurs et attentes associent texte et repère visuel, sans dépendre de la couleur. Les zones tactiles visent au moins 48 × 48 dp ; aucun appui long n’est nécessaire pour copier.

Le QR reste immobile et disponible pendant sa lecture. Un chargement réel reçoit une indication discrète ; aucune durée artificielle, pluie de particules ou animation de validation n’imite un transfert. Le retour depuis une autre application doit réévaluer la disponibilité conformément au contrat, sans accepter une réponse tardive d’une ancienne session.

Les libellés viennent du contexte T09. L’écran n’invente aucune traduction wolof, aucun nom de domaine opérationnel ni aucune adresse personnelle. Les données de démonstration restent neutres et identifiées. La confidentialité des clés et l’authentification du wallet relèvent de T15 ; cet écran ne crée pas de coffre et ne demande pas une phrase de récupération.

## Validation visuelle et essais restants

Les [18 captures](validation-t18/README.md) présentent les états disponible, adresse longue, copie, partage, chargement, hors connexion, indisponibilité et erreur, aux largeurs 390, 360 et 320 pixels. Le grand texte est couvert par les tests de composants. Les mesures vérifient la correspondance entre destination affichée, copie, partage intercepté et charge utile décodée. PAN a confirmé ces nouveaux écrans avant publication. Le résultat d’un décodeur reste distinct d’un scan de téléphone à téléphone.

Les captures Web examinent la composition, les débordements et le parcours réellement implémenté. Les contrôles de composants vérifient notamment les écritures échouées, les réponses tardives et l’absence de fausse réussite. Les essais Android physiques, TalkBack, feuille native de partage et confirmation système de copie restent à réaliser. La validation visuelle de PAN ne remplace pas la relecture de Salam ni les essais regtest d’intégration.
