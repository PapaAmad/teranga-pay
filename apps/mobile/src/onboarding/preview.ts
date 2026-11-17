import type {
  OnboardingPreferences,
  OnboardingRandomPort,
  OnboardingServices,
  OnboardingWalletPort,
  OnboardingWalletState,
} from './ports';
import { createOnboardingRandom } from './random';

/** Aperçu explicite et isolé : ces jetons ne forment aucune phrase Bitcoin. */
const exampleWords = Array.from(
  { length: 12 },
  (_, index) => `exemple${String(index + 1).padStart(2, '0')}`,
);

/**
 * Factory à importer seulement par l'entrée de démonstration en développement.
 * Aucun SDK, compte, réseau ou stockage disque ; aucune valeur pour un paiement.
 */
export function createPreviewServices(
  random: OnboardingRandomPort = createOnboardingRandom(),
): OnboardingServices {
  let preferences: OnboardingPreferences = {};
  let pin: string | null = null;
  let state: OnboardingWalletState = 'absent';
  const wallet: OnboardingWalletPort = {
    async state() {
      return state;
    },
    async create(candidate) {
      if (pin !== null) return { ok: false, error: { code: 'WALLET_EXISTS' } };
      if (!/^\d{6}$/.test(candidate)) return { ok: false, error: { code: 'PIN_FORMAT' } };
      pin = candidate;
      state = 'pret';
      return { ok: true, value: { recoveryWords: [...exampleWords] } };
    },
    async restore() {
      return { ok: false, error: { code: 'RECOVERY_INVALID' } };
    },
    async unlock(candidate) {
      if (pin === null) return { ok: false, error: { code: 'WALLET_ABSENT' } };
      if (candidate !== pin) return { ok: false, error: { code: 'PIN_INVALID' } };
      state = 'pret';
      return { ok: true, value: undefined };
    },
    async lock() {
      if (pin !== null) state = 'verrouille';
    },
  };
  return {
    mode: 'preview',
    random,
    wallet,
    storage: {
      async read() {
        return { ...preferences };
      },
      async writeLanguage(language) {
        preferences = { ...preferences, language };
      },
      async writeSetup(setup) {
        preferences = { ...preferences, ...setup };
      },
    },
    protection: {
      async protect() {
        return true;
      },
      async release() {},
    },
  };
}
