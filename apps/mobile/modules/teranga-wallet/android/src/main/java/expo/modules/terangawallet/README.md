# terangawallet

Le code Kotlin du module wallet :

- `TerangaWalletModule.kt` : le nœud LDK Node, les factures, les paiements et les événements envoyés à l'application ;
- `SecureSeedStore.kt` : le coffre de la phrase de récupération (chiffrée avec le PIN puis avec une clé de l'Android Keystore).
- `IntegrationCipher.kt` : enveloppe AES-GCM authentifiée et liée au coffre,
  indépendante d'Android pour sa vérification JVM ;
- `SecureIntegrationStore.kt` : document de secrets d'intégration et file
  d'import de développement, chiffrés avec une clé Keystore distincte et écrits
  atomiquement dans `noBackupFilesDir`.

Le pont natif refuse les accès d'intégration lorsque le nœud est verrouillé.
Voir [les tests JVM](../../../../../../../tests/README.md) pour vérifier le
chiffrement ; `./gradlew :teranga-wallet:compileDebugKotlin` compile le module
depuis le dossier Android généré. Responsable natif : Salam ; raccordement #120 : PAN.

Explications et schéma : [README Android](../../../../../../README.md).
