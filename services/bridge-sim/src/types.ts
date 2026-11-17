/** T23 | Données exclusivement fictives ; aucun accès au wallet mobile. */
export type Operator = 'wave' | 'orange_money';
export type Scenario = 'success' | 'declined' | 'timeout_after_success' | 'unavailable';
export type WithdrawalStatus = 'en_attente' | 'incertain' | 'reussi' | 'echoue';

export class BridgeError extends Error {
  readonly code: string;
  readonly withdrawalId?: string;
  constructor(code: string, metadata: { withdrawalId?: string } = {}) {
    super(code);
    this.name = 'BridgeError';
    this.code = code;
    this.withdrawalId = metadata.withdrawalId;
  }
}

export type BridgeQuoteInput = {
  id: string;
  operator: Operator;
  recipientId: string;
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
};
export type BridgeQuote = Readonly<BridgeQuoteInput & { simulation: true }>;
export type BridgeBalance = Readonly<{
  simulation: true;
  availableSats: number;
  heldSats: number;
}>;
export type Withdrawal = Readonly<
  Omit<BridgeQuoteInput, 'id' | 'createdAt' | 'expiresAt'> & {
    id: string;
    quoteId: string;
    simulation: true;
    quoteCreatedAt: string;
    quoteExpiresAt: string;
    createdAt: string;
    updatedAt: string;
    status: WithdrawalStatus;
    failure: string | null;
  }
>;

export type BridgeHistoryOptions = Readonly<{ limit?: number; before?: string }>;
export type BridgeHistoryPage = Readonly<{
  simulation: true;
  items: readonly Withdrawal[];
  /** Identifiant du dernier élément rendu, ou null lorsque cette page termine la liste. */
  nextCursor: string | null;
}>;

export type BridgeProviderResult = Readonly<{
  simulation: true;
  operationId: string;
  operator: Operator;
  recipientId: string;
  amountXof: number;
  status: 'reussi' | 'echoue';
  failure: string | null;
}>;

export interface BridgeProvider {
  /** Idempotent par withdrawal.id et charge utile figée ; requis aussi lors d’une reprise explicite. */
  submit(withdrawal: Withdrawal): Promise<BridgeProviderResult>;
  lookup(operationId: string): Promise<BridgeProviderResult | null>;
}

export interface BridgeStore {
  seedAccount(owner: string, availableSats: number): void;
  offer(owner: string, quote: BridgeQuoteInput): BridgeQuote;
  getQuote(owner: string, id: string): BridgeQuote | null;
  balance(owner: string): BridgeBalance;
  close(): void;
  /** Réservation atomique avant tout appel au simulateur. */
  reserve(
    owner: string,
    key: string,
    quoteId: string,
  ): { withdrawal: Withdrawal; replayed: boolean };
  find(owner: string, id: string): Withdrawal | null;
  /** Lecture seule du journal de ce propriétaire, de la création la plus récente à la plus ancienne. */
  history(owner: string, options?: BridgeHistoryOptions): BridgeHistoryPage;
  settle(
    id: string,
    result: 'reussi' | 'echoue' | 'incertain',
    failure?: string | null,
  ): Withdrawal;
  /** Journal opérateur fictif durable, utilisé uniquement par le simulateur. */
  recordProvider(withdrawal: Withdrawal, status: 'reussi' | 'echoue'): BridgeProviderResult;
  lookupProvider(id: string): BridgeProviderResult | null;
}

export interface BridgeService {
  create(
    owner: string,
    key: string,
    quoteId: string,
  ): Promise<{ withdrawal: Withdrawal; replayed: boolean }>;
  get(owner: string, id: string): Withdrawal | null;
  history(owner: string, options?: BridgeHistoryOptions): BridgeHistoryPage;
  reconcile(owner: string, id: string): Promise<Withdrawal | null>;
  /** Reprend volontairement la même opération, sans nouvelle réservation ni nouvelle identité. */
  retry(owner: string, id: string): Promise<Withdrawal | null>;
}
