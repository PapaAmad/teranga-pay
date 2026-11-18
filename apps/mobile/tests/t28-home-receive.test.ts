import { createHomeController } from '../src/home/controller';
import type {
  HomeBalance,
  HomePayment,
  HomeResult,
  HomeWalletEvent,
  HomeWalletPort,
  HomeWalletState,
} from '../src/home/ports';
import { createReceiveController } from '../src/receive/controller';
import type { ReceiveAddressPort, ReceiveWalletPort } from '../src/receive/ports';

const iso = '2026-11-12T12:00:00.000Z';
const address = 'exemple@teranga.example';
const balance: HomeBalance = {
  spendableSats: 100_000,
  pendingSats: 0,
  spendableXof: 45_000,
  rate: { xofPerBtc: 45_000_000, source: 'fixe', fetchedAt: iso },
  updatedAt: iso,
};
const payment: HomePayment = {
  id: 'operation-fictive-t28',
  direction: 'recu',
  status: 'reussi',
  amountSats: 1000,
  feeSats: 0,
  amountXof: 450,
  memo: null,
  failure: null,
  createdAt: iso,
};
const ok = <T>(value: T): HomeResult<T> => ({ ok: true, value });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function drain() {
  for (let step = 0; step < 40; step += 1) await Promise.resolve();
}

const controllers: { dispose(): void }[] = [];
function home() {
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const wallet: jest.Mocked<HomeWalletPort> = {
    state: jest.fn(async () => 'pret'),
    balance: jest.fn(async () => ok({ ...balance })),
    history: jest.fn(async () => ok([{ ...payment }])),
    subscribe: jest.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const controller = createHomeController({ mode: 'native', wallet });
  controllers.push(controller);
  return {
    controller,
    wallet,
    emit(event: HomeWalletEvent) {
      listeners.forEach((listener) => listener(event));
    },
  };
}
function receive() {
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const wallet: jest.Mocked<ReceiveWalletPort> = {
    state: jest.fn(async () => 'pret'),
    subscribe: jest.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const provider: jest.Mocked<ReceiveAddressPort> = {
    current: jest.fn(async () => ok({ address })),
  };
  const controller = createReceiveController({ mode: 'native', wallet, address: provider });
  controllers.push(controller);
  return {
    controller,
    wallet,
    provider,
    emit(event: HomeWalletEvent) {
      listeners.forEach((listener) => listener(event));
    },
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.dispose());
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('T28 | accueil et reprise des lectures', () => {
  it('sort du chargement après dix secondes sans inventer une coupure et permet une reprise manuelle', async () => {
    const test = home();
    const waiting = deferred<HomeWalletState>();
    test.wallet.state.mockReturnValueOnce(waiting.promise);
    const start = test.controller.start();
    await drain();
    await jest.advanceTimersByTimeAsync(9999);
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'loading', refreshing: true });
    expect(test.wallet.balance).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await start;
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      walletState: null,
      refreshing: false,
      error: { code: 'READ_TIMEOUT' },
      balance: { data: null, error: { code: 'READ_TIMEOUT' }, stale: false },
      history: { data: null, error: { code: 'READ_TIMEOUT' }, stale: false },
    });
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'ready', walletState: 'pret' });
    waiting.resolve('verrouille');
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'ready', walletState: 'pret' });
  });

  it('garde l’historique utilisable quand le solde attend puis expire, sans afficher un faux zéro', async () => {
    const test = home();
    const waiting = deferred<HomeResult<HomeBalance>>();
    test.wallet.balance.mockReturnValueOnce(waiting.promise);
    const start = test.controller.start();
    await drain();
    expect(test.controller.getSnapshot().history.data).toEqual([payment]);
    await jest.advanceTimersByTimeAsync(10_000);
    await start;
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      refreshing: false,
      balance: { status: 'error', data: null, error: { code: 'READ_TIMEOUT' } },
      history: { status: 'ready', data: [payment] },
    });
    await test.controller.refresh();
    waiting.resolve(ok({ ...balance, spendableSats: 0, spendableXof: 0 }));
    await drain();
    expect(test.controller.getSnapshot().balance.data).toEqual(balance);
  });

  it('ne remplace pas un historique inconnu par une liste vide et ignore sa réponse après reprise', async () => {
    const test = home();
    const waiting = deferred<HomeResult<HomePayment[]>>();
    test.wallet.history.mockReturnValueOnce(waiting.promise);
    const start = test.controller.start();
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await start;
    expect(test.controller.getSnapshot()).toMatchObject({
      refreshing: false,
      balance: { status: 'ready', data: balance },
      history: { status: 'error', data: null, error: { code: 'READ_TIMEOUT' } },
    });
    test.wallet.history.mockResolvedValueOnce(ok([]));
    await test.controller.refresh();
    waiting.resolve(ok([payment]));
    await drain();
    expect(test.controller.getSnapshot().history).toMatchObject({ status: 'ready', data: [] });
  });

  it.each(['balance', 'history'] as const)(
    'conserve la dernière lecture %s et la marque ancienne après le délai',
    async (resource) => {
      const test = home();
      await test.controller.start();
      if (resource === 'balance') {
        test.wallet.balance.mockReturnValueOnce(new Promise(() => {}));
      } else {
        test.wallet.history.mockReturnValueOnce(new Promise(() => {}));
      }
      const refresh = test.controller.refresh();
      await drain();
      await jest.advanceTimersByTimeAsync(10_000);
      await refresh;
      expect(test.controller.getSnapshot()[resource]).toMatchObject({
        status: 'error',
        stale: true,
        data: resource === 'balance' ? balance : [payment],
        error: { code: 'READ_TIMEOUT' },
      });
      expect(test.controller.getSnapshot().walletState).toBe('pret');
      expect(test.controller.getSnapshot().refreshing).toBe(false);
    },
  );

  it('regroupe une rafale d’événements pendant une lecture expirée en une seule nouvelle lecture', async () => {
    const test = home();
    const waiting = deferred<HomeWalletState>();
    test.wallet.state.mockReturnValueOnce(waiting.promise);
    const start = test.controller.start();
    await drain();
    for (let event = 0; event < 5; event += 1) test.emit({ type: 'etat', state: 'pret' });
    await jest.advanceTimersByTimeAsync(10_000);
    await start;
    expect(test.wallet.state).toHaveBeenCalledTimes(2);
    expect(test.wallet.balance).toHaveBeenCalledTimes(1);
    expect(test.wallet.history).toHaveBeenCalledTimes(1);
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'ready', refreshing: false });
    waiting.reject(new Error('erreur tardive fictive'));
    await drain();
    expect(test.controller.getSnapshot().error).toBeNull();
  });

  it.each(['suspend', 'lock'] as const)(
    'ne réaffiche rien après %s pendant une lecture lente',
    async (interruption) => {
      const test = home();
      await test.controller.start();
      const waiting = deferred<HomeResult<HomeBalance>>();
      test.wallet.balance.mockReturnValueOnce(waiting.promise);
      const refresh = test.controller.refresh();
      await drain();
      if (interruption === 'suspend') test.controller.suspend();
      else test.emit({ type: 'etat', state: 'verrouille' });
      waiting.resolve(ok(balance));
      await jest.advanceTimersByTimeAsync(10_000);
      await refresh;
      expect(test.controller.getSnapshot()).toMatchObject({
        status: interruption === 'suspend' ? 'suspended' : 'locked',
        refreshing: false,
        balance: { data: null },
        history: { data: null },
      });
    },
  );
});

describe('T28 | recevoir sans lecture infinie', () => {
  it('borne la lecture d’état avant de demander une adresse et permet de réessayer', async () => {
    const test = receive();
    const waiting = deferred<HomeWalletState>();
    test.wallet.state.mockReturnValueOnce(waiting.promise);
    const start = test.controller.start();
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await start;
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      walletState: null,
      address: null,
      refreshing: false,
      error: { code: 'READ_TIMEOUT' },
    });
    expect(test.provider.current).not.toHaveBeenCalled();
    await test.controller.refresh();
    waiting.resolve('hors_ligne');
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'ready', address, stale: false });
  });

  it('borne une première adresse absente sans inventer d’adresse ou d’état hors ligne', async () => {
    const test = receive();
    const waiting = deferred<HomeResult<{ address: string }>>();
    test.provider.current.mockReturnValueOnce(waiting.promise);
    const start = test.controller.start();
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await start;
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      walletState: 'pret',
      address: null,
      refreshing: false,
      error: { code: 'READ_TIMEOUT' },
    });
    await test.controller.refresh();
    waiting.resolve(ok({ address: 'ancienne@teranga.example' }));
    await drain();
    expect(test.controller.getSnapshot().address).toBe(address);
  });

  it('garde une adresse précédemment lue comme ancienne si son actualisation ne répond plus', async () => {
    const test = receive();
    await test.controller.start();
    test.provider.current.mockReturnValueOnce(new Promise(() => {}));
    const refresh = test.controller.refresh();
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await refresh;
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      walletState: 'pret',
      address,
      refreshing: false,
      stale: true,
      error: { code: 'READ_TIMEOUT' },
    });
  });

  it('conserve la connaissance hors ligne, sans la déduire du délai seul', async () => {
    const test = receive();
    test.wallet.state.mockResolvedValue('hors_ligne');
    test.provider.current.mockReturnValueOnce(new Promise(() => {}));
    const start = test.controller.start();
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await start;
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'offline',
      walletState: 'hors_ligne',
      error: { code: 'READ_TIMEOUT' },
      address: null,
      refreshing: false,
    });
  });

  it.each(['suspend', 'lock', 'dispose'] as const)(
    'ignore une adresse et une expiration après %s',
    async (interruption) => {
      const test = receive();
      await test.controller.start();
      const waiting = deferred<HomeResult<{ address: string }>>();
      test.provider.current.mockReturnValueOnce(waiting.promise);
      const refresh = test.controller.refresh();
      await drain();
      if (interruption === 'lock') test.emit({ type: 'etat', state: 'verrouille' });
      else test.controller[interruption]();
      waiting.resolve(ok({ address: 'tardive@teranga.example' }));
      await jest.advanceTimersByTimeAsync(10_000);
      await refresh;
      expect(test.controller.getSnapshot()).toMatchObject({
        status: interruption === 'lock' ? 'locked' : 'suspended',
        address: null,
        refreshing: false,
        error: null,
      });
    },
  );

  it('ne transforme pas une exception du fournisseur en délai ni en déconnexion', async () => {
    const test = receive();
    test.provider.current.mockRejectedValueOnce(new Error('échec fictif interne'));
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      walletState: 'pret',
      refreshing: false,
      error: { code: 'READ_FAILED' },
    });
    expect(JSON.stringify(test.controller.getSnapshot())).not.toContain('échec fictif interne');
  });
});
