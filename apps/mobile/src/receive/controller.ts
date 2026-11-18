import type { HomeError, HomeWalletEvent, HomeWalletState } from '../home/ports';
import { readFailure, readWithDeadline } from '../reliability/read';
import type { ReceiveServices } from './ports';

export type ReceiveSnapshot = Readonly<{
  mode: ReceiveServices['mode'];
  status:
    | 'idle'
    | 'loading'
    | 'ready'
    | 'unavailable'
    | 'offline'
    | 'synchronising'
    | 'locked'
    | 'absent'
    | 'error'
    | 'suspended';
  walletState: HomeWalletState | null;
  requiresUnlock: boolean;
  address: string | null;
  refreshing: boolean;
  /** Adresse obtenue précédemment ou relue alors que le wallet n'est pas prêt. */
  stale: boolean;
  error: HomeError | null;
}>;

export interface ReceiveController {
  getSnapshot(): ReceiveSnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  refresh(): Promise<void>;
  suspend(): void;
  resume(): Promise<void>;
  dispose(): void;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const states = new Set<HomeWalletState>([
  'absent',
  'verrouille',
  'synchronisation',
  'pret',
  'hors_ligne',
]);

function isState(value: unknown): value is HomeWalletState {
  return typeof value === 'string' && states.has(value as HomeWalletState);
}

/** Adresse ASCII LUD-16 bornée ; aucune URL, donnée secrète ou chaîne de contrôle. */
export function isReceiveAddress(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 254) return false;
  if (/[^a-z0-9._+@-]/i.test(value)) return false;
  const match = /^([a-z0-9._+-]{1,64})@([a-z0-9.-]+)$/i.exec(value);
  if (!match) return false;
  const domain = match[2];
  if (!domain || domain.length > 253) return false;
  const labels = domain.split('.');
  return (
    labels.length >= 2 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) &&
    /^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(labels[labels.length - 1] ?? '')
  );
}

const failure = (code: string): HomeError => Object.freeze({ code });

function readResult(
  value: unknown,
): { ok: true; address: string } | { ok: false; error: HomeError } {
  if (record(value) && value.ok === true && record(value.value)) {
    if (isReceiveAddress(value.value.address)) {
      return { ok: true, address: value.value.address };
    }
  }
  if (
    record(value) &&
    value.ok === false &&
    record(value.error) &&
    typeof value.error.code === 'string' &&
    /^[A-Z][A-Z0-9_]{0,63}$/.test(value.error.code)
  ) {
    return { ok: false, error: failure(value.error.code) };
  }
  return { ok: false, error: failure('INVALID_DATA') };
}

/** Lecture publique uniquement : T18 ne réserve pas d'adresse et ne crée aucune facture. */
export function createReceiveController(services: ReceiveServices): ReceiveController {
  let snapshot: ReceiveSnapshot = Object.freeze({
    mode: services.mode,
    status: 'idle',
    walletState: null,
    requiresUnlock: false,
    address: null,
    refreshing: false,
    stale: false,
    error: null,
  });
  let started = false;
  let suspended = false;
  let disposed = false;
  let revision = 0;
  let releaseWallet: (() => void) | null = null;
  const listeners = new Set<() => void>();
  type Run = { cancelled: boolean; pending: boolean; promise: Promise<void> };
  let run: Run | null = null;

  const active = () => !disposed && !suspended;
  const current = (task: Run, token: number) =>
    active() && !task.cancelled && run === task && revision === token;

  function update(patch: Partial<ReceiveSnapshot>) {
    snapshot = Object.freeze({ ...snapshot, ...patch });
    listeners.forEach((listener) => listener());
  }

  function cancelRun() {
    revision += 1;
    if (run) run.cancelled = true;
    run = null;
  }

  function clear(status: ReceiveSnapshot['status'], state: HomeWalletState | null = null) {
    update({
      status,
      walletState: state,
      requiresUnlock: state === 'verrouille',
      address: null,
      refreshing: false,
      stale: false,
      error: null,
    });
  }

  function closed(state: 'absent' | 'verrouille') {
    cancelRun();
    clear(state === 'absent' ? 'absent' : 'locked', state);
  }

  function unsubscribeWallet() {
    const release = releaseWallet;
    releaseWallet = null;
    try {
      release?.();
    } catch {
      // Une erreur de désabonnement ne réactive pas les lectures invalidées.
    }
  }

  function onEvent(event: HomeWalletEvent) {
    const incoming: unknown = event;
    if (!active() || !record(incoming) || incoming.type !== 'etat' || !isState(incoming.state)) {
      return;
    }
    if (incoming.state === 'absent' || incoming.state === 'verrouille') {
      closed(incoming.state);
      return;
    }
    update({ walletState: incoming.state, stale: snapshot.address !== null });
    if (run && !run.pending) {
      revision += 1;
      run.pending = true;
    }
    void requestRefresh();
  }

  function ensureSubscription(): boolean {
    if (releaseWallet) return true;
    try {
      const release = services.wallet?.subscribe(onEvent);
      if (typeof release !== 'function') throw new Error('SUBSCRIPTION_FAILED');
      releaseWallet = release;
      return true;
    } catch {
      update({
        status: 'error',
        address: null,
        refreshing: false,
        stale: false,
        error: failure('SUBSCRIPTION_FAILED'),
      });
      return false;
    }
  }

  async function readCycle(task: Run) {
    if (services.mode === 'unavailable' || !services.wallet || !services.address) {
      clear('unavailable');
      return;
    }
    const token = revision;
    if (!ensureSubscription() || !current(task, token)) return;
    update({
      status: snapshot.address === null ? 'loading' : snapshot.status,
      refreshing: true,
      stale: snapshot.address !== null,
      error: null,
    });
    let state: unknown;
    try {
      state = await readWithDeadline(() => services.wallet!.state());
    } catch (error) {
      if (current(task, token)) {
        clear('error');
        update({ error: failure(readFailure(error)) });
      }
      return;
    }
    if (!current(task, token)) return;
    if (!isState(state)) {
      clear('error');
      update({ error: failure('INVALID_DATA') });
      return;
    }
    if (state === 'absent' || state === 'verrouille') {
      closed(state);
      return;
    }
    update({ walletState: state, requiresUnlock: false });
    let result: ReturnType<typeof readResult>;
    try {
      result = readResult(await readWithDeadline(() => services.address!.current()));
    } catch (error) {
      result = { ok: false, error: failure(readFailure(error)) };
    }
    if (!current(task, token)) return;
    if (!result.ok) {
      if (result.error.code === 'WALLET_LOCKED' || result.error.code === 'WALLET_ABSENT') {
        closed(result.error.code === 'WALLET_LOCKED' ? 'verrouille' : 'absent');
        return;
      }
      update({
        status:
          state === 'hors_ligne' || result.error.code === 'NETWORK_OFFLINE' ? 'offline' : 'error',
        refreshing: false,
        stale: snapshot.address !== null,
        error: result.error,
      });
      return;
    }
    update({
      status:
        state === 'hors_ligne'
          ? 'offline'
          : state === 'synchronisation'
            ? 'synchronising'
            : 'ready',
      address: result.address,
      refreshing: false,
      stale: state !== 'pret',
      error: null,
    });
  }

  function requestRefresh(): Promise<void> {
    if (!active()) return Promise.resolve();
    if (run) return run.promise;
    const task: Run = { cancelled: false, pending: true, promise: Promise.resolve() };
    run = task;
    task.promise = Promise.resolve()
      .then(async () => {
        while (active() && !task.cancelled && task.pending) {
          task.pending = false;
          await readCycle(task);
        }
      })
      .finally(() => {
        if (run !== task) return;
        run = null;
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
      unsubscribeWallet();
      clear('suspended');
    },
    resume() {
      if (disposed) return Promise.resolve();
      started = true;
      suspended = false;
      return requestRefresh();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelRun();
      unsubscribeWallet();
      clear('suspended');
      listeners.clear();
    },
  };
}
