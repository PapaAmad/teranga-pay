/** Frontière de lecture T16, compatible structurellement avec le contrat T11. */
export type HomeWalletState = 'absent' | 'verrouille' | 'synchronisation' | 'pret' | 'hors_ligne';

export type HomeRate = {
  xofPerBtc: number;
  source: 'fixe' | 'kraken';
  fetchedAt: string;
};

export type HomeBalance = {
  spendableSats: number;
  pendingSats: number;
  spendableXof: number | null;
  rate: HomeRate | null;
  updatedAt: string;
};

export type HomePayment = {
  id: string;
  direction: 'recu' | 'envoye';
  status: 'en_attente' | 'reussi' | 'echoue';
  amountSats: number;
  feeSats: number;
  /** Équivalent au moment du paiement, jamais recalculé par l'accueil. */
  amountXof: number | null;
  memo: string | null;
  createdAt: string;
  failure: string | null;
};

export type HomeError = {
  code: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  /** Contrat T11 : avec PAYMENT_TIMEOUT ou PAYMENT_PENDING, l'envoi à suivre. */
  paymentId?: string;
};

export type HomeResult<T> = { ok: true; value: T } | { ok: false; error: HomeError };

export type HomeWalletEvent =
  | { type: 'etat'; state: HomeWalletState }
  | { type: 'paiement'; payment: HomePayment }
  | { type: 'solde'; balance: HomeBalance };

/** Aucune clé, création, saisie de PIN ou fonction de paiement dans cet écran. */
export interface HomeWalletPort {
  state(): Promise<HomeWalletState>;
  balance(): Promise<HomeResult<HomeBalance>>;
  history(options?: { limit?: number; before?: string }): Promise<HomeResult<HomePayment[]>>;
  subscribe(listener: (event: HomeWalletEvent) => void): () => void;
}

export type HomeMode = 'unavailable' | 'preview' | 'native';

export type HomeServices = {
  mode: HomeMode;
  wallet?: HomeWalletPort;
};
