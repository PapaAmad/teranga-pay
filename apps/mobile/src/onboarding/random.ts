import type { OnboardingRandomPort } from './ports';

const uint32Range = 0x1_0000_0000;

/** Mélange du quiz uniquement : ce module ne génère ni graine ni clé Bitcoin. */
export function createOnboardingRandom(): OnboardingRandomPort {
  return {
    integer(upperExclusive) {
      if (
        !Number.isSafeInteger(upperExclusive) ||
        upperExclusive < 1 ||
        upperExclusive > uint32Range
      )
        throw new Error('ONBOARDING_RANDOM_RANGE');
      // Chargement tardif : un ancien APK sans module doit refuser avant create().
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require('expo-crypto') as typeof import('expo-crypto');
      if (typeof crypto.getRandomValues !== 'function')
        throw new Error('ONBOARDING_RANDOM_UNAVAILABLE');
      const sample = new Uint32Array(1);
      const ceiling = uint32Range - (uint32Range % upperExclusive);
      // Le rejet évite le biais du modulo ; une source défaillante ne boucle pas sans fin.
      for (let attempt = 0; attempt < 128; attempt += 1) {
        if (crypto.getRandomValues(sample) !== sample)
          throw new Error('ONBOARDING_RANDOM_UNAVAILABLE');
        const value = sample[0]!;
        if (value < ceiling) return value % upperExclusive;
      }
      throw new Error('ONBOARDING_RANDOM_UNAVAILABLE');
    },
  };
}
