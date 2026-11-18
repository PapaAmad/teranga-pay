# 0021 | Attentes bornées et reprises sans double opération

12 novembre 2026 | T28 | écrans confirmés par PAN avant publication ; décision à relire par Salam.

## Problème

Les parcours ont déjà des états hors ligne et des protections contre les doubles
opérations. Plusieurs promesses de lecture ou de soumission peuvent cependant ne
jamais répondre. Un minuteur d’interface ne constitue pas une annulation et ne
permet pas de conclure à un échec financier.

## Choix

`reliability/read.ts` borne un appel de lecture à dix secondes. Le délai expose
uniquement `READ_TIMEOUT`. Les autres exceptions deviennent `READ_FAILED`, sans
reprendre leurs détails. Les contrôleurs gardent leurs révisions : une réponse
tardive ne remplace pas une reprise plus récente ou un écran masqué. Le helper
ne prétend pas interrompre le transport ; l’interface native pourra fournir cette
capacité lors de sa composition, sans la simuler ici.

Les lectures concernées sont l’état wallet, le solde, l’adresse, les devis, les
pages d’historique, les rapprochements en lecture seule et le chargement du
journal de retrait. Les ressources indépendantes restent indépendantes. Encaisser
rapproche au maximum la demande courante et vingt archives en parallèle afin
qu’une série de fournisseurs muets ne multiplie pas le délai par vingt et un.

Une mutation n’est jamais enveloppée dans cette course de promesses.
`startPendingWatch` informe l’interface après dix secondes, mais continue de
suivre la promesse originale. Envoyer conserve son opération de session ;
Encaisser conserve sa tentative de création ; Retirer conserve l’intention
journalisée et sa barrière interne. Un résultat tardif valide peut faire évoluer
le suivi. Il ne déclenche aucune nouvelle opération.

Un journal de retrait dont l’écriture initiale n’est pas acquittée interdit tout
POST. Si cet acquittement arrive après le délai d’interface, il ne déclenche pas
le POST initial automatiquement : une action explicite reprend la même intention.
Après un POST déjà remis, la réponse originale reste suivie. Une suppression de
journal encore en cours n’autorise pas une nouvelle intention par supposition.

La consultation locale reste celle du wallet et des données déjà connues en
mémoire. Aucun cache supplémentaire de solde, facture, PIN ou secret n’est écrit
sur disque. La conservation durable de l’intention de retrait reste celle de T25.

## Solutions écartées

- Déduire « hors ligne » de tout délai dépassé.
- Transformer l’absence de réponse en échec financier ou en reçu réussi.
- Débloquer une seconde mutation parce que le minuteur a expiré.
- Rejouer les paiements automatiquement au retour du réseau, comme une file
  d’attente générique du PDF pourrait le suggérer.
- Utiliser le délai de lecture pour rejeter une écriture locale encore active.

## Conséquences

L’utilisateur peut reprendre une lecture ou quitter le suivi d’une opération
lente. Le délai est par appel, pas une promesse de durée totale du parcours.
Une écriture native définitivement muette peut conserver sa barrière jusqu’au
redémarrage ou à une réconciliation permise par son contrat ; T28 ne prétend pas
annuler cette écriture. Les essais de transports natifs, de réseau Android et de
redémarrage physique restent à composer avec Salam.

Voir [recherche](../design/reseau-recherche.md),
[matrice visuelle](../design/reseau-direction.md) et
[suivi](../planning/suivi-t28.md).
