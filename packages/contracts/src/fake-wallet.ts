import {
  fail,
  isValidPinFormat,
  ok,
  satsToXof,
  detectDestination,
  invoiceExpiryBounds,
  isValidInvoiceExpiry,
  type Balance,
  type Invoice,
  type Payment,
  type PaymentPreview,
  type RateInfo,
  type Result,
  type Wallet,
  type WalletEvent,
  type WalletState,
} from '@teranga-pay/contracts';

/**
 * Faux wallet en mémoire pour construire et tester les écrans sans réseau ni
 * SDK. Données entièrement fictives ; aucun secret réel. Ne jamais l'utiliser
 * pour de l'argent réel.
 */
export type FakeWallet = Wallet & {
  /** Simule un paiement reçu, comme si Ousmane payait depuis `lnd-diaspora`. */
  simulateIncomingPayment(amountSats: number, memo?: string): Payment;
  /**
   * Simule le règlement d'une facture créée par `receive`. Renvoie `null` si la
   * facture est inconnue, expirée ou déjà réglée.
   */
  simulateInvoicePaid(paymentId: string): Payment | null;
  setOnline(online: boolean): void;
  /**
   * Le prochain `send` part mais reste sans issue : il renvoie `PAYMENT_TIMEOUT`
   * avec `paymentId`, et un renvoi identique `PAYMENT_PENDING`, jusqu'à
   * `simulateSendSettled`.
   */
  simulateSlowNextSend(): void;
  /** Termine un envoi lent : publie le paiement réussi ou échoué (et le solde). */
  simulateSendSettled(paymentId: string, status: 'reussi' | 'echoue'): Payment | null;
};

export const fakeRecoveryWords = Array.from({ length: 12 }, (_, index) => `fictif${index + 1}`);
const maxPinAttempts = 5;
const pinLockSeconds = 30;

export function createFakeWallet({
  rate = { xofPerBtc: 45_000_000, source: 'fixe', fetchedAt: '2026-11-07T12:00:00.000Z' },
  now = Date.now,
  feeSats = 2,
  invoiceTtlSeconds = invoiceExpiryBounds.default,
}: {
  rate?: RateInfo | null;
  now?: () => number;
  feeSats?: number;
  invoiceTtlSeconds?: number;
} = {}): FakeWallet {
  let pin: string | null = null;
  let unlocked = false;
  let online = true;
  let attempts = 0;
  let lockedUntil = 0;
  let sats = 0;
  let counter = 0;
  const payments: Payment[] = [];
  const paidDestinations = new Set<string>();
  const paidInvoices = new Set<string>();
  const invoices = new Map<string, Invoice>();
  const listeners = new Set<(event: WalletEvent) => void>();
  let slowNextSend = false;
  /**
   * Envois lents en cours, par « destination|montant » comme le vrai wallet :
   * le même destinataire avec un autre montant n'est pas bloqué.
   */
  const pendingSends = new Map<string, { payment: Payment; destination: string }>();

  const iso = (ms: number) => new Date(ms).toISOString();
  const xof = (amount: number) => (rate ? satsToXof(amount, rate.xofPerBtc) : null);
  const emit = (event: WalletEvent) =>
    listeners.forEach((listener) => {
      // Un écran qui plante ne doit pas faire croire qu'un paiement déjà fait a échoué.
      try {
        listener(event);
      } catch {
        // Erreur d'un abonné ignorée : l'opération du wallet est déjà terminée.
      }
    });

  function currentState(): WalletState {
    if (pin === null) return 'absent';
    if (!unlocked) return 'verrouille';
    return online ? 'pret' : 'hors_ligne';
  }

  function guard(): Result<never> | null {
    if (pin === null) return fail('WALLET_ABSENT');
    if (!unlocked) return fail('WALLET_LOCKED');
    return null;
  }

  function balanceNow(): Balance {
    return {
      spendableSats: sats,
      pendingSats: 0,
      spendableXof: xof(sats),
      rate,
      updatedAt: iso(now()),
    };
  }

  function checkPin(candidate: string): Result<void> {
    if (now() < lockedUntil) {
      return fail('PIN_LOCKED', { retryAfterSeconds: Math.ceil((lockedUntil - now()) / 1000) });
    }
    if (candidate !== pin) {
      attempts += 1;
      if (attempts >= maxPinAttempts) {
        attempts = 0;
        lockedUntil = now() + pinLockSeconds * 1000;
        return fail('PIN_LOCKED', { retryAfterSeconds: pinLockSeconds });
      }
      return fail('PIN_INVALID', { attemptsLeft: maxPinAttempts - attempts });
    }
    attempts = 0;
    return ok(undefined);
  }

  function record(payment: Payment): Payment {
    payments.unshift(payment);
    emit({ type: 'paiement', payment });
    emit({ type: 'solde', balance: balanceNow() });
    return payment;
  }

  function decode(destination: string, amountSats?: number): Result<PaymentPreview> {
    const value = destination.trim().replace(/^lightning:/i, '');
    const kind = detectDestination(value);
    if (kind === null) return fail('DESTINATION_INVALID');
    let invoiceSats: number | null = null;
    let expiresAt: string | null = null;
    if (kind === 'facture') {
      if (!/^lnbcrt/i.test(value)) return fail('DESTINATION_WRONG_NETWORK');
      const match = /^lnbcrtfake(\d+)n(\d+)t(\d+)$/i.exec(value);
      if (match) {
        invoiceSats = Number(match[1]) || null;
        const expiry = Number(match[3]);
        // Date JavaScript maximale : au-delà, la facture est illisible.
        if (!Number.isSafeInteger(expiry) || expiry > 8.64e15) return fail('DESTINATION_INVALID');
        if (now() >= expiry) return fail('INVOICE_EXPIRED');
        expiresAt = iso(expiry);
      }
      // Une facture BOLT11 peut être en majuscules (QR) : même facture, même clé.
      if (paidInvoices.has(value.toLowerCase())) return fail('ALREADY_PAID');
    }
    if (invoiceSats !== null && amountSats !== undefined && amountSats !== invoiceSats) {
      return fail('AMOUNT_INVALID');
    }
    const amount = invoiceSats ?? amountSats ?? null;
    if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0)) {
      return fail('AMOUNT_INVALID');
    }
    return ok({
      kind,
      destination: value,
      amountSats: amount,
      maxFeeSats: feeSats,
      amountXof: amount === null ? null : xof(amount),
      maxFeeXof: xof(feeSats),
      memo: null,
      expiresAt,
      newRecipient: !paidDestinations.has(value.toLowerCase()),
    });
  }

  return {
    async state() {
      return currentState();
    },
    async create(newPin) {
      if (pin !== null) return fail('WALLET_EXISTS');
      if (!isValidPinFormat(newPin)) return fail('PIN_FORMAT');
      pin = newPin;
      unlocked = true;
      emit({ type: 'etat', state: currentState() });
      return ok({ recoveryWords: [...fakeRecoveryWords] });
    },
    async restore(words, newPin) {
      if (pin !== null) return fail('WALLET_EXISTS');
      if (words.length !== 12 || words.some((word) => !/^[a-z0-9]+$/.test(word))) {
        return fail('RECOVERY_INVALID');
      }
      if (!isValidPinFormat(newPin)) return fail('PIN_FORMAT');
      pin = newPin;
      unlocked = true;
      emit({ type: 'etat', state: currentState() });
      return ok(undefined);
    },
    async unlock(candidate) {
      if (pin === null) return fail('WALLET_ABSENT');
      const checked = checkPin(candidate);
      if (!checked.ok) return checked;
      unlocked = true;
      emit({ type: 'etat', state: currentState() });
      return ok(undefined);
    },
    async lock() {
      unlocked = false;
      emit({ type: 'etat', state: currentState() });
    },
    async balance() {
      return guard() ?? ok(balanceNow());
    },
    async receive({ amountSats, amountXof, memo, expiresInSecs } = {}) {
      const blocked = guard();
      if (blocked) return blocked;
      if (!online) return fail('NETWORK_OFFLINE');
      if (amountSats !== undefined && (!Number.isSafeInteger(amountSats) || amountSats <= 0)) {
        return fail('AMOUNT_INVALID');
      }
      // Un montant FCFA sans montant en sats afficherait un montant que la facture n'impose pas.
      if (
        amountXof !== undefined &&
        (amountSats === undefined || !Number.isSafeInteger(amountXof) || amountXof <= 0)
      ) {
        return fail('AMOUNT_INVALID');
      }
      if (expiresInSecs !== undefined && !isValidInvoiceExpiry(expiresInSecs)) {
        return fail('EXPIRY_INVALID');
      }
      counter += 1;
      const createdAt = now();
      const expiresAt = createdAt + (expiresInSecs ?? invoiceTtlSeconds) * 1000;
      const invoice: Invoice = {
        paymentRequest: `lnbcrtfake${amountSats ?? 0}n${counter}t${expiresAt}`,
        paymentId: `fictif-facture-${counter}`,
        amountSats: amountSats ?? null,
        amountXof: amountXof ?? null,
        memo: memo ?? null,
        createdAt: iso(createdAt),
        expiresAt: iso(expiresAt),
      };
      invoices.set(invoice.paymentId, invoice);
      return ok(invoice);
    },
    async lookupInvoice(paymentId) {
      const blocked = guard();
      if (blocked) return blocked;
      const invoice = invoices.get(paymentId);
      if (!invoice) return ok(null);
      return ok({ invoice, payment: payments.find((p) => p.id === paymentId) ?? null });
    },
    async preview(destination, amountSats) {
      return guard() ?? decode(destination, amountSats);
    },
    async send({ destination, amountSats, maxFeeSats, pin: candidate }) {
      const blocked = guard();
      if (blocked) return blocked;
      const checked = checkPin(candidate);
      if (!checked.ok) return checked;
      if (maxFeeSats !== undefined && (!Number.isSafeInteger(maxFeeSats) || maxFeeSats < 0)) {
        return fail('AMOUNT_INVALID');
      }
      const preview = decode(destination, amountSats);
      if (!preview.ok) return preview;
      const amount = preview.value.amountSats;
      if (amount === null) return fail('AMOUNT_INVALID');
      if (!online) return fail('NETWORK_OFFLINE');
      // Comme le vrai wallet : un envoi identique en cours passe avant le contrôle du
      // solde, qui serait faussé par les fonds déjà réservés pour ce même envoi.
      const normalized = preview.value.destination.toLowerCase();
      const pendingKey = `${normalized}|${amount}`;
      const pending = pendingSends.get(pendingKey);
      if (pending) return fail('PAYMENT_PENDING', { paymentId: pending.payment.id });
      if (maxFeeSats !== undefined && feeSats > maxFeeSats) return fail('FEE_TOO_HIGH');
      if (amount + feeSats > sats) return fail('INSUFFICIENT_FUNDS');
      if (slowNextSend) {
        slowNextSend = false;
        counter += 1;
        sats -= amount + feeSats;
        const payment: Payment = {
          id: `fictif-${counter}`,
          direction: 'envoye',
          status: 'en_attente',
          amountSats: amount,
          feeSats,
          amountXof: xof(amount),
          memo: null,
          createdAt: iso(now()),
          failure: null,
        };
        payments.unshift(payment);
        pendingSends.set(pendingKey, { payment, destination: normalized });
        return fail('PAYMENT_TIMEOUT', { paymentId: payment.id });
      }
      sats -= amount + feeSats;
      paidDestinations.add(preview.value.destination.toLowerCase());
      if (preview.value.kind === 'facture') {
        paidInvoices.add(preview.value.destination.toLowerCase());
      }
      counter += 1;
      return ok(
        record({
          id: `fictif-${counter}`,
          direction: 'envoye',
          status: 'reussi',
          amountSats: amount,
          feeSats,
          amountXof: xof(amount),
          memo: null,
          createdAt: iso(now()),
          failure: null,
        }),
      );
    },
    async history({ limit = 50, before } = {}) {
      const blocked = guard();
      if (blocked) return blocked;
      // Curseur = identifiant du dernier paiement reçu : deux paiements du même
      // instant ne peuvent pas se perdre entre deux pages. Inconnu : liste vide.
      const start = before === undefined ? 0 : payments.findIndex((p) => p.id === before) + 1;
      if (start === 0 && before !== undefined) return ok([]);
      return ok(payments.slice(start, start + limit));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    simulateIncomingPayment(amountSats, memo) {
      sats += amountSats;
      counter += 1;
      return record({
        id: `fictif-${counter}`,
        direction: 'recu',
        status: 'reussi',
        amountSats,
        feeSats: 0,
        amountXof: xof(amountSats),
        memo: memo ?? null,
        createdAt: iso(now()),
        failure: null,
      });
    },
    simulateInvoicePaid(paymentId) {
      const invoice = invoices.get(paymentId);
      if (!invoice || payments.some((p) => p.id === paymentId)) return null;
      if (now() >= Date.parse(invoice.expiresAt)) return null;
      // Facture sans montant : le faux payeur envoie 1 000 sats.
      const amountSats = invoice.amountSats ?? 1_000;
      sats += amountSats;
      return record({
        id: paymentId,
        direction: 'recu',
        status: 'reussi',
        amountSats,
        feeSats: 0,
        // Prix du devis T17 quand il existe : le reçu ne dépend pas du taux courant.
        amountXof: invoice.amountXof ?? xof(amountSats),
        memo: invoice.memo,
        createdAt: iso(now()),
        failure: null,
      });
    },
    simulateSlowNextSend() {
      slowNextSend = true;
    },
    simulateSendSettled(paymentId, status) {
      const entry = [...pendingSends.entries()].find(([, item]) => item.payment.id === paymentId);
      if (!entry) return null;
      const [pendingKey, { payment, destination: destinationKey }] = entry;
      pendingSends.delete(pendingKey);
      payment.status = status;
      if (status === 'echoue') {
        payment.failure = 'NO_ROUTE';
        sats += payment.amountSats + payment.feeSats;
      } else {
        paidDestinations.add(destinationKey);
        if (detectDestination(destinationKey) === 'facture') paidInvoices.add(destinationKey);
      }
      emit({ type: 'paiement', payment: { ...payment } });
      emit({ type: 'solde', balance: balanceNow() });
      return { ...payment };
    },
    setOnline(value) {
      online = value;
      emit({ type: 'etat', state: currentState() });
    },
  };
}
