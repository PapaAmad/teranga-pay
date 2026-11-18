import type { HomePayment, HomeWalletEvent } from '../home/ports';
import type { HistoryServices, HistoryWithdrawal } from './ports';

export type HistoryPreviewScenario =
  | 'ready'
  | 'empty'
  | 'partial'
  | 'offline'
  | 'walletError'
  | 'withdrawalError'
  | 'unknownAmounts'
  | 'largeAmount'
  | 'locked'
  | 'pagingError';
export type HistoryPreviewServices = HistoryServices & { now(): number; confirmPending(): void };

/** Journal fictif sans réseau : aucun règlement automatique ni donnée personnelle. */
export function createHistoryPreviewServices(
  scenario: HistoryPreviewScenario = 'ready',
  { now = Date.now }: { now?: () => number } = {},
): HistoryPreviewServices {
  const origin = now();
  const iso = (minutes: number) => new Date(origin - minutes * 60_000).toISOString();
  const uuid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const record = (
    id: string,
    direction: HomePayment['direction'],
    amountXof: number | null,
    minutes: number,
    status: HomePayment['status'] = 'reussi',
  ): HomePayment => ({
    id,
    direction,
    status,
    amountXof,
    amountSats:
      amountXof === null
        ? 5556
        : Number((BigInt(amountXof) * 100_000_000n + 44_999_999n) / 45_000_000n),
    feeSats: direction === 'recu' ? 0 : 3,
    memo: null,
    createdAt: iso(minutes),
    failure: status === 'echoue' ? 'NO_ROUTE' : null,
  });
  const count =
    scenario === 'empty' ? 0 : scenario === 'partial' || scenario === 'pagingError' ? 45 : 8;
  let payments: HomePayment[] =
    scenario === 'empty'
      ? []
      : [
          record('demo-reception-1', 'recu', 12500, 2),
          record('demo-envoi-1', 'envoye', 2500, 12),
          record('demo-reception-2', 'recu', 2500, 28),
          record('demo-attente-1', 'recu', 4500, 45, 'en_attente'),
          record('demo-echec-1', 'envoye', 1500, 70, 'echoue'),
          record('demo-reception-3', 'recu', 5000, 100),
          record('demo-hier-1', 'recu', 7500, 1445),
          record('demo-hier-2', 'envoye', 3000, 1500),
        ];
  for (let i = payments.length; i < count; i++)
    payments.push(
      record(`demo-ancienne-${i}`, i % 2 === 0 ? 'recu' : 'envoye', 1000 + i, 1600 + i * 30),
    );
  if (scenario === 'unknownAmounts')
    payments = payments.map((p, i) => (i === 0 || i === 2 ? { ...p, amountXof: null } : p));
  if (scenario === 'largeAmount')
    payments = payments.map((p, i) =>
      i === 0
        ? { ...p, amountXof: Number.MAX_SAFE_INTEGER - 3, amountSats: Number.MAX_SAFE_INTEGER - 10 }
        : p,
    );
  function withdrawal(
    index: number,
    operator: HistoryWithdrawal['operator'],
    amountXof: number,
    minutes: number,
    status: HistoryWithdrawal['status'],
  ): HistoryWithdrawal {
    const amountSats = Number((BigInt(amountXof) * 100_000_000n + 44_999_999n) / 45_000_000n);
    const totalSats = Number((BigInt(amountXof + 100) * 100_000_000n + 44_999_999n) / 45_000_000n);
    return {
      id: uuid(index),
      quoteId: uuid(100 + index),
      simulation: true,
      operator,
      recipientId: operator === 'wave' ? 'wave-demo-001' : 'orange-demo-001',
      amountXof,
      feeXof: 100,
      totalXof: amountXof + 100,
      amountSats,
      feeSats: totalSats - amountSats,
      totalSats,
      xofPerBtc: 45_000_000,
      source: 'fixe',
      quoteCreatedAt: iso(minutes + 1),
      quoteExpiresAt: new Date(Date.parse(iso(minutes + 1)) + 300_000).toISOString(),
      createdAt: iso(minutes),
      updatedAt: iso(Math.max(0, minutes - 1)),
      status,
      failure:
        status === 'incertain'
          ? 'PROVIDER_UNAVAILABLE'
          : status === 'echoue'
            ? 'PROVIDER_DECLINED'
            : null,
    };
  }
  const withdrawals =
    scenario === 'empty'
      ? []
      : [
          withdrawal(1, 'wave', 10000, 18, 'reussi'),
          withdrawal(2, 'orange_money', 5000, 90, 'incertain'),
          withdrawal(3, 'orange_money', 2000, 1480, 'echoue'),
        ];
  let pageFailure = scenario === 'pagingError';
  return {
    mode: 'preview',
    now,
    wallet: {
      state: async () =>
        scenario === 'locked' ? 'verrouille' : scenario === 'offline' ? 'hors_ligne' : 'pret',
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      async history({ limit = 20, before } = {}) {
        if (scenario === 'walletError') return { ok: false, error: { code: 'READ_FAILED' } };
        const anchor = before ? payments.findIndex((p) => p.id === before) : -1;
        if (before && anchor < 0) return { ok: false, error: { code: 'INVALID_PAGINATION' } };
        if (before && pageFailure) {
          pageFailure = false;
          return { ok: false, error: { code: 'READ_FAILED' } };
        }
        return {
          ok: true,
          value: payments.slice(anchor + 1, anchor + 1 + limit).map((p) => ({ ...p })),
        };
      },
    },
    withdrawals: {
      async history({ limit = 20, before } = {}) {
        if (scenario === 'withdrawalError') return { ok: false, error: { code: 'READ_FAILED' } };
        const anchor = before ? withdrawals.findIndex((p) => p.id === before) : -1;
        if (before && anchor < 0) return { ok: false, error: { code: 'INVALID_PAGINATION' } };
        const items = withdrawals.slice(anchor + 1, anchor + 1 + limit);
        return {
          ok: true,
          value: {
            simulation: true,
            items: items.map((p) => ({ ...p })),
            nextCursor: anchor + 1 + items.length < withdrawals.length ? items.at(-1)!.id : null,
          },
        };
      },
    },
    confirmPending() {
      const index = payments.findIndex((p) => p.status === 'en_attente');
      if (index < 0) return;
      const payment = { ...payments[index]!, status: 'reussi' as const, failure: null };
      payments = payments.map((p, i) => (i === index ? payment : p));
      listeners.forEach((listener) => listener({ type: 'paiement', payment: { ...payment } }));
    },
  };
}
