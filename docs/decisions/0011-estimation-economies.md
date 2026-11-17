# 0011 | Estimation d'économies

- Date : 7 novembre 2026, Dakar.
- Tâche : T34, estimation d'économies et explications simples.
- Responsable : Salam ; relecture : PAN.
- État : proposée dans la PR T34, en attente de relecture.

## Problème

Le [document de conception](../sources/Teranga_Pay_Document_de_conception.pdf) prévoit de « montrer ce que l'utilisateur aurait payé avec un envoi classique », avec une formule claire et non « un chiffre magique ». Il prévient aussi que le mobile money local est déjà bon marché (environ 1 %), et qu'on mesurera les économies réelles pendant le pilote au lieu d'annoncer un pourcentage.

## Choix

- **Une seule formule, renvoyée avec chaque résultat** : `économie = frais estimés d'un envoi classique − frais réellement payés`.
- **Une fourchette plutôt qu'un chiffre.** Chaque façon classique d'envoyer (« corridor ») a un taux bas et un taux haut, en points de base (100 = 1 %). La borne basse est arrondie vers le bas et la haute vers le haut, pour que l'arrondi ne gonfle jamais l'économie la plus prudente.
- **Hypothèses par défaut reprises de la section 2.2** du document : France → Sénégal de 2,5 à 3,8 % ; hors zone CFA de 10 à 15 % ; Wave local 1 % et Orange Money local 0,8 %, plus la taxe TTA de 0,5 % plafonnée à 2 000 FCFA. Chaque corridor porte sa source, renvoyée par `GET /v1/savings/assumptions`.
- **Configurables sans toucher au code** : `SAVINGS_ASSUMPTIONS_FILE` désigne un fichier JSON, vérifié champ par champ au démarrage. Toute erreur arrête le serveur avec un message, sans recopier le chemin. Chaque réponse indique la `version` (date) des hypothèses utilisées.
- **Résultat négatif affiché tel quel.** `outcome` vaut `economie` si même l'hypothèse basse fait gagner, `surcout` si même la haute fait perdre, et `comparable` entre les deux. On ne masque pas le cas local, où Teranga peut coûter autant ou plus.
- **Calcul côté serveur, sans donnée personnelle.** La requête ne contient que des montants, un identifiant de corridor et les frais payés : ni nom, ni numéro, ni identifiant de paiement. Jusqu'à 100 envois par appel, pour le total de l'historique (T24).

## Solutions écartées

- **Un pourcentage d'économie fixe** : c'est contraire au document de conception, et faux pour le local.
- **Des tarifs d'opérateurs codés en dur dans l'application** : il faudrait publier une nouvelle version à chaque changement de tarif.
- **Interroger des comparateurs en ligne** : c'est une dépendance externe, fragile en réseau faible, dont la licence n'est pas vérifiée.

## Conséquences

- L'application (écran d'historique ou de reçu, côté PAN) affiche la fourchette, la formule et la source à partir de codes. Le serveur ne renvoie aucun texte d'interface.
- Les hypothèses vieillissent : elles doivent être relues avant la démo, puis remplacées par les mesures du pilote.
- Les frais « réellement payés » viennent de l'application (frais du réseau Lightning convertis en FCFA, frais de retrait simulés). Le serveur ne les vérifie pas.
