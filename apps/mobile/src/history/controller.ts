import { isHomeIsoDate } from '../home/format';
import type { HomeError, HomePayment, HomeWalletEvent, HomeWalletState } from '../home/ports';
import { readFailure, readWithDeadline } from '../reliability/read';
import type { HistoryEntry, HistoryServices, HistoryWithdrawal } from './ports';
import {
  historyDayKey,
  summarizeHistory,
  type HistoryCoverage,
  type HistoryDailySummary,
} from './summary';

export type HistorySource = 'wallet' | 'bridge_sim';
export type HistoryResource<T> = Readonly<{
  status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
  items: readonly Readonly<T>[];
  stale: boolean;
  error: HomeError | null;
  hasMore: boolean;
  loadingMore: boolean;
  complete: boolean;
  lastReadAt: string | null;
}>;
export type HistorySnapshot = Readonly<{
  mode: HistoryServices['mode'];
  status:
    'idle' | 'loading' | 'ready' | 'unavailable' | 'locked' | 'absent' | 'error' | 'suspended';
  walletState: HomeWalletState | null;
  refreshing: boolean;
  error: HomeError | null;
  payments: HistoryResource<HomePayment>;
  withdrawals: HistoryResource<HistoryWithdrawal>;
  entries: readonly HistoryEntry[];
  daily: HistoryDailySummary;
}>;
export interface HistoryController {
  getSnapshot(): HistorySnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  refresh(): Promise<void>;
  loadMore(source: HistorySource): Promise<void>;
  tick(): void;
  suspend(): void;
  resume(): Promise<void>;
  dispose(): void;
}
const PAGE_SIZE = 20;
const MAX_ITEMS = 1000;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const errorCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value);
const code = (value: string): HomeError => Object.freeze({ code: value });
const isState = (value: unknown): value is HomeWalletState =>
  typeof value === 'string' &&
  ['pret', 'absent', 'verrouille', 'hors_ligne', 'synchronisation'].includes(value);
function memo(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string' || value.length > 512) return false;
  for (const char of value) {
    const point = char.codePointAt(0)!;
    if (
      point < 32 ||
      (point >= 127 && point <= 159) ||
      (point >= 0x202a && point <= 0x202e) ||
      (point >= 0x2066 && point <= 0x2069) ||
      (point >= 0xd800 && point <= 0xdfff)
    )
      return false;
  }
  return true;
}
function payment(value: unknown): Readonly<HomePayment> | null {
  if (
    !record(value) ||
    !identifier(value.id) ||
    !['recu', 'envoye'].includes(value.direction as string) ||
    !['en_attente', 'reussi', 'echoue'].includes(value.status as string) ||
    !integer(value.amountSats) ||
    !integer(value.feeSats) ||
    !(value.amountXof === null || integer(value.amountXof)) ||
    !memo(value.memo) ||
    !isHomeIsoDate(value.createdAt) ||
    !(value.failure === null || errorCode(value.failure)) ||
    (value.direction === 'recu' && value.feeSats !== 0) ||
    (value.status !== 'echoue' && value.failure !== null)
  )
    return null;
  return Object.freeze({
    id: value.id,
    direction: value.direction,
    status: value.status,
    amountSats: value.amountSats,
    feeSats: value.feeSats,
    amountXof: value.amountXof,
    memo: value.memo,
    createdAt: value.createdAt,
    failure: value.failure,
  }) as Readonly<HomePayment>;
}
function withdrawal(value: unknown): Readonly<HistoryWithdrawal> | null {
  if (
    !record(value) ||
    value.simulation !== true ||
    !identifier(value.id) ||
    !identifier(value.quoteId) ||
    !['wave', 'orange_money'].includes(value.operator as string) ||
    value.recipientId !== (value.operator === 'wave' ? 'wave-demo-001' : 'orange-demo-001') ||
    !integer(value.amountXof, 1) ||
    value.amountXof > 5_000_000 ||
    value.feeXof !== 100 ||
    value.totalXof !== value.amountXof + 100 ||
    !integer(value.amountSats, 1) ||
    !integer(value.feeSats) ||
    !integer(value.totalSats, 1) ||
    !integer(value.xofPerBtc, 1) ||
    !['fixe', 'kraken'].includes(value.source as string) ||
    !isHomeIsoDate(value.quoteCreatedAt) ||
    !isHomeIsoDate(value.quoteExpiresAt) ||
    !isHomeIsoDate(value.createdAt) ||
    !isHomeIsoDate(value.updatedAt) ||
    !['en_attente', 'incertain', 'reussi', 'echoue'].includes(value.status as string) ||
    !(value.failure === null || errorCode(value.failure)) ||
    (['en_attente', 'reussi'].includes(value.status as string) && value.failure !== null)
  )
    return null;
  const duration = Date.parse(value.quoteExpiresAt) - Date.parse(value.quoteCreatedAt);
  if (
    duration <= 0 ||
    duration > 300_000 ||
    Date.parse(value.createdAt) >= Date.parse(value.quoteExpiresAt)
  )
    return null;
  const convert = (xof: number) =>
    (BigInt(xof) * 100_000_000n + BigInt(value.xofPerBtc as number) - 1n) /
    BigInt(value.xofPerBtc as number);
  if (
    BigInt(value.amountSats) !== convert(value.amountXof) ||
    BigInt(value.totalSats) !== convert(value.totalXof as number) ||
    BigInt(value.amountSats) + BigInt(value.feeSats) !== BigInt(value.totalSats)
  )
    return null;
  return Object.freeze({
    id: value.id,
    quoteId: value.quoteId,
    simulation: true,
    operator: value.operator,
    recipientId: value.recipientId,
    amountXof: value.amountXof,
    feeXof: value.feeXof,
    totalXof: value.totalXof,
    amountSats: value.amountSats,
    feeSats: value.feeSats,
    totalSats: value.totalSats,
    xofPerBtc: value.xofPerBtc,
    source: value.source,
    quoteCreatedAt: value.quoteCreatedAt,
    quoteExpiresAt: value.quoteExpiresAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    status: value.status,
    failure: value.failure,
  }) as Readonly<HistoryWithdrawal>;
}
type Page<T> = { items: readonly Readonly<T>[]; next: string | null };
function parsePage<T>(
  raw: unknown,
  parse: (item: unknown) => Readonly<T> | null,
): readonly Readonly<T>[] | null {
  if (!Array.isArray(raw) || raw.length > PAGE_SIZE) return null;
  const items = raw.map(parse);
  if (items.some((item) => item === null)) return null;
  const valid = items as (Readonly<T> & { id: string })[];
  if (new Set(valid.map((item) => item.id)).size !== valid.length) return null;
  return Object.freeze(valid);
}
function walletPage(raw: unknown): Page<HomePayment> | null {
  const items = parsePage(raw, payment);
  return items ? { items, next: items.length === PAGE_SIZE ? items.at(-1)!.id : null } : null;
}
function bridgePage(raw: unknown): Page<HistoryWithdrawal> | null {
  if (
    !record(raw) ||
    raw.simulation !== true ||
    !(
      raw.nextCursor === null ||
      (typeof raw.nextCursor === 'string' && /^[A-Za-z0-9._~:-]{1,512}$/.test(raw.nextCursor))
    )
  )
    return null;
  const items = parsePage(raw.items, withdrawal);
  if (!items || (items.length === 0 && raw.nextCursor !== null)) return null;
  return { items, next: raw.nextCursor as string | null };
}
function resource<T>(available: boolean): HistoryResource<T> {
  return Object.freeze({
    status: available ? 'idle' : 'unavailable',
    items: Object.freeze([]),
    stale: false,
    error: null,
    hasMore: false,
    loadingMore: false,
    complete: false,
    lastReadAt: null,
  });
}
const coverage = (value: HistoryResource<unknown>): HistoryCoverage =>
  value.status === 'unavailable' ? 'unavailable' : value.complete ? 'complete' : 'partial';

/** Historique de lecture en mémoire ; aucune clé, aucun paiement ni cache disque. */
export function createHistoryController(
  services: HistoryServices,
  { now = Date.now }: { now?: () => number } = {},
): HistoryController {
  let disposed = false,
    suspended = false,
    started = false,
    generation = 0;
  let release: (() => void) | null = null;
  let status: HistorySnapshot['status'] = 'idle';
  let walletState: HomeWalletState | null = null;
  let refreshing = false;
  let error: HomeError | null = null;
  let payments = resource<HomePayment>(services.mode !== 'unavailable' && !!services.wallet);
  let withdrawals = resource<HistoryWithdrawal>(
    services.mode !== 'unavailable' && !!services.withdrawals && !!services.wallet,
  );
  let lastDay = historyDayKey(now());
  const listeners = new Set<() => void>();
  const cursors: Record<HistorySource, string | null> = { wallet: null, bridge_sim: null };
  const seen = { wallet: new Set<string>(), bridge_sim: new Set<string>() };
  const paging: Partial<Record<HistorySource, Promise<void>>> = {};
  type Run = { cancelled: boolean; pending: boolean; promise: Promise<void> };
  let run: Run | null = null;
  let snapshot: HistorySnapshot;
  const active = () => !disposed && !suspended;
  const current = (token: number) => active() && generation === token;
  const date = () => new Date(now()).toISOString();
  function publish() {
    const entries: HistoryEntry[] = [
      ...payments.items.map((item) =>
        Object.freeze({ source: 'wallet' as const, key: `wallet:${item.id}`, payment: item }),
      ),
      ...withdrawals.items.map((item) =>
        Object.freeze({
          source: 'bridge_sim' as const,
          key: `bridge_sim:${item.id}`,
          withdrawal: item,
        }),
      ),
    ];
    const created = (item: HistoryEntry) =>
      item.source === 'wallet' ? item.payment.createdAt : item.withdrawal.createdAt;
    entries.sort(
      (a, b) =>
        Date.parse(created(b)) - Date.parse(created(a)) ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    );
    snapshot = Object.freeze({
      mode: services.mode,
      status,
      walletState,
      refreshing,
      error,
      payments,
      withdrawals,
      entries: Object.freeze(entries),
      daily: summarizeHistory({
        payments: payments.items,
        withdrawals: withdrawals.items,
        now: now(),
        walletCoverage: coverage(payments),
        withdrawalCoverage: coverage(withdrawals),
        walletStale: payments.stale,
        withdrawalsStale: withdrawals.stale,
      }),
    });
    listeners.forEach((listener) => listener());
  }
  publish();
  function cancel() {
    generation += 1;
    if (run) run.cancelled = true;
    run = null;
    delete paging.wallet;
    delete paging.bridge_sim;
  }
  function clear(
    next: HistorySnapshot['status'],
    state: HomeWalletState | null,
    failure: HomeError | null = null,
  ) {
    cancel();
    status = next;
    walletState = state;
    refreshing = false;
    error = failure;
    payments = resource<HomePayment>(next !== 'unavailable' && !!services.wallet);
    withdrawals = resource<HistoryWithdrawal>(
      next !== 'unavailable' && !!services.withdrawals && !!services.wallet,
    );
    if (failure) {
      if (payments.status !== 'unavailable')
        payments = Object.freeze({ ...payments, status: 'error', error: failure });
      if (withdrawals.status !== 'unavailable')
        withdrawals = Object.freeze({ ...withdrawals, status: 'error', error: failure });
    }
    cursors.wallet = null;
    cursors.bridge_sim = null;
    seen.wallet.clear();
    seen.bridge_sim.clear();
    publish();
  }
  function detach() {
    try {
      release?.();
    } catch {
      /* Les gardes empêchent les retours tardifs. */
    }
    release = null;
  }
  function closed(state: 'absent' | 'verrouille') {
    clear(state === 'absent' ? 'absent' : 'locked', state);
  }
  function onEvent(incoming: HomeWalletEvent) {
    const value: unknown = incoming;
    if (!active() || !record(value)) return;
    if (value.type === 'etat' && isState(value.state)) {
      if (value.state === 'absent' || value.state === 'verrouille') {
        closed(value.state);
        return;
      }
    } else if (value.type === 'paiement') {
      if (!payment(value.payment) || walletState === 'absent' || walletState === 'verrouille')
        return;
    } else return;
    generation += 1;
    if (payments.lastReadAt !== null)
      payments = Object.freeze({ ...payments, stale: true, complete: false });
    if (withdrawals.lastReadAt !== null)
      withdrawals = Object.freeze({ ...withdrawals, stale: true, complete: false });
    if (run) run.pending = true;
    publish();
    void requestRefresh();
  }
  function ensureSubscription(): boolean {
    if (release) return true;
    try {
      const unsub = services.wallet!.subscribe(onEvent);
      if (typeof unsub !== 'function') throw new Error('SUBSCRIPTION_FAILED');
      release = unsub;
      return true;
    } catch {
      clear('error', null, code('SUBSCRIPTION_FAILED'));
      return false;
    }
  }
  function fail(source: HistorySource, failure: HomeError) {
    if (failure.code === 'WALLET_LOCKED' || failure.code === 'WALLET_ABSENT') {
      closed(failure.code === 'WALLET_LOCKED' ? 'verrouille' : 'absent');
      return;
    }
    if (source === 'wallet')
      payments = Object.freeze({
        ...payments,
        status: 'error',
        stale: payments.lastReadAt !== null,
        complete: false,
        loadingMore: false,
        error: failure,
      });
    else
      withdrawals = Object.freeze({
        ...withdrawals,
        status: 'error',
        stale: withdrawals.lastReadAt !== null,
        complete: false,
        loadingMore: false,
        error: failure,
      });
    publish();
  }
  async function load(source: HistorySource, append: boolean, token: number) {
    const before = append ? cursors[source] : null;
    try {
      const result: unknown =
        source === 'wallet'
          ? await readWithDeadline(() =>
              services.wallet!.history({ limit: PAGE_SIZE, ...(before ? { before } : {}) }),
            )
          : await readWithDeadline(() =>
              services.withdrawals!.history({
                limit: PAGE_SIZE,
                ...(before ? { before } : {}),
              }),
            );
      if (!current(token)) return;
      if (!record(result) || result.ok !== true) {
        fail(
          source,
          record(result) &&
            result.ok === false &&
            record(result.error) &&
            errorCode(result.error.code)
            ? code(result.error.code)
            : code('INVALID_DATA'),
        );
        return;
      }
      const page = source === 'wallet' ? walletPage(result.value) : bridgePage(result.value);
      if (!page) {
        fail(source, code('INVALID_DATA'));
        return;
      }
      const old = source === 'wallet' ? payments : withdrawals;
      const existing = new Set(append ? old.items.map((item) => item.id) : []);
      if (
        (append && page.items.some((item) => existing.has(item.id))) ||
        (page.next !== null && (page.next === before || (append && seen[source].has(page.next))))
      ) {
        fail(source, code('INVALID_PAGINATION'));
        return;
      }
      const items = Object.freeze(append ? [...old.items, ...page.items] : [...page.items]);
      if (items.length > MAX_ITEMS) {
        fail(source, code('HISTORY_LIMIT'));
        return;
      }
      if (!append) seen[source].clear();
      cursors[source] = page.next;
      if (page.next !== null) seen[source].add(page.next);
      const limited = items.length === MAX_ITEMS && page.next !== null;
      const next = Object.freeze({
        status: limited ? ('error' as const) : ('ready' as const),
        items,
        stale: walletState !== 'pret',
        error: limited ? code('HISTORY_LIMIT') : null,
        hasMore: !limited && page.next !== null,
        loadingMore: false,
        complete: !limited && page.next === null,
        lastReadAt: date(),
      });
      if (source === 'wallet') payments = next as HistoryResource<HomePayment>;
      else withdrawals = next as HistoryResource<HistoryWithdrawal>;
      status = 'ready';
      publish();
    } catch (failure) {
      if (current(token)) fail(source, code(readFailure(failure)));
    }
  }
  async function cycle(task: Run) {
    if (!active()) return;
    if (services.mode === 'unavailable' || !services.wallet) {
      clear('unavailable', null);
      return;
    }
    const token = generation;
    if (!ensureSubscription() || !current(token) || task.cancelled) return;
    status = payments.lastReadAt !== null || withdrawals.lastReadAt !== null ? 'ready' : 'loading';
    refreshing = true;
    error = null;
    payments = Object.freeze({
      ...payments,
      status: 'loading',
      complete: false,
      hasMore: false,
      stale: payments.lastReadAt !== null,
      error: null,
      loadingMore: false,
    });
    if (services.withdrawals)
      withdrawals = Object.freeze({
        ...withdrawals,
        status: 'loading',
        complete: false,
        hasMore: false,
        stale: withdrawals.lastReadAt !== null,
        error: null,
        loadingMore: false,
      });
    publish();
    let state: unknown;
    try {
      state = await readWithDeadline(() => services.wallet!.state());
    } catch (failure) {
      if (current(token)) clear('error', null, code(readFailure(failure)));
      return;
    }
    if (!current(token) || task.cancelled) return;
    if (!isState(state)) {
      clear('error', null, code('INVALID_DATA'));
      return;
    }
    if (state === 'absent' || state === 'verrouille') {
      closed(state);
      return;
    }
    walletState = state;
    publish();
    const tasks: Promise<void>[] = [load('wallet', false, token)];
    if (services.withdrawals) {
      if (state === 'pret') tasks.push(load('bridge_sim', false, token));
      else {
        withdrawals = Object.freeze({
          ...withdrawals,
          status: 'error',
          stale: withdrawals.lastReadAt !== null,
          error: code('NETWORK_OFFLINE'),
          complete: false,
          loadingMore: false,
        });
        publish();
      }
    }
    await Promise.all(tasks);
    if (!current(token) || task.cancelled) return;
    refreshing = false;
    status =
      payments.status === 'ready' ||
      withdrawals.status === 'ready' ||
      payments.lastReadAt !== null ||
      withdrawals.lastReadAt !== null
        ? 'ready'
        : 'error';
    publish();
  }
  function requestRefresh(): Promise<void> {
    if (!active()) return Promise.resolve();
    if (run) return run.promise;
    generation += 1;
    delete paging.wallet;
    delete paging.bridge_sim;
    const task: Run = { cancelled: false, pending: true, promise: Promise.resolve() };
    run = task;
    task.promise = Promise.resolve()
      .then(async () => {
        while (task.pending && !task.cancelled && active()) {
          task.pending = false;
          await cycle(task);
        }
      })
      .finally(() => {
        if (run === task) {
          run = null;
          if (task.pending && !task.cancelled && active()) void requestRefresh();
        }
      });
    return task.promise;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (started) return run?.promise ?? Promise.resolve();
      started = true;
      return requestRefresh();
    },
    refresh: requestRefresh,
    loadMore(source) {
      if (!active() || refreshing || !walletState || ['absent', 'verrouille'].includes(walletState))
        return Promise.resolve();
      if (paging[source]) return paging[source]!;
      const old = source === 'wallet' ? payments : withdrawals;
      const retryPage =
        old.status === 'error' &&
        ['READ_FAILED', 'READ_TIMEOUT'].includes(old.error?.code ?? '') &&
        cursors[source] !== null;
      if (
        (old.status !== 'ready' && !retryPage) ||
        !old.hasMore ||
        (source === 'bridge_sim' && (walletState !== 'pret' || !services.withdrawals))
      )
        return Promise.resolve();
      if (source === 'wallet') payments = Object.freeze({ ...payments, loadingMore: true });
      else withdrawals = Object.freeze({ ...withdrawals, loadingMore: true });
      publish();
      const token = generation;
      const promise = load(source, true, token).finally(() => {
        if (paging[source] === promise) delete paging[source];
      });
      paging[source] = promise;
      return promise;
    },
    tick() {
      if (!active()) return;
      const day = historyDayKey(now());
      if (day !== lastDay) {
        lastDay = day;
        if (payments.lastReadAt !== null && historyDayKey(payments.lastReadAt) !== day)
          payments = Object.freeze({ ...payments, stale: true });
        if (withdrawals.lastReadAt !== null && historyDayKey(withdrawals.lastReadAt) !== day)
          withdrawals = Object.freeze({ ...withdrawals, stale: true });
        publish();
      }
    },
    suspend() {
      if (disposed || suspended) return;
      suspended = true;
      detach();
      clear('suspended', null);
    },
    resume() {
      if (disposed) return Promise.resolve();
      suspended = false;
      started = true;
      return requestRefresh();
    },
    dispose() {
      if (disposed) return;
      detach();
      clear('suspended', null);
      disposed = true;
      listeners.clear();
    },
  };
}
