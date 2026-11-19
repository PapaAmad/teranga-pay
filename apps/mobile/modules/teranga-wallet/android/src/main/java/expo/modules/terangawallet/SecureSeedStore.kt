package expo.modules.terangawallet

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Coffre de la phrase de récupération.
 *
 * Double chiffrement AES-256-GCM :
 * 1. avec une clé dérivée du PIN (PBKDF2-HMAC-SHA256, sel aléatoire) : sans le PIN,
 *    la phrase est illisible, et un PIN faux est détecté par l'étiquette GCM ;
 * 2. avec une clé non exportable de l'Android Keystore : le fichier copié hors du
 *    téléphone est inutilisable.
 *
 * Après 5 PIN faux, le coffre refuse tout essai pendant 30 secondes. Le compteur est
 * stocké localement : il freine un essai manuel, pas un attaquant qui a le contrôle
 * total (root) du téléphone. Limite documentée dans le README.
 */
class SecureSeedStore(context: Context) {
  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private val random = SecureRandom()

  sealed class PinCheck {
    data class Ok(val mnemonic: String) : PinCheck()
    data class Invalid(val attemptsLeft: Int) : PinCheck()
    data class Locked(val retryAfterSeconds: Int) : PinCheck()
  }

  fun exists(): Boolean = prefs.contains(KEY_BLOB)

  /** Identité opaque du coffre chiffré : jamais la phrase ni une clé dérivée du PIN. */
  fun integrationBinding(): ByteArray {
    val blob = prefs.getString(KEY_BLOB, null) ?: error("coffre absent")
    return MessageDigest.getInstance("SHA-256").digest(unb64(blob))
  }

  fun save(mnemonic: String, pin: String) {
    val salt = ByteArray(16).also(random::nextBytes)
    val inner = encrypt(pinKey(pin, salt), mnemonic.toByteArray(Charsets.UTF_8))
    val outer = encrypt(keystoreKey(), inner)
    prefs.edit()
      .putString(KEY_SALT, b64(salt))
      .putString(KEY_BLOB, b64(outer))
      .putInt(KEY_ATTEMPTS, 0)
      .putLong(KEY_LOCKED_UNTIL, 0)
      .commit()
  }

  fun open(pin: String, nowMs: Long = System.currentTimeMillis()): PinCheck {
    val lockedUntil = prefs.getLong(KEY_LOCKED_UNTIL, 0)
    if (nowMs < lockedUntil) return PinCheck.Locked(((lockedUntil - nowMs + 999) / 1000).toInt())
    val salt = unb64(prefs.getString(KEY_SALT, null) ?: error("coffre absent"))
    val outer = unb64(prefs.getString(KEY_BLOB, null) ?: error("coffre absent"))
    val inner = decrypt(keystoreKey(), outer)
    return try {
      val mnemonic = String(decrypt(pinKey(pin, salt), inner), Charsets.UTF_8)
      prefs.edit().putInt(KEY_ATTEMPTS, 0).commit()
      PinCheck.Ok(mnemonic)
    } catch (_: AEADBadTagException) {
      val attempts = prefs.getInt(KEY_ATTEMPTS, 0) + 1
      if (attempts >= MAX_ATTEMPTS) {
        prefs.edit().putInt(KEY_ATTEMPTS, 0).putLong(KEY_LOCKED_UNTIL, nowMs + LOCK_MS).commit()
        PinCheck.Locked((LOCK_MS / 1000).toInt())
      } else {
        prefs.edit().putInt(KEY_ATTEMPTS, attempts).commit()
        PinCheck.Invalid(MAX_ATTEMPTS - attempts)
      }
    }
  }

  private fun pinKey(pin: String, salt: ByteArray): SecretKey {
    val spec = PBEKeySpec(pin.toCharArray(), salt, PBKDF2_ITERATIONS, 256)
    val bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
    spec.clearPassword()
    return SecretKeySpec(bytes, "AES")
  }

  private fun keystoreKey(): SecretKey {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as SecretKey?)?.let { return it }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build(),
    )
    return generator.generateKey()
  }

  private fun encrypt(key: SecretKey, plain: ByteArray): ByteArray {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    if (key is SecretKeySpec) {
      val iv = ByteArray(12).also(random::nextBytes)
      cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv))
    } else {
      cipher.init(Cipher.ENCRYPT_MODE, key)
    }
    return cipher.iv + cipher.doFinal(plain)
  }

  private fun decrypt(key: SecretKey, blob: ByteArray): ByteArray {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, blob, 0, 12))
    return cipher.doFinal(blob, 12, blob.size - 12)
  }

  private fun b64(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)
  private fun unb64(text: String) = Base64.decode(text, Base64.NO_WRAP)

  companion object {
    private const val PREFS = "teranga_wallet_vault"
    private const val KEY_SALT = "salt"
    private const val KEY_BLOB = "seed"
    private const val KEY_ATTEMPTS = "pin_attempts"
    private const val KEY_LOCKED_UNTIL = "pin_locked_until"
    private const val KEY_ALIAS = "teranga_wallet_seed_key"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val PBKDF2_ITERATIONS = 120_000
    const val MAX_ATTEMPTS = 5
    private const val LOCK_MS = 30_000L
  }
}
