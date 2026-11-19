# Interface JavaScript du module

`index.ts` déclare les types du pont natif `TerangaWallet` et exporte `nativeWallet` (`null` hors build Android). La logique qui l'utilise est dans `apps/mobile/src/wallet`.

Les méthodes optionnelles `integrationRead`, `integrationWrite` et
`integrationImport` permettent au raccordement #120 de reconnaître un build
antérieur qui n'inclut pas le nouveau coffre d'intégration. Les secrets ne
doivent jamais être placés dans `journalWrite` ou AsyncStorage. Voir les
conditions de session et d'import dans le [README du module](../README.md).
