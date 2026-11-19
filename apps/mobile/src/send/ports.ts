import type {
  HomeBalance,
  HomePayment,
  HomeRate,
  HomeResult,
  HomeWalletEvent,
  HomeWalletState,
} from '../home/ports';
import type { RiskPort } from '../risk/ports';

/** Sous-ensemble structurel de Wallet T11/T21 ; le SDK reste sous la responsabilité de Salam. */
export type SendPaymentPreview = {
  kind: 'facture' | 'adresse_lightning';
  destination: string;
  amountSats: number | null;
  maxFeeSats: number;
  amountXof: number | null;
  maxFeeXof: number | null;
  memo: string | null;
  expiresAt: string | null;
  newRecipient: boolean;
};

/** Réponse publique de POST /v1/quotes (T17), dates sérialisées en UTC. */
export type SendQuote = {
  id: string;
  amountXof: number;
  amountSats: number;
  xofPerBtc: number;
  source: HomeRate['source'];
  createdAt: string;
  expiresAt: string;
};

export interface SendWalletPort {
  state(): Promise<HomeWalletState>;
  balance(): Promise<HomeResult<HomeBalance>>;
  preview(destination: string, amountSats?: number): Promise<HomeResult<SendPaymentPreview>>;
  /** Le PIN n'est conservé ni dans le contrôleur, ni dans un snapshot. */
  send(request: {
    destination: string;
    amountSats?: number;
    maxFeeSats?: number;
    /** Prix et échéance exactement présentés avant la confirmation. */
    amountXof?: number;
    xofPerBtc?: number;
    expiresAt?: string;
    pin: string;
  }): Promise<HomeResult<HomePayment>>;
  history(options?: { limit?: number; before?: string }): Promise<HomeResult<HomePayment[]>>;
  subscribe(listener: (event: HomeWalletEvent) => void): () => void;
}

export interface SendRatePort {
  quote(amountXof: number): Promise<HomeResult<SendQuote>>;
}

export type SendServices = {
  mode: 'unavailable' | 'preview' | 'native';
  wallet?: SendWalletPort;
  rates?: SendRatePort;
  /** T26/T27 : analyse sans identité ; une absence reste visible avant le PIN. */
  risk?: RiskPort;
};
