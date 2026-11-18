import type { HomePayment, HomeResult, HomeWalletEvent } from '../src/home/ports';
import type { RiskAssessment, RiskCheck, RiskPort } from '../src/risk/ports';
import { createSendController } from '../src/send/controller';
import type { SendServices, SendWalletPort } from '../src/send/ports';
import { createSendPreviewServices, sendPreviewInvoice } from '../src/send/preview';

const instant = Date.parse('2026-11-12T12:00:00.000Z');
// Code synthétique : aucun PIN personnel ni wallet réel.
const testPin = '000000';
const low: RiskAssessment = {
  score: 0,
  level: 'faible',
  confirmationRequired: false,
  reasons: [],
};
const warning: RiskAssessment = {
  score: 60,
  level: 'eleve',
  confirmationRequired: true,
  reasons: [
    { code: 'NOUVEAU_DESTINATAIRE', points: 30 },
    { code: 'MONTANT_INHABITUEL', points: 30 },
  ],
};
const ok = <T>(value: T): HomeResult<T> => ({ ok: true, value });
const fail = <T>(code: string): HomeResult<T> => ({ ok: false, error: { code } });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function drain() {
  for (let step = 0; step < 20; step += 1) await Promise.resolve();
}

function fixture(assessment: unknown = warning) {
  let time = instant;
  const base = createSendPreviewServices('success', { now: () => time });
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const wallet: jest.Mocked<SendWalletPort> = {
    state: jest.fn(base.wallet!.state),
    balance: jest.fn(base.wallet!.balance),
    preview: jest.fn(base.wallet!.preview),
    send: jest.fn(base.wallet!.send),
    history: jest.fn(async () => ok<HomePayment[]>([])),
    subscribe: jest.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const risk: jest.Mocked<RiskPort> = {
    check: jest.fn<Promise<unknown>, [RiskCheck]>(async () => assessment),
  };
  const services: SendServices = { ...base, mode: 'native', wallet, risk };
  const controller = createSendController(services, { now: () => time });
  return {
    controller,
    services,
    wallet,
    risk,
    advance(ms: number) {
      time += ms;
    },
    emit(event: HomeWalletEvent) {
      listeners.forEach((listener) => listener(event));
    },
  };
}
async function review(test: ReturnType<typeof fixture>) {
  await test.controller.start();
  await test.controller.inspect(sendPreviewInvoice);
  expect(test.controller.getSnapshot().phase).toBe('review');
}

describe('T27 | avertissement avant le PIN', () => {
  it('présente les raisons serveur et exige un accord distinct avant le PIN et l’envoi', async () => {
    const test = fixture();
    await review(test);
    await test.controller.requestPin();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'riskWarning',
      risk: warning,
      committed: false,
      busy: false,
    });
    await test.controller.confirm(testPin);
    expect(test.wallet.send).not.toHaveBeenCalled();
    test.controller.acknowledgeRisk();
    expect(test.controller.getSnapshot().phase).toBe('pin');
    expect(test.wallet.send).not.toHaveBeenCalled();
    await test.controller.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledWith({
      destination: sendPreviewInvoice,
      amountSats: 10_000,
      maxFeeSats: 100,
      pin: testPin,
    });
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'success', committed: true });
  });

  it.each([
    [{ ...warning, score: 50, level: 'moyen' }, 'riskWarning'],
    [{ ...warning, confirmationRequired: false }, 'pin'],
    [low, 'pin'],
  ])(
    'respecte confirmationRequired sans déduire la décision du niveau : %p',
    async (response, phase) => {
      const test = fixture(response);
      await review(test);
      await test.controller.requestPin();
      expect(test.controller.getSnapshot().phase).toBe(phase);
      expect(test.wallet.send).not.toHaveBeenCalled();
    },
  );

  it('envoie seulement les nombres du contrat T26, sans facture, mémo, référence ni PIN', async () => {
    const test = fixture(low);
    const preview = test.wallet.preview.getMockImplementation()!;
    test.wallet.preview.mockImplementation(async (...args) => {
      const result = await preview(...args);
      return result.ok ? ok({ ...result.value, memo: 'message-fictif-a-garder-local' }) : result;
    });
    await review(test);
    await test.controller.requestPin();
    expect(test.wallet.history).toHaveBeenCalledWith({ limit: 50 });
    expect(test.risk.check).toHaveBeenCalledTimes(1);
    const payload = test.risk.check.mock.calls[0]![0];
    expect(payload).toEqual({
      amountSats: 10_000,
      newRecipient: true,
      recentPayments: [],
      usualAmountsSats: [],
      localHour: new Date(instant).getHours(),
      balanceSats: 100_000,
    });
    expect(JSON.stringify(payload)).not.toMatch(/lnbcrt|message-fictif|destination|memo|pin|id/i);
  });

  it('ne redemande ni analyse ni paiement sur un double appui pendant la lecture', async () => {
    const test = fixture();
    const pending = deferred<unknown>();
    test.risk.check.mockReturnValue(pending.promise);
    await review(test);
    const first = test.controller.requestPin();
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'riskChecking', busy: true });
    await test.controller.requestPin();
    test.controller.acknowledgeRisk();
    await test.controller.confirm(testPin);
    expect(test.risk.check).toHaveBeenCalledTimes(1);
    expect(test.wallet.send).not.toHaveBeenCalled();
    pending.resolve(warning);
    await first;
    expect(test.controller.getSnapshot().phase).toBe('riskWarning');
  });

  it('annule une alerte sans transmettre la demande au wallet', async () => {
    const test = fixture();
    await review(test);
    await test.controller.requestPin();
    test.controller.cancelRisk();
    await drain();
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'destination',
      destination: '',
      preview: null,
      risk: null,
      committed: false,
    });
    test.controller.acknowledgeRisk();
    await test.controller.confirm(testPin);
    expect(test.wallet.send).not.toHaveBeenCalled();
  });

  it('l’accord ne survit pas à la modification de la demande', async () => {
    const test = fixture();
    await review(test);
    await test.controller.requestPin();
    test.controller.acknowledgeRisk();
    test.controller.edit();
    await test.controller.inspect(sendPreviewInvoice);
    await test.controller.confirm(testPin);
    expect(test.wallet.send).not.toHaveBeenCalled();
    await test.controller.requestPin();
    expect(test.risk.check).toHaveBeenCalledTimes(2);
    expect(test.controller.getSnapshot().phase).toBe('riskWarning');
  });

  it('un PIN incomplet ne devient pas valide après l’accord de l’alerte', async () => {
    const test = fixture();
    await review(test);
    await test.controller.requestPin();
    test.controller.acknowledgeRisk();
    await test.controller.confirm('000');
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'pin',
      error: { code: 'PIN_FORMAT' },
    });
    expect(test.wallet.send).not.toHaveBeenCalled();
  });
});

describe('T27 | indisponibilité explicite', () => {
  it('ne transforme pas une absence de service en analyse favorable', async () => {
    const test = fixture();
    delete test.services.risk;
    await review(test);
    await test.controller.requestPin();
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'riskUnavailable', risk: null });
    expect(test.risk.check).not.toHaveBeenCalled();
    await test.controller.confirm(testPin);
    expect(test.wallet.send).not.toHaveBeenCalled();
    test.controller.acknowledgeRisk();
    expect(test.controller.getSnapshot().phase).toBe('pin');
    await test.controller.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    { ...warning, score: 101 },
    { ...warning, reasons: [{ code: 'CODE_INCONNU', points: 30 }] },
    { ...warning, reasons: [] },
    { ok: true, value: warning },
  ])('ne laisse pas une réponse incohérente ouvrir le PIN : %p', async (response) => {
    const test = fixture(response);
    await review(test);
    await test.controller.requestPin();
    expect(test.controller.getSnapshot()).toMatchObject({ phase: 'riskUnavailable', risk: null });
    expect(test.wallet.send).not.toHaveBeenCalled();
  });

  it('nettoie les erreurs du transport et permet un réessai de lecture sans envoyer', async () => {
    const test = fixture();
    test.risk.check.mockRejectedValueOnce(new Error('detail-serveur-a-ne-pas-afficher'));
    await review(test);
    await test.controller.requestPin();
    expect(test.controller.getSnapshot().phase).toBe('riskUnavailable');
    expect(JSON.stringify(test.controller.getSnapshot())).not.toContain('detail-serveur');
    await test.controller.requestPin();
    expect(test.controller.getSnapshot().phase).toBe('riskWarning');
    expect(test.risk.check).toHaveBeenCalledTimes(2);
    expect(test.wallet.send).not.toHaveBeenCalled();
  });

  it.each(['failure', 'throw', 'invalid'] as const)(
    'ne remplace pas un historique %s par un historique vide',
    async (mode) => {
      const test = fixture();
      if (mode === 'failure') test.wallet.history.mockResolvedValue(fail('READ_FAILED'));
      if (mode === 'throw')
        test.wallet.history.mockRejectedValue(new Error('history-private-detail'));
      if (mode === 'invalid')
        test.wallet.history.mockResolvedValue(ok([{ amountSats: -1 }] as unknown as HomePayment[]));
      await review(test);
      await test.controller.requestPin();
      expect(test.controller.getSnapshot()).toMatchObject({ phase: 'riskUnavailable', risk: null });
      expect(test.risk.check).not.toHaveBeenCalled();
      expect(JSON.stringify(test.controller.getSnapshot())).not.toContain('history-private');
    },
  );

  it.each(['history', 'server'] as const)(
    'borne à huit secondes la lecture %s, puis ignore sa réponse tardive',
    async (mode) => {
      jest.useFakeTimers();
      try {
        const test = fixture(low);
        const history = deferred<HomeResult<HomePayment[]>>();
        const response = deferred<unknown>();
        if (mode === 'history') test.wallet.history.mockReturnValue(history.promise);
        else test.risk.check.mockReturnValue(response.promise);
        await review(test);
        const checking = test.controller.requestPin();
        await drain();
        await jest.advanceTimersByTimeAsync(8000);
        await checking;
        expect(test.controller.getSnapshot()).toMatchObject({
          phase: 'riskUnavailable',
          risk: null,
          busy: false,
        });
        history.resolve(ok([]));
        response.resolve(low);
        await drain();
        expect(test.controller.getSnapshot().phase).toBe('riskUnavailable');
        if (mode === 'history') expect(test.risk.check).not.toHaveBeenCalled();
        expect(test.wallet.send).not.toHaveBeenCalled();
        test.controller.dispose();
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    },
  );
});

describe('T27 | invalidation de la confirmation', () => {
  it.each(['warn', 'missing'] as const)(
    'un devis expiré pendant %s exige une nouvelle lecture',
    async (mode) => {
      const test = fixture();
      if (mode === 'missing') delete test.services.risk;
      await review(test);
      await test.controller.requestPin();
      test.advance(300_000);
      test.controller.acknowledgeRisk();
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: 'review',
        error: { code: 'QUOTE_EXPIRED' },
      });
      await test.controller.confirm(testPin);
      expect(test.wallet.send).not.toHaveBeenCalled();
    },
  );

  it('ne présente pas un résultat favorable reçu après expiration du devis', async () => {
    const test = fixture(low);
    const response = deferred<unknown>();
    test.risk.check.mockReturnValue(response.promise);
    await review(test);
    const checking = test.controller.requestPin();
    await drain();
    test.advance(300_000);
    response.resolve(low);
    await checking;
    expect(test.controller.getSnapshot()).toMatchObject({
      phase: 'review',
      error: { code: 'QUOTE_EXPIRED' },
    });
    expect(test.wallet.send).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'suspend', 'lock', 'dispose'] as const)(
    'ignore une analyse tardive après %s et retire les informations visibles',
    async (action) => {
      const test = fixture(low);
      const response = deferred<unknown>();
      test.risk.check.mockReturnValue(response.promise);
      await review(test);
      const checking = test.controller.requestPin();
      await drain();
      if (action === 'cancel') test.controller.cancelRisk();
      if (action === 'suspend') test.controller.suspend();
      if (action === 'lock') test.emit({ type: 'etat', state: 'verrouille' });
      if (action === 'dispose') test.controller.dispose();
      response.resolve(low);
      await checking;
      await drain();
      expect(test.controller.getSnapshot()).toMatchObject({
        phase: action === 'cancel' ? 'destination' : action === 'lock' ? 'locked' : 'suspended',
        risk: null,
        destination: '',
        preview: null,
      });
      test.controller.acknowledgeRisk();
      await test.controller.confirm(testPin);
      expect(test.wallet.send).not.toHaveBeenCalled();
    },
  );

  it('ne transmet pas de contexte au serveur après une annulation pendant la lecture locale', async () => {
    const test = fixture();
    const history = deferred<HomeResult<HomePayment[]>>();
    test.wallet.history.mockReturnValue(history.promise);
    await review(test);
    const checking = test.controller.requestPin();
    test.controller.cancelRisk();
    history.resolve(ok([]));
    await checking;
    await drain();
    expect(test.risk.check).not.toHaveBeenCalled();
    expect(test.wallet.send).not.toHaveBeenCalled();
  });

  it('quitte la vérification si un autre écran déclenche entretemps la temporisation du PIN', async () => {
    const test = fixture(low);
    await review(test);
    await test.controller.requestPin();
    const second = createSendController(test.services, { now: () => instant });
    await second.start();
    await second.inspect(sendPreviewInvoice);
    const response = deferred<unknown>();
    test.risk.check.mockReturnValueOnce(response.promise);
    const checking = second.requestPin();
    await drain();
    test.wallet.send.mockResolvedValueOnce({
      ok: false,
      error: { code: 'PIN_LOCKED', retryAfterSeconds: 30 },
    });
    await test.controller.confirm(testPin);
    response.resolve(low);
    await checking;
    // La remise refusée relance aussi les lectures bornées du second écran.
    await drain();
    expect(second.getSnapshot()).toMatchObject({
      phase: 'destination',
      busy: false,
      risk: null,
      preview: null,
      retryAt: instant + 30_000,
    });
    second.acknowledgeRisk();
    await second.confirm(testPin);
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
    second.dispose();
  });

  it.each([
    ['success', 'resolve'],
    ['success', 'reject'],
    ['pending', 'resolve'],
    ['pending', 'reject'],
    ['unknown', 'resolve'],
    ['unknown', 'reject'],
  ] as const)(
    'une analyse tardive %s/%s ne remplace pas le paiement soumis par un autre écran',
    async (phase, outcome) => {
      const test = fixture(low);
      await review(test);
      await test.controller.requestPin();
      const second = createSendController(test.services, { now: () => instant });
      await second.start();
      await second.inspect(sendPreviewInvoice);
      const response = deferred<unknown>();
      test.risk.check.mockReturnValueOnce(response.promise);
      const checking = second.requestPin();
      await drain();
      expect(second.getSnapshot().phase).toBe('riskChecking');
      if (phase === 'unknown') test.wallet.send.mockResolvedValueOnce(fail('PAYMENT_TIMEOUT'));
      if (phase === 'pending')
        test.wallet.send.mockResolvedValueOnce(
          ok({
            id: 'paiement-concurrent-fictif',
            direction: 'envoye',
            status: 'en_attente',
            amountSats: 10_000,
            feeSats: 12,
            amountXof: 4500,
            memo: null,
            createdAt: new Date(instant).toISOString(),
            failure: null,
          }),
        );
      await test.controller.confirm(testPin);
      expect(second.getSnapshot()).toMatchObject({ phase, committed: true });
      if (outcome === 'resolve') response.resolve(warning);
      else response.reject(new Error('analyse-tardive-sans-effet'));
      await checking;
      await drain();
      expect(second.getSnapshot()).toMatchObject({ phase, committed: true, busy: false });
      second.acknowledgeRisk();
      await second.confirm(testPin);
      expect(test.wallet.send).toHaveBeenCalledTimes(1);
      second.dispose();
    },
  );

  it('ne contacte pas le serveur si un autre écran soumet pendant la lecture de l’historique', async () => {
    const test = fixture(low);
    await review(test);
    await test.controller.requestPin();
    const second = createSendController(test.services, { now: () => instant });
    await second.start();
    await second.inspect(sendPreviewInvoice);
    const history = deferred<HomeResult<HomePayment[]>>();
    test.wallet.history.mockReturnValueOnce(history.promise);
    const checking = second.requestPin();
    await test.controller.confirm(testPin);
    history.resolve(ok([]));
    await checking;
    await drain();
    expect(test.risk.check).toHaveBeenCalledTimes(1);
    expect(second.getSnapshot()).toMatchObject({ phase: 'success', committed: true });
    expect(test.wallet.send).toHaveBeenCalledTimes(1);
    second.dispose();
  });
});
