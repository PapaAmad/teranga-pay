import type {
  OnboardingError,
  OnboardingMode,
  OnboardingServices,
  OnboardingWalletState,
} from './ports';

export type OnboardingStep =
  | 'welcome'
  | 'language'
  | 'prepare'
  | 'pin'
  | 'pinConfirm'
  | 'creating'
  | 'words'
  | 'verify'
  | 'finishing'
  | 'complete'
  | 'unlock'
  | 'blocked'
  | 'unavailable'
  | 'error';

export type VerificationQuestion = Readonly<{
  /** Position du mot, à partir de 1. Ce petit test n'est pas une authentification. */
  position: number;
  choices: readonly string[];
}>;

export type OnboardingSnapshot = Readonly<{
  step: OnboardingStep;
  mode: OnboardingMode;
  language: 'fr';
  busy: boolean;
  error: OnboardingError | null;
  /** Éphémère : disponible seulement pendant l'étape « words ». */
  recoveryWords: readonly string[];
  /** Éphémère : disponible seulement pendant l'étape « verify ». */
  verification: readonly VerificationQuestion[];
}>;

export interface OnboardingController {
  getSnapshot(): OnboardingSnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  showLanguage(): void;
  selectLanguage(language: 'fr' | 'wo'): Promise<void>;
  prepareWallet(): void;
  submitPin(pin: string): void;
  confirmPin(pin: string): Promise<void>;
  showVerification(): void;
  verifyBackup(answers: readonly string[]): Promise<void>;
  unlock(pin: string): Promise<void>;
  back(): void;
  retry(): Promise<void>;
  /** Masque et efface les secrets de façon synchrone, avant toute attente. */
  suspend(): void;
  resume(): Promise<void>;
  dispose(): void;
}

const verificationPositions = [2, 6, 10] as const;
const emptyWords: readonly string[] = Object.freeze([]);
const emptyQuestions: readonly VerificationQuestion[] = Object.freeze([]);
const validPin = (pin: string) => /^\d{6}$/.test(pin);
const knownStates = new Set<OnboardingWalletState>([
  'absent',
  'verrouille',
  'synchronisation',
  'pret',
  'hors_ligne',
]);

/**
 * Orchestre l'interface ; ni coffre, ni génération de mots, ni autorisation de paiement.
 * Le marqueur « completed » signifie seulement que le test de sauvegarde a été fait.
 */
export function createOnboardingController(services: OnboardingServices): OnboardingController {
  let snapshot: OnboardingSnapshot = Object.freeze({
    step: 'welcome',
    mode: services.mode,
    language: 'fr',
    busy: true,
    error: null,
    recoveryWords: emptyWords,
    verification: emptyQuestions,
  });
  const listeners = new Set<() => void>();
  let generation = 0;
  let disposed = false;
  let suspended = false;
  let initialized = false;
  let startingToken: number | null = null;
  let creationInFlight = false;
  let unlockInFlight = false;
  let walletQueue: Promise<void> = Promise.resolve();
  let firstPin = '';
  let words: string[] = [];
  let completed = false;
  let pendingBackup = false;
  let retryStep: 'welcome' | 'pin' = 'welcome';
  let questionOrders: { alternatives: number[]; choices: number[] }[] = [];
  let verificationQuestions: readonly VerificationQuestion[] = emptyQuestions;

  const current = (token: number) => !disposed && !suspended && token === generation;

  function shuffledIndices(length: number): number[] {
    const indices = Array.from({ length }, (_, index) => index);
    for (let last = indices.length - 1; last > 0; last -= 1) {
      const selected = services.random.integer(last + 1);
      if (!Number.isSafeInteger(selected) || selected < 0 || selected > last)
        throw new Error('ONBOARDING_RANDOM_UNAVAILABLE');
      [indices[last], indices[selected]] = [indices[selected]!, indices[last]!];
    }
    return indices;
  }

  function questions(): readonly VerificationQuestion[] {
    if (verificationQuestions.length) return verificationQuestions;
    verificationQuestions = Object.freeze(
      verificationPositions.map((position, questionIndex) => {
        const answer = words[position - 1];
        const order = questionOrders[questionIndex];
        if (!answer || !order) return Object.freeze({ position, choices: emptyWords });
        const alternatives = order.alternatives
          .map((index) => words[index])
          .filter((word): word is string => typeof word === 'string' && word !== answer);
        const choices = [answer, ...new Set(alternatives)].slice(0, 3);
        return Object.freeze({
          position,
          choices: Object.freeze(
            order.choices.filter((index) => index < choices.length).map((index) => choices[index]!),
          ),
        });
      }),
    );
    return verificationQuestions;
  }

  function update(
    step: OnboardingStep,
    { busy = false, error = null }: { busy?: boolean; error?: OnboardingError | null } = {},
  ): void {
    if (disposed) return;
    snapshot = Object.freeze({
      step,
      mode: services.mode,
      language: 'fr',
      busy,
      error: error ? Object.freeze({ ...error }) : null,
      recoveryWords: step === 'words' ? Object.freeze([...words]) : emptyWords,
      verification: step === 'verify' ? questions() : emptyQuestions,
    });
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Un écran défaillant ne doit pas interrompre une opération déjà lancée.
      }
    });
  }

  function clearSecrets(): void {
    firstPin = '';
    words = [];
    questionOrders = [];
    verificationQuestions = emptyQuestions;
  }

  async function releaseProtection(): Promise<void> {
    try {
      await services.protection.release();
    } catch {
      // Une protection restée active est restrictive ; elle n'autorise aucun accès.
    }
  }

  function serializeWallet<T>(operation: () => Promise<T>): Promise<T> {
    const result = walletQueue.then(operation);
    walletQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function lockWallet(): Promise<void> {
    await serializeWallet(async () => {
      try {
        await services.wallet?.lock();
      } catch {
        // L'interface reste fermée ; elle exigera encore unlock au retour.
      }
    });
  }

  function safeError(error: OnboardingError): OnboardingError {
    // Ne jamais exposer un objet d'exception natif, son message ou sa pile.
    return {
      code:
        typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
          ? error.code
          : 'UNKNOWN',
      ...(Number.isSafeInteger(error?.attemptsLeft) && (error.attemptsLeft ?? -1) >= 0
        ? { attemptsLeft: error.attemptsLeft }
        : {}),
      ...(Number.isSafeInteger(error?.retryAfterSeconds) && (error.retryAfterSeconds ?? -1) >= 0
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    };
  }

  async function start(): Promise<void> {
    if (disposed || suspended || startingToken === generation) return;
    if (unlockInFlight) {
      // Attendre aussi le verrouillage de nettoyage de l'ancienne session.
      update('unlock', { busy: true });
      return;
    }
    if (creationInFlight) {
      update('blocked', { error: { code: 'SETUP_INTERRUPTED' } });
      return;
    }
    const token = ++generation;
    startingToken = token;
    retryStep = 'welcome';
    clearSecrets();
    update('welcome', { busy: true });
    try {
      const saved = await services.storage.read();
      if (!current(token)) return;
      completed = saved.completed === true;
      pendingBackup = saved.pendingBackup === true;
      if (!services.wallet || services.mode === 'unavailable') {
        update(pendingBackup ? 'blocked' : completed ? 'unavailable' : 'welcome', {
          error: pendingBackup
            ? { code: 'SETUP_INTERRUPTED' }
            : completed
              ? { code: 'SERVICE_UNAVAILABLE' }
              : null,
        });
        return;
      }
      let walletState: OnboardingWalletState;
      try {
        walletState = await services.wallet.state();
      } catch {
        if (current(token)) update('error', { error: { code: 'WALLET_UNAVAILABLE' } });
        return;
      }
      if (!current(token)) return;
      if (!knownStates.has(walletState)) {
        update('error', { error: { code: 'WALLET_UNAVAILABLE' } });
        return;
      }
      if (walletState !== 'absent') {
        update(pendingBackup || !completed ? 'blocked' : 'unlock', {
          error: pendingBackup
            ? { code: 'SETUP_INTERRUPTED' }
            : completed
              ? null
              : { code: 'SETUP_INCOMPLETE' },
        });
        return;
      }
      // Une interruption peut arriver après le marqueur, avant create().
      // Seule l'absence confirmée et aucune création en vol permettent ce reset UI.
      if (completed || pendingBackup) {
        await services.storage.writeSetup({ completed: false, pendingBackup: false });
        if (!current(token)) return;
        completed = false;
        pendingBackup = false;
      }
      update('welcome');
    } catch {
      if (current(token)) update('error', { error: { code: 'STORAGE_UNAVAILABLE' } });
    } finally {
      if (startingToken === token) startingToken = null;
      if (current(token)) initialized = true;
    }
  }

  function available(step: OnboardingStep): boolean {
    return !disposed && !suspended && initialized && !snapshot.busy && snapshot.step === step;
  }

  async function handleCreationFailure(token: number, error: OnboardingError): Promise<void> {
    clearSecrets();
    await releaseProtection();
    if (!current(token)) return;
    try {
      const state = await services.wallet?.state();
      if (!current(token)) return;
      if (state !== 'absent') {
        update('blocked', { error: { code: 'SETUP_INTERRUPTED' } });
        return;
      }
      await services.storage.writeSetup({ completed: false, pendingBackup: false });
      if (!current(token)) return;
      pendingBackup = false;
      retryStep = 'pin';
      update('error', { error: safeError(error) });
    } catch {
      if (current(token)) update('blocked', { error: { code: 'SETUP_INTERRUPTED' } });
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start,
    showLanguage() {
      if (available('welcome')) update('language');
    },
    async selectLanguage(language) {
      if (!available('language')) return;
      if (language !== 'fr') {
        update('language', { error: { code: 'LANGUAGE_UNAVAILABLE' } });
        return;
      }
      const token = generation;
      update('language', { busy: true });
      try {
        await services.storage.writeLanguage('fr');
        if (current(token)) update('prepare');
      } catch {
        if (current(token)) update('language', { error: { code: 'STORAGE_UNAVAILABLE' } });
      }
    },
    prepareWallet() {
      if (!available('prepare')) return;
      if (!services.wallet || services.mode === 'unavailable') {
        update('unavailable', { error: { code: 'SERVICE_UNAVAILABLE' } });
        return;
      }
      update('pin');
    },
    submitPin(pin) {
      if (!available('pin')) return;
      if (!validPin(pin)) {
        update('pin', { error: { code: 'PIN_FORMAT' } });
        return;
      }
      firstPin = pin;
      update('pinConfirm');
    },
    async confirmPin(pin) {
      const wallet = services.wallet;
      if (!available('pinConfirm') || !wallet) return;
      if (!validPin(pin)) {
        update('pinConfirm', { error: { code: 'PIN_FORMAT' } });
        return;
      }
      if (pin !== firstPin) {
        update('pinConfirm', { error: { code: 'PIN_MISMATCH' } });
        return;
      }
      const token = generation;
      const pinForCreation = firstPin;
      firstPin = '';
      creationInFlight = true;
      retryStep = 'pin';
      update('creating', { busy: true });
      try {
        try {
          // Vérifier l'aléa et préparer les permutations avant toute création de coffre.
          questionOrders = verificationPositions.map(() => ({
            alternatives: shuffledIndices(12),
            choices: shuffledIndices(3),
          }));
        } catch {
          clearSecrets();
          update('error', { error: { code: 'RANDOM_UNAVAILABLE' } });
          return;
        }
        let protectedScreen = false;
        try {
          protectedScreen = await services.protection.protect();
        } catch {
          // Toute protection non confirmée bloque la création.
        }
        if (!current(token)) return;
        if (protectedScreen !== true) {
          update('error', { error: { code: 'PROTECTION_UNAVAILABLE' } });
          await releaseProtection();
          return;
        }
        try {
          await services.storage.writeSetup({ completed: false, pendingBackup: true });
        } catch {
          if (current(token)) update('error', { error: { code: 'STORAGE_UNAVAILABLE' } });
          await releaseProtection();
          return;
        }
        pendingBackup = true;
        if (!current(token)) return;
        let result;
        try {
          result = await serializeWallet(() =>
            current(token) ? wallet.create(pinForCreation) : Promise.resolve(null),
          );
        } catch {
          await handleCreationFailure(token, { code: 'UNKNOWN' });
          return;
        }
        if (!current(token)) return;
        if (!result || typeof result !== 'object') {
          await handleCreationFailure(token, { code: 'UNKNOWN' });
          return;
        }
        if (!result.ok) {
          await handleCreationFailure(token, result.error);
          return;
        }
        const recoveryWords = result.value?.recoveryWords;
        if (
          !Array.isArray(recoveryWords) ||
          recoveryWords.length !== 12 ||
          recoveryWords.some((word) => typeof word !== 'string' || !/^[a-z0-9]{1,64}$/.test(word))
        ) {
          await handleCreationFailure(token, { code: 'RECOVERY_UNAVAILABLE' });
          return;
        }
        words = [...recoveryWords];
        update('words');
      } finally {
        creationInFlight = false;
        if (!current(token)) {
          await lockWallet();
          // En arrière-plan, garder le drapeau restrictif : le prochain rendu
          // React n'est pas une preuve que l'ancienne vue native est déjà masquée.
          if (disposed) await releaseProtection();
        }
      }
    },
    showVerification() {
      if (available('words') && words.length === 12) update('verify');
    },
    async verifyBackup(answers) {
      if (!available('verify')) return;
      if (
        answers.length !== verificationPositions.length ||
        answers.some((answer, index) => {
          const position = verificationPositions[index];
          return (
            position === undefined ||
            typeof answer !== 'string' ||
            answer.trim().toLowerCase() !== words[position - 1]
          );
        })
      ) {
        update('verify', { error: { code: 'BACKUP_ANSWERS' } });
        return;
      }
      const token = generation;
      update('finishing', { busy: true });
      try {
        await services.storage.writeSetup({ completed: true, pendingBackup: false });
        if (!current(token)) return;
        completed = true;
        pendingBackup = false;
        clearSecrets();
        await releaseProtection();
        if (current(token)) update('complete');
      } catch {
        if (current(token)) update('verify', { error: { code: 'STORAGE_UNAVAILABLE' } });
      }
    },
    async unlock(pin) {
      const wallet = services.wallet;
      if (!available('unlock') || !wallet || unlockInFlight) return;
      if (!validPin(pin)) {
        update('unlock', { error: { code: 'PIN_FORMAT' } });
        return;
      }
      const token = generation;
      unlockInFlight = true;
      update('unlock', { busy: true });
      try {
        const result = await serializeWallet(() =>
          current(token) ? wallet.unlock(pin) : Promise.resolve(null),
        );
        if (!current(token)) return;
        if (!result) {
          update('unlock', { error: { code: 'UNKNOWN' } });
          return;
        }
        update(result.ok ? 'complete' : 'unlock', {
          error: result.ok ? null : safeError(result.error),
        });
      } catch {
        if (current(token)) update('unlock', { error: { code: 'UNKNOWN' } });
      } finally {
        const stale = !current(token);
        if (stale) await lockWallet();
        unlockInFlight = false;
        if (stale && !disposed && !suspended) await start();
      }
    },
    back() {
      if (disposed || suspended || snapshot.busy) return;
      switch (snapshot.step) {
        case 'language':
          update('welcome');
          break;
        case 'prepare':
          update('language');
          break;
        case 'pin':
          firstPin = '';
          update('prepare');
          break;
        case 'pinConfirm':
          firstPin = '';
          update('pin');
          break;
        case 'verify':
          update('words');
          break;
      }
    },
    async retry() {
      if (disposed || suspended || snapshot.busy) return;
      if (snapshot.step === 'error' && retryStep === 'pin' && !pendingBackup) {
        clearSecrets();
        update('pin');
      } else if (['blocked', 'unavailable', 'error'].includes(snapshot.step)) {
        await start();
      }
    },
    suspend() {
      if (disposed || suspended) return;
      suspended = true;
      generation += 1;
      const interrupted = pendingBackup || creationInFlight || words.length > 0;
      clearSecrets();
      update(interrupted ? 'blocked' : completed ? 'unlock' : 'welcome', {
        error: interrupted ? { code: 'SETUP_INTERRUPTED' } : null,
      });
      void lockWallet();
    },
    async resume() {
      if (disposed) return;
      suspended = false;
      await start();
    },
    dispose() {
      if (disposed) return;
      const finished = snapshot.step === 'complete' && !suspended;
      generation += 1;
      clearSecrets();
      update('blocked', { error: { code: 'SESSION_INTERRUPTED' } });
      disposed = true;
      listeners.clear();
      // La route suivante reçoit la même session après une fin validée. Les
      // interruptions et les réponses tardives conservent leur verrouillage.
      if (!finished) void lockWallet();
      void releaseProtection();
    },
  };
}
