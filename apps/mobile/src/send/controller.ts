import type {
  HomeBalance,
  HomeError,
  HomePayment,
  HomeWalletEvent,
  HomeWalletState,
} from '../home/ports';
import { isReceiveAddress } from '../receive/controller';
import { buildRiskCheck, readRiskAssessment } from '../risk/assessment';
import type { RiskAssessment } from '../risk/ports';
import { readWithDeadline, readFailure, startPendingWatch } from '../reliability/read';
import type { SendPaymentPreview, SendQuote, SendServices, SendWalletPort } from './ports';

export type SendPhase =
  | 'idle'
  | 'loading'
  | 'destination'
  | 'amount'
  | 'quoting'
  | 'review'
  | 'riskChecking'
  | 'riskWarning'
  | 'riskUnavailable'
  | 'pin'
  | 'sending'
  | 'success'
  | 'pending'
  | 'failed'
  | 'unknown'
  | 'locked'
  | 'absent'
  | 'offline'
  | 'unavailable'
  | 'error'
  | 'suspended';
export type SendSnapshot = Readonly<{
  mode: SendServices['mode'];
  phase: SendPhase;
  walletState: HomeWalletState | null;
  destination: string;
  preview: Readonly<SendPaymentPreview> | null;
  quote: Readonly<SendQuote> | null;
  balance: Readonly<HomeBalance> | null;
  payment: Readonly<HomePayment> | null;
  error: HomeError | null;
  busy: boolean;
  /** Un appel de paiement a été remis au wallet : aucun nouvel envoi implicite. */
  committed: boolean;
  validUntil: string | null;
  totalMaxSats: number | null;
  totalMaxXof: number | null;
  retryAt: number | null;
  canRefreshPayment: boolean;
  risk: RiskAssessment | null;
}>;

export interface SendController {
  getSnapshot(): SendSnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  refresh(): Promise<void>;
  setDestination(input: string): void;
  inspect(input?: string): Promise<void>;
  quoteAmount(input: string): Promise<void>;
  requestPin(): Promise<void>;
  acknowledgeRisk(): void;
  cancelRisk(): void;
  confirm(pin: string): Promise<void>;
  edit(): void;
  refreshPayment(): Promise<void>;
  suspend(): void;
  resume(): Promise<void>;
  dispose(): void;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
const nullableInteger = (value: unknown) => value === null || integer(value);
const states = new Set(['absent', 'verrouille', 'synchronisation', 'pret', 'hors_ligne']);
const isState = (value: unknown): value is HomeWalletState =>
  typeof value === 'string' && states.has(value);
const code = (value: string): HomeError => Object.freeze({ code: value });
const iso = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z');
function safeText(value: unknown, max: number): value is string {
  if (typeof value !== 'string' || value.length > max) return false;
  for (const character of value) {
    const point = character.charCodeAt(0);
    if (
      point < 32 ||
      (point >= 127 && point <= 159) ||
      (point >= 0x202a && point <= 0x202e) ||
      (point >= 0x2066 && point <= 0x2069)
    )
      return false;
  }
  return true;
}

/** Filtre de format uniquement. Le décodage cryptographique et regtest appartient à T21. */
export function normalizeSendDestination(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 8192) return null;
  const value = input.trim().replace(/^lightning:/i, '');
  if (isReceiveAddress(value as unknown)) return value.toLowerCase();
  if (
    !/^lnbcrt[0-9a-z]+$/i.test(value) ||
    (value !== value.toLowerCase() && value !== value.toUpperCase())
  )
    return null;
  return value.toLowerCase();
}

/** FCFA entiers, sans séparateur ambigu, signe, décimale, exposant ou dépassement T17. */
export function parseSendAmount(input: unknown): number | null {
  if (typeof input !== 'string' || !/^[0-9]{1,7}$/.test(input.trim())) return null;
  const amount = Number(input.trim());
  return integer(amount, 1) && amount <= 5_000_000 ? amount : null;
}

function readError(value: unknown): HomeError | null {
  if (
    !record(value) ||
    value.ok !== false ||
    !record(value.error) ||
    typeof value.error.code !== 'string' ||
    !/^[A-Z][A-Z0-9_]{0,63}$/.test(value.error.code)
  )
    return null;
  const source = value.error;
  return Object.freeze({
    code: source.code as string,
    ...(integer(source.attemptsLeft) ? { attemptsLeft: source.attemptsLeft } : {}),
    ...(integer(source.retryAfterSeconds, 1)
      ? { retryAfterSeconds: source.retryAfterSeconds }
      : {}),
    ...(typeof source.paymentId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(source.paymentId)
      ? { paymentId: source.paymentId }
      : {}),
  });
}

/** Contrat T11 : un envoi parti mais sans issue connue porte l'identifiant à suivre. */
const trackedErrors = new Set(['PAYMENT_TIMEOUT', 'PAYMENT_PENDING']);

function readBalance(value: unknown): HomeBalance | null {
  if (!record(value) || value.ok !== true || !record(value.value)) return null;
  const b = value.value;
  if (
    !integer(b.spendableSats) ||
    !integer(b.pendingSats) ||
    !nullableInteger(b.spendableXof) ||
    !iso(b.updatedAt)
  )
    return null;
  if (
    b.rate !== null &&
    (!record(b.rate) ||
      !integer(b.rate.xofPerBtc, 1) ||
      !['fixe', 'kraken'].includes(b.rate.source as string) ||
      !iso(b.rate.fetchedAt))
  )
    return null;
  if (b.spendableXof !== null && b.rate === null) return null;
  return Object.freeze({
    spendableSats: b.spendableSats,
    pendingSats: b.pendingSats,
    spendableXof: b.spendableXof,
    updatedAt: b.updatedAt,
    rate:
      b.rate === null
        ? null
        : Object.freeze({
            xofPerBtc: b.rate.xofPerBtc,
            source: b.rate.source,
            fetchedAt: b.rate.fetchedAt,
          }),
  }) as HomeBalance;
}

function readPreview(
  value: unknown,
  destination: string,
  expectedSats?: number,
): SendPaymentPreview | null {
  if (!record(value) || value.ok !== true || !record(value.value)) return null;
  const p = value.value;
  if (
    !['facture', 'adresse_lightning'].includes(p.kind as string) ||
    normalizeSendDestination(p.destination) !== destination ||
    (p.kind === 'adresse_lightning') !== destination.includes('@') ||
    !nullableInteger(p.amountSats) ||
    p.amountSats === 0 ||
    !integer(p.maxFeeSats) ||
    !nullableInteger(p.amountXof) ||
    !nullableInteger(p.maxFeeXof) ||
    typeof p.newRecipient !== 'boolean' ||
    (p.memo !== null && !safeText(p.memo, 512)) ||
    (p.expiresAt !== null && !iso(p.expiresAt))
  )
    return null;
  if (expectedSats !== undefined && p.amountSats !== expectedSats) return null;
  if (p.kind === 'facture' && p.expiresAt === null) return null;
  return Object.freeze({
    kind: p.kind,
    destination,
    amountSats: p.amountSats,
    maxFeeSats: p.maxFeeSats,
    amountXof: p.amountXof,
    maxFeeXof: p.maxFeeXof,
    memo: p.memo,
    expiresAt: p.expiresAt,
    newRecipient: p.newRecipient,
  }) as SendPaymentPreview;
}

function readQuote(value: unknown, amountXof: number, now: number): SendQuote | null {
  if (!record(value) || value.ok !== true || !record(value.value)) return null;
  const q = value.value;
  if (
    typeof q.id !== 'string' ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(q.id) ||
    q.amountXof !== amountXof ||
    !integer(q.amountSats, 1) ||
    !integer(q.xofPerBtc, 1) ||
    !['fixe', 'kraken'].includes(q.source as string) ||
    !iso(q.createdAt) ||
    !iso(q.expiresAt)
  )
    return null;
  if (
    Date.parse(q.createdAt) > now + 30_000 ||
    Date.parse(q.expiresAt) <= now ||
    Date.parse(q.expiresAt) <= Date.parse(q.createdAt) ||
    Date.parse(q.expiresAt) - Date.parse(q.createdAt) > 300_000
  )
    return null;
  const rate = BigInt(q.xofPerBtc);
  const exact = (BigInt(amountXof) * 100_000_000n + rate - 1n) / rate;
  if (exact > BigInt(Number.MAX_SAFE_INTEGER) || Number(exact) !== q.amountSats) return null;
  return Object.freeze({
    id: q.id,
    amountXof: q.amountXof,
    amountSats: q.amountSats,
    xofPerBtc: q.xofPerBtc,
    source: q.source,
    createdAt: q.createdAt,
    expiresAt: q.expiresAt,
  }) as SendQuote;
}

function readPayment(value: unknown): HomePayment | null {
  if (
    !record(value) ||
    !safeText(value.id, 128) ||
    value.id.length === 0 ||
    value.direction !== 'envoye' ||
    !['en_attente', 'reussi', 'echoue'].includes(value.status as string) ||
    !integer(value.amountSats, 1) ||
    !integer(value.feeSats) ||
    !nullableInteger(value.amountXof) ||
    !iso(value.createdAt) ||
    (value.memo !== null && !safeText(value.memo, 512)) ||
    (value.failure !== null &&
      (typeof value.failure !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(value.failure)))
  )
    return null;
  return Object.freeze({
    id: value.id,
    direction: value.direction,
    status: value.status,
    amountSats: value.amountSats,
    feeSats: value.feeSats,
    amountXof: value.amountXof,
    memo: value.memo,
    createdAt: value.createdAt,
    failure: value.failure,
  }) as HomePayment;
}

type Operation = {
  phase: 'sending' | 'success' | 'pending' | 'failed' | 'unknown';
  payment: HomePayment | null;
  /** Paiement à suivre quand le wallet n'a pas encore d'issue (T11, `paymentId`). */
  trackedId: string | null;
  error: HomeError | null;
  amountSats: number;
  maxFeeSats: number;
};
type Session = { operation: Operation | null; observers: Set<() => void>; retryAt: number | null };
/** Mémoire de session, indexée par wallet : aucun PIN, aucune écriture sur disque. */
const sessions = new WeakMap<SendWalletPort, Session>();

function sessionFor(wallet?: SendWalletPort): Session {
  if (!wallet) return { operation: null, observers: new Set(), retryAt: null };
  const previous = sessions.get(wallet);
  if (previous) return previous;
  const created: Session = { operation: null, observers: new Set(), retryAt: null };
  sessions.set(wallet, created);
  return created;
}

/** Orchestration d'écran uniquement : jamais de construction ni de signature Lightning. */
export function createSendController(
  services: SendServices,
  { now = Date.now }: { now?: () => number } = {},
): SendController {
  let snapshot: SendSnapshot = Object.freeze({
    mode: services.mode,
    phase: 'idle',
    walletState: null,
    destination: '',
    preview: null,
    quote: null,
    balance: null,
    payment: null,
    error: null,
    busy: false,
    committed: false,
    validUntil: null,
    totalMaxSats: null,
    totalMaxXof: null,
    retryAt: null,
    canRefreshPayment: false,
    risk: null,
  });
  let disposed = false;
  let suspended = false;
  let started = false;
  let revision = 0;
  let riskPermit = false;
  let cancelRiskWait: (() => void) | null = null;
  let release: (() => void) | null = null;
  const session = sessionFor(services.wallet);
  const listeners = new Set<() => void>();
  const active = () => !disposed && !suspended;
  const current = (token: number) => active() && token === revision;
  function update(patch: Partial<SendSnapshot>) {
    if (disposed) return;
    snapshot = Object.freeze({ ...snapshot, ...patch });
    listeners.forEach((listener) => listener());
  }
  function clear(phase: SendPhase, state: HomeWalletState | null = snapshot.walletState) {
    revision += 1;
    invalidateRisk();
    update({
      phase,
      walletState: state,
      destination: '',
      preview: null,
      quote: null,
      balance: null,
      payment: null,
      error: null,
      busy: false,
      committed: session.operation !== null,
      validUntil: null,
      totalMaxSats: null,
      totalMaxXof: null,
      retryAt: null,
      canRefreshPayment: false,
      risk: null,
    });
  }
  function phaseFor(state: HomeWalletState): SendPhase {
    if (state === 'verrouille') return 'locked';
    if (state === 'absent') return 'absent';
    if (state === 'hors_ligne' || state === 'synchronisation') return 'offline';
    return 'destination';
  }
  function detach() {
    try {
      release?.();
    } catch {
      /* Les lectures restent invalidées. */
    }
    release = null;
  }
  function showOperation() {
    const operation = session.operation;
    if (!active() || snapshot.walletState !== 'pret') return;
    if (!operation) {
      if (snapshot.committed) {
        clear('destination', 'pret');
        void initialise();
      }
      return;
    }
    // Un autre écran du même wallet peut soumettre pendant notre analyse.
    // Sa remise d'envoi devient prioritaire sur toute réponse de précontrôle.
    if (cancelRiskWait) {
      revision += 1;
      invalidateRisk();
    }
    update({
      phase: operation.phase,
      payment: operation.payment,
      error: operation.error,
      busy: operation.phase === 'sending',
      committed: true,
      canRefreshPayment:
        (operation.payment !== null || operation.trackedId !== null) &&
        (operation.phase === 'pending' || operation.phase === 'unknown'),
    });
  }
  function notifyOperation() {
    session.observers.forEach((observer) => observer());
  }
  function applyPayment(payment: HomePayment) {
    const operation = session.operation;
    if (operation?.trackedId && payment.id !== operation.trackedId) return;
    if (
      operation?.payment &&
      (payment.id !== operation.payment.id ||
        ((operation.phase === 'success' || operation.phase === 'failed') &&
          payment.status !== operation.payment.status))
    )
      return;
    if (
      !operation ||
      payment.amountSats !== operation.amountSats ||
      payment.feeSats > operation.maxFeeSats
    ) {
      if (operation) {
        operation.phase = 'unknown';
        operation.error = code('INVALID_DATA');
        notifyOperation();
      }
      return;
    }
    operation.payment = payment;
    operation.phase =
      payment.status === 'reussi' ? 'success' : payment.status === 'echoue' ? 'failed' : 'pending';
    operation.error = payment.status === 'echoue' ? code(payment.failure ?? 'UNKNOWN') : null;
    notifyOperation();
  }
  /** Une lecture discrète de l'historique : l'issue a pu arriver avant l'erreur. */
  async function refreshTracked(operation: Operation) {
    if (!services.wallet || !operation.trackedId) return;
    try {
      const result: unknown = await readWithDeadline(() => services.wallet!.history({ limit: 50 }));
      if (session.operation !== operation) return;
      if (record(result) && result.ok === true && Array.isArray(result.value)) {
        const payment = result.value
          .map(readPayment)
          .find((value) => value?.id === operation.trackedId);
        if (payment) applyPayment(payment);
      }
    } catch {
      // « Vérifier » et l'événement `paiement` restent disponibles.
    }
  }
  function onEvent(event: HomeWalletEvent) {
    const value: unknown = event;
    if (!active() || !record(value)) return;
    if (value.type === 'etat' && isState(value.state)) {
      if (value.state !== 'pret') {
        clear(phaseFor(value.state), value.state);
        return;
      }
      update({ walletState: value.state });
      if (session.operation) showOperation();
      else void initialise();
    } else if (value.type === 'paiement' && session.operation) {
      const followed = session.operation.payment?.id ?? session.operation.trackedId;
      const payment = followed ? readPayment(value.payment) : null;
      if (payment && payment.id === followed) applyPayment(payment);
    }
  }
  async function initialise() {
    if (!active()) return;
    if (services.mode === 'unavailable' || !services.wallet) {
      clear('unavailable', null);
      return;
    }
    const token = ++revision;
    update({ phase: 'loading', busy: true, error: null });
    try {
      if (!release) {
        const subscription = services.wallet.subscribe(onEvent);
        if (typeof subscription !== 'function') throw new Error('SUBSCRIPTION_FAILED');
        release = subscription;
      }
      const state: unknown = await readWithDeadline(() => services.wallet!.state());
      if (!current(token)) return;
      if (!isState(state)) {
        clear('error', null);
        update({ error: code('INVALID_DATA') });
        return;
      }
      if (state !== 'pret') {
        clear(phaseFor(state), state);
        return;
      }
      update({ walletState: state });
      if (session.operation) {
        showOperation();
        return;
      }
      const result: unknown = await readWithDeadline(() => services.wallet!.balance());
      if (!current(token)) return;
      const balance = readBalance(result);
      if (!balance) {
        update({ phase: 'error', busy: false, error: readError(result) ?? code('INVALID_DATA') });
        return;
      }
      update({
        phase: 'destination',
        busy: false,
        balance,
        error: null,
        committed: false,
        retryAt: session.retryAt,
      });
    } catch (cause) {
      if (current(token)) update({ phase: 'error', busy: false, error: code(readFailure(cause)) });
    }
  }
  function available() {
    return (
      active() &&
      !session.operation &&
      !snapshot.busy &&
      snapshot.walletState === 'pret' &&
      !!services.wallet &&
      services.mode !== 'unavailable'
    );
  }
  function expired() {
    return !snapshot.validUntil || Date.parse(snapshot.validUntil) <= now();
  }
  function invalidateRisk() {
    riskPermit = false;
    cancelRiskWait?.();
    cancelRiskWait = null;
  }
  function pinReady() {
    if (expired()) {
      update({ phase: 'review', busy: false, error: code('QUOTE_EXPIRED') });
      return false;
    }
    if (
      snapshot.preview?.amountXof == null ||
      snapshot.preview?.maxFeeXof == null ||
      snapshot.totalMaxXof === null
    ) {
      update({ phase: 'review', busy: false, error: code('RATE_UNAVAILABLE') });
      return false;
    }
    if (session.retryAt !== null && now() < session.retryAt) {
      update({ error: code('PIN_LOCKED'), retryAt: session.retryAt });
      return false;
    }
    return true;
  }
  async function analyseRisk(token: number): Promise<RiskAssessment> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let cancel!: () => void;
    const stopped = new Promise<never>((_, reject) => {
      cancel = () => reject(new Error('RISK_CANCELLED'));
      cancelRiskWait = cancel;
      timer = setTimeout(() => reject(new Error('RISK_TIMEOUT')), 8000);
    });
    try {
      return await Promise.race([
        (async () => {
          if (!services.risk || !snapshot.preview || !snapshot.balance)
            throw new Error('RISK_UNAVAILABLE');
          const history: unknown = await services.wallet!.history({ limit: 50 });
          if (settled || !current(token) || session.operation) throw new Error('RISK_CANCELLED');
          if (!record(history) || history.ok !== true || !Array.isArray(history.value))
            throw new Error('RISK_UNAVAILABLE');
          const check = buildRiskCheck({
            preview: snapshot.preview,
            balance: snapshot.balance,
            history: history.value,
            now: now(),
          });
          if (!check) throw new Error('RISK_INVALID_INPUT');
          const assessment = readRiskAssessment(await services.risk.check(check));
          if (!assessment) throw new Error('RISK_INVALID_RESPONSE');
          return assessment;
        })(),
        stopped,
      ]);
    } finally {
      settled = true;
      clearTimeout(timer);
      if (cancelRiskWait === cancel) cancelRiskWait = null;
    }
  }
  function review(preview: SendPaymentPreview, quote: SendQuote | null) {
    invalidateRisk();
    if (preview.expiresAt !== null && Date.parse(preview.expiresAt) <= now()) {
      update({
        phase: 'destination',
        preview: null,
        quote: null,
        busy: false,
        error: code('INVOICE_EXPIRED'),
      });
      return;
    }
    if (preview.amountSats === null) {
      update({ phase: 'amount', preview, quote: null, busy: false });
      return;
    }
    const total = preview.amountSats + preview.maxFeeSats;
    if (!Number.isSafeInteger(total)) {
      update({ phase: 'error', busy: false, error: code('AMOUNT_INVALID') });
      return;
    }
    if (!snapshot.balance || total > snapshot.balance.spendableSats) {
      const fixedInvoice = preview.kind === 'facture' && quote === null;
      update({
        phase: fixedInvoice ? 'destination' : 'amount',
        preview: fixedInvoice ? null : preview,
        quote: fixedInvoice ? null : quote,
        busy: false,
        error: code('INSUFFICIENT_FUNDS'),
      });
      return;
    }
    const deadlines = [
      now() + 300_000,
      ...(preview.expiresAt ? [Date.parse(preview.expiresAt)] : []),
      ...(quote ? [Date.parse(quote.expiresAt)] : []),
    ];
    const deadline = Math.min(...deadlines);
    if (deadline <= now()) {
      update({
        phase: 'amount',
        preview: null,
        quote: null,
        busy: false,
        error: code('QUOTE_EXPIRED'),
      });
      return;
    }
    const rate = quote?.xofPerBtc ?? snapshot.balance?.rate?.xofPerBtc;
    const feeXof =
      rate === undefined || preview.maxFeeXof === null
        ? null
        : Number((BigInt(preview.maxFeeSats) * BigInt(rate) + 99_999_999n) / 100_000_000n);
    const amountXof =
      quote?.amountXof ??
      (preview.amountXof === null || rate === undefined
        ? null
        : Number((BigInt(preview.amountSats) * BigInt(rate)) / 100_000_000n));
    // Arrondir le total exact, pas la somme d'un montant arrondi au-dessous et de frais arrondis.
    const totalXof =
      amountXof === null || feeXof === null || rate === undefined
        ? null
        : Number((BigInt(total) * BigInt(rate) + 99_999_999n) / 100_000_000n);
    if (totalXof !== null && !Number.isSafeInteger(totalXof)) {
      update({ phase: 'error', busy: false, error: code('AMOUNT_INVALID') });
      return;
    }
    update({
      phase: 'review',
      preview: Object.freeze({ ...preview, amountXof, maxFeeXof: feeXof }),
      quote,
      busy: false,
      error: null,
      validUntil: new Date(deadline).toISOString(),
      totalMaxSats: total,
      totalMaxXof: totalXof,
      risk: null,
    });
  }

  function begin() {
    if (started || disposed) return;
    started = true;
    // Seul un résultat final connu permet une nouvelle entrée explicite.
    if (
      session.observers.size === 0 &&
      (session.operation?.phase === 'success' || session.operation?.phase === 'failed')
    )
      session.operation = null;
    session.observers.add(showOperation);
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start() {
      if (started || disposed) return;
      begin();
      await initialise();
    },
    async refresh() {
      if (!active() || snapshot.busy) return;
      await initialise();
    },
    setDestination(input) {
      if (!available()) return;
      revision += 1;
      invalidateRisk();
      const safe = typeof input === 'string' ? input.slice(0, 8192) : '';
      update({
        destination: safe,
        phase: 'destination',
        preview: null,
        quote: null,
        payment: null,
        error: null,
        validUntil: null,
        totalMaxSats: null,
        totalMaxXof: null,
        retryAt: session.retryAt,
        risk: null,
      });
    },
    async inspect(input = snapshot.destination) {
      if (!available()) return;
      const destination = normalizeSendDestination(input);
      if (!destination) {
        update({
          phase: 'destination',
          error: code(
            /^(?:lightning:)?ln(?:bc(?!rt)|tb)/i.test(input)
              ? 'DESTINATION_WRONG_NETWORK'
              : 'DESTINATION_INVALID',
          ),
        });
        return;
      }
      const token = ++revision;
      invalidateRisk();
      update({
        destination,
        preview: null,
        quote: null,
        error: null,
        validUntil: null,
        totalMaxSats: null,
        totalMaxXof: null,
        risk: null,
      });
      if (destination.includes('@')) {
        update({ phase: 'amount', busy: false });
        return;
      }
      update({ phase: 'loading', busy: true });
      try {
        const result: unknown = await readWithDeadline(() => services.wallet!.preview(destination));
        if (!current(token)) return;
        const preview = readPreview(result, destination);
        if (!preview) {
          update({
            phase: 'destination',
            busy: false,
            error: readError(result) ?? code('INVALID_DATA'),
          });
          return;
        }
        review(preview, null);
      } catch (cause) {
        if (current(token))
          update({ phase: 'destination', busy: false, error: code(readFailure(cause)) });
      }
    },
    async quoteAmount(input) {
      if (!available() || snapshot.phase !== 'amount') return;
      const amountXof = parseSendAmount(input);
      if (amountXof === null) {
        update({ error: code('AMOUNT_INVALID') });
        return;
      }
      if (!services.rates) {
        update({ error: code('RATE_UNAVAILABLE') });
        return;
      }
      const token = ++revision;
      const destination = snapshot.destination;
      update({ phase: 'quoting', busy: true, error: null, preview: null, quote: null });
      try {
        const result: unknown = await readWithDeadline(() => services.rates!.quote(amountXof));
        if (!current(token)) return;
        const quote = readQuote(result, amountXof, now());
        if (!quote) {
          update({
            phase: 'amount',
            busy: false,
            error: readError(result) ?? code('INVALID_DATA'),
          });
          return;
        }
        const decoded: unknown = await readWithDeadline(() =>
          services.wallet!.preview(destination, quote.amountSats),
        );
        if (!current(token)) return;
        const preview = readPreview(decoded, destination, quote.amountSats);
        if (!preview) {
          update({
            phase: 'amount',
            busy: false,
            error: readError(decoded) ?? code('INVALID_DATA'),
          });
          return;
        }
        review(preview, quote);
      } catch (cause) {
        if (current(token))
          update({ phase: 'amount', busy: false, error: code(readFailure(cause)) });
      }
    },
    async requestPin() {
      if (!available() || !['review', 'riskUnavailable'].includes(snapshot.phase)) return;
      invalidateRisk();
      if (!pinReady()) return;
      const token = ++revision;
      update({ phase: 'riskChecking', busy: true, error: null, risk: null });
      try {
        const risk = await analyseRisk(token);
        if (!current(token)) return;
        if (session.operation) {
          showOperation();
          return;
        }
        update({ busy: false });
        if (!pinReady()) return;
        riskPermit = !risk.confirmationRequired;
        update({ phase: risk.confirmationRequired ? 'riskWarning' : 'pin', risk });
      } catch {
        if (!current(token)) return;
        if (session.operation) {
          showOperation();
          return;
        }
        update({ busy: false });
        if (pinReady()) update({ phase: 'riskUnavailable', risk: null });
      }
    },
    acknowledgeRisk() {
      if (
        !available() ||
        !['riskWarning', 'riskUnavailable'].includes(snapshot.phase) ||
        !pinReady()
      )
        return;
      riskPermit = true;
      update({ phase: 'pin', error: null });
    },
    cancelRisk() {
      if (
        !active() ||
        session.operation ||
        !['riskChecking', 'riskWarning', 'riskUnavailable'].includes(snapshot.phase)
      )
        return;
      const balance = snapshot.balance;
      clear('destination', snapshot.walletState);
      update({ balance });
    },
    async confirm(pin) {
      if (!available() || !riskPermit || snapshot.phase !== 'pin' || !snapshot.preview?.amountSats)
        return;
      if (!/^\d{6}$/.test(pin)) {
        update({ error: code('PIN_FORMAT') });
        return;
      }
      if (session.retryAt !== null && now() < session.retryAt) {
        update({ error: code('PIN_LOCKED'), retryAt: session.retryAt });
        return;
      }
      if (expired()) {
        update({ phase: 'review', error: code('QUOTE_EXPIRED') });
        return;
      }
      const token = ++revision;
      const preview = snapshot.preview;
      const amountSats = preview.amountSats!;
      update({ busy: true, error: null });
      try {
        const state: unknown = await readWithDeadline(() => services.wallet!.state());
        if (!current(token)) return;
        if (state !== 'pret') {
          clear(isState(state) ? phaseFor(state) : 'error', isState(state) ? state : null);
          return;
        }
        if (expired()) {
          update({ phase: 'review', busy: false, error: code('QUOTE_EXPIRED') });
          return;
        }
      } catch (cause) {
        if (current(token)) update({ phase: 'pin', busy: false, error: code(readFailure(cause)) });
        return;
      }
      // Un autre écran a pu soumettre pendant l'attente de state().
      if (session.operation) {
        showOperation();
        return;
      }
      if (session.retryAt !== null && now() < session.retryAt) {
        update({ busy: false, error: code('PIN_LOCKED'), retryAt: session.retryAt });
        return;
      }
      // La barrière est posée AVANT l'appel externe : double appui et exceptions restent sûrs.
      const operation: Operation = {
        phase: 'sending',
        payment: null,
        trackedId: null,
        error: null,
        amountSats,
        maxFeeSats: preview.maxFeeSats,
      };
      session.operation = operation;
      const stopWaiting = startPendingWatch(() => {
        if (session.operation !== operation || operation.phase !== 'sending') return;
        operation.phase = 'unknown';
        operation.error = code('PAYMENT_TIMEOUT');
        notifyOperation();
      });
      let result: unknown;
      try {
        const pending = services.wallet!.send({
          destination: preview.destination,
          amountSats,
          maxFeeSats: preview.maxFeeSats,
          ...(preview.amountXof !== null &&
          (snapshot.quote?.xofPerBtc ?? snapshot.balance?.rate?.xofPerBtc) !== undefined
            ? {
                amountXof: preview.amountXof,
                xofPerBtc: snapshot.quote?.xofPerBtc ?? snapshot.balance!.rate!.xofPerBtc,
                ...(snapshot.validUntil ? { expiresAt: snapshot.validUntil } : {}),
              }
            : {}),
          pin,
        });
        pin = '';
        notifyOperation();
        result = await pending;
      } catch {
        if (session.operation === operation) {
          operation.phase = 'unknown';
          operation.error = code('UNKNOWN');
          notifyOperation();
        }
        return;
      } finally {
        stopWaiting();
      }
      // Même un écran détruit doit enregistrer le résultat dans la barrière de session.
      if (session.operation !== operation) return;
      if (record(result) && result.ok === true) {
        const payment = readPayment(result.value);
        if (payment) applyPayment(payment);
        else {
          operation.phase = 'unknown';
          operation.error = code('INVALID_DATA');
          notifyOperation();
        }
        return;
      }
      const error = readError(result) ?? code('UNKNOWN');
      const preflightErrors = new Set([
        'PIN_INVALID',
        'PIN_FORMAT',
        'PIN_LOCKED',
        'WALLET_LOCKED',
        'WALLET_ABSENT',
        'AMOUNT_INVALID',
        'INSUFFICIENT_FUNDS',
        'DESTINATION_INVALID',
        'DESTINATION_WRONG_NETWORK',
        'INVOICE_EXPIRED',
        'FEE_TOO_HIGH',
      ]);
      if (preflightErrors.has(error.code)) {
        if (error.code === 'PIN_LOCKED')
          session.retryAt = now() + (error.retryAfterSeconds ?? 30) * 1000;
        session.operation = null;
        session.observers.forEach((observer) => {
          if (observer !== showOperation) observer();
        });
        if (!current(token)) return;
        if (error.code === 'WALLET_LOCKED' || error.code === 'WALLET_ABSENT') {
          clear(error.code === 'WALLET_LOCKED' ? 'locked' : 'absent');
          return;
        }
        update({
          phase: error.code.startsWith('PIN_') ? 'pin' : 'review',
          busy: false,
          committed: false,
          error,
          retryAt: session.retryAt,
        });
      } else {
        operation.phase = error.code === 'NO_ROUTE' ? 'failed' : 'unknown';
        operation.error = error;
        if (trackedErrors.has(error.code) && error.paymentId) {
          // L'envoi est parti : on suit son identifiant (événement `paiement`,
          // « Vérifier »), sans jamais proposer de le renvoyer.
          operation.trackedId = error.paymentId;
          notifyOperation();
          await refreshTracked(operation);
          return;
        }
        notifyOperation();
      }
    },
    edit() {
      if (!available()) return;
      revision += 1;
      invalidateRisk();
      update({
        phase: 'destination',
        preview: null,
        quote: null,
        error: null,
        validUntil: null,
        totalMaxSats: null,
        totalMaxXof: null,
        risk: null,
      });
    },
    async refreshPayment() {
      const operation = session.operation;
      if (
        !active() ||
        snapshot.busy ||
        !snapshot.canRefreshPayment ||
        !(operation?.payment || operation?.trackedId) ||
        snapshot.walletState !== 'pret' ||
        !services.wallet
      )
        return;
      const id = (operation.payment?.id ?? operation.trackedId) as string;
      const token = revision;
      update({ busy: true });
      try {
        const result: unknown = await readWithDeadline(() =>
          services.wallet!.history({ limit: 50 }),
        );
        if (!current(token)) return;
        if (record(result) && result.ok === true && Array.isArray(result.value)) {
          const values = result.value.map(readPayment);
          const payment = values.find((value) => value?.id === id);
          if (payment) applyPayment(payment);
        }
      } catch (cause) {
        if (current(token) && session.operation === operation) {
          operation.error = code(readFailure(cause));
          notifyOperation();
        }
      } finally {
        if (current(token)) update({ busy: false });
      }
    },
    suspend() {
      if (disposed || suspended) return;
      suspended = true;
      detach();
      clear('suspended', null);
    },
    async resume() {
      if (disposed || !suspended) return;
      suspended = false;
      begin();
      await initialise();
    },
    dispose() {
      if (disposed) return;
      clear('suspended', null);
      disposed = true;
      detach();
      session.observers.delete(showOperation);
      listeners.clear();
    },
  };
}
