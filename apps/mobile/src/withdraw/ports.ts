import type { HistoryWithdrawal } from '../history/ports';

/** T25 | Contrat public T23 ; aucune clé d’accès ni donnée wallet. */
export type WithdrawOperator = 'wave' | 'orange_money';
export type WithdrawRecipient = 'wave-demo-001' | 'orange-demo-001';
export type WithdrawError = { code: string; withdrawalId?: string };
export type WithdrawResult<T> = { ok: true; value: T } | { ok: false; error: WithdrawError };
export type WithdrawOptions = Readonly<{
  simulation: true;
  currency: 'XOF';
  feeXof: number;
  maxAmountXof: number;
  operators: readonly Readonly<{ operator: WithdrawOperator; recipientId: WithdrawRecipient }>[];
}>;
export type WithdrawBalance = Readonly<{
  simulation: true;
  availableSats: number;
  heldSats: number;
}>;
export type WithdrawQuote = Readonly<{
  id: string;
  simulation: true;
  operator: WithdrawOperator;
  recipientId: WithdrawRecipient;
  amountXof: number;
  feeXof: number;
  totalXof: number;
  amountSats: number;
  feeSats: number;
  totalSats: number;
  xofPerBtc: number;
  source: 'fixe' | 'kraken';
  createdAt: string;
  expiresAt: string;
}>;
export type WithdrawOperation = Readonly<HistoryWithdrawal>;

/** Composé avec la session authentifiée hors du composant ; solde strictement fictif. */
export interface WithdrawBridgePort {
  options(): Promise<WithdrawResult<WithdrawOptions>>;
  balance(): Promise<WithdrawResult<WithdrawBalance>>;
  quote(input: {
    operator: WithdrawOperator;
    recipientId: WithdrawRecipient;
    amountXof: number;
  }): Promise<WithdrawResult<WithdrawQuote>>;
  /** Réessayer avec exactement le même couple, y compris après expiration. */
  confirm(input: { quoteId: string; key: string }): Promise<WithdrawResult<WithdrawOperation>>;
  get(id: string): Promise<WithdrawResult<WithdrawOperation>>;
  /** Lecture seule du résultat opérateur de cette référence. */
  reconcile(id: string): Promise<WithdrawResult<WithdrawOperation>>;
  /** Action volontaire : reprend la même référence, jamais une nouvelle réservation. */
  retry(id: string): Promise<WithdrawResult<WithdrawOperation>>;
}

/** Copie du prix confirmé ; jamais de PIN, jeton, téléphone ou clé de wallet. */
export type WithdrawIntent = Readonly<{
  version: 1;
  key: string;
  quote: WithdrawQuote;
  withdrawalId?: string;
}>;
/**
 * Journal durable, isolé par identité authentifiée par son adaptateur.
 * save refuse d’écraser une autre intention ; clear vérifie la clé attendue.
 * L’écriture doit être acquittée avant le premier POST de confirmation.
 */
export interface WithdrawJournalPort {
  load(): Promise<WithdrawResult<WithdrawIntent | null>>;
  save(intent: WithdrawIntent): Promise<WithdrawResult<void>>;
  clear(expectedKey: string): Promise<WithdrawResult<void>>;
}
export type WithdrawServices = {
  mode: 'unavailable' | 'preview' | 'simulation';
  bridge?: WithdrawBridgePort;
  journal?: WithdrawJournalPort;
  /** UUID fourni par la composition ; aucun identifiant pseudo-aléatoire de secours. */
  createKey?: () => string;
};
