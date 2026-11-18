import type {
  HomeBalance,
  HomePayment,
  HomeResult,
  HomeWalletEvent,
  HomeWalletState,
} from '../src/home/ports';
import {
  createSendController,
  normalizeSendDestination,
  parseSendAmount,
} from '../src/send/controller';
import type {
  SendPaymentPreview,
  SendQuote,
  SendRatePort,
  SendServices,
  SendWalletPort,
} from '../src/send/ports';
import {
  createSendPreviewServices,
  sendPreviewAddress,
  sendPreviewInvoice,
} from '../src/send/preview';

const instant = Date.parse('2026-11-10T12:00:00.000Z');
const iso = (offset = 0) => new Date(instant + offset).toISOString();
const invoice = sendPreviewInvoice;
const address = sendPreviewAddress;
// Code synthétique de test uniquement ; aucun PIN de personne ou de wallet réel.
const testPin = '000000';
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

function payment(patch: Partial<HomePayment> = {}): HomePayment {
  return {
    id: 'paiement-fictif',
    direction: 'envoye',
    status: 'reussi',
    amountSats: 10_000,
    feeSats: 12,
    amountXof: 4500,
    createdAt: iso(),
    memo: null,
    failure: null,
    ...patch,
  };
}

function harness(initialState: HomeWalletState = 'pret') {
  let time = instant;
  let state = initialState;
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const balance: HomeBalance = {
    spendableSats: 100_000,
    pendingSats: 0,
    spendableXof: 45_000,
    rate: { xofPerBtc: 45_000_000, source: 'fixe', fetchedAt: iso() },
    updatedAt: iso(),
  };
  const preview: SendPaymentPreview = {
    kind: 'facture',
    destination: invoice,
    amountSats: 10_000,
    maxFeeSats: 100,
    amountXof: 4500,
    maxFeeXof: 45,
    memo: null,
    expiresAt: iso(3_600_000),
    newRecipient: true,
  };
  const makeQuote = (amountXof: number): SendQuote => ({
    id: 'devis-fictif',
    amountXof,
    amountSats: Number((BigInt(amountXof) * 100_000_000n + 44_999_999n) / 45_000_000n),
    xofPerBtc: 45_000_000,
    source: 'fixe',
    createdAt: iso(),
    expiresAt: iso(300_000),
  });
  const wallet: jest.Mocked<SendWalletPort> = {
    state: jest.fn(async () => state),
    balance: jest.fn(async () => ok(balance)),
    preview: jest.fn<ReturnType<SendWalletPort['preview']>, Parameters<SendWalletPort['preview']>>(
      async (destination, amountSats) =>
        ok({
          ...preview,
          destination,
          kind: destination.includes('@') ? 'adresse_lightning' : 'facture',
          amountSats: amountSats ?? preview.amountSats,
        }),
    ),
    send: jest.fn<ReturnType<SendWalletPort['send']>, Parameters<SendWalletPort['send']>>(
      async () => ok(payment()),
    ),
    history: jest.fn(async () => ok([payment()])),
    subscribe: jest.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const rates: jest.Mocked<SendRatePort> = {
    quote: jest.fn(async (amountXof) => ok(makeQuote(amountXof))),
  };
  const services: SendServices = { mode: 'native', wallet, rates };
  const controller = createSendController(services, { now: () => time });
  return {
    controller,
    wallet,
    rates,
    services,
    balance,
    preview,
    makeQuote,
    setState(next: HomeWalletState) {
      state = next;
    },
    advance(ms: number) {
      time += ms;
    },
    now: () => time,
    emit(event: HomeWalletEvent) {
      listeners.forEach((listener) => listener(event));
    },
  };
}

async function review(test: ReturnType<typeof harness>) {
  await test.controller.start();
  test.controller.setDestination(invoice);
  await test.controller.inspect();
  expect(test.controller.getSnapshot().phase).toBe('review');
}

async function pin(test: ReturnType<typeof harness>) {
  await review(test);
  test.controller.requestPin();
  expect(test.controller.getSnapshot().phase).toBe('pin');
}

describe('envoyer | formats externes', () => {
  it.each([
    'https://example.com',
    'lnbc1exemple',
    'lntb1exemple',
    'lnbcrt1Exemple',
    'exemple@127.0.0.1',
    'exemple@teranga.example\u202e',
    'a'.repeat(8193),
  ])('refuse une entrée non utilisable : %s', (value) => {
    expect(normalizeSendDestination(value)).toBeNull();
  });
  it('normalise le schéma et les chaînes uniformément en majuscules sans accepter de casse mélangée', () => {
    expect(normalizeSendDestination(` LIGHTNING:${invoice.toUpperCase()} `)).toBe(invoice);
    expect(normalizeSendDestination('LIGHTNING:EXEMPLE@TERANGA.EXAMPLE')).toBe(address);
  });
  it.each([
    '',
    '0',
    '-1',
    '1.5',
    '1,5',
    '1e3',
    '5 000',
    '5000001',
    '9007199254740992',
    '\u200b100',
  ])('refuse un montant FCFA ambigu ou hors limites : %s', (value) => {
    expect(parseSendAmount(value)).toBeNull();
  });
  it('accepte uniquement les entiers FCFA positifs dans le plafond T17', () => {
    expect(parseSendAmount(' 1000 ')).toBe(1000);
    expect(parseSendAmount('5000000')).toBe(5_000_000);
  });
});

describe('envoyer | lecture et devis', () => {
  it('ne remplace jamais un service absent par un wallet simulé', async () => {
    const test = harness();
    const controller = createSendController({ ...test.services, mode: 'unavailable' });
    await controller.start();
    expect(controller.getSnapshot()).toMatchObject({
      phase: 'unavailable',
      balance: null,
      committed: false,
    });
    expect(test.wallet.state).not.toHaveBeenCalled();
    expect(test.wallet.send).not.toHaveBeenCalled();
  });
  it.each([
    ['absent', 'absent'],
    ['verrouille', 'locked'],
    ['hors_ligne', 'offline'],
    ['synchronisation', 'offline'],
  ] as const)('un wallet %s ne permet pas une préparation de paiement', async (state, phase) => {
    const test = harness(state);
    await test.controller.start();
    await test.controller.inspect(invoice);
    expect(test.controller.getSnapshot()).toMatchObject({ phase, preview: null });
    expect(test.wallet.balance).not.toHaveBeenCalled();
    expect(test.wallet.preview).not.toHaveBeenCalled();
  });
  it('refuse une valeur de solde mal formée plutôt que de confirmer un faux disponible', async () => {
    const test = harness();
    test.wallet.balance.mockResolvedValue(ok({ ...test.balance, spendableSats: -1 }));
    await test.controller.start();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'error',
      error: { code: 'INVALID_DATA' },
    });
  });
  it('permet une nouvelle lecture explicite après une erreur ou un retour du réseau', async () => {
    const test = harness('hors_ligne');
    await test.controller.start();
    test.setState('pret');
    test.wallet.balance.mockResolvedValueOnce(fail('READ_FAILED'));
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'error',
      error: { code: 'READ_FAILED' },
    });
    await test.controller.refresh();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'destination',
      error: null,
      committed: false,
    });
    expect(test.wallet.send).not.toHaveBeenCalled();
  });
  it('lire une facture fixe prépare un récapitulatif et ne paie rien', async () => {
    const test = harness();
    await review(test);
    expect(test.controller.getSnapshot()).toMatchObject({
      destination: invoice,
      totalMaxSats: 10_100,
      totalMaxXof: 4545,
      committed: false,
    });
    expect(test.wallet.preview).toHaveBeenCalledWith(invoice);
    expect(test.wallet.send).not.toHaveBeenCalled();
  });
  it('arrondit le total maximum entier au-dessus même si les champs estimés T21 sont arrondis au-dessous', async () => {
    const test = harness();
    test.wallet.preview.mockResolvedValue(
      ok({ ...test.preview, amountSats: 1, maxFeeSats: 1, amountXof: 0, maxFeeXof: 0 }),
    );
    await review(test);
    expect(test.controller.getSnapshot()).toMatchObject({
      totalMaxSats: 2,
      totalMaxXof: 1,
      preview: { amountXof: 0, maxFeeXof: 1 },
    });
  });
  it('utilise un seul taux figé pour le montant, les frais et le total d’une facture fixe', async () => {
    const test = harness();
    test.wallet.preview.mockResolvedValue(
      ok({ ...test.preview, amountXof: 9999, maxFeeXof: 9999 }),
    );
    await review(test);
    expect(test.controller.getSnapshot()).toMatchObject({
      preview: { amountXof: 4500, maxFeeXof: 45 },
      totalMaxXof: 4545,
    });
  });
  it('ne propage pas des champs supplémentaires d’un fournisseur dans les snapshots', async () => {
    const test = harness();
    test.wallet.balance.mockResolvedValue(
      ok({
        ...test.balance,
        privateExtra: 'ne-pas-conserver',
        rate: { ...test.balance.rate!, privateExtra: 'ne-pas-conserver' },
      }),
    );
    test.wallet.preview.mockResolvedValue(
      ok({ ...test.preview, privateExtra: 'ne-pas-conserver' }),
    );
    test.wallet.send.mockResolvedValue(ok({ ...payment(), privateExtra: 'ne-pas-conserver' }));
    await pin(test);
    await test.controller.confirm(testPin);
    expect(JSON.stringify(test.controller.getSnapshot())).not.toContain('ne-pas-conserver');
  });
  it('une adresse réclame le montant FCFA avant le décodage T21', async () => {
    const test = harness();
    await test.controller.start();
    await test.controller.inspect(address);
    expect(test.controller.getSnapshot().phase).toBe('amount');
    expect(test.wallet.preview).not.toHaveBeenCalled();
    await test.controller.quoteAmount('1000');
    expect(test.rates.quote).toHaveBeenCalledWith(1000);
    expect(test.wallet.preview).toHaveBeenCalledWith(address, 2223);
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      quote: { amountXof: 1000, amountSats: 2223 },
      preview: { amountXof: 1000 },
      totalMaxSats: 2323,
      totalMaxXof: 1046,
    });
  });
  it('une facture à montant libre réclame aussi le devis FCFA', async () => {
    const test = harness();
    test.wallet.preview.mockResolvedValueOnce(
      ok({ ...test.preview, amountSats: null, amountXof: null }),
    );
    await test.controller.start();
    await test.controller.inspect(invoice);
    expect(test.controller.getSnapshot().phase).toBe('amount');
    await test.controller.quoteAmount('1000');
    expect(test.controller.getSnapshot().phase).toBe('review');
    expect(test.wallet.preview).toHaveBeenLastCalledWith(invoice, 2223);
  });
  it('refuse la confirmation si le montant et le plafond dépassent le disponible', async () => {
    const test = harness();
    test.wallet.balance.mockResolvedValue(ok({ ...test.balance, spendableSats: 10_099 }));
    await test.controller.start();
    await test.controller.inspect(invoice);
    test.controller.requestPin();
    await test.controller.confirm(testPin);
    expect(test.controller.getSnapshot()).toMatchObject({
      error: { code: 'INSUFFICIENT_FUNDS' },
      committed: false,
    });
    expect(test.wallet.send).not.toHaveBeenCalled();
  });
  it('une facture fixe supérieure au disponible exige une autre demande au lieu de permettre de modifier son montant', async () => {
    const test = harness();
    test.wallet.balance.mockResolvedValue(ok({ ...test.balance, spendableSats: 9999 }));
    await test.controller.start();
    await test.controller.inspect(invoice);
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'destination',
      preview: null,
      error: { code: 'INSUFFICIENT_FUNDS' },
    });
    await test.controller.quoteAmount('1000');
    expect(test.rates.quote).not.toHaveBeenCalled();
  });
  it('une facture déjà expirée exige une autre demande sans proposer une nouvelle saisie de montant', async () => {
    const test = harness();
    test.wallet.preview.mockResolvedValue(
      ok({ ...test.preview, amountSats: null, amountXof: null, expiresAt: iso(-1) }),
    );
    await test.controller.start();
    await test.controller.inspect(invoice);
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'destination',
      preview: null,
      error: { code: 'INVOICE_EXPIRED' },
    });
    await test.controller.quoteAmount('1000');
    expect(test.rates.quote).not.toHaveBeenCalled();
  });
  it.each([{ amountXof: null }, { maxFeeXof: null }])(
    'interdit le PIN quand la lecture FCFA est incomplète : %p',
    async (patch) => {
      const test = harness();
      test.wallet.preview.mockResolvedValue(ok({ ...test.preview, ...patch }));
      await review(test);
      test.controller.requestPin();
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'review',
        error: { code: 'RATE_UNAVAILABLE' },
      });
      expect(test.wallet.send).not.toHaveBeenCalled();
    },
  );
  it.each([
    { amountSats: 2222 },
    { amountXof: 1001 },
    { xofPerBtc: 0 },
    { expiresAt: iso(-1) },
    { expiresAt: iso(300001) },
    { createdAt: '2026-02-30T12:00:00.000Z' },
  ])('refuse un devis externe incohérent : %p', async (patch) => {
    const test = harness();
    test.rates.quote.mockResolvedValue(ok({ ...test.makeQuote(1000), ...patch }));
    await test.controller.start();
    await test.controller.inspect(address);
    await test.controller.quoteAmount('1000');
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'amount',
      error: { code: 'INVALID_DATA' },
    });
    expect(test.wallet.preview).not.toHaveBeenCalled();
  });
  it('refuse un décodage qui remplace le destinataire ou le montant du devis', async () => {
    const test = harness();
    test.wallet.preview.mockResolvedValue(
      ok({ ...test.preview, destination: address, kind: 'adresse_lightning', amountSats: 2222 }),
    );
    await test.controller.start();
    await test.controller.inspect(address);
    await test.controller.quoteAmount('1000');
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'amount',
      error: { code: 'INVALID_DATA' },
    });
  });
  it('invalide la lecture en cours quand le téléphone passe en arrière-plan', async () => {
    const test = harness();
    const read = deferred<HomeResult<SendPaymentPreview>>();
    test.wallet.preview.mockReturnValue(read.promise);
    await test.controller.start();
    const reading = test.controller.inspect(invoice);
    test.controller.suspend();
    read.resolve(ok(test.preview));
    await reading;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'suspended',
      preview: null,
      destination: '',
      balance: null,
    });
  });
  it('purge immédiatement les données lors du verrouillage, sans réafficher la réponse périmée', async () => {
    const test = harness();
    const read = deferred<HomeResult<SendPaymentPreview>>();
    test.wallet.preview.mockReturnValue(read.promise);
    await test.controller.start();
    const reading = test.controller.inspect(invoice);
    test.emit({ type: 'etat', state: 'verrouille' });
    read.resolve(ok(test.preview));
    await reading;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'locked',
      preview: null,
      destination: '',
      balance: null,
    });
  });
});

describe('envoyer | confirmation explicite et PIN', () => {
  it('requiert un appui séparé après le PIN et transmet exactement le plafond accepté', async () => {
    const test = harness();
    await pin(test);
    expect(test.wallet.send).not.toHaveBeenCalled();
    await test.controller.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
    expect(test.wallet.send).toHaveBeenCalledWith({
      destination: invoice,
      amountSats: 10_000,
      maxFeeSats: 100,
      pin: testPin,
    });
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'success',
      payment: { feeSats: 12 },
    });
    expect(JSON.stringify(test.controller.getSnapshot())).not.toContain('"pin"');
    expect(JSON.stringify(test.controller.getSnapshot())).not.toContain(JSON.stringify(testPin));
  });
  it.each(['', '00000', '0000000', '00a000', '٠٠٠٠٠٠'])(
    'un format PIN incorrect ne traverse pas le port wallet : %s',
    async (value) => {
      const test = harness();
      await pin(test);
      await test.controller.confirm(value);
      expect(test.wallet.send).not.toHaveBeenCalled();
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'pin',
        error: { code: 'PIN_FORMAT' },
      });
    },
  );
  it('conserve le récapitulatif mais jamais le PIN après un refus du wallet', async () => {
    const test = harness();
    test.wallet.send.mockResolvedValue({
      ok: false,
      error: { code: 'PIN_INVALID', attemptsLeft: 4 },
    });
    await pin(test);
    await test.controller.confirm(testPin);
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'pin',
      committed: false,
      error: { code: 'PIN_INVALID', attemptsLeft: 4 },
    });
    test.wallet.send.mockResolvedValue(ok(payment()));
    await test.controller.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(2);
    expect(test.controller.getSnapshot().phase).toBe('success');
  });
  it('respecte le délai imposé par le wallet après PIN_LOCKED', async () => {
    const test = harness();
    test.wallet.send.mockResolvedValueOnce({
      ok: false,
      error: { code: 'PIN_LOCKED', retryAfterSeconds: 30 },
    });
    await pin(test);
    await test.controller.confirm(testPin);
    await test.controller.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
    test.advance(30_000);
    await test.controller.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(2);
  });
  it('la temporisation du PIN survit à la modification du destinataire et à la réouverture de l’écran', async () => {
    const test = harness();
    test.wallet.send.mockResolvedValueOnce({
      ok: false,
      error: { code: 'PIN_LOCKED', retryAfterSeconds: 30 },
    });
    await pin(test);
    await test.controller.confirm(testPin);
    test.controller.setDestination(invoice);
    await test.controller.inspect();
    test.controller.requestPin();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      error: { code: 'PIN_LOCKED' },
      retryAt: instant + 30_000,
    });
    test.controller.dispose();
    const reopened = createSendController(test.services, { now: test.now });
    await reopened.start();
    await reopened.inspect(invoice);
    reopened.requestPin();
    await reopened.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
    test.advance(30_000);
    reopened.requestPin();
    await reopened.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(2);
  });
  it('refuse un devis expiré avant de demander le PIN', async () => {
    const test = harness();
    await review(test);
    test.advance(300_000);
    test.controller.requestPin();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      error: { code: 'QUOTE_EXPIRED' },
    });
    expect(test.wallet.send).not.toHaveBeenCalled();
  });
  it('revérifie l’expiration après la lecture asynchrone de l’état et avant de payer', async () => {
    const test = harness();
    await pin(test);
    const state = deferred<HomeWalletState>();
    test.wallet.state.mockReturnValueOnce(state.promise);
    const sending = test.controller.confirm(testPin);
    test.advance(300_000);
    state.resolve('pret');
    await sending;
    expect(test.wallet.send).not.toHaveBeenCalled();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      error: { code: 'QUOTE_EXPIRED' },
      busy: false,
    });
  });
  it('un verrouillage survenu avant la remise du paiement interdit l’appel wallet.send', async () => {
    const test = harness();
    await pin(test);
    const state = deferred<HomeWalletState>();
    test.wallet.state.mockReturnValueOnce(state.promise);
    const sending = test.controller.confirm(testPin);
    test.emit({ type: 'etat', state: 'verrouille' });
    state.resolve('pret');
    await sending;
    expect(test.wallet.send).not.toHaveBeenCalled();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'locked',
      destination: '',
      preview: null,
    });
  });
  it('deux appuis rapprochés ne créent qu’un seul appel de paiement', async () => {
    const test = harness();
    const result = deferred<HomeResult<HomePayment>>();
    test.wallet.send.mockReturnValue(result.promise);
    await pin(test);
    const first = test.controller.confirm(testPin);
    const second = test.controller.confirm(testPin);
    await drain();
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
    result.resolve(ok(payment()));
    await Promise.all([first, second]);
  });
});

describe('envoyer | issue inconnue et protection de session', () => {
  it('un écran initialement en arrière-plan abonne aussi la barrière lors de sa première reprise', async () => {
    const test = harness();
    test.controller.suspend();
    await test.controller.resume();
    await test.controller.inspect(invoice);
    test.controller.requestPin();
    await test.controller.confirm(testPin);
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'success',
      committed: true,
      payment: { id: 'paiement-fictif' },
    });
  });
  it.each(['PAYMENT_TIMEOUT', 'PAYMENT_PENDING', 'UNKNOWN', 'ALREADY_PAID', 'NETWORK_OFFLINE'])(
    'ne propose jamais un nouvel envoi après %s, même en recréant l’écran',
    async (failure) => {
      const test = harness();
      test.wallet.send.mockResolvedValue(fail(failure));
      await pin(test);
      await test.controller.confirm(testPin);
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'unknown',
        committed: true,
        canRefreshPayment: false,
      });
      test.controller.edit();
      await test.controller.inspect(invoice);
      await test.controller.confirm(testPin);
      test.controller.dispose();
      const reopened = createSendController({ ...test.services }, { now: test.now });
      await reopened.start();
      await reopened.inspect(invoice);
      reopened.requestPin();
      await reopened.confirm(testPin);
      expect(reopened.getSnapshot()).toMatchObject({
        phase: 'unknown',
        committed: true,
        canRefreshPayment: false,
      });
      expect(test.wallet.send).toHaveBeenCalledTimes(1);
      await reopened.refreshPayment();
      expect(test.wallet.history).not.toHaveBeenCalled();
    },
  );
  it('une exception après l’appel send conserve l’issue inconnue, sans nouvel envoi automatique', async () => {
    const test = harness();
    test.wallet.send.mockRejectedValue(new Error('service interrompu'));
    await pin(test);
    await test.controller.confirm(testPin);
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      committed: true,
      error: { code: 'UNKNOWN' },
    });
  });
  it('deux contrôleurs qui attendent state() partagent la même barrière juste avant send()', async () => {
    const test = harness();
    const other = createSendController({ ...test.services }, { now: test.now });
    await pin(test);
    await other.start();
    await other.inspect(invoice);
    other.requestPin();
    const firstState = deferred<HomeWalletState>();
    const secondState = deferred<HomeWalletState>();
    const result = deferred<HomeResult<HomePayment>>();
    test.wallet.state
      .mockReturnValueOnce(firstState.promise)
      .mockReturnValueOnce(secondState.promise);
    test.wallet.send.mockReturnValue(result.promise);
    const first = test.controller.confirm(testPin);
    const second = other.confirm(testPin);
    firstState.resolve('pret');
    secondState.resolve('pret');
    await drain();
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
    expect(other.getSnapshot()).toMatchObject({ phase: 'sending', committed: true });
    result.resolve(fail('PAYMENT_TIMEOUT'));
    await Promise.all([first, second]);
    expect(other.getSnapshot()).toMatchObject({ phase: 'unknown', committed: true });
  });
  it('le résultat tardif d’un écran détruit met à jour la barrière et le nouvel écran', async () => {
    const test = harness();
    const result = deferred<HomeResult<HomePayment>>();
    test.wallet.send.mockReturnValue(result.promise);
    await pin(test);
    const sending = test.controller.confirm(testPin);
    await drain();
    test.controller.dispose();
    const reopened = createSendController(test.services, { now: test.now });
    await reopened.start();
    expect(reopened.getSnapshot()).toMatchObject({ phase: 'sending', committed: true });
    result.resolve(ok(payment()));
    await sending;
    expect(reopened.getSnapshot()).toMatchObject({
      phase: 'success',
      payment: { id: 'paiement-fictif' },
      busy: false,
    });
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'suspended',
      payment: null,
      preview: null,
    });
  });
  it.each(['PIN_INVALID', 'PIN_LOCKED'])(
    'un refus %s reçu après remontage quitte l’attente et conserve la temporisation applicable',
    async (failure) => {
      const test = harness();
      const result = deferred<HomeResult<HomePayment>>();
      test.wallet.send.mockReturnValue(result.promise);
      await pin(test);
      const sending = test.controller.confirm(testPin);
      await drain();
      test.controller.dispose();
      const reopened = createSendController(test.services, { now: test.now });
      await reopened.start();
      expect(reopened.getSnapshot()).toMatchObject({ phase: 'sending', busy: true });
      result.resolve({ ok: false, error: { code: failure, retryAfterSeconds: 30 } });
      await sending;
      await drain();
      expect(reopened.getSnapshot()).toMatchObject({
        phase: 'destination',
        committed: false,
        busy: false,
        retryAt: failure === 'PIN_LOCKED' ? instant + 30_000 : null,
      });
      await reopened.inspect(invoice);
      reopened.requestPin();
      expect(reopened.getSnapshot().phase).toBe(failure === 'PIN_LOCKED' ? 'review' : 'pin');
      expect(test.wallet.send).toHaveBeenCalledTimes(1);
    },
  );
  it('un paiement en arrière-plan conserve sa barrière sans afficher de données avant la reprise', async () => {
    const test = harness();
    const result = deferred<HomeResult<HomePayment>>();
    test.wallet.send.mockReturnValue(result.promise);
    await pin(test);
    const sending = test.controller.confirm(testPin);
    await drain();
    test.controller.suspend();
    result.resolve(fail('PAYMENT_TIMEOUT'));
    await sending;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'suspended',
      payment: null,
      preview: null,
      destination: '',
      balance: null,
    });
    await test.controller.resume();
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'unknown', committed: true });
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
  });
  it('un PIN refusé après le passage en arrière-plan ne révèle pas l’ancien récapitulatif', async () => {
    const test = harness();
    const result = deferred<HomeResult<HomePayment>>();
    test.wallet.send.mockReturnValue(result.promise);
    await pin(test);
    const sending = test.controller.confirm(testPin);
    await drain();
    test.controller.suspend();
    result.resolve(fail('PIN_INVALID'));
    await sending;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'suspended',
      payment: null,
      preview: null,
      destination: '',
    });
    await test.controller.resume();
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'destination', committed: false });
  });
  it('un résultat mal formé après soumission reste bloqué et ne se transforme pas en échec certain', async () => {
    const test = harness();
    test.wallet.send.mockResolvedValue(ok(payment({ amountSats: 99_999 })));
    await pin(test);
    await test.controller.confirm(testPin);
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      committed: true,
      error: { code: 'INVALID_DATA' },
    });
  });
});

describe('envoyer | suivi du même paiement', () => {
  it('une actualisation d’un identifiant connu lit l’historique sans jamais appeler send', async () => {
    const test = harness();
    test.wallet.send.mockResolvedValue(ok(payment({ status: 'en_attente', feeSats: 0 })));
    await pin(test);
    await test.controller.confirm(testPin);
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'pending',
      canRefreshPayment: true,
    });
    test.wallet.history.mockResolvedValue(
      ok([payment({ id: 'autre-paiement', status: 'reussi' }), payment({ status: 'reussi' })]),
    );
    await test.controller.refreshPayment();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'success',
      payment: { id: 'paiement-fictif', feeSats: 12 },
      canRefreshPayment: false,
    });
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
  });
  it('un historique sans correspondance ne devine pas le résultat à partir du montant', async () => {
    const test = harness();
    test.wallet.send.mockResolvedValue(ok(payment({ status: 'en_attente' })));
    await pin(test);
    await test.controller.confirm(testPin);
    test.wallet.history.mockResolvedValue(ok([payment({ id: 'autre-paiement' })]));
    await test.controller.refreshPayment();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'pending',
      payment: { id: 'paiement-fictif' },
    });
  });
  it('un échec de lecture conserve l’issue en attente', async () => {
    const test = harness();
    test.wallet.send.mockResolvedValue(ok(payment({ status: 'en_attente' })));
    await pin(test);
    await test.controller.confirm(testPin);
    test.wallet.history.mockRejectedValue(new Error('lecture interrompue'));
    await test.controller.refreshPayment();
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'pending', busy: false });
  });
  it('un événement du paiement connu met à jour son état, sans régression sur un événement périmé', async () => {
    const test = harness();
    test.wallet.send.mockResolvedValue(ok(payment({ status: 'en_attente' })));
    await pin(test);
    await test.controller.confirm(testPin);
    test.emit({ type: 'paiement', payment: payment({ id: 'autre-paiement' }) });
    expect(test.controller.getSnapshot().phase).toBe('pending');
    test.emit({ type: 'paiement', payment: payment() });
    expect(test.controller.getSnapshot().phase).toBe('success');
    test.emit({ type: 'paiement', payment: payment({ status: 'en_attente' }) });
    expect(test.controller.getSnapshot().phase).toBe('success');
  });
  it('un résultat final connu autorise un nouveau parcours après retour et réouverture explicites', async () => {
    const test = harness();
    await pin(test);
    await test.controller.confirm(testPin);
    test.controller.dispose();
    const reopened = createSendController(test.services, { now: test.now });
    await reopened.start();
    expect(reopened.getSnapshot()).toMatchObject({ phase: 'destination', committed: false });
  });
});

describe('envoyer | atelier strictement fictif', () => {
  it('simule un succès sans réseau ni SDK et avec des identifiants de démonstration explicites', async () => {
    const services = createSendPreviewServices('success', { now: () => instant });
    const controller = createSendController(services, { now: () => instant });
    await controller.start();
    await controller.inspect(invoice);
    controller.requestPin();
    await controller.confirm(testPin);
    expect(controller.getSnapshot()).toMatchObject({
      mode: 'preview',
      phase: 'success',
      payment: { id: 'apercu-envoi-fictif' },
    });
  });
  it('le scénario en attente ne devient pas un faux succès après une lecture', async () => {
    const services = createSendPreviewServices('pending', { now: () => instant });
    const controller = createSendController(services, { now: () => instant });
    await controller.start();
    await controller.inspect(invoice);
    controller.requestPin();
    await controller.confirm(testPin);
    await controller.refreshPayment();
    expect(controller.getSnapshot()).toMatchObject({
      mode: 'preview',
      phase: 'pending',
      payment: { status: 'en_attente' },
    });
  });
});
