import type { HomePayment, HomeResult, HomeWalletEvent, HomeWalletState } from '../src/home/ports';
import { createCollectController } from '../src/collect/controller';
import type {
  CollectInvoicePort,
  CollectRequest,
  CollectServices,
  CollectWalletPort,
} from '../src/collect/ports';
import { createCollectPreviewServices } from '../src/collect/preview';
import type { SendQuote, SendRatePort } from '../src/send/ports';

const instant = Date.parse('2026-11-10T12:00:00.000Z');
const ok = <T>(value: T): HomeResult<T> => ({ ok: true, value });
const fail = <T>(code: string): HomeResult<T> => ({ ok: false, error: { code } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function drain() {
  for (let index = 0; index < 24; index += 1) await Promise.resolve();
}

function harness(initialState: HomeWalletState = 'pret') {
  let time = instant;
  let state = initialState;
  let sequence = 0;
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const requests: CollectRequest[] = [];
  const iso = (offset = 0) => new Date(time + offset).toISOString();
  const quote = (amountXof = 2500): SendQuote => ({
    id: `devis-fictif-${++sequence}`,
    amountXof,
    amountSats: Number((BigInt(amountXof) * 100_000_000n + 44_999_999n) / 45_000_000n),
    xofPerBtc: 45_000_000,
    source: 'fixe',
    createdAt: iso(),
    expiresAt: iso(300_000),
  });
  const request = (q: SendQuote): CollectRequest => ({
    paymentId: `demande-fictive-${q.id}`,
    invoice: {
      paymentRequest: `lnbcrt1collectefictivenonpayable${sequence}`,
      amountSats: q.amountSats,
      amountXof: q.amountXof,
      memo: null,
      createdAt: iso(),
      expiresAt: q.expiresAt,
    },
  });
  const wallet: jest.Mocked<CollectWalletPort> = {
    state: jest.fn(async () => state),
    subscribe: jest.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const rates: jest.Mocked<SendRatePort> = {
    quote: jest.fn(async (amountXof) => ok(quote(amountXof))),
  };
  const invoices: jest.Mocked<CollectInvoicePort> = {
    create: jest.fn(async ({ quote: q }) => {
      const value = request(q);
      requests.push(value);
      return ok(value);
    }),
    lookup: jest.fn(async ({ paymentRequest }) => ok({ paymentRequest, payment: null })),
  };
  const services: CollectServices = { mode: 'native', wallet, rates, invoices };
  const controller = createCollectController(services, { now: () => time });
  function payment(
    r: CollectRequest = requests[requests.length - 1]!,
    patch: Partial<HomePayment> = {},
  ): HomePayment {
    return {
      id: r.paymentId,
      direction: 'recu',
      status: 'reussi',
      amountSats: r.invoice.amountSats!,
      feeSats: 0,
      amountXof: null,
      memo: null,
      createdAt: iso(),
      failure: null,
      ...patch,
    };
  }
  return {
    controller,
    services,
    wallet,
    rates,
    invoices,
    quote,
    request,
    requests,
    payment,
    iso,
    now: () => time,
    advance(ms: number) {
      time += ms;
    },
    setState(value: HomeWalletState) {
      state = value;
    },
    emit(event: HomeWalletEvent) {
      listeners.forEach((listener) => listener(event));
    },
  };
}
async function prepared(test: ReturnType<typeof harness>) {
  await test.controller.start();
  await test.controller.prepare('2500');
  expect(test.controller.getSnapshot().phase).toBe('review');
}
async function waiting(test: ReturnType<typeof harness>) {
  await prepared(test);
  await test.controller.create();
  expect(test.controller.getSnapshot().phase).toBe('waiting');
}

describe('encaisser | préparation et création explicite', () => {
  it('ne remplace pas un service absent par une facture fictive', async () => {
    const test = harness();
    const controller = createCollectController({ ...test.services, mode: 'unavailable' });
    await controller.start();
    await controller.prepare('2500');
    await controller.create();
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'unavailable',
      request: null,
      quote: null,
    });
    expect(test.wallet.state).not.toHaveBeenCalled();
    expect(test.invoices.create).not.toHaveBeenCalled();
  });
  it('exige le port de correspondance et ne branche pas automatiquement Wallet.receive T11', async () => {
    const test = harness();
    const controller = createCollectController({ ...test.services, invoices: undefined });
    await controller.start();
    expect(controller.getSnapshot().phase).toBe('unavailable');
    expect(test.wallet.state).not.toHaveBeenCalled();
  });
  it.each([
    ['hors_ligne', 'offline'],
    ['synchronisation', 'offline'],
    ['verrouille', 'locked'],
    ['absent', 'absent'],
  ] as const)('un wallet %s ne crée aucune demande', async (state, phase) => {
    const test = harness(state);
    await test.controller.start();
    await test.controller.prepare('2500');
    await test.controller.create();
    expect(test.controller.getSnapshot()).toMatchObject({ phase, request: null });
    expect(test.rates.quote).not.toHaveBeenCalled();
    expect(test.invoices.create).not.toHaveBeenCalled();
  });
  it('préparer le montant appelle seulement T17 ; un autre appui crée la facture', async () => {
    const test = harness();
    await prepared(test);
    expect(test.controller.getSnapshot()).toMatchObject({
      quote: { amountXof: 2500, amountSats: 5556 },
      committed: false,
    });
    expect(test.invoices.create).not.toHaveBeenCalled();
    await test.controller.create();
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    expect(test.invoices.create).toHaveBeenCalledWith({
      quote: expect.objectContaining({ amountXof: 2500, amountSats: 5556 }),
    });
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'waiting',
      remainingSeconds: 300,
      receipt: null,
      canRefresh: true,
      canNewRequest: false,
    });
  });
  it.each(['0', '-1', '1.5', '1e3', '5000001', '2 500'])(
    'refuse le montant %s avant toute requête',
    async (input) => {
      const test = harness();
      await test.controller.start();
      await test.controller.prepare(input);
      expect(test.controller.getSnapshot()).toMatchObject({
        error: { code: 'AMOUNT_INVALID' },
        quote: null,
      });
      expect(test.rates.quote).not.toHaveBeenCalled();
    },
  );
  it('permet de modifier le montant tant qu’aucune facture n’a été créée', async () => {
    const test = harness();
    await prepared(test);
    test.controller.edit();
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'amount', quote: null });
    await test.controller.prepare('1000');
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      quote: { amountXof: 1000, amountSats: 2223 },
    });
    expect(test.invoices.create).not.toHaveBeenCalled();
  });
  it.each([
    { amountSats: 5555 },
    { amountXof: 9999 },
    { xofPerBtc: 0 },
    { expiresAt: new Date(instant + 300001).toISOString() },
    { createdAt: '2026-02-30T12:00:00.000Z' },
  ])('refuse un devis incohérent : %p', async (patch) => {
    const test = harness();
    test.rates.quote.mockResolvedValue(ok({ ...test.quote(), ...patch }));
    await test.controller.start();
    await test.controller.prepare('2500');
    await test.controller.create();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'amount',
      error: { code: 'INVALID_DATA' },
    });
    expect(test.invoices.create).not.toHaveBeenCalled();
  });
  it('revérifie l’expiration après l’attente de l’état et juste avant la création', async () => {
    const test = harness();
    await prepared(test);
    const state = deferred<HomeWalletState>();
    test.wallet.state.mockReturnValueOnce(state.promise);
    const creating = test.controller.create();
    test.advance(300_000);
    state.resolve('pret');
    await creating;
    expect(test.invoices.create).not.toHaveBeenCalled();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      error: { code: 'QUOTE_EXPIRED' },
      committed: false,
    });
  });
  it('deux appuis rapides ne créent qu’une facture', async () => {
    const test = harness();
    const result = deferred<HomeResult<CollectRequest>>();
    test.invoices.create.mockReturnValue(result.promise);
    await prepared(test);
    const first = test.controller.create();
    const second = test.controller.create();
    await drain();
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    result.resolve(ok(test.request(test.controller.getSnapshot().quote!)));
    await Promise.all([first, second]);
  });
  it('deux contrôleurs concurrents partagent la barrière après la lecture de state', async () => {
    const test = harness();
    const other = createCollectController(test.services, { now: test.now });
    await prepared(test);
    await other.start();
    await other.prepare('1000');
    const state1 = deferred<HomeWalletState>();
    const state2 = deferred<HomeWalletState>();
    const result = deferred<HomeResult<CollectRequest>>();
    test.wallet.state.mockReturnValueOnce(state1.promise).mockReturnValueOnce(state2.promise);
    test.invoices.create.mockReturnValue(result.promise);
    const first = test.controller.create();
    const second = other.create();
    state1.resolve('pret');
    state2.resolve('pret');
    await drain();
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    const q = test.invoices.create.mock.calls[0]![0].quote;
    result.resolve(ok(test.request(q)));
    await Promise.all([first, second]);
    expect(other.getSnapshot()).toMatchObject({ phase: 'waiting', quote: { amountXof: 2500 } });
  });
});

describe('encaisser | création incertaine et validation de la facture', () => {
  it.each(['exception', 'erreur'])(
    'une création à réponse %s reste bloquée après remontage',
    async (kind) => {
      const test = harness();
      if (kind === 'exception')
        test.invoices.create.mockRejectedValue(new Error('réponse interrompue'));
      else test.invoices.create.mockResolvedValue(fail('NETWORK_OFFLINE'));
      await prepared(test);
      await test.controller.create();
      test.controller.newRequest();
      test.controller.edit();
      await test.controller.prepare('1000');
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'unknown',
        committed: true,
        request: null,
        canNewRequest: false,
        canRefresh: false,
      });
      test.controller.dispose();
      const other = createCollectController({ ...test.services }, { now: test.now });
      await other.start();
      await other.create();
      expect(other.getSnapshot()).toMatchObject({ phase: 'unknown', committed: true });
      expect(test.invoices.create).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    { paymentRequest: 'lnbc1horsreseau' },
    { paymentRequest: 'lnbcrt1CasseMixte' },
    { paymentRequest: `lnbcrt1${'a'.repeat(2042)}` },
    { amountSats: 5555 },
    { amountXof: 9999 },
    { expiresAt: new Date(instant + 3_600_000).toISOString() },
  ])('une réponse créée invalide conserve l’incertitude : %p', async (patch) => {
    const test = harness();
    test.invoices.create.mockImplementation(async ({ quote }) => {
      const request = test.request(quote);
      return ok({ ...request, invoice: { ...request.invoice, ...patch } });
    });
    await prepared(test);
    await test.controller.create();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      request: null,
      committed: true,
      error: { code: 'INVALID_DATA' },
    });
    test.controller.newRequest();
    expect(test.controller.getSnapshot().phase).toBe('unknown');
  });
  it('préserve exactement une facture uniformément en majuscules', async () => {
    const test = harness();
    test.invoices.create.mockImplementation(async ({ quote }) => {
      const value = test.request(quote);
      return ok({
        ...value,
        invoice: { ...value.invoice, paymentRequest: value.invoice.paymentRequest.toUpperCase() },
      });
    });
    await prepared(test);
    await test.controller.create();
    expect(test.controller.getSnapshot().request!.invoice.paymentRequest).toBe(
      test.controller.getSnapshot().request!.invoice.paymentRequest.toUpperCase(),
    );
    expect(test.controller.getSnapshot().phase).toBe('waiting');
  });
  it('le retour tardif d’une création détruite rejoint la session sans créer une deuxième facture', async () => {
    const test = harness();
    const result = deferred<HomeResult<CollectRequest>>();
    test.invoices.create.mockReturnValue(result.promise);
    await prepared(test);
    const creating = test.controller.create();
    await drain();
    const quote = test.controller.getSnapshot().quote!;
    test.controller.dispose();
    const other = createCollectController(test.services, { now: test.now });
    await other.start();
    expect(other.getSnapshot().phase).toBe('creating');
    result.resolve(ok(test.request(quote)));
    await creating;
    expect(other.getSnapshot()).toMatchObject({ phase: 'waiting', committed: true });
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    expect(test.controller.getSnapshot().request).toBeNull();
  });
});

describe('encaisser | preuve du règlement', () => {
  it.each(['identifiant', 'facture', 'facture-majuscules', 'les-deux'])(
    'une nouvelle vente ne réutilise pas une ancienne identité : %s',
    async (duplicate) => {
      const test = harness();
      await waiting(test);
      const first = test.requests[0]!;
      test.emit({ type: 'paiement', payment: test.payment(first) });
      test.controller.newRequest();
      await test.controller.prepare('2500');
      test.invoices.create.mockImplementationOnce(async ({ quote }) => {
        const fresh = test.request(quote);
        return ok({
          paymentId:
            duplicate === 'identifiant' || duplicate === 'les-deux'
              ? first.paymentId
              : fresh.paymentId,
          invoice: {
            ...fresh.invoice,
            paymentRequest:
              duplicate === 'facture' || duplicate === 'les-deux'
                ? first.invoice.paymentRequest
                : duplicate === 'facture-majuscules'
                  ? first.invoice.paymentRequest.toUpperCase()
                  : fresh.invoice.paymentRequest,
          },
        });
      });
      await test.controller.create();
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'unknown',
        request: null,
        receipt: null,
        committed: true,
        error: { code: 'INVALID_DATA' },
        previousReceipts: [{ paymentId: first.paymentId }],
      });
      expect(test.invoices.create).toHaveBeenCalledTimes(2);
      expect(test.invoices.lookup).toHaveBeenCalledTimes(1);
    },
  );
  it.each(['identifiant', 'facture'])(
    'une identité reste utilisée après la sortie de son reçu de la liste visible : %s',
    async (duplicate) => {
      const test = harness();
      await test.controller.start();
      for (let index = 0; index < 12; index += 1) {
        await test.controller.prepare('2500');
        await test.controller.create();
        test.emit({ type: 'paiement', payment: test.payment() });
        test.controller.newRequest();
      }
      const first = test.requests[0]!;
      expect(test.controller.getSnapshot().previousReceipts).toHaveLength(10);
      expect(
        test.controller
          .getSnapshot()
          .previousReceipts.some((receipt) => receipt.paymentId === first.paymentId),
      ).toBe(false);
      await test.controller.prepare('2500');
      test.invoices.create.mockImplementationOnce(async ({ quote }) => {
        const fresh = test.request(quote);
        return ok({
          paymentId: duplicate === 'identifiant' ? first.paymentId : fresh.paymentId,
          invoice: {
            ...fresh.invoice,
            paymentRequest:
              duplicate === 'facture' ? first.invoice.paymentRequest : fresh.invoice.paymentRequest,
          },
        });
      });
      await test.controller.create();
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'unknown',
        receipt: null,
        request: null,
        error: { code: 'INVALID_DATA' },
      });
    },
  );
  it('un montant identique et un solde changé ne prouvent pas le paiement de cette demande', async () => {
    const test = harness();
    await waiting(test);
    test.emit({ type: 'paiement', payment: test.payment(undefined, { id: 'autre-demande' }) });
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'waiting', receipt: null });
  });
  it.each([
    { id: 'autre-demande' },
    { direction: 'envoye' as const },
    { amountSats: 5555 },
    { feeSats: 1 },
  ])('un résultat sans preuve exacte ne devient pas payé : %p', async (patch) => {
    const test = harness();
    await waiting(test);
    const request = test.requests[0]!;
    test.invoices.lookup.mockResolvedValue(
      ok({ paymentRequest: request.invoice.paymentRequest, payment: test.payment(request, patch) }),
    );
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      receipt: null,
      error: { code: 'PAYMENT_MISMATCH' },
    });
  });
  it('une lecture qui renvoie une autre facture est refusée même si son montant correspond', async () => {
    const test = harness();
    await waiting(test);
    test.invoices.lookup.mockResolvedValue(
      ok({ paymentRequest: 'lnbcrt1autrefacture', payment: test.payment() }),
    );
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'unknown', receipt: null });
  });
  it('un paiement encore en attente n’est jamais marqué payé', async () => {
    const test = harness();
    await waiting(test);
    test.emit({ type: 'paiement', payment: test.payment(undefined, { status: 'en_attente' }) });
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'waiting',
      payment: { status: 'en_attente' },
      receipt: null,
    });
  });
  it('le reçu conserve le prix demandé sans inventer une contrevaleur historique du paiement', async () => {
    const test = harness();
    await waiting(test);
    test.emit({ type: 'paiement', payment: test.payment(undefined, { amountXof: 9999 }) });
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'paid',
      receipt: {
        amountXof: 2500,
        amountSats: 5556,
        paymentId: test.requests[0]!.paymentId,
        confirmedAt: test.iso(),
        late: false,
      },
      payment: { amountXof: 9999 },
    });
  });
  it('un événement arrivé avant la réponse de création attend la preuve de son identifiant exact', async () => {
    const test = harness();
    const result = deferred<HomeResult<CollectRequest>>();
    test.invoices.create.mockReturnValue(result.promise);
    await prepared(test);
    const creating = test.controller.create();
    await drain();
    const request = test.request(test.controller.getSnapshot().quote!);
    test.emit({ type: 'paiement', payment: test.payment(request) });
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'creating', receipt: null });
    result.resolve(ok(request));
    await creating;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'paid',
      receipt: { paymentId: request.paymentId },
    });
  });
  it('un événement périmé ne rétrograde pas un règlement confirmé', async () => {
    const test = harness();
    await waiting(test);
    test.emit({ type: 'paiement', payment: test.payment() });
    test.emit({ type: 'paiement', payment: test.payment(undefined, { status: 'en_attente' }) });
    expect(test.controller.getSnapshot().phase).toBe('paid');
  });
  it.each(['erreur', 'autre-facture', 'exception'])(
    'une lecture terminée après la preuve ne réécrit pas son résultat : %s',
    async (outcome) => {
      const test = harness();
      await waiting(test);
      const read = deferred<HomeResult<{ paymentRequest: string; payment: HomePayment | null }>>();
      test.invoices.lookup.mockReturnValueOnce(read.promise);
      const refreshing = test.controller.refresh();
      await drain();
      test.emit({ type: 'paiement', payment: test.payment() });
      const receipt = test.controller.getSnapshot().receipt;
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'paid',
        error: null,
        canNewRequest: true,
      });
      if (outcome === 'exception') read.reject(new Error('lecture interrompue'));
      else if (outcome === 'erreur') read.resolve(fail('NETWORK_OFFLINE'));
      else read.resolve(ok({ paymentRequest: 'lnbcrt1autrefacture', payment: null }));
      await refreshing;
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'paid',
        error: null,
        canNewRequest: true,
        busy: false,
      });
      expect(test.controller.getSnapshot().receipt).toBe(receipt);
    },
  );
});

describe('encaisser | expiration, archives et reprise', () => {
  it('un paiement créé avant le délai mais vérifié après garde la date de confirmation réellement observée', async () => {
    const test = harness();
    await waiting(test);
    const request = test.requests[0]!;
    const createdAt = test.iso(60_000);
    test.controller.suspend();
    test.advance(300_001);
    test.invoices.lookup.mockResolvedValue(
      ok({
        paymentRequest: request.invoice.paymentRequest,
        payment: test.payment(request, { createdAt }),
      }),
    );
    await test.controller.resume();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'late',
      receipt: { late: true, confirmedAt: test.iso() },
    });
    expect(test.controller.getSnapshot().receipt!.confirmedAt).not.toBe(createdAt);
  });
  it('le compteur expiré ne crée rien et conserve le suivi de la même demande', async () => {
    const test = harness();
    await waiting(test);
    test.advance(300_000);
    test.controller.tick();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'expired',
      remainingSeconds: 0,
      committed: true,
      canRefresh: true,
      canNewRequest: true,
    });
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
    test.emit({ type: 'paiement', payment: test.payment() });
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'late',
      receipt: { late: true, amountXof: 2500 },
    });
  });
  it('une nouvelle demande explicite conserve l’ancienne identité et distingue sa confirmation tardive', async () => {
    const test = harness();
    await waiting(test);
    const first = test.requests[0]!;
    test.advance(300_001);
    test.controller.tick();
    test.controller.newRequest();
    await test.controller.prepare('1000');
    await test.controller.create();
    const second = test.requests[1]!;
    test.emit({ type: 'paiement', payment: test.payment(first) });
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'waiting',
      request: { paymentId: second.paymentId },
      receipt: null,
      previousReceipts: [{ paymentId: first.paymentId, amountXof: 2500, late: true }],
    });
    test.emit({ type: 'paiement', payment: test.payment(second) });
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'paid',
      receipt: { paymentId: second.paymentId, amountXof: 1000 },
    });
  });
  it('la relecture cherche également les anciennes factures exactes', async () => {
    const test = harness();
    await waiting(test);
    const first = test.requests[0]!;
    test.advance(300_001);
    test.controller.newRequest();
    await test.controller.prepare('1000');
    await test.controller.create();
    test.invoices.lookup.mockImplementation(async ({ paymentId, paymentRequest }) =>
      ok({ paymentRequest, payment: paymentId === first.paymentId ? test.payment(first) : null }),
    );
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'waiting',
      receipt: null,
      previousReceipts: [{ paymentId: first.paymentId }],
    });
  });
  it('la limite de vingt anciennes demandes bloque le renouvellement au lieu de perdre un identifiant', async () => {
    const test = harness();
    await test.controller.start();
    for (let index = 0; index < 21; index += 1) {
      await test.controller.prepare('2500');
      await test.controller.create();
      test.advance(300_001);
      test.controller.tick();
      if (index < 20) test.controller.newRequest();
    }
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'expired', canNewRequest: false });
    const currentId = test.controller.getSnapshot().request!.paymentId;
    test.controller.newRequest();
    expect(test.controller.getSnapshot().request!.paymentId).toBe(currentId);
    expect(test.invoices.create).toHaveBeenCalledTimes(21);
    test.emit({ type: 'paiement', payment: test.payment(test.requests[0]) });
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'expired',
      canNewRequest: true,
      previousReceipts: [{ paymentId: test.requests[0]!.paymentId }],
    });
  });
  it('le verrouillage masque immédiatement le QR, le prix et les reçus sans annuler la facture', async () => {
    const test = harness();
    await waiting(test);
    test.emit({ type: 'etat', state: 'verrouille' });
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'locked',
      request: null,
      quote: null,
      receipt: null,
      previousReceipts: [],
      committed: true,
    });
    test.setState('pret');
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'waiting',
      request: { paymentId: test.requests[0]!.paymentId },
    });
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
  });
  it('une réponse de devis reçue après le passage en arrière-plan reste invisible', async () => {
    const test = harness();
    const result = deferred<HomeResult<SendQuote>>();
    test.rates.quote.mockReturnValue(result.promise);
    await test.controller.start();
    const preparing = test.controller.prepare('2500');
    test.controller.suspend();
    result.resolve(ok(test.quote()));
    await preparing;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'suspended',
      quote: null,
      request: null,
    });
  });
  it('la création en cours survit à l’arrière-plan et la reprise relit la même facture', async () => {
    const test = harness();
    const result = deferred<HomeResult<CollectRequest>>();
    test.invoices.create.mockReturnValue(result.promise);
    await prepared(test);
    const creating = test.controller.create();
    await drain();
    const request = test.request(test.controller.getSnapshot().quote!);
    test.controller.suspend();
    result.resolve(ok(request));
    await creating;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'suspended',
      request: null,
      quote: null,
      committed: true,
    });
    await test.controller.resume();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'waiting',
      request: { paymentId: request.paymentId },
    });
    expect(test.invoices.create).toHaveBeenCalledTimes(1);
  });
  it('un écran initialement en arrière-plan peut créer et recevoir après sa première reprise', async () => {
    const test = harness();
    test.controller.suspend();
    await test.controller.resume();
    await test.controller.prepare('2500');
    await test.controller.create();
    test.emit({ type: 'paiement', payment: test.payment() });
    expect(test.controller.getSnapshot().phase).toBe('paid');
  });
});

describe('encaisser | atelier fictif contrôlé', () => {
  it('fige l’échéance du prix depuis une seule lecture de l’horloge', async () => {
    let movingTime = Date.UTC(2026, 10, 12, 12);
    const services = createCollectPreviewServices('waiting', { now: () => movingTime++ });
    const result = await services.rates!.quote(2500);
    if (!result.ok) throw Error('Prix fictif indisponible');
    expect(Date.parse(result.value.expiresAt) - Date.parse(result.value.createdAt)).toBe(300_000);
  });
  it.each([
    ['waiting', 'waiting'],
    ['paid', 'paid'],
    ['expired', 'expired'],
    ['late', 'late'],
    ['unknown', 'unknown'],
    ['mismatch', 'unknown'],
    ['longInvoice', 'waiting'],
  ] as const)('scénario %s sans réseau ni paiement réel', async (scenario, phase) => {
    const services = createCollectPreviewServices(scenario, { now: () => instant });
    const controller = createCollectController(services, { now: services.now });
    await controller.start();
    await controller.prepare('2500');
    await controller.create();
    expect(controller.getSnapshot()).toMatchObject({ mode: 'preview', phase });
  });
  it('attendre ou actualiser ne simule pas un succès sans confirmation explicite', async () => {
    const services = createCollectPreviewServices('waiting', { now: () => instant });
    const controller = createCollectController(services, { now: services.now });
    await controller.start();
    await controller.prepare('2500');
    await controller.create();
    await controller.refresh();
    expect(controller.getSnapshot().phase).toBe('waiting');
    services.confirmPayment();
    expect(controller.getSnapshot().phase).toBe('paid');
  });
});
