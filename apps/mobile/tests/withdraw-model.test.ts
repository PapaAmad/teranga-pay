import { createWithdrawController, parseWithdrawAmount } from '../src/withdraw/controller';
import type {
  WithdrawBalance,
  WithdrawBridgePort,
  WithdrawError,
  WithdrawIntent,
  WithdrawJournalPort,
  WithdrawOperation,
  WithdrawOptions,
  WithdrawQuote,
  WithdrawResult,
  WithdrawServices,
} from '../src/withdraw/ports';

const instant = Date.UTC(2026, 10, 11, 12);
const iso = (offset = 0) => new Date(instant + offset).toISOString();
const id = (number: number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, '0')}`;
const ok = <T>(value: T): WithdrawResult<T> => ({ ok: true, value });
const fail = (code: string, withdrawalId?: string): { ok: false; error: WithdrawError } => ({
  ok: false,
  error: { code, ...(withdrawalId ? { withdrawalId } : {}) },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function makeQuote(amountXof = 2500, patch: Partial<WithdrawQuote> = {}): WithdrawQuote {
  const convert = (value: number) =>
    Number((BigInt(value) * 100_000_000n + 44_999_999n) / 45_000_000n);
  const amountSats = convert(amountXof),
    totalSats = convert(amountXof + 100);
  return {
    id: id(1),
    simulation: true,
    operator: 'wave',
    recipientId: 'wave-demo-001',
    amountXof,
    feeXof: 100,
    totalXof: amountXof + 100,
    amountSats,
    feeSats: totalSats - amountSats,
    totalSats,
    xofPerBtc: 45_000_000,
    source: 'fixe',
    createdAt: iso(),
    expiresAt: iso(300_000),
    ...patch,
  };
}
function makeOperation(
  quote = makeQuote(),
  patch: Partial<WithdrawOperation> = {},
): WithdrawOperation {
  return {
    id: id(500),
    quoteId: quote.id,
    simulation: true,
    operator: quote.operator,
    recipientId: quote.recipientId,
    amountXof: quote.amountXof,
    feeXof: quote.feeXof,
    totalXof: quote.totalXof,
    amountSats: quote.amountSats,
    feeSats: quote.feeSats,
    totalSats: quote.totalSats,
    xofPerBtc: quote.xofPerBtc,
    source: quote.source,
    quoteCreatedAt: quote.createdAt,
    quoteExpiresAt: quote.expiresAt,
    createdAt: quote.createdAt,
    updatedAt: quote.createdAt,
    status: 'reussi',
    failure: null,
    ...patch,
  };
}
function harness() {
  let time = instant,
    nextQuote = 1,
    nextKey = 100;
  let saved: WithdrawIntent | null = null;
  const quotes = new Map<string, WithdrawQuote>();
  const operations = new Map<string, WithdrawOperation>();
  const options: WithdrawOptions = {
    simulation: true,
    currency: 'XOF',
    feeXof: 100,
    maxAmountXof: 5_000_000,
    operators: [
      { operator: 'wave', recipientId: 'wave-demo-001' },
      { operator: 'orange_money', recipientId: 'orange-demo-001' },
    ],
  };
  const balance: WithdrawBalance = { simulation: true, availableSats: 2_000_000, heldSats: 0 };
  const journal: jest.Mocked<WithdrawJournalPort> = {
    load: jest.fn(async () => ok(saved ? clone(saved) : null)),
    save: jest.fn(async (intent) => {
      if (
        saved &&
        (saved.key !== intent.key || JSON.stringify(saved.quote) !== JSON.stringify(intent.quote))
      )
        return fail('JOURNAL_CONFLICT');
      saved = clone(intent);
      return ok(undefined);
    }),
    clear: jest.fn(async (key) => {
      if (saved && saved.key !== key) return fail('JOURNAL_CONFLICT');
      saved = null;
      return ok(undefined);
    }),
  };
  const bridge: jest.Mocked<WithdrawBridgePort> = {
    options: jest.fn(async () => ok(options)),
    balance: jest.fn(async () => ok(balance)),
    quote: jest.fn(async (input) => {
      const quote = makeQuote(input.amountXof, {
        ...input,
        id: id(nextQuote++),
        createdAt: new Date(time).toISOString(),
        expiresAt: new Date(time + 300_000).toISOString(),
      });
      quotes.set(quote.id, quote);
      return ok(quote);
    }),
    confirm: jest.fn(async ({ quoteId, key }) => {
      const previous = operations.get(key);
      if (previous) return ok(previous);
      const quote = quotes.get(quoteId) ?? saved?.quote;
      if (!quote) return fail('QUOTE_NOT_FOUND');
      const operation = makeOperation(quote);
      operations.set(key, operation);
      return ok(operation);
    }),
    get: jest.fn(async (identifier) => {
      const operation = [...operations.values()].find((value) => value.id === identifier);
      return operation ? ok(operation) : fail('WITHDRAWAL_NOT_FOUND');
    }),
    reconcile: jest.fn(async (identifier) => bridge.get(identifier)),
    retry: jest.fn(async (identifier) => bridge.get(identifier)),
  };
  const createKey = jest.fn(() => id(nextKey++));
  const services: WithdrawServices = { mode: 'simulation', bridge, journal, createKey };
  const now = () => time;
  const controller = createWithdrawController(services, { now });
  return {
    controller,
    bridge,
    journal,
    services,
    options,
    balance,
    createKey,
    quotes,
    operations,
    now,
    advance(ms: number) {
      time += ms;
    },
    getSaved: () => saved,
    setSaved(value: WithdrawIntent | null) {
      saved = value ? clone(value) : null;
    },
    fresh() {
      return createWithdrawController({ ...services, bridge: { ...bridge } }, { now });
    },
  };
}
async function review(h: ReturnType<typeof harness>, operator: 'wave' | 'orange_money' = 'wave') {
  await h.controller.start();
  h.controller.selectOperator(operator);
  h.controller.setAmount('2500');
  await h.controller.prepare();
  expect(h.controller.getSnapshot().phase).toBe('review');
}
async function drain() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

describe('T25 | montants et préparation sans retrait', () => {
  it.each([
    '',
    '0',
    '-1',
    '1.5',
    '1,5',
    '1e3',
    '2 5',
    '1 00',
    '2.500',
    '2  500',
    '5000001',
    '9007199254740992',
    '\u200b100',
  ])('refuse le montant ambigu ou hors borne %s', (input) => {
    expect(parseWithdrawAmount(input)).toBeNull();
  });
  it('accepte seulement des entiers positifs, bornés par les options', () => {
    expect(parseWithdrawAmount(' 2500 ')).toBe(2500);
    expect(parseWithdrawAmount('5000000')).toBe(5_000_000);
    expect(parseWithdrawAmount('2501', 2500)).toBeNull();
  });
  it.each(['2 500', '2\u00a0500', '2\u202f500', ' 2 500 '])(
    'accepte un groupement français complet %s',
    (input) => {
      expect(parseWithdrawAmount(input)).toBe(2500);
    },
  );
  it('applique les bornes après normalisation des groupes français', () => {
    expect(parseWithdrawAmount('5 000 000')).toBe(5_000_000);
    expect(parseWithdrawAmount('5 000 001')).toBeNull();
    expect(parseWithdrawAmount('2 501', 2500)).toBeNull();
  });
  it('reste indisponible sans composition et ne lit aucun fournisseur', async () => {
    const h = harness();
    const c = createWithdrawController({ ...h.services, mode: 'unavailable' });
    await c.start();
    expect(c.getSnapshot().phase).toBe('unavailable');
    expect(h.journal.load).not.toHaveBeenCalled();
    expect(h.bridge.options).not.toHaveBeenCalled();
  });
  it('exige le journal durable et la fabrique UUID avant tout parcours', async () => {
    const h = harness();
    const c = createWithdrawController({ ...h.services, journal: undefined });
    await c.start();
    expect(c.getSnapshot().phase).toBe('unavailable');
    expect(h.bridge.options).not.toHaveBeenCalled();
  });
  it('charge un solde fictif et attend un opérateur explicitement choisi', async () => {
    const h = harness();
    await h.controller.start();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'operator',
      operator: null,
      balance: h.balance,
      committed: false,
    });
    await h.controller.prepare();
    expect(h.bridge.quote).not.toHaveBeenCalled();
    expect(h.bridge.confirm).not.toHaveBeenCalled();
  });
  it('présente le montant reçu, les frais et le total exact avant confirmation', async () => {
    const h = harness();
    await review(h, 'orange_money');
    expect(h.bridge.quote).toHaveBeenCalledWith({
      operator: 'orange_money',
      recipientId: 'orange-demo-001',
      amountXof: 2500,
    });
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      quote: { amountXof: 2500, feeXof: 100, totalXof: 2600, totalSats: 5778 },
      remainingSeconds: 300,
      canConfirm: true,
    });
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    expect(h.journal.save).not.toHaveBeenCalled();
  });
  it('signale une saisie invalide puis autorise sa correction', async () => {
    const h = harness();
    await h.controller.start();
    h.controller.selectOperator('wave');
    h.controller.setAmount('-1');
    await h.controller.prepare();
    expect(h.controller.getSnapshot().amountError?.code).toBe('AMOUNT_INVALID');
    expect(h.bridge.quote).not.toHaveBeenCalled();
    h.controller.setAmount('1000');
    expect(h.controller.getSnapshot().amountError).toBeNull();
    await h.controller.prepare();
    expect(h.controller.getSnapshot().phase).toBe('review');
  });
  it('refuse un prix dépassant le solde fictif frais compris', async () => {
    const h = harness();
    h.bridge.balance.mockResolvedValue(ok({ ...h.balance, availableSats: 5600 }));
    await h.controller.start();
    h.controller.selectOperator('wave');
    h.controller.setAmount('2500');
    await h.controller.prepare();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'amount',
      error: { code: 'INSUFFICIENT_FUNDS' },
      quote: null,
    });
    expect(h.journal.save).not.toHaveBeenCalled();
  });
  it.each([
    { simulation: false },
    { recipientId: 'orange-demo-001' },
    { amountXof: 2501 },
    { feeXof: 150 },
    { totalXof: 2500 },
    { amountSats: 5555 },
    { feeSats: 223 },
    { totalSats: 5777 },
    { xofPerBtc: 0 },
    { expiresAt: iso(300001) },
    { createdAt: '2026-02-30T12:00:00.000Z' },
    { id: 'not-uuid' },
  ])('refuse un devis incohérent %j', async (patch) => {
    const h = harness();
    h.bridge.quote.mockResolvedValue(ok({ ...makeQuote(), ...patch } as WithdrawQuote));
    await h.controller.start();
    h.controller.selectOperator('wave');
    h.controller.setAmount('2500');
    await h.controller.prepare();
    expect(h.controller.getSnapshot().phase).toBe('amount');
    expect(h.controller.getSnapshot().error?.code).toBe('INVALID_DATA');
    expect(h.bridge.confirm).not.toHaveBeenCalled();
  });
  it('ne traite pas des options ou un solde non simulés comme une disponibilité', async () => {
    const h = harness();
    h.bridge.options.mockResolvedValue(
      ok({ ...h.options, simulation: false } as unknown as WithdrawOptions),
    );
    await h.controller.start();
    expect(h.controller.getSnapshot().phase).toBe('error');
    expect(h.bridge.quote).not.toHaveBeenCalled();
  });
  it('permet de modifier le prix et ignore la réponse du devis précédent', async () => {
    const h = harness();
    await h.controller.start();
    h.controller.selectOperator('wave');
    h.controller.setAmount('2500');
    const gate = deferred<WithdrawResult<WithdrawQuote>>();
    h.bridge.quote.mockReturnValueOnce(gate.promise);
    const pending = h.controller.prepare();
    h.controller.setAmount('1000');
    await h.controller.prepare();
    const current = h.controller.getSnapshot().quote;
    gate.resolve(ok(makeQuote(2500)));
    await pending;
    expect(h.controller.getSnapshot().quote).toEqual(current);
    expect(current?.amountXof).toBe(1000);
  });
  it('arrête le premier envoi à la borne d’expiration puis permet un nouveau devis', async () => {
    const h = harness();
    await review(h);
    h.advance(300_000);
    h.controller.tick();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      remainingSeconds: 0,
      canConfirm: false,
      error: { code: 'QUOTE_EXPIRED' },
    });
    await h.controller.confirm();
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    await h.controller.prepare();
    expect(h.controller.getSnapshot().canConfirm).toBe(true);
  });
  it('ignore un ancien bouton de confirmation après remplacement du devis', async () => {
    const h = harness();
    await review(h);
    const previous = h.controller.getSnapshot().quote!.id;
    h.controller.edit();
    h.controller.setAmount('5000');
    await h.controller.prepare();
    await h.controller.confirm(previous);
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    expect(h.journal.save).not.toHaveBeenCalled();
  });
});

describe('T25 | intention durable et résultat exact', () => {
  it('attend l’acquittement du journal avant le premier POST et partage la barrière', async () => {
    const h = harness();
    await review(h);
    const gate = deferred<WithdrawResult<void>>();
    h.journal.save.mockReturnValueOnce(gate.promise);
    const first = h.controller.confirm();
    const second = h.controller.confirm();
    await drain();
    expect(h.journal.save).toHaveBeenCalledTimes(1);
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    const saved = h.journal.save.mock.calls[0]![0];
    gate.resolve(ok(undefined));
    await Promise.all([first, second]);
    expect(h.bridge.confirm).toHaveBeenCalledTimes(1);
    expect(h.bridge.confirm).toHaveBeenCalledWith({ quoteId: saved.quote.id, key: saved.key });
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'success',
      committed: true,
      canNewRequest: true,
    });
    expect(h.getSaved()?.withdrawalId).toBe(id(500));
  });
  it.each(['resumeBeforeAck', 'resumeAfterAck', 'disposeBeforeAck'] as const)(
    'une écriture durable retardée ne soumet rien après une sortie de session | %s',
    async (scenario) => {
      const h = harness();
      await review(h);
      const gate = deferred<void>();
      const save = h.journal.save.getMockImplementation()!;
      h.journal.save.mockImplementationOnce(async (intent) => {
        const saved = await save(intent);
        await gate.promise;
        return saved;
      });
      const confirming = h.controller.confirm();
      await drain();
      const intent = clone(h.getSaved()!);
      expect(intent).not.toBeNull();
      expect(h.bridge.confirm).not.toHaveBeenCalled();

      let returning = h.controller;
      if (scenario === 'disposeBeforeAck') {
        h.controller.dispose();
        returning = createWithdrawController(h.services, { now: h.now });
        await returning.start();
      } else {
        h.controller.suspend();
        if (scenario === 'resumeBeforeAck') await returning.resume();
      }
      expect(h.bridge.confirm).not.toHaveBeenCalled();
      gate.resolve();
      await confirming;
      if (scenario === 'resumeAfterAck') await returning.resume();

      expect(returning.getSnapshot()).toMatchObject({
        phase: 'unknown',
        busy: false,
        committed: true,
        canRefresh: true,
        canConfirm: false,
        canNewRequest: false,
      });
      expect(h.getSaved()).toEqual(intent);
      expect(h.journal.clear).not.toHaveBeenCalled();
      expect(h.bridge.confirm).not.toHaveBeenCalled();
      expect(h.bridge.retry).not.toHaveBeenCalled();
      expect(h.bridge.quote).toHaveBeenCalledTimes(1);
      expect(h.createKey).toHaveBeenCalledTimes(1);

      // L'ancien callback de confirmation ne déclenche pas un second envoi.
      await returning.confirm(intent.quote.id);
      expect(h.bridge.confirm).not.toHaveBeenCalled();
      await returning.refresh();
      expect(h.bridge.confirm).toHaveBeenCalledTimes(1);
      expect(h.bridge.confirm).toHaveBeenCalledWith({ quoteId: intent.quote.id, key: intent.key });
      expect(returning.getSnapshot().phase).toBe('success');
      expect(h.createKey).toHaveBeenCalledTimes(1);
      returning.dispose();
    },
  );
  it('un échec d’écriture interdit tout POST et impose un effacement acquitté', async () => {
    const h = harness();
    await review(h);
    h.journal.save.mockResolvedValueOnce(fail('JOURNAL_WRITE_FAILED'));
    await h.controller.confirm();
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'failed',
      canNewRequest: true,
      error: { code: 'JOURNAL_WRITE_FAILED' },
    });
    await h.controller.newRequest();
    expect(h.journal.clear).toHaveBeenCalledWith(id(100));
    expect(h.controller.getSnapshot().phase).toBe('operator');
  });
  it('ne soumet pas un prix qui expire pendant l’écriture durable', async () => {
    const h = harness();
    await review(h);
    const original = h.journal.save.getMockImplementation()!;
    h.journal.save.mockImplementationOnce(async (intent) => {
      const result = await original(intent);
      h.advance(300000);
      return result;
    });
    await h.controller.confirm();
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'failed',
      error: { code: 'QUOTE_EXPIRED' },
    });
  });
  it('refuse une fabrique UUID absente, cassée ou invalide sans enregistrer une intention', async () => {
    const h = harness();
    await review(h);
    h.createKey.mockReturnValueOnce('not-uuid');
    await h.controller.confirm();
    expect(h.controller.getSnapshot().error?.code).toBe('KEY_UNAVAILABLE');
    expect(h.journal.save).not.toHaveBeenCalled();
    expect(h.bridge.confirm).not.toHaveBeenCalled();
  });
  it('une réponse perdue conserve le même couple après expiration et bloque une nouvelle demande', async () => {
    const h = harness();
    await review(h);
    h.bridge.confirm.mockRejectedValueOnce(new Error('réponse fictive perdue'));
    await h.controller.confirm();
    const sent = h.bridge.confirm.mock.calls[0]![0];
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      canNewRequest: false,
      canRetry: false,
    });
    h.controller.edit();
    h.controller.selectOperator('orange_money');
    h.controller.setAmount('9000');
    await h.controller.newRequest();
    expect(h.journal.clear).not.toHaveBeenCalled();
    h.advance(600_000);
    await h.controller.refresh();
    expect(h.bridge.confirm.mock.calls[1]![0]).toEqual(sent);
    expect(h.createKey).toHaveBeenCalledTimes(1);
    expect(h.controller.getSnapshot().phase).toBe('success');
  });
  it.each(['NETWORK_OFFLINE', 'STORAGE_CLOSED', 'UNAUTHORIZED', 'INTERNAL_ERROR'])(
    'un %s reçu après confirmation n’est jamais un échec certain',
    async (errorCode) => {
      const h = harness();
      await review(h);
      h.bridge.confirm.mockResolvedValueOnce(fail(errorCode));
      await h.controller.confirm();
      expect(h.controller.getSnapshot()).toMatchObject({ phase: 'unknown', canNewRequest: false });
      expect(h.getSaved()).not.toBeNull();
    },
  );
  it.each(['QUOTE_EXPIRED', 'QUOTE_NOT_FOUND', 'INSUFFICIENT_FUNDS'])(
    'permet une nouvelle intention après le refus certain %s, sans effacer avant action',
    async (errorCode) => {
      const h = harness();
      await review(h);
      h.bridge.confirm.mockResolvedValueOnce(fail(errorCode));
      await h.controller.confirm();
      expect(h.controller.getSnapshot()).toMatchObject({
        phase: 'failed',
        canNewRequest: true,
        error: { code: errorCode },
      });
      expect(h.journal.clear).not.toHaveBeenCalled();
      await h.controller.newRequest();
      expect(h.getSaved()).toBeNull();
      expect(h.controller.getSnapshot().phase).toBe('operator');
    },
  );
  it('un résultat métier échoué reste un échec même si le port renvoie ok', async () => {
    const h = harness();
    await review(h);
    const q = h.controller.getSnapshot().quote!;
    h.bridge.confirm.mockResolvedValueOnce(
      ok(makeOperation(q, { status: 'echoue', failure: 'PROVIDER_DECLINED' })),
    );
    await h.controller.confirm();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'failed',
      canNewRequest: true,
      operation: { status: 'echoue' },
    });
  });
  it.each([
    { simulation: false },
    { quoteId: id(800) },
    { recipientId: 'orange-demo-001' },
    { amountXof: 9999 },
    { feeXof: 150 },
    { totalSats: 1 },
    { quoteExpiresAt: iso(200000) },
    { createdAt: iso(300000) },
    { status: 'reussi', failure: 'PROVIDER_UNAVAILABLE' },
  ])('une réponse de confirmation incohérente ne devient jamais un succès %j', async (patch) => {
    const h = harness();
    await review(h);
    const q = h.controller.getSnapshot().quote!;
    h.bridge.confirm.mockResolvedValueOnce(
      ok({ ...makeOperation(q), ...patch } as WithdrawOperation),
    );
    await h.controller.confirm();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      operation: null,
      canNewRequest: false,
      error: { code: 'INVALID_DATA' },
    });
    expect(h.getSaved()?.quote.id).toBe(q.id);
  });
  it('retrouve un retrait de devis déjà engagé par sa référence propriétaire et vérifie son prix', async () => {
    const h = harness();
    await review(h);
    const operation = makeOperation(h.controller.getSnapshot().quote!);
    h.bridge.confirm.mockResolvedValueOnce(fail('QUOTE_ALREADY_USED', operation.id));
    h.bridge.get.mockResolvedValueOnce(ok(operation));
    await h.controller.confirm();
    expect(h.bridge.get).toHaveBeenCalledWith(operation.id);
    expect(h.controller.getSnapshot().phase).toBe('success');
  });
  it('un conflit vers une autre intention reste incertain et ne retargete pas le reçu', async () => {
    const h = harness();
    await review(h);
    h.bridge.confirm.mockResolvedValueOnce(fail('IDEMPOTENCY_CONFLICT', id(800)));
    h.bridge.get.mockResolvedValueOnce(ok(makeOperation(makeQuote(5000), { id: id(800) })));
    await h.controller.confirm();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      operation: null,
      canNewRequest: false,
    });
    expect(h.getSaved()?.withdrawalId).toBeUndefined();
  });
  it('un effacement échoué garde le résultat terminal et interdit de préparer une nouvelle intention', async () => {
    const h = harness();
    await review(h);
    await h.controller.confirm();
    h.journal.clear.mockResolvedValueOnce(fail('JOURNAL_CLEAR_FAILED'));
    await h.controller.newRequest();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'success',
      committed: true,
      error: { code: 'JOURNAL_CLEAR_FAILED' },
    });
    h.controller.setAmount('9000');
    await h.controller.prepare();
    expect(h.bridge.quote).toHaveBeenCalledTimes(1);
    await h.controller.newRequest();
    expect(h.controller.getSnapshot().phase).toBe('operator');
  });
  it('les champs supplémentaires de la réponse ne figurent ni dans le snapshot ni dans le journal', async () => {
    const h = harness();
    await review(h);
    const raw = {
      ...makeOperation(h.controller.getSnapshot().quote!),
      privateNote: 'note-fictive-exclue',
    };
    h.bridge.confirm.mockResolvedValueOnce(ok(raw));
    await h.controller.confirm();
    expect(JSON.stringify(h.controller.getSnapshot())).not.toContain('note-fictive-exclue');
    expect(JSON.stringify(h.getSaved())).not.toContain('note-fictive-exclue');
    expect(h.controller.getSnapshot().operation).not.toHaveProperty('expiresAt');
  });
});

describe('T25 | reprise, concurrence et confidentialité', () => {
  it('une intention sans référence est chargée sans POST, puis rejouée explicitement à clé constante', async () => {
    const h = harness();
    const intent: WithdrawIntent = { version: 1, key: id(100), quote: makeQuote() };
    h.setSaved(intent);
    h.advance(600000);
    await h.controller.start();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      canRefresh: true,
      canNewRequest: false,
    });
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    expect(h.bridge.get).not.toHaveBeenCalled();
    await h.controller.refresh();
    expect(h.bridge.confirm).toHaveBeenCalledWith({ quoteId: intent.quote.id, key: intent.key });
    expect(h.createKey).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot().phase).toBe('success');
  });
  it('une intention avec référence effectue seulement une lecture à la reprise', async () => {
    const h = harness();
    const operation = makeOperation();
    h.setSaved({ version: 1, key: id(100), quote: makeQuote(), withdrawalId: operation.id });
    h.operations.set(id(100), operation);
    await h.controller.start();
    expect(h.bridge.get).toHaveBeenCalledWith(operation.id);
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    expect(h.bridge.retry).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot().phase).toBe('success');
  });
  it('un journal illisible ou corrompu interdit une nouvelle demande', async () => {
    const h = harness();
    h.journal.load.mockResolvedValueOnce(
      ok({ version: 1, key: 'not-uuid', quote: makeQuote() } as WithdrawIntent),
    );
    await h.controller.start();
    expect(h.controller.getSnapshot().phase).toBe('error');
    expect(h.bridge.options).not.toHaveBeenCalled();
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    h.journal.load.mockRejectedValueOnce(new Error('journal fictif indisponible'));
    await h.controller.refresh();
    expect(h.controller.getSnapshot().error?.code).toBe('JOURNAL_READ_FAILED');
  });
  it('un redémarrage simulé ne fabrique pas une nouvelle clé après réponse perdue', async () => {
    const h = harness();
    await review(h);
    h.bridge.confirm.mockRejectedValueOnce(new Error('réponse fictive perdue'));
    await h.controller.confirm();
    const sent = h.bridge.confirm.mock.calls[0]![0];
    h.controller.dispose();
    const fresh = h.fresh();
    await fresh.start();
    expect(h.bridge.confirm).toHaveBeenCalledTimes(1);
    await fresh.refresh();
    expect(h.bridge.confirm.mock.calls[1]![0]).toEqual(sent);
    expect(h.createKey).toHaveBeenCalledTimes(1);
  });
  it('deux contrôleurs du même bridge partagent une soumission, même pendant une écriture lente', async () => {
    const h = harness();
    const other = createWithdrawController(h.services, { now: h.now });
    await review(h);
    await other.start();
    other.selectOperator('wave');
    other.setAmount('5000');
    await other.prepare();
    const gate = deferred<WithdrawResult<void>>();
    h.journal.save.mockReturnValueOnce(gate.promise);
    const first = h.controller.confirm();
    const second = other.confirm();
    gate.resolve(ok(undefined));
    await Promise.all([first, second]);
    expect(h.bridge.confirm).toHaveBeenCalledTimes(1);
    expect(other.getSnapshot().operation?.amountXof).toBe(2500);
  });
  it('un résultat incertain se relit sans soumettre et la reprise explicite garde la même référence', async () => {
    const h = harness();
    await review(h);
    const q = h.controller.getSnapshot().quote!,
      uncertain = makeOperation(q, { status: 'incertain', failure: 'PROVIDER_UNAVAILABLE' });
    h.bridge.confirm.mockResolvedValueOnce(ok(uncertain));
    await h.controller.confirm();
    h.bridge.reconcile.mockResolvedValueOnce(ok(uncertain));
    await h.controller.refresh();
    expect(h.bridge.reconcile).toHaveBeenCalledWith(uncertain.id);
    expect(h.bridge.confirm).toHaveBeenCalledTimes(1);
    expect(h.bridge.retry).not.toHaveBeenCalled();
    h.bridge.retry.mockResolvedValueOnce(ok(makeOperation(q)));
    await h.controller.retry(uncertain.id);
    expect(h.bridge.retry).toHaveBeenCalledWith(uncertain.id);
    expect(h.controller.getSnapshot().phase).toBe('success');
  });
  it('ignore une ancienne reprise ciblant un autre identifiant', async () => {
    const h = harness();
    await review(h);
    h.bridge.confirm.mockResolvedValueOnce(
      ok(makeOperation(h.controller.getSnapshot().quote!, { status: 'en_attente' })),
    );
    await h.controller.confirm();
    await h.controller.retry(id(999));
    expect(h.bridge.retry).not.toHaveBeenCalled();
  });
  it('404 après lecture d’une référence connue ne prouve pas un échec et ne libère pas une intention', async () => {
    const h = harness();
    h.setSaved({ version: 1, key: id(100), quote: makeQuote(), withdrawalId: id(500) });
    await h.controller.start();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      canNewRequest: false,
      error: { code: 'WITHDRAWAL_NOT_FOUND' },
    });
    expect(h.journal.clear).not.toHaveBeenCalled();
  });
  it('masque toutes les données hors écran et n’émet aucun replay au retour sans identifiant', async () => {
    const h = harness();
    await review(h);
    h.bridge.confirm.mockRejectedValueOnce(new Error('réponse fictive perdue'));
    await h.controller.confirm();
    h.controller.suspend();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'suspended',
      quote: null,
      operation: null,
      balance: null,
      operator: null,
      amountInput: '',
    });
    expect(h.getSaved()).not.toBeNull();
    await h.controller.confirm();
    await h.controller.refresh();
    await h.controller.retry();
    expect(h.bridge.confirm).toHaveBeenCalledTimes(1);
    await h.controller.resume();
    expect(h.controller.getSnapshot().phase).toBe('unknown');
    expect(h.bridge.confirm).toHaveBeenCalledTimes(1);
  });
  it('ignore un ancien devis à la suspension et reprend sans attendre cette lecture', async () => {
    const h = harness();
    await h.controller.start();
    h.controller.selectOperator('wave');
    h.controller.setAmount('2500');
    const gate = deferred<WithdrawResult<WithdrawQuote>>();
    h.bridge.quote.mockReturnValueOnce(gate.promise);
    const pending = h.controller.prepare();
    h.controller.suspend();
    await h.controller.resume();
    expect(h.controller.getSnapshot().phase).toBe('operator');
    gate.resolve(ok(makeQuote()));
    await pending;
    expect(h.controller.getSnapshot().quote).toBeNull();
  });
  it('conserve le résultat d’une confirmation terminée après destruction pour le nouvel écran', async () => {
    const h = harness();
    await review(h);
    const q = h.controller.getSnapshot().quote!,
      gate = deferred<WithdrawResult<WithdrawOperation>>();
    h.bridge.confirm.mockReturnValueOnce(gate.promise);
    const pending = h.controller.confirm();
    await drain();
    h.controller.dispose();
    const other = createWithdrawController(h.services, { now: h.now });
    await other.start();
    expect(other.getSnapshot().phase).toBe('submitting');
    gate.resolve(ok(makeOperation(q)));
    await pending;
    expect(other.getSnapshot().phase).toBe('success');
    expect(h.getSaved()?.withdrawalId).toBe(id(500));
  });
  it('un échec de sauvegarde de référence conserve le succès et le couple de récupération', async () => {
    const h = harness();
    await review(h);
    const original = h.journal.save.getMockImplementation()!;
    h.journal.save
      .mockImplementationOnce(original)
      .mockResolvedValueOnce(fail('JOURNAL_WRITE_FAILED'));
    await h.controller.confirm();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'success',
      error: { code: 'JOURNAL_WRITE_FAILED' },
      canNewRequest: true,
    });
    expect(h.getSaved()?.key).toBe(id(100));
    expect(h.getSaved()?.withdrawalId).toBeUndefined();
  });
  it('la lecture d’un conflit de journal adopte l’intention existante sans POST ni effacement', async () => {
    const h = harness();
    await review(h);
    h.setSaved({ version: 1, key: id(300), quote: makeQuote(5000) });
    await h.controller.confirm();
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    await h.controller.refresh();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      quote: { amountXof: 5000 },
      canNewRequest: false,
    });
    expect(h.journal.clear).not.toHaveBeenCalled();
    expect(h.bridge.confirm).not.toHaveBeenCalled();
  });
  it('un acquittement perdu d’écriture ne permet pas d’effacer l’intention retrouvée', async () => {
    const h = harness();
    await review(h);
    h.journal.save.mockImplementationOnce(async (intent) => {
      h.setSaved(intent);
      throw new Error('acquittement fictif perdu');
    });
    await h.controller.confirm();
    const persisted = h.getSaved();
    await h.controller.newRequest();
    expect(h.journal.clear).not.toHaveBeenCalled();
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    expect(h.getSaved()).toEqual(persisted);
    expect(h.controller.getSnapshot()).toMatchObject({ phase: 'unknown', canNewRequest: false });
    await h.controller.refresh();
    expect(h.bridge.confirm).toHaveBeenCalledWith({
      quoteId: persisted!.quote.id,
      key: persisted!.key,
    });
  });
  it('une collision UUID n’autorise jamais l’effacement d’un autre prix déjà enregistré', async () => {
    const h = harness();
    await review(h);
    const original: WithdrawIntent = { version: 1, key: id(100), quote: makeQuote(5000) };
    h.setSaved(original);
    await h.controller.confirm();
    await h.controller.newRequest();
    expect(h.bridge.confirm).not.toHaveBeenCalled();
    expect(h.journal.clear).not.toHaveBeenCalled();
    expect(h.getSaved()).toEqual(original);
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: 'unknown',
      quote: { amountXof: 5000 },
      canNewRequest: false,
    });
  });
  it('réunit les doubles reprises explicites en une seule requête de même identifiant', async () => {
    const h = harness();
    await review(h);
    const q = h.controller.getSnapshot().quote!;
    h.bridge.confirm.mockResolvedValueOnce(
      ok(makeOperation(q, { status: 'incertain', failure: 'PROVIDER_UNAVAILABLE' })),
    );
    await h.controller.confirm();
    const gate = deferred<WithdrawResult<WithdrawOperation>>();
    h.bridge.retry.mockReturnValueOnce(gate.promise);
    const first = h.controller.retry(id(500)),
      second = h.controller.retry(id(500));
    expect(h.bridge.retry).toHaveBeenCalledTimes(1);
    gate.resolve(ok(makeOperation(q)));
    await Promise.all([first, second]);
    expect(h.controller.getSnapshot().phase).toBe('success');
    expect(h.bridge.confirm).toHaveBeenCalledTimes(1);
  });
  it('ne publie jamais la clé d’idempotence dans le snapshot, même après succès', async () => {
    const h = harness();
    await review(h);
    await h.controller.confirm();
    expect(JSON.stringify(h.controller.getSnapshot())).not.toContain(id(100));
    expect(h.getSaved()?.key).toBe(id(100));
  });
});
