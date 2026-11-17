import type {
  HomeBalance,
  HomePayment,
  HomeServices,
  HomeWalletEvent,
  HomeWalletPort,
  HomeWalletState,
} from './ports';

export type HomePreviewScenario =
  'ready' | 'empty' | 'offline' | 'rateUnavailable' | 'loading' | 'error' | 'largeAmount';

export type HomePreviewServices = HomeServices & {
  setScenario(scenario: HomePreviewScenario): void;
};

/** Atelier explicite : données fictives en mémoire, aucun SDK, compte, réseau ou paiement. */
export function createHomePreviewServices(
  initialScenario: HomePreviewScenario = 'ready',
  options: { now?: () => Date } = {},
): HomePreviewServices {
  let scenario = initialScenario;
  const now = options.now ?? (() => new Date());
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const pending = new Set<() => void>();
  const state = (): HomeWalletState => (scenario === 'offline' ? 'hors_ligne' : 'pret');

  function balance(): HomeBalance {
    const iso = now().toISOString();
    const empty = scenario === 'empty';
    const noRate = scenario === 'rateUnavailable';
    const spendableSats = empty
      ? 0
      : scenario === 'largeAmount'
        ? Number.MAX_SAFE_INTEGER
        : 100_000;
    // Limite de format fictive, pas des fonds : éviter un arrondi flottant à ce niveau de grandeur.
    const spendableXof = Number((BigInt(spendableSats) * 45_000_000n) / 100_000_000n);
    return {
      spendableSats,
      pendingSats: 0,
      spendableXof: noRate ? null : spendableXof,
      rate: noRate ? null : { xofPerBtc: 45_000_000, source: 'fixe', fetchedAt: iso },
      updatedAt: iso,
    };
  }

  function history(): HomePayment[] {
    if (scenario === 'empty' || scenario === 'largeAmount') return [];
    const current = now().getTime();
    return [
      {
        id: 'preview-reception',
        direction: 'recu',
        status: 'reussi',
        amountSats: 55_556,
        feeSats: 0,
        amountXof: 25_000,
        memo: null,
        createdAt: new Date(current - 12 * 60_000).toISOString(),
        failure: null,
      },
      {
        id: 'preview-paiement',
        direction: 'envoye',
        status: 'en_attente',
        amountSats: 5_556,
        feeSats: 2,
        amountXof: 2_500,
        memo: null,
        createdAt: new Date(current - 47 * 60_000).toISOString(),
        failure: null,
      },
      {
        id: 'preview-echec',
        direction: 'envoye',
        status: 'echoue',
        amountSats: 11_112,
        feeSats: 0,
        amountXof: 5_000,
        memo: null,
        createdAt: new Date(current - 120 * 60_000).toISOString(),
        failure: 'NO_ROUTE',
      },
    ];
  }

  const wallet: HomeWalletPort = {
    async state() {
      if (scenario === 'loading') {
        await new Promise<void>((resolve) => pending.add(resolve));
      }
      return state();
    },
    async balance() {
      if (scenario === 'error') return { ok: false, error: { code: 'NETWORK_OFFLINE' } };
      return { ok: true, value: balance() };
    },
    async history() {
      if (scenario === 'error') return { ok: false, error: { code: 'NETWORK_OFFLINE' } };
      return { ok: true, value: history() };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    mode: 'preview',
    wallet,
    setScenario(next) {
      scenario = next;
      pending.forEach((release) => release());
      pending.clear();
      listeners.forEach((listener) => listener({ type: 'etat', state: state() }));
    },
  };
}
