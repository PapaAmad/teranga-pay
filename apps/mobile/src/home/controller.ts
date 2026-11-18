import { isHomeIsoDate } from './format';
import { readFailure, readWithDeadline } from '../reliability/read';
import type {
  HomeBalance,
  HomeError,
  HomeMode,
  HomePayment,
  HomeResult,
  HomeServices,
  HomeWalletEvent,
  HomeWalletState,
} from './ports';

export type HomeResource<T> = Readonly<{
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: T | null;
  error: HomeError | null;
  /** Ancienne lecture conservée, ou lecture locale d'un wallet hors ligne/en synchronisation. */
  stale: boolean;
}>;

export type HomeSnapshot = Readonly<{
  mode: HomeMode;
  status:
    'idle' | 'loading' | 'ready' | 'unavailable' | 'locked' | 'absent' | 'error' | 'suspended';
  walletState: HomeWalletState | null;
  requiresUnlock: boolean;
  refreshing: boolean;
  balance: HomeResource<HomeBalance>;
  history: HomeResource<readonly HomePayment[]>;
  error: HomeError | null;
}>;

export interface HomeController {
  getSnapshot(): HomeSnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  refresh(): Promise<void>;
  suspend(): void;
  resume(): Promise<void>;
  dispose(): void;
}

const states = new Set<HomeWalletState>([
  'absent',
  'verrouille',
  'synchronisation',
  'pret',
  'hors_ligne',
]);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const nullableInteger = (value: unknown) => value === null || integer(value);
const nullableString = (value: unknown) => value === null || typeof value === 'string';
const isState = (value: unknown): value is HomeWalletState =>
  typeof value === 'string' && states.has(value as HomeWalletState);
const errorCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value);
const failure = (code: string): HomeError => Object.freeze({ code });

function readError(value: unknown): HomeError {
  if (!record(value) || !errorCode(value.code)) return failure('INVALID_DATA');
  if (value.attemptsLeft !== undefined && !integer(value.attemptsLeft))
    return failure('INVALID_DATA');
  if (value.retryAfterSeconds !== undefined && !integer(value.retryAfterSeconds)) {
    return failure('INVALID_DATA');
  }
  return Object.freeze({
    code: value.code,
    ...(value.attemptsLeft === undefined ? {} : { attemptsLeft: value.attemptsLeft as number }),
    ...(value.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: value.retryAfterSeconds as number }),
  });
}

function readBalance(value: unknown): HomeBalance | null {
  if (
    !record(value) ||
    !integer(value.spendableSats) ||
    !integer(value.pendingSats) ||
    !nullableInteger(value.spendableXof) ||
    !isHomeIsoDate(value.updatedAt)
  ) {
    return null;
  }
  let rate: HomeBalance['rate'] = null;
  if (value.rate !== null) {
    if (
      !record(value.rate) ||
      !integer(value.rate.xofPerBtc) ||
      value.rate.xofPerBtc === 0 ||
      (value.rate.source !== 'fixe' && value.rate.source !== 'kraken') ||
      !isHomeIsoDate(value.rate.fetchedAt)
    ) {
      return null;
    }
    rate = Object.freeze({
      xofPerBtc: value.rate.xofPerBtc,
      source: value.rate.source,
      fetchedAt: value.rate.fetchedAt,
    });
  } else if (value.spendableXof !== null) {
    // Sans taux, une valeur FCFA ne peut pas être présentée comme une conversion connue.
    return null;
  }
  return Object.freeze({
    spendableSats: value.spendableSats,
    pendingSats: value.pendingSats,
    spendableXof: value.spendableXof as number | null,
    rate,
    updatedAt: value.updatedAt,
  });
}

export function readPayment(value: unknown): HomePayment | null {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    value.id.trim().length === 0 ||
    (value.direction !== 'recu' && value.direction !== 'envoye') ||
    typeof value.status !== 'string' ||
    !['en_attente', 'reussi', 'echoue'].includes(value.status) ||
    !integer(value.amountSats) ||
    !integer(value.feeSats) ||
    !nullableInteger(value.amountXof) ||
    !nullableString(value.memo) ||
    !isHomeIsoDate(value.createdAt) ||
    !(value.failure === null || errorCode(value.failure))
  ) {
    return null;
  }
  return Object.freeze({
    id: value.id,
    direction: value.direction,
    status: value.status as HomePayment['status'],
    amountSats: value.amountSats,
    feeSats: value.feeSats,
    amountXof: value.amountXof as number | null,
    memo: value.memo as string | null,
    createdAt: value.createdAt,
    failure: value.failure as string | null,
  });
}

function readHistory(value: unknown): readonly HomePayment[] | null {
  if (!Array.isArray(value)) return null;
  const payments = value.map(readPayment);
  if (payments.some((payment) => payment === null)) return null;
  const valid = payments as HomePayment[];
  if (new Set(valid.map((payment) => payment.id)).size !== valid.length) return null;
  return Object.freeze(
    valid
      .sort((a, b) => {
        const time = Date.parse(b.createdAt) - Date.parse(a.createdAt);
        return time || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
      })
      .slice(0, 3),
  );
}

function readResult<T>(value: unknown, parse: (value: unknown) => T | null): HomeResult<T> {
  if (!record(value)) return { ok: false, error: failure('INVALID_DATA') };
  if (value.ok === false) return { ok: false, error: readError(value.error) };
  if (value.ok !== true) return { ok: false, error: failure('INVALID_DATA') };
  const parsed = parse(value.value);
  return parsed === null
    ? { ok: false, error: failure('INVALID_DATA') }
    : { ok: true, value: parsed };
}

function resource<T>(): HomeResource<T> {
  return Object.freeze({ status: 'idle', data: null, error: null, stale: false });
}

/** Lecture sans garde des clés et sans autorisation financière. Aucun cache sur disque. */
export function createHomeController(services: HomeServices): HomeController {
  let snapshot: HomeSnapshot = Object.freeze({
    mode: services.mode,
    status: 'idle',
    walletState: null,
    requiresUnlock: false,
    refreshing: false,
    balance: resource<HomeBalance>(),
    history: resource<readonly HomePayment[]>(),
    error: null,
  });
  let revision = 0;
  let disposed = false;
  let suspended = false;
  let started = false;
  let unsubscribeWallet: (() => void) | null = null;
  const listeners = new Set<() => void>();
  type Run = { cancelled: boolean; pending: boolean; promise: Promise<void> };
  let run: Run | null = null;

  const active = () => !disposed && !suspended;
  const current = (token: number, task: Run) =>
    active() && !task.cancelled && run === task && token === revision;

  function update(patch: Partial<HomeSnapshot>) {
    snapshot = Object.freeze({ ...snapshot, ...patch });
    listeners.forEach((listener) => listener());
  }

  function cancelRun() {
    revision += 1;
    if (run) run.cancelled = true;
    run = null;
  }

  function clear(status: HomeSnapshot['status'], state: HomeWalletState | null = null) {
    update({
      status,
      walletState: state,
      requiresUnlock: state === 'verrouille',
      refreshing: false,
      balance: resource<HomeBalance>(),
      history: resource<readonly HomePayment[]>(),
      error: null,
    });
  }

  function closed(state: 'absent' | 'verrouille') {
    cancelRun();
    clear(state === 'absent' ? 'absent' : 'locked', state);
  }

  function unsubscribe() {
    const release = unsubscribeWallet;
    unsubscribeWallet = null;
    try {
      release?.();
    } catch {
      // Le rappel peut être défectueux ; les gardes empêchent quand même tout retour tardif.
    }
  }

  function onEvent(event: HomeWalletEvent) {
    if (!active()) return;
    const incoming: unknown = event;
    if (!record(incoming)) return;
    if (incoming.type === 'etat') {
      if (!isState(incoming.state)) return;
      if (incoming.state === 'absent' || incoming.state === 'verrouille') {
        closed(incoming.state);
        return;
      }
    } else if (incoming.type === 'solde') {
      if (!readBalance(incoming.balance)) return;
    } else if (incoming.type === 'paiement') {
      if (!readPayment(incoming.payment)) return;
    } else {
      return;
    }
    update({
      ...(incoming.type === 'etat' ? { walletState: incoming.state as HomeWalletState } : {}),
      balance: Object.freeze({
        ...snapshot.balance,
        stale:
          snapshot.balance.data !== null &&
          (snapshot.balance.stale || (incoming.type === 'etat' && incoming.state !== 'pret')),
      }),
      history: Object.freeze({
        ...snapshot.history,
        stale:
          snapshot.history.data !== null &&
          (snapshot.history.stale || (incoming.type === 'etat' && incoming.state !== 'pret')),
      }),
    });
    // Un événement invalide la lecture en cours. Une rafale ne crée qu'une lecture supplémentaire.
    if (run && !run.pending) {
      revision += 1;
      run.pending = true;
    }
    void requestRefresh();
  }

  function ensureSubscription(): boolean {
    if (unsubscribeWallet) return true;
    try {
      const release = services.wallet?.subscribe(onEvent);
      if (typeof release !== 'function') throw new Error('INVALID_DATA');
      unsubscribeWallet = release;
      return true;
    } catch {
      update({ status: 'error', refreshing: false, error: failure('SUBSCRIPTION_FAILED') });
      return false;
    }
  }

  function applyResult<K extends 'balance' | 'history'>(
    key: K,
    result: HomeResult<K extends 'balance' ? HomeBalance : readonly HomePayment[]>,
  ) {
    if (
      !result.ok &&
      (result.error.code === 'WALLET_LOCKED' || result.error.code === 'WALLET_ABSENT')
    ) {
      closed(result.error.code === 'WALLET_LOCKED' ? 'verrouille' : 'absent');
      return;
    }
    const old = snapshot[key];
    const next = result.ok
      ? {
          status: 'ready' as const,
          data: result.value,
          error: null,
          stale: snapshot.walletState !== 'pret',
        }
      : { status: 'error' as const, data: old.data, error: result.error, stale: old.data !== null };
    update({ [key]: Object.freeze(next) });
  }

  async function readCycle(task: Run) {
    const wallet = services.wallet;
    if (!wallet || services.mode === 'unavailable') {
      clear('unavailable');
      return;
    }
    const token = revision;
    if (!ensureSubscription() || !current(token, task)) return;
    update({
      status:
        snapshot.balance.data !== null || snapshot.history.data !== null ? 'ready' : 'loading',
      refreshing: true,
      error: null,
      balance: Object.freeze({
        ...snapshot.balance,
        status: 'loading',
        stale: snapshot.balance.data !== null && snapshot.balance.stale,
      }),
      history: Object.freeze({
        ...snapshot.history,
        status: 'loading',
        stale: snapshot.history.data !== null && snapshot.history.stale,
      }),
    });
    let state: unknown;
    try {
      state = await readWithDeadline(() => wallet.state());
    } catch (error) {
      if (current(token, task)) failState(readFailure(error));
      return;
    }
    if (!current(token, task)) return;
    if (!isState(state)) {
      failState('INVALID_DATA');
      return;
    }
    if (state === 'absent' || state === 'verrouille') {
      closed(state);
      return;
    }
    update({
      walletState: state,
      requiresUnlock: false,
      balance: Object.freeze({
        ...snapshot.balance,
        stale: snapshot.balance.data !== null && (snapshot.balance.stale || state !== 'pret'),
      }),
      history: Object.freeze({
        ...snapshot.history,
        stale: snapshot.history.data !== null && (snapshot.history.stale || state !== 'pret'),
      }),
    });
    // Les deux ressources se mettent à jour indépendamment : l'une ne masque pas l'autre.
    const loadBalance = async () => {
      if (!current(token, task)) return;
      let result: HomeResult<HomeBalance>;
      try {
        result = readResult(await readWithDeadline(() => wallet.balance()), readBalance);
      } catch (error) {
        result = { ok: false, error: failure(readFailure(error)) };
      }
      if (current(token, task)) applyResult('balance', result);
    };
    const loadHistory = async () => {
      if (!current(token, task)) return;
      let result: HomeResult<readonly HomePayment[]>;
      try {
        result = readResult(
          await readWithDeadline(() => wallet.history({ limit: 3 })),
          readHistory,
        );
      } catch (error) {
        result = { ok: false, error: failure(readFailure(error)) };
      }
      if (current(token, task)) applyResult('history', result);
    };
    await Promise.all([loadBalance(), loadHistory()]);
    if (!current(token, task)) return;
    update({
      status: snapshot.balance.data !== null || snapshot.history.data !== null ? 'ready' : 'error',
      refreshing: false,
    });
  }

  function failState(code: string) {
    const error = failure(code);
    update({
      status: 'error',
      refreshing: false,
      walletState: null,
      error,
      balance: Object.freeze({
        ...snapshot.balance,
        status: 'error',
        error,
        stale: snapshot.balance.data !== null,
      }),
      history: Object.freeze({
        ...snapshot.history,
        status: 'error',
        error,
        stale: snapshot.history.data !== null,
      }),
    });
  }

  function requestRefresh(): Promise<void> {
    if (!active()) return Promise.resolve();
    if (run) return run.promise;
    const task: Run = { cancelled: false, pending: true, promise: Promise.resolve() };
    run = task;
    task.promise = Promise.resolve()
      .then(async () => {
        while (task.pending && !task.cancelled && active()) {
          task.pending = false;
          await readCycle(task);
        }
      })
      .finally(() => {
        if (run !== task) return;
        run = null;
        // Une notification peut arriver entre la fin de la boucle et cette microtâche.
        if (task.pending && !task.cancelled && active()) void requestRefresh();
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
    suspend() {
      if (disposed || suspended) return;
      suspended = true;
      cancelRun();
      unsubscribe();
      clear('suspended');
    },
    resume() {
      if (disposed) return Promise.resolve();
      suspended = false;
      started = true;
      return requestRefresh();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelRun();
      unsubscribe();
      clear('suspended');
      listeners.clear();
    },
  };
}
