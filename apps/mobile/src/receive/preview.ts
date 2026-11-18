import type { HomeWalletEvent, HomeWalletState } from '../home/ports';
import type { ReceiveServices } from './ports';

export type ReceivePreviewScenario = 'ready' | 'loading' | 'offline' | 'error' | 'longAddress';

export type ReceivePreviewServices = ReceiveServices & {
  setScenario(scenario: ReceivePreviewScenario): void;
};

/** Atelier de développement : adresse réservée fictive, aucun compte ou paiement créé. */
export function createReceivePreviewServices(
  initialScenario: ReceivePreviewScenario = 'ready',
): ReceivePreviewServices {
  let scenario = initialScenario;
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const pending = new Set<() => void>();
  const state = (): HomeWalletState => (scenario === 'offline' ? 'hors_ligne' : 'pret');

  return {
    mode: 'preview',
    wallet: {
      async state() {
        return state();
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    address: {
      async current() {
        if (scenario === 'loading') await new Promise<void>((resolve) => pending.add(resolve));
        if (scenario === 'error') return { ok: false, error: { code: 'READ_FAILED' } };
        return {
          ok: true,
          value: {
            address:
              scenario === 'longAddress'
                ? `exemple.${'a'.repeat(50)}@${'d'.repeat(45)}.teranga.example`
                : 'exemple@teranga.example',
          },
        };
      },
    },
    setScenario(next) {
      scenario = next;
      pending.forEach((release) => release());
      pending.clear();
      listeners.forEach((listener) => listener({ type: 'etat', state: state() }));
    },
  };
}
