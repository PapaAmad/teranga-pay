import type { HistoryWithdrawal, HistoryWithdrawalPort } from '../history/ports';
import type { HomeRate, HomeResult } from '../home/ports';
import { createRiskPort } from '../risk/assessment';
import type { RiskPort } from '../risk/ports';
import type { SendQuote, SendRatePort } from '../send/ports';
import type {
  WithdrawBridgePort,
  WithdrawOptions,
  WithdrawBalance,
  WithdrawQuote,
  WithdrawError,
  WithdrawResult,
} from '../withdraw/ports';

/** Le transport natif et les tests partagent cette petite frontière HTTP. */
export type RuntimeFetch = (
  url: string,
  init: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
    signal: AbortSignal;
    redirect: 'error';
  },
) => Promise<{ status: number; text(): Promise<string> }>;

export type RuntimeApiConfig = Readonly<{
  baseUrl: string;
  fetch?: RuntimeFetch;
  /** Lecture du coffre de la session ; jamais une variable EXPO_PUBLIC. */
  bridgeToken?: () => Promise<string | null>;
  timeoutMs?: number;
  now?: () => number;
}>;

export interface RuntimeRatePort extends SendRatePort {
  /** Cache validé et récent pour la conversion du wallet ; aucune E/S cachée. */
  current(): HomeRate | null;
  refresh(): Promise<HomeResult<HomeRate>>;
}

export type RuntimeApi = Readonly<{
  rates: RuntimeRatePort;
  risk: RiskPort;
  /** Compte fictif distinct du wallet natif. */
  bridge: WithdrawBridgePort;
  withdrawals: HistoryWithdrawalPort;
  /** Ferme les requêtes de la session perdue, sans désactiver la prochaine. */
  cancelPending(): void;
  dispose(): void;
}>;

const maxXof = 5_000_000;
const maxSats = 2_100_000_000_000_000;
const minRate = 1_000_000;
const maxRate = 10_000_000_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const failure = (code: string): { ok: false; error: WithdrawError } => ({
  ok: false,
  error: { code },
});
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const sats = (value: unknown, min = 0): value is number => integer(value, min, maxSats);
const uuid = (value: unknown): value is string =>
  typeof value === 'string' && value.length === 36 && uuidPattern.test(value);
const iso = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

function object(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
    required.some((key) => !Object.hasOwn(input, key)) ||
    Reflect.ownKeys(input).some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      return (
        typeof key !== 'string' ||
        (!required.includes(key) && !optional.includes(key)) ||
        !descriptor?.enumerable ||
        !Object.hasOwn(descriptor, 'value')
      );
    })
  )
    return null;
  return input;
}

const rateFields = ['xofPerBtc', 'source'] as const;
function validRate(value: Record<string, unknown>): boolean {
  return (
    integer(value.xofPerBtc, minRate, maxRate) &&
    (value.source === 'fixe' || value.source === 'kraken')
  );
}
function readRate(value: unknown): HomeRate | null {
  const input = object(value, [...rateFields, 'fetchedAt']);
  return input && validRate(input) && iso(input.fetchedAt)
    ? (Object.freeze({ ...input }) as HomeRate)
    : null;
}
function converted(xof: number, rate: number): number {
  return Number((BigInt(xof) * 100_000_000n + BigInt(rate) - 1n) / BigInt(rate));
}
const quoteFields = [
  'id',
  'amountXof',
  'amountSats',
  ...rateFields,
  'createdAt',
  'expiresAt',
] as const;
function readQuote(value: unknown, ttlMs = 3_600_000): SendQuote | null {
  const input = object(value, quoteFields);
  if (
    !input ||
    !uuid(input.id) ||
    !integer(input.amountXof, 1, maxXof) ||
    !sats(input.amountSats, 1) ||
    !validRate(input) ||
    !iso(input.createdAt) ||
    !iso(input.expiresAt)
  )
    return null;
  const duration = Date.parse(input.expiresAt) - Date.parse(input.createdAt);
  if (
    duration <= 0 ||
    duration > ttlMs ||
    input.amountSats !== converted(input.amountXof, input.xofPerBtc as number)
  )
    return null;
  return Object.freeze({ ...input, id: input.id.toLowerCase() }) as SendQuote;
}

const bridgeFields = [
  'simulation',
  'operator',
  'recipientId',
  'feeXof',
  'totalXof',
  'feeSats',
  'totalSats',
] as const;
function validRecipient(input: Record<string, unknown>): boolean {
  return (
    (input.operator === 'wave' && input.recipientId === 'wave-demo-001') ||
    (input.operator === 'orange_money' && input.recipientId === 'orange-demo-001')
  );
}
function readWithdrawQuote(value: unknown): WithdrawQuote | null {
  const input = object(value, [...quoteFields, ...bridgeFields]);
  if (!input) return null;
  const quote = readQuote(Object.fromEntries(quoteFields.map((key) => [key, input[key]])), 300_000);
  if (
    !quote ||
    input.simulation !== true ||
    !validRecipient(input) ||
    input.feeXof !== 100 ||
    input.totalXof !== quote.amountXof + 100 ||
    !sats(input.feeSats) ||
    !sats(input.totalSats, 1) ||
    input.totalSats !== quote.amountSats + input.feeSats ||
    input.totalSats !== converted(input.totalXof as number, quote.xofPerBtc)
  )
    return null;
  return Object.freeze({ ...input, ...quote }) as WithdrawQuote;
}

const operationFields = [
  ...quoteFields.filter((field) => field !== 'expiresAt'),
  ...bridgeFields,
  'quoteId',
  'quoteCreatedAt',
  'quoteExpiresAt',
  'updatedAt',
  'status',
  'failure',
] as const;
function readWithdrawal(value: unknown): HistoryWithdrawal | null {
  const input = object(value, operationFields);
  if (
    !input ||
    !uuid(input.id) ||
    !uuid(input.quoteId) ||
    !iso(input.createdAt) ||
    !iso(input.updatedAt) ||
    !['en_attente', 'incertain', 'reussi', 'echoue'].includes(input.status as string) ||
    !(
      input.failure === null ||
      (typeof input.failure === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(input.failure))
    ) ||
    (['en_attente', 'reussi'].includes(input.status as string) && input.failure !== null)
  )
    return null;
  const quote = readWithdrawQuote({
    ...Object.fromEntries([...quoteFields, ...bridgeFields].map((key) => [key, input[key]])),
    id: input.quoteId,
    createdAt: input.quoteCreatedAt,
    expiresAt: input.quoteExpiresAt,
  });
  if (
    !quote ||
    Date.parse(input.createdAt) < Date.parse(quote.createdAt) ||
    Date.parse(input.createdAt) >= Date.parse(quote.expiresAt) ||
    Date.parse(input.updatedAt) < Date.parse(input.createdAt)
  )
    return null;
  return Object.freeze({
    ...input,
    id: input.id.toLowerCase(),
    quoteId: input.quoteId.toLowerCase(),
  }) as HistoryWithdrawal;
}

function readOptions(value: unknown): WithdrawOptions | null {
  const input = object(value, ['simulation', 'currency', 'feeXof', 'maxAmountXof', 'operators']);
  if (
    !input ||
    input.simulation !== true ||
    input.currency !== 'XOF' ||
    input.feeXof !== 100 ||
    !integer(input.maxAmountXof, 1, maxXof) ||
    !Array.isArray(input.operators) ||
    input.operators.length !== 2
  )
    return null;
  const operators = input.operators.map((entry) => object(entry, ['operator', 'recipientId']));
  if (
    operators.some((entry) => !entry || !validRecipient(entry)) ||
    operators[0]!.operator === operators[1]!.operator
  )
    return null;
  return Object.freeze({
    ...input,
    operators: Object.freeze(operators.map((entry) => Object.freeze({ ...entry }))),
  }) as WithdrawOptions;
}
function readBalance(value: unknown): WithdrawBalance | null {
  const input = object(value, ['simulation', 'availableSats', 'heldSats']);
  return input &&
    input.simulation === true &&
    sats(input.availableSats) &&
    sats(input.heldSats) &&
    sats(input.availableSats + input.heldSats)
    ? (Object.freeze({ ...input }) as WithdrawBalance)
    : null;
}

const errorStatuses: Readonly<Record<string, readonly number[]>> = {
  VALIDATION_ERROR: [400],
  INVALID_INPUT: [400],
  BAD_REQUEST: [400],
  UNAUTHORIZED: [401],
  NOT_FOUND: [404],
  ACCOUNT_NOT_FOUND: [404],
  WITHDRAWAL_NOT_FOUND: [404],
  QUOTE_NOT_FOUND: [404],
  QUOTE_EXPIRED: [410],
  QUOTE_ALREADY_USED: [409],
  IDEMPOTENCY_CONFLICT: [409],
  INSUFFICIENT_FUNDS: [409],
  PROVIDER_MISMATCH: [409],
  QUOTE_CONFLICT: [409],
  PAYLOAD_TOO_LARGE: [413],
  UNSUPPORTED_MEDIA_TYPE: [415],
  RATE_LIMITED: [429],
  INTERNAL_ERROR: [500],
  PROVIDER_UNAVAILABLE: [503],
  STORAGE_CLOSED: [503],
  RATE_UNAVAILABLE: [503],
};
function readError(value: unknown, status: number, authenticated: boolean): WithdrawError | null {
  const envelope = object(value, ['error']);
  const input =
    envelope && object(envelope.error, ['code', 'requestId'], ['fields', 'withdrawalId']);
  if (
    !input ||
    typeof input.code !== 'string' ||
    !Object.hasOwn(errorStatuses, input.code) ||
    !errorStatuses[input.code]!.includes(status) ||
    !uuid(input.requestId) ||
    (input.fields !== undefined &&
      (!Array.isArray(input.fields) ||
        input.fields.length > 64 ||
        !input.fields.every(
          (field) => typeof field === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(field),
        ))) ||
    (input.withdrawalId !== undefined &&
      (!authenticated ||
        !['QUOTE_ALREADY_USED', 'IDEMPOTENCY_CONFLICT'].includes(input.code) ||
        !uuid(input.withdrawalId)))
  )
    return null;
  return Object.freeze({
    code: input.code,
    ...(input.withdrawalId === undefined
      ? {}
      : { withdrawalId: (input.withdrawalId as string).toLowerCase() }),
  });
}

export function runtimeApiOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      (url.protocol === 'http:' &&
        !['127.0.0.1', 'localhost', '[::1]', '10.0.2.2'].includes(url.hostname))
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Une requête par appel, y compris pour les mutations financières ; aucun rejeu automatique. */
export function createRuntimeApi(config: RuntimeApiConfig): RuntimeApi {
  const origin = runtimeApiOrigin(config.baseUrl);
  const timeoutMs = config.timeoutMs ?? 8_000;
  const validTimeout = integer(timeoutMs, 1, 60_000);
  const now = config.now ?? Date.now;
  const fetchImpl: RuntimeFetch = config.fetch ?? ((url, init) => fetch(url, init));
  const requests = new Set<AbortController>();
  let disposed = false;
  let currentRate: HomeRate | null = null;
  const cancelPending = () => {
    for (const controller of requests) controller.abort();
  };

  async function request<T>(
    path: string,
    read: (value: unknown) => T | null,
    {
      body,
      authenticated = false,
      key,
      statuses = [200],
    }: {
      body?: unknown;
      authenticated?: boolean;
      key?: string;
      statuses?: readonly number[];
    } = {},
  ): Promise<WithdrawResult<T>> {
    if (disposed) return failure('READ_FAILED');
    if (!origin || !validTimeout) return failure('INVALID_INPUT');
    const controller = new AbortController();
    requests.add(controller);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortListener: (() => void) | undefined;
    let timedOut = false;
    try {
      return await Promise.race([
        new Promise<never>((_, reject) => {
          abortListener = () => reject(new Error('HTTP_CANCELLED'));
          controller.signal.addEventListener('abort', abortListener, { once: true });
          timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutMs);
        }),
        (async (): Promise<WithdrawResult<T>> => {
          const headers: Record<string, string> = { Accept: 'application/json' };
          if (authenticated) {
            let token: string | null;
            try {
              token = (await config.bridgeToken?.()) ?? null;
            } catch {
              return failure('UNAUTHORIZED');
            }
            if (
              typeof token !== 'string' ||
              token.length < 32 ||
              token.length > 128 ||
              /[^A-Za-z0-9_-]/.test(token)
            )
              return failure('UNAUTHORIZED');
            headers.Authorization = `Bearer ${token}`;
          }
          // Un coffre lent peut avoir été annulé avant de fournir son jeton.
          if (controller.signal.aborted || disposed) return failure('READ_FAILED');
          if (body !== undefined) headers['Content-Type'] = 'application/json';
          if (key !== undefined) headers['Idempotency-Key'] = key;
          const response = await fetchImpl(`${origin}${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            signal: controller.signal,
            redirect: 'error',
          });
          const raw = await response.text();
          if (raw.length > 262_144) return failure('INVALID_DATA');
          let value: unknown;
          try {
            value = JSON.parse(raw) as unknown;
          } catch {
            return failure('INVALID_DATA');
          }
          if (!statuses.includes(response.status)) {
            const error = readError(value, response.status, authenticated);
            return error ? { ok: false, error } : failure('INVALID_DATA');
          }
          const parsed = read(value);
          return parsed === null ? failure('INVALID_DATA') : { ok: true, value: parsed };
        })(),
      ]);
    } catch {
      return failure(timedOut ? 'READ_TIMEOUT' : 'READ_FAILED');
    } finally {
      clearTimeout(timer);
      if (abortListener) controller.signal.removeEventListener('abort', abortListener);
      requests.delete(controller);
    }
  }

  const rates: RuntimeRatePort = {
    current() {
      if (!currentRate || disposed) return null;
      const age = now() - Date.parse(currentRate.fetchedAt);
      return age >= -30_000 && age <= 600_000 ? currentRate : null;
    },
    async refresh() {
      const result = await request('/v1/rate', (value) => {
        const rate = readRate(value);
        const age = rate ? now() - Date.parse(rate.fetchedAt) : NaN;
        return age >= -30_000 && age <= 600_000 ? rate : null;
      });
      if (result.ok && !disposed) currentRate = result.value;
      return result;
    },
    quote(amountXof) {
      if (!integer(amountXof, 1, maxXof)) return Promise.resolve(failure('INVALID_INPUT'));
      return request(
        '/v1/quotes',
        (value) => {
          const quote = readQuote(value);
          return quote?.amountXof === amountXof ? quote : null;
        },
        { body: { amountXof }, statuses: [201] },
      );
    },
  };
  const bridge: WithdrawBridgePort = {
    options: () => request('/v1/withdrawal-options', readOptions, { authenticated: true }),
    balance: () => request('/v1/withdrawal-balance', readBalance, { authenticated: true }),
    quote(input) {
      const body = object(input, ['operator', 'recipientId', 'amountXof']);
      if (!body || !validRecipient(body) || !integer(body.amountXof, 1, maxXof))
        return Promise.resolve(failure('INVALID_INPUT'));
      const { operator, recipientId, amountXof } = body;
      return request(
        '/v1/withdrawal-quotes',
        (value) => {
          const quote = readWithdrawQuote(value);
          return quote &&
            quote.operator === operator &&
            quote.recipientId === recipientId &&
            quote.amountXof === amountXof
            ? quote
            : null;
        },
        { body: { operator, recipientId, amountXof }, authenticated: true, statuses: [201] },
      );
    },
    confirm(input) {
      const body = object(input, ['quoteId', 'key']);
      if (!body || !uuid(body.quoteId) || !uuid(body.key))
        return Promise.resolve(failure('INVALID_INPUT'));
      const quoteId = body.quoteId.toLowerCase();
      return request(
        '/v1/withdrawals',
        (value) => {
          const withdrawal = readWithdrawal(value);
          return withdrawal?.quoteId === quoteId ? withdrawal : null;
        },
        { body: { quoteId }, key: body.key, authenticated: true, statuses: [200, 201, 202] },
      );
    },
    get: (id) => operation(id),
    reconcile: (id) => operation(id, 'reconcile'),
    retry: (id) => operation(id, 'retry'),
  };
  function operation(id: string, action?: 'reconcile' | 'retry') {
    if (!uuid(id)) return Promise.resolve(failure('INVALID_INPUT'));
    const normalized = id.toLowerCase();
    return request(
      `/v1/withdrawals/${normalized}${action ? `/${action}` : ''}`,
      (value) => {
        const withdrawal = readWithdrawal(value);
        return withdrawal?.id === normalized ? withdrawal : null;
      },
      {
        authenticated: true,
        ...(action ? { body: {} } : {}),
        statuses: action === 'retry' ? [200, 202] : [200],
      },
    );
  }
  const withdrawals: HistoryWithdrawalPort = {
    history(options = {}) {
      const input = object(options, [], ['limit', 'before']);
      if (
        !input ||
        (input.limit !== undefined && !integer(input.limit, 1, 100)) ||
        (input.before !== undefined && !uuid(input.before))
      )
        return Promise.resolve(failure('INVALID_INPUT'));
      const limit = (input.limit as number | undefined) ?? 20;
      const before = input.before as string | undefined;
      const query = `?limit=${limit}${before ? `&before=${before.toLowerCase()}` : ''}`;
      return request(
        `/v1/withdrawals${query}`,
        (value) => {
          const page = object(value, ['simulation', 'items', 'nextCursor']);
          if (
            !page ||
            page.simulation !== true ||
            !Array.isArray(page.items) ||
            page.items.length > limit ||
            !(page.nextCursor === null || uuid(page.nextCursor))
          )
            return null;
          const items = page.items.map(readWithdrawal);
          if (
            items.some((item) => !item || item.id === before?.toLowerCase()) ||
            new Set(items.map((item) => item!.id)).size !== items.length
          )
            return null;
          const nextCursor =
            typeof page.nextCursor === 'string' ? page.nextCursor.toLowerCase() : null;
          if (nextCursor !== null && (items.length !== limit || items.at(-1)?.id !== nextCursor))
            return null;
          return { simulation: true as const, items: items as HistoryWithdrawal[], nextCursor };
        },
        { authenticated: true },
      );
    },
  };
  return Object.freeze({
    rates,
    bridge,
    withdrawals,
    risk: createRiskPort(async (path, body) => {
      const result = await request(path, (value) => value, { body });
      if (!result.ok) throw new Error('RISK_UNAVAILABLE');
      return result.value;
    }),
    cancelPending,
    dispose() {
      disposed = true;
      currentRate = null;
      cancelPending();
    },
  });
}
