# Module natif teranga-wallet (T15)

Module Expo local, Android uniquement, qui fait tourner **LDK Node 0.7.0** dans le téléphone ([décision 0008](https://github.com/PapaAmad/teranga-pay/pull/50)). Responsable : Salam.

- `android/…/TerangaWalletModule.kt` : création, restauration, déverrouillage, solde, factures, paiements et événements. Les erreurs LDK sont traduites en codes du contrat T11.
- `android/…/SecureSeedStore.kt` : coffre de la phrase de récupération. Elle est chiffrée deux fois, en AES-256-GCM : d'abord avec une clé dérivée du PIN (PBKDF2-SHA256, 120 000 itérations), puis avec une clé non exportable de l'Android Keystore. Après 5 PIN faux, le coffre se bloque 30 s.
- `receiveForDescriptionHash(montantMsat, hachage, expiration)` crée une facture qui porte le hachage des métadonnées LNURL au lieu d'un texte (LUD-06), pour l'adresse Lightning (T19). `decode` renvoie `descriptionHash` et `paymentHash` ; `sha256Hex` calcule le hachage côté payeur (T21).
- `setScreenSecure(true|false)` pose ou retire `FLAG_SECURE` sur la fenêtre : ni capture, ni enregistrement d'écran, ni aperçu dans les applications récentes pendant l'affichage de la phrase secrète.
- L'état LDK (canaux, paiements) vit dans `noBackupFilesDir/ldk`, et `app.json` désactive la sauvegarde Android (`allowBackup: false`). Restaurer un ancien état de canal ferait diffuser une transaction périmée, que le pair punit en gardant tout le canal ; la phrase secrète reste le seul moyen de restauration.
- `src/index.ts` : types TypeScript du pont natif. `nativeWallet` vaut `null` hors Android, par exemple dans Expo Go ou dans les tests Jest.
- `integrationRead()` et `integrationWrite(text)` : document de secrets d'intégration,
  séparé du journal non secret, borné à 16 Kio UTF-8. Les deux exigent que
  `unlock(PIN, settings)` ait démarré le wallet ; `verifyPin` seul ne donne aucun
  accès. `lock()` ferme cet accès. Le document est chiffré en AES-256-GCM avec
  une clé Android Keystore dédiée et non exportable. Les données authentifiées
  lient le document au coffre existant et à son usage ; changer le coffre, la clé
  ou le contenu rend la lecture impossible, sans effacer ni recréer le wallet.
  Le fichier atomique `noBackupFilesDir/teranga-integration.bin` ne contient ni
  phrase de récupération ni seed ; l'application valide son JSON avant usage.
- `integrationImport()` : uniquement dans une application Android débogable,
  lit `noBackupFilesDir/teranga-integration-provisioning.json` (16 Kio maximum),
  écrit une file d'import chiffrée distincte, puis efface le fichier clair privé.
  La file reste disponible après un crash jusqu'à une `integrationWrite` réussie.
  L'application doit valider le JSON provisionné, le fusionner avec le document
  courant et seulement ensuite écrire le document canonique. Aucun jeton ne
  passe dans une variable `EXPO_PUBLIC`, un journal ou AsyncStorage.
  En release, cette méthode renvoie `null` sans lire aucun fichier d'import ;
  le document canonique chiffré reste lisible après déverrouillage.

Le module exige un build de développement (`npx expo run:android`) ; il ne fonctionne pas dans Expo Go. La logique côté application est dans [src/wallet](../../src/wallet/README.md).

La vérification JVM du chiffrement est décrite dans [tests](tests/README.md).
`IntegrationCipher.kt` et `SecureIntegrationStore.kt` utilisent les primitives
Java/Android existantes, sans dépendance ajoutée. Le raccordement #120 relève de
PAN ; la relecture native et sécurité relève de Salam.

## Limites connues

- Le compteur d'essais de PIN est stocké dans le téléphone : il freine un essai manuel, mais pas quelqu'un qui a un accès root.
- Le réseau est figé sur regtest. Aucune clé ni phrase n'est écrite dans les journaux.
- Le nœud tourne seulement quand l'application est ouverte et déverrouillée. Pour recevoir un paiement, l'application doit donc être ouverte.
- Les secrets d'intégration sont accessibles en mémoire JavaScript pendant la
  session déverrouillée. L'application doit libérer ses références au verrouillage.
  Le chiffrement repose sur Keystore et le contrôle de session natif ; il ne
  remplace pas une authentification matérielle par opération et ne protège pas
  un téléphone rooté contrôlé par un attaquant. La restauration du coffre ne
  restaure ni ces jetons locaux ni l'état des canaux.
