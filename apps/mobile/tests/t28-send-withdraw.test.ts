import type { HomePayment, HomeResult, HomeWalletState } from '../src/home/ports';
import { createSendController } from '../src/send/controller';
import type { SendPaymentPreview, SendQuote, SendWalletPort } from '../src/send/ports';
import {
  createSendPreviewServices,
  sendPreviewAddress,
  sendPreviewInvoice,
} from '../src/send/preview';
import { createWithdrawController } from '../src/withdraw/controller';
import type {
  WithdrawBridgePort,
  WithdrawJournalPort,
  WithdrawOperation,
  WithdrawResult,
} from '../src/withdraw/ports';
import { createWithdrawPreviewServices } from '../src/withdraw/preview';

const instant = Date.UTC(2026, 10, 12, 12);
// Six chiffres inventés pour les ports fictifs ; aucun code personnel.
const testPin = '000000';
const ok = <T>(value: T): HomeResult<T> => ({ ok: true, value });
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
  for (let step = 0; step < 50; step += 1) await Promise.resolve();
}
const controllers: { dispose(): void }[] = [];
function sending() {
  const base = createSendPreviewServices('success', { now: () => instant });
  const wallet: jest.Mocked<SendWalletPort> = {
    state: jest.fn(base.wallet!.state),
    balance: jest.fn(base.wallet!.balance),
    preview: jest.fn(base.wallet!.preview),
    send: jest.fn(base.wallet!.send),
    history: jest.fn(base.wallet!.history),
    subscribe: jest.fn(base.wallet!.subscribe),
  };
  const services = { ...base, wallet };
  const controller = createSendController(services, { now: () => instant });
  controllers.push(controller);
  return {
    services,
    controller,
    wallet,
    reopen() {
      const next = createSendController(services, { now: () => instant });
      controllers.push(next);
      return next;
    },
  };
}
async function pin(test: ReturnType<typeof sending>) {
  await test.controller.start();
  await test.controller.inspect(sendPreviewInvoice);
  await test.controller.requestPin();
  expect(test.controller.getSnapshot().phase).toBe('pin');
}
function payment(status: HomePayment['status'] = 'reussi'): HomePayment {
  return {
    id: 'paiement-tardif-fictif-t28',
    direction: 'envoye',
    status,
    amountSats: 10_000,
    feeSats: 12,
    amountXof: 4500,
    memo: null,
    failure: status === 'echoue' ? 'NO_ROUTE' : null,
    createdAt: new Date(instant).toISOString(),
  };
}
function withdrawing(scenario: 'ready' | 'pending' = 'ready') {
  const base = createWithdrawPreviewServices(scenario, { now: () => instant });
  const bridge: jest.Mocked<WithdrawBridgePort> = {
    options: jest.fn(base.bridge!.options),
    balance: jest.fn(base.bridge!.balance),
    quote: jest.fn(base.bridge!.quote),
    confirm: jest.fn(base.bridge!.confirm),
    get: jest.fn(base.bridge!.get),
    reconcile: jest.fn(base.bridge!.reconcile),
    retry: jest.fn(base.bridge!.retry),
  };
  const journal: jest.Mocked<WithdrawJournalPort> = {
    load: jest.fn(base.journal!.load),
    save: jest.fn(base.journal!.save),
    clear: jest.fn(base.journal!.clear),
  };
  const services = { ...base, bridge, journal };
  const controller = createWithdrawController(services, { now: base.now });
  controllers.push(controller);
  return {
    base,
    services,
    controller,
    bridge,
    journal,
    reopen() {
      const next = createWithdrawController(services, { now: base.now });
      controllers.push(next);
      return next;
    },
  };
}
async function review(test: ReturnType<typeof withdrawing>) {
  await test.controller.start();
  test.controller.selectOperator('wave');
  test.controller.setAmount('2500');
  await test.controller.prepare();
  expect(test.controller.getSnapshot().phase).toBe('review');
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.dispose());
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('T28 | lectures avant un envoi', () => {
  it('borne la lecture initiale sans démarrer de paiement ni laisser un chargement infini', async () => {
    const test = sending();
    test.wallet.state.mockReturnValueOnce(new Promise(() => {}));
    const start = test.controller.start();
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await start;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'error',
      busy: false,
      committed: false,
      error: { code: 'READ_TIMEOUT' },
    });
    expect(test.wallet.send).not.toHaveBeenCalled();
    await test.controller.refresh();
    expect(test.controller.getSnapshot().phase).toBe('destination');
  });

  it('revient à la destination si sa lecture expire et ignore une ancienne réponse après réessai', async () => {
    const test = sending();
    await test.controller.start();
    const late = deferred<HomeResult<SendPaymentPreview>>();
    test.wallet.preview.mockReturnValueOnce(late.promise);
    const reading = test.controller.inspect(sendPreviewInvoice);
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await reading;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'destination',
      busy: false,
      error: { code: 'READ_TIMEOUT' },
    });
    await test.controller.inspect(sendPreviewInvoice);
    const prepared = test.controller.getSnapshot().preview!;
    late.resolve(ok({ ...prepared, amountSats: 1, amountXof: 0 }));
    await drain();
    expect(test.controller.getSnapshot().preview).toEqual(prepared);
    expect(test.wallet.send).not.toHaveBeenCalled();
  });

  it('conserve la saisie de montant après un devis trop lent et ne réutilise pas son résultat tardif', async () => {
    const test = sending();
    await test.controller.start();
    await test.controller.inspect(sendPreviewAddress);
    const waiting = deferred<HomeResult<SendQuote>>();
    const rate = jest.spyOn(test.services.rates!, 'quote').mockReturnValueOnce(waiting.promise);
    const preparation = test.controller.quoteAmount('4500');
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await preparation;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'amount',
      busy: false,
      committed: false,
      quote: null,
      error: { code: 'READ_TIMEOUT' },
    });
    await test.controller.quoteAmount('4500');
    const quote = test.controller.getSnapshot().quote!;
    waiting.resolve(ok({ ...quote, id: 'ancien-devis-fictif' }));
    await drain();
    expect(test.controller.getSnapshot().quote).toEqual(quote);
    expect(rate).toHaveBeenCalledTimes(2);
    expect(test.wallet.send).not.toHaveBeenCalled();
  });

  it('ne soumet jamais le PIN après expiration de la lecture d’état préliminaire', async () => {
    const test = sending();
    await pin(test);
    const waiting = deferred<HomeWalletState>();
    test.wallet.state.mockReturnValueOnce(waiting.promise);
    const confirming = test.controller.confirm(testPin);
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await confirming;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'pin',
      busy: false,
      committed: false,
      error: { code: 'READ_TIMEOUT' },
    });
    waiting.resolve('pret');
    await drain();
    expect(test.wallet.send).not.toHaveBeenCalled();
    await test.controller.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
  });
});

describe('T28 | envoi engagé et résultat tardif', () => {
  it.each([
    ['reussi', 'success'],
    ['en_attente', 'pending'],
    ['echoue', 'failed'],
  ] as const)(
    'montre l’incertitude sans resoumettre puis accepte le résultat %s',
    async (status, phase) => {
      const test = sending();
      await pin(test);
      const waiting = deferred<HomeResult<HomePayment>>();
      test.wallet.send.mockReturnValueOnce(waiting.promise);
      const confirming = test.controller.confirm(testPin);
      await drain();
      await jest.advanceTimersByTimeAsync(9999);
      expect(test.controller.getSnapshot().phase).toBe('sending');
      await jest.advanceTimersByTimeAsync(1);
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'unknown',
        busy: false,
        committed: true,
        error: { code: 'PAYMENT_TIMEOUT' },
      });
      await test.controller.confirm(testPin);
      test.controller.edit();
      await test.controller.refresh();
      const other = test.reopen();
      await other.start();
      await other.confirm(testPin);
      expect(test.wallet.send).toHaveBeenCalledTimes(1);
      waiting.resolve(ok(payment(status)));
      await confirming;
      expect(test.controller.getSnapshot()).toMatchObject({ phase, committed: true });
      expect(other.getSnapshot()).toMatchObject({ phase, committed: true });
    },
  );

  it('conserve la barrière après fermeture de l’écran et suit encore la promesse originale', async () => {
    const test = sending();
    await pin(test);
    const waiting = deferred<HomeResult<HomePayment>>();
    test.wallet.send.mockReturnValueOnce(waiting.promise);
    const confirming = test.controller.confirm(testPin);
    await drain();
    test.controller.dispose();
    const reopened = test.reopen();
    await reopened.start();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(reopened.getSnapshot()).toMatchObject({
      phase: 'unknown',
      committed: true,
      busy: false,
    });
    await reopened.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
    waiting.resolve(ok(payment()));
    await confirming;
    expect(reopened.getSnapshot()).toMatchObject({ phase: 'success', committed: true });
  });

  it('ne libère la barrière qu’après un refus tardif de PIN vérifié, avant tout nouvel appui', async () => {
    const test = sending();
    await pin(test);
    const waiting = deferred<HomeResult<HomePayment>>();
    test.wallet.send.mockReturnValueOnce(waiting.promise);
    const confirming = test.controller.confirm(testPin);
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await test.controller.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
    waiting.resolve({ ok: false, error: { code: 'PIN_INVALID', attemptsLeft: 4 } });
    await confirming;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'pin',
      committed: false,
      busy: false,
      error: { code: 'PIN_INVALID' },
    });
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
    await test.controller.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(2);
  });

  it('garde l’issue inconnue si la promesse originale rejette après le délai', async () => {
    const test = sending();
    await pin(test);
    const waiting = deferred<HomeResult<HomePayment>>();
    test.wallet.send.mockReturnValueOnce(waiting.promise);
    const confirming = test.controller.confirm(testPin);
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    waiting.reject(new Error('réponse perdue fictive'));
    await confirming;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      committed: true,
      busy: false,
    });
    await test.controller.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
  });
});

describe('T28 | envoi suivi par l’identifiant du wallet (contrat T11)', () => {
  function listening(test: ReturnType<typeof sending>) {
    const listeners: ((event: unknown) => void)[] = [];
    test.wallet.subscribe.mockImplementation((listener) => {
      listeners.push(listener as (event: unknown) => void);
      return () => undefined;
    });
    return (event: unknown) => listeners.forEach((listener) => listener(event));
  }
  const timeout = (code = 'PAYMENT_TIMEOUT') =>
    ({
      ok: false,
      error: { code, paymentId: 'paiement-tardif-fictif-t28' },
    }) as unknown as HomeResult<HomePayment>;

  it.each(['PAYMENT_TIMEOUT', 'PAYMENT_PENDING'])(
    'rattache le résultat tardif annoncé après %s, sans renvoi',
    async (errorCode) => {
      const test = sending();
      const emit = listening(test);
      await pin(test);
      test.wallet.send.mockResolvedValueOnce(timeout(errorCode));
      test.wallet.history.mockResolvedValue(ok([]));
      await test.controller.confirm(testPin);
      await drain();
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'unknown',
        committed: true,
        canRefreshPayment: true,
        error: { code: errorCode },
      });
      const other = test.reopen();
      await other.start();
      await other.confirm(testPin);
      expect(test.wallet.send).toHaveBeenCalledTimes(1);
      emit({ type: 'paiement', payment: { ...payment(), id: 'autre-paiement-fictif' } });
      await drain();
      expect(test.controller.getSnapshot().phase).toBe('unknown');
      emit({ type: 'paiement', payment: payment('reussi') });
      await drain();
      expect(test.controller.getSnapshot()).toMatchObject({ phase: 'success', committed: true });
      expect(other.getSnapshot()).toMatchObject({ phase: 'success', committed: true });
    },
  );

  it('retrouve l’issue par « Vérifier » quand l’événement a été manqué', async () => {
    const test = sending();
    await pin(test);
    test.wallet.send.mockResolvedValueOnce(timeout());
    test.wallet.history.mockResolvedValueOnce(ok([]));
    await test.controller.confirm(testPin);
    await drain();
    expect(test.controller.getSnapshot().phase).toBe('unknown');
    test.wallet.history.mockResolvedValueOnce(ok([payment('echoue')]));
    await test.controller.refreshPayment();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'failed',
      error: { code: 'NO_ROUTE' },
    });
  });

  it('reconnaît tout de suite une issue déjà connue de l’historique', async () => {
    const test = sending();
    await pin(test);
    test.wallet.send.mockResolvedValueOnce(timeout('PAYMENT_PENDING'));
    test.wallet.history.mockResolvedValueOnce(ok([payment('reussi')]));
    await test.controller.confirm(testPin);
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'success', committed: true });
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
  });

  it('n’applique jamais un autre paiement du même montant trouvé dans l’historique', async () => {
    const test = sending();
    await pin(test);
    test.wallet.send.mockResolvedValueOnce(timeout());
    test.wallet.history.mockResolvedValueOnce(
      ok([{ ...payment('reussi'), id: 'autre-paiement-fictif' }]),
    );
    await test.controller.confirm(testPin);
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      canRefreshPayment: true,
    });
  });

  it('ne suit pas un refus NO_ROUTE, même avec un identifiant', async () => {
    const test = sending();
    await pin(test);
    test.wallet.send.mockResolvedValueOnce({
      ok: false,
      error: { code: 'NO_ROUTE', paymentId: 'paiement-tardif-fictif-t28' },
    } as unknown as HomeResult<HomePayment>);
    test.wallet.history.mockClear();
    test.wallet.history.mockResolvedValue(ok([payment('en_attente')]));
    await test.controller.confirm(testPin);
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'failed' });
    expect(test.wallet.history).not.toHaveBeenCalled();
  });

  it('une lecture tardive de l’ancien envoi ne touche pas un nouvel envoi', async () => {
    const test = sending();
    const emit = listening(test);
    await pin(test);
    const lateHistory = deferred<HomeResult<HomePayment[]>>();
    test.wallet.send.mockResolvedValueOnce(timeout());
    test.wallet.history.mockReturnValueOnce(lateHistory.promise);
    const first = test.controller.confirm(testPin);
    await drain();
    emit({ type: 'paiement', payment: payment('reussi') });
    await drain();
    expect(test.controller.getSnapshot().phase).toBe('success');
    test.controller.dispose();
    const next = test.reopen();
    await next.start();
    await next.inspect(sendPreviewInvoice);
    await next.requestPin();
    const second = deferred<HomeResult<HomePayment>>();
    test.wallet.send.mockReturnValueOnce(second.promise);
    const confirming = next.confirm(testPin);
    await drain();
    expect(next.getSnapshot().phase).toBe('sending');
    // L'historique de l'ancien envoi arrive enfin : même montant, autre opération.
    lateHistory.resolve(ok([{ ...payment('reussi'), id: 'paiement-tardif-fictif-t28' }]));
    await first;
    await drain();
    expect(next.getSnapshot().phase).toBe('sending');
    second.resolve(ok({ ...payment('en_attente'), id: 'nouvel-envoi-fictif' }));
    await confirming;
  });

  it('ignore un identifiant mal formé et garde l’issue inconnue', async () => {
    const test = sending();
    await pin(test);
    test.wallet.send.mockResolvedValueOnce({
      ok: false,
      error: { code: 'PAYMENT_TIMEOUT', paymentId: 'pas valide !' },
    } as unknown as HomeResult<HomePayment>);
    await test.controller.confirm(testPin);
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      canRefreshPayment: false,
    });
  });
});

describe('T28 | retrait simulé et lecture bornée', () => {
  it.each(['options', 'balance', 'journal'] as const)(
    'borne la lecture %s et autorise une reprise sans POST',
    async (resource) => {
      const test = withdrawing();
      if (resource === 'journal')
        test.journal.load.mockReturnValueOnce(new Promise<never>(() => {}));
      else test.bridge[resource].mockReturnValueOnce(new Promise<never>(() => {}));
      const start = test.controller.start();
      await drain();
      await jest.advanceTimersByTimeAsync(10_000);
      await start;
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'error',
        busy: false,
        committed: false,
        error: { code: 'READ_TIMEOUT' },
      });
      expect(test.bridge.confirm).not.toHaveBeenCalled();
      await test.controller.refresh();
      expect(test.controller.getSnapshot().phase).toBe('operator');
    },
  );

  it('borne le prix sans lancer le retrait et permet de revoir les mêmes frais', async () => {
    const test = withdrawing();
    await test.controller.start();
    test.controller.selectOperator('wave');
    test.controller.setAmount('2500');
    test.bridge.quote.mockReturnValueOnce(new Promise(() => {}));
    const preparing = test.controller.prepare();
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await preparing;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'amount',
      busy: false,
      quote: null,
      error: { code: 'READ_TIMEOUT' },
    });
    await test.controller.prepare();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      quote: { amountXof: 2500, feeXof: 100, totalXof: 2600 },
    });
    expect(test.bridge.confirm).not.toHaveBeenCalled();
  });
});

describe('T28 | retrait engagé et barrière du journal', () => {
  it('signale le POST lent mais garde une demande unique jusqu’à la réponse originale', async () => {
    const test = withdrawing();
    await review(test);
    const waiting = deferred<void>();
    const confirm = test.bridge.confirm.getMockImplementation()!;
    test.bridge.confirm.mockImplementationOnce(async (request) => {
      const response = await confirm(request);
      await waiting.promise;
      return response;
    });
    const confirming = test.controller.confirm();
    await drain();
    expect(test.base.inspect()).toEqual({ reservations: 1, effects: 1 });
    const submitted = test.bridge.confirm.mock.calls[0]![0];
    await jest.advanceTimersByTimeAsync(10_000);
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      error: { code: 'OPERATION_SLOW' },
      busy: true,
      committed: true,
      canConfirm: false,
      canRefresh: false,
      canRetry: false,
      canNewRequest: false,
    });
    await test.controller.confirm();
    await test.controller.refresh();
    await test.controller.retry();
    await test.controller.newRequest();
    const reopened = test.reopen();
    await reopened.start();
    expect(reopened.getSnapshot()).toMatchObject({ phase: 'unknown', busy: true, committed: true });
    expect(test.bridge.confirm).toHaveBeenCalledTimes(1);
    expect(test.bridge.get).not.toHaveBeenCalled();
    waiting.resolve();
    await confirming;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'success',
      busy: false,
      committed: true,
    });
    expect(reopened.getSnapshot()).toMatchObject({
      phase: 'success',
      busy: false,
      committed: true,
    });
    expect(test.bridge.confirm.mock.calls[0]![0]).toEqual(submitted);
    expect(test.base.inspect()).toEqual({ reservations: 1, effects: 1 });
  });

  it('attend l’acquittement tardif du journal puis exige une reprise volontaire avant le premier POST', async () => {
    const test = withdrawing();
    await review(test);
    const waiting = deferred<void>();
    const save = test.journal.save.getMockImplementation()!;
    test.journal.save.mockImplementationOnce(async (intent) => {
      await waiting.promise;
      return save(intent);
    });
    const confirming = test.controller.confirm();
    await drain();
    const intent = test.journal.save.mock.calls[0]![0];
    await jest.advanceTimersByTimeAsync(10_000);
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      busy: true,
      committed: true,
    });
    expect(test.bridge.confirm).not.toHaveBeenCalled();
    await test.controller.refresh();
    expect(test.bridge.confirm).not.toHaveBeenCalled();
    waiting.resolve();
    await confirming;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      busy: false,
      committed: true,
      canRefresh: true,
    });
    expect(test.bridge.confirm).not.toHaveBeenCalled();
    await test.controller.refresh();
    expect(test.bridge.confirm).toHaveBeenCalledTimes(1);
    expect(test.bridge.confirm).toHaveBeenCalledWith({ quoteId: intent.quote.id, key: intent.key });
    expect(test.base.inspect()).toEqual({ reservations: 1, effects: 1 });
  });

  it('le délai d’une lecture d’opération connue conserve la même référence et ne déclenche aucun POST', async () => {
    const test = withdrawing('pending');
    await review(test);
    await test.controller.confirm();
    const initial = test.controller.getSnapshot().operation!;
    const waiting = deferred<WithdrawResult<WithdrawOperation>>();
    test.bridge.reconcile.mockReturnValueOnce(waiting.promise);
    const refreshing = test.controller.refresh();
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    await refreshing;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      busy: false,
      committed: true,
      operation: initial,
      error: { code: 'READ_TIMEOUT' },
    });
    await test.controller.refresh();
    waiting.resolve({ ok: true, value: { ...initial, status: 'reussi' } });
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'pending', operation: initial });
    expect(test.bridge.confirm).toHaveBeenCalledTimes(1);
    expect(test.bridge.retry).not.toHaveBeenCalled();
    expect(test.base.inspect()).toEqual({ reservations: 1, effects: 0 });
  });

  it('ne soumet rien après une sauvegarde lente lorsque l’écran a été fermé', async () => {
    const test = withdrawing();
    await review(test);
    const waiting = deferred<void>();
    const save = test.journal.save.getMockImplementation()!;
    test.journal.save.mockImplementationOnce(async (intent) => {
      await waiting.promise;
      return save(intent);
    });
    const confirming = test.controller.confirm();
    await drain();
    test.controller.dispose();
    const reopened = test.reopen();
    await reopened.start();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(reopened.getSnapshot()).toMatchObject({ phase: 'unknown', busy: true, committed: true });
    waiting.resolve();
    await confirming;
    expect(test.bridge.confirm).not.toHaveBeenCalled();
    expect(reopened.getSnapshot()).toMatchObject({
      phase: 'unknown',
      busy: false,
      committed: true,
    });
  });

  it('une suppression de journal lente garde la barrière et ne crée aucune nouvelle intention', async () => {
    const test = withdrawing();
    await review(test);
    await test.controller.confirm();
    const previous = test.controller.getSnapshot().operation!;
    const waiting = deferred<void>();
    const clear = test.journal.clear.getMockImplementation()!;
    test.journal.clear.mockImplementationOnce(async (key) => {
      await waiting.promise;
      return clear(key);
    });
    const clearing = test.controller.newRequest();
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(test.controller.getSnapshot()).toMatchObject({
      operation: previous,
      busy: true,
      committed: true,
      canNewRequest: false,
    });
    await test.controller.newRequest();
    await test.controller.confirm();
    expect(test.journal.clear).toHaveBeenCalledTimes(1);
    expect(test.bridge.confirm).toHaveBeenCalledTimes(1);
    waiting.resolve();
    await clearing;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'operator',
      busy: false,
      committed: false,
    });
    expect(test.base.inspect()).toEqual({ reservations: 1, effects: 1 });
  });
  it('qualifie une sauvegarde lente après une lecture réussie sans remettre en doute son résultat', async () => {
    const test = withdrawing('pending');
    await review(test);
    await test.controller.confirm();
    test.base.completePending();
    const waiting = deferred<void>();
    const save = test.journal.save.getMockImplementation()!;
    test.journal.save.mockImplementationOnce(async (intent) => {
      await waiting.promise;
      return save(intent);
    });
    const refresh = test.controller.refresh();
    await drain();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'success',
      busy: true,
      committed: true,
      error: { code: 'JOURNAL_SLOW' },
      canNewRequest: false,
    });
    await test.controller.newRequest();
    expect(test.bridge.confirm).toHaveBeenCalledTimes(1);
    waiting.resolve();
    await refresh;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'success',
      busy: false,
      canNewRequest: true,
      error: null,
    });
    expect(test.base.inspect()).toEqual({ reservations: 1, effects: 1 });
  });
});
