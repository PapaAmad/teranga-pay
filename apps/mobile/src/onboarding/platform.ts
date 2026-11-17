import { Platform } from 'react-native';

import { createOnboardingRandom } from './random';

import type {
  OnboardingPreferences,
  OnboardingProtectionPort,
  OnboardingServices,
  OnboardingStoragePort,
  OnboardingWalletPort,
} from './ports';

const preferencesKey = '@teranga-pay/onboarding/v1';
const screenProtectionKey = 'teranga-pay:t14:onboarding';
const preferenceFields = new Set(['language', 'completed', 'pendingBackup']);

// Même clé, même file : deux instances ne doivent pas écraser leurs préférences.
let storageQueue: Promise<void> = Promise.resolve();
let protectionQueue: Promise<void> = Promise.resolve();

function nativeStorage(): typeof import('@react-native-async-storage/async-storage').default {
  // Chargement tardif Metro : un module absent d'un ancien APK doit rester rattrapable.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const storage = require('@react-native-async-storage/async-storage');
  return (storage as typeof import('@react-native-async-storage/async-storage')).default;
}

function nativeScreenCapture(): typeof import('expo-screen-capture') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-screen-capture') as typeof import('expo-screen-capture');
}

function invalidPreferences(): never {
  // Ne jamais inclure le contenu persistant dans un message d'erreur.
  throw new Error('ONBOARDING_PREFERENCES_INVALID');
}

function parsePreferences(value: unknown): OnboardingPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidPreferences();
  if (Object.keys(value).some((field) => !preferenceFields.has(field))) invalidPreferences();

  const record = value as Record<string, unknown>;
  if ('language' in record && record.language !== 'fr' && record.language !== 'wo') {
    invalidPreferences();
  }
  if ('completed' in record && typeof record.completed !== 'boolean') invalidPreferences();
  if ('pendingBackup' in record && typeof record.pendingBackup !== 'boolean') invalidPreferences();

  return {
    ...(record.language === 'fr' || record.language === 'wo' ? { language: record.language } : {}),
    ...(typeof record.completed === 'boolean' ? { completed: record.completed } : {}),
    ...(typeof record.pendingBackup === 'boolean' ? { pendingBackup: record.pendingBackup } : {}),
  };
}

async function readPreferences(): Promise<OnboardingPreferences> {
  let stored: string | null;
  try {
    const AsyncStorage = nativeStorage();
    stored = await AsyncStorage.getItem(preferencesKey);
  } catch {
    throw new Error('ONBOARDING_STORAGE_READ_FAILED');
  }
  if (stored === null) return {};

  try {
    return parsePreferences(JSON.parse(stored));
  } catch {
    // Ces préférences ne sont jamais une autorisation. Une donnée invalide ne doit
    // ni bloquer toute nouvelle lecture, ni conserver un marqueur completed étranger.
    return {};
  }
}

async function writePreferences(preferences: OnboardingPreferences): Promise<void> {
  const serialized = JSON.stringify(parsePreferences(preferences));
  try {
    const AsyncStorage = nativeStorage();
    await AsyncStorage.setItem(preferencesKey, serialized);
  } catch {
    throw new Error('ONBOARDING_STORAGE_WRITE_FAILED');
  }
}

function serializeStorage<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation);
  // Un échec est renvoyé à l'appelant, sans bloquer toutes les opérations futures.
  storageQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Stockage non secret : langue et avancement uniquement, jamais autorisation de session. */
export function createOnboardingStorage(): OnboardingStoragePort {
  return {
    read: () => serializeStorage(readPreferences),
    writeLanguage(language) {
      return serializeStorage(async () => {
        if (language !== 'fr' && language !== 'wo') invalidPreferences();
        const saved = await readPreferences();
        await writePreferences({ ...saved, language });
      });
    },
    writeSetup(setup) {
      return serializeStorage(async () => {
        if (
          !setup ||
          typeof setup !== 'object' ||
          Object.keys(setup).some((field) => field !== 'completed' && field !== 'pendingBackup') ||
          typeof setup.completed !== 'boolean' ||
          typeof setup.pendingBackup !== 'boolean'
        ) {
          invalidPreferences();
        }
        const saved = await readPreferences();
        await writePreferences({
          ...saved,
          completed: setup.completed,
          pendingBackup: setup.pendingBackup,
        });
      });
    },
  };
}

function serializeProtection<T>(operation: () => Promise<T>): Promise<T> {
  const result = protectionQueue.then(operation);
  protectionQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Le succès confirme l'appel natif terminé ; il n'atteste pas un appareil inviolable. */
export function createScreenProtection(): OnboardingProtectionPort {
  return {
    protect: () =>
      serializeProtection(async () => {
        if (Platform.OS === 'web') return false;
        const ScreenCapture = nativeScreenCapture();
        if (!(await ScreenCapture.isAvailableAsync())) return false;
        await ScreenCapture.preventScreenCaptureAsync(screenProtectionKey);
        return true;
      }),
    release: () =>
      serializeProtection(async () => {
        if (Platform.OS !== 'web') {
          const ScreenCapture = nativeScreenCapture();
          await ScreenCapture.allowScreenCaptureAsync(screenProtectionKey);
        }
      }),
  };
}

/**
 * Sans wallet injecté, aucun coffre n'est inventé. Fournir un port ne valide ni
 * T15, ni la reprise authentifiée des mots après interruption du processus.
 */
export function createPlatformServices(wallet?: OnboardingWalletPort): OnboardingServices {
  return {
    mode: wallet && Platform.OS !== 'web' ? 'native' : 'unavailable',
    ...(wallet ? { wallet } : {}),
    storage: createOnboardingStorage(),
    protection: createScreenProtection(),
    random: createOnboardingRandom(),
  };
}
