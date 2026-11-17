/** Frontière T14 : compatible structurellement avec le contrat Wallet T11. */
export type OnboardingWalletState =
  'absent' | 'verrouille' | 'synchronisation' | 'pret' | 'hors_ligne';

export type OnboardingError = {
  code: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
};

export type OnboardingResult<T> = { ok: true; value: T } | { ok: false; error: OnboardingError };

export interface OnboardingWalletPort {
  state(): Promise<OnboardingWalletState>;
  create(pin: string): Promise<OnboardingResult<{ recoveryWords: string[] }>>;
  restore(words: string[], pin: string): Promise<OnboardingResult<void>>;
  unlock(pin: string): Promise<OnboardingResult<void>>;
  lock(): Promise<void>;
}

/** Préférences non secrètes seulement : jamais de PIN ni de phrase. */
export type OnboardingPreferences = {
  language?: unknown;
  completed?: boolean;
  pendingBackup?: boolean;
};

export interface OnboardingStoragePort {
  read(): Promise<OnboardingPreferences>;
  writeLanguage(language: 'fr' | 'wo'): Promise<void>;
  writeSetup(setup: { completed: boolean; pendingBackup: boolean }): Promise<void>;
}

export interface OnboardingProtectionPort {
  /** Confirmer que la protection est réellement posée avant de révéler des mots. */
  protect(): Promise<boolean>;
  release(): Promise<void>;
}

/** Aléa du quiz d'interface, distinct de la génération des clés du wallet. */
export interface OnboardingRandomPort {
  /** Entier uniforme entre zéro inclus et upperExclusive exclu. Aucun repli prévisible. */
  integer(upperExclusive: number): number;
}

export type OnboardingMode = 'unavailable' | 'preview' | 'native';

export type OnboardingServices = {
  mode: OnboardingMode;
  wallet?: OnboardingWalletPort;
  storage: OnboardingStoragePort;
  protection: OnboardingProtectionPort;
  random: OnboardingRandomPort;
};
