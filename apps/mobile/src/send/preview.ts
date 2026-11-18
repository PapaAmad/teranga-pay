import type { HomeBalance, HomePayment, HomeResult, HomeWalletEvent } from '../home/ports';
import type { SendPaymentPreview, SendQuote, SendServices, SendWalletPort } from './ports';

export type SendPreviewScenario =
  | 'success'
  | 'pending'
  | 'unknown'
  | 'failed'
  | 'PIN_INVALID'
  | 'expired'
  | 'insufficient'
  | 'offline'
  | 'error'
  | 'feesUnavailable'
  | 'amountRequested'
  | 'invalid';

/** Cette chaîne n'est pas une facture BOLT11 valide et ne peut jamais être payée. */
export const sendPreviewInvoice = 'lnbcrt1exemplefictifnonpayable';
export const sendPreviewAddress = 'exemple@teranga.example';

/** Atelier sans réseau, sans clé ni SDK : tous les résultats sont fictifs. */
export function createSendPreviewServices(
  initialScenario: SendPreviewScenario = 'success',
  { now = Date.now }: { now?: () => number } = {},
): SendServices & { setScenario(scenario: SendPreviewScenario): void } {
  let scenario = initialScenario;
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  let payment: HomePayment | null = null;
  const iso = (ms: number) => new Date(ms).toISOString();
  const fail = <T>(value: string): HomeResult<T> => ({ ok: false, error: { code: value } });
  const balance = (): HomeBalance => ({
    spendableSats: scenario === 'insufficient' ? 100 : 100_000,
    pendingSats: 0,
    spendableXof: scenario === 'insufficient' ? 45 : 45_000,
    rate: { xofPerBtc: 45_000_000, source: 'fixe', fetchedAt: iso(now()) },
    updatedAt: iso(now()),
  });
  const wallet: SendWalletPort = {
    state: async () => (scenario === 'offline' ? 'hors_ligne' : 'pret'),
    balance: async () =>
      scenario === 'error' ? fail('READ_FAILED') : { ok: true, value: balance() },
    async preview(destination, amountSats) {
      if (scenario === 'invalid') return fail('DESTINATION_INVALID');
      if (scenario === 'expired') return fail('INVOICE_EXPIRED');
      if (scenario === 'error') return fail('READ_FAILED');
      const amount = amountSats ?? (scenario === 'amountRequested' ? null : 10_000);
      const fee = amount === null ? 10 : Math.max(10, Math.ceil(amount / 100));
      const value: SendPaymentPreview = {
        kind: destination.includes('@') ? 'adresse_lightning' : 'facture',
        destination,
        amountSats: amount,
        maxFeeSats: fee,
        amountXof:
          amount === null || scenario === 'feesUnavailable'
            ? null
            : Math.floor((amount * 45_000_000) / 100_000_000),
        maxFeeXof:
          scenario === 'feesUnavailable' ? null : Math.ceil((fee * 45_000_000) / 100_000_000),
        memo: null,
        expiresAt: destination.includes('@') ? null : iso(now() + 3_600_000),
        newRecipient: true,
      };
      return { ok: true, value };
    },
    async send(request) {
      if (!/^\d{6}$/.test(request.pin)) return fail('PIN_FORMAT');
      if (scenario === 'PIN_INVALID')
        return { ok: false, error: { code: 'PIN_INVALID', attemptsLeft: 4 } };
      if (scenario === 'unknown') return fail('PAYMENT_TIMEOUT');
      if (scenario === 'failed') return fail('NO_ROUTE');
      if (scenario === 'offline') return fail('NETWORK_OFFLINE');
      if (scenario === 'expired') return fail('INVOICE_EXPIRED');
      if (scenario === 'insufficient') return fail('INSUFFICIENT_FUNDS');
      if (!request.amountSats || request.maxFeeSats === undefined) return fail('AMOUNT_INVALID');
      payment = Object.freeze({
        id: 'apercu-envoi-fictif',
        direction: 'envoye',
        status: scenario === 'pending' ? 'en_attente' : 'reussi',
        amountSats: request.amountSats,
        feeSats: Math.min(request.maxFeeSats, 12),
        amountXof: Math.floor((request.amountSats * 45_000_000) / 100_000_000),
        memo: null,
        createdAt: iso(now()),
        failure: null,
      });
      return { ok: true, value: payment };
    },
    history: async () => ({ ok: true, value: payment ? [payment] : [] }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    mode: 'preview',
    wallet,
    rates: {
      async quote(amountXof) {
        if (scenario === 'error' || scenario === 'feesUnavailable') return fail('RATE_UNAVAILABLE');
        const rate = 45_000_000n;
        const amountSats = Number((BigInt(amountXof) * 100_000_000n + rate - 1n) / rate);
        const value: SendQuote = {
          id: 'apercu-devis-fictif',
          amountXof,
          amountSats,
          xofPerBtc: Number(rate),
          source: 'fixe',
          createdAt: iso(now()),
          expiresAt: iso(now() + 300_000),
        };
        return { ok: true, value };
      },
    },
    setScenario(next) {
      scenario = next;
      // Ne lève aucune barrière d'envoi déjà soumis. Un autre atelier utilise un nouveau wallet.
      listeners.forEach((listener) =>
        listener({ type: 'etat', state: next === 'offline' ? 'hors_ligne' : 'pret' }),
      );
    },
  };
}
