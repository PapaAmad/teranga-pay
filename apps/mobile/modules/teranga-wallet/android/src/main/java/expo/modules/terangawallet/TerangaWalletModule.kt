package expo.modules.terangawallet

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.util.AtomicFile
import android.view.WindowManager
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread
import org.lightningdevkit.ldknode.AnchorChannelsConfig
import org.lightningdevkit.ldknode.Bolt11Invoice
import org.lightningdevkit.ldknode.Bolt11InvoiceDescription
import org.lightningdevkit.ldknode.Builder
import org.lightningdevkit.ldknode.Event
import org.lightningdevkit.ldknode.Network
import org.lightningdevkit.ldknode.Node
import org.lightningdevkit.ldknode.NodeException
import org.lightningdevkit.ldknode.PaymentDirection
import org.lightningdevkit.ldknode.PaymentStatus
import org.lightningdevkit.ldknode.RouteParametersConfig
import org.lightningdevkit.ldknode.WordCount
import org.lightningdevkit.ldknode.defaultConfig
import org.lightningdevkit.ldknode.generateEntropyMnemonic

private class WalletException(code: String, message: String) : CodedException(code, message, null)

/**
 * Pont entre l'application et LDK Node (T15). Les fonctions renvoient des valeurs
 * simples ; les erreurs prévues portent un code du contrat T11 (`WALLET_LOCKED`,
 * `INSUFFICIENT_FUNDS`…). La phrase de récupération ne quitte le natif qu'une
 * fois, à la création, pour être notée par l'utilisateur.
 */
class TerangaWalletModule : Module() {
  @Volatile private var node: Node? = null
  @Volatile private var eventsRunning = false
  // Raison du dernier échec par paiement, lue dans les événements LDK (T21) :
  // listPayments() ne la donne pas.
  private val failureReasons = ConcurrentHashMap<String, String>()

  private val context
    get() = requireNotNull(appContext.reactContext) { "contexte Android indisponible" }

  private val vault by lazy { SecureSeedStore(context) }

  override fun definition() = ModuleDefinition {
    Name("TerangaWallet")
    Events("onWalletEvent")

    Function("exists") { vault.exists() }
    Function("isRunning") { node != null }

    // Écran sensible (phrase secrète) : ni capture, ni enregistrement, ni aperçu
    // dans les applications récentes tant que le drapeau est posé.
    AsyncFunction("setScreenSecure") { secure: Boolean ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      activity.runOnUiThread {
        if (secure) {
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
      }
      true
    }

    AsyncFunction("create") { pin: String ->
      requirePinFormat(pin)
      if (vault.exists()) throw WalletException("WALLET_EXISTS", "un wallet existe déjà")
      val mnemonic = generateEntropyMnemonic(WordCount.WORDS12)
      vault.save(mnemonic, pin)
      mnemonic.split(" ")
    }

    AsyncFunction("restore") { words: List<String>, pin: String ->
      requirePinFormat(pin)
      if (vault.exists()) throw WalletException("WALLET_EXISTS", "un wallet existe déjà")
      if (words.size != 12 || words.any { !it.matches(Regex("^[a-z]+$")) }) {
        throw WalletException("RECOVERY_INVALID", "phrase de récupération invalide")
      }
      vault.save(words.joinToString(" "), pin)
    }

    /** Vérifie le PIN puis démarre le nœud. Renvoie un objet de résultat, sans exception pour le PIN. */
    AsyncFunction("unlock") { pin: String, config: Map<String, Any?> ->
      if (!vault.exists()) throw WalletException("WALLET_ABSENT", "aucun wallet")
      when (val check = vault.open(pin)) {
        is SecureSeedStore.PinCheck.Invalid ->
          mapOf("ok" to false, "code" to "PIN_INVALID", "attemptsLeft" to check.attemptsLeft)
        is SecureSeedStore.PinCheck.Locked ->
          mapOf("ok" to false, "code" to "PIN_LOCKED", "retryAfterSeconds" to check.retryAfterSeconds)
        is SecureSeedStore.PinCheck.Ok -> {
          if (node == null) startNode(check.mnemonic, NodeSettings.from(config))
          mapOf("ok" to true)
        }
      }
    }

    AsyncFunction("verifyPin") { pin: String ->
      when (val check = vault.open(pin)) {
        is SecureSeedStore.PinCheck.Invalid ->
          mapOf("ok" to false, "code" to "PIN_INVALID", "attemptsLeft" to check.attemptsLeft)
        is SecureSeedStore.PinCheck.Locked ->
          mapOf("ok" to false, "code" to "PIN_LOCKED", "retryAfterSeconds" to check.retryAfterSeconds)
        is SecureSeedStore.PinCheck.Ok -> mapOf("ok" to true)
      }
    }

    AsyncFunction("lock") { stopNode() }

    AsyncFunction("nodeId") { running().nodeId() }

    AsyncFunction("balance") {
      val current = running()
      val balances = current.listBalances()
      val usable = current.listChannels().filter { it.isUsable }
      mapOf(
        "lightningSats" to balances.totalLightningBalanceSats.toDouble(),
        // Ce qu'un envoi peut vraiment utiliser maintenant : réserves et limites
        // de chaque canal déduites, contrairement au total récupérable.
        "spendableSats" to usable.sumOf { it.nextOutboundHtlcLimitMsat / 1000uL }.toDouble(),
        "outboundSats" to usable.sumOf { it.outboundCapacityMsat / 1000uL }.toDouble(),
        "inboundSats" to usable.sumOf { it.inboundCapacityMsat / 1000uL }.toDouble(),
        "onchainSats" to balances.totalOnchainBalanceSats.toDouble(),
        "channelsReady" to usable.size,
      )
    }

    AsyncFunction("receive") { amountSats: Double?, memo: String, expirySecs: Int ->
      val payments = running().bolt11Payment()
      val description = Bolt11InvoiceDescription.Direct(memo)
      val invoice = guard {
        if (amountSats == null) {
          payments.receiveVariableAmount(description, expirySecs.toUInt())
        } else {
          payments.receive((amountSats.toLong() * 1000).toULong(), description, expirySecs.toUInt())
        }
      }
      // Pour une facture BOLT11 reçue, LDK Node identifie le paiement par son hash.
      mapOf("paymentRequest" to invoice.toString(), "paymentId" to invoice.paymentHash())
    }

    // Journal de l'application (taux FCFA des paiements, factures, envois en cours).
    // Aucune clé ni phrase secrète ; noBackupFilesDir comme l'état LDK.
    AsyncFunction("journalRead") {
      // readFully() reprend aussi la copie de secours (.bak) laissée par une écriture
      // interrompue ; tester seulement baseFile ferait repartir d'un journal vide.
      try {
        String(journalFile().readFully(), Charsets.UTF_8)
      } catch (_: java.io.FileNotFoundException) {
        null
      }
    }

    AsyncFunction("journalWrite") { text: String ->
      val file = journalFile()
      val stream = file.startWrite()
      try {
        stream.write(text.toByteArray(Charsets.UTF_8))
        file.finishWrite(stream)
      } catch (error: Exception) {
        file.failWrite(stream)
        throw WalletException("UNKNOWN", "journal non enregistré")
      }
    }

    AsyncFunction("decode") { text: String ->
      val invoice = try {
        Bolt11Invoice.fromStr(text.trim().removePrefix("lightning:").removePrefix("LIGHTNING:"))
      } catch (_: NodeException) {
        throw WalletException("DESTINATION_INVALID", "facture illisible")
      }
      mapOf(
        "amountSats" to invoice.amountMilliSatoshis()?.let { (it / 1000uL).toDouble() },
        "expiresAt" to (invoice.secondsSinceEpoch() + invoice.expiryTimeSeconds()).toDouble(),
        "expired" to invoice.isExpired(),
        "regtest" to (invoice.network() == Network.REGTEST),
        "payee" to invoice.recoverPayeePubKey(),
        "paymentHash" to invoice.paymentHash(),
        // Adresse Lightning (LUD-06) : la facture doit porter le hachage des métadonnées.
        "descriptionHash" to when (val description = invoice.invoiceDescription()) {
          is Bolt11InvoiceDescription.Hash -> description.hash.lowercase()
          is Bolt11InvoiceDescription.Direct -> null
        },
      )
    }

    Function("sha256Hex") { text: String ->
      MessageDigest.getInstance("SHA-256")
        .digest(text.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
    }

    AsyncFunction("send") { text: String, amountSats: Double?, maxFeeSats: Double? ->
      val current = running()
      val invoice = try {
        Bolt11Invoice.fromStr(text.trim().removePrefix("lightning:").removePrefix("LIGHTNING:"))
      } catch (_: NodeException) {
        throw WalletException("DESTINATION_INVALID", "facture illisible")
      }
      if (invoice.network() != Network.REGTEST) {
        throw WalletException("DESTINATION_WRONG_NETWORK", "facture hors regtest")
      }
      if (invoice.isExpired()) throw WalletException("INVOICE_EXPIRED", "facture expirée")
      if (maxFeeSats != null && (maxFeeSats < 0.0 || maxFeeSats % 1.0 != 0.0)) {
        throw WalletException("AMOUNT_INVALID", "plafond de frais invalide")
      }
      val route = maxFeeSats?.let {
        RouteParametersConfig(
          maxTotalRoutingFeeMsat = (it.toLong() * 1000).toULong(),
          maxTotalCltvExpiryDelta = 1008u,
          maxPathCount = 10u,
          maxChannelSaturationPowerOfHalf = 2u,
        )
      }
      guard {
        if (invoice.amountMilliSatoshis() == null) {
          val amount = amountSats ?: throw WalletException("AMOUNT_INVALID", "montant requis")
          current.bolt11Payment().sendUsingAmount(invoice, (amount.toLong() * 1000).toULong(), route)
        } else {
          current.bolt11Payment().send(invoice, route)
        }
      }
    }

    AsyncFunction("payments") {
      running().listPayments().map { payment ->
        mapOf(
          "id" to payment.id,
          "direction" to if (payment.direction == PaymentDirection.INBOUND) "recu" else "envoye",
          "status" to when (payment.status) {
            PaymentStatus.SUCCEEDED -> "reussi"
            PaymentStatus.FAILED -> "echoue"
            else -> "en_attente"
          },
          "amountSats" to ((payment.amountMsat ?: 0uL) / 1000uL).toDouble(),
          "feeSats" to (((payment.feePaidMsat ?: 0uL) + 999uL) / 1000uL).toDouble(),
          "updatedAt" to payment.latestUpdateTimestamp.toDouble(),
          "failureReason" to if (payment.status == PaymentStatus.FAILED) failureReasons[payment.id] else null,
        )
      }
    }

    OnDestroy { stopNode() }
  }

  private data class NodeSettings(val electrumUrl: String, val peerId: String, val peerAddress: String) {
    companion object {
      fun from(config: Map<String, Any?>): NodeSettings {
        val electrum = config["electrumUrl"] as? String
        val peerId = config["peerId"] as? String
        val peerAddress = config["peerAddress"] as? String
        if (electrum == null || peerId == null || peerAddress == null ||
          !electrum.matches(Regex("^(tcp|ssl)://[A-Za-z0-9.-]+:\\d{1,5}$")) ||
          !peerId.matches(Regex("^0[23][0-9a-f]{64}$")) ||
          !peerAddress.matches(Regex("^[A-Za-z0-9.-]+:\\d{1,5}$"))
        ) {
          throw WalletException("UNKNOWN", "configuration du nœud invalide")
        }
        return NodeSettings(electrum, peerId, peerAddress)
      }
    }
  }

  private fun startNode(mnemonic: String, settings: NodeSettings) {
    val config = defaultConfig().apply {
      network = Network.REGTEST
      // noBackupFilesDir : jamais copié par la sauvegarde Android. Restaurer un ancien
      // état de canal ferait diffuser une transaction périmée, que le pair punit
      // en gardant tout le canal.
      storageDirPath = File(context.noBackupFilesDir, "ldk").absolutePath
      // Le fournisseur de liquidité (lnd-teranga) est de confiance pour la réserve
      // des canaux à ancres : le téléphone n'a pas de fonds on-chain.
      anchorChannelsConfig = AnchorChannelsConfig(listOf(settings.peerId), 25_000uL)
    }
    val builder = Builder.fromConfig(config)
    builder.setChainSourceElectrum(settings.electrumUrl, null)
    builder.setGossipSourceP2p()
    builder.setEntropyBip39Mnemonic(mnemonic, null)
    val started = guard { builder.build() }
    guard { started.start() }
    try {
      started.connect(settings.peerId, settings.peerAddress, true)
    } catch (_: NodeException) {
      // Pas de réseau : le nœud réessaiera ; l'état hors ligne est signalé par le JS.
    }
    node = started
    startEventLoop(started)
  }

  private fun stopNode() {
    eventsRunning = false
    node?.let { runCatching { it.stop() } }
    node = null
  }

  private fun startEventLoop(current: Node) {
    eventsRunning = true
    thread(name = "teranga-wallet-events", isDaemon = true) {
      while (eventsRunning && node === current) {
        val event = runCatching { current.nextEvent() }.getOrNull()
        if (event == null) {
          Thread.sleep(500)
          continue
        }
        val payload: Map<String, Any?>? = when (event) {
          is Event.PaymentReceived -> mapOf(
            "type" to "paiement_recu",
            "id" to event.paymentId,
            "amountSats" to (event.amountMsat / 1000uL).toDouble(),
          )
          is Event.PaymentSuccessful -> mapOf("type" to "paiement_envoye", "id" to event.paymentId)
          is Event.PaymentFailed -> {
            val id = event.paymentId
            val reason = event.reason?.name
            if (id != null && reason != null) failureReasons[id] = reason
            mapOf(
              "type" to "paiement_echoue",
              "id" to id,
              "reason" to reason,
            )
          }
          is Event.ChannelReady -> mapOf("type" to "canal_pret")
          is Event.ChannelClosed -> mapOf("type" to "canal_ferme")
          else -> null
        }
        payload?.let { sendEvent("onWalletEvent", it) }
        runCatching { current.eventHandled() }
      }
    }
  }

  private fun journalFile() = AtomicFile(File(context.noBackupFilesDir, "teranga-journal.json"))

  private fun running(): Node = node ?: throw WalletException("WALLET_LOCKED", "wallet verrouillé")

  private fun requirePinFormat(pin: String) {
    if (!pin.matches(Regex("^\\d{6}$"))) throw WalletException("PIN_FORMAT", "PIN de 6 chiffres")
  }

  /** Traduit les erreurs LDK Node en codes du contrat T11. */
  private fun <T> guard(block: () -> T): T = try {
    block()
  } catch (error: NodeException) {
    throw WalletException(
      when (error) {
        is NodeException.InsufficientFunds -> "INSUFFICIENT_FUNDS"
        is NodeException.DuplicatePayment -> "ALREADY_PAID"
        is NodeException.InvalidInvoice -> "DESTINATION_INVALID"
        is NodeException.InvalidAmount -> "AMOUNT_INVALID"
        is NodeException.ConnectionFailed -> "NETWORK_OFFLINE"
        is NodeException.PaymentSendingFailed -> "NO_ROUTE"
        is NodeException.NotRunning -> "WALLET_LOCKED"
        else -> "UNKNOWN"
      },
      error.javaClass.simpleName,
    )
  }
}
