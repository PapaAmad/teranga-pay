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
import { journalFor, type Journal, type JournalData } from './journal';

/** Frais maximum acceptés : 1 % du montant, avec un minimum de 10 sats. */
export function maxFeeFor(amountSats: number): number {
  return Math.max(10, Math.ceil(amountSats / 100));
}

const knownCodes = new Set<string>(walletErrorCodes);

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
    journal = journalFor(native),
  }: {
    journal?: Journal;
    rate?: () => RateInfo | null;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    paymentTimeoutMs?: number;
  } = {},
): Wallet {
  const paidPayees = new Set<string>();
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
      failure: payment.status === 'echoue' ? 'NO_ROUTE' : null,
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

  async function decodePreview(
    destination: string,
    amountSats?: number,
  ): Promise<Result<PaymentPreview & { payee: string }>> {
    const value = destination.trim().replace(/^lightning:/i, '');
    const kind = detectDestination(value);
    if (kind === 'adresse_lightning') return fail('DESTINATION_INVALID'); // T19
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
        const id = await native.send(preview.value.destination, request.amountSats ?? null, maxFee);
        await noteXof(id, amount);
        const deadline = now() + paymentTimeoutMs;
        while (now() < deadline) {
          const found = (await native.payments()).find((payment) => payment.id === id);
          if (found && found.status === 'reussi') {
            paidPayees.add(preview.value.payee);
            return ok(toPayment(found, await journal.read()));
          }
          if (found && found.status === 'echoue') return fail('NO_ROUTE');
          await sleep(500);
        }
        // Issue inconnue : l'écran suit ce paiement par son identifiant.
        return fail('PAYMENT_TIMEOUT', { paymentId: id });
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
