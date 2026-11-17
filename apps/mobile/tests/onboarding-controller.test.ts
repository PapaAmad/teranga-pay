import { createOnboardingController } from '../src/onboarding/controller';
import type {
  OnboardingPreferences,
  OnboardingRandomPort,
  OnboardingResult,
  OnboardingServices,
  OnboardingWalletPort,
  OnboardingWalletState,
} from '../src/onboarding/ports';
import { createPreviewServices } from '../src/onboarding/preview';

// Valeur de saisie fictive pour les tests, sans coffre ou compte réel.
const examplePin = '246810';
const exampleWords = Array.from(
  { length: 12 },
  (_, index) => `exemple${String(index + 1).padStart(2, '0')}`,
);
const answers = [exampleWords[1]!, exampleWords[5]!, exampleWords[9]!];

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
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function harness({
  preferences: initialPreferences = {},
  walletState: initialState = 'absent',
  random = { integer: jest.fn((upperExclusive: number) => upperExclusive - 1) },
}: {
  preferences?: OnboardingPreferences;
  walletState?: OnboardingWalletState;
  random?: OnboardingRandomPort;
} = {}) {
  let preferences = { ...initialPreferences };
  let walletState = initialState;
  const wallet: jest.Mocked<OnboardingWalletPort> = {
    state: jest.fn(async () => walletState),
    create: jest.fn<
      ReturnType<OnboardingWalletPort['create']>,
      Parameters<OnboardingWalletPort['create']>
    >(async () => {
      walletState = 'pret';
      return { ok: true, value: { recoveryWords: [...exampleWords] } };
    }),
    restore: jest.fn<
      ReturnType<OnboardingWalletPort['restore']>,
      Parameters<OnboardingWalletPort['restore']>
    >(async () => ({ ok: true, value: undefined })),
    unlock: jest.fn<
      ReturnType<OnboardingWalletPort['unlock']>,
      Parameters<OnboardingWalletPort['unlock']>
    >(async () => {
      walletState = 'pret';
      return { ok: true, value: undefined };
    }),
    lock: jest.fn(async () => {
      if (walletState !== 'absent') walletState = 'verrouille';
    }),
  };
  const storage = {
    read: jest.fn(async () => ({ ...preferences })),
    writeLanguage: jest.fn(async (language: 'fr' | 'wo') => {
      preferences = { ...preferences, language };
    }),
    writeSetup: jest.fn(async (setup: { completed: boolean; pendingBackup: boolean }) => {
      preferences = { ...preferences, ...setup };
    }),
  };
  const protection = {
    protect: jest.fn(async () => true),
    release: jest.fn(async () => undefined),
  };
  const services: OnboardingServices = { mode: 'native', wallet, storage, protection, random };
  const controller = createOnboardingController(services);
  return {
    controller,
    services,
    wallet,
    storage,
    protection,
    getPreferences: () => preferences,
    setWalletState: (state: OnboardingWalletState) => {
      walletState = state;
    },
  };
}

async function reachPinConfirmation(test: ReturnType<typeof harness>) {
  await test.controller.start();
  test.controller.showLanguage();
  await test.controller.selectLanguage('fr');
  test.controller.prepareWallet();
  test.controller.submitPin(examplePin);
  expect(test.controller.getSnapshot().step).toBe('pinConfirm');
}

async function reachWords(test: ReturnType<typeof harness>) {
  await reachPinConfirmation(test);
  await test.controller.confirmPin(examplePin);
  expect(test.controller.getSnapshot().step).toBe('words');
}

describe('onboarding | orchestration', () => {
  it('refuse la réponse aveugle fondée sur les positions successives 1, 2 et 3', async () => {
    const test = harness();
    await reachWords(test);
    test.controller.showVerification();
    const blind = test.controller
      .getSnapshot()
      .verification.map((question, index) => question.choices[index] ?? '');
    await test.controller.verifyBackup(blind);
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'verify',
      error: { code: 'BACKUP_ANSWERS' },
    });
    expect(test.getPreferences().completed).toBe(false);
  });

  it('tire les leurres et leur ordre depuis la source fournie, puis conserve les choix pendant une erreur', async () => {
    const first = harness();
    const second = harness({ random: { integer: () => 0 } });
    await reachWords(first);
    await reachWords(second);
    first.controller.showVerification();
    second.controller.showVerification();
    const initial = first.controller.getSnapshot().verification;
    expect(initial).not.toEqual(second.controller.getSnapshot().verification);
    await first.controller.verifyBackup(['incorrect', 'incorrect', 'incorrect']);
    expect(first.controller.getSnapshot().verification).toEqual(initial);
    for (const question of second.controller.getSnapshot().verification) {
      expect(question.choices).toContain(exampleWords[question.position - 1]);
      expect(new Set(question.choices).size).toBe(3);
    }
  });

  it.each(['absente', 'refusee', 'hors_limite'] as const)(
    'refuse avant création une source aléatoire %s sans repli prévisible',
    async (failure) => {
      const test = harness();
      if (failure === 'absente') test.services.random = undefined as never;
      else
        test.services.random.integer = () => {
          if (failure === 'refusee') throw new Error('native-private-detail');
          return -1;
        };
      await reachPinConfirmation(test);
      await test.controller.confirmPin(examplePin);
      expect(test.controller.getSnapshot()).toMatchObject({
        step: 'error',
        error: { code: 'RANDOM_UNAVAILABLE' },
      });
      expect(test.wallet.create).not.toHaveBeenCalled();
      expect(test.storage.writeSetup).not.toHaveBeenCalled();
      expect(test.controller.getSnapshot().recoveryWords).toEqual([]);
    },
  );

  it.each(['creation', 'deverrouillage'] as const)(
    'transmet le wallet ouvert à la suite après %s sans le reverrouiller au démontage',
    async (journey) => {
      const test = harness(
        journey === 'deverrouillage'
          ? { walletState: 'verrouille', preferences: { completed: true } }
          : {},
      );
      if (journey === 'deverrouillage') {
        await test.controller.start();
        await test.controller.unlock(examplePin);
      } else {
        await reachWords(test);
        test.controller.showVerification();
        await test.controller.verifyBackup(answers);
      }
      expect(test.controller.getSnapshot().step).toBe('complete');
      test.controller.dispose();
      await microtasks();
      expect(test.wallet.lock).not.toHaveBeenCalled();
      expect(await test.wallet.state()).toBe('pret');
    },
  );

  it('attend le chargement des préférences avant de permettre le parcours', async () => {
    const test = harness();
    test.controller.showLanguage();
    test.controller.submitPin(examplePin);
    expect(test.controller.getSnapshot()).toMatchObject({ step: 'welcome', busy: true });
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({ step: 'welcome', busy: false });
  });

  it('crée après protection et persistance, puis ouvre seulement après le test sauvegardé', async () => {
    const test = harness();
    await reachWords(test);
    expect(test.wallet.create).toHaveBeenCalledWith(examplePin);
    expect(test.protection.protect.mock.invocationCallOrder[0]).toBeLessThan(
      test.storage.writeSetup.mock.invocationCallOrder[0]!,
    );
    expect(test.storage.writeSetup.mock.invocationCallOrder[0]).toBeLessThan(
      test.wallet.create.mock.invocationCallOrder[0]!,
    );
    expect(test.controller.getSnapshot().recoveryWords).toEqual(exampleWords);
    expect(test.getPreferences()).toEqual({
      language: 'fr',
      completed: false,
      pendingBackup: true,
    });
    test.controller.showVerification();
    const verification = test.controller.getSnapshot();
    expect(verification.recoveryWords).toEqual([]);
    expect(verification.verification.map((question) => question.position)).toEqual([2, 6, 10]);
    verification.verification.forEach((question, index) => {
      expect(question.choices).toContain(answers[index]);
      expect(new Set(question.choices).size).toBe(question.choices.length);
    });
    await test.controller.verifyBackup(answers);
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'complete',
      recoveryWords: [],
      verification: [],
    });
    expect(test.getPreferences()).toEqual({
      language: 'fr',
      completed: true,
      pendingBackup: false,
    });
    expect(test.protection.release).toHaveBeenCalledTimes(1);
  });

  it('ne stocke ni le PIN ni les mots dans les préférences ou les snapshots ordinaires', async () => {
    const test = harness();
    await reachPinConfirmation(test);
    expect(JSON.stringify(test.controller.getSnapshot())).not.toContain(examplePin);
    await test.controller.confirmPin(examplePin);
    test.controller.showVerification();
    await test.controller.verifyBackup(answers);
    const storedArguments = JSON.stringify({
      language: test.storage.writeLanguage.mock.calls,
      setup: test.storage.writeSetup.mock.calls,
      preferences: test.getPreferences(),
      snapshot: test.controller.getSnapshot(),
    });
    expect(storedArguments).not.toContain(examplePin);
    exampleWords.forEach((word) => expect(storedArguments).not.toContain(word));
    expect(test.wallet.restore).not.toHaveBeenCalled();
  });

  it('refuse le wolof non relu et replie les préférences wolof sur le français', async () => {
    const test = harness({ preferences: { language: 'wo' } });
    await test.controller.start();
    expect(test.controller.getSnapshot().language).toBe('fr');
    test.controller.showLanguage();
    await test.controller.selectLanguage('wo');
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'language',
      error: { code: 'LANGUAGE_UNAVAILABLE' },
    });
    expect(test.storage.writeLanguage).not.toHaveBeenCalled();
    await test.controller.selectLanguage('fr');
    expect(test.controller.getSnapshot().step).toBe('prepare');
  });

  it('bloque avant la saisie du PIN quand aucun adaptateur natif n’est injecté', async () => {
    const test = harness();
    const controller = createOnboardingController({
      ...test.services,
      mode: 'unavailable',
      wallet: undefined,
    });
    await controller.start();
    controller.showLanguage();
    await controller.selectLanguage('fr');
    controller.prepareWallet();
    expect(controller.getSnapshot()).toMatchObject({
      step: 'unavailable',
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
    controller.submitPin(examplePin);
    await controller.confirmPin(examplePin);
    expect(test.wallet.create).not.toHaveBeenCalled();
  });

  it('exige six chiffres puis une confirmation identique sans exposer le premier PIN', async () => {
    const test = harness();
    await test.controller.start();
    test.controller.showLanguage();
    await test.controller.selectLanguage('fr');
    test.controller.prepareWallet();
    test.controller.submitPin('12345');
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'pin',
      error: { code: 'PIN_FORMAT' },
    });
    test.controller.submitPin(examplePin);
    await test.controller.confirmPin('000000');
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'pinConfirm',
      error: { code: 'PIN_MISMATCH' },
    });
    expect(JSON.stringify(test.controller.getSnapshot())).not.toContain(examplePin);
    expect(test.wallet.create).not.toHaveBeenCalled();
    await test.controller.confirmPin(examplePin);
    expect(test.controller.getSnapshot().step).toBe('words');
  });

  it('efface la première saisie quand on revient depuis la confirmation', async () => {
    const test = harness();
    await reachPinConfirmation(test);
    test.controller.back();
    expect(test.controller.getSnapshot().step).toBe('pin');
    await test.controller.confirmPin(examplePin);
    expect(test.wallet.create).not.toHaveBeenCalled();
  });

  it.each([false, 'throw'])('ne crée rien si la protection est refusée (%s)', async (outcome) => {
    const test = harness();
    if (outcome === 'throw')
      test.protection.protect.mockRejectedValueOnce(new Error('erreur native'));
    else test.protection.protect.mockResolvedValueOnce(false);
    await reachPinConfirmation(test);
    await test.controller.confirmPin(examplePin);
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'error',
      error: { code: 'PROTECTION_UNAVAILABLE' },
    });
    expect(test.wallet.create).not.toHaveBeenCalled();
    expect(test.storage.writeSetup).not.toHaveBeenCalled();
    await test.controller.retry();
    expect(test.controller.getSnapshot().step).toBe('pin');
  });

  it('ne crée rien si le marqueur de sauvegarde ne peut pas être écrit', async () => {
    const test = harness();
    test.storage.writeSetup.mockRejectedValueOnce(new Error('disque indisponible'));
    await reachPinConfirmation(test);
    await test.controller.confirmPin(examplePin);
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'error',
      error: { code: 'STORAGE_UNAVAILABLE' },
    });
    expect(test.wallet.create).not.toHaveBeenCalled();
    expect(test.protection.release).toHaveBeenCalled();
  });

  it('rend les refus de stockage de langue récupérables sans commencer le wallet', async () => {
    const test = harness();
    await test.controller.start();
    test.controller.showLanguage();
    test.storage.writeLanguage.mockRejectedValueOnce(new Error('disque'));
    await test.controller.selectLanguage('fr');
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'language',
      error: { code: 'STORAGE_UNAVAILABLE' },
    });
    expect(test.wallet.create).not.toHaveBeenCalled();
    await test.controller.selectLanguage('fr');
    expect(test.controller.getSnapshot().step).toBe('prepare');
  });

  it('absorbe un double appui sur créer et ne lance qu’une création', async () => {
    const test = harness();
    const creation = deferred<OnboardingResult<{ recoveryWords: string[] }>>();
    test.wallet.create.mockReturnValueOnce(creation.promise);
    await reachPinConfirmation(test);
    const first = test.controller.confirmPin(examplePin);
    const duplicate = test.controller.confirmPin(examplePin);
    await microtasks();
    expect(test.wallet.create).toHaveBeenCalledTimes(1);
    creation.resolve({ ok: true, value: { recoveryWords: [...exampleWords] } });
    await Promise.all([first, duplicate]);
    expect(test.controller.getSnapshot().step).toBe('words');
  });

  it('ne recrée jamais automatiquement après un échec ayant déjà créé le coffre', async () => {
    const test = harness();
    test.wallet.create.mockImplementationOnce(async () => {
      test.setWalletState('verrouille');
      return { ok: false, error: { code: 'NETWORK_OFFLINE' } };
    });
    await reachPinConfirmation(test);
    await test.controller.confirmPin(examplePin);
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'blocked',
      error: { code: 'SETUP_INTERRUPTED' },
    });
    expect(test.getPreferences().pendingBackup).toBe(true);
    await test.controller.retry();
    expect(test.controller.getSnapshot().step).toBe('blocked');
    expect(test.wallet.create).toHaveBeenCalledTimes(1);
    expect(test.controller.getSnapshot().recoveryWords).toEqual([]);
  });

  it('permet un nouvel essai explicite seulement après confirmation que le coffre reste absent', async () => {
    const test = harness();
    test.wallet.create.mockResolvedValueOnce({ ok: false, error: { code: 'UNKNOWN' } });
    await reachPinConfirmation(test);
    await test.controller.confirmPin(examplePin);
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'error',
      error: { code: 'UNKNOWN' },
    });
    expect(test.getPreferences().pendingBackup).toBe(false);
    await test.controller.retry();
    expect(test.controller.getSnapshot().step).toBe('pin');
    expect(test.wallet.create).toHaveBeenCalledTimes(1);
  });

  it('ne révèle aucun mot si la réponse de création est mal formée', async () => {
    const test = harness();
    test.wallet.create.mockImplementationOnce(async () => {
      test.setWalletState('pret');
      return { ok: true, value: { recoveryWords: ['exemple01'] } };
    });
    await reachPinConfirmation(test);
    await test.controller.confirmPin(examplePin);
    expect(test.controller.getSnapshot().step).toBe('blocked');
    expect(test.controller.getSnapshot().recoveryWords).toEqual([]);
    expect(test.controller.getSnapshot().verification).toEqual([]);
  });

  it('refuse un test faux et permet de relire la phrase sans recréer le wallet', async () => {
    const test = harness();
    await reachWords(test);
    test.controller.showVerification();
    await test.controller.verifyBackup(['erreur', 'erreur', 'erreur']);
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'verify',
      error: { code: 'BACKUP_ANSWERS' },
    });
    expect(test.storage.writeSetup).toHaveBeenCalledTimes(1);
    test.controller.back();
    expect(test.controller.getSnapshot().recoveryWords).toEqual(exampleWords);
    expect(test.wallet.create).toHaveBeenCalledTimes(1);
  });

  it('garde le test accessible si l’écriture finale échoue et absorbe les doubles confirmations', async () => {
    const test = harness();
    await reachWords(test);
    test.controller.showVerification();
    test.storage.writeSetup.mockRejectedValueOnce(new Error('disque'));
    await test.controller.verifyBackup(answers);
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'verify',
      error: { code: 'STORAGE_UNAVAILABLE' },
    });
    expect(test.getPreferences().completed).toBe(false);
    const first = test.controller.verifyBackup(answers);
    const duplicate = test.controller.verifyBackup(answers);
    await Promise.all([first, duplicate]);
    expect(test.controller.getSnapshot().step).toBe('complete');
    expect(test.storage.writeSetup).toHaveBeenCalledTimes(3);
  });

  it.each(['pret', 'verrouille', 'hors_ligne'] as const)(
    'un wallet %s exige le PIN même avec completed=true',
    async (walletState) => {
      const test = harness({ walletState, preferences: { completed: true, pendingBackup: false } });
      await test.controller.start();
      expect(test.controller.getSnapshot().step).toBe('unlock');
      expect(test.wallet.unlock).not.toHaveBeenCalled();
      test.wallet.unlock.mockResolvedValueOnce({
        ok: false,
        error: { code: 'PIN_LOCKED', retryAfterSeconds: 30 },
      });
      await test.controller.unlock(examplePin);
      expect(test.controller.getSnapshot()).toMatchObject({
        step: 'unlock',
        error: { code: 'PIN_LOCKED', retryAfterSeconds: 30 },
      });
      await test.controller.unlock(examplePin);
      expect(test.controller.getSnapshot().step).toBe('complete');
    },
  );

  it('bloque un coffre existant sans sauvegarde prouvée et un marqueur contradictoire', async () => {
    for (const preferences of [{}, { completed: true, pendingBackup: true }]) {
      const test = harness({ walletState: 'pret', preferences });
      await test.controller.start();
      expect(test.controller.getSnapshot().step).toBe('blocked');
      await test.controller.unlock(examplePin);
      expect(test.wallet.unlock).not.toHaveBeenCalled();
      expect(test.wallet.create).not.toHaveBeenCalled();
    }
  });

  it('ne croit pas une préférence completed si aucun wallet n’existe', async () => {
    const test = harness({ preferences: { completed: true } });
    await test.controller.start();
    expect(test.controller.getSnapshot().step).toBe('welcome');
    expect(test.getPreferences()).toEqual({ completed: false, pendingBackup: false });
  });

  it('masque immédiatement la phrase et bloque la reprise après passage en arrière-plan', async () => {
    const test = harness();
    await reachWords(test);
    test.controller.suspend();
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'blocked',
      recoveryWords: [],
      verification: [],
    });
    // Ne pas lever FLAG_SECURE avant que la vue native soit effectivement masquée.
    expect(test.protection.release).not.toHaveBeenCalled();
    await test.controller.resume();
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'blocked',
      error: { code: 'SETUP_INTERRUPTED' },
    });
    expect(test.wallet.lock).toHaveBeenCalled();
    expect(test.wallet.create).toHaveBeenCalledTimes(1);
  });

  it('ignore les mots reçus après suspension et verrouille aussi le wallet créé tardivement', async () => {
    const test = harness();
    const creation = deferred<OnboardingResult<{ recoveryWords: string[] }>>();
    test.wallet.create.mockImplementationOnce(async () => {
      const result = await creation.promise;
      test.setWalletState('pret');
      return result;
    });
    await reachPinConfirmation(test);
    const pending = test.controller.confirmPin(examplePin);
    await microtasks();
    expect(test.wallet.create).toHaveBeenCalledTimes(1);
    test.controller.suspend();
    await test.controller.resume();
    expect(test.controller.getSnapshot().step).toBe('blocked');
    creation.resolve({ ok: true, value: { recoveryWords: [...exampleWords] } });
    await pending;
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'blocked',
      recoveryWords: [],
      verification: [],
    });
    expect(await test.wallet.state()).toBe('verrouille');
    expect(test.wallet.lock).toHaveBeenCalledTimes(2);
    await test.controller.resume();
    expect(test.controller.getSnapshot().step).toBe('blocked');
  });

  it('ne crée rien si la protection arrive après la suspension', async () => {
    const test = harness();
    const protection = deferred<boolean>();
    test.protection.protect.mockReturnValueOnce(protection.promise);
    await reachPinConfirmation(test);
    const pending = test.controller.confirmPin(examplePin);
    test.controller.suspend();
    protection.resolve(true);
    await pending;
    expect(test.wallet.create).not.toHaveBeenCalled();
    expect(test.storage.writeSetup).not.toHaveBeenCalled();
    expect(test.controller.getSnapshot().recoveryWords).toEqual([]);
  });

  it('reprend une interruption avant create après avoir confirmé que le wallet reste absent', async () => {
    const test = harness();
    const persistMarker = deferred<void>();
    const writeSetup = test.storage.writeSetup.getMockImplementation()!;
    test.storage.writeSetup.mockImplementationOnce(async (setup) => {
      await persistMarker.promise;
      await writeSetup(setup);
    });
    await reachPinConfirmation(test);
    const creating = test.controller.confirmPin(examplePin);
    await microtasks();
    expect(test.storage.writeSetup).toHaveBeenCalledTimes(1);
    expect(test.wallet.create).not.toHaveBeenCalled();

    test.controller.suspend();
    await test.controller.resume();
    expect(test.controller.getSnapshot().step).toBe('blocked');
    persistMarker.resolve();
    await creating;
    expect(test.getPreferences().pendingBackup).toBe(true);
    expect(test.wallet.create).not.toHaveBeenCalled();

    await test.controller.retry();
    expect(test.controller.getSnapshot()).toMatchObject({ step: 'welcome', busy: false });
    expect(test.getPreferences()).toEqual({
      language: 'fr',
      completed: false,
      pendingBackup: false,
    });
    expect(test.wallet.create).not.toHaveBeenCalled();
  });

  it('ne réinitialise pas le marqueur si une création en vol annonce encore absent', async () => {
    const test = harness();
    const creation = deferred<OnboardingResult<{ recoveryWords: string[] }>>();
    test.wallet.create.mockImplementationOnce(async () => {
      const result = await creation.promise;
      test.setWalletState('pret');
      return result;
    });
    await reachPinConfirmation(test);
    const creating = test.controller.confirmPin(examplePin);
    await microtasks();
    expect(await test.wallet.state()).toBe('absent');
    test.controller.suspend();
    await test.controller.resume();
    await test.controller.retry();
    expect(test.controller.getSnapshot().step).toBe('blocked');
    expect(test.getPreferences().pendingBackup).toBe(true);
    expect(test.storage.writeSetup).toHaveBeenCalledTimes(1);
    expect(test.wallet.create).toHaveBeenCalledTimes(1);

    creation.resolve({ ok: true, value: { recoveryWords: [...exampleWords] } });
    await creating;
    await test.controller.retry();
    expect(test.controller.getSnapshot().step).toBe('blocked');
    expect(test.getPreferences().pendingBackup).toBe(true);
    expect(test.wallet.create).toHaveBeenCalledTimes(1);
  });

  it('ne termine pas une session si le déverrouillage répond après la suspension', async () => {
    const test = harness({ walletState: 'verrouille', preferences: { completed: true } });
    const unlocking = deferred<OnboardingResult<void>>();
    test.wallet.unlock.mockReturnValueOnce(unlocking.promise);
    await test.controller.start();
    const pending = test.controller.unlock(examplePin);
    test.controller.suspend();
    unlocking.resolve({ ok: true, value: undefined });
    await pending;
    expect(test.controller.getSnapshot().step).toBe('unlock');
    expect(test.wallet.lock).toHaveBeenCalledTimes(2);
  });

  it('attend la fin et le nettoyage du premier déverrouillage avant un nouvel essai', async () => {
    const test = harness({ walletState: 'verrouille', preferences: { completed: true } });
    const firstUnlock = deferred<OnboardingResult<void>>();
    test.wallet.unlock.mockImplementationOnce(async () => {
      const result = await firstUnlock.promise;
      test.setWalletState('pret');
      return result;
    });
    await test.controller.start();
    const firstAttempt = test.controller.unlock(examplePin);
    await microtasks();
    expect(test.wallet.unlock).toHaveBeenCalledTimes(1);
    test.controller.suspend();
    await test.controller.resume();
    expect(test.controller.getSnapshot()).toMatchObject({ step: 'unlock', busy: true });
    await test.controller.unlock(examplePin);
    expect(test.wallet.unlock).toHaveBeenCalledTimes(1);

    firstUnlock.resolve({ ok: true, value: undefined });
    await firstAttempt;
    expect(test.controller.getSnapshot()).toMatchObject({ step: 'unlock', busy: false });
    expect(await test.wallet.state()).toBe('verrouille');
    await test.controller.unlock(examplePin);
    await microtasks();
    expect(test.controller.getSnapshot().step).toBe('complete');
    expect(await test.wallet.state()).toBe('pret');
    expect(test.wallet.unlock).toHaveBeenCalledTimes(2);
  });

  it('ne laisse pas un verrouillage de suspension tardif refermer une nouvelle ouverture', async () => {
    const test = harness({ walletState: 'pret', preferences: { completed: true } });
    const pendingLock = deferred<void>();
    test.wallet.lock.mockImplementationOnce(async () => {
      await pendingLock.promise;
      test.setWalletState('verrouille');
    });
    await test.controller.start();
    test.controller.suspend();
    await test.controller.resume();
    const opening = test.controller.unlock(examplePin);
    await microtasks();
    expect(test.controller.getSnapshot()).toMatchObject({ step: 'unlock', busy: true });
    expect(test.wallet.unlock).not.toHaveBeenCalled();
    pendingLock.resolve();
    await opening;
    expect(test.controller.getSnapshot().step).toBe('complete');
    expect(await test.wallet.state()).toBe('pret');
  });

  it('reprend le chargement après une suspension sans laisser une ancienne lecture écraser la nouvelle', async () => {
    const test = harness();
    const firstRead = deferred<OnboardingPreferences>();
    test.storage.read.mockReturnValueOnce(firstRead.promise);
    const firstStart = test.controller.start();
    test.controller.suspend();
    await test.controller.resume();
    expect(test.controller.getSnapshot()).toMatchObject({ step: 'welcome', busy: false });
    firstRead.resolve({ completed: true, pendingBackup: true });
    await firstStart;
    expect(test.controller.getSnapshot()).toMatchObject({ step: 'welcome', busy: false });
    test.controller.showLanguage();
    expect(test.controller.getSnapshot().step).toBe('language');
  });

  it('n’ouvre pas un wallet si les préférences ou son état ne peuvent pas être lus', async () => {
    const test = harness();
    test.storage.read.mockRejectedValueOnce(new Error('stockage'));
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'error',
      error: { code: 'STORAGE_UNAVAILABLE' },
    });
    test.wallet.state.mockRejectedValueOnce(new Error('natif'));
    await test.controller.retry();
    expect(test.controller.getSnapshot()).toMatchObject({
      step: 'error',
      error: { code: 'WALLET_UNAVAILABLE' },
    });
    expect(test.wallet.create).not.toHaveBeenCalled();
  });

  it('cesse de notifier après désabonnement et efface son snapshot à la destruction', async () => {
    const test = harness();
    const listener = jest.fn();
    const unsubscribe = test.controller.subscribe(listener);
    await reachWords(test);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    const count = listener.mock.calls.length;
    test.controller.dispose();
    expect(test.controller.getSnapshot().recoveryWords).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(count);
    await test.controller.start();
    expect(test.controller.getSnapshot().step).toBe('blocked');
  });
});

describe('onboarding | aperçu isolé', () => {
  it('ne conserve rien entre deux instances et ne fournit que des jetons non Bitcoin', async () => {
    const services = createPreviewServices();
    expect(services.mode).toBe('preview');
    const created = await services.wallet!.create(examplePin);
    expect(created).toEqual({ ok: true, value: { recoveryWords: exampleWords } });
    await services.storage.writeSetup({ completed: true, pendingBackup: false });
    await services.wallet!.lock();
    expect(await services.wallet!.unlock('000000')).toEqual({
      ok: false,
      error: { code: 'PIN_INVALID' },
    });
    const fresh = createPreviewServices();
    expect(await fresh.storage.read()).toEqual({});
    expect(await fresh.wallet!.state()).toBe('absent');
    expect(await fresh.wallet!.restore(exampleWords, examplePin)).toEqual({
      ok: false,
      error: { code: 'RECOVERY_INVALID' },
    });
  });
});
