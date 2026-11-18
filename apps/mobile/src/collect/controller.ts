import type { HomeError, HomePayment, HomeWalletEvent, HomeWalletState } from '../home/ports';
import { parseSendAmount } from '../send/controller';
import type { SendQuote } from '../send/ports';
import type { CollectReceipt, CollectRequest, CollectServices } from './ports';

export type CollectPhase =
  | 'idle'
  | 'loading'
  | 'amount'
  | 'quoting'
  | 'review'
  | 'creating'
  | 'waiting'
  | 'paid'
  | 'late'
  | 'expired'
  | 'unknown'
  | 'locked'
  | 'absent'
  | 'offline'
  | 'unavailable'
  | 'error'
  | 'suspended';
export type CollectSnapshot = Readonly<{
  mode: CollectServices['mode'];
  phase: CollectPhase;
  walletState: HomeWalletState | null;
  quote: Readonly<SendQuote> | null;
  request: Readonly<CollectRequest> | null;
  payment: Readonly<HomePayment> | null;
  receipt: Readonly<CollectReceipt> | null;
  previousReceipts: readonly Readonly<CollectReceipt>[];
  error: HomeError | null;
  busy: boolean;
  committed: boolean;
  validUntil: string | null;
  remainingSeconds: number;
  canRefresh: boolean;
  canNewRequest: boolean;
}>;
export interface CollectController {
  getSnapshot(): CollectSnapshot;
  subscribe(listener: () => void): () => void;
  start(): Promise<void>;
  prepare(amount: string): Promise<void>;
  create(): Promise<void>;
  edit(): void;
  refresh(): Promise<void>;
  newRequest(): void;
  tick(): void;
  suspend(): void;
  resume(): Promise<void>;
  dispose(): void;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
const iso = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z');
const code = (value: string): HomeError => Object.freeze({ code: value });
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const isState = (value: unknown): value is HomeWalletState =>
  typeof value === 'string' &&
  ['pret', 'hors_ligne', 'synchronisation', 'verrouille', 'absent'].includes(value);
function safeText(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 512) return false;
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
function readError(value: unknown): HomeError {
  return record(value) &&
    value.ok === false &&
    record(value.error) &&
    typeof value.error.code === 'string' &&
    /^[A-Z][A-Z0-9_]{0,63}$/.test(value.error.code)
    ? code(value.error.code)
    : code('INVALID_DATA');
}
function readQuote(value: unknown, amountXof: number, now: number): SendQuote | null {
  if (!record(value) || value.ok !== true || !record(value.value)) return null;
  const q = value.value;
  if (
    !identifier(q.id) ||
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
  const amount = (BigInt(amountXof) * 100_000_000n + rate - 1n) / rate;
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || Number(amount) !== q.amountSats) return null;
  return Object.freeze({
    id: q.id,
    amountXof,
    amountSats: q.amountSats,
    xofPerBtc: q.xofPerBtc,
    source: q.source,
    createdAt: q.createdAt,
    expiresAt: q.expiresAt,
  }) as SendQuote;
}
function readRequest(value: unknown, quote: SendQuote, now: number): CollectRequest | null {
  if (
    !record(value) ||
    value.ok !== true ||
    !record(value.value) ||
    !record(value.value.invoice) ||
    !identifier(value.value.paymentId)
  )
    return null;
  const i = value.value.invoice;
  const raw = i.paymentRequest;
  if (
    typeof raw !== 'string' ||
    raw.length > 2048 ||
    !/^lnbcrt[0-9a-z]+$/i.test(raw) ||
    (raw !== raw.toLowerCase() && raw !== raw.toUpperCase()) ||
    i.amountSats !== quote.amountSats ||
    i.amountXof !== quote.amountXof ||
    !iso(i.createdAt) ||
    !iso(i.expiresAt) ||
    (i.memo !== null && !safeText(i.memo))
  )
    return null;
  if (
    Date.parse(i.createdAt) < Date.parse(quote.createdAt) - 1000 ||
    Date.parse(i.createdAt) > now + 30_000 ||
    Date.parse(i.expiresAt) <= Date.parse(i.createdAt) ||
    Date.parse(i.expiresAt) > Date.parse(quote.expiresAt)
  )
    return null;
  const invoice = Object.freeze({
    paymentRequest: raw,
    amountSats: i.amountSats,
    amountXof: i.amountXof,
    memo: i.memo,
    createdAt: i.createdAt,
    expiresAt: i.expiresAt,
  });
  return Object.freeze({ invoice, paymentId: value.value.paymentId }) as CollectRequest;
}
function readIncoming(value: unknown): HomePayment | null {
  if (
    !record(value) ||
    !identifier(value.id) ||
    value.direction !== 'recu' ||
    !['en_attente', 'reussi', 'echoue'].includes(value.status as string) ||
    !integer(value.amountSats, 1) ||
    value.feeSats !== 0 ||
    (value.amountXof !== null && !integer(value.amountXof)) ||
    !iso(value.createdAt) ||
    (value.memo !== null && !safeText(value.memo)) ||
    (value.failure !== null &&
      (typeof value.failure !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(value.failure)))
  )
    return null;
  if (value.status === 'reussi' && value.failure !== null) return null;
  return Object.freeze({
    id: value.id,
    direction: 'recu',
    status: value.status,
    amountSats: value.amountSats,
    feeSats: 0,
    amountXof: value.amountXof,
    memo: value.memo,
    createdAt: value.createdAt,
    failure: value.failure,
  }) as HomePayment;
}
function readPayment(value: unknown, attempt: Attempt): HomePayment | null {
  const request = attempt.request;
  const payment = readIncoming(value);
  return request &&
    payment &&
    payment.id === request.paymentId &&
    payment.amountSats === attempt.quote.amountSats
    ? payment
    : null;
}

type Attempt = {
  quote: SendQuote;
  state: 'creating' | 'known' | 'unknown';
  request: CollectRequest | null;
  payment: HomePayment | null;
  receipt: CollectReceipt | null;
  error: HomeError | null;
};
type Session = {
  current: Attempt | null;
  archives: Attempt[];
  receipts: CollectReceipt[];
  observers: Set<() => void>;
  earlyPayments: Map<string, HomePayment>;
  /** Ces identités ne sont jamais évincées avec les dix reçus visibles. */
  usedPaymentIds: Set<string>;
  usedPaymentRequests: Set<string>;
};
const sessions = new WeakMap<object, Session>();
function sessionFor(services: CollectServices): Session {
  const key = services.wallet ?? services.invoices ?? services;
  const previous = sessions.get(key);
  if (previous) return previous;
  const session: Session = {
    current: null,
    archives: [],
    receipts: [],
    observers: new Set(),
    earlyPayments: new Map(),
    usedPaymentIds: new Set(),
    usedPaymentRequests: new Set(),
  };
  sessions.set(key, session);
  return session;
}

/** Caisse en mémoire de session ; création explicite, suivi exact, jamais de paiement initié ici. */
export function createCollectController(
  services: CollectServices,
  { now = Date.now }: { now?: () => number } = {},
): CollectController {
  const session = sessionFor(services);
  const listeners = new Set<() => void>();
  let started = false;
  let disposed = false;
  let suspended = false;
  let revision = 0;
  let release: (() => void) | null = null;
  let walletState: HomeWalletState | null = null;
  let localPhase: CollectPhase = 'idle';
  let localError: HomeError | null = null;
  let busy = false;
  let draft: SendQuote | null = null;
  const active = () => !disposed && !suspended;
  const current = (token: number) => active() && revision === token;
  let snapshot: CollectSnapshot;

  function publish() {
    if (disposed) return;
    const visible = active() && walletState === 'pret';
    const attempt = visible ? session.current : null;
    const quote = visible ? (attempt?.quote ?? draft) : null;
    const request = attempt?.request ?? null;
    const validUntil = quote ? (request ? request.invoice.expiresAt : quote.expiresAt) : null;
    const remainingSeconds = validUntil
      ? Math.max(0, Math.ceil((Date.parse(validUntil) - now()) / 1000))
      : 0;
    let phase = localPhase;
    if (attempt)
      phase = attempt.receipt
        ? attempt.receipt.late
          ? 'late'
          : 'paid'
        : attempt.state === 'creating'
          ? 'creating'
          : attempt.state === 'unknown' || attempt.error?.code === 'PAYMENT_MISMATCH'
            ? 'unknown'
            : remainingSeconds === 0
              ? 'expired'
              : 'waiting';
    snapshot = Object.freeze({
      mode: services.mode,
      phase,
      walletState,
      quote,
      request,
      payment: attempt?.payment ?? null,
      receipt: attempt?.receipt ?? null,
      previousReceipts: Object.freeze(visible ? [...session.receipts] : []),
      error: visible ? (attempt?.error ?? localError) : localError,
      busy: active() && (busy || attempt?.state === 'creating'),
      committed: session.current !== null,
      validUntil,
      remainingSeconds,
      canRefresh: visible && request !== null && attempt?.state !== 'creating',
      canNewRequest:
        visible &&
        attempt?.state === 'known' &&
        attempt.request !== null &&
        attempt.error?.code !== 'PAYMENT_MISMATCH' &&
        (attempt.receipt !== null || (remainingSeconds === 0 && session.archives.length < 20)),
    });
    listeners.forEach((listener) => listener());
  }
  publish();
  const notify = () => session.observers.forEach((observer) => observer());
  function redact(phase: CollectPhase, state: HomeWalletState | null) {
    revision += 1;
    draft = null;
    walletState = state;
    localPhase = phase;
    localError = null;
    busy = false;
    publish();
  }
  function appendReceipt(receipt: CollectReceipt) {
    session.receipts = [
      receipt,
      ...session.receipts.filter((value) => value.paymentId !== receipt.paymentId),
    ].slice(0, 10);
  }
  function applyPayment(attempt: Attempt, value: unknown) {
    if (attempt.receipt) return;
    const payment = readPayment(value, attempt);
    if (!payment) {
      attempt.error = code('PAYMENT_MISMATCH');
      notify();
      return;
    }
    attempt.payment = payment;
    attempt.error = payment.status === 'echoue' ? code(payment.failure ?? 'PAYMENT_FAILED') : null;
    if (payment.status === 'reussi' && attempt.request) {
      attempt.receipt = Object.freeze({
        quoteId: attempt.quote.id,
        paymentId: payment.id,
        amountXof: attempt.quote.amountXof,
        amountSats: payment.amountSats,
        confirmedAt: new Date(now()).toISOString(),
        late: now() >= Date.parse(attempt.request.invoice.expiresAt),
      });
      if (attempt !== session.current) {
        session.archives = session.archives.filter((value) => value !== attempt);
        appendReceipt(attempt.receipt);
      }
    }
    notify();
  }
  function onEvent(event: HomeWalletEvent) {
    const value: unknown = event;
    if (!active() || !record(value)) return;
    if (value.type === 'etat' && isState(value.state)) {
      if (value.state !== 'pret') {
        redact(
          value.state === 'verrouille' ? 'locked' : value.state === 'absent' ? 'absent' : 'offline',
          value.state,
        );
        return;
      }
      if (walletState !== 'pret') void initialise();
    } else if (value.type === 'paiement' && record(value.payment)) {
      const payment = value.payment;
      const attempt = [session.current, ...session.archives].find(
        (item) => item?.request?.paymentId === payment.id,
      );
      if (attempt) applyPayment(attempt, payment);
      else if (session.current?.state === 'creating') {
        const candidate = readIncoming(payment);
        if (
          candidate &&
          session.earlyPayments.size < 20 &&
          session.earlyPayments.get(candidate.id)?.status !== 'reussi'
        )
          session.earlyPayments.set(candidate.id, candidate);
      }
    }
  }
  async function lookupAll() {
    if (!active() || walletState !== 'pret' || !services.invoices) return;
    const attempts = [session.current, ...session.archives].filter(
      (item): item is Attempt => item !== null && item.request !== null && item.receipt === null,
    );
    if (!attempts.length) {
      publish();
      return;
    }
    const token = revision;
    busy = true;
    publish();
    try {
      for (const attempt of attempts) {
        if (!current(token) || walletState !== 'pret') return;
        const request = attempt.request!;
        try {
          const result: unknown = await services.invoices.lookup({
            paymentId: request.paymentId,
            paymentRequest: request.invoice.paymentRequest,
          });
          if (!current(token)) return;
          // Un événement a pu fournir la preuve pendant cette lecture : elle reste définitive.
          if (attempt.receipt) continue;
          if (!record(result) || result.ok !== true || !record(result.value)) {
            attempt.error = readError(result);
            continue;
          }
          if (result.value.paymentRequest !== request.invoice.paymentRequest) {
            attempt.error = code('PAYMENT_MISMATCH');
            continue;
          }
          if (result.value.payment !== null) applyPayment(attempt, result.value.payment);
          else if (attempt.error?.code !== 'PAYMENT_MISMATCH') attempt.error = null;
        } catch {
          if (current(token) && !attempt.receipt) attempt.error = code('LOOKUP_FAILED');
        }
      }
    } finally {
      if (current(token)) {
        busy = false;
        notify();
        publish();
      }
    }
  }
  async function initialise() {
    if (!active() || busy) return;
    if (
      services.mode === 'unavailable' ||
      !services.wallet ||
      !services.rates ||
      !services.invoices
    ) {
      redact('unavailable', null);
      return;
    }
    const token = ++revision;
    localPhase = 'loading';
    busy = true;
    localError = null;
    publish();
    try {
      if (!release) {
        const subscription = services.wallet.subscribe(onEvent);
        if (typeof subscription !== 'function') throw new Error('SUBSCRIPTION_FAILED');
        release = subscription;
      }
      const state: unknown = await services.wallet.state();
      if (!current(token)) return;
      busy = false;
      if (!isState(state)) {
        redact('error', null);
        localError = code('INVALID_DATA');
        publish();
        return;
      }
      if (state !== 'pret') {
        redact(
          state === 'verrouille' ? 'locked' : state === 'absent' ? 'absent' : 'offline',
          state,
        );
        return;
      }
      walletState = state;
      localPhase = draft ? 'review' : 'amount';
      publish();
      await lookupAll();
    } catch {
      if (current(token)) {
        busy = false;
        localPhase = 'error';
        localError = code('READ_FAILED');
        publish();
      }
    }
  }
  function begin() {
    if (!started) {
      started = true;
      session.observers.add(publish);
    }
  }
  function detach() {
    try {
      release?.();
    } catch {
      /* Les réponses invalidées ne redeviennent pas visibles. */
    }
    release = null;
  }
  function mayPrepare() {
    return (
      active() && walletState === 'pret' && !busy && session.current === null && !!services.rates
    );
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
    async prepare(input) {
      if (!mayPrepare()) return;
      const amount = parseSendAmount(input);
      if (amount === null) {
        localError = code('AMOUNT_INVALID');
        publish();
        return;
      }
      const token = ++revision;
      draft = null;
      localPhase = 'quoting';
      localError = null;
      busy = true;
      publish();
      try {
        const result: unknown = await services.rates!.quote(amount);
        if (!current(token)) return;
        const quote = readQuote(result, amount, now());
        draft = quote;
        busy = false;
        localPhase = quote ? 'review' : 'amount';
        localError = quote ? null : readError(result);
        publish();
      } catch {
        if (current(token)) {
          busy = false;
          localPhase = 'amount';
          localError = code('READ_FAILED');
          publish();
        }
      }
    },
    async create() {
      if (
        !mayPrepare() ||
        !draft ||
        localPhase !== 'review' ||
        !services.wallet ||
        !services.invoices
      )
        return;
      if (Date.parse(draft.expiresAt) <= now()) {
        localError = code('QUOTE_EXPIRED');
        publish();
        return;
      }
      const quote = draft;
      const token = ++revision;
      busy = true;
      publish();
      try {
        const state: unknown = await services.wallet.state();
        if (!current(token)) return;
        busy = false;
        if (state !== 'pret') {
          redact(
            isState(state) && state === 'verrouille'
              ? 'locked'
              : isState(state) && state === 'absent'
                ? 'absent'
                : 'offline',
            isState(state) ? state : null,
          );
          return;
        }
        if (session.current) {
          publish();
          return;
        }
        if (Date.parse(quote.expiresAt) <= now()) {
          localError = code('QUOTE_EXPIRED');
          publish();
          return;
        }
      } catch {
        if (current(token)) {
          busy = false;
          localError = code('READ_FAILED');
          publish();
        }
        return;
      }
      const attempt: Attempt = {
        quote,
        state: 'creating',
        request: null,
        payment: null,
        receipt: null,
        error: null,
      };
      session.earlyPayments.clear();
      session.current = attempt;
      try {
        const pending = services.invoices.create({ quote });
        notify();
        const result: unknown = await pending;
        const candidate = readRequest(result, quote, now());
        // Une nouvelle vente ne peut réutiliser une ancienne facture, même déjà payée.
        // L'identité BOLT11 ignore la casse uniforme, sans modifier le texte affiché ou copié.
        const request =
          candidate &&
          !session.usedPaymentIds.has(candidate.paymentId) &&
          !session.usedPaymentRequests.has(candidate.invoice.paymentRequest.toLowerCase())
            ? candidate
            : null;
        if (request) {
          session.usedPaymentIds.add(request.paymentId);
          session.usedPaymentRequests.add(request.invoice.paymentRequest.toLowerCase());
        }
        attempt.request = request;
        attempt.state = request ? 'known' : 'unknown';
        attempt.error = request ? null : readError(result);
        const early = request ? session.earlyPayments.get(request.paymentId) : null;
        if (early) applyPayment(attempt, early);
        session.earlyPayments.clear();
      } catch {
        attempt.state = 'unknown';
        attempt.error = code('CREATION_UNKNOWN');
      }
      // La réponse tardive reste dans la session, même si cet écran a été détruit.
      notify();
      if (active() && walletState === 'pret') await lookupAll();
    },
    edit() {
      if (!active() || session.current) return;
      revision += 1;
      draft = null;
      busy = false;
      localPhase = 'amount';
      localError = null;
      publish();
    },
    async refresh() {
      if (!active() || busy || session.current?.state === 'creating') return;
      await initialise();
    },
    newRequest() {
      if (!active() || busy || walletState !== 'pret') return;
      const attempt = session.current;
      if (attempt) {
        if (
          !attempt.request ||
          attempt.state !== 'known' ||
          attempt.error?.code === 'PAYMENT_MISMATCH' ||
          (!attempt.receipt && Date.parse(attempt.request.invoice.expiresAt) > now())
        )
          return;
        if (attempt.receipt) appendReceipt(attempt.receipt);
        else if (session.archives.length >= 20) {
          localError = code('ARCHIVE_LIMIT');
          publish();
          return;
        } else session.archives.push(attempt);
        session.current = null;
      }
      revision += 1;
      draft = null;
      localPhase = 'amount';
      localError = null;
      notify();
      publish();
    },
    tick() {
      if (active()) publish();
    },
    suspend() {
      if (disposed || suspended) return;
      suspended = true;
      detach();
      redact('suspended', null);
    },
    async resume() {
      if (disposed || !suspended) return;
      suspended = false;
      begin();
      await initialise();
    },
    dispose() {
      if (disposed) return;
      redact('suspended', null);
      disposed = true;
      detach();
      session.observers.delete(publish);
      listeners.clear();
    },
  };
}
