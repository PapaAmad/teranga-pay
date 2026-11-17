import {
  detectDestination,
  fail,
  invoiceExpiryBounds,
  isValidInvoiceExpiry,
  isValidPinFormat,
  ok,
  satsToXof,
  walletErrorCodes,
  type Balance,
  type Invoice,
  type Payment,
  type PaymentPreview,
  type RateInfo,
  type Result,
  type Wallet,
  type WalletErrorCode,
  type WalletEvent,
} from '@teranga-pay/contracts';

import type {
  NativePayment,
  NativeWallet,
  NodeSettings,
  PinResult,
} from '../../modules/teranga-wallet/src';
import {
  fetchPayParams,
  normalizeAddress,
  requestInvoice,
  type LightningAddressDeps,
} from './lightningAddress';
import { demoLightningAddressSettings } from './settings';
import { journalFor, type Journal, type JournalData } from './journal';

/** Frais maximum acceptés : 1 % du montant, avec un minimum de 10 sats. */
export function maxFeeFor(amountSats: number): number {
  return Math.max(10, Math.ceil(amountSats / 100));
}

const knownCodes = new Set<string>(walletErrorCodes);

/** Raison d'échec LDK → code du contrat. « Pas passé, argent intact » par défaut. */
export function failureCode(reason: string | null | undefined): WalletErrorCode {
  switch (reason) {
    case 'PAYMENT_EXPIRED':
      return 'INVOICE_EXPIRED';
    case 'UNEXPECTED_ERROR':
    case 'UNKNOWN_REQUIRED_FEATURES':
      return 'UNKNOWN';
    default:
      // ROUTE_NOT_FOUND, RETRIES_EXHAUSTED, RECIPIENT_REJECTED, USER_ABANDONED…
      return 'NO_ROUTE';
  }
}

/** Transforme une erreur du module natif en code du contrat, sans jamais lever. */
export function toErrorCode(error: unknown): WalletErrorCode {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && knownCodes.has(code) ? (code as WalletErrorCode) : 'UNKNOWN';
}

function pinFailure<T>(result: Exclude<PinResult, { ok: true }>): Result<T> {
  return result.code === 'PIN_INVALID'
    ? fail(result.code, { attemptsLeft: result.attemptsLeft })
    : fail(result.code, { retryAfterSeconds: result.retryAfterSeconds });
}

const sendingByNative = new WeakMap<object, Set<string>>();

function sendingFor(native: object): Set<string> {
  let set = sendingByNative.get(native);
  if (!set) {
    set = new Set();
    sendingByNative.set(native, set);
  }
  return set;
}

/**
 * Implémentation du contrat `Wallet` (T11) au-dessus de LDK Node (T15).
 * Toutes les erreurs prévues deviennent des `Result` ; les écrans n'ont rien à intercepter.
 */
export function createLdkWallet(
  native: NativeWallet,
  settings: NodeSettings,
  {
    rate = () => null,
    now = Date.now,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    paymentTimeoutMs = 60_000,
    lightningAddress = {
      fetch: (url, init) => fetch(url, init),
      demo: demoLightningAddressSettings,
    },
    journal = journalFor(native),
  }: {
    journal?: Journal;
    rate?: () => RateInfo | null;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    paymentTimeoutMs?: number;
    lightningAddress?: Pick<LightningAddressDeps, 'fetch' | 'demo' | 'timeoutMs'>;
  } = {},
): Wallet {
  const paidPayees = new Set<string>();
  const addressDeps: LightningAddressDeps = {
    ...lightningAddress,
    decode: (invoice) => native.decode(invoice),
    sha256Hex: (text) => native.sha256Hex(text),
  };
  /**
   * Envois en cours dans ce processus, par « destination|montant », partagés par
   * tous les adaptateurs d'un même module natif. Rempli de façon synchrone avant
   * la première attente : un second appel identique est refusé même si le premier
   * n'a pas encore atteint le natif.
   */
  const sending = sendingFor(native);
  const iso = (ms: number) => new Date(ms).toISOString();
  const xof = (sats: number) => {
    const current = rate();
    return current ? satsToXof(sats, current.xofPerBtc) : null;
  };

  async function attempt<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
    try {
      return await run();
    } catch (error) {
      return fail(toErrorCode(error));
    }
  }

  /**
   * FCFA du moment du paiement : prix du devis pour une facture de ce téléphone,
   * sinon valeur notée au premier passage. Jamais recalculé au cours actuel.
   */
  function toPayment(payment: NativePayment, data: JournalData): Payment {
    const invoice = data.invoices[payment.id];
    return {
      id: payment.id,
      direction: payment.direction,
      status: payment.status,
      amountSats: payment.amountSats,
      feeSats: payment.feeSats,
      amountXof: invoice?.amountXof ?? data.xof[payment.id] ?? null,
      memo: invoice?.memo ?? null,
      createdAt: iso(payment.updatedAt * 1000),
      failure: payment.status === 'echoue' ? failureCode(payment.failureReason) : null,
    };
  }

  /** Note la valeur FCFA d'un paiement la première fois qu'on le voit, au taux du moment. */
  async function noteXof(id: string, amountSats: number): Promise<JournalData> {
    const data = await journal.read();
    if (id in data.xof || data.invoices[id]?.amountXof != null) return data;
    return journal.update((next) => {
      next.xof[id] ??= xof(amountSats);
    });
  }

  /**
   * Note en une écriture la valeur FCFA des paiements récents jamais vus (reçus
   * pendant qu'aucun écran n'écoutait, par exemple sur l'adresse Lightning). Un
   * paiement plus ancien que 10 minutes reste sans valeur : le cours actuel ne
   * serait plus celui du paiement, et on n'invente pas de montant.
   */
  async function noteMissingXof(payments: NativePayment[]): Promise<JournalData> {
    const data = await journal.read();
    const missing = payments.filter(
      (payment) =>
        payment.status === 'reussi' &&
        now() - payment.updatedAt * 1000 <= 10 * 60_000 &&
        !(payment.id in data.xof) &&
        data.invoices[payment.id]?.amountXof == null,
    );
    if (missing.length === 0) return data;
    return journal.update((next) => {
      for (const payment of missing) next.xof[payment.id] ??= xof(payment.amountSats);
    });
  }

  async function findPayment(id: string): Promise<NativePayment | undefined> {
    return (await native.payments()).find((payment) => payment.id === id);
  }

  /**
   * Suite de `send`, clé déjà réservée en mémoire. Le journal garde « clé →
   * identifiant du paiement » jusqu'à une issue établie : après un redémarrage,
   * un envoi encore en attente chez LDK bloque toujours un nouvel essai.
   */
  async function sendReserved(
    key: string,
    preview: PaymentPreview & { payee: string },
    amount: number,
    maxFee: number,
    requestedAmount: number | undefined,
  ): Promise<Result<Payment>> {
    const previousId = (await journal.read()).sends[key];
    if (previousId) {
      // Seuls les envois comptent : une facture reçue partage le même identifiant
      // (payer sa propre facture) et resterait « en attente » pour toujours.
      const previous = (await native.payments()).find(
        (payment) => payment.id === previousId && payment.direction === 'envoye',
      );
      if (previous?.status === 'en_attente') {
        return fail('PAYMENT_PENDING', { paymentId: previous.id });
      }
      // Réussi, échoué ou jamais parti (arrêt avant l'appel natif) : issue connue.
      await forgetSend(key, previousId);
    }

    const balance = await balanceNow();
    if (amount + maxFee > balance.spendableSats) return fail('INSUFFICIENT_FUNDS');

    let invoice = preview.destination;
    if (preview.kind === 'adresse_lightning') {
      const params = await fetchPayParams(invoice, addressDeps);
      if (!params.ok) return params;
      const fresh = await requestInvoice(params.value, amount, addressDeps);
      if (!fresh.ok) return fresh;
      invoice = fresh.value.paymentRequest;
    }
    // LDK Node identifie un envoi BOLT11 par le hash de la facture : connu avant
    // l'envoi, il est enregistré d'abord pour pouvoir réconcilier après un arrêt.
    const expectedId = (await native.decode(invoice)).paymentHash;
    await journal.update((data) => {
      data.sends[key] = expectedId;
    });

    const amountForNative = preview.kind === 'facture' ? (requestedAmount ?? null) : null;
    const id = await native.send(invoice, amountForNative, maxFee);
    // L'argent est parti : à partir d'ici, aucune panne (journal, lecture du nœud)
    // ne doit devenir « erreur inconnue ». L'écran reçoit l'identifiant pour suivre
    // le paiement, au lieu de proposer un renvoi qui paierait deux fois.
    try {
      return await followSend(key, id, amount, preview.payee);
    } catch {
      return fail('PAYMENT_TIMEOUT', { paymentId: id });
    }
  }

  /** Suit un envoi déjà parti jusqu'à son issue ou jusqu'au délai d'attente. */
  async function followSend(
    key: string,
    id: string,
    amount: number,
    payee: string,
  ): Promise<Result<Payment>> {
    const expectedId = (await journal.read()).sends[key];
    if (id !== expectedId) {
      await journal.update((data) => {
        data.sends[key] = id;
      });
    }
    await noteXof(id, amount);
    const deadline = now() + paymentTimeoutMs;
    // LDK peut marquer l'échec un instant avant que l'événement portant sa raison
    // soit lu : on laisse deux tours de plus pour donner la vraie raison.
    let reasonWaits = 2;
    while (now() < deadline) {
      const found = await findPayment(id);
      if (found && found.status === 'reussi') {
        await forgetSend(key, id);
        paidPayees.add(payee);
        return ok(toPayment(found, await journal.read()));
      }
      if (found && found.status === 'echoue') {
        if (!found.failureReason && reasonWaits > 0) {
          reasonWaits -= 1;
          await sleep(500);
          continue;
        }
        await forgetSend(key, id);
        return fail(failureCode(found.failureReason));
      }
      await sleep(500);
    }
    // Issue inconnue : le paiement peut encore aboutir. La réservation reste dans
    // le journal ; un nouvel essai est refusé tant que LDK le dit en attente.
    return fail('PAYMENT_TIMEOUT', { paymentId: id });
  }

  async function forgetSend(key: string, id: string): Promise<void> {
    await journal.update((data) => {
      if (data.sends[key] === id) delete data.sends[key];
    });
  }

  async function balanceNow(): Promise<Balance> {
    const balance = await native.balance();
    // Réserves et limites des canaux : comptés à part, jamais présentés comme dépensables.
    const spendable = Math.min(balance.spendableSats, balance.lightningSats);
    return {
      spendableSats: spendable,
      pendingSats: Math.max(0, balance.lightningSats - spendable),
      spendableXof: xof(spendable),
      rate: rate(),
      updatedAt: iso(now()),
    };
  }

  async function addressPreview(
    input: string,
    amountSats?: number,
  ): Promise<Result<PaymentPreview & { payee: string }>> {
    const address = normalizeAddress(input);
    if (!address) return fail('DESTINATION_INVALID');
    if (amountSats === undefined || !Number.isSafeInteger(amountSats) || amountSats <= 0) {
      return fail('AMOUNT_INVALID');
    }
    const params = await fetchPayParams(address, addressDeps);
    if (!params.ok) return params;
    if (amountSats < params.value.minSats || amountSats > params.value.maxSats) {
      return fail('AMOUNT_INVALID');
    }
    const maxFee = maxFeeFor(amountSats);
    return ok({
      kind: 'adresse_lightning',
      destination: address,
      amountSats,
      maxFeeSats: maxFee,
      amountXof: xof(amountSats),
      maxFeeXof: xof(maxFee),
      memo: null,
      expiresAt: null,
      newRecipient: !paidPayees.has(address),
      payee: address,
    });
  }

  async function decodePreview(
    destination: string,
    amountSats?: number,
  ): Promise<Result<PaymentPreview & { payee: string }>> {
    const value = destination.trim().replace(/^lightning:/i, '');
    const kind = detectDestination(value);
    if (kind === 'adresse_lightning') return addressPreview(value, amountSats);
    if (kind !== 'facture') return fail('DESTINATION_INVALID');
    const info = await native.decode(value);
    if (!info.regtest) return fail('DESTINATION_WRONG_NETWORK');
    if (info.expired) return fail('INVOICE_EXPIRED');
    if (info.amountSats !== null && amountSats !== undefined && amountSats !== info.amountSats) {
      return fail('AMOUNT_INVALID');
    }
    const amount = info.amountSats ?? amountSats ?? null;
    if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0)) {
      return fail('AMOUNT_INVALID');
    }
    const maxFee = amount === null ? 10 : maxFeeFor(amount);
    return ok({
      kind,
      destination: value,
      amountSats: amount,
      maxFeeSats: maxFee,
      amountXof: amount === null ? null : xof(amount),
      maxFeeXof: xof(maxFee),
      memo: null,
      expiresAt: iso(info.expiresAt * 1000),
      newRecipient: !paidPayees.has(info.payee),
      payee: info.payee,
    });
  }

  return {
    async state() {
      if (!native.exists()) return 'absent';
      return native.isRunning() ? 'pret' : 'verrouille';
    },
    create: (pin) =>
      attempt(async () => {
        if (!isValidPinFormat(pin)) return fail('PIN_FORMAT');
        const recoveryWords = await native.create(pin);
        const unlocked = await native.unlock(pin, settings);
        if (!unlocked.ok) return pinFailure(unlocked);
        return ok({ recoveryWords });
      }),
    restore: (words, pin) =>
      attempt(async () => {
        if (!isValidPinFormat(pin)) return fail('PIN_FORMAT');
        await native.restore(words, pin);
        const unlocked = await native.unlock(pin, settings);
        return unlocked.ok ? ok(undefined) : pinFailure(unlocked);
      }),
    unlock: (pin) =>
      attempt(async () => {
        if (!native.exists()) return fail('WALLET_ABSENT');
        const result = await native.unlock(pin, settings);
        return result.ok ? ok(undefined) : pinFailure(result);
      }),
    async lock() {
      await native.lock();
    },
    balance: () => attempt(async () => ok(await balanceNow())),
    receive: ({ amountSats, amountXof, memo, expiresInSecs } = {}) =>
      attempt(async () => {
        if (amountSats !== undefined && (!Number.isSafeInteger(amountSats) || amountSats <= 0)) {
          return fail('AMOUNT_INVALID');
        }
        if (
          amountXof !== undefined &&
          (amountSats === undefined || !Number.isSafeInteger(amountXof) || amountXof <= 0)
        ) {
          return fail('AMOUNT_INVALID');
        }
        if (expiresInSecs !== undefined && !isValidInvoiceExpiry(expiresInSecs)) {
          return fail('EXPIRY_INVALID');
        }
        const expirySecs = expiresInSecs ?? invoiceExpiryBounds.default;
        const createdAt = now();
        const { paymentRequest, paymentId } = await native.receive(
          amountSats ?? null,
          memo ?? 'Teranga Pay',
          expirySecs,
        );
        const invoice: Invoice = {
          paymentRequest,
          paymentId,
          amountSats: amountSats ?? null,
          amountXof: amountXof ?? null,
          memo: memo ?? null,
          createdAt: iso(createdAt),
          expiresAt: iso(createdAt + expirySecs * 1000),
        };
        // Enregistrée avant d'être montrée : un règlement tardif reste rattaché à la vente.
        await journal.update((data) => {
          data.invoices[paymentId] = invoice;
        });
        return ok(invoice);
      }),
    lookupInvoice: (paymentId) =>
      attempt(async () => {
        const data = await journal.read();
        const invoice = data.invoices[paymentId];
        if (!invoice) return ok(null);
        const found = await findPayment(paymentId);
        // LDK garde une entrée « en attente » dès la création : seul un règlement compte.
        const payment = found?.status === 'reussi' ? toPayment(found, data) : null;
        return ok({ invoice, payment });
      }),
    preview: (destination, amountSats) =>
      attempt(async () => {
        const preview = await decodePreview(destination, amountSats);
        if (!preview.ok) return preview;
        const rest: PaymentPreview & { payee?: string } = { ...preview.value };
        delete rest.payee;
        return ok(rest);
      }),
    send: (request) =>
      attempt(async () => {
        const pinCheck = await native.verifyPin(request.pin);
        if (!pinCheck.ok) return pinFailure(pinCheck);
        const preview = await decodePreview(request.destination, request.amountSats);
        if (!preview.ok) return preview;
        const amount = preview.value.amountSats;
        if (amount === null) return fail('AMOUNT_INVALID');
        const requestedMax = request.maxFeeSats;
        // Plafond de frais demandé par l'écran : entier positif ou nul, sinon refusé.
        // Une valeur négative ou NaN ferait sauter le plafond côté natif.
        if (
          requestedMax !== undefined &&
          (!Number.isSafeInteger(requestedMax) || requestedMax < 0)
        ) {
          return fail('AMOUNT_INVALID');
        }
        const maxFee = Math.min(requestedMax ?? preview.value.maxFeeSats, preview.value.maxFeeSats);
        // Clé de l'envoi : destination et montant. Réservée en mémoire avant toute
        // attente, puis dans le journal avant le paiement : deux appuis rapides ou
        // un renvoi après redémarrage ne paient pas deux fois.
        const key = `${preview.value.destination.toLowerCase()}|${amount}`;
        if (sending.has(key)) return fail('PAYMENT_PENDING');
        sending.add(key);
        try {
          return await sendReserved(key, preview.value, amount, maxFee, request.amountSats);
        } finally {
          sending.delete(key);
        }
      }),
    history: ({ limit = 50, before } = {}) =>
      attempt(async () => {
        // Côté reçu, seules les factures réglées sont des opérations ; les autres
        // ne sont que des demandes créées (en attente ou expirées).
        const visible = (await native.payments())
          .filter((payment) => payment.direction === 'envoye' || payment.status === 'reussi')
          .sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : -1));
        const data = await noteMissingXof(visible);
        const all = visible.map((payment) => toPayment(payment, data));
        if (!before) return ok(all.slice(0, limit));
        // Curseur inconnu (paiement disparu, valeur erronée) : page vide plutôt que
        // de repartir du début et d'afficher des lignes en double.
        const index = all.findIndex((payment) => payment.id === before);
        return ok(index < 0 ? [] : all.slice(index + 1, index + 1 + limit));
      }),
    subscribe(listener) {
      const subscription = native.addListener('onWalletEvent', (event) => {
        void (async () => {
          const isPayment =
            event.type === 'paiement_recu' ||
            event.type === 'paiement_envoye' ||
            event.type === 'paiement_echoue';
          if (isPayment && event.id) {
            const found = await findPayment(event.id);
            if (found) {
              const data =
                found.direction === 'recu'
                  ? await noteXof(found.id, found.amountSats)
                  : await journal.read();
              listener({ type: 'paiement', payment: toPayment(found, data) } as WalletEvent);
            }
          }
          // Un échec libère aussi les fonds réservés par l'envoi : le solde change.
          listener({ type: 'solde', balance: await balanceNow() });
        })().catch(() => undefined);
      });
      return () => subscription.remove();
    },
  };
}
