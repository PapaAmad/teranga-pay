import { createRuntimeApi, type RuntimeApiConfig, type RuntimeFetch } from '../src/runtime/api';
import type { WithdrawQuote } from '../src/withdraw/ports';
import type { HistoryWithdrawal } from '../src/history/ports';

const baseUrl = 'http://10.0.2.2:3000';
const now = Date.parse('2026-11-18T12:00:00.000Z');
const quoteId = '20000000-0000-4000-8000-000000000001';
const operationId = '30000000-0000-4000-8000-000000000001';
const key = '10000000-0000-4000-8000-000000000001';
const requestId = '40000000-0000-4000-8000-000000000001';
// Marqueur synthétique calculé uniquement dans le test, sans accès à un vrai coffre.
const token = () => 'demo'.repeat(12);
const rate = { xofPerBtc: 45_000_000, source: 'fixe', fetchedAt: new Date(now).toISOString() };
const quote = {
  id: quoteId,
  amountXof: 2500,
  amountSats: 5556,
  xofPerBtc: 45_000_000,
  source: 'fixe',
  createdAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 300_000).toISOString(),
};
const withdrawQuote: WithdrawQuote = {
  ...quote,
  source: 'fixe',
  simulation: true,
  operator: 'wave',
  recipientId: 'wave-demo-001',
  feeXof: 100,
  totalXof: 2600,
  feeSats: 222,
  totalSats: 5778,
};
const withdrawal = (patch: Partial<HistoryWithdrawal> = {}): HistoryWithdrawal => {
  const { createdAt, expiresAt, ...fields } = withdrawQuote;
  return {
    ...fields,
    id: operationId,
    quoteId,
    quoteCreatedAt: createdAt,
    quoteExpiresAt: expiresAt,
    createdAt,
    updatedAt: createdAt,
    status: 'reussi',
    failure: null,
    ...patch,
  };
};
const failed = (code: string) => ({ ok: false, error: { code } });
const response = (value: unknown, status = 200) => ({
  status,
  text: async () => JSON.stringify(value),
});
function setup(value: unknown = rate, status = 200, extra: Partial<RuntimeApiConfig> = {}) {
  const fetch = jest.fn<ReturnType<RuntimeFetch>, Parameters<RuntimeFetch>>();
  fetch.mockResolvedValue(response(value, status));
  const bridgeToken = jest.fn(async () => token());
  const api = createRuntimeApi({ baseUrl, fetch, bridgeToken, now: () => now, ...extra });
  return { api, fetch, bridgeToken };
}

describe('T11 | HTTP et session du raccordement', () => {
  it('résout le jeton hors composants pour chaque accès fictif, jamais pour les taux ou alertes', async () => {
    const { api, fetch, bridgeToken } = setup();
    expect(api.rates.current()).toBeNull();
    await expect(api.rates.refresh()).resolves.toEqual({ ok: true, value: rate });
    expect(api.rates.current()).toEqual(rate);
    fetch.mockResolvedValueOnce(response(quote, 201));
    await expect(api.rates.quote(2500)).resolves.toEqual({ ok: true, value: quote });
    fetch.mockResolvedValueOnce(response({ simulation: true, availableSats: 5000, heldSats: 500 }));
    await expect(api.bridge.balance()).resolves.toEqual({
      ok: true,
      value: { simulation: true, availableSats: 5000, heldSats: 500 },
    });
    bridgeToken.mockResolvedValueOnce('other'.repeat(10));
    await api.bridge.balance();
    expect(bridgeToken).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![1].headers).not.toHaveProperty('Authorization');
    expect(fetch.mock.calls[1]![1].headers).not.toHaveProperty('Authorization');
    expect(fetch.mock.calls[2]![1].headers.Authorization).toBe(`Bearer ${token()}`);
    expect(fetch.mock.calls[3]![1].headers.Authorization).toBe(`Bearer ${'other'.repeat(10)}`);
    expect(fetch.mock.calls.every(([, init]) => init.redirect === 'error')).toBe(true);
  });

  it.each([
    null,
    '',
    'too-short',
    'demo'.repeat(40),
    'demo'.repeat(10) + '\r\nheader',
    'demo'.repeat(10) + '\n',
  ])('refuse le jeton absent ou invalide sans transport : %p', async (value) => {
    const { api, fetch } = setup(rate, 200, { bridgeToken: async () => value });
    await expect(api.bridge.balance()).resolves.toEqual(failed('UNAUTHORIZED'));
    await expect(api.withdrawals.history()).resolves.toEqual(failed('UNAUTHORIZED'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('traite un coffre refusé comme une session absente sans reprendre son exception', async () => {
    const { api, fetch } = setup(rate, 200, {
      bridgeToken: async () => {
        throw new Error('PRIVATE_DETAIL');
      },
    });
    await expect(api.bridge.options()).resolves.toEqual(failed('UNAUTHORIZED'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    'http://outside.example',
    'https://user:password@example.test',
    'https://example.test/path',
    'https://example.test/?token=demo',
    'https://example.test/#fragment',
    'file:///api',
    '',
  ])('refuse une origine ambiguë ou HTTP hors démonstration locale : %s', async (baseUrl) => {
    const { api, fetch, bridgeToken } = setup(rate, 200, { baseUrl });
    await expect(api.rates.refresh()).resolves.toEqual(failed('INVALID_INPUT'));
    await expect(api.bridge.balance()).resolves.toEqual(failed('INVALID_INPUT'));
    expect(fetch).not.toHaveBeenCalled();
    expect(bridgeToken).not.toHaveBeenCalled();
  });

  it.each([
    'https://api.example.test/',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
    'http://localhost:3000',
  ])('accepte une origine explicite : %s', async (baseUrl) => {
    const { api, fetch } = setup(rate, 200, { baseUrl });
    await api.rates.refresh();
    expect(fetch.mock.calls[0]![0]).toBe(`${baseUrl.replace(/\/$/, '')}/v1/rate`);
  });

  it('annule un transport lent et ne réessaie jamais une confirmation financière', async () => {
    jest.useFakeTimers();
    try {
      const { api, fetch } = setup(undefined, 200, { timeoutMs: 100 });
      fetch.mockImplementation(() => new Promise(() => {}));
      const confirming = api.bridge.confirm({ quoteId, key });
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(100);
      await expect(confirming).resolves.toEqual(failed('READ_TIMEOUT'));
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true);
      expect(fetch.mock.calls[0]![1]).toMatchObject({
        method: 'POST',
        body: JSON.stringify({ quoteId }),
        headers: { 'Idempotency-Key': key },
      });
      fetch.mockResolvedValueOnce(response(withdrawal(), 200));
      await expect(api.bridge.confirm({ quoteId, key })).resolves.toMatchObject({ ok: true });
      expect(fetch.mock.calls[1]![1].headers['Idempotency-Key']).toBe(key);
      expect(fetch.mock.calls[1]![1].body).toBe(fetch.mock.calls[0]![1].body);
    } finally {
      jest.useRealTimers();
    }
  });

  it('un coffre qui répond après le délai ne peut pas encore démarrer le POST', async () => {
    jest.useFakeTimers();
    try {
      let release!: (value: string) => void;
      const bridgeToken = () =>
        new Promise<string>((resolve) => {
          release = resolve;
        });
      const { api, fetch } = setup(undefined, 200, { bridgeToken, timeoutMs: 100 });
      const pending = api.bridge.confirm({ quoteId, key });
      await jest.advanceTimersByTimeAsync(100);
      await expect(pending).resolves.toEqual(failed('READ_TIMEOUT'));
      release(token());
      await Promise.resolve();
      await Promise.resolve();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('dispose annule les lectures et efface le cache sans nouvelle requête', async () => {
    const { api, fetch } = setup();
    await api.rates.refresh();
    fetch.mockImplementation(() => new Promise(() => {}));
    const pending = api.rates.refresh();
    api.dispose();
    await expect(pending).resolves.toEqual(failed('READ_FAILED'));
    expect(fetch.mock.calls[1]![1].signal.aborted).toBe(true);
    expect(api.rates.current()).toBeNull();
    await expect(api.rates.refresh()).resolves.toEqual(failed('READ_FAILED'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('ferme l’ancien accès au coffre sans permettre au POST de traverser un nouveau déverrouillage', async () => {
    let release!: (value: string) => void;
    const bridgeToken = jest.fn(async () => token());
    bridgeToken.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const { api, fetch } = setup(withdrawal(), 201, { bridgeToken });
    const previousSession = api.bridge.confirm({ quoteId, key });
    api.cancelPending();
    await expect(previousSession).resolves.toEqual(failed('READ_FAILED'));
    release(token());
    await Promise.resolve();
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
    await expect(api.bridge.confirm({ quoteId, key })).resolves.toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![1].headers['Idempotency-Key']).toBe(key);
  });

  it('cache les détails réseau et rejette JSON cassé, trop gros et code HTTP inattendu', async () => {
    const { api, fetch } = setup();
    fetch.mockRejectedValueOnce(new Error('PRIVATE_NETWORK_DETAIL'));
    await expect(api.rates.refresh()).resolves.toEqual(failed('READ_FAILED'));
    fetch.mockResolvedValueOnce({ status: 200, text: async () => '{' });
    await expect(api.rates.refresh()).resolves.toEqual(failed('INVALID_DATA'));
    fetch.mockResolvedValueOnce({ status: 200, text: async () => ' '.repeat(262_145) });
    await expect(api.rates.refresh()).resolves.toEqual(failed('INVALID_DATA'));
    fetch.mockResolvedValueOnce(response(rate, 302));
    await expect(api.rates.refresh()).resolves.toEqual(failed('INVALID_DATA'));
  });

  it('ne laisse jamais un taux vieillissant se présenter comme le taux actuel', async () => {
    let clock = now;
    const { api, fetch } = setup(rate, 200, { now: () => clock });
    await api.rates.refresh();
    clock += 600_001;
    expect(api.rates.current()).toBeNull();
    await expect(api.rates.refresh()).resolves.toEqual(failed('INVALID_DATA'));
    fetch.mockResolvedValueOnce(
      response({ ...rate, fetchedAt: new Date(clock + 30_001).toISOString() }),
    );
    await expect(api.rates.refresh()).resolves.toEqual(failed('INVALID_DATA'));
  });
});

describe('T11 | validation des frontières taux, risque et simulation', () => {
  it.each([
    { ...rate, xofPerBtc: 999_999 },
    { ...rate, xofPerBtc: 10_000_000_001 },
    { ...rate, xofPerBtc: '45000000' },
    { ...rate, source: 'unknown' },
    { ...rate, fetchedAt: '2026-02-30T12:00:00.000Z' },
    { ...rate, token: 'unexpected' },
  ])('refuse un taux incohérent : %p', async (value) => {
    const { api } = setup(value);
    await expect(api.rates.refresh()).resolves.toEqual(failed('INVALID_DATA'));
    expect(api.rates.current()).toBeNull();
  });

  it.each([
    { ...quote, amountXof: 2000 },
    { ...quote, amountSats: 5555 },
    { ...quote, amountSats: 2_100_000_000_000_001 },
    { ...quote, id: '../escape' },
    { ...quote, expiresAt: quote.createdAt },
    { ...quote, expiresAt: new Date(now + 3_600_001).toISOString() },
    { ...quote, xofPerBtc: 1 },
  ])('refuse le devis qui ne correspond pas au montant ou au contrat : %p', async (value) => {
    const { api } = setup(value, 201);
    await expect(api.rates.quote(2500)).resolves.toEqual(failed('INVALID_DATA'));
  });

  it.each([0, -1, 0.1, 5_000_001, NaN, Infinity, '2500'])(
    'refuse le montant externe avant transport : %p',
    async (amount) => {
      const { api, fetch } = setup();
      await expect(api.rates.quote(amount as number)).resolves.toEqual(failed('INVALID_INPUT'));
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('raccorde T26 avec le contrôle existant, nombres seuls sans jeton bridge', async () => {
    const assessment = {
      score: 30,
      level: 'moyen',
      confirmationRequired: false,
      reasons: [{ code: 'NOUVEAU_DESTINATAIRE', points: 30 }],
    };
    const { api, fetch, bridgeToken } = setup(assessment);
    const input = {
      amountSats: 1000,
      newRecipient: true,
      recentPayments: [],
      usualAmountsSats: [],
    };
    await expect(
      api.risk.check({ ...input, address: 'PRIVATE_LOCAL' } as typeof input),
    ).resolves.toEqual(assessment);
    expect(fetch.mock.calls[0]![0]).toBe(`${baseUrl}/v1/alerts/payment-check`);
    expect(fetch.mock.calls[0]![1].body).toBe(JSON.stringify(input));
    expect(bridgeToken).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0]![1].headers).not.toHaveProperty('Authorization');
    fetch.mockResolvedValueOnce(response({ ...assessment, score: 101 }));
    await expect(api.risk.check(input)).rejects.toThrow('RISK_INVALID_RESPONSE');
    await expect(api.risk.check({ ...input, amountSats: -1 })).rejects.toThrow(
      'RISK_INVALID_INPUT',
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('raccorde options et devis strictement fictifs avec les deux destinataires autorisés', async () => {
    const options = {
      simulation: true,
      currency: 'XOF',
      feeXof: 100,
      maxAmountXof: 5_000_000,
      operators: [
        { operator: 'wave', recipientId: 'wave-demo-001' },
        { operator: 'orange_money', recipientId: 'orange-demo-001' },
      ],
    };
    const { api, fetch } = setup(options);
    await expect(api.bridge.options()).resolves.toEqual({ ok: true, value: options });
    fetch.mockResolvedValueOnce(response(withdrawQuote, 201));
    await expect(
      api.bridge.quote({ operator: 'wave', recipientId: 'wave-demo-001', amountXof: 2500 }),
    ).resolves.toEqual({ ok: true, value: withdrawQuote });
    expect(fetch.mock.calls[1]![0]).toBe(`${baseUrl}/v1/withdrawal-quotes`);
    expect(fetch.mock.calls[1]![1].body).toBe(
      JSON.stringify({ operator: 'wave', recipientId: 'wave-demo-001', amountXof: 2500 }),
    );
  });

  it.each([
    { ...withdrawQuote, simulation: false },
    { ...withdrawQuote, recipientId: 'orange-demo-001' },
    { ...withdrawQuote, amountXof: 5000 },
    { ...withdrawQuote, feeXof: 101 },
    { ...withdrawQuote, feeSats: 223 },
    { ...withdrawQuote, totalSats: 5777 },
    { ...withdrawQuote, expiresAt: new Date(now + 300_001).toISOString() },
  ])('refuse un devis de simulation incohérent : %p', async (value) => {
    const { api } = setup(value, 201);
    await expect(
      api.bridge.quote({ operator: 'wave', recipientId: 'wave-demo-001', amountXof: 2500 }),
    ).resolves.toEqual(failed('INVALID_DATA'));
  });

  it('ne remplace pas une confirmation par une autre référence et reprend la même opération', async () => {
    const { api, fetch } = setup(withdrawal(), 201);
    await expect(api.bridge.confirm({ quoteId, key })).resolves.toEqual({
      ok: true,
      value: withdrawal(),
    });
    fetch.mockResolvedValueOnce(response(withdrawal()));
    await expect(api.bridge.get(operationId)).resolves.toMatchObject({ ok: true });
    fetch.mockResolvedValueOnce(response(withdrawal()));
    await expect(api.bridge.reconcile(operationId)).resolves.toMatchObject({ ok: true });
    fetch.mockResolvedValueOnce(
      response(withdrawal({ status: 'incertain', failure: 'PROVIDER_UNAVAILABLE' }), 202),
    );
    await expect(api.bridge.retry(operationId)).resolves.toMatchObject({
      ok: true,
      value: { id: operationId, status: 'incertain' },
    });
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method, init.body])).toEqual([
      [`${baseUrl}/v1/withdrawals`, 'POST', JSON.stringify({ quoteId })],
      [`${baseUrl}/v1/withdrawals/${operationId}`, 'GET', undefined],
      [`${baseUrl}/v1/withdrawals/${operationId}/reconcile`, 'POST', '{}'],
      [`${baseUrl}/v1/withdrawals/${operationId}/retry`, 'POST', '{}'],
    ]);
    fetch.mockResolvedValueOnce(response(withdrawal({ quoteId: key }), 201));
    await expect(api.bridge.confirm({ quoteId, key })).resolves.toEqual(failed('INVALID_DATA'));
    fetch.mockResolvedValueOnce(response(withdrawal({ id: key })));
    await expect(api.bridge.get(operationId)).resolves.toEqual(failed('INVALID_DATA'));
  });

  it.each([
    { simulation: false },
    { totalXof: 2700 },
    { amountSats: 5555 },
    { quoteCreatedAt: '2026-02-30T12:00:00.000Z' },
    { updatedAt: new Date(now - 1).toISOString() },
    { createdAt: withdrawQuote.expiresAt },
    { failure: 'PRIVATE DETAIL' },
    { status: 'reussi', failure: 'PROVIDER_DECLINED' },
    { status: 'unknown' },
  ])('refuse un retrait externe incohérent : %p', async (patch) => {
    const { api } = setup({ ...withdrawal(), ...patch });
    await expect(api.bridge.get(operationId)).resolves.toEqual(failed('INVALID_DATA'));
  });

  it('ne transmet pas les identifiants, destinataires ou paramètres invalides', async () => {
    const { api, fetch } = setup();
    await expect(api.bridge.confirm({ quoteId, key: 'wrong' })).resolves.toEqual(
      failed('INVALID_INPUT'),
    );
    await expect(api.bridge.get('../escape')).resolves.toEqual(failed('INVALID_INPUT'));
    await expect(api.bridge.reconcile('../escape')).resolves.toEqual(failed('INVALID_INPUT'));
    await expect(api.bridge.retry('../escape')).resolves.toEqual(failed('INVALID_INPUT'));
    await expect(
      api.bridge.quote({ operator: 'wave', recipientId: 'orange-demo-001', amountXof: 2500 }),
    ).resolves.toEqual(failed('INVALID_INPUT'));
    await expect(api.withdrawals.history({ limit: 101 })).resolves.toEqual(failed('INVALID_INPUT'));
    await expect(api.withdrawals.history({ before: 'bad' })).resolves.toEqual(
      failed('INVALID_INPUT'),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('valide la pagination sans confondre son solde fictif avec le wallet', async () => {
    const page = { simulation: true, items: [withdrawal()], nextCursor: operationId };
    const { api, fetch } = setup(page);
    await expect(api.withdrawals.history({ limit: 1 })).resolves.toEqual({ ok: true, value: page });
    expect(fetch.mock.calls[0]![0]).toBe(`${baseUrl}/v1/withdrawals?limit=1`);
    fetch.mockResolvedValueOnce(response({ simulation: true, items: [], nextCursor: null }));
    await expect(api.withdrawals.history({ limit: 1, before: operationId })).resolves.toEqual({
      ok: true,
      value: { simulation: true, items: [], nextCursor: null },
    });
    expect(fetch.mock.calls[1]![0]).toBe(`${baseUrl}/v1/withdrawals?limit=1&before=${operationId}`);
    fetch.mockResolvedValueOnce(
      response({ ...page, items: [withdrawal(), withdrawal()], nextCursor: null }),
    );
    await expect(api.withdrawals.history()).resolves.toEqual(failed('INVALID_DATA'));
    fetch.mockResolvedValueOnce(response({ ...page, nextCursor: key }));
    await expect(api.withdrawals.history({ limit: 1 })).resolves.toEqual(failed('INVALID_DATA'));
    fetch.mockResolvedValueOnce(response(page));
    await expect(api.withdrawals.history({ before: operationId })).resolves.toEqual(
      failed('INVALID_DATA'),
    );
  });

  it('conserve seulement la référence de conflit validée par le serveur authentifié', async () => {
    const body = { error: { code: 'IDEMPOTENCY_CONFLICT', requestId, withdrawalId: operationId } };
    const { api, fetch } = setup(body, 409);
    await expect(api.bridge.confirm({ quoteId, key })).resolves.toEqual({
      ok: false,
      error: { code: 'IDEMPOTENCY_CONFLICT', withdrawalId: operationId },
    });
    await expect(api.rates.quote(2500)).resolves.toEqual(failed('INVALID_DATA'));
    fetch.mockResolvedValueOnce(
      response({ error: { ...body.error, withdrawalId: 'invalid' } }, 409),
    );
    await expect(api.bridge.confirm({ quoteId, key })).resolves.toEqual(failed('INVALID_DATA'));
    fetch.mockResolvedValueOnce(response({ error: { code: 'UNAUTHORIZED', requestId } }, 401));
    await expect(api.bridge.balance()).resolves.toEqual(failed('UNAUTHORIZED'));
    fetch.mockResolvedValueOnce(
      response({ error: { code: 'INTERNAL_ERROR', requestId, detail: 'PRIVATE' } }, 500),
    );
    await expect(api.bridge.balance()).resolves.toEqual(failed('INVALID_DATA'));
  });
});
