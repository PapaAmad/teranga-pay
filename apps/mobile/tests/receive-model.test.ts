import { createReceiveController, isReceiveAddress } from '../src/receive/controller';
import type { HomeWalletEvent, HomeWalletState } from '../src/home/ports';
import type { ReceiveAddressPort, ReceiveServices, ReceiveWalletPort } from '../src/receive/ports';
import { createReceivePreviewServices } from '../src/receive/preview';

const address = 'exemple@teranga.example';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

async function microtasks() {
  for (let index = 0; index < 16; index += 1) await Promise.resolve();
}

function harness(state: HomeWalletState = 'pret') {
  let walletState = state;
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const release = jest.fn();
  const wallet: jest.Mocked<ReceiveWalletPort> = {
    state: jest.fn(async () => walletState),
    subscribe: jest.fn((listener) => {
      listeners.add(listener);
      return () => {
        release();
        listeners.delete(listener);
      };
    }),
  };
  const provider: jest.Mocked<ReceiveAddressPort> = {
    current: jest.fn(async () => ({ ok: true as const, value: { address } })),
  };
  const services: ReceiveServices = { mode: 'native', wallet, address: provider };
  return {
    controller: createReceiveController(services),
    services,
    wallet,
    provider,
    release,
    emit(event: HomeWalletEvent) {
      listeners.forEach((listener) => listener(event));
    },
    setState(next: HomeWalletState) {
      walletState = next;
    },
  };
}

describe('recevoir | modèle T18', () => {
  it('ne transforme jamais une intégration absente en adresse fictive', async () => {
    const controller = createReceiveController({ mode: 'unavailable' });
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({
      mode: 'unavailable',
      status: 'unavailable',
      address: null,
      refreshing: false,
    });
  });

  it('refuse de lire un wallet fourni dans un mode explicitement indisponible', async () => {
    const test = harness();
    const controller = createReceiveController({ ...test.services, mode: 'unavailable' });
    await controller.start();
    expect(test.wallet.state).not.toHaveBeenCalled();
    expect(test.provider.current).not.toHaveBeenCalled();
  });

  it.each(['wallet', 'address'] as const)('signale le port %s manquant', async (missing) => {
    const test = harness();
    const controller = createReceiveController({ ...test.services, [missing]: undefined });
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({ status: 'unavailable', address: null });
  });

  it('lit uniquement une adresse publique réutilisable et conserve sa chaîne exacte', async () => {
    const test = harness();
    test.provider.current.mockResolvedValue({
      ok: true,
      value: { address: 'Exemple+test@Teranga.example', token: 'ignored' } as { address: string },
    });
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      mode: 'native',
      status: 'ready',
      walletState: 'pret',
      address: 'Exemple+test@Teranga.example',
      refreshing: false,
      stale: false,
      error: null,
    });
    expect(JSON.stringify(test.controller.getSnapshot())).not.toContain('ignored');
    expect(test.provider.current).toHaveBeenCalledTimes(1);
  });

  it('expose un chargement sans inventer une adresse', async () => {
    const test = harness();
    const waiting = deferred<Awaited<ReturnType<ReceiveAddressPort['current']>>>();
    test.provider.current.mockReturnValue(waiting.promise);
    const loading = test.controller.start();
    await microtasks();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'loading',
      address: null,
      refreshing: true,
    });
    waiting.resolve({ ok: true, value: { address } });
    await loading;
    expect(test.controller.getSnapshot().status).toBe('ready');
  });

  it.each([
    ['verrouille', 'locked'],
    ['absent', 'absent'],
  ] as const)('ne lit pas une adresse lorsque le wallet est %s', async (state, status) => {
    const test = harness(state);
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      status,
      address: null,
      requiresUnlock: state === 'verrouille',
    });
    expect(test.provider.current).not.toHaveBeenCalled();
  });

  it.each([
    ['hors_ligne', 'offline'],
    ['synchronisation', 'synchronising'],
  ] as const)(
    'permet de montrer une adresse réellement fournie en état %s',
    async (state, status) => {
      const test = harness(state);
      await test.controller.start();
      expect(test.controller.getSnapshot()).toMatchObject({ status, address, stale: true });
    },
  );

  it('ne fabrique pas une adresse lorsque sa lecture hors ligne échoue', async () => {
    const test = harness('hors_ligne');
    test.provider.current.mockResolvedValue({ ok: false, error: { code: 'NETWORK_OFFLINE' } });
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'offline',
      address: null,
      stale: false,
      error: { code: 'NETWORK_OFFLINE' },
    });
  });

  it('conserve une ancienne adresse en mémoire sur erreur de rafraîchissement avec avertissement', async () => {
    const test = harness();
    await test.controller.start();
    test.provider.current.mockResolvedValue({ ok: false, error: { code: 'NETWORK_OFFLINE' } });
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'offline',
      walletState: 'pret',
      address,
      refreshing: false,
      stale: true,
      error: { code: 'NETWORK_OFFLINE' },
    });
    test.provider.current.mockResolvedValue({ ok: true, value: { address } });
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'ready',
      stale: false,
      error: null,
    });
  });

  it('traite un rejet inattendu sans exposer son message', async () => {
    const test = harness();
    test.provider.current.mockRejectedValue(new Error('do not display'));
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      address: null,
      error: { code: 'READ_FAILED' },
    });
    expect(JSON.stringify(test.controller.getSnapshot())).not.toContain('do not display');
  });

  it.each([null, { ok: 'true' }, { ok: true, value: null }, { ok: false, error: { code: '<x>' } }])(
    'rejette une enveloppe de résultat malformée : %j',
    async (value) => {
      const test = harness();
      test.provider.current.mockResolvedValue(value as never);
      await test.controller.start();
      expect(test.controller.getSnapshot()).toMatchObject({
        status: 'error',
        address: null,
        error: { code: 'INVALID_DATA' },
      });
    },
  );

  it.each([
    ['WALLET_LOCKED', 'locked'],
    ['WALLET_ABSENT', 'absent'],
  ] as const)('efface une ancienne adresse si le fournisseur signale %s', async (code, status) => {
    const test = harness();
    await test.controller.start();
    test.provider.current.mockResolvedValue({ ok: false, error: { code } });
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({ status, address: null, stale: false });
  });

  it('efface une adresse si la relecture de l’état échoue', async () => {
    const test = harness();
    await test.controller.start();
    test.wallet.state.mockRejectedValue(new Error('failed'));
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      walletState: null,
      address: null,
      error: { code: 'READ_FAILED' },
    });
    expect(test.provider.current).toHaveBeenCalledTimes(1);
  });

  it('rejette un état externe inconnu sans lire l’adresse', async () => {
    const test = harness();
    test.wallet.state.mockResolvedValue('unknown' as never);
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      address: null,
      error: { code: 'INVALID_DATA' },
    });
    expect(test.provider.current).not.toHaveBeenCalled();
  });

  it('refuse de montrer une adresse sans abonnement fiable aux verrouillages', async () => {
    const test = harness();
    test.wallet.subscribe.mockImplementation(() => {
      throw new Error('subscription');
    });
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'error',
      address: null,
      error: { code: 'SUBSCRIPTION_FAILED' },
    });
    expect(test.wallet.state).not.toHaveBeenCalled();
  });

  it('efface immédiatement l’adresse au verrouillage et ignore une lecture tardive', async () => {
    const test = harness();
    await test.controller.start();
    const waiting = deferred<Awaited<ReturnType<ReceiveAddressPort['current']>>>();
    test.provider.current.mockReturnValue(waiting.promise);
    const refresh = test.controller.refresh();
    await microtasks();
    test.emit({ type: 'etat', state: 'verrouille' });
    expect(test.controller.getSnapshot()).toMatchObject({
      status: 'locked',
      address: null,
      requiresUnlock: true,
    });
    waiting.resolve({ ok: true, value: { address: 'retard@teranga.example' } });
    await refresh;
    expect(test.controller.getSnapshot().address).toBeNull();
  });

  it('purge et désabonne à l’interruption, puis relit les ports au retour', async () => {
    const test = harness();
    await test.controller.start();
    test.controller.suspend();
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'suspended', address: null });
    expect(test.release).toHaveBeenCalledTimes(1);
    await test.controller.refresh();
    expect(test.provider.current).toHaveBeenCalledTimes(1);
    await test.controller.resume();
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'ready', address });
    expect(test.wallet.subscribe).toHaveBeenCalledTimes(2);
    expect(test.provider.current).toHaveBeenCalledTimes(2);
  });

  it('ne lit rien si l’écran commence déjà interrompu', async () => {
    const test = harness();
    test.controller.suspend();
    await test.controller.start();
    expect(test.provider.current).not.toHaveBeenCalled();
    expect(test.wallet.state).not.toHaveBeenCalled();
    expect(test.controller.getSnapshot().status).toBe('suspended');
  });

  it('ignore le résultat arrivé pendant l’interruption', async () => {
    const test = harness();
    const waiting = deferred<Awaited<ReturnType<ReceiveAddressPort['current']>>>();
    test.provider.current.mockReturnValue(waiting.promise);
    const start = test.controller.start();
    await microtasks();
    test.controller.suspend();
    waiting.resolve({ ok: true, value: { address } });
    await start;
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'suspended', address: null });
  });

  it('reprend sans réafficher une ancienne adresse si le wallet a été verrouillé pendant le partage', async () => {
    const test = harness();
    await test.controller.start();
    test.controller.suspend();
    test.setState('verrouille');
    await test.controller.resume();
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'locked', address: null });
    expect(test.provider.current).toHaveBeenCalledTimes(1);
  });

  it('regroupe vingt événements d’état pendant une lecture en un seul tour supplémentaire', async () => {
    const test = harness();
    const waiting = deferred<Awaited<ReturnType<ReceiveAddressPort['current']>>>();
    test.provider.current.mockReturnValueOnce(waiting.promise);
    const start = test.controller.start();
    await microtasks();
    for (let index = 0; index < 20; index += 1) test.emit({ type: 'etat', state: 'pret' });
    waiting.resolve({ ok: true, value: { address: 'retard@teranga.example' } });
    await start;
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'ready', address });
    expect(test.wallet.state).toHaveBeenCalledTimes(2);
    expect(test.provider.current).toHaveBeenCalledTimes(2);
  });

  it('ignore les événements qui ne modifient pas l’état, sans annoncer de paiement', async () => {
    const test = harness();
    await test.controller.start();
    for (const event of [null, {}, { type: 'etat', state: 'unknown' }, { type: 'paiement' }]) {
      test.emit(event as never);
    }
    await microtasks();
    expect(test.provider.current).toHaveBeenCalledTimes(1);
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'ready', address });
  });

  it('start est idempotent et les refresh concurrents partagent une lecture', async () => {
    const test = harness();
    const waiting = deferred<Awaited<ReturnType<ReceiveAddressPort['current']>>>();
    test.provider.current.mockReturnValue(waiting.promise);
    const start = test.controller.start();
    await microtasks();
    const second = test.controller.start();
    const refresh = test.controller.refresh();
    expect(second).toBe(start);
    expect(refresh).toBe(start);
    waiting.resolve({ ok: true, value: { address } });
    await start;
    expect(test.provider.current).toHaveBeenCalledTimes(1);
    await test.controller.start();
    expect(test.provider.current).toHaveBeenCalledTimes(1);
  });

  it('dispose efface l’adresse et ne réactive jamais un contrôleur', async () => {
    const test = harness();
    await test.controller.start();
    test.controller.dispose();
    test.controller.dispose();
    await test.controller.resume();
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({ status: 'suspended', address: null });
    expect(test.release).toHaveBeenCalledTimes(1);
    expect(test.provider.current).toHaveBeenCalledTimes(1);
  });

  it('un désabonnement défectueux n’empêche pas de retirer l’adresse', async () => {
    const test = harness();
    test.wallet.subscribe.mockReturnValue(() => {
      throw new Error('release');
    });
    await test.controller.start();
    expect(() => test.controller.suspend()).not.toThrow();
    expect(test.controller.getSnapshot().address).toBeNull();
  });

  it('notifie les abonnés et respecte leur désabonnement', async () => {
    const test = harness();
    const listener = jest.fn();
    const unsubscribe = test.controller.subscribe(listener);
    await test.controller.start();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    await test.controller.refresh();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('recevoir | validation des adresses publiques', () => {
  it.each([
    'exemple@teranga.example',
    'exemple+test@demo.teranga.example',
    'A_B-C.D@demo.example',
    'exemple@demo.xn--p1ai',
  ])('accepte une adresse ASCII simple : %s', (value) =>
    expect(isReceiveAddress(value)).toBe(true),
  );

  it.each([
    null,
    '',
    'https://teranga.example',
    'lightning:exemple@teranga.example',
    'exemple@teranga.example\n',
    `exemple@teranga.example${String.fromCharCode(10)}`,
    `exemple@teranga.example${String.fromCharCode(13)}`,
    `exemple@teranga.example${String.fromCharCode(0)}`,
    `exemple@teranga.example${String.fromCodePoint(0x202e)}`,
    ' exemple@teranga.example',
    'exemple @teranga.example',
    'exémple@teranga.example',
    'exemple@teranga.example:443',
    'exemple@localhost',
    'exemple@-demo.example',
    'exemple@demo-.example',
    'exemple@demo..example',
    'exemple@demo.example/path',
    `${'a'.repeat(65)}@teranga.example`,
    `exemple@${'d'.repeat(64)}.example`,
    `${'a'.repeat(64)}@${'d'.repeat(63)}.${'d'.repeat(63)}.${'d'.repeat(63)}.example`,
  ])('rejette une adresse malformée sans correction silencieuse : %j', (value) => {
    expect(isReceiveAddress(value)).toBe(false);
  });
});

describe('recevoir | atelier fictif', () => {
  it.each(['ready', 'offline', 'longAddress'] as const)(
    'ne fournit que des adresses réservées .example dans le scénario %s',
    async (scenario) => {
      const services = createReceivePreviewServices(scenario);
      const controller = createReceiveController(services);
      await controller.start();
      expect(controller.getSnapshot().mode).toBe('preview');
      expect(controller.getSnapshot().address).toMatch(/@.*\.example$/);
      expect(isReceiveAddress(controller.getSnapshot().address)).toBe(true);
    },
  );

  it('le chargement reste contrôlé jusqu’au changement de scénario, sans minuterie', async () => {
    const services = createReceivePreviewServices('loading');
    const controller = createReceiveController(services);
    const start = controller.start();
    await microtasks();
    expect(controller.getSnapshot()).toMatchObject({ status: 'loading', address: null });
    services.setScenario('ready');
    await start;
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', address });
  });

  it('permet une reprise explicite après erreur de lecture', async () => {
    const services = createReceivePreviewServices('error');
    const controller = createReceiveController(services);
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', address: null });
    services.setScenario('ready');
    await microtasks();
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', address });
  });
});
