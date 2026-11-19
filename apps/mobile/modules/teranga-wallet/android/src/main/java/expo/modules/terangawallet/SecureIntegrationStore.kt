package expo.modules.terangawallet

import android.content.Context
import android.content.pm.ApplicationInfo
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileNotFoundException
import java.io.InputStream
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/** Secrets d'intégration uniquement ; le module exige une session wallet déverrouillée. */
internal class SecureIntegrationStore(private val context: Context, private val vault: SecureSeedStore) {
  private val canonical get() = AtomicFile(File(context.noBackupFilesDir, "teranga-integration.bin"))
  private val pending get() = AtomicFile(File(context.noBackupFilesDir, "teranga-integration-import.bin"))
  private val provisioning get() = File(context.noBackupFilesDir, "teranga-integration-provisioning.json")

  fun read(): String? = readEncrypted(canonical, "canonical")

  fun write(text: String) {
    val plain = textBytes(text)
    try {
      writeEncrypted(canonical, "canonical", plain)
      // L'application a validé et fusionné l'import avant cette écriture canonique.
      pending.delete()
      check(!hasStoredData(pending) && !File(pending.baseFile.path + ".new").exists()) {
        "import non acquitté"
      }
    } finally {
      plain.fill(0)
    }
  }

  /** Aucun fichier clair n'est lu en release. L'import chiffré survit à un crash JS. */
  fun importProvisioning(): String? {
    if (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) return null
    if (provisioning.exists()) {
      val plain = provisioning.inputStream().use { boundedRead(it, IntegrationCipher.MAX_TEXT_BYTES) }
      try {
        writeEncrypted(pending, "import", plain)
        check(provisioning.delete()) { "provisionnement non effacé" }
      } finally {
        plain.fill(0)
      }
    }
    return readEncrypted(pending, "import")
  }

  private fun readEncrypted(file: AtomicFile, purpose: String): String? {
    val blob = try {
      file.openRead().use { boundedRead(it, IntegrationCipher.MAX_ENVELOPE_BYTES) }
    } catch (_: FileNotFoundException) {
      check(!hasStoredData(file)) { "intégration inaccessible" }
      return null
    }
    val plain = IntegrationCipher.open(keystoreKey(create = false), vault.integrationBinding(), purpose, blob)
    return try {
      String(plain, Charsets.UTF_8)
    } finally {
      plain.fill(0)
    }
  }

  private fun hasStoredData(file: AtomicFile): Boolean =
    file.baseFile.exists() || File(file.baseFile.path + ".bak").exists()

  private fun writeEncrypted(file: AtomicFile, purpose: String, plain: ByteArray) {
    val blob = IntegrationCipher.seal(keystoreKey(), vault.integrationBinding(), purpose, plain)
    val stream = file.startWrite()
    try {
      stream.write(blob)
      file.finishWrite(stream)
    } catch (error: Exception) {
      file.failWrite(stream)
      throw error
    }
    // AtomicFile peut seulement journaliser un échec de synchronisation/renommage.
    // Ne jamais acquitter l'import avant d'avoir relu l'enveloppe exacte écrite.
    val saved = file.openRead().use { boundedRead(it, IntegrationCipher.MAX_ENVELOPE_BYTES) }
    check(saved.contentEquals(blob)) { "intégration non enregistrée" }
  }

  private fun textBytes(text: String): ByteArray {
    require(text.length <= IntegrationCipher.MAX_TEXT_BYTES) { "intégration trop volumineuse" }
    val bytes = text.toByteArray(Charsets.UTF_8)
    if (bytes.size > IntegrationCipher.MAX_TEXT_BYTES) {
      bytes.fill(0)
      error("intégration trop volumineuse")
    }
    return bytes
  }

  private fun boundedRead(input: InputStream, maximum: Int): ByteArray {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(1024)
    try {
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        require(output.size() + count <= maximum) { "intégration trop volumineuse" }
        output.write(buffer, 0, count)
      }
      return output.toByteArray()
    } finally {
      buffer.fill(0)
    }
  }

  private fun keystoreKey(create: Boolean = true): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as SecretKey?)?.let { return it }
    check(create) { "clé d'intégration indisponible" }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(
      KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build(),
    )
    return generator.generateKey()
  }

  companion object {
    private const val KEY_ALIAS = "teranga_wallet_integration_key_v1"
  }
}
