import type { HomePayment, HomeWalletEvent } from '../home/ports';
import type { CollectRequest, CollectServices } from './ports';

export type CollectPreviewScenario =
  | 'waiting'
  | 'paid'
  | 'late'
  | 'expired'
  | 'unknown'
  | 'offline'
  | 'locked'
  | 'error'
  | 'mismatch'
  | 'longInvoice'
  | 'slowRead'
  | 'slowCreate';

/** Atelier contrôlé, en mémoire : aucune facture valide, aucune clé, aucun réseau. */
export function createCollectPreviewServices(
  scenario: CollectPreviewScenario = 'waiting',
  { now = Date.now }: { now?: () => number } = {},
): CollectServices & {
  now(): number;
  advanceTime(milliseconds: number): void;
  confirmPayment(paymentId?: string): void;
} {
  let offset = 0;
  let sequence = 0;
  let latestId: string | null = null;
  const clock = () => now() + offset;
  const iso = (time: number) => new Date(time).toISOString();
  const records = new Map<string, { request: CollectRequest; payment: HomePayment | null }>();
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  function settle(id = latestId) {
    const entry = id === null ? null : records.get(id);
    if (!entry || entry.payment) return;
    entry.payment = {
      id: scenario === 'mismatch' ? 'apercu-autre-demande' : entry.request.paymentId,
      direction: 'recu',
      status: 'reussi',
      amountSats: entry.request.invoice.amountSats!,
      feeSats: 0,
      amountXof: null,
      memo: null,
      createdAt: iso(clock()),
      failure: null,
    };
    listeners.forEach((listener) => listener({ type: 'paiement', payment: entry.payment! }));
  }
  return {
    mode: 'preview',
    now: clock,
    wallet: {
      state: async () =>
        scenario === 'offline' ? 'hors_ligne' : scenario === 'locked' ? 'verrouille' : 'pret',
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    rates: {
      async quote(amountXof) {
        if (scenario === 'slowRead') return new Promise<never>(() => {});
        if (scenario === 'error') return { ok: false, error: { code: 'RATE_UNAVAILABLE' } };
        const rate = 45_000_000n;
        const issuedAt = clock();
        sequence += 1;
        return {
          ok: true,
          value: {
            id: `apercu-devis-collecte-${sequence}`,
            amountXof,
            amountSats: Number((BigInt(amountXof) * 100_000_000n + rate - 1n) / rate),
            xofPerBtc: Number(rate),
            source: 'fixe',
            createdAt: iso(issuedAt),
            expiresAt: iso(issuedAt + 300_000),
          },
        };
      },
    },
    invoices: {
      async create({ quote }) {
        const paymentId = `apercu-collecte-fictive-${sequence}`;
        const paymentRequest =
          scenario === 'longInvoice'
            ? `lnbcrt1${'a'.repeat(2041)}`
            : `lnbcrt1exemplecollectefictivenonpayable${sequence}`.padEnd(326, 'a');
        const request: CollectRequest = {
          paymentId,
          invoice: {
            paymentRequest,
            amountSats: quote.amountSats,
            amountXof: quote.amountXof,
            memo: null,
            createdAt: iso(clock()),
            expiresAt: quote.expiresAt,
          },
        };
        records.set(paymentId, { request, payment: null });
        latestId = paymentId;
        if (scenario === 'slowCreate') return new Promise<never>(() => {});
        if (scenario === 'unknown') throw new Error('création fictive interrompue');
        if (scenario === 'expired' || scenario === 'late') offset += 300_001;
        return { ok: true, value: request };
      },
      async lookup({ paymentId, paymentRequest }) {
        const entry = records.get(paymentId);
        if (!entry || entry.request.invoice.paymentRequest !== paymentRequest)
          return { ok: false, error: { code: 'DESTINATION_INVALID' } };
        if (scenario === 'paid' || scenario === 'late' || scenario === 'mismatch')
          settle(paymentId);
        return { ok: true, value: { paymentRequest, payment: entry.payment } };
      },
    },
    advanceTime(milliseconds) {
      if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) return;
      offset += milliseconds;
      listeners.forEach((listener) =>
        listener({
          type: 'etat',
          state:
            scenario === 'offline' ? 'hors_ligne' : scenario === 'locked' ? 'verrouille' : 'pret',
        }),
      );
    },
    confirmPayment: settle,
  };
}
