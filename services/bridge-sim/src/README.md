# Cœur de la passerelle simulée | T23

PAN porte `store.ts` (devis, comptes fictifs, réservations SQLite et journal opérateur) et `service.ts` (création protégée, simulation et réconciliation). `types.ts` définit les données publiques ; `index.ts` expose les ports à l’API de Salam. Aucun opérateur réel ni wallet mobile n’est contacté.

La réservation du total précède tout appel au simulateur. Les contraintes uniques lient propriétaire, clé d’idempotence et devis ; les états terminaux ne sont jamais réécrits. Les devis et les identités restent dans SQLite après redémarrage, sans remise à zéro des soldes fictifs. Une opération incertaine conserve ses fonds réservés ; la réconciliation lit le même journal sans soumettre un second retrait.

`retry` est une reprise explicite de la même référence : lecture opérateur d’abord, puis resoumission du même identifiant seulement si cette lecture réussit sans résultat. `BridgeProvider.submit` doit être idempotent par `withdrawal.id` et charge utile figée ; le simulateur le garantit dans son journal durable. Aucune réservation nouvelle ni libération par simple expiration n’est autorisée. L’accès HTTP vérifie le propriétaire avant cette reprise et avant de renvoyer une référence existante dans une erreur de conflit.

`history` lit le journal paginé d’un propriétaire pour T24 : 20 éléments par défaut, au plus 100, triés par création immuable puis identifiant décroissants. `nextCursor` reprend le dernier élément rendu ou vaut `null` à la fin connue. Les statuts sont actualisés sans déplacer les lignes ; cette lecture n’appelle jamais le simulateur et ne gèle pas les créations entre plusieurs pages.

Depuis la racine du checkout : `npm test --workspace @teranga-pay/bridge-sim` exécute les tests Node ; `npm run typecheck --workspace @teranga-pay/bridge-sim` vérifie les types. La [décision T23](../../../docs/decisions/0017-passerelle-simulee-et-idempotence.md) décrit les choix et limites.
