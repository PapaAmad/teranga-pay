package expo.modules.terangawallet

import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Enveloppe authentifiée, liée au coffre et au rôle du fichier. Aucun accès à la seed. */
internal object IntegrationCipher {
  const val MAX_TEXT_BYTES = 16 * 1024
  const val MAX_ENVELOPE_BYTES = MAX_TEXT_BYTES + 29
  private const val VERSION: Byte = 1

  fun seal(key: SecretKey, binding: ByteArray, purpose: String, plain: ByteArray): ByteArray {
    require(plain.size <= MAX_TEXT_BYTES) { "intégration trop volumineuse" }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key)
    cipher.updateAAD(aad(binding, purpose))
    check(cipher.iv.size == 12)
    return byteArrayOf(VERSION) + cipher.iv + cipher.doFinal(plain)
  }

  fun open(key: SecretKey, binding: ByteArray, purpose: String, blob: ByteArray): ByteArray {
    require(blob.size in 29..MAX_ENVELOPE_BYTES && blob[0] == VERSION) { "intégration illisible" }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, blob, 1, 12))
    cipher.updateAAD(aad(binding, purpose))
    return cipher.doFinal(blob, 13, blob.size - 13)
  }

  private fun aad(binding: ByteArray, purpose: String): ByteArray =
    "teranga-integration:v1:$purpose:".toByteArray(Charsets.UTF_8) + binding

}
