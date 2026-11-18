# Attentes et reprises | T28

PAN porte les états de l’interface ; Salam porte les transports et le wallet.
`read.ts` borne chaque appel de lecture à dix secondes et nettoie son minuteur.
Une expiration indique `READ_TIMEOUT`, sans déduire que le téléphone est hors ligne.
Les contrôleurs conservent leurs gardes de révision et décident de la reprise.

`readWithDeadline` sert uniquement aux lectures : état du wallet, solde, adresse,
historique, devis et rapprochement en lecture seule. Il ne doit pas envelopper un
envoi, une création de facture, un retrait ou une écriture de journal. Expirer
l’attente d’une mutation ne prouve pas que cette mutation a été annulée.

Le transport n’est pas annulé par ce délai ; sa réponse tardive ne remplace pas
le résultat du délai. Aucun service, dépendance ou cache persistant n’est ajouté.

`startPendingWatch` notifie une attente de mutation sans rejeter sa promesse.
`RecoveryNotice.tsx` distingue lecture lente, résultat incertain et enregistrement
local lent après un résultat déjà connu. Ce dernier message ne remet pas en doute
le résultat financier affiché et disparaît quand l’écriture est acquittée.

Commande utile : `npm test --workspace @teranga-pay/mobile -- --runTestsByPath tests/reliability-read.test.ts --ci`.
