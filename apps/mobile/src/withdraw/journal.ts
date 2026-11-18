import type { WithdrawIntent, WithdrawJournalPort, WithdrawQuote, WithdrawResult } from './ports';

/** Métadonnées de simulation uniquement ; jamais de PIN ni de jeton d’accès. */
export interface WithdrawJournalStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const queues = new Map<string, Promise<void>>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const intentFields = new Set(['version', 'key', 'quote', 'withdrawalId']);
const quoteFields = new Set([
  'id',
  'simulation',
  'operator',
  'recipientId',
  'amountXof',
  'feeXof',
  'totalXof',
  'amountSats',
  'feeSats',
  'totalSats',
  'xofPerBtc',
  'source',
  'createdAt',
  'expiresAt',
]);
const failure = (code: string) => ({ ok: false as const, error: { code } });
function invalid(): never {
  throw new Error('JOURNAL_INVALID');
}
function record(value: unknown): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    invalid();
  for (const field of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (typeof field !== 'string' || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value'))
      invalid();
  }
  return value as Record<string, unknown>;
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) invalid();
  return value.toLowerCase();
}
function integer(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}
function iso(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value))
    return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
function quote(value: unknown): WithdrawQuote {
  const input = record(value);
  if (
    Object.keys(input).length !== quoteFields.size ||
    Object.keys(input).some((field) => !quoteFields.has(field)) ||
    input.simulation !== true ||
    (input.operator !== 'wave' && input.operator !== 'orange_money') ||
    input.recipientId !== (input.operator === 'wave' ? 'wave-demo-001' : 'orange-demo-001') ||
    !integer(input.amountXof, 1) ||
    input.amountXof > 5_000_000 ||
    input.feeXof !== 100 ||
    input.totalXof !== input.amountXof + 100 ||
    !integer(input.amountSats, 1) ||
    !integer(input.feeSats) ||
    !integer(input.totalSats, 1) ||
    !integer(input.xofPerBtc, 1) ||
    (input.source !== 'fixe' && input.source !== 'kraken') ||
    !iso(input.createdAt) ||
    !iso(input.expiresAt)
  )
    invalid();
  const duration = Date.parse(input.expiresAt) - Date.parse(input.createdAt);
  if (duration <= 0 || duration > 300_000) invalid();
  const sats = (amount: number) =>
    (BigInt(amount) * 100_000_000n + BigInt(input.xofPerBtc as number) - 1n) /
    BigInt(input.xofPerBtc as number);
  if (
    BigInt(input.amountSats) !== sats(input.amountXof) ||
    BigInt(input.totalSats) !== sats(input.totalXof as number) ||
    BigInt(input.totalSats) !== BigInt(input.amountSats) + BigInt(input.feeSats)
  )
    invalid();
  return Object.freeze({ ...input, id: uuid(input.id) }) as WithdrawQuote;
}
function parseIntent(value: unknown): WithdrawIntent {
  const input = record(value);
  if (
    Object.keys(input).some((field) => !intentFields.has(field)) ||
    input.version !== 1 ||
    !Object.hasOwn(input, 'key') ||
    !Object.hasOwn(input, 'quote')
  )
    invalid();
  return Object.freeze({
    version: 1,
    key: uuid(input.key),
    quote: quote(input.quote),
    ...(Object.hasOwn(input, 'withdrawalId') ? { withdrawalId: uuid(input.withdrawalId) } : {}),
  });
}
function sameQuote(a: WithdrawQuote, b: WithdrawQuote) {
  return [...quoteFields].every(
    (field) => a[field as keyof WithdrawQuote] === b[field as keyof WithdrawQuote],
  );
}
function nativeStorage(): WithdrawJournalStorage {
  // Chargement tardif : un module absent d’un ancien APK reste rattrapable.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require('@react-native-async-storage/async-storage');
  return (module as typeof import('@react-native-async-storage/async-storage')).default;
}
function enqueue<T>(
  key: string,
  operation: () => Promise<WithdrawResult<T>>,
): Promise<WithdrawResult<T>> {
  const previous = queues.get(key) ?? Promise.resolve();
  const result = previous.then(operation).catch(() => failure('JOURNAL_INVALID'));
  const tail = result.then(() => undefined);
  queues.set(key, tail);
  void tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return result;
}

/**
 * Le scope est un pseudonyme opaque du compte authentifié, jamais son jeton.
 * La file partagée évite les écrasements entre instances du même processus ;
 * elle ne prétend pas fournir une transaction entre plusieurs processus natifs.
 */
export function createWithdrawJournal(
  scope: string,
  storage?: WithdrawJournalStorage,
): WithdrawJournalPort {
  const validScope = typeof scope === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(scope);
  const key = validScope ? `@teranga-pay/withdraw/v1/${scope}` : '';
  const store = () => storage ?? nativeStorage();
  async function read(): Promise<WithdrawResult<WithdrawIntent | null>> {
    let raw: unknown;
    try {
      raw = await store().getItem(key);
    } catch {
      return failure('JOURNAL_READ_FAILED');
    }
    if (raw === null) return { ok: true, value: null };
    if (typeof raw !== 'string' || raw.length > 4096) return failure('JOURNAL_INVALID');
    try {
      return { ok: true, value: parseIntent(JSON.parse(raw) as unknown) };
    } catch {
      return failure('JOURNAL_INVALID');
    }
  }
  return {
    load() {
      if (!validScope) return Promise.resolve(failure('JOURNAL_SCOPE_INVALID'));
      return enqueue(key, read);
    },
    save(intent) {
      if (!validScope) return Promise.resolve(failure('JOURNAL_SCOPE_INVALID'));
      let next: WithdrawIntent;
      try {
        // Copie validée avant l’attente de la file : une mutation de l’appelant
        // ne change pas ensuite le prix ou l’identité à conserver.
        next = parseIntent(intent);
      } catch {
        return Promise.resolve(failure('JOURNAL_INVALID'));
      }
      return enqueue(key, async () => {
        const current = await read();
        if (!current.ok) return current;
        const previous = current.value;
        if (
          previous &&
          (previous.key !== next.key ||
            !sameQuote(previous.quote, next.quote) ||
            (previous.withdrawalId !== undefined &&
              next.withdrawalId !== undefined &&
              previous.withdrawalId !== next.withdrawalId))
        )
          return failure('JOURNAL_CONFLICT');
        const saved =
          previous?.withdrawalId !== undefined
            ? { ...next, withdrawalId: previous.withdrawalId }
            : next;
        try {
          await store().setItem(key, JSON.stringify(saved));
          return { ok: true, value: undefined };
        } catch {
          return failure('JOURNAL_WRITE_FAILED');
        }
      });
    },
    clear(expectedKey) {
      if (!validScope) return Promise.resolve(failure('JOURNAL_SCOPE_INVALID'));
      let expected: string;
      try {
        expected = uuid(expectedKey);
      } catch {
        return Promise.resolve(failure('JOURNAL_INVALID'));
      }
      return enqueue(key, async () => {
        const current = await read();
        if (!current.ok) return current;
        if (current.value === null) return { ok: true, value: undefined };
        if (current.value.key !== expected) return failure('JOURNAL_CONFLICT');
        try {
          await store().removeItem(key);
          return { ok: true, value: undefined };
        } catch {
          return failure('JOURNAL_CLEAR_FAILED');
        }
      });
    },
  };
}
