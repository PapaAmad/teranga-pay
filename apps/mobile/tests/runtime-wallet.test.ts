import { fail, ok, type RateInfo, type WalletEvent } from '@teranga-pay/contracts';

import type { NativePayment, NativeWallet, NativeWalletEvent } from '../modules/teranga-wallet/src';
import { createWalletServices, type WalletRates } from '../src/runtime/wallet';
import * as ldkWallet from '../src/wallet/ldkWallet';

jest.mock('../src/onboarding/platform', () => ({
  createPlatformServices: (wallet?: object) => ({
    mode: wallet ? 'native' : 'unavailable',
    wallet,
    storage: {},
    protection: {},
    random: {},
  }),
}));

const instant = Date.parse('2026-11-18T12:00:00.000Z');
const rate: RateInfo = {
  xofPerBtc: 50_000_000,
  source: 'fixe',
  fetchedAt: new Date(instant).toISOString(),
};
const settings = {
  electrumUrl: 'tcp://10.0.2.2:50001',
  peerId: `02${'b'.repeat(64)}`,
  peerAddress: '10.0.2.2:9735',
};
const quote = {
  id: 'quote-test',
  amountXof: 1000,
  amountSats: 2000,
  xofPerBtc: rate.xofPerBtc,
  source: rate.source,
  createdAt: new Date(instant).toISOString(),
  expiresAt: new Date(instant + 300_000).toISOString(),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup({ absent = false, unavailable = false } = {}) {
  let exists = !absent;
  let running = false;
  let journal: string | null = null;
  const payments: NativePayment[] = [];
  let emitNative: ((event: NativeWalletEvent) => void) | null = null;
  const native: NativeWallet = {
    exists: jest.fn(() => exists),
    isRunning: jest.fn(() => running),
    create: jest.fn(async () => {
      exists = true;
      return Array.from({ length: 12 }, (_, index) => `test-word-${index}`);
    }),
    restore: jest.fn(async () => {
      exists = true;
    }),
    unlock: jest.fn(async () => {
      running = true;
      return { ok: true as const };
    }),
    verifyPin: jest.fn(async () => ({ ok: true as const })),
    lock: jest.fn(async () => {
      running = false;
    }),
    setScreenSecure: jest.fn(async () => true),
    nodeId: jest.fn(async () => `02${'b'.repeat(64)}`),
    balance: jest.fn(async () => ({
      lightningSats: 10_000,
      spendableSats: 9_000,
      outboundSats: 9_000,
      inboundSats: 0,
      onchainSats: 0,
      channelsReady: 1,
    })),
    receive: jest.fn(async () => ({ paymentRequest: 'lnbcrt2000test', paymentId: 'incoming-id' })),
    receiveForDescriptionHash: jest.fn(async () => 'lnbcrt2000test'),
    sha256Hex: jest.fn((text: string) => text),
    decode: jest.fn(async () => ({
      amountSats: 2000,
      expiresAt: (instant + 600_000) / 1000,
      expired: false,
      regtest: true,
      payee: 'test-payee',
      paymentHash: 'outgoing-id',
      descriptionHash: null,
    })),
    send: jest.fn(async () => {
      payments.push({
        id: 'outgoing-id',
        direction: 'envoye',
        status: 'reussi',
        amountSats: 2000,
        feeSats: 3,
        updatedAt: instant / 1000,
      });
      return 'outgoing-id';
    }),
    payments: jest.fn(async () => payments),
    journalRead: jest.fn(async () => journal),
    journalWrite: jest.fn(async (text: string) => {
      journal = text;
    }),
    addListener: jest.fn((_event, listener) => {
      emitNative = listener;
      return { remove: jest.fn() };
    }),
  };
  const rates: WalletRates = {
    current: jest.fn(() => rate),
    refresh: jest.fn(async () => ok(rate)),
    quote: jest.fn(async () => ok(quote)),
  };
  const risk = { check: jest.fn(async () => ({})) };
  const services = createWalletServices({
    native: unavailable ? null : native,
    settings,
    rates,
    risk,
    now: () => instant,
  });
  return {
    ...services,
    native,
    rates,
    risk,
    payments,
    emit: (event: NativeWalletEvent) => emitNative?.(event),
  };
}

describe('composition native partagée', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ferme les services métier sans module natif et ne crée aucun faux wallet', () => {
    const factory = jest.spyOn(ldkWallet, 'createLdkWallet');
    const services = setup({ unavailable: true });
    expect(factory).not.toHaveBeenCalled();
    expect(services.wallet).toBeNull();
    for (const key of ['onboarding', 'home', 'send', 'history', 'collect'] as const) {
      expect(services[key].mode).toBe('unavailable');
      expect(services[key].wallet).toBeUndefined();
    }
  });

  it('instancie LDK une seule fois et partage le wallet entre tous les parcours', () => {
    const factory = jest.spyOn(ldkWallet, 'createLdkWallet');
    const services = setup();
    expect(factory).toHaveBeenCalledTimes(1);
    for (const key of ['onboarding', 'home', 'send', 'history', 'collect'] as const) {
      expect(services[key].mode).toBe('native');
      expect(services[key].wallet).toBe(services.wallet);
    }
    expect(services.send.rates).toBe(services.rates);
    expect(services.send.risk).toBe(services.risk);
  });

  it('réclame une authentification au chargement et publie verrouillage et ouverture', async () => {
    const services = setup();
    const events: WalletEvent[] = [];
    const release = services.wallet!.subscribe((event) => events.push(event));
    expect(await services.wallet!.state()).toBe('verrouille');
    expect(await services.home.wallet!.balance()).toEqual(fail('WALLET_LOCKED'));
    expect(services.native.balance).not.toHaveBeenCalled();
    await services.onboarding.wallet!.unlock('000000');
    expect(await services.wallet!.state()).toBe('pret');
    await services.wallet!.lock();
    expect(events).toEqual([
      { type: 'etat', state: 'pret' },
      { type: 'etat', state: 'verrouille' },
    ]);
    services.emit({ type: 'canal_pret' });
    expect(events).toHaveLength(2);
    release();
  });

  it('rafraîchit le taux avant solde et aperçu, puis retire les FCFA si le taux échoue', async () => {
    const services = setup();
    await services.wallet!.unlock('000000');
    expect(await services.home.wallet!.balance()).toMatchObject({
      ok: true,
      value: { spendableXof: 4500, rate },
    });
    expect(await services.send.wallet!.preview('lnbcrt2000test')).toMatchObject({
      ok: true,
      value: { amountXof: 1000 },
    });
    expect(services.rates.refresh).toHaveBeenCalledTimes(2);
    jest.mocked(services.rates.refresh).mockResolvedValueOnce(fail('NETWORK_OFFLINE'));
    expect(await services.home.wallet!.balance()).toMatchObject({
      ok: true,
      value: { spendableXof: null, rate: null },
    });
  });

  it('retire une lecture et empêche un envoi dont le taux arrive après le verrouillage', async () => {
    const services = setup();
    await services.wallet!.unlock('000000');
    const pending = deferred<ReturnType<typeof ok<RateInfo>>>();
    jest.mocked(services.rates.refresh).mockReturnValue(pending.promise);
    const balance = services.wallet!.balance();
    const send = services.wallet!.send({ destination: 'lnbcrt2000test', pin: '000000' });
    await services.wallet!.lock();
    pending.resolve(ok(rate));
    expect(await balance).toEqual(fail('WALLET_LOCKED'));
    expect(await send).toEqual(fail('WALLET_LOCKED'));
    expect(services.native.balance).not.toHaveBeenCalled();
    expect(services.native.send).not.toHaveBeenCalled();
  });

  it('ne rend jamais les mots quand une création aboutit après le verrouillage', async () => {
    const services = setup({ absent: true });
    const pending = deferred<string[]>();
    jest.mocked(services.native.create).mockReturnValue(pending.promise);
    const creation = services.wallet!.create('000000');
    await services.wallet!.lock();
    jest.mocked(services.native.exists).mockReturnValue(true);
    pending.resolve(Array.from({ length: 12 }, () => 'test-word'));
    expect(await creation).toEqual(fail('WALLET_LOCKED'));
    expect(await services.wallet!.state()).toBe('verrouille');
    expect(services.native.lock).toHaveBeenCalledTimes(2);
  });

  it('remet les mots créés même si le démarrage échoue, sans ouvrir la session', async () => {
    const services = setup({ absent: true });
    const events: WalletEvent[] = [];
    const release = services.wallet!.subscribe((event) => events.push(event));
    jest
      .mocked(services.native.unlock)
      .mockRejectedValueOnce(
        Object.assign(new Error('TEST_NODE_START_FAILED'), { code: 'NETWORK_OFFLINE' }),
      );
    expect(await services.wallet!.create('000000')).toEqual(
      ok({ recoveryWords: Array.from({ length: 12 }, (_, index) => `test-word-${index}`) }),
    );
    expect(services.native.create).toHaveBeenCalledTimes(1);
    expect(await services.wallet!.state()).toBe('verrouille');
    expect(await services.wallet!.balance()).toEqual(fail('WALLET_LOCKED'));
    expect(events).toEqual([{ type: 'etat', state: 'verrouille' }]);
    expect(await services.wallet!.unlock('000000')).toEqual(ok(undefined));
    expect(await services.wallet!.state()).toBe('pret');
    expect(services.native.create).toHaveBeenCalledTimes(1);
    release();
  });

  it('interdit un ancien envoi même si une nouvelle session ouvre le coffre entretemps', async () => {
    const services = setup();
    await services.wallet!.unlock('000000');
    const pending = deferred<{ ok: true }>();
    jest.mocked(services.native.verifyPin).mockReturnValue(pending.promise);
    const send = services.wallet!.send({ destination: 'lnbcrt2000test', pin: '000000' });
    await Promise.resolve();
    await Promise.resolve();
    expect(services.native.verifyPin).toHaveBeenCalledTimes(1);
    await services.wallet!.lock();
    await services.wallet!.unlock('000000');
    pending.resolve({ ok: true });
    expect(await send).toEqual(fail('WALLET_LOCKED'));
    expect(services.native.send).not.toHaveBeenCalled();
    jest.mocked(services.native.verifyPin).mockResolvedValue({ ok: true });
    expect(
      await services.wallet!.send({
        destination: 'lnbcrt2000test',
        amountSats: 2000,
        amountXof: 1400,
        xofPerBtc: 70_000_000,
        pin: '000000',
      }),
    ).toMatchObject({ ok: true, value: { amountXof: 1400 } });
  });

  it('transmet le prix confirmé et le conserve dans le journal malgré un nouveau taux', async () => {
    const services = setup();
    await services.wallet!.unlock('000000');
    jest
      .mocked(services.rates.refresh)
      .mockResolvedValueOnce(ok({ ...rate, xofPerBtc: 70_000_000 }));
    expect(
      await services.send.wallet!.send({
        destination: 'lnbcrt2000test',
        amountSats: 2000,
        maxFeeSats: 20,
        amountXof: 1000,
        xofPerBtc: 50_000_000,
        expiresAt: quote.expiresAt,
        pin: '000000',
      }),
    ).toMatchObject({ ok: true, value: { amountXof: 1000 } });
    expect(services.rates.refresh).toHaveBeenCalledTimes(1);
    expect(await services.history.wallet!.history()).toMatchObject({
      ok: true,
      value: [{ id: 'outgoing-id', amountXof: 1000 }],
    });
    expect(services.native.send).toHaveBeenCalledTimes(1);
    expect(
      await services.wallet!.send({
        destination: 'lnbcrt2000test',
        amountSats: 2000,
        amountXof: 1400,
        xofPerBtc: 70_000_000,
        pin: '000000',
      }),
    ).toEqual(fail('ALREADY_PAID'));
    expect(await services.wallet!.history()).toMatchObject({
      ok: true,
      value: [{ id: 'outgoing-id', amountXof: 1000 }],
    });
    expect(services.native.send).toHaveBeenCalledTimes(1);
  });

  it('crée une seule facture pour le devis, au prix figé et avant son expiration', async () => {
    const services = setup();
    await services.wallet!.unlock('000000');
    const [first, second] = await Promise.all([
      services.collect.invoices!.create({ quote }),
      services.collect.invoices!.create({ quote }),
    ]);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      value: {
        paymentId: 'incoming-id',
        invoice: { amountSats: 2000, amountXof: 1000 },
      },
    });
    expect(services.native.receive).toHaveBeenCalledTimes(1);
    expect(services.native.receive).toHaveBeenCalledWith(2000, 'Teranga Pay', 299);
    expect(
      await services.collect.invoices!.create({ quote: { ...quote, amountXof: 2000 } }),
    ).toEqual({ ok: false, error: { code: 'INVALID_DATA' } });
  });

  it.each([
    { amountXof: -1, xofPerBtc: rate.xofPerBtc },
    { amountXof: 1000, xofPerBtc: 0 },
    { amountXof: 999, xofPerBtc: rate.xofPerBtc },
    { amountXof: 1000 },
    { xofPerBtc: rate.xofPerBtc },
  ])('refuse un prix confirmé invalide avant tout paiement : %o', async (confirmed) => {
    const services = setup();
    await services.wallet!.unlock('000000');
    expect(
      await services.wallet!.send({
        destination: 'lnbcrt2000test',
        amountSats: 2000,
        ...confirmed,
        pin: '000000',
      }),
    ).toEqual(fail('AMOUNT_INVALID'));
    expect(services.native.send).not.toHaveBeenCalled();
  });

  it('refuse un prix expiré après confirmation PIN avant tout paiement', async () => {
    const services = setup();
    await services.wallet!.unlock('000000');
    expect(
      await services.wallet!.send({
        destination: 'lnbcrt2000test',
        amountSats: 2000,
        amountXof: 1000,
        xofPerBtc: rate.xofPerBtc,
        expiresAt: new Date(instant).toISOString(),
        pin: '000000',
      }),
    ).toEqual(fail('INVOICE_EXPIRED'));
    expect(services.native.send).not.toHaveBeenCalled();
  });

  it('refuse un devis incohérent ou trop proche de son échéance sans créer de facture', async () => {
    const services = setup();
    await services.wallet!.unlock('000000');
    expect(
      await services.collect.invoices!.create({ quote: { ...quote, amountSats: 4000 } }),
    ).toEqual({ ok: false, error: { code: 'INVALID_DATA' } });
    expect(
      await services.collect.invoices!.create({
        quote: { ...quote, id: 'short-quote', expiresAt: new Date(instant + 60_000).toISOString() },
      }),
    ).toEqual({ ok: false, error: { code: 'QUOTE_EXPIRED' } });
    expect(services.native.receive).not.toHaveBeenCalled();
  });

  it('relit exactement paymentId et facture, sans confondre une réception au même montant', async () => {
    const services = setup();
    await services.wallet!.unlock('000000');
    await services.collect.invoices!.create({ quote });
    services.payments.push({
      id: 'other-id',
      direction: 'recu',
      status: 'reussi',
      amountSats: 2000,
      feeSats: 0,
      updatedAt: instant / 1000,
    });
    const lookup = { paymentId: 'incoming-id', paymentRequest: 'lnbcrt2000test' };
    expect(await services.collect.invoices!.lookup(lookup)).toEqual(
      ok({ paymentRequest: 'lnbcrt2000test', payment: null }),
    );
    expect(
      await services.collect.invoices!.lookup({ ...lookup, paymentRequest: 'lnbcrtother' }),
    ).toEqual({ ok: false, error: { code: 'PAYMENT_MISMATCH' } });
    expect(await services.collect.invoices!.lookup({ ...lookup, paymentId: 'other-id' })).toEqual({
      ok: false,
      error: { code: 'PAYMENT_MISMATCH' },
    });
    services.payments.push({ ...services.payments[0]!, id: 'incoming-id' });
    expect(await services.collect.invoices!.lookup(lookup)).toMatchObject({
      ok: true,
      value: { payment: { id: 'incoming-id', amountXof: 1000 } },
    });
  });
});
