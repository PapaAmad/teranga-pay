import { createHistoryController } from '../src/history/controller';
import { historyDayKey, summarizeHistory } from '../src/history/summary';
import type {
  HistoryServices,
  HistoryWithdrawal,
  HistoryWithdrawalPort,
} from '../src/history/ports';
import type {
  HomePayment,
  HomeResult,
  HomeWalletEvent,
  HomeWalletPort,
  HomeWalletState,
} from '../src/home/ports';

const initialTime = Date.UTC(2026, 10, 11, 12);
const iso = (offset = 0) => new Date(initialTime + offset).toISOString();
function payment(id = 'payment-1', changes: Partial<HomePayment> = {}): HomePayment {
  return {
    id,
    direction: 'recu',
    status: 'reussi',
    amountSats: 1000,
    feeSats: 0,
    amountXof: 400,
    memo: null,
    createdAt: iso(-1000),
    failure: null,
    ...changes,
  };
}
function withdrawal(
  id = 'withdrawal-1',
  changes: Partial<HistoryWithdrawal> = {},
): HistoryWithdrawal {
  return {
    id,
    quoteId: `quote-${id}`,
    simulation: true,
    operator: 'wave',
    recipientId: 'wave-demo-001',
    amountXof: 2500,
    feeXof: 100,
    totalXof: 2600,
    amountSats: 5556,
    feeSats: 222,
    totalSats: 5778,
    xofPerBtc: 45_000_000,
    source: 'fixe',
    quoteCreatedAt: iso(-2000),
    quoteExpiresAt: iso(298_000),
    createdAt: iso(-1000),
    updatedAt: iso(-1000),
    status: 'reussi',
    failure: null,
    ...changes,
  };
}
function page(prefix: string, count = 20): HomePayment[] {
  return Array.from({ length: count }, (_, index) =>
    payment(`${prefix}-${index}`, { createdAt: iso(-index * 1000) }),
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (value?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function microtasks() {
  for (let index = 0; index < 20; index++) await Promise.resolve();
}
function harness(
  options: { state?: HomeWalletState; bridge?: boolean; mode?: HistoryServices['mode'] } = {},
) {
  let state = options.state ?? 'pret';
  let now = initialTime;
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const captured: ((event: HomeWalletEvent) => void)[] = [];
  const release = jest.fn();
  const wallet: jest.Mocked<Pick<HomeWalletPort, 'state' | 'history' | 'subscribe'>> = {
    state: jest.fn(async () => state),
    history: jest.fn<ReturnType<HomeWalletPort['history']>, Parameters<HomeWalletPort['history']>>(
      async () => ({ ok: true, value: [payment()] }),
    ),
    subscribe: jest.fn((listener) => {
      listeners.add(listener);
      captured.push(listener);
      return () => {
        release();
        listeners.delete(listener);
      };
    }),
  };
  const withdrawals: jest.Mocked<HistoryWithdrawalPort> = {
    history: jest.fn<
      ReturnType<HistoryWithdrawalPort['history']>,
      Parameters<HistoryWithdrawalPort['history']>
    >(async () => ({
      ok: true,
      value: { simulation: true, items: [withdrawal()], nextCursor: null },
    })),
  };
  const services: HistoryServices = {
    mode: options.mode ?? 'native',
    wallet,
    ...(options.bridge ? { withdrawals } : {}),
  };
  const controller = createHistoryController(services, { now: () => now });
  return {
    controller,
    wallet,
    withdrawals,
    release,
    captured,
    services,
    setNow(value: number) {
      now = value;
    },
    setState(value: HomeWalletState) {
      state = value;
    },
    emit(event: HomeWalletEvent) {
      if (event.type === 'etat') state = event.state;
      listeners.forEach((listener) => listener(event));
    },
  };
}

describe('historique T24 | lecture et sources isolées', () => {
  it('rend une source disponible sans attendre la lecture lente de l’autre', async () => {
    const h = harness({ bridge: true });
    const pending = deferred<HomeResult<HomePayment[]>>();
    h.wallet.history.mockReturnValueOnce(pending.promise);
    const first = h.controller.start();
    await microtasks();
    expect(h.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      refreshing: true,
      payments: { status: 'loading' },
      withdrawals: { status: 'ready' },
    });
    expect(h.controller.getSnapshot().entries).toHaveLength(1);
    pending.resolve({ ok: true, value: [payment()] });
    await first;
    expect(h.controller.getSnapshot().entries).toHaveLength(2);
  });
  it('ne fabrique pas un historique lorsque les services sont absents', async () => {
    const controller = createHistoryController({ mode: 'unavailable' }, { now: () => initialTime });
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'unavailable',
      entries: [],
      daily: { walletCoverage: 'unavailable', withdrawalCoverage: 'unavailable' },
    });
  });
  it('ne lit aucun fournisseur du mode indisponible même si un port est fourni', async () => {
    const h = harness({ bridge: true, mode: 'unavailable' });
    await h.controller.start();
    expect(h.wallet.history).not.toHaveBeenCalled();
    expect(h.withdrawals.history).not.toHaveBeenCalled();
  });
  it.each(['absent', 'verrouille'] as const)(
    'efface les deux sources lorsque le wallet est %s',
    async (state) => {
      const h = harness({ bridge: true, state });
      await h.controller.start();
      expect(h.controller.getSnapshot().status).toBe(state === 'absent' ? 'absent' : 'locked');
      expect(h.controller.getSnapshot().entries).toEqual([]);
      expect(h.wallet.history).not.toHaveBeenCalled();
      expect(h.withdrawals.history).not.toHaveBeenCalled();
    },
  );
  it('distingue une passerelle absente d’une liste de retraits vide', async () => {
    const h = harness();
    await h.controller.start();
    expect(h.controller.getSnapshot().withdrawals.status).toBe('unavailable');
    expect(h.controller.getSnapshot().daily.withdrawalCoverage).toBe('unavailable');
    expect(h.controller.getSnapshot().payments.complete).toBe(true);
  });
  it('conserve les deux identités de source même si leurs identifiants bruts sont égaux', async () => {
    const h = harness({ bridge: true });
    h.wallet.history.mockResolvedValue({ ok: true, value: [payment('same-id')] });
    h.withdrawals.history.mockResolvedValue({
      ok: true,
      value: { simulation: true, items: [withdrawal('same-id')], nextCursor: null },
    });
    await h.controller.start();
    expect(
      h.controller
        .getSnapshot()
        .entries.map((item) => item.key)
        .sort(),
    ).toEqual(['bridge_sim:same-id', 'wallet:same-id']);
    expect(h.controller.getSnapshot().daily).toMatchObject({
      received: { xof: 400 },
      simulatedWithdrawals: { xof: 2500 },
    });
  });
  it('garde les ressources indépendantes quand la passerelle échoue', async () => {
    const h = harness({ bridge: true });
    h.withdrawals.history.mockResolvedValue({ ok: false, error: { code: 'NETWORK_OFFLINE' } });
    await h.controller.start();
    expect(h.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      payments: { status: 'ready', complete: true },
      withdrawals: { status: 'error', complete: false },
    });
  });
  it('conserve une ancienne lecture après erreur de page initiale sans annoncer un total complet', async () => {
    const h = harness();
    await h.controller.start();
    h.wallet.history.mockRejectedValueOnce(new Error('lecture fictive interrompue'));
    await h.controller.refresh();
    expect(h.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      payments: { status: 'error', stale: true, complete: false, items: [payment()] },
      daily: { walletCoverage: 'partial', walletStale: true },
    });
  });
  it('refuse un état de wallet invalide et retire les données déjà visibles', async () => {
    const h = harness({ bridge: true });
    await h.controller.start();
    h.wallet.state.mockResolvedValueOnce('inconnu' as HomeWalletState);
    await h.controller.refresh();
    expect(h.controller.getSnapshot()).toMatchObject({
      status: 'error',
      entries: [],
      error: { code: 'INVALID_DATA' },
    });
  });
  it('retire les données lorsque la lecture d’état ne peut plus autoriser leur affichage', async () => {
    const h = harness({ bridge: true });
    await h.controller.start();
    h.wallet.state.mockRejectedValueOnce(new Error('état fictif indisponible'));
    await h.controller.refresh();
    expect(h.controller.getSnapshot().entries).toEqual([]);
    expect(h.controller.getSnapshot().error?.code).toBe('READ_FAILED');
  });
  it('signale un abonnement impossible avant toute lecture d’historique', async () => {
    const h = harness();
    h.wallet.subscribe.mockImplementationOnce(() => {
      throw new Error('abonnement fictif refusé');
    });
    await h.controller.start();
    expect(h.controller.getSnapshot().error?.code).toBe('SUBSCRIPTION_FAILED');
    expect(h.wallet.history).not.toHaveBeenCalled();
  });
});

describe('historique T24 | pagination sans faux total complet', () => {
  it('utilise le dernier identifiant brut comme curseur malgré le tri visuel', async () => {
    const h = harness();
    const first = page('first').reverse();
    h.wallet.history
      .mockResolvedValueOnce({ ok: true, value: first })
      .mockResolvedValueOnce({ ok: true, value: [] });
    await h.controller.start();
    expect(h.controller.getSnapshot().entries[0]!.key).toBe('wallet:first-0');
    expect(h.controller.getSnapshot().payments).toMatchObject({ hasMore: true, complete: false });
    await h.controller.loadMore('wallet');
    expect(h.wallet.history).toHaveBeenLastCalledWith({ limit: 20, before: first.at(-1)!.id });
    expect(h.controller.getSnapshot().payments).toMatchObject({ complete: true, hasMore: false });
    expect(h.controller.getSnapshot().payments.items).toHaveLength(20);
  });
  it('demande la page vide supplémentaire lorsque le nombre d’opérations est un multiple de vingt', async () => {
    const h = harness();
    h.wallet.history
      .mockResolvedValueOnce({ ok: true, value: page('first') })
      .mockResolvedValueOnce({ ok: true, value: [] });
    await h.controller.start();
    expect(h.controller.getSnapshot().daily.walletCoverage).toBe('partial');
    await h.controller.loadMore('wallet');
    expect(h.controller.getSnapshot().daily.walletCoverage).toBe('complete');
    await h.controller.loadMore('wallet');
    expect(h.wallet.history).toHaveBeenCalledTimes(2);
  });
  it('réunit les doubles appuis Charger la suite dans une seule lecture', async () => {
    const h = harness();
    const pending = deferred<HomeResult<HomePayment[]>>();
    h.wallet.history
      .mockResolvedValueOnce({ ok: true, value: page('first') })
      .mockReturnValueOnce(pending.promise);
    await h.controller.start();
    const a = h.controller.loadMore('wallet'),
      b = h.controller.loadMore('wallet');
    expect(h.wallet.history).toHaveBeenCalledTimes(2);
    pending.resolve({ ok: true, value: [payment('last')] });
    await Promise.all([a, b]);
    expect(h.controller.getSnapshot().payments.items).toHaveLength(21);
  });
  it('rejette une page répétée plutôt que de compter deux fois ses montants', async () => {
    const h = harness();
    const first = page('same');
    h.wallet.history.mockResolvedValue({ ok: true, value: first });
    await h.controller.start();
    await h.controller.loadMore('wallet');
    expect(h.controller.getSnapshot().payments).toMatchObject({
      status: 'error',
      complete: false,
      error: { code: 'INVALID_PAGINATION' },
    });
    expect(h.controller.getSnapshot().payments.items).toHaveLength(20);
    expect(h.controller.getSnapshot().daily.received.count).toBe(20);
  });
  it('refuse aussi un seul doublon entre deux pages distinctes', async () => {
    const h = harness();
    h.wallet.history
      .mockResolvedValueOnce({ ok: true, value: page('first') })
      .mockResolvedValueOnce({ ok: true, value: [payment('first-3'), payment('new')] });
    await h.controller.start();
    await h.controller.loadMore('wallet');
    expect(h.controller.getSnapshot().payments.error?.code).toBe('INVALID_PAGINATION');
    expect(h.controller.getSnapshot().payments.items).toHaveLength(20);
  });
  it('refuse les doublons à l’intérieur de la première page', async () => {
    const h = harness();
    h.wallet.history.mockResolvedValueOnce({ ok: true, value: [payment(), payment()] });
    await h.controller.start();
    expect(h.controller.getSnapshot().payments.error?.code).toBe('INVALID_DATA');
    expect(h.controller.getSnapshot().entries).toEqual([]);
  });
  it('conserve les pages précédentes après une erreur de la suivante', async () => {
    const h = harness();
    h.wallet.history
      .mockResolvedValueOnce({ ok: true, value: page('first') })
      .mockRejectedValueOnce(new Error('page fictive indisponible'));
    await h.controller.start();
    await h.controller.loadMore('wallet');
    expect(h.controller.getSnapshot().payments.items).toHaveLength(20);
    expect(h.controller.getSnapshot().payments).toMatchObject({
      stale: true,
      complete: false,
      error: { code: 'READ_FAILED' },
    });
  });
  it('réessaie la même page après une panne de lecture sans perdre les pages précédentes', async () => {
    const h = harness();
    h.wallet.history
      .mockResolvedValueOnce({ ok: true, value: page('first') })
      .mockRejectedValueOnce(new Error('page fictive interrompue'))
      .mockResolvedValueOnce({ ok: true, value: [payment('last')] });
    await h.controller.start();
    await h.controller.loadMore('wallet');
    expect(h.controller.getSnapshot().payments.error?.code).toBe('READ_FAILED');
    await h.controller.loadMore('wallet');
    expect(h.wallet.history.mock.calls.slice(1)).toEqual([
      [{ limit: 20, before: 'first-19' }],
      [{ limit: 20, before: 'first-19' }],
    ]);
    expect(h.controller.getSnapshot().payments.items).toHaveLength(21);
    expect(h.controller.getSnapshot().payments).toMatchObject({
      status: 'ready',
      complete: true,
      error: null,
    });
  });
  it('interrompt à mille éléments en signalant une couverture partielle', async () => {
    const h = harness();
    let pageIndex = 0;
    h.wallet.history.mockImplementation(async () => ({
      ok: true,
      value: page(`batch-${pageIndex++}`),
    }));
    await h.controller.start();
    for (let index = 0; index < 60; index++) await h.controller.loadMore('wallet');
    expect(h.wallet.history).toHaveBeenCalledTimes(50);
    expect(h.controller.getSnapshot().payments.items).toHaveLength(1000);
    expect(h.controller.getSnapshot().payments).toMatchObject({
      hasMore: false,
      complete: false,
      error: { code: 'HISTORY_LIMIT' },
    });
    expect(h.controller.getSnapshot().daily.walletCoverage).toBe('partial');
  });
  it('parcourt le curseur opaque de la passerelle et son terme explicite', async () => {
    const h = harness({ bridge: true });
    h.withdrawals.history
      .mockResolvedValueOnce({
        ok: true,
        value: { simulation: true, items: [withdrawal('a')], nextCursor: 'opaque-cursor-a' },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { simulation: true, items: [withdrawal('b')], nextCursor: null },
      });
    await h.controller.start();
    await h.controller.loadMore('bridge_sim');
    expect(h.withdrawals.history).toHaveBeenLastCalledWith({
      limit: 20,
      before: 'opaque-cursor-a',
    });
    expect(h.controller.getSnapshot().withdrawals).toMatchObject({
      complete: true,
      hasMore: false,
    });
    expect(h.controller.getSnapshot().daily.simulatedWithdrawals.count).toBe(2);
  });
  it('refuse un curseur de passerelle qui ne progresse pas', async () => {
    const h = harness({ bridge: true });
    h.withdrawals.history
      .mockResolvedValueOnce({
        ok: true,
        value: { simulation: true, items: [withdrawal('a')], nextCursor: 'same-cursor' },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { simulation: true, items: [withdrawal('b')], nextCursor: 'same-cursor' },
      });
    await h.controller.start();
    await h.controller.loadMore('bridge_sim');
    expect(h.controller.getSnapshot().withdrawals.error?.code).toBe('INVALID_PAGINATION');
    expect(h.controller.getSnapshot().withdrawals.items).toHaveLength(1);
  });
  it('refuse une page vide annonçant encore un curseur', async () => {
    const h = harness({ bridge: true });
    h.withdrawals.history.mockResolvedValueOnce({
      ok: true,
      value: { simulation: true, items: [], nextCursor: 'loop' },
    });
    await h.controller.start();
    expect(h.controller.getSnapshot().withdrawals.error?.code).toBe('INVALID_DATA');
  });
});

describe('historique T24 | données externes validées', () => {
  it.each([
    ['identifiant vide', { id: '' }],
    ['identifiant de contrôle', { id: 'id\nspoof' }],
    ['direction inconnue', { direction: 'other' }],
    ['statut inconnu', { status: 'other' }],
    ['sats négatifs', { amountSats: -1 }],
    ['sats non sûrs', { amountSats: Number.MAX_SAFE_INTEGER + 1 }],
    ['FCFA non entiers', { amountXof: 4.5 }],
    ['réception avec frais', { feeSats: 1 }],
    ['succès et échec contradictoires', { failure: 'NO_ROUTE' }],
    ['date impossible', { createdAt: '2026-02-30T12:00:00Z' }],
    ['mémo bidirectionnel', { memo: 'vente\u202e123' }],
    ['mémo excessif', { memo: 'a'.repeat(513) }],
  ])('refuse %s sans afficher ni additionner le paiement', async (_name, changes) => {
    const h = harness();
    h.wallet.history.mockResolvedValueOnce({
      ok: true,
      value: [payment('invalid', changes as Partial<HomePayment>)],
    });
    await h.controller.start();
    expect(h.controller.getSnapshot().payments.error?.code).toBe('INVALID_DATA');
    expect(h.controller.getSnapshot().payments.items).toEqual([]);
    expect(h.controller.getSnapshot().daily.received.count).toBe(0);
  });
  it('ne conserve pas les champs supplémentaires des réponses dans le snapshot', async () => {
    const h = harness();
    const raw = { ...payment(), privateField: 'champ-fictif-inutile' };
    h.wallet.history.mockResolvedValueOnce({ ok: true, value: [raw] });
    await h.controller.start();
    expect(h.controller.getSnapshot().payments.items[0]).toEqual(payment());
    expect(h.controller.getSnapshot().payments.items[0]).not.toHaveProperty('privateField');
  });
  it.each([
    ['simulation absente', { simulation: false }],
    ['destination croisée', { recipientId: 'orange-demo-001' }],
    ['frais modifiés', { feeXof: 150 }],
    ['total incohérent', { totalXof: 2700 }],
    ['conversion incohérente', { totalSats: 5779 }],
    ['durée excessive', { quoteExpiresAt: iso(400_000) }],
    ['date manquante', { updatedAt: '' }],
    ['succès contradictoire', { failure: 'PROVIDER_DECLINED' }],
  ])('refuse le retrait %s sans contaminer le wallet', async (_name, changes) => {
    const h = harness({ bridge: true });
    h.withdrawals.history.mockResolvedValueOnce({
      ok: true,
      value: {
        simulation: true,
        items: [withdrawal('invalid', changes as Partial<HistoryWithdrawal>)],
        nextCursor: null,
      },
    });
    await h.controller.start();
    expect(h.controller.getSnapshot().withdrawals.error?.code).toBe('INVALID_DATA');
    expect(h.controller.getSnapshot().payments.items).toHaveLength(1);
    expect(h.controller.getSnapshot().daily.simulatedWithdrawals.count).toBe(0);
  });
});

describe('historique T24 | total du jour explicitement daté', () => {
  it('sépare réceptions, envois et retraits fictifs, sans compter attente ou échec', async () => {
    const h = harness({ bridge: true });
    h.wallet.history.mockResolvedValueOnce({
      ok: true,
      value: [
        payment('received'),
        payment('sent', { direction: 'envoye', feeSats: 2 }),
        payment('pending', { status: 'en_attente' }),
        payment('failed', { status: 'echoue', failure: 'NO_ROUTE' }),
      ],
    });
    await h.controller.start();
    expect(h.controller.getSnapshot().daily).toMatchObject({
      dateBasis: 'createdAt',
      timeZone: 'Africa/Dakar',
      received: { count: 1, sats: 1000, xof: 400, feeSats: 0 },
      sent: { count: 1, sats: 1000, xof: 400, feeSats: 2 },
      simulatedWithdrawals: { count: 1, sats: 5556, xof: 2500, feeSats: 222 },
    });
  });
  it('signale des FCFA inconnus tout en conservant les sats et le sous-total connu', async () => {
    const h = harness();
    h.wallet.history.mockResolvedValueOnce({
      ok: true,
      value: [payment('known'), payment('unknown', { amountXof: null })],
    });
    await h.controller.start();
    expect(h.controller.getSnapshot().daily.received).toMatchObject({
      count: 2,
      sats: 2000,
      xof: null,
      knownXof: 400,
      unknownXofCount: 1,
      overflow: false,
    });
  });
  it('conserve le montant historique fourni même s’il diffère du taux courant de démonstration', async () => {
    const h = harness();
    await h.controller.start();
    expect(h.controller.getSnapshot().daily.received.xof).toBe(400);
    expect(h.controller.getSnapshot().daily.received.xof).not.toBe(450);
  });
  it('détecte un dépassement de somme sans arrondir le montant financier', async () => {
    const h = harness();
    h.wallet.history.mockResolvedValueOnce({
      ok: true,
      value: [
        payment('one', { amountSats: Number.MAX_SAFE_INTEGER, amountXof: Number.MAX_SAFE_INTEGER }),
        payment('two', { amountSats: Number.MAX_SAFE_INTEGER, amountXof: Number.MAX_SAFE_INTEGER }),
      ],
    });
    await h.controller.start();
    expect(h.controller.getSnapshot().daily.received).toMatchObject({
      count: 2,
      sats: null,
      xof: null,
      knownXof: null,
      overflow: true,
    });
  });
  it('détecte séparément un dépassement des frais en sats', async () => {
    const h = harness();
    h.wallet.history.mockResolvedValueOnce({
      ok: true,
      value: [
        payment('one', { direction: 'envoye', feeSats: Number.MAX_SAFE_INTEGER }),
        payment('two', { direction: 'envoye', feeSats: Number.MAX_SAFE_INTEGER }),
      ],
    });
    await h.controller.start();
    expect(h.controller.getSnapshot().daily.sent).toMatchObject({
      sats: 2000,
      xof: 800,
      feeSats: null,
      overflow: true,
    });
  });
  it('respecte exactement minuit à Dakar et ne confond pas des années différentes', async () => {
    const h = harness();
    h.setNow(Date.UTC(2026, 10, 11));
    h.wallet.history.mockResolvedValueOnce({
      ok: true,
      value: [
        payment('today', { createdAt: '2026-11-11T00:00:00.000Z' }),
        payment('yesterday', { createdAt: '2026-11-10T23:59:59.999Z' }),
        payment('old-year', { createdAt: '2025-11-11T12:00:00.000Z' }),
      ],
    });
    await h.controller.start();
    expect(h.controller.getSnapshot().daily).toMatchObject({
      dayKey: '2026-11-11',
      received: { count: 1, xof: 400 },
    });
    expect(historyDayKey('2025-11-11T12:00:00.000Z')).toBe('2025-11-11');
    expect(() => historyDayKey('2026-02-30T12:00:00.000Z')).toThrow('INVALID_DATE');
  });
  it('recalcule le jour au tick sans déclencher de lecture financière', async () => {
    const h = harness();
    h.setNow(Date.UTC(2026, 10, 11, 23, 59, 59));
    await h.controller.start();
    const calls = h.wallet.history.mock.calls.length;
    h.setNow(Date.UTC(2026, 10, 12));
    h.controller.tick();
    expect(h.controller.getSnapshot().daily).toMatchObject({
      dayKey: '2026-11-12',
      received: { count: 0, xof: 0 },
      walletStale: true,
    });
    expect(h.wallet.history).toHaveBeenCalledTimes(calls);
  });
  it('peut calculer un résumé vide dont les sources restent explicitement indisponibles', () => {
    const result = summarizeHistory({
      payments: [],
      withdrawals: [],
      now: initialTime,
      walletCoverage: 'unavailable',
      withdrawalCoverage: 'unavailable',
      walletStale: false,
      withdrawalsStale: false,
    });
    expect(result.walletCoverage).toBe('unavailable');
    expect(result.withdrawalCoverage).toBe('unavailable');
  });
});

describe('historique T24 | événements, confidentialité et réponses tardives', () => {
  it.each(['hors_ligne', 'synchronisation'] as const)(
    'lit le wallet local %s sans appeler la passerelle',
    async (state) => {
      const h = harness({ bridge: true, state });
      await h.controller.start();
      expect(h.wallet.history).toHaveBeenCalledTimes(1);
      expect(h.withdrawals.history).not.toHaveBeenCalled();
      expect(h.controller.getSnapshot().payments.stale).toBe(true);
      expect(h.controller.getSnapshot().withdrawals.error?.code).toBe('NETWORK_OFFLINE');
    },
  );
  it('garde un ancien retrait signalé comme ancien lors du passage hors connexion', async () => {
    const h = harness({ bridge: true });
    await h.controller.start();
    h.emit({ type: 'etat', state: 'hors_ligne' });
    await h.controller.refresh();
    expect(h.withdrawals.history).toHaveBeenCalledTimes(1);
    expect(h.controller.getSnapshot().withdrawals).toMatchObject({
      stale: true,
      complete: false,
      items: [withdrawal()],
    });
  });
  it('efface immédiatement toutes les données à un événement de verrouillage', async () => {
    const h = harness({ bridge: true });
    await h.controller.start();
    h.emit({ type: 'etat', state: 'verrouille' });
    expect(h.controller.getSnapshot()).toMatchObject({
      status: 'locked',
      entries: [],
      payments: { items: [], lastReadAt: null },
      withdrawals: { items: [], lastReadAt: null },
    });
  });
  it('ignore la passerelle retardée lorsqu’une lecture wallet découvre le verrouillage', async () => {
    const h = harness({ bridge: true });
    const pending =
      deferred<
        HomeResult<{ simulation: true; items: HistoryWithdrawal[]; nextCursor: string | null }>
      >();
    h.wallet.history.mockResolvedValueOnce({ ok: false, error: { code: 'WALLET_LOCKED' } });
    h.withdrawals.history.mockReturnValueOnce(pending.promise);
    const start = h.controller.start();
    await microtasks();
    expect(h.controller.getSnapshot().status).toBe('locked');
    pending.resolve({
      ok: true,
      value: { simulation: true, items: [withdrawal()], nextCursor: null },
    });
    await start;
    expect(h.controller.getSnapshot().entries).toEqual([]);
  });
  it('efface les données hors écran et relit après reprise', async () => {
    const h = harness({ bridge: true });
    await h.controller.start();
    const listener = h.captured[0]!;
    h.controller.suspend();
    expect(h.controller.getSnapshot().entries).toEqual([]);
    expect(h.release).toHaveBeenCalledTimes(1);
    listener({ type: 'paiement', payment: payment('late') });
    expect(h.controller.getSnapshot().entries).toEqual([]);
    await h.controller.resume();
    expect(h.controller.getSnapshot().entries).toHaveLength(2);
    expect(h.wallet.history).toHaveBeenCalledTimes(2);
  });
  it('reprend sans attendre une ancienne lecture suspendue et refuse son résultat tardif', async () => {
    const h = harness();
    const pending = deferred<HomeResult<HomePayment[]>>();
    h.wallet.history
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ ok: true, value: [payment('fresh')] });
    const first = h.controller.start();
    await microtasks();
    h.controller.suspend();
    await h.controller.resume();
    expect(h.controller.getSnapshot().payments.items[0]!.id).toBe('fresh');
    pending.resolve({ ok: true, value: [payment('stale')] });
    await first;
    expect(h.controller.getSnapshot().payments.items[0]!.id).toBe('fresh');
  });
  it('invalide une réponse ancienne après un événement et regroupe une rafale de changements', async () => {
    const h = harness();
    const pending = deferred<HomeResult<HomePayment[]>>();
    h.wallet.history
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ ok: true, value: [payment('confirmed')] });
    const first = h.controller.start();
    await microtasks();
    for (let index = 0; index < 15; index++)
      h.emit({ type: 'paiement', payment: payment(`event-${index}`) });
    pending.resolve({ ok: true, value: [payment('old-pending', { status: 'en_attente' })] });
    await first;
    expect(h.wallet.history).toHaveBeenCalledTimes(2);
    expect(h.controller.getSnapshot().payments.items.map((item) => item.id)).toEqual(['confirmed']);
  });
  it('refuse une ancienne page après actualisation sans bloquer les nouvelles pages', async () => {
    const h = harness();
    const pending = deferred<HomeResult<HomePayment[]>>();
    h.wallet.history
      .mockResolvedValueOnce({ ok: true, value: page('old') })
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ ok: true, value: page('fresh') })
      .mockResolvedValueOnce({ ok: true, value: [payment('fresh-last')] });
    await h.controller.start();
    const oldPage = h.controller.loadMore('wallet');
    await h.controller.refresh();
    await h.controller.loadMore('wallet');
    expect(h.controller.getSnapshot().payments.items).toHaveLength(21);
    pending.resolve({ ok: true, value: [payment('old-last')] });
    await oldPage;
    expect(h.controller.getSnapshot().payments.items.some((item) => item.id === 'old-last')).toBe(
      false,
    );
    expect(h.controller.getSnapshot().payments.items.at(-1)!.id).toBe('fresh-last');
  });
  it('ignore les événements malformés au lieu de déclencher des lectures', async () => {
    const h = harness();
    await h.controller.start();
    h.captured[0]!({ type: 'paiement', payment: payment('bad', { feeSats: 1 }) });
    await microtasks();
    expect(h.wallet.history).toHaveBeenCalledTimes(1);
  });
  it('ne reprend pas un contrôleur détruit', async () => {
    const h = harness();
    await h.controller.start();
    h.controller.dispose();
    await h.controller.resume();
    await h.controller.refresh();
    expect(h.controller.getSnapshot()).toMatchObject({ status: 'suspended', entries: [] });
    expect(h.wallet.history).toHaveBeenCalledTimes(1);
  });
});
