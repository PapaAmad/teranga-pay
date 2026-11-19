import { requireOptionalNativeModule } from 'expo-modules-core';

/** Configuration du nœud LDK Node pour le réseau regtest de démonstration. */
export type NodeSettings = {
  /** Serveur Electrum, par exemple `tcp://10.0.2.2:50001` depuis l'émulateur. */
  electrumUrl: string;
  /** Clé publique de `lnd-teranga`, fournisseur de liquidité. */
  peerId: string;
  /** Adresse du pair, par exemple `10.0.2.2:9735`. */
  peerAddress: string;
};

export type PinResult =
  | { ok: true }
  | { ok: false; code: 'PIN_INVALID'; attemptsLeft: number }
  | { ok: false; code: 'PIN_LOCKED'; retryAfterSeconds: number };

export type NativeBalance = {
  /** Total récupérable en fermant les canaux : pas forcément dépensable. */
  lightningSats: number;
  /** Envoyable maintenant : limites du prochain envoi sur les canaux utilisables. */
  spendableSats: number;
  outboundSats: number;
  inboundSats: number;
  onchainSats: number;
  channelsReady: number;
};

export type NativeInvoiceInfo = {
  amountSats: number | null;
  /** Secondes depuis l'époque Unix. */
  expiresAt: number;
  expired: boolean;
  regtest: boolean;
  payee: string;
  /** Empreinte du paiement (hexadécimal), identique à l'`id` du paiement envoyé. */
  paymentHash: string;
  /** Hachage SHA-256 de la description, si la facture n'en porte que le hachage (LUD-06). */
  descriptionHash: string | null;
};

export type NativePayment = {
  id: string;
  direction: 'recu' | 'envoye';
  status: 'en_attente' | 'reussi' | 'echoue';
  amountSats: number;
  feeSats: number;
  /** Secondes depuis l'époque Unix. */
  updatedAt: number;
  /** Raison LDK d'un échec (`ROUTE_NOT_FOUND`, `PAYMENT_EXPIRED`…), sinon null. */
  failureReason?: string | null;
};

export type NativeWalletEvent =
  | { type: 'paiement_recu'; id: string | null; amountSats: number }
  | { type: 'paiement_envoye'; id: string | null }
  | { type: 'paiement_echoue'; id: string | null; reason: string | null }
  | { type: 'canal_pret' }
  | { type: 'canal_ferme' };

/** Fonctions exposées par le module Kotlin `TerangaWallet` (Android). */
export interface NativeWallet {
  exists(): boolean;
  isRunning(): boolean;
  /**
   * Facture au montant exact (millisats) portant le hachage des métadonnées LNURL,
   * pour répondre à une demande reçue sur l'adresse Lightning (T19).
   */
  receiveForDescriptionHash(
    amountMsat: number,
    descriptionHash: string,
    expirySecs: number,
  ): Promise<string>;
  /** SHA-256 (hexadécimal) d'un texte UTF-8 : métadonnées LNURL (T21). */
  sha256Hex(text: string): string;
  /** Bloque (true) ou rétablit (false) captures et enregistrements d'écran. */
  setScreenSecure(secure: boolean): Promise<boolean>;
  create(pin: string): Promise<string[]>;
  restore(words: string[], pin: string): Promise<void>;
  unlock(pin: string, settings: NodeSettings): Promise<PinResult>;
  verifyPin(pin: string): Promise<PinResult>;
  lock(): Promise<void>;
  nodeId(): Promise<string>;
  balance(): Promise<NativeBalance>;
  /** `paymentId` : identifiant du paiement qui réglera cette facture (son hash). */
  receive(
    amountSats: number | null,
    memo: string,
    expirySecs: number,
  ): Promise<{ paymentRequest: string; paymentId: string }>;
  decode(invoice: string): Promise<NativeInvoiceInfo>;
  send(invoice: string, amountSats: number | null, maxFeeSats: number | null): Promise<string>;
  payments(): Promise<NativePayment[]>;
  /** Journal JSON de l'application, `null` s'il n'existe pas encore. */
  journalRead(): Promise<string | null>;
  /** Remplace le journal d'un bloc (écriture atomique). */
  journalWrite(text: string): Promise<void>;
  /** Secrets JSON chiffrés, liés au coffre ; accès seulement après unlock réussi. */
  integrationRead?(): Promise<string | null>;
  /** Écriture atomique (16 KiB UTF-8 maximum), acquitte l'import validé et fusionné. */
  integrationWrite?(text: string): Promise<void>;
  /** DEV : import chiffré durable jusqu'à integrationWrite ; release : null sans lecture. */
  integrationImport?(): Promise<string | null>;
  addListener(
    eventName: 'onWalletEvent',
    listener: (event: NativeWalletEvent) => void,
  ): { remove(): void };
}

/** Module natif, ou `null` hors Android (Expo Go, tests, iOS). */
export const nativeWallet = requireOptionalNativeModule<NativeWallet>('TerangaWallet');
