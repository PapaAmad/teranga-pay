package expo.modules.terangawallet

import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/** Exécutable JVM sans bibliothèque de test ; utilise le chiffrement de production. */
fun main() {
  val generator = KeyGenerator.getInstance("AES").apply { init(256) }
  val key = generator.generateKey()
  val binding = ByteArray(32) { it.toByte() }
  val payload = "données neutres de vérification".toByteArray(Charsets.UTF_8)
  val sealed = IntegrationCipher.seal(key, binding, "canonical", payload)
  check(IntegrationCipher.open(key, binding, "canonical", sealed).contentEquals(payload))
  check(!sealed.contentEquals(IntegrationCipher.seal(key, binding, "canonical", payload)))
  var rejected = 0
  fun rejects(candidate: ByteArray, scope: ByteArray = binding, purpose: String = "canonical", otherKey: SecretKey = key) {
    var failed = false
    try {
      IntegrationCipher.open(otherKey, scope, purpose, candidate)
    } catch (_: Exception) {
      failed = true
    }
    check(failed) { "une enveloppe non authentifiée a été acceptée" }
    rejected++
  }
  rejects(sealed.clone().apply { this[lastIndex] = (this[lastIndex].toInt() xor 1).toByte() })
  rejects(sealed.clone().apply { this[1] = (this[1].toInt() xor 1).toByte() })
  rejects(sealed.copyOf(12))
  rejects(sealed.clone().apply { this[0] = 2 })
  rejects(sealed, ByteArray(32) { (it + 1).toByte() })
  rejects(sealed, purpose = "import")
  rejects(sealed, otherKey = generator.generateKey())
  check(rejected == 7)
  println("native integration cipher: 9 checks passed")
}
