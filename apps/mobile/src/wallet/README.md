# Logique wallet (T15)

- `ldkWallet.ts` : `createLdkWallet(native, settings)` implémente le contrat `Wallet` de `@teranga-pay/contracts` au-dessus du module natif [teranga-wallet](../../modules/teranga-wallet/README.md) (LDK Node). Les erreurs du natif deviennent des codes du contrat ; aucune exception n'atteint les écrans.
- `useSecureScreen.ts` : `useSecureScreen(nativeWallet, phraseVisible)` bloque les captures d'écran tant que la phrase secrète est affichée, puis les rétablit. À utiliser dans l'onboarding (T14) sur chaque écran qui montre ou demande la phrase.
- `journal.ts` : petit journal JSON gardé par le natif dans `noBackupFilesDir` (écriture atomique). Il retient ce que LDK Node ne garde pas : la valeur FCFA de chaque paiement au moment où il a lieu et les factures créées (`paymentId`, prix du devis). Aucun secret. Un fichier illisible repart vide.
- `settings.ts` : réglages du réseau regtest de démonstration (Electrum, pair `lnd-teranga`), lus dans les variables `EXPO_PUBLIC_*`.

Règles appliquées :

- Frais maximum : 1 % du montant, avec un minimum de 10 sats. Ils sont affichés avant la confirmation et transmis comme plafond au routage.
- Le PIN est revérifié à chaque envoi. Seules les factures regtest non expirées sont acceptées.
- Solde disponible = ce qu'un envoi peut vraiment utiliser (limite du prochain envoi sur chaque canal utilisable). Le reste du total Lightning (réserves de canal) est dans `pendingSats`.
- La valeur FCFA d'un paiement est notée une fois, au taux du moment ; pour une facture issue d'un devis, c'est le prix du devis. Un paiement jamais vu par l'application garde `amountXof: null`.
- `receive` renvoie le `paymentId` de la facture ; `lookupInvoice` relit la demande et son règlement après redémarrage. `expiresInSecs` (60 à 3 600 s) borne la facture elle-même.
- Les factures créées mais pas réglées n'apparaissent pas dans l'historique.
- Les événements de réussite et d'échec publient le paiement, puis le solde.
- Un envoi attend la confirmation du nœud pendant 60 s au plus, puis renvoie `PAYMENT_TIMEOUT`.
- Les adresses Lightning (`nom@domaine`) viendront avec T19 ; d'ici là, elles sont refusées avec `DESTINATION_INVALID`.

Tests : `tests/ldkWallet.test.ts` et `tests/useSecureScreen.test.tsx` utilisent un faux module natif. Responsable : Salam.
