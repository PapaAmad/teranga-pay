# Suivi T28 | Réseau et reprises

12 novembre 2026 | PAN | issue [#23](https://github.com/PapaAmad/teranga-pay/issues/23).

La branche `feat/T28-reseau-et-reprises` part de T27, commit
`74f1ec75f6919a860ec476ceedcf064fffae73a1`, PR #79 ouverte. Les dépendances
T18, T20, T22 et T25 sont dans cette pile mobile ; cela ne les déclare pas
fusionnées dans `main`. Les PR T11/T15/T21 et T23 restent des dépendances de la
composition native portée avec Salam ; aucun SDK ni module serveur n’est importé.

## Périmètre

- Borner les lectures et présenter un délai dépassé sans inventer un hors ligne.
- Préserver les données connues selon les règles de confidentialité du parcours.
- Conserver les barrières d’envoi, création et retrait après une soumission lente.
- Intégrer les résultats originaux tardifs et conserver les curseurs de reprise.
- Fournir tests, matrice d’états et captures avec des ports fictifs isolés.

Aucune dépendance, infrastructure ou persistance financière supplémentaire.
Le wolof reste vide jusqu’à T33. La composition native, les essais Android et la
relecture de Salam restent distincts des tests d’interface.

## Validation locale

Les 1 112 tests mobiles passent dans 35 suites, dont 66 nouveaux cas T28 :
4 cas d’attente bornée, 16 Accueil/Recevoir, 20 Encaisser/Historique,
20 Envoyer/Retirer et 6 cas de composants réels. Un test T27 attend désormais
explicitement la fin des nouvelles lectures bornées après un refus de PIN sur
un autre écran. Les invariants financiers et les attentes vérifiées ne sont
pas assouplis. Les 114 tests d’outillage passent, avec un cas de lien symbolique
ignoré faute de droit Windows.

Les 16 captures Web couvrent les six parcours et les réponses fictives tardives.
Aucune erreur console ni débordement horizontal détecté ; les actions fixes
mesurées restent dans le cadre et gardent au moins 48 pixels de hauteur.
Le rendu Web et les API remplacées ne constituent pas des essais Android/TalkBack.

L’auto-review a corrigé le suivi des sauvegardes locales qui suivent une lecture
réussie. Le message d’enregistrement lent conserve le résultat financier déjà
connu, puis disparaît après acquittement. Une écriture encore active garde sa
barrière ; son délai ne déclenche pas un nouvel envoi. Le test de régression
vérifie ce cas après une lecture de retrait en attente devenue réussie.

PAN a confirmé les écrans T28 le 12 novembre 2026 avant tout commit ou PR.
Cette validation est propre à T28 et reste distincte de la relecture humaine de
Salam. Le Project privé #3 a placé l’issue #23 « En cours » au démarrage ;
l’issue et le Project consignent ensuite l’état courant de publication et de CI.

Les six contrôles requis passent : format, lint, types, tests mobiles,
outillage et structure/traductions. Le garde vérifie 125 documents aux liens
valides et 62 fichiers mobiles sans texte visible en dur. Aucun manifeste,
lockfile ou SDK Expo n’est modifié.

Le scan Gitleaks des 550 fichiers suivis et non suivis non ignorés ne détecte
aucun secret. Expo reste actif en SDK 58 et sert le paquet Android en HTTP 200 ;
cela vérifie sa livraison, pas son exécution sur un téléphone physique.

## Relecture de la dépendance T21

La [revue publiée sur la PR #76](https://github.com/PapaAmad/teranga-pay/pull/76#pullrequestreview-5878484126)
porte sur le commit `9e42c1703e3154a1305a381a73d6ed4facdf819b`. Deux corrections
sont demandées à Salam : préserver les reçus réglés indépendamment du cache FCFA,
et revérifier l’arrêt d’une écoute après une attente native avant publication.
Les fonctions exactes `pruneJournal` et `pollOnce` ont été exercées en mémoire
avec fournisseurs remplacés : suppression observée d’une facture contenant son
FCFA connu, puis un POST et un callback observés après arrêt. Aucun réseau ou
module natif réel n’a été utilisé et la suite complète de cette PR n’a pas été
exécutée ici. Cette revue technique ne remplace pas l’approbation humaine.

Ces corrections restent dans la branche de Salam ; T28 n’importe pas cette
implémentation native dans sa pile mobile. Les preuves d’interface restent
distinguées de la composition réelle et de sa validation Android.

Voir [recherche](../design/reseau-recherche.md),
[direction](../design/reseau-direction.md),
[décision 0021](../decisions/0021-attentes-et-reprises.md) et
[validation visuelle](../design/validation-t28/README.md).
