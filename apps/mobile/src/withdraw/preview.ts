import { createWithdrawJournal } from './journal';
import type {
  WithdrawBalance,
  WithdrawBridgePort,
  WithdrawOperation,
  WithdrawQuote,
  WithdrawResult,
  WithdrawServices,
} from './ports';

export type WithdrawPreviewScenario =
  | 'ready'
  | 'pending'
  | 'lostResponse'
  | 'providerUnavailable'
  | 'declined'
  | 'emptyBalance'
  | 'quoteFailure'
  | 'offline'
  | 'journalFailure';
const ok = <T>(value: T): WithdrawResult<T> => ({ ok: true, value });
const failure = (code: string, withdrawalId?: string): WithdrawResult<never> => ({
  ok: false,
  error: { code, ...(withdrawalId ? { withdrawalId } : {}) },
});

/** Atelier isolé sans réseau, token, PIN ni mouvement d’argent réel. */
export function createWithdrawPreviewServices(
  scenario: WithdrawPreviewScenario = 'ready',
  { now: readTime = Date.now }: { now?: () => number } = {},
): WithdrawServices & {
  now(): number;
  expireQuote(): void;
  completePending(): void;
  restoreProvider(): void;
  inspect(): { reservations: number; effects: number };
} {
  let offset = 0,
    sequence = 0,
    availableSats = scenario === 'emptyBalance' ? 0 : 2_000_000,
    heldSats = 0,
    effects = 0,
    lost = scenario === 'lostResponse',
    providerAvailable = scenario !== 'providerUnavailable';
  const now = () => readTime() + offset;
  const uuid = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const quotes = new Map<string, WithdrawQuote>();
  const operations = new Map<string, WithdrawOperation>();
  const keys = new Map<string, string>();
  const data = new Map<string, string>();
  const journal = createWithdrawJournal('demo-preview', {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      if (scenario === 'journalFailure') throw new Error('DEMO_STORAGE_UNAVAILABLE');
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  });
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  const satsForXof = (value: number) =>
    Number((BigInt(value) * 100_000_000n + 45_000_000n - 1n) / 45_000_000n);
  function balance(): WithdrawBalance {
    return { simulation: true, availableSats, heldSats };
  }
  function settle(id: string, success: boolean): WithdrawOperation {
    const previous = operations.get(id)!;
    if (previous.status === 'reussi' || previous.status === 'echoue') return previous;
    heldSats -= previous.totalSats;
    if (success) effects += 1;
    else availableSats += previous.totalSats;
    const next: WithdrawOperation = {
      ...previous,
      status: success ? 'reussi' : 'echoue',
      failure: success ? null : 'PROVIDER_DECLINED',
      updatedAt: new Date(now()).toISOString(),
    };
    operations.set(id, next);
    return next;
  }
  const bridge: WithdrawBridgePort = {
    options: async () =>
      scenario === 'offline'
        ? failure('NETWORK_OFFLINE')
        : ok({
            simulation: true,
            currency: 'XOF',
            feeXof: 100,
            maxAmountXof: 5_000_000,
            operators: [
              { operator: 'wave', recipientId: 'wave-demo-001' },
              { operator: 'orange_money', recipientId: 'orange-demo-001' },
            ],
          }),
    balance: async () => ok(balance()),
    async quote(input) {
      if (scenario === 'quoteFailure') return failure('RATE_UNAVAILABLE');
      if (
        !Number.isSafeInteger(input.amountXof) ||
        input.amountXof < 1 ||
        input.amountXof > 5_000_000 ||
        input.recipientId !== (input.operator === 'wave' ? 'wave-demo-001' : 'orange-demo-001')
      )
        return failure('INVALID_INPUT');
      const amountSats = satsForXof(input.amountXof),
        totalSats = satsForXof(input.amountXof + 100);
      const issuedAt = now();
      const quote: WithdrawQuote = {
        ...input,
        id: uuid(),
        simulation: true,
        feeXof: 100,
        totalXof: input.amountXof + 100,
        amountSats,
        totalSats,
        feeSats: totalSats - amountSats,
        xofPerBtc: 45_000_000,
        source: 'fixe',
        createdAt: new Date(issuedAt).toISOString(),
        expiresAt: new Date(issuedAt + 300_000).toISOString(),
      };
      quotes.set(quote.id, quote);
      return ok(clone(quote));
    },
    async confirm({ quoteId, key }) {
      const previousId = keys.get(key);
      if (previousId) {
        const previous = operations.get(previousId)!;
        return previous.quoteId === quoteId
          ? ok(clone(previous))
          : failure('IDEMPOTENCY_CONFLICT', previous.id);
      }
      const used = [...operations.values()].find((operation) => operation.quoteId === quoteId);
      if (used) return failure('QUOTE_ALREADY_USED', used.id);
      const quote = quotes.get(quoteId);
      if (!quote) return failure('QUOTE_NOT_FOUND');
      if (now() >= Date.parse(quote.expiresAt)) return failure('QUOTE_EXPIRED');
      if (quote.totalSats > availableSats) return failure('INSUFFICIENT_FUNDS');
      const { createdAt, expiresAt, ...price } = quote;
      const operation: WithdrawOperation = {
        ...price,
        id: uuid(),
        quoteId: quote.id,
        quoteCreatedAt: createdAt,
        quoteExpiresAt: expiresAt,
        createdAt: new Date(now()).toISOString(),
        updatedAt: new Date(now()).toISOString(),
        status: scenario === 'providerUnavailable' ? 'incertain' : 'en_attente',
        failure: scenario === 'providerUnavailable' ? 'PROVIDER_UNAVAILABLE' : null,
      };
      availableSats -= quote.totalSats;
      heldSats += quote.totalSats;
      operations.set(operation.id, operation);
      keys.set(key, operation.id);
      const result =
        scenario === 'pending' || scenario === 'providerUnavailable'
          ? operation
          : settle(operation.id, scenario !== 'declined');
      if (lost) {
        lost = false;
        throw new Error('DEMO_RESPONSE_LOST');
      }
      return ok(clone(result));
    },
    async get(id) {
      const operation = operations.get(id);
      return operation ? ok(clone(operation)) : failure('WITHDRAWAL_NOT_FOUND');
    },
    async reconcile(id) {
      const operation = operations.get(id);
      return operation ? ok(clone(operation)) : failure('WITHDRAWAL_NOT_FOUND');
    },
    async retry(id) {
      const operation = operations.get(id);
      if (!operation) return failure('WITHDRAWAL_NOT_FOUND');
      if (operation.status === 'reussi' || operation.status === 'echoue')
        return ok(clone(operation));
      return ok(clone(providerAvailable ? settle(id, true) : operation));
    },
  };
  return {
    mode: 'preview',
    bridge,
    journal,
    createKey: uuid,
    now,
    expireQuote: () => {
      offset += 300_001;
    },
    completePending: () => {
      for (const operation of operations.values())
        if (operation.status === 'en_attente') settle(operation.id, true);
    },
    restoreProvider: () => {
      providerAvailable = true;
    },
    inspect: () => ({ reservations: operations.size, effects }),
  };
}
