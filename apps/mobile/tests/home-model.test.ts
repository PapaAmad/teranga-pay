import { createHomeController } from '../src/home/controller';
import {
  formatHomeDate,
  formatHomeNumber,
  formatHomeSignedNumber,
  isHomeIsoDate,
  estimatePendingHomeXof,
} from '../src/home/format';
import type {
  HomeBalance,
  HomePayment,
  HomeResult,
  HomeWalletEvent,
  HomeWalletPort,
  HomeWalletState,
} from '../src/home/ports';
import { createHomePreviewServices } from '../src/home/preview';

const iso = '2026-11-09T14:30:00.000Z';
const exampleBalance: HomeBalance = {
  spendableSats: 100_000,
  pendingSats: 2_000,
  spendableXof: 45_000,
  rate: { xofPerBtc: 45_000_000, source: 'fixe', fetchedAt: iso },
  updatedAt: iso,
};
const examplePayment: HomePayment = {
  id: 'operation-fictive',
  direction: 'recu',
  status: 'reussi',
  amountSats: 1_000,
  feeSats: 0,
  // Le taux historique diffère volontairement du taux actuel.
  amountXof: 400,
  memo: null,
  createdAt: iso,
  failure: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function microtasks() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

function harness(state: HomeWalletState = 'pret') {
  let walletState = state;
  const subscribers = new Set<(event: HomeWalletEvent) => void>();
  const release = jest.fn();
  const wallet: jest.Mocked<HomeWalletPort> = {
    state: jest.fn(async () => walletState),
    balance: jest.fn<ReturnType<HomeWalletPort['balance']>, Parameters<HomeWalletPort['balance']>>(
      async () => ({ ok: true, value: { ...exampleBalance } }),
    ),
    history: jest.fn<ReturnType<HomeWalletPort['history']>, Parameters<HomeWalletPort['history']>>(
      async () => ({ ok: true, value: [{ ...examplePayment }] }),
    ),
    subscribe: jest.fn((listener) => {
      subscribers.add(listener);
      return () => {
        release();
        subscribers.delete(listener);
      };
    }),
  };
  return {
    controller: createHomeController({ mode: 'native', wallet }),
    wallet,
    release,
    emit(event: HomeWalletEvent) {
      subscribers.forEach((listener) => listener(event));
    },
    setState(next: HomeWalletState) {
      walletState = next;
    },
  };
}

describe('accueil | modèle T16', () => {
  it('estime les sats en attente en FCFA par arrondi inférieur exact', () => {
    expect(estimatePendingHomeXof(exampleBalance)).toBe(900);
    expect(estimatePendingHomeXof({ ...exampleBalance, pendingSats: 1 })).toBe(0);
    expect(estimatePendingHomeXof({ ...exampleBalance, rate: null })).toBeNull();
    expect(
      estimatePendingHomeXof({
        ...exampleBalance,
        pendingSats: Number.MAX_SAFE_INTEGER,
        rate: { ...exampleBalance.rate!, xofPerBtc: Number.MAX_SAFE_INTEGER },
      }),
    ).toBeNull();
  });
  it('une actualisation en ligne conserve les données sans les annoncer périmées', async () => {
    const test = harness();
    await test.controller.start();
    const balance = deferred<HomeResult<HomeBalance>>();
    test.wallet.balance.mockReturnValueOnce(balance.promise);
    const refresh = test.controller.refresh();
    await microtasks();
    expect(test.controller.getSnapshot()).toMatchObject({
      refreshing: true,
      balance: { data: exampleBalance, stale: false },
      history: { stale: false },
    });
    balance.resolve({ ok: true, value: exampleBalance });
    await refresh;
  });

  it('un événement en ligne actualise sans annoncer un ancien solde avant un échec', async () => {
    const test = harness();
    await test.controller.start();
    const balance = deferred<HomeResult<HomeBalance>>();
    test.wallet.balance.mockReturnValueOnce(balance.promise);
    test.emit({ type: 'solde', balance: exampleBalance });
    await microtasks();
    expect(test.controller.getSnapshot().balance.stale).toBe(false);
    balance.resolve({ ok: false, error: { code: 'READ_FAILED' } });
    await test.controller.refresh();
    expect(test.controller.getSnapshot().balance.stale).toBe(true);
  });

  it('départage les opérations de même date par identifiant décroissant comme T11', async () => {
    const test = harness();
    test.wallet.history.mockResolvedValue({
      ok: true,
      value: ['a', 'c', 'b'].map((id) => ({ ...examplePayment, id })),
    });
    await test.controller.start();
    expect(test.controller.getSnapshot().history.data?.map((payment) => payment.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  it('ne transforme pas une intégration absente en solde nul ou en exemple', async () => {
    const controller = createHomeController({ mode: 'unavailable' });
    expect(controller.getSnapshot()).toMatchObject({
      status: 'idle',
      balance: { data: null },
      history: { data: null },
    });
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({
      status: 'unavailable',
      mode: 'unavailable',
      balance: { data: null },
      history: { data: null },
    });
  });

  it('lit le contrat, trie les trois dernières opérations et garde leur FCFA historique', async () => {
    const test = harness();
    test.wallet.history.mockResolvedValue({
      ok: true,
      value: [0, 3, 1, 2].map((minutes) => ({
        ...examplePayment,
        id: `exemple-${minutes}`,
        createdAt: new Date(Date.parse(iso) + minutes * 60_000).toISOString(),
      })),
    });
    await test.controller.start();
    expect(test.wallet.history).toHaveBeenCalledWith({ limit: 3 });
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      walletState: 'pret',
      refreshing: false,
      balance: { status: 'ready', data: exampleBalance, stale: false },
    });
    expect(test.controller.getSnapshot().history.data?.map((payment) => payment.id)).toEqual([
      'exemple-3',
      'exemple-2',
      'exemple-1',
    ]);
    expect(test.controller.getSnapshot().history.data?.[0]?.amountXof).toBe(400);
  });

  it('distingue un vrai zéro, une liste vide et une conversion inconnue', async () => {
    const services = createHomePreviewServices('empty');
    const controller = createHomeController(services);
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({
      balance: { status: 'ready', data: { spendableXof: 0, spendableSats: 0 } },
      history: { status: 'ready', data: [] },
    });
    services.setScenario('rateUnavailable');
    await controller.refresh();
    expect(controller.getSnapshot().balance.data).toMatchObject({
      spendableXof: null,
      spendableSats: 100_000,
      rate: null,
    });
    expect(controller.getSnapshot().history.data?.[0]?.amountXof).toBe(25_000);
  });

  it('rend le solde disponible pendant que l’historique attend encore', async () => {
    const test = harness();
    const history = deferred<HomeResult<HomePayment[]>>();
    test.wallet.history.mockReturnValueOnce(history.promise);
    const start = test.controller.start();
    await microtasks();
    expect(test.controller.getSnapshot()).toMatchObject({
      refreshing: true,
      balance: { status: 'ready', data: exampleBalance },
      history: { status: 'loading', data: null },
    });
    history.resolve({ ok: true, value: [] });
    await start;
    expect(test.controller.getSnapshot().history.data).toEqual([]);
  });

  it('garde le solde quand seul l’historique échoue, sans inventer une liste vide', async () => {
    const test = harness();
    test.wallet.history.mockResolvedValue({ ok: false, error: { code: 'NETWORK_OFFLINE' } });
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      balance: { status: 'ready', data: exampleBalance },
      history: { status: 'error', data: null, error: { code: 'NETWORK_OFFLINE' } },
    });
  });

  it('affiche l’historique même lorsque le premier chargement du solde échoue', async () => {
    const test = harness();
    test.wallet.balance.mockResolvedValue({ ok: false, error: { code: 'NETWORK_OFFLINE' } });
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      balance: { status: 'error', data: null },
      history: { status: 'ready', data: [examplePayment] },
    });
  });

  it('ne convertit pas une opération dont le montant historique FCFA est inconnu', async () => {
    const test = harness();
    test.wallet.history.mockResolvedValue({
      ok: true,
      value: [{ ...examplePayment, amountXof: null }],
    });
    await test.controller.start();
    expect(test.controller.getSnapshot().balance.data?.rate).not.toBeNull();
    expect(test.controller.getSnapshot().history.data?.[0]?.amountXof).toBeNull();
  });

  it('conserve les anciennes lectures en mémoire et les marque périmées après une erreur', async () => {
    const test = harness();
    await test.controller.start();
    test.wallet.balance.mockRejectedValueOnce(new Error('contenu externe jamais journalisé'));
    test.wallet.history.mockResolvedValueOnce({ ok: false, error: { code: 'NETWORK_OFFLINE' } });
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      balance: {
        status: 'error',
        data: exampleBalance,
        stale: true,
        error: { code: 'READ_FAILED' },
      },
      history: { status: 'error', data: [examplePayment], stale: true },
    });
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      balance: { status: 'ready', stale: false, error: null },
      history: { status: 'ready', stale: false, error: null },
    });
  });

  it.each(['hors_ligne', 'synchronisation'] as const)(
    'signale les lectures locales avec l’état wallet %s',
    async (state) => {
      const test = harness(state);
      await test.controller.start();
      expect(test.controller.getSnapshot()).toMatchObject({
        walletState: state,
        balance: { stale: true },
        history: { stale: true },
      });
    },
  );

  it.each([
    ['montant négatif', { spendableSats: -1 }],
    ['montant fractionnaire', { pendingSats: 0.5 }],
    ['nombre non fini', { spendableSats: Number.NaN }],
    ['entier imprécis', { spendableXof: Number.MAX_SAFE_INTEGER + 1 }],
    ['date impossible', { updatedAt: '2026-02-30T14:30:00.000Z' }],
    ['date locale', { updatedAt: '09/11/2026' }],
    ['taux nul', { rate: { ...exampleBalance.rate, xofPerBtc: 0 } }],
    ['source inconnue', { rate: { ...exampleBalance.rate, source: 'inventee' } }],
    ['FCFA sans taux', { rate: null }],
    ['taux absent du DTO', { rate: undefined }],
  ])('refuse un solde externe invalide : %s', async (_label, patch) => {
    const test = harness();
    test.wallet.balance.mockResolvedValue({
      ok: true,
      value: { ...exampleBalance, ...patch } as HomeBalance,
    });
    await test.controller.start();
    expect(test.controller.getSnapshot().balance).toMatchObject({
      status: 'error',
      data: null,
      error: { code: 'INVALID_DATA' },
    });
    expect(test.controller.getSnapshot().history.status).toBe('ready');
  });

  it.each([
    ['direction', { direction: 'autre' }],
    ['état', { status: 'termine' }],
    ['date', { createdAt: '2026-11-31T14:30:00.000Z' }],
    ['montant', { amountSats: -1 }],
    ['frais', { feeSats: 0.2 }],
    ['FCFA', { amountXof: Number.POSITIVE_INFINITY }],
    ['identifiant', { id: ' ' }],
    ['mémo', { memo: { text: 'invalide' } }],
    ['échec', { failure: 'texte externe arbitraire' }],
  ])('refuse une opération externe invalide : %s', async (_label, patch) => {
    const test = harness();
    test.wallet.history.mockResolvedValue({
      ok: true,
      value: [{ ...examplePayment, ...patch } as HomePayment],
    });
    await test.controller.start();
    expect(test.controller.getSnapshot().history).toMatchObject({
      status: 'error',
      data: null,
      error: { code: 'INVALID_DATA' },
    });
    expect(test.controller.getSnapshot().balance.status).toBe('ready');
  });

  it('refuse les doublons d’identifiant sans retirer silencieusement une opération', async () => {
    const test = harness();
    test.wallet.history.mockResolvedValue({ ok: true, value: [examplePayment, examplePayment] });
    await test.controller.start();
    expect(test.controller.getSnapshot().history.error?.code).toBe('INVALID_DATA');
  });

  it('copie les DTO et leurs sous-objets pour résister aux mutations du fournisseur', async () => {
    const test = harness();
    const balance = { ...exampleBalance, rate: { ...exampleBalance.rate! } };
    const payment = { ...examplePayment };
    test.wallet.balance.mockResolvedValue({ ok: true, value: balance });
    test.wallet.history.mockResolvedValue({ ok: true, value: [payment] });
    await test.controller.start();
    balance.rate.xofPerBtc = 1;
    payment.amountXof = 999_999;
    expect(test.controller.getSnapshot().balance.data?.rate?.xofPerBtc).toBe(45_000_000);
    expect(test.controller.getSnapshot().history.data?.[0]?.amountXof).toBe(400);
  });

  it.each(['absent', 'verrouille'] as const)(
    'efface les lectures et ne consulte pas de données privées avec l’état %s',
    async (state) => {
      const test = harness(state);
      await test.controller.start();
      expect(test.wallet.balance).not.toHaveBeenCalled();
      expect(test.wallet.history).not.toHaveBeenCalled();
      expect(test.controller.getSnapshot()).toMatchObject({
        status: state === 'absent' ? 'absent' : 'locked',
        requiresUnlock: state === 'verrouille',
        balance: { data: null },
        history: { data: null },
      });
    },
  );

  it('refuse un état externe inconnu avant toute lecture privée', async () => {
    const test = harness();
    test.wallet.state.mockResolvedValueOnce('connecte' as HomeWalletState);
    await test.controller.start();
    expect(test.wallet.balance).not.toHaveBeenCalled();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      error: { code: 'INVALID_DATA' },
    });
  });

  it('marque aussi les données périmées si la lecture de l’état échoue', async () => {
    const test = harness();
    await test.controller.start();
    test.wallet.state.mockRejectedValueOnce(new Error('exemple externe'));
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      walletState: null,
      error: { code: 'READ_FAILED' },
      balance: { data: exampleBalance, stale: true },
      history: { data: [examplePayment], stale: true },
    });
  });

  it('purge immédiatement sur verrouillage, puis ignore une ancienne réponse tardive', async () => {
    const test = harness();
    await test.controller.start();
    const late = deferred<HomeResult<HomeBalance>>();
    test.wallet.balance.mockReturnValueOnce(late.promise);
    const refresh = test.controller.refresh();
    await microtasks();
    test.setState('verrouille');
    test.emit({ type: 'etat', state: 'verrouille' });
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'locked',
      requiresUnlock: true,
      balance: { data: null },
      history: { data: null },
    });
    late.resolve({ ok: true, value: exampleBalance });
    await refresh;
    expect(test.controller.getSnapshot().balance.data).toBeNull();
  });

  it('honore WALLET_LOCKED renvoyé par une ressource et jette l’autre résultat', async () => {
    const test = harness();
    test.wallet.balance.mockResolvedValue({ ok: false, error: { code: 'WALLET_LOCKED' } });
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'locked',
      balance: { data: null },
      history: { data: null },
    });
  });

  it('ne lance pas l’historique si le wallet se verrouille pendant l’appel initial du solde', async () => {
    const test = harness();
    test.wallet.balance.mockImplementationOnce(async () => {
      test.setState('verrouille');
      test.emit({ type: 'etat', state: 'verrouille' });
      return { ok: true, value: exampleBalance };
    });
    await test.controller.start();
    expect(test.wallet.history).not.toHaveBeenCalled();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'locked',
      balance: { data: null },
      history: { data: null },
    });
  });

  it('recharge après un état déverrouillé annoncé par le wallet sans implémenter de PIN', async () => {
    const test = harness('verrouille');
    await test.controller.start();
    test.setState('pret');
    test.emit({ type: 'etat', state: 'pret' });
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      requiresUnlock: false,
      balance: { data: exampleBalance },
    });
  });

  it('efface une ancienne lecture si le wallet devient absent', async () => {
    const test = harness();
    await test.controller.start();
    test.emit({ type: 'etat', state: 'absent' });
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'absent',
      balance: { data: null },
      history: { data: null },
    });
  });

  it('purge au passage en arrière-plan, se désabonne et ignore les réponses anciennes', async () => {
    const test = harness();
    await test.controller.start();
    const late = deferred<HomeResult<HomePayment[]>>();
    test.wallet.history.mockReturnValueOnce(late.promise);
    const oldRefresh = test.controller.refresh();
    await microtasks();
    test.controller.suspend();
    expect(test.release).toHaveBeenCalledTimes(1);
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'suspended',
      balance: { data: null },
      history: { data: null },
    });
    test.setState('verrouille');
    await test.controller.resume();
    expect(test.wallet.subscribe).toHaveBeenCalledTimes(2);
    late.resolve({ ok: true, value: [examplePayment] });
    await oldRefresh;
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'locked',
      balance: { data: null },
      history: { data: null },
    });
  });

  it('la destruction efface les données, libère l’abonnement et rend les relances inertes', async () => {
    const test = harness();
    await test.controller.start();
    test.controller.dispose();
    test.controller.dispose();
    await test.controller.resume();
    await test.controller.refresh();
    expect(test.release).toHaveBeenCalledTimes(1);
    expect(test.wallet.balance).toHaveBeenCalledTimes(1);
    expect(test.controller.getSnapshot().history.data).toBeNull();
  });

  it('regroupe les rafales d’événements et écarte l’historique déjà en vol', async () => {
    const test = harness();
    const oldHistory = deferred<HomeResult<HomePayment[]>>();
    const newPayment = { ...examplePayment, id: 'operation-nouvelle' };
    test.wallet.history.mockReturnValueOnce(oldHistory.promise);
    test.wallet.history.mockResolvedValueOnce({ ok: true, value: [newPayment] });
    const start = test.controller.start();
    await microtasks();
    for (let index = 0; index < 20; index += 1) {
      test.emit({ type: 'paiement', payment: newPayment });
    }
    oldHistory.resolve({ ok: true, value: [examplePayment] });
    await start;
    expect(test.wallet.state).toHaveBeenCalledTimes(2);
    expect(test.wallet.balance).toHaveBeenCalledTimes(2);
    expect(test.wallet.history).toHaveBeenCalledTimes(2);
    expect(test.controller.getSnapshot().history.data?.[0]?.id).toBe('operation-nouvelle');
  });

  it('déduplique les demandes de rafraîchissement concurrentes', async () => {
    const test = harness();
    const balance = deferred<HomeResult<HomeBalance>>();
    test.wallet.balance.mockReturnValueOnce(balance.promise);
    const start = test.controller.start();
    await microtasks();
    const refresh = test.controller.refresh();
    expect(refresh).toBe(start);
    balance.resolve({ ok: true, value: exampleBalance });
    await Promise.all([start, refresh]);
    expect(test.wallet.balance).toHaveBeenCalledTimes(1);
  });

  it('marque les anciennes lectures dès la notification, avant la prochaine attente', async () => {
    const test = harness();
    await test.controller.start();
    test.setState('hors_ligne');
    test.emit({ type: 'etat', state: 'hors_ligne' });
    expect(test.controller.getSnapshot()).toMatchObject({
      walletState: 'hors_ligne',
      balance: { stale: true },
      history: { stale: true },
    });
    await test.controller.refresh();
    expect(test.controller.getSnapshot().balance.stale).toBe(true);
  });

  it('n’injecte pas de payload d’événement malformé dans le snapshot', async () => {
    const test = harness();
    await test.controller.start();
    test.emit({ type: 'etat', state: 'connecte' } as unknown as HomeWalletEvent);
    test.emit({ type: 'solde', balance: { ...exampleBalance, spendableSats: -1 } });
    test.emit({
      type: 'paiement',
      payment: { ...examplePayment, direction: 'autre' },
    } as unknown as HomeWalletEvent);
    await microtasks();
    expect(test.wallet.balance).toHaveBeenCalledTimes(1);
    expect(test.controller.getSnapshot().balance.data).toEqual(exampleBalance);
  });

  it('signale un abonnement indisponible sans annoncer des données à jour', async () => {
    const test = harness();
    test.wallet.subscribe.mockImplementationOnce(() => {
      throw new Error('exemple externe');
    });
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      error: { code: 'SUBSCRIPTION_FAILED' },
    });
    expect(test.wallet.balance).not.toHaveBeenCalled();
  });

  it('refuse un Result malformé et ne reprend jamais un message externe en guise de code', async () => {
    const test = harness();
    test.wallet.balance.mockResolvedValue({
      ok: false,
      error: { code: 'message externe à ne pas afficher', attemptsLeft: -1 },
    });
    test.wallet.history.mockResolvedValue({ ok: 'oui', value: [] } as unknown as HomeResult<
      HomePayment[]
    >);
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      balance: { error: { code: 'INVALID_DATA' }, data: null },
      history: { error: { code: 'INVALID_DATA' }, data: null },
    });
  });
});

describe('accueil | formats et atelier', () => {
  it('groupe les montants entiers avec des espaces insécables sans inventer d’unité', () => {
    expect(formatHomeNumber(45_000)).toBe('45\u00a0000');
    expect(formatHomeNumber(0)).toBe('0');
    expect(formatHomeSignedNumber(25_000, 'recu')).toBe('+25\u00a0000');
    expect(formatHomeSignedNumber(2_500, 'envoye')).toBe('\u22122\u00a0500');
    expect(() => formatHomeNumber(-1)).toThrow(RangeError);
    expect(() => formatHomeNumber(0.5)).toThrow(RangeError);
  });

  it('formate les dates dans le fuseau de Dakar et refuse les jours impossibles', () => {
    const expected = new Intl.DateTimeFormat('fr-SN', {
      timeZone: 'Africa/Dakar',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date('2026-11-09T00:05:00.000Z'));
    const rendered = formatHomeDate('2026-11-09T00:05:00.000Z', { time: true });
    expect(rendered).toBe(expected);
    expect(rendered).toContain('00:05');
    expect(rendered).toContain('9 nov');
    expect(isHomeIsoDate('2026-11-09T00:05:00Z')).toBe(true);
    expect(isHomeIsoDate('2026-11-09T00:05:00.1Z')).toBe(true);
    expect(isHomeIsoDate('2026-02-30T00:05:00Z')).toBe(false);
    expect(isHomeIsoDate('2026-11-09T24:05:00Z')).toBe(false);
    expect(isHomeIsoDate('2026-11-09T00:05:00+01:00')).toBe(false);
    expect(() => formatHomeDate('une date inconnue')).toThrow(RangeError);
  });

  it('propose un état hors ligne explicite et des exemples sans nom de personne', async () => {
    const services = createHomePreviewServices('offline', { now: () => new Date(iso) });
    const controller = createHomeController(services);
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({
      mode: 'preview',
      walletState: 'hors_ligne',
      balance: { stale: true },
    });
    expect(controller.getSnapshot().history.data?.map((payment) => payment.status)).toEqual([
      'reussi',
      'en_attente',
      'echoue',
    ]);
    expect(controller.getSnapshot().history.data?.every((payment) => payment.memo === null)).toBe(
      true,
    );
  });

  it('prépare une limite de format fictive avec une conversion entière exacte et sûre', async () => {
    const services = createHomePreviewServices('largeAmount', { now: () => new Date(iso) });
    const controller = createHomeController(services);
    await controller.start();
    const snapshot = controller.getSnapshot();
    expect(snapshot).toMatchObject({
      mode: 'preview',
      status: 'ready',
      balance: {
        data: {
          spendableSats: Number.MAX_SAFE_INTEGER,
          spendableXof: 4_053_239_664_633_445,
          rate: { source: 'fixe', xofPerBtc: 45_000_000 },
        },
      },
      history: { data: [] },
    });
    expect(Number.isSafeInteger(snapshot.balance.data?.spendableXof)).toBe(true);
    // Cette écriture flottante arrondit à tort d'un FCFA à la limite choisie.
    expect(snapshot.balance.data?.spendableXof).not.toBe(
      Math.floor(Number.MAX_SAFE_INTEGER * 0.45),
    );
    expect(formatHomeNumber(snapshot.balance.data!.spendableXof!)).toBe(
      '4\u00a0053\u00a0239\u00a0664\u00a0633\u00a0445',
    );
  });

  it('la prévisualisation du chargement attend un changement explicite, sans délai artificiel', async () => {
    const services = createHomePreviewServices('loading');
    const controller = createHomeController(services);
    const start = controller.start();
    await microtasks();
    expect(controller.getSnapshot()).toMatchObject({ status: 'loading', balance: { data: null } });
    services.setScenario('ready');
    await start;
    expect(controller.getSnapshot()).toMatchObject({
      status: 'ready',
      balance: { data: { spendableXof: 45_000 } },
    });
  });
});
