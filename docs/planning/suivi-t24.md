# Suivi T24 | Historique, reçus et total du jour

Projet de Salam et PAN. PAN porte l’interface de l’issue [#19](https://github.com/PapaAmad/teranga-pay/issues/19) ; Salam fournit les services et relit. État au 11 novembre 2026 : **écrans confirmés par PAN avant commit et PR ; publication autorisée**. La carte du Project privé est confirmée **En cours**. T24 dépend de T11, T22 et T23 ; le plan prévoit sa livraison le 13 novembre 2026. La publication et sa CI sont consignées dans l’issue ; aucun résultat distant n’est déduit des seuls tests locaux.

La branche `feat/T24-historique` part de T22 `0944dcb`, proposé dans la [PR #74](https://github.com/PapaAmad/teranga-pay/pull/74). Cette base conserve les interfaces précédentes ; elle ne prouve pas l’intégration native des services. La lecture authentifiée du journal et les corrections de review T23 sont publiées séparément dans la [PR #75](https://github.com/PapaAmad/teranga-pay/pull/75), head `c0b8b40975e623c685c1f48d1ba6968a23a21907`. La réponse à Salam est [consultable dans cette PR](https://github.com/PapaAmad/teranga-pay/pull/75#issuecomment-6800783912) ; aucune fusion n’est effectuée.

## Périmètre préparé

Le journal en lecture seule affiche type, montant, date et état. Il groupe les opérations par date, filtre les réceptions, les envois et les retraits simulés, permet de lire la suite et ouvre chaque détail. Une réussite donne un reçu qualifié par sa source ; attente, échec et incertitude gardent un détail sans preuve de règlement. Le partage minimal indique état et source et exclut note personnelle, facture Lightning et données de personne.

La carte du jour utilise la date d’opération `createdAt` dans `Africa/Dakar`, sans la présenter comme une date effective de règlement. Elle distingue reçus, envoyés hors frais et retraits fictifs. Le cumul des paiements ne contient ni le journal de retraits T23 ni une deuxième ligne provenant du reçu marchand T22. Les montants historiques FCFA inconnus restent inconnus ; les frais wallet ne sont pas convertis au taux courant. La [recherche](../design/historique-recherche.md), la [direction](../design/historique-direction.md) et l’[ADR 0018](../decisions/0018-historique-et-totaux.md) précisent ces conventions.

La liste utilise `SectionList` et les signes originaux T08. Les filtres, lignes et commandes prévoient des libellés accessibles et des cibles tactiles adaptées. Les montants et libellés peuvent se réorganiser quand la largeur diminue ou que le texte grandit. Tous les textes visibles viennent de T09 ; aucun wolof non relu n’est ajouté. Aucun paquet supplémentaire n’est requis.

## Dépendances et limites

- T11 fournit état, historique et abonnement du wallet. Le port T24 en retient uniquement les lectures nécessaires ; la conservation historique du FCFA et l’exactitude des dates restent des garanties à vérifier avec le fournisseur.
- T22 fournit le parcours marchand et son prix figé. Son reçu ne suffit pas à prouver une nouvelle ligne wallet ou une date de règlement ; la corrélation reste décrite dans l’[ADR 0016](../decisions/0016-encaisser-demande-et-recu.md).
- T23 porte un journal authentifié de retraits simulés. Le port mobile attend `simulation: true`, `items` et `nextCursor`. `GET /v1/withdrawals` est publié dans la PR T23 au commit ci-dessus ; sa composition native et la relecture humaine restent distinctes.
- Sans fournisseur composé, l’entrée normale explique l’indisponibilité. Les situations de développement restent fictives et ne sollicitent aucun opérateur réel.

Les lectures sont bornées à mille éléments par source. Pages restantes, erreur ou borne atteinte maintiennent un total partiel. Une lecture ancienne est signalée hors connexion ou après une panne ; T24 ne crée aucun cache disque et ne confirme aucun retrait à distance hors réseau. Le verrouillage et l’interruption masquent liste, cumul et détail. Le réessai lit une source et n’émet jamais un paiement ou un retrait.

## Vérifications exécutées

Les six contrôles locaux passent : format, lint, types, tests, outillage et
structure/traductions. La suite complète réussit avec **739 tests dans
23 suites**, dont **95 nouveaux cas T24** : 64 modèle, quatre aperçu, 23 écran
et quatre navigation. Les **112 tests d’outillage** réussissent ; un cas de lien
symbolique est ignoré, faute de droit Windows sur ce poste. Le contrôle trouve
**106 documents aux liens valides** et **51 fichiers mobiles sans texte visible
en dur**. Gitleaks ne détecte aucune fuite dans les sources mobiles examinées.

Les cas couvrent les deux sources, l’ordre des dates, les valeurs manquantes,
les frais séparés, les sommes trop grandes, la limite de jour de Dakar, les
états non réussis exclus du cumul, la pagination invalide ou interrompue, la
reprise de page, les réponses tardives et le masquage. Les tests d’écran
vérifient aussi filtres, détail et reçu, qualification de simulation, retour
Android simulé, double appui et callbacks périmés de partage sans note ni facture.

Commandes exécutées : `npm run format:check`, `npm run lint`, `npm run typecheck`,
`npm test -- --ci`, `npm run test:tooling` et `npm run repo:check`.
La [galerie](../design/validation-t24/README.md) fournit **25 captures inspectées**
des vrais composants Web, aux largeurs 390, 360 et 320 pixels. Le parcours
contrôle aussi le défilement de trois pages et sa reprise, les montants inconnus
ou extrêmes, le verrouillage et les résultats de partage. Aucun débordement
horizontal ni erreur console n’est détecté. Les actions fixes de détail restent
dans la fenêtre et mesurent au moins 48 pixels. Un partage intercepté en mémoire
ne prouve pas l’envoi natif ; aucun message externe n’est envoyé.

Le démarrage d’Expo ou un aperçu Web ne remplace pas une observation dans Expo Go sur téléphone Android. TalkBack, partage natif, longues listes, grand texte et interruption sur appareil restent à vérifier. Aucun essai natif physique ni intégration regtest achevée n’est affirmé par les travaux locaux.

PAN a confirmé les nouveaux écrans T24 le 11 novembre 2026 avant commit et PR, séparément de ses validations T20 et T22. La relecture de Salam et une CI verte restent nécessaires avant fusion squash. La tâche n’est pas déclarée terminée par cette préparation documentaire.
