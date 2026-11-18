import { createCollectController } from '../src/collect/controller';
import type {
  CollectInvoicePort,
  CollectRequest,
  CollectServices,
  CollectWalletPort,
} from '../src/collect/ports';
import { createCollectPreviewServices } from '../src/collect/preview';
import { createHistoryController } from '../src/history/controller';
import type { HistoryServices, HistoryWithdrawalPort } from '../src/history/ports';
import type {
  HomePayment,
  HomeResult,
  HomeWalletEvent,
  HomeWalletPort,
  HomeWalletState,
} from '../src/home/ports';
import type { SendQuote } from '../src/send/ports';

const instant = Date.UTC(2026, 10, 12, 12);
const ok = <T>(value: T): HomeResult<T> => ({ ok: true, value });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function drain() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}
async function deadline() {
  await drain();
  await jest.advanceTimersByTimeAsync(10_000);
  await drain();
}
function payment(
  id = 'paiement-fictif-1',
  direction: HomePayment['direction'] = 'recu',
): HomePayment {
  return {
    id,
    direction,
    status: 'reussi',
    amountSats: 5556,
    feeSats: 0,
    amountXof: 2500,
    memo: null,
    failure: null,
    createdAt: new Date(instant).toISOString(),
  };
}

function collect() {
  const base = createCollectPreviewServices('waiting', { now: Date.now });
  let state: HomeWalletState = 'pret';
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const wallet: jest.Mocked<CollectWalletPort> = {
    state: jest.fn(async () => state),
    subscribe: jest.fn((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
  };
  const invoices: jest.Mocked<CollectInvoicePort> = {
    create: jest.fn(base.invoices!.create),
    lookup: jest.fn(base.invoices!.lookup),
  };
  const quote = jest.fn(base.rates!.quote);
  const services: CollectServices = { ...base, wallet, invoices, rates: { quote } };
  const controller = createCollectController(services, { now: Date.now });
  return {
    controller,
    services,
    wallet,
    invoices,
    quote,
    emit(event: HomeWalletEvent) {
      if (event.type === 'etat') state = event.state;
      listeners.forEach((listener) => listener(event));
    },
  };
}
async function prepared(test: ReturnType<typeof collect>) {
  await test.controller.start();
  await test.controller.prepare('2500');
}
function history(withBridge = false) {
  let state: HomeWalletState = 'pret';
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const wallet: jest.Mocked<Pick<HomeWalletPort, 'state' | 'history' | 'subscribe'>> = {
    state: jest.fn(async () => state),
    history: jest.fn<ReturnType<HomeWalletPort['history']>, Parameters<HomeWalletPort['history']>>(
      async () => ok([payment()]),
    ),
    subscribe: jest.fn((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
  };
  const bridge: jest.Mocked<HistoryWithdrawalPort> = {
    history: jest.fn(async () => ok({ simulation: true as const, items: [], nextCursor: null })),
  };
  const services: HistoryServices = {
    mode: 'native',
    wallet,
    ...(withBridge ? { withdrawals: bridge } : {}),
  };
  const controller = createHistoryController(services, { now: Date.now });
  return {
    controller,
    wallet,
    bridge,
    emit(event: HomeWalletEvent) {
      if (event.type === 'etat') state = event.state;
      listeners.forEach((listener) => listener(event));
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(instant);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('T28 | Encaisser ne reste pas bloqué en lecture', () => {
  it('borne ensemble le suivi courant et ses archives plutôt que cumuler leurs délais', async () => {
    const test = collect();
    await test.controller.start();
    for (let index = 0; index < 3; index++) {
      await test.controller.prepare('2500');
      await test.controller.create();
      if (index < 2) {
        await jest.advanceTimersByTimeAsync(300_001);
        test.controller.newRequest();
      }
    }
    test.invoices.lookup.mockClear();
    test.invoices.lookup.mockImplementation(() => new Promise(() => {}));
    const refreshing = test.controller.refresh();
    await drain();
    expect(test.invoices.lookup).toHaveBeenCalledTimes(3);
    await deadline();
    await refreshing;
    expect(test.controller.getSnapshot()).toMatchObject({
      busy: false,
      error: { code: 'READ_TIMEOUT' },
      receipt: null,
      committed: true,
    });
    expect(test.invoices.create).toHaveBeenCalledTimes(3);
    test.controller.dispose();
  });
  it('une erreur tardive de création garde l’incertitude et ne libère pas une nouvelle facture', async () => {
    const test = collect(),
      slow = deferred<HomeResult<CollectRequest>>();
    await prepared(test);
    test.invoices.create.mockReturnValueOnce(slow.promise);
    const creating = test.controller.create();
    await deadline();
    slow.reject(new Error('Détail fournisseur fictif à ne pas afficher'));
    await creating;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      busy: false,
      committed: true,
      receipt: null,
      error: { code: 'CREATION_UNKNOWN' },
      canNewRequest: false,
    });
    await test.controller.refresh();
    await test.controller.create();
    test.controller.newRequest();
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(test.controller.getSnapshot())).not.toContain('fournisseur');
    test.controller.dispose();
  });
  it('un paiement de même identité mais de mauvais montant après le délai ne produit aucun reçu', async () => {
    const test = collect(),
      slow = deferred<HomeResult<CollectRequest>>();
    await prepared(test);
    const original = test.invoices.create.getMockImplementation()!;
    test.invoices.create.mockReturnValueOnce(slow.promise);
    const creating = test.controller.create();
    await deadline();
    const result = await original({ quote: test.controller.getSnapshot().quote! });
    if (!result.ok) throw Error('Fixture invalide');
    test.emit({
      type: 'paiement',
      payment: { ...payment(result.value.paymentId), amountSats: 10 },
    });
    slow.resolve(result);
    await creating;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      error: { code: 'PAYMENT_MISMATCH' },
      receipt: null,
      committed: true,
      canNewRequest: false,
    });
    test.controller.dispose();
  });
  it('borne state puis permet une reprise sans afficher sa réponse tardive', async () => {
    const test = collect(),
      slow = deferred<HomeWalletState>();
    test.wallet.state.mockReturnValueOnce(slow.promise);
    const loading = test.controller.start();
    await deadline();
    await loading;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'error',
      busy: false,
      error: { code: 'READ_TIMEOUT' },
      committed: false,
    });
    await test.controller.refresh();
    expect(test.controller.getSnapshot().phase).toBe('amount');
    slow.resolve('verrouille');
    await drain();
    expect(test.controller.getSnapshot().phase).toBe('amount');
    expect(test.invoices.create).not.toHaveBeenCalled();
    test.controller.dispose();
  });
  it('borne le devis et ignore son résultat après une nouvelle préparation', async () => {
    const test = collect(),
      slow = deferred<HomeResult<SendQuote>>();
    await test.controller.start();
    const oldQuote = await test.quote(2500);
    test.quote.mockClear();
    test.quote.mockReturnValueOnce(slow.promise);
    const loading = test.controller.prepare('2500');
    await deadline();
    await loading;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'amount',
      busy: false,
      quote: null,
      error: { code: 'READ_TIMEOUT' },
    });
    await test.controller.prepare('5000');
    slow.resolve(oldQuote);
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      quote: { amountXof: 5000 },
    });
    expect(test.invoices.create).not.toHaveBeenCalled();
    test.controller.dispose();
  });
  it('une lecture lente avant création ne remet aucune facture au fournisseur', async () => {
    const test = collect(),
      slow = deferred<HomeWalletState>();
    await prepared(test);
    test.wallet.state.mockReturnValueOnce(slow.promise);
    const creating = test.controller.create();
    await deadline();
    await creating;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      busy: false,
      committed: false,
      error: { code: 'READ_TIMEOUT' },
    });
    expect(test.invoices.create).not.toHaveBeenCalled();
    await test.controller.create();
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    slow.resolve('pret');
    await drain();
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    test.controller.dispose();
  });
  it('une création lente devient inconnue, conserve sa barrière et accepte la réponse tardive', async () => {
    const test = collect(),
      slow = deferred<HomeResult<CollectRequest>>();
    await prepared(test);
    const implementation = test.invoices.create.getMockImplementation()!;
    test.invoices.create.mockReturnValueOnce(slow.promise);
    const creating = test.controller.create();
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'creating',
      busy: true,
      committed: true,
    });
    await deadline();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      busy: false,
      request: null,
      receipt: null,
      committed: true,
      canNewRequest: false,
      error: { code: 'CREATION_UNKNOWN' },
    });
    await test.controller.create();
    test.controller.newRequest();
    await test.controller.prepare('5000');
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    const quote = test.controller.getSnapshot().quote!;
    const result = await implementation({ quote });
    slow.resolve(result);
    await creating;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'waiting',
      busy: false,
      committed: true,
      request: { paymentId: expect.any(String) },
      receipt: null,
    });
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    test.controller.dispose();
  });
  it('rapproche un paiement reçu après le délai de création seulement quand son identité est connue', async () => {
    const test = collect(),
      slow = deferred<HomeResult<CollectRequest>>();
    await prepared(test);
    const original = test.invoices.create.getMockImplementation()!;
    test.invoices.create.mockReturnValueOnce(slow.promise);
    const creating = test.controller.create();
    await deadline();
    const result = await original({ quote: test.controller.getSnapshot().quote! });
    if (!result.ok) throw Error('Fixture invalide');
    const incoming = payment(result.value.paymentId);
    test.emit({ type: 'paiement', payment: incoming });
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'unknown', receipt: null });
    slow.resolve(result);
    await creating;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'paid',
      receipt: { paymentId: incoming.id, amountXof: 2500 },
    });
    test.controller.dispose();
  });
  it('une création répondant après suspension reste masquée puis se retrouve sans recréation', async () => {
    const test = collect(),
      slow = deferred<HomeResult<CollectRequest>>();
    await prepared(test);
    const original = test.invoices.create.getMockImplementation()!;
    const quote = test.controller.getSnapshot().quote!;
    test.invoices.create.mockReturnValueOnce(slow.promise);
    const creating = test.controller.create();
    await deadline();
    test.controller.suspend();
    slow.resolve(await original({ quote }));
    await creating;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'suspended',
      request: null,
      quote: null,
    });
    await test.controller.resume();
    expect(test.controller.getSnapshot().phase).toBe('waiting');
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    test.controller.dispose();
  });
  it('la lecture de facture lente conserve la demande exacte et le reçu reste non confirmé', async () => {
    const test = collect();
    await prepared(test);
    await test.controller.create();
    const request = test.controller.getSnapshot().request!;
    const slow = deferred<Awaited<ReturnType<CollectInvoicePort['lookup']>>>();
    test.invoices.lookup.mockReturnValueOnce(slow.promise);
    const refreshing = test.controller.refresh();
    await deadline();
    await refreshing;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'waiting',
      busy: false,
      request,
      receipt: null,
      error: { code: 'READ_TIMEOUT' },
    });
    await test.controller.refresh();
    slow.resolve(
      ok({ paymentRequest: request.invoice.paymentRequest, payment: payment(request.paymentId) }),
    );
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'waiting',
      request,
      receipt: null,
    });
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    test.controller.dispose();
  });
  it('ne laisse pas une lecture lente effacer une preuve reçue par événement', async () => {
    const test = collect();
    await prepared(test);
    await test.controller.create();
    const request = test.controller.getSnapshot().request!;
    test.invoices.lookup.mockReturnValueOnce(new Promise(() => {}));
    const refreshing = test.controller.refresh();
    await drain();
    test.emit({ type: 'paiement', payment: payment(request.paymentId) });
    await deadline();
    await refreshing;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'paid',
      busy: false,
      error: null,
      receipt: { paymentId: request.paymentId },
    });
    test.controller.dispose();
  });
  it('le verrouillage invalide une lecture de facture et sa réponse ultérieure', async () => {
    const test = collect();
    await prepared(test);
    await test.controller.create();
    const request = test.controller.getSnapshot().request!;
    const slow = deferred<Awaited<ReturnType<CollectInvoicePort['lookup']>>>();
    test.invoices.lookup.mockReturnValueOnce(slow.promise);
    const refreshing = test.controller.refresh();
    await drain();
    test.emit({ type: 'etat', state: 'verrouille' });
    await deadline();
    await refreshing;
    slow.resolve(
      ok({ paymentRequest: request.invoice.paymentRequest, payment: payment(request.paymentId) }),
    );
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'locked',
      request: null,
      receipt: null,
      quote: null,
    });
    test.controller.dispose();
  });
});

describe('T28 | Historique reprend la lecture sans perdre la page connue', () => {
  it('borne la première lecture puis accepte une reprise, sans laisser revenir l’ancienne réponse', async () => {
    const test = history(),
      slow = deferred<HomeResult<HomePayment[]>>();
    test.wallet.history.mockReturnValueOnce(slow.promise);
    const loading = test.controller.start();
    await deadline();
    await loading;
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      refreshing: false,
      payments: { status: 'error', error: { code: 'READ_TIMEOUT' } },
    });
    await test.controller.refresh();
    slow.resolve(ok([payment('ancien-resultat')]));
    await drain();
    expect(test.controller.getSnapshot().payments.items.map((p) => p.id)).toEqual([
      'paiement-fictif-1',
    ]);
    test.controller.dispose();
  });
  it('une source lente ne masque pas le résultat indépendant de l’autre', async () => {
    const test = history(true);
    test.wallet.history.mockReturnValueOnce(new Promise(() => {}));
    const loading = test.controller.start();
    await drain();
    expect(test.controller.getSnapshot().withdrawals.status).toBe('ready');
    await deadline();
    await loading;
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      refreshing: false,
      withdrawals: { status: 'ready', complete: true },
      payments: { status: 'error', error: { code: 'READ_TIMEOUT' }, complete: false },
    });
    test.controller.dispose();
  });
  it('une lecture d’état lente purge les données dont l’autorisation ne peut plus être vérifiée', async () => {
    const test = history();
    await test.controller.start();
    test.wallet.state.mockReturnValueOnce(new Promise(() => {}));
    const refreshing = test.controller.refresh();
    await deadline();
    await refreshing;
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      refreshing: false,
      walletState: null,
      error: { code: 'READ_TIMEOUT' },
      entries: [],
      payments: { status: 'error', complete: false, items: [] },
    });
    await test.controller.refresh();
    expect(test.controller.getSnapshot().payments.stale).toBe(false);
    test.controller.dispose();
  });
  it('une lecture de page lente conserve les opérations déjà autorisées comme anciennes', async () => {
    const test = history();
    await test.controller.start();
    test.wallet.history.mockReturnValueOnce(new Promise(() => {}));
    const refreshing = test.controller.refresh();
    await deadline();
    await refreshing;
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      refreshing: false,
      walletState: 'pret',
      payments: {
        stale: true,
        complete: false,
        items: [payment()],
        error: { code: 'READ_TIMEOUT' },
      },
    });
    await test.controller.refresh();
    expect(test.controller.getSnapshot().payments).toMatchObject({
      stale: false,
      complete: true,
      error: null,
    });
    test.controller.dispose();
  });
  it('réessaie le même curseur après expiration de lecture, puis ignore sa réponse ancienne', async () => {
    const test = history();
    const first = Array.from({ length: 20 }, (_, index) => payment(`page-${index}`));
    test.wallet.history.mockResolvedValueOnce(ok(first));
    await test.controller.start();
    const slow = deferred<HomeResult<HomePayment[]>>();
    test.wallet.history.mockReturnValueOnce(slow.promise);
    const paging = test.controller.loadMore('wallet');
    await deadline();
    await paging;
    expect(test.controller.getSnapshot().payments).toMatchObject({
      items: first,
      loadingMore: false,
      hasMore: true,
      complete: false,
      error: { code: 'READ_TIMEOUT' },
    });
    test.wallet.history.mockResolvedValueOnce(ok([payment('page-suivante')]));
    await test.controller.loadMore('wallet');
    expect(test.wallet.history.mock.calls.slice(-2)).toEqual([
      [{ limit: 20, before: 'page-19' }],
      [{ limit: 20, before: 'page-19' }],
    ]);
    slow.resolve(ok([payment('reponse-tardive')]));
    await drain();
    expect(test.controller.getSnapshot().payments.items.map((p) => p.id)).toEqual([
      ...first.map((p) => p.id),
      'page-suivante',
    ]);
    test.controller.dispose();
  });
  it.each(['suspend', 'lock'] as const)(
    'purge les opérations après %s pendant une lecture lente',
    async (action) => {
      const test = history();
      await test.controller.start();
      const slow = deferred<HomeResult<HomePayment[]>>();
      test.wallet.history.mockReturnValueOnce(slow.promise);
      const refreshing = test.controller.refresh();
      await drain();
      if (action === 'suspend') test.controller.suspend();
      else test.emit({ type: 'etat', state: 'verrouille' });
      await deadline();
      await refreshing;
      slow.resolve(ok([payment('ancienne-lecture')]));
      await drain();
      expect(test.controller.getSnapshot()).toMatchObject({
        status: action === 'suspend' ? 'suspended' : 'locked',
        entries: [],
        payments: { items: [] },
        refreshing: false,
      });
      test.controller.dispose();
    },
  );
  it('hors ligne ne sollicite pas la passerelle et conserve la lecture locale ancienne', async () => {
    const test = history(true);
    test.emit({ type: 'etat', state: 'hors_ligne' });
    await test.controller.start();
    expect(test.bridge.history).not.toHaveBeenCalled();
    expect(test.controller.getSnapshot()).toMatchObject({
      walletState: 'hors_ligne',
      payments: { status: 'ready', stale: true },
      withdrawals: { status: 'error', error: { code: 'NETWORK_OFFLINE' } },
    });
    test.controller.dispose();
  });
});
