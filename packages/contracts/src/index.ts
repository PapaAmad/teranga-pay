/**
 * Contrat T11 entre les écrans (PAN) et la logique wallet (Salam).
 *
 * Règles communes :
 * - Montants en nombres entiers avec unité explicite dans le nom : `...Sats`, `...Xof`.
 * - Aucune fonction ne lève d'exception pour un cas prévu : elles renvoient un `Result`.
 * - Aucun texte d'interface : les erreurs sont des codes que l'application traduit.
 * - Dates au format ISO 8601 (UTC).
 */

export const SATS_PER_BTC = 100_000_000;

/** Taux BTC/FCFA tel que fourni par l'API (T17). */
export type RateInfo = {
  /** FCFA entiers pour 1 BTC. */
  xofPerBtc: number;
  source: 'fixe' | 'kraken';
  fetchedAt: string;
};

export type WalletState =
  /** Aucun wallet sur ce téléphone : afficher l'onboarding. */
  | 'absent'
  /** Wallet présent, PIN demandé. */
  | 'verrouille'
  /** Déverrouillé, connexion au réseau en cours. */
  | 'synchronisation'
  /** Utilisable. */
  | 'pret'
  /** Déverrouillé mais sans réseau : solde et historique locaux seulement. */
  | 'hors_ligne';

export type Balance = {
  /** Sats dépensables tout de suite en Lightning. */
  spendableSats: number;
  /** Sats en cours de confirmation, pas encore dépensables. */
  pendingSats: number;
  /** Équivalent FCFA de `spendableSats`, ou `null` si aucun taux n'est connu. */
  spendableXof: number | null;
  rate: RateInfo | null;
  updatedAt: string;
};

export type Invoice = {
  /** Facture BOLT11 à afficher en QR et à partager. */
  paymentRequest: string;
  /**
   * Identifiant du `Payment` qui réglera exactement cette facture. Le conserver
   * pour relire la demande avec `lookupInvoice`, même après redémarrage : ni le
   * montant ni une variation du solde ne prouvent le paiement d'une vente.
   */
  paymentId: string;
  /** `null` : le payeur choisit le montant. */
  amountSats: number | null;
  /** Montant FCFA du devis T17 qui a servi à la créer, le cas échéant. */
  amountXof: number | null;
  memo: string | null;
  createdAt: string;
  expiresAt: string;
};

export type DestinationKind = 'facture' | 'adresse_lightning';

/** Ce qu'il faut montrer avant la confirmation par PIN. */
export type PaymentPreview = {
  kind: DestinationKind;
  destination: string;
  /** `null` si la facture ne fixe pas de montant : l'écran le demande. */
  amountSats: number | null;
  /** Frais maximum acceptés, affichés avant confirmation. */
  maxFeeSats: number;
  amountXof: number | null;
  maxFeeXof: number | null;
  memo: string | null;
  /** `null` pour une adresse Lightning, qui n'expire pas. */
  expiresAt: string | null;
  /** Vrai si l'on n'a jamais payé cette destination : déclenche l'alerte T27. */
  newRecipient: boolean;
};

export type PaymentDirection = 'recu' | 'envoye';
export type PaymentStatus = 'en_attente' | 'reussi' | 'echoue';

export type Payment = {
  id: string;
  direction: PaymentDirection;
  status: PaymentStatus;
  amountSats: number;
  /** Frais réellement payés (envoi) ; 0 pour une réception. */
  feeSats: number;
  /**
   * FCFA au taux du moment du paiement, conservé pour l'historique et les reçus.
   * Pour une facture issue d'un devis T17, c'est le montant FCFA du devis.
   * `null` si aucun taux n'était connu : jamais recalculé au cours actuel.
   */
  amountXof: number | null;
  memo: string | null;
  createdAt: string;
  /** Code d'échec quand `status` vaut `echoue`. */
  failure: WalletErrorCode | null;
};

export type WalletEvent =
  | { type: 'etat'; state: WalletState }
  | { type: 'paiement'; payment: Payment }
  | { type: 'solde'; balance: Balance };

export const walletErrorCodes = [
  /** Le wallet doit être déverrouillé par PIN. */
  'WALLET_LOCKED',
  /** Un wallet existe déjà : `create` refusé. */
  'WALLET_EXISTS',
  'WALLET_ABSENT',
  /** PIN incorrect ; voir `attemptsLeft`. */
  'PIN_INVALID',
  /** Trop d'essais : attendre `retryAfterSeconds`. */
  'PIN_LOCKED',
  /** Format de PIN refusé (6 chiffres). */
  'PIN_FORMAT',
  /** Phrase de récupération invalide à la restauration. */
  'RECOVERY_INVALID',
  'AMOUNT_INVALID',
  'INSUFFICIENT_FUNDS',
  /** Ni facture BOLT11 ni adresse Lightning lisible. */
  'DESTINATION_INVALID',
  /** Facture d'un autre réseau (mainnet en démo regtest, par exemple). */
  'DESTINATION_WRONG_NETWORK',
  'INVOICE_EXPIRED',
  /** Facture déjà payée : rien n'est parti cette fois, refus sans risque. */
  'ALREADY_PAID',
  'NO_ROUTE',
  /**
   * Issue inconnue après le délai d'attente : le paiement peut encore aboutir.
   * `paymentId` permet de le suivre (`subscribe`, `history`). Ne pas renvoyer.
   */
  'PAYMENT_TIMEOUT',
  /**
   * Un envoi identique (même destination, même montant) est encore en cours :
   * ne pas en lancer un second tant que le premier n'a pas abouti ou échoué.
   */
  'PAYMENT_PENDING',
  /** Pas de réseau : action impossible maintenant, réessayer plus tard. */
  'NETWORK_OFFLINE',
  /** Frais nécessaires supérieurs à `maxFeeSats`. */
  'FEE_TOO_HIGH',
  /** Durée de validité de facture hors bornes (`invoiceExpiryBounds`). */
  'EXPIRY_INVALID',
  'UNKNOWN',
] as const;

export type WalletErrorCode = (typeof walletErrorCodes)[number];

export type WalletError = {
  code: WalletErrorCode;
  /** Pour `PIN_INVALID`. */
  attemptsLeft?: number;
  /** Pour `PIN_LOCKED`. */
  retryAfterSeconds?: number;
  /**
   * Pour `PAYMENT_TIMEOUT` et `PAYMENT_PENDING` : identifiant du paiement parti
   * dont l'issue n'est pas encore connue. Le même `id` arrivera dans un événement
   * `paiement` (réussi ou échoué) et dans `history`. Absent si rien n'a atteint
   * le nœud.
   */
  paymentId?: string;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: WalletError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(
  code: WalletErrorCode,
  extra: Omit<WalletError, 'code'> = {},
): Result<T> => ({
  ok: false,
  error: { code, ...extra },
});

/** Interface que la logique wallet implémente et que les écrans utilisent. */
export interface Wallet {
  state(): Promise<WalletState>;
  /** Crée le wallet, protège ses clés par le PIN et renvoie les 12 mots à noter une seule fois. */
  create(pin: string): Promise<Result<{ recoveryWords: string[] }>>;
  restore(recoveryWords: string[], pin: string): Promise<Result<void>>;
  unlock(pin: string): Promise<Result<void>>;
  lock(): Promise<void>;
  balance(): Promise<Result<Balance>>;
  /**
   * Crée une facture ; `amountSats` vient d'un devis T17 quand le montant est saisi
   * en FCFA. `expiresInSecs` borne réellement la facture (par exemple à l'échéance
   * du devis) : passé ce délai, elle n'est plus payable. Défaut : une heure.
   */
  receive(request: {
    amountSats?: number;
    amountXof?: number;
    memo?: string;
    expiresInSecs?: number;
  }): Promise<Result<Invoice>>;
  /**
   * Relit une facture créée par ce wallet et son règlement éventuel, même après
   * redémarrage. `payment` vaut `null` tant que rien n'est reçu ; un paiement
   * tardif reste rattaché. `null` si l'identifiant est inconnu.
   */
  lookupInvoice(
    paymentId: string,
  ): Promise<Result<{ invoice: Invoice; payment: Payment | null } | null>>;
  /** Décode une destination scannée ou collée, sans rien payer. */
  preview(destination: string, amountSats?: number): Promise<Result<PaymentPreview>>;
  /**
   * Paie après confirmation : le PIN est revérifié à chaque envoi. `maxFeeSats`
   * reprend le maximum affiché par `preview` ; le vrai wallet le transmet comme
   * limite de frais de route et renvoie `FEE_TOO_HIGH` s'il faut payer plus.
   */
  send(request: {
    destination: string;
    amountSats?: number;
    maxFeeSats?: number;
    pin: string;
  }): Promise<Result<Payment>>;
  /**
   * Historique du plus récent au plus ancien. `before` est l'`id` du dernier
   * paiement de la page précédente : la page suivante commence juste après lui.
   */
  history(options?: { limit?: number; before?: string }): Promise<Result<Payment[]>>;
  /** Abonnement aux changements ; renvoie la fonction de désabonnement. */
  subscribe(listener: (event: WalletEvent) => void): () => void;
}

/** Bornes de `receive({ expiresInSecs })`, en secondes. */
export const invoiceExpiryBounds = { min: 60, max: 3_600, default: 3_600 } as const;

/** Vrai si la durée de validité demandée est un entier dans les bornes. */
export function isValidInvoiceExpiry(seconds: number): boolean {
  return (
    Number.isSafeInteger(seconds) &&
    seconds >= invoiceExpiryBounds.min &&
    seconds <= invoiceExpiryBounds.max
  );
}

/** Règle du PIN : exactement 6 chiffres. */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} doit être un entier positif ou nul`);
  }
}

/**
 * FCFA → sats, arrondi au sat supérieur : celui qui demande un montant FCFA ne
 * reçoit jamais moins. Même règle que l'API T17.
 */
export function xofToSats(amountXof: number, xofPerBtc: number): number {
  assertNonNegativeInteger(amountXof, 'amountXof');
  assertNonNegativeInteger(xofPerBtc, 'xofPerBtc');
  if (xofPerBtc === 0) throw new RangeError('xofPerBtc doit être positif');
  const rate = BigInt(xofPerBtc);
  return Number((BigInt(amountXof) * BigInt(SATS_PER_BTC) + rate - 1n) / rate);
}

/**
 * Sats → FCFA pour l'affichage, arrondi au FCFA inférieur : on n'affiche jamais
 * un solde plus élevé que ce que l'on peut réellement obtenir.
 */
export function satsToXof(amountSats: number, xofPerBtc: number): number {
  assertNonNegativeInteger(amountSats, 'amountSats');
  assertNonNegativeInteger(xofPerBtc, 'xofPerBtc');
  return Number((BigInt(amountSats) * BigInt(xofPerBtc)) / BigInt(SATS_PER_BTC));
}

/** Reconnaît le type de destination sans la valider complètement (le wallet le fait). */
export function detectDestination(input: string): DestinationKind | null {
  const value = input.trim().replace(/^lightning:/i, '');
  if (/^ln(bc|tb|bcrt)[0-9a-z]+$/i.test(value)) return 'facture';
  // LUD-16 autorise a-z, 0-9, « - », « _ », « . » et « + » avant le @.
  if (/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return 'adresse_lightning';
  return null;
}
