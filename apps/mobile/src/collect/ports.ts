import type { HomePayment, HomeResult, HomeWalletEvent, HomeWalletState } from '../home/ports';
import type { SendQuote, SendRatePort } from '../send/ports';

/** Forme de la facture T11 ; T22 exige un montant fixe égal à son devis. */
export type CollectInvoice = {
  paymentRequest: string;
  amountSats: number | null;
  amountXof: number | null;
  memo: string | null;
  createdAt: string;
  expiresAt: string;
};

/** Identifiant dont l'adaptateur prouve le lien exact à la facture reçue. */
export type CollectRequest = { invoice: CollectInvoice; paymentId: string };

export interface CollectWalletPort {
  state(): Promise<HomeWalletState>;
  subscribe(listener: (event: HomeWalletEvent) => void): () => void;
}

/**
 * Complément nécessaire avec Salam : T11 ne lie pas Invoice à Payment.id et
 * T15 crée actuellement une facture valable une heure. Ce port n'est pas branché.
 */
export interface CollectInvoicePort {
  /** Respecte le montant et expiresAt du devis, sans facture supplémentaire sur un réessai. */
  create(request: { quote: SendQuote }): Promise<HomeResult<CollectRequest>>;
  /** Lecture de cette facture exacte ; null n'affirme ni règlement ni annulation. */
  lookup(request: {
    paymentId: string;
    paymentRequest: string;
  }): Promise<HomeResult<{ paymentRequest: string; payment: HomePayment | null }>>;
}

export type CollectServices = {
  mode: 'unavailable' | 'preview' | 'native';
  wallet?: CollectWalletPort;
  rates?: SendRatePort;
  invoices?: CollectInvoicePort;
};

/** Le FCFA est le prix demandé au devis figé, pas un taux historique reconstitué. */
export type CollectReceipt = {
  quoteId: string;
  paymentId: string;
  amountXof: number;
  amountSats: number;
  /** Instant où T22 observe la preuve, sans inventer une date de règlement historique. */
  confirmedAt: string;
  /** Confirmation observée après le délai commercial ; pas une date de règlement déduite. */
  late: boolean;
};
