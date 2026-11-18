import type { HomePayment, HomeResult, HomeWalletPort } from '../home/ports';

/** Copie structurelle du DTO public T23 ; aucun module serveur/SQLite dans l’app. */
export type HistoryWithdrawal = {
  id: string;
  quoteId: string;
  simulation: true;
  operator: 'wave' | 'orange_money';
  recipientId: 'wave-demo-001' | 'orange-demo-001';
  amountXof: number;
  feeXof: number;
  totalXof: number;
  amountSats: number;
  feeSats: number;
  totalSats: number;
  xofPerBtc: number;
  source: 'fixe' | 'kraken';
  quoteCreatedAt: string;
  quoteExpiresAt: string;
  createdAt: string;
  updatedAt: string;
  status: 'en_attente' | 'incertain' | 'reussi' | 'echoue';
  failure: string | null;
};

/** Lecture authentifiée T23 à composer ; aucune clé d’accès dans le composant. */
export interface HistoryWithdrawalPort {
  history(options?: { limit?: number; before?: string }): Promise<
    HomeResult<{
      simulation: true;
      items: HistoryWithdrawal[];
      nextCursor: string | null;
    }>
  >;
}

export type HistoryServices = {
  mode: 'unavailable' | 'preview' | 'native';
  wallet?: Pick<HomeWalletPort, 'state' | 'history' | 'subscribe'>;
  withdrawals?: HistoryWithdrawalPort;
};

export type HistoryEntry =
  | Readonly<{ source: 'wallet'; key: string; payment: Readonly<HomePayment> }>
  | Readonly<{ source: 'bridge_sim'; key: string; withdrawal: Readonly<HistoryWithdrawal> }>;
