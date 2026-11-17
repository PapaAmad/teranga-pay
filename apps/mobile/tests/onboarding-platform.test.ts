import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

import {
  createOnboardingStorage,
  createPlatformServices,
  createScreenProtection,
} from '../src/onboarding/platform';
import type { OnboardingWalletPort } from '../src/onboarding/ports';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

jest.mock('expo-screen-capture', () => ({
  isAvailableAsync: jest.fn(),
  preventScreenCaptureAsync: jest.fn(),
  allowScreenCaptureAsync: jest.fn(),
}));

const getItem = jest.mocked(AsyncStorage.getItem);
const setItem = jest.mocked(AsyncStorage.setItem);
const isAvailable = jest.mocked(ScreenCapture.isAvailableAsync);
const preventCapture = jest.mocked(ScreenCapture.preventScreenCaptureAsync);
const allowCapture = jest.mocked(ScreenCapture.allowScreenCaptureAsync);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

let stored: string | null;

beforeEach(() => {
  jest.clearAllMocks();
  stored = null;
  jest.replaceProperty(Platform, 'OS', 'android');
  getItem.mockImplementation(async () => stored);
  setItem.mockImplementation(async (_key, value) => {
    stored = value;
  });
  isAvailable.mockResolvedValue(true);
  preventCapture.mockResolvedValue(undefined);
  allowCapture.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('préférences non secrètes', () => {
  test('un stockage absent ne crée aucun avancement implicite', async () => {
    const storage = createOnboardingStorage();
    await expect(storage.read()).resolves.toEqual({});
    expect(setItem).not.toHaveBeenCalled();
  });

  test('conserve langue et marqueurs entre deux instances', async () => {
    const first = createOnboardingStorage();
    await first.writeLanguage('fr');
    await first.writeSetup({ completed: false, pendingBackup: true });
    await expect(createOnboardingStorage().read()).resolves.toEqual({
      language: 'fr',
      completed: false,
      pendingBackup: true,
    });
    expect(getItem.mock.calls[0]?.[0]).toBe(setItem.mock.calls[0]?.[0]);
  });

  test('sérialise les écritures concurrentes, même entre deux instances', async () => {
    const firstWrite = deferred<void>();
    const enteredWrite = deferred<void>();
    setItem.mockImplementationOnce(async (_key, value) => {
      enteredWrite.resolve();
      await firstWrite.promise;
      stored = value;
    });

    const languageWrite = createOnboardingStorage().writeLanguage('wo');
    const setupWrite = createOnboardingStorage().writeSetup({
      completed: true,
      pendingBackup: false,
    });
    await enteredWrite.promise;
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledTimes(1);
    firstWrite.resolve();
    await Promise.all([languageWrite, setupWrite]);
    expect(JSON.parse(stored ?? '{}')).toEqual({
      language: 'wo',
      completed: true,
      pendingBackup: false,
    });
  });

  test('une lecture attend l’écriture déjà en cours', async () => {
    const barrier = deferred<void>();
    const enteredWrite = deferred<void>();
    setItem.mockImplementationOnce(async (_key, value) => {
      enteredWrite.resolve();
      await barrier.promise;
      stored = value;
    });
    const storage = createOnboardingStorage();
    const writing = storage.writeLanguage('fr');
    const reading = storage.read();
    await enteredWrite.promise;
    expect(getItem).toHaveBeenCalledTimes(1);
    barrier.resolve();
    await writing;
    await expect(reading).resolves.toEqual({ language: 'fr' });
  });

  test.each([
    '',
    '{',
    'null',
    '[]',
    'true',
    '7',
    '{"language":"unknown"}',
    '{"language":null}',
    '{"completed":"true"}',
    '{"pendingBackup":1}',
    '{"pin":"not-a-pin"}',
    '{"recoveryWords":["not-a-wallet-word"]}',
  ])(
    'reprend une préférence corrompue ou étrangère sans conserver ses données : %s',
    async (raw) => {
      stored = raw;
      const storage = createOnboardingStorage();
      await expect(storage.read()).resolves.toEqual({});
      expect(stored).toBe(raw);
      expect(setItem).not.toHaveBeenCalled();
      await expect(storage.writeLanguage('fr')).resolves.toBeUndefined();
      expect(JSON.parse(stored ?? '{}')).toEqual({ language: 'fr' });
    },
  );

  test('une erreur de lecture remonte sans exposer son message natif', async () => {
    getItem.mockRejectedValueOnce(new Error('private-native-detail'));
    await expect(createOnboardingStorage().read()).rejects.toThrow(
      'ONBOARDING_STORAGE_READ_FAILED',
    );
    expect(setItem).not.toHaveBeenCalled();
  });

  test('une erreur d’écriture remonte et ne bloque pas la tentative suivante', async () => {
    setItem.mockRejectedValueOnce(new Error('private-native-detail'));
    const storage = createOnboardingStorage();
    await expect(storage.writeLanguage('fr')).rejects.toThrow('ONBOARDING_STORAGE_WRITE_FAILED');
    expect(stored).toBeNull();
    await storage.writeSetup({ completed: false, pendingBackup: true });
    await expect(storage.read()).resolves.toEqual({ completed: false, pendingBackup: true });
  });

  test('ne persiste pas une propriété secrète passée hors du contrat', async () => {
    const storage = createOnboardingStorage();
    const unexpected = { completed: false, pendingBackup: true, pin: 'not-a-pin' };
    await expect(storage.writeSetup(unexpected)).rejects.toThrow('ONBOARDING_PREFERENCES_INVALID');
    expect(setItem).not.toHaveBeenCalled();
  });

  test('refuse un marqueur de mauvais type passé hors du contrat', async () => {
    const storage = createOnboardingStorage();
    // @ts-expect-error Les entrées externes ne doivent pas contourner la validation d'exécution.
    await expect(storage.writeSetup({ completed: 'true', pendingBackup: false })).rejects.toThrow(
      'ONBOARDING_PREFERENCES_INVALID',
    );
    expect(setItem).not.toHaveBeenCalled();
  });

  test('la représentation persistée ne contient que les trois champs autorisés', async () => {
    const storage = createOnboardingStorage();
    await storage.writeLanguage('fr');
    await storage.writeSetup({ completed: true, pendingBackup: false });
    expect(Object.keys(JSON.parse(stored ?? '{}')).sort()).toEqual([
      'completed',
      'language',
      'pendingBackup',
    ]);
  });
});

describe('protection de la fenêtre', () => {
  test('un module indisponible ne prétend pas protéger l’écran', async () => {
    isAvailable.mockResolvedValueOnce(false);
    await expect(createScreenProtection().protect()).resolves.toBe(false);
    expect(preventCapture).not.toHaveBeenCalled();
  });

  test('une erreur de détection remonte sans annoncer de succès', async () => {
    isAvailable.mockRejectedValueOnce(new Error('native-unavailable'));
    await expect(createScreenProtection().protect()).rejects.toThrow('native-unavailable');
    expect(preventCapture).not.toHaveBeenCalled();
  });

  test('une pose refusée remonte et permet encore de libérer la protection', async () => {
    preventCapture.mockRejectedValueOnce(new Error('native-refusal'));
    const protection = createScreenProtection();
    await expect(protection.protect()).rejects.toThrow('native-refusal');
    await protection.release();
    expect(allowCapture).toHaveBeenCalledWith(preventCapture.mock.calls[0]?.[0]);
  });

  test('le succès attend la fin effective de la pose native', async () => {
    const nativeResult = deferred<void>();
    const enteredPrevent = deferred<void>();
    preventCapture.mockImplementationOnce(async () => {
      enteredPrevent.resolve();
      await nativeResult.promise;
    });
    let resolved = false;
    const protectedScreen = createScreenProtection()
      .protect()
      .then((value) => {
        resolved = true;
        return value;
      });
    await enteredPrevent.promise;
    expect(resolved).toBe(false);
    nativeResult.resolve();
    await expect(protectedScreen).resolves.toBe(true);
  });

  test('release attend une pose en cours et emploie exactement la même clé', async () => {
    const nativeResult = deferred<void>();
    const enteredPrevent = deferred<void>();
    preventCapture.mockImplementationOnce(async () => {
      enteredPrevent.resolve();
      await nativeResult.promise;
    });
    const protection = createScreenProtection();
    const protecting = protection.protect();
    const releasing = protection.release();
    await enteredPrevent.promise;
    expect(allowCapture).not.toHaveBeenCalled();
    nativeResult.resolve();
    await Promise.all([protecting, releasing]);
    const key = preventCapture.mock.calls[0]?.[0];
    expect(key).toContain('t14');
    expect(allowCapture).toHaveBeenCalledWith(key);
  });

  test('une erreur de libération reste un échec observable', async () => {
    allowCapture.mockRejectedValueOnce(new Error('native-release-failed'));
    await expect(createScreenProtection().release()).rejects.toThrow('native-release-failed');
  });

  test('le Web ne simule ni protection ni accès au module natif', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const protection = createScreenProtection();
    await expect(protection.protect()).resolves.toBe(false);
    await expect(protection.release()).resolves.toBeUndefined();
    expect(isAvailable).not.toHaveBeenCalled();
    expect(preventCapture).not.toHaveBeenCalled();
    expect(allowCapture).not.toHaveBeenCalled();
  });
});

describe('services de plateforme', () => {
  test('le mode par défaut reste indisponible sans inventer de wallet', () => {
    const services = createPlatformServices();
    expect(services.mode).toBe('unavailable');
    expect(services.wallet).toBeUndefined();
  });

  test('un wallet injecté reste un port, sans appel ni création automatiques', () => {
    const wallet: OnboardingWalletPort = {
      state: jest.fn(),
      create: jest.fn(),
      restore: jest.fn(),
      unlock: jest.fn(),
      lock: jest.fn(),
    };
    const services = createPlatformServices(wallet);
    expect(services.mode).toBe('native');
    expect(services.wallet).toBe(wallet);
    expect(wallet.create).not.toHaveBeenCalled();
    expect(wallet.state).not.toHaveBeenCalled();
  });
});
