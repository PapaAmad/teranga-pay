import { isHomeIsoDate } from '../home/format';
import { readWithDeadline, readFailure, startPendingWatch } from '../reliability/read';
import type {
  WithdrawBalance,
  WithdrawBridgePort,
  WithdrawError,
  WithdrawIntent,
  WithdrawOperation,
  WithdrawOperator,
  WithdrawOptions,
  WithdrawQuote,
  WithdrawServices,
} from './ports';

export type WithdrawPhase =
  | 'idle'
  | 'loading'
  | 'operator'
  | 'amount'
  | 'quoting'
  | 'review'
  | 'submitting'
  | 'success'
  | 'pending'
  | 'failed'
  | 'unknown'
  | 'error'
  | 'unavailable'
  | 'suspended';
export type WithdrawSnapshot = Readonly<{
  mode: WithdrawServices['mode'];
  phase: WithdrawPhase;
  options: WithdrawOptions | null;
  balance: WithdrawBalance | null;
  operator: WithdrawOperator | null;
  amountInput: string;
  amountError: WithdrawError | null;
  quote: WithdrawQuote | null;
  operation: WithdrawOperation | null;
  error: WithdrawError | null;
  busy: boolean;
  committed: boolean;
  remainingSeconds: number;
  canConfirm: boolean;
  canRefresh: boolean;
  canRetry: boolean;
  canNewRequest: boolean;
}>;
export interface WithdrawController {
  getSnapshot(): WithdrawSnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  selectOperator(operator: WithdrawOperator): void;
  setAmount(input: string): void;
  prepare(): Promise<void>;
  confirm(expectedQuoteId?: string): Promise<void>;
  edit(): void;
  refresh(): Promise<void>;
  retry(expectedWithdrawalId?: string): Promise<void>;
  newRequest(): Promise<void>;
  tick(): void;
  suspend(): void;
  resume(): Promise<void>;
  dispose(): void;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const iso = (value: unknown): value is string => isHomeIsoDate(value);
const code = (value: string): WithdrawError => Object.freeze({ code: value });
const operator = (value: unknown): value is WithdrawOperator =>
  value === 'wave' || value === 'orange_money';
const recipient = (value: WithdrawOperator) =>
  value === 'wave' ? 'wave-demo-001' : 'orange-demo-001';
function error(value: unknown, fallback = 'INVALID_DATA'): WithdrawError {
  if (
    !record(value) ||
    value.ok !== false ||
    !record(value.error) ||
    typeof value.error.code !== 'string' ||
    !/^[A-Z][A-Z0-9_]{0,63}$/.test(value.error.code)
  )
    return code(fallback);
  return Object.freeze({
    code: value.error.code,
    ...(uuid(value.error.withdrawalId)
      ? { withdrawalId: value.error.withdrawalId.toLowerCase() }
      : {}),
  });
}
const succeeded = (value: unknown): value is { ok: true; value: unknown } =>
  record(value) && value.ok === true;
const voidSuccess = (value: unknown) => succeeded(value) && value.value === undefined;
export function parseWithdrawAmount(input: unknown, maximum = 5_000_000): number | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!/^(?:[0-9]{1,7}|[0-9]{1,3}(?:[ \u00a0\u202f][0-9]{3}){1,2})$/.test(value)) return null;
  const amount = Number(value.replace(/[ \u00a0\u202f]/g, ''));
  return integer(amount, 1) && amount <= Math.min(maximum, 5_000_000) ? amount : null;
}
function readOptions(result: unknown): WithdrawOptions | null {
  if (!succeeded(result) || !record(result.value)) return null;
  const value = result.value;
  if (
    value.simulation !== true ||
    value.currency !== 'XOF' ||
    value.feeXof !== 100 ||
    !integer(value.maxAmountXof, 1) ||
    value.maxAmountXof > 5_000_000 ||
    !Array.isArray(value.operators) ||
    value.operators.length !== 2
  )
    return null;
  const entries = value.operators;
  if (
    !entries.every(
      (entry) =>
        record(entry) &&
        operator(entry.operator) &&
        entry.recipientId === recipient(entry.operator),
    ) ||
    new Set(entries.map((entry) => entry.operator)).size !== 2
  )
    return null;
  return Object.freeze({
    simulation: true,
    currency: 'XOF',
    feeXof: 100,
    maxAmountXof: value.maxAmountXof,
    operators: Object.freeze(
      entries.map((entry) =>
        Object.freeze({
          operator: entry.operator as WithdrawOperator,
          recipientId: recipient(entry.operator),
        }),
      ),
    ),
  });
}
function readBalance(result: unknown): WithdrawBalance | null {
  if (!succeeded(result) || !record(result.value)) return null;
  const value = result.value;
  if (
    value.simulation !== true ||
    !integer(value.availableSats) ||
    !integer(value.heldSats) ||
    !Number.isSafeInteger(value.availableSats + value.heldSats)
  )
    return null;
  return Object.freeze({
    simulation: true,
    availableSats: value.availableSats,
    heldSats: value.heldSats,
  });
}
function readQuote(value: unknown): WithdrawQuote | null {
  if (
    !record(value) ||
    !uuid(value.id) ||
    value.simulation !== true ||
    !operator(value.operator) ||
    value.recipientId !== recipient(value.operator) ||
    !integer(value.amountXof, 1) ||
    value.amountXof > 5_000_000 ||
    value.feeXof !== 100 ||
    value.totalXof !== value.amountXof + 100 ||
    !integer(value.amountSats, 1) ||
    !integer(value.feeSats) ||
    !integer(value.totalSats, 1) ||
    !integer(value.xofPerBtc, 1) ||
    !['fixe', 'kraken'].includes(value.source as string) ||
    !iso(value.createdAt) ||
    !iso(value.expiresAt)
  )
    return null;
  const duration = Date.parse(value.expiresAt) - Date.parse(value.createdAt);
  if (duration <= 0 || duration > 300_000) return null;
  const rate = BigInt(value.xofPerBtc);
  const convert = (xof: number) => (BigInt(xof) * 100_000_000n + rate - 1n) / rate;
  if (
    BigInt(value.amountSats) !== convert(value.amountXof) ||
    BigInt(value.totalSats) !== convert(value.totalXof as number) ||
    BigInt(value.amountSats) + BigInt(value.feeSats) !== BigInt(value.totalSats)
  )
    return null;
  return Object.freeze({
    id: value.id.toLowerCase(),
    simulation: true,
    operator: value.operator,
    recipientId: recipient(value.operator),
    amountXof: value.amountXof,
    feeXof: 100,
    totalXof: value.totalXof as number,
    amountSats: value.amountSats,
    feeSats: value.feeSats,
    totalSats: value.totalSats,
    xofPerBtc: value.xofPerBtc,
    source: value.source as WithdrawQuote['source'],
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  });
}
function readIntent(result: unknown): WithdrawIntent | null | undefined {
  if (!succeeded(result)) return undefined;
  if (result.value === null) return null;
  const value = result.value;
  if (
    !record(value) ||
    value.version !== 1 ||
    !uuid(value.key) ||
    (value.withdrawalId !== undefined && !uuid(value.withdrawalId))
  )
    return undefined;
  const quote = readQuote(value.quote);
  return quote
    ? Object.freeze({
        version: 1,
        key: value.key.toLowerCase(),
        quote,
        ...(value.withdrawalId === undefined
          ? {}
          : { withdrawalId: (value.withdrawalId as string).toLowerCase() }),
      })
    : undefined;
}
function readOperation(result: unknown, intent: WithdrawIntent): WithdrawOperation | null {
  if (!succeeded(result) || !record(result.value)) return null;
  const value = result.value;
  const quote = intent.quote;
  if (
    !uuid(value.id) ||
    !uuid(value.quoteId) ||
    value.quoteId.toLowerCase() !== quote.id ||
    (intent.withdrawalId !== undefined && value.id.toLowerCase() !== intent.withdrawalId) ||
    !iso(value.createdAt) ||
    !iso(value.updatedAt) ||
    !['en_attente', 'incertain', 'reussi', 'echoue'].includes(value.status as string) ||
    !(
      value.failure === null ||
      (typeof value.failure === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value.failure))
    ) ||
    (['en_attente', 'reussi'].includes(value.status as string) && value.failure !== null) ||
    Date.parse(value.createdAt) >= Date.parse(quote.expiresAt) ||
    Date.parse(value.createdAt) < Date.parse(quote.createdAt) - 30_000 ||
    Date.parse(value.updatedAt) < Date.parse(value.createdAt)
  )
    return null;
  for (const field of [
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
  ] as const)
    if (value[field] !== quote[field]) return null;
  if (value.quoteCreatedAt !== quote.createdAt || value.quoteExpiresAt !== quote.expiresAt)
    return null;
  return Object.freeze({
    simulation: true,
    operator: quote.operator,
    recipientId: quote.recipientId,
    amountXof: quote.amountXof,
    feeXof: quote.feeXof,
    totalXof: quote.totalXof,
    amountSats: quote.amountSats,
    feeSats: quote.feeSats,
    totalSats: quote.totalSats,
    xofPerBtc: quote.xofPerBtc,
    source: quote.source,
    id: value.id.toLowerCase(),
    quoteId: quote.id,
    quoteCreatedAt: quote.createdAt,
    quoteExpiresAt: quote.expiresAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    status: value.status as WithdrawOperation['status'],
    failure: value.failure as string | null,
  });
}

type Attempt = {
  intent: WithdrawIntent;
  operation: WithdrawOperation | null;
  phase: 'submitting' | 'success' | 'pending' | 'failed' | 'unknown';
  error: WithdrawError | null;
  safeRejected: boolean;
  saved: boolean;
};
type Session = {
  current: Attempt | null;
  busy: boolean;
  observers: Set<() => void>;
  loading: Promise<WithdrawError | null> | null;
};
const sessions = new WeakMap<WithdrawBridgePort, Session>();
function sessionFor(bridge?: WithdrawBridgePort): Session {
  if (bridge) {
    const previous = sessions.get(bridge);
    if (previous) return previous;
  }
  const session: Session = { current: null, busy: false, observers: new Set(), loading: null };
  if (bridge) sessions.set(bridge, session);
  return session;
}
const terminal = (attempt: Attempt) => attempt.phase === 'success' || attempt.phase === 'failed';
const safeRejections = new Set([
  'QUOTE_EXPIRED',
  'QUOTE_NOT_FOUND',
  'INSUFFICIENT_FUNDS',
  'INVALID_INPUT',
  'VALIDATION_ERROR',
]);

/** Retrait exclusivement fictif. L’intention durable précède toute confirmation. */
export function createWithdrawController(
  services: WithdrawServices,
  { now = Date.now }: { now?: () => number } = {},
): WithdrawController {
  let snapshot: WithdrawSnapshot = Object.freeze({
    mode: services.mode,
    phase: 'idle',
    options: null,
    balance: null,
    operator: null,
    amountInput: '',
    amountError: null,
    quote: null,
    operation: null,
    error: null,
    busy: false,
    committed: false,
    remainingSeconds: 0,
    canConfirm: false,
    canRefresh: false,
    canRetry: false,
    canNewRequest: false,
  });
  let disposed = false,
    suspended = false,
    started = false,
    revision = 0;
  let initialization: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const session = sessionFor(services.bridge);
  const active = () => !disposed && !suspended;
  const current = (token: number) => active() && revision === token;
  const seconds = (quote: WithdrawQuote | null) =>
    quote ? Math.max(0, Math.ceil((Date.parse(quote.expiresAt) - now()) / 1000)) : 0;
  function update(patch: Partial<WithdrawSnapshot>) {
    if (disposed) return;
    const next = { ...snapshot, ...patch };
    next.canConfirm =
      next.phase === 'review' &&
      !next.busy &&
      !session.current &&
      !!next.quote &&
      Date.parse(next.quote.expiresAt) > now() &&
      active();
    snapshot = Object.freeze(next);
    listeners.forEach((listener) => listener());
  }
  function clear(phase: WithdrawPhase) {
    revision++;
    initialization = null;
    update({
      phase,
      options: null,
      balance: null,
      operator: null,
      amountInput: '',
      amountError: null,
      quote: null,
      operation: null,
      error: null,
      busy: false,
      committed: session.current !== null,
      remainingSeconds: 0,
      canConfirm: false,
      canRefresh: false,
      canRetry: false,
      canNewRequest: false,
    });
  }
  function showOperation() {
    if (!active() || !started) return;
    const attempt = session.current;
    if (!attempt) {
      if (snapshot.committed) {
        clear('loading');
        void initialize();
      }
      return;
    }
    update({
      phase: attempt.phase,
      operator: attempt.intent.quote.operator,
      amountInput: String(attempt.intent.quote.amountXof),
      amountError: null,
      quote: attempt.intent.quote,
      operation: attempt.operation,
      error: attempt.error,
      busy: session.busy,
      committed: true,
      remainingSeconds: seconds(attempt.intent.quote),
      canRefresh: !session.busy && (!terminal(attempt) || !attempt.saved),
      canRetry: !session.busy && !terminal(attempt) && !!attempt.intent.withdrawalId,
      canNewRequest: !session.busy && terminal(attempt),
    });
  }
  const notify = () => session.observers.forEach((observer) => observer());
  session.observers.add(showOperation);
  async function loadJournal(): Promise<WithdrawError | null> {
    if (session.current) return null;
    if (session.loading) return session.loading;
    const promise = (async () => {
      try {
        const result: unknown = await readWithDeadline(() => services.journal!.load());
        const intent = readIntent(result);
        if (intent === undefined) return error(result, 'JOURNAL_READ_FAILED');
        if (intent && !session.current)
          session.current = {
            intent,
            operation: null,
            phase: 'unknown',
            error: null,
            safeRejected: false,
            saved: true,
          };
        return null;
      } catch (cause) {
        return code(readFailure(cause) === 'READ_TIMEOUT' ? 'READ_TIMEOUT' : 'JOURNAL_READ_FAILED');
      }
    })();
    session.loading = promise;
    try {
      return await promise;
    } finally {
      if (session.loading === promise) session.loading = null;
    }
  }
  function initialize(): Promise<void> {
    if (!active()) return Promise.resolve();
    if (initialization) return initialization;
    if (
      services.mode === 'unavailable' ||
      !services.bridge ||
      !services.journal ||
      !services.createKey
    ) {
      clear('unavailable');
      return Promise.resolve();
    }
    const token = ++revision;
    update({ phase: 'loading', busy: true, error: null });
    const promise = (async () => {
      const failure = await loadJournal();
      if (!current(token)) return;
      if (failure) {
        update({ phase: 'error', busy: false, error: failure });
        return;
      }
      if (session.current) {
        showOperation();
        if (session.current.intent.withdrawalId && !session.busy && !terminal(session.current))
          await operate('get');
        return;
      }
      try {
        const [rawOptions, rawBalance] = await Promise.all([
          readWithDeadline(() => services.bridge!.options()),
          readWithDeadline(() => services.bridge!.balance()),
        ]);
        if (!current(token)) return;
        if (session.current) {
          showOperation();
          return;
        }
        const options = readOptions(rawOptions),
          balance = readBalance(rawBalance);
        if (!options || !balance) {
          update({ phase: 'error', busy: false, error: error(!options ? rawOptions : rawBalance) });
          return;
        }
        update({
          phase: 'operator',
          options,
          balance,
          operator: null,
          amountInput: '',
          amountError: null,
          quote: null,
          operation: null,
          error: null,
          busy: false,
          committed: false,
          remainingSeconds: 0,
          canRefresh: false,
          canRetry: false,
          canNewRequest: false,
        });
      } catch (cause) {
        if (current(token))
          update({ phase: 'error', busy: false, error: code(readFailure(cause)) });
      }
    })().finally(() => {
      if (initialization === promise) initialization = null;
    });
    initialization = promise;
    return promise;
  }
  function editable() {
    return (
      active() &&
      !session.current &&
      !session.busy &&
      !snapshot.busy &&
      ['operator', 'amount', 'review'].includes(snapshot.phase) &&
      !!snapshot.options
    );
  }
  async function saveId(attempt: Attempt, operation: WithdrawOperation) {
    attempt.intent = Object.freeze({ ...attempt.intent, withdrawalId: operation.id });
    const previousError = attempt.error;
    const stopWaiting = watchAttempt(attempt, undefined, true);
    try {
      const saved: unknown = await services.journal!.save(attempt.intent);
      if (!voidSuccess(saved)) attempt.error = code('JOURNAL_WRITE_FAILED');
      else if (attempt.error?.code === 'JOURNAL_SLOW') attempt.error = previousError;
    } catch {
      attempt.error = code('JOURNAL_WRITE_FAILED');
    } finally {
      stopWaiting();
    }
  }
  async function apply(attempt: Attempt, raw: unknown, mayRejectBeforeReservation = false) {
    if (session.current !== attempt) return;
    const operation = readOperation(raw, attempt.intent);
    if (operation) {
      if (
        attempt.operation &&
        ['reussi', 'echoue'].includes(attempt.operation.status) &&
        attempt.operation.status !== operation.status
      ) {
        attempt.error = code('INVALID_DATA');
        return;
      }
      attempt.operation = operation;
      attempt.phase =
        operation.status === 'reussi'
          ? 'success'
          : operation.status === 'echoue'
            ? 'failed'
            : operation.status === 'en_attente'
              ? 'pending'
              : 'unknown';
      attempt.error =
        operation.status === 'echoue' ? code(operation.failure ?? 'PROVIDER_DECLINED') : null;
      attempt.safeRejected = false;
      await saveId(attempt, operation);
      return;
    }
    const failure = error(raw);
    if (
      failure.withdrawalId &&
      ['QUOTE_ALREADY_USED', 'IDEMPOTENCY_CONFLICT'].includes(failure.code)
    ) {
      try {
        const retrieved: unknown = await readWithDeadline(() =>
          services.bridge!.get(failure.withdrawalId!),
        );
        const known = readOperation(retrieved, attempt.intent);
        if (known) {
          await apply(attempt, retrieved);
          return;
        }
      } catch {
        /* Le conflit reste incertain ; aucune nouvelle intention. */
      }
    }
    if (mayRejectBeforeReservation && !attempt.operation && safeRejections.has(failure.code)) {
      attempt.phase = 'failed';
      attempt.safeRejected = true;
    } else if (!terminal(attempt)) attempt.phase = 'unknown';
    attempt.error = failure;
  }
  async function operate(kind: 'get' | 'refresh' | 'retry') {
    const attempt = session.current;
    if (!active() || !attempt || session.busy || terminal(attempt)) return;
    if (kind === 'retry' && !attempt.intent.withdrawalId) return;
    session.busy = true;
    const id = attempt.intent.withdrawalId;
    const stopWaiting = kind === 'retry' || !id ? watchAttempt(attempt) : () => {};
    notify();
    try {
      const raw: unknown = id
        ? await (kind === 'retry'
            ? services.bridge!.retry(id)
            : kind === 'get'
              ? readWithDeadline(() => services.bridge!.get(id))
              : readWithDeadline(() => services.bridge!.reconcile(id)))
        : await services.bridge!.confirm({
            quoteId: attempt.intent.quote.id,
            key: attempt.intent.key,
          });
      stopWaiting();
      await apply(attempt, raw, !id);
    } catch (cause) {
      if (!terminal(attempt)) attempt.phase = 'unknown';
      attempt.error = code(readFailure(cause));
    } finally {
      stopWaiting();
      session.busy = false;
      notify();
    }
  }
  function watchAttempt(attempt: Attempt, onSlow?: () => void, journalOnly = false) {
    return startPendingWatch(() => {
      if (session.current !== attempt || !session.busy) return;
      onSlow?.();
      if (!journalOnly && !terminal(attempt)) attempt.phase = 'unknown';
      attempt.error = code(journalOnly || terminal(attempt) ? 'JOURNAL_SLOW' : 'OPERATION_SLOW');
      // La mutation n'est pas annulée : conserver la barrière jusqu'à son résultat.
      notify();
    });
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (started) return initialization ?? Promise.resolve();
      started = true;
      return initialize();
    },
    selectOperator(value) {
      if (
        !editable() ||
        !operator(value) ||
        !snapshot.options!.operators.some((entry) => entry.operator === value)
      )
        return;
      revision++;
      update({ phase: 'amount', operator: value, quote: null, error: null, remainingSeconds: 0 });
    },
    setAmount(input) {
      if (
        !active() ||
        session.current ||
        session.busy ||
        !['amount', 'review', 'quoting'].includes(snapshot.phase) ||
        typeof input !== 'string'
      )
        return;
      revision++;
      const amountError =
        input.length && parseWithdrawAmount(input, snapshot.options?.maxAmountXof) === null
          ? code('AMOUNT_INVALID')
          : null;
      update({
        phase: 'amount',
        amountInput: input.slice(0, 64),
        amountError,
        quote: null,
        remainingSeconds: 0,
        error: null,
        busy: false,
      });
    },
    async prepare() {
      if (!editable() || !snapshot.operator || !services.bridge) return;
      const amountXof = parseWithdrawAmount(snapshot.amountInput, snapshot.options!.maxAmountXof);
      if (amountXof === null) {
        update({ phase: 'amount', amountError: code('AMOUNT_INVALID') });
        return;
      }
      const selected = snapshot.operator,
        token = ++revision;
      update({ phase: 'quoting', quote: null, error: null, amountError: null, busy: true });
      try {
        const [raw, rawBalance] = await Promise.all([
          readWithDeadline(() =>
            services.bridge!.quote({
              operator: selected,
              recipientId: recipient(selected),
              amountXof,
            }),
          ),
          readWithDeadline(() => services.bridge!.balance()),
        ]);
        if (!current(token)) return;
        if (session.current) {
          showOperation();
          return;
        }
        const quote = succeeded(raw) ? readQuote(raw.value) : null,
          balance = readBalance(rawBalance);
        if (!balance) {
          update({ phase: 'amount', busy: false, error: error(rawBalance) });
          return;
        }
        if (
          !quote ||
          quote.operator !== selected ||
          quote.amountXof !== amountXof ||
          Date.parse(quote.createdAt) > now() + 30_000
        ) {
          update({ phase: 'amount', busy: false, balance, error: error(raw) });
          return;
        }
        if (Date.parse(quote.expiresAt) <= now()) {
          update({ phase: 'amount', busy: false, balance, error: code('QUOTE_EXPIRED') });
          return;
        }
        if (quote.totalSats > balance.availableSats) {
          update({ phase: 'amount', busy: false, balance, error: code('INSUFFICIENT_FUNDS') });
          return;
        }
        update({
          phase: 'review',
          balance,
          quote,
          busy: false,
          error: null,
          remainingSeconds: seconds(quote),
        });
      } catch (cause) {
        if (current(token))
          update({ phase: 'amount', busy: false, error: code(readFailure(cause)) });
      }
    },
    async confirm(expectedQuoteId) {
      if (
        !editable() ||
        snapshot.phase !== 'review' ||
        !snapshot.quote ||
        (expectedQuoteId !== undefined && snapshot.quote.id !== expectedQuoteId.toLowerCase())
      )
        return;
      const quote = snapshot.quote;
      if (Date.parse(quote.expiresAt) <= now()) {
        update({ error: code('QUOTE_EXPIRED'), remainingSeconds: 0 });
        return;
      }
      let key: unknown;
      try {
        key = services.createKey!();
      } catch {
        update({ error: code('KEY_UNAVAILABLE') });
        return;
      }
      if (!uuid(key)) {
        update({ error: code('KEY_UNAVAILABLE') });
        return;
      }
      const attempt: Attempt = {
        intent: Object.freeze({ version: 1, key: key.toLowerCase(), quote }),
        operation: null,
        phase: 'submitting',
        error: null,
        safeRejected: false,
        saved: false,
      };
      session.current = attempt;
      session.busy = true;
      revision++;
      let slow = false;
      const stopWaiting = watchAttempt(attempt, () => {
        slow = true;
      });
      notify();
      try {
        const saved: unknown = await services.journal!.save(attempt.intent);
        if (!voidSuccess(saved)) {
          attempt.phase = 'failed';
          attempt.error = code('JOURNAL_WRITE_FAILED');
          attempt.safeRejected = true;
          return;
        }
        attempt.saved = true;
        if (slow) {
          attempt.phase = 'unknown';
          attempt.error = code('OPERATION_SLOW');
          return;
        }
        // L’écriture peut avoir pris du temps ; un prix expiré n’est jamais soumis pour la première fois.
        if (Date.parse(quote.expiresAt) <= now()) {
          attempt.phase = 'failed';
          attempt.error = code('QUOTE_EXPIRED');
          attempt.safeRejected = true;
          return;
        }
        const raw: unknown = await services.bridge!.confirm({
          quoteId: quote.id,
          key: attempt.intent.key,
        });
        stopWaiting();
        await apply(attempt, raw, true);
      } catch {
        attempt.phase = attempt.saved ? 'unknown' : 'failed';
        attempt.safeRejected = !attempt.saved;
        attempt.error = code(attempt.saved ? 'READ_FAILED' : 'JOURNAL_WRITE_FAILED');
      } finally {
        stopWaiting();
        session.busy = false;
        notify();
      }
    },
    edit() {
      if (!editable()) return;
      revision++;
      update({
        phase: snapshot.operator ? 'amount' : 'operator',
        quote: null,
        error: null,
        remainingSeconds: 0,
      });
    },
    async refresh() {
      if (!active()) return Promise.resolve();
      const attempt = session.current;
      if (!attempt) return initialize();
      if (attempt.safeRejected) {
        if (attempt.saved || session.busy) return;
        session.busy = true;
        notify();
        try {
          const loaded: unknown = await readWithDeadline(() => services.journal!.load());
          const intent = readIntent(loaded);
          if (intent === undefined) attempt.error = code('JOURNAL_READ_FAILED');
          else if (intent)
            session.current = {
              intent,
              operation: null,
              phase: 'unknown',
              error: null,
              safeRejected: false,
              saved: true,
            };
        } catch (cause) {
          attempt.error = code(
            readFailure(cause) === 'READ_TIMEOUT' ? 'READ_TIMEOUT' : 'JOURNAL_READ_FAILED',
          );
        } finally {
          session.busy = false;
          notify();
        }
        return;
      }
      return operate('refresh');
    },
    retry(expectedWithdrawalId) {
      if (
        expectedWithdrawalId !== undefined &&
        session.current?.intent.withdrawalId !== expectedWithdrawalId.toLowerCase()
      )
        return Promise.resolve();
      return operate('retry');
    },
    async newRequest() {
      const attempt = session.current;
      if (!active() || !attempt || session.busy || !terminal(attempt)) return;
      session.busy = true;
      const stopWaiting = watchAttempt(attempt);
      notify();
      try {
        // Une écriture non acquittée peut cacher l’intention d’un autre écran.
        // Même une collision de clé ne permet pas de l’effacer par supposition.
        if (!attempt.saved) {
          const loaded: unknown = await readWithDeadline(() => services.journal!.load());
          const existing = readIntent(loaded);
          if (existing === undefined) {
            attempt.error = code('JOURNAL_READ_FAILED');
            return;
          }
          if (existing) {
            session.current = {
              intent: existing,
              operation: null,
              phase: 'unknown',
              error: null,
              safeRejected: false,
              saved: true,
            };
            return;
          }
        }
        const cleared: unknown = await services.journal!.clear(attempt.intent.key);
        if (!voidSuccess(cleared)) {
          attempt.error = code('JOURNAL_CLEAR_FAILED');
          return;
        }
        if (session.current === attempt) session.current = null;
      } catch (cause) {
        attempt.error = code(
          readFailure(cause) === 'READ_TIMEOUT' ? 'READ_TIMEOUT' : 'JOURNAL_CLEAR_FAILED',
        );
      } finally {
        stopWaiting();
        session.busy = false;
        notify();
      }
      if (!session.current && active()) await initialize();
    },
    tick() {
      if (!active() || !snapshot.quote) return;
      const remainingSeconds = seconds(snapshot.quote);
      update({
        remainingSeconds,
        ...(snapshot.phase === 'review' && remainingSeconds === 0
          ? { error: code('QUOTE_EXPIRED') }
          : {}),
      });
    },
    suspend() {
      if (disposed || suspended) return;
      suspended = true;
      clear('suspended');
    },
    resume() {
      if (disposed) return Promise.resolve();
      if (!suspended && started) return initialization ?? Promise.resolve();
      suspended = false;
      started = true;
      return initialize();
    },
    dispose() {
      if (disposed) return;
      clear('suspended');
      disposed = true;
      session.observers.delete(showOperation);
      listeners.clear();
    },
  };
}
