import type { NativePayment, NativeWallet } from '../modules/teranga-wallet/src';
import { createAppRuntime } from '../src/runtime/composition';
import type { RuntimeFetch } from '../src/runtime/api';
import type { WithdrawIntent } from '../src/withdraw/ports';
import type { WithdrawJournalStorage } from '../src/withdraw/journal';
import { startAddressInbox } from '../src/wallet/addressInbox';

jest.mock('../src/wallet/addressInbox', () => ({
  ...jest.requireActual('../src/wallet/addressInbox'),
  startAddressInbox: jest.fn(() => ({ stop: jest.fn() })),
}));

const nodeId = `02${'b'.repeat(64)}`;
const syntheticToken = (marker = 'a') => marker.repeat(43);
const address = 'test-wallet@teranga.example';
const apiUrl = 'http://10.0.2.2:3000';
const key = '10000000-0000-4000-8000-000000000001';
const quoteId = '20000000-0000-4000-8000-000000000001';
const settings = {
  electrumUrl: 'tcp://10.0.2.2:50001',
  peerId: `03${'c'.repeat(64)}`,
  peerAddress: '10.0.2.2:9735',
};
const response = (value: unknown, status = 200) => ({
  status,
  text: async () => JSON.stringify(value),
});

function fakeNative() {
  let running = false;
  let integration = JSON.stringify({
    version: 1,
    bridgeToken: syntheticToken(),
    address: { address, token: syntheticToken('l') },
  });
  let walletJournal = JSON.stringify({
    version: 1,
    xof: { 'persisted-payment': 900 },
    invoices: {},
    sends: {},
    failures: {},
  });
  const payments: NativePayment[] = [
    {
      id: 'persisted-payment',
      direction: 'recu',
      status: 'reussi',
      amountSats: 2000,
      feeSats: 0,
      updatedAt: Math.floor(Date.now() / 1000),
    },
  ];
  const native: NativeWallet = {
    exists: jest.fn(() => true),
    isRunning: jest.fn(() => running),
    create: jest.fn(async () => []),
    restore: jest.fn(async () => undefined),
    unlock: jest.fn(async () => {
      running = true;
      return { ok: true as const };
    }),
    verifyPin: jest.fn(async () => ({ ok: true as const })),
    lock: jest.fn(async () => {
      running = false;
    }),
    nodeId: jest.fn(async () => nodeId),
    // Marqueur déterministe propre au test, distinct d'un SHA-256 de production.
    sha256Hex: jest.fn((text: string) =>
      Array.from(text)
        .reduce((sum, character) => sum + character.charCodeAt(0), 0)
        .toString(16)
        .padEnd(64, '0'),
    ),
    setScreenSecure: jest.fn(async () => true),
    balance: jest.fn(async () => ({
      lightningSats: 2000,
      spendableSats: 1900,
      outboundSats: 1900,
      inboundSats: 0,
      onchainSats: 0,
      channelsReady: 1,
    })),
    receive: jest.fn(async () => ({ paymentRequest: 'lnbcrt2000test', paymentId: 'invoice-id' })),
    receiveForDescriptionHash: jest.fn(async () => 'lnbcrt2000test'),
    decode: jest.fn(async () => ({
      amountSats: 2000,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      expired: false,
      regtest: true,
      payee: 'test-wallet',
      paymentHash: 'invoice-id',
      descriptionHash: null,
    })),
    send: jest.fn(async () => 'outgoing-id'),
    payments: jest.fn(async () => payments),
    journalRead: jest.fn(async () => walletJournal),
    journalWrite: jest.fn(async (text: string) => {
      walletJournal = text;
    }),
    integrationRead: jest.fn(async () => integration),
    integrationWrite: jest.fn(async (text: string) => {
      integration = text;
    }),
    integrationImport: jest.fn(async () => null),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  };
  return {
    native,
    rotateBridgeToken(marker: string) {
      integration = JSON.stringify({
        ...JSON.parse(integration),
        bridgeToken: syntheticToken(marker),
      });
    },
    persisted: () => ({ integration, walletJournal }),
  };
}

function setup(native: NativeWallet | null = fakeNative().native) {
  const fetch = jest.fn<ReturnType<RuntimeFetch>, Parameters<RuntimeFetch>>(async (url) => {
    if (url.endsWith('/v1/rate')) {
      return response({
        xofPerBtc: 50_000_000,
        source: 'fixe',
        fetchedAt: new Date().toISOString(),
      });
    }
    if (url.endsWith('/v1/withdrawal-balance')) {
      return response({ simulation: true, availableSats: 2_000_000, heldSats: 0 });
    }
    if (url.includes('/v1/withdrawals?')) {
      return response({ simulation: true, items: [], nextCursor: null });
    }
    throw new Error('UNEXPECTED_TEST_HTTP_REQUEST');
  });
  const data = new Map<string, string>();
  const journalStorage: WithdrawJournalStorage = {
    getItem: jest.fn(async (id: string) => data.get(id) ?? null),
    setItem: jest.fn(async (id: string, value: string) => {
      data.set(id, value);
    }),
    removeItem: jest.fn(async (id: string) => {
      data.delete(id);
    }),
  };
  const options = {
    native,
    settings,
    apiUrl,
    domain: 'teranga.example',
    createKey: () => key,
    createAddressToken: () => syntheticToken('n'),
    fetch,
    addressFetch: jest.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ address, token: syntheticToken('l') }),
    })) as unknown as typeof globalThis.fetch,
    journalStorage,
  };
  const runtime = createAppRuntime(options);
  return { runtime, fetch, journalStorage, options };
}

async function open(runtime: ReturnType<typeof createAppRuntime>) {
  expect(await runtime.props.onboardingServices.wallet!.unlock('000000')).toEqual({
    ok: true,
    value: undefined,
  });
  if (runtime.props.receiveServices.mode === 'native') {
    expect(await runtime.props.receiveServices.address.current()).toEqual({
      ok: true,
      value: { address },
    });
  }
}

describe('T11 | Composition métier et sessions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rend tous les parcours indisponibles sans coffre natif compatible', () => {
    for (const native of [null, { ...fakeNative().native, integrationRead: undefined }]) {
      const { runtime, fetch } = setup(native);
      expect(runtime.props.sessionWallet).toBeUndefined();
      for (const service of [
        runtime.props.onboardingServices,
        runtime.props.homeServices,
        runtime.props.receiveServices,
        runtime.props.sendServices,
        runtime.props.collectServices,
        runtime.props.historyServices,
        runtime.props.withdrawServices,
      ]) {
        expect(service.mode).toBe('unavailable');
      }
      expect(fetch).not.toHaveBeenCalled();
      runtime.dispose();
    }
  });

  it('partage le wallet et refuse la passerelle et LNURL avant le PIN', async () => {
    const { native } = fakeNative();
    const { runtime, fetch } = setup(native);
    const { props } = runtime;
    for (const service of [
      props.onboardingServices,
      props.homeServices,
      props.sendServices,
      props.collectServices,
      props.historyServices,
    ]) {
      expect(service.wallet).toBe(props.sessionWallet);
    }
    expect(await props.withdrawServices.bridge!.balance()).toEqual({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(await props.historyServices.withdrawals!.history()).toEqual({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(await props.withdrawServices.journal!.load()).toEqual({
      ok: false,
      error: { code: 'WALLET_LOCKED' },
    });
    if (props.receiveServices.mode === 'native') {
      expect(await props.receiveServices.address.current()).toEqual({
        ok: false,
        error: { code: 'WALLET_LOCKED' },
      });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(native.integrationRead).not.toHaveBeenCalled();
    expect(startAddressInbox).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it('verrouille en arrière-plan, coupe LNURL et reprend les mêmes données après le PIN', async () => {
    const phone = fakeNative();
    const before = phone.persisted();
    const { runtime, fetch } = setup(phone.native);
    await open(runtime);
    expect(startAddressInbox).toHaveBeenCalledTimes(1);
    expect(await runtime.props.homeServices.wallet!.balance()).toMatchObject({
      ok: true,
      value: { spendableSats: 1900, spendableXof: 950 },
    });
    expect(await runtime.props.historyServices.wallet!.history()).toMatchObject({
      ok: true,
      value: [{ id: 'persisted-payment', amountXof: 900 }],
    });
    expect(await runtime.props.withdrawServices.bridge!.balance()).toMatchObject({
      ok: true,
      value: { simulation: true },
    });
    const priorRequests = fetch.mock.calls.length;
    await runtime.setActive(false);
    expect(jest.mocked(startAddressInbox).mock.results[0]!.value.stop).toHaveBeenCalled();
    expect(await runtime.props.sessionWallet!.state()).toBe('verrouille');
    expect(await runtime.props.withdrawServices.bridge!.balance()).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(fetch).toHaveBeenCalledTimes(priorRequests);
    await runtime.setActive(true);
    expect(await runtime.props.sessionWallet!.state()).toBe('verrouille');
    await open(runtime);
    expect(startAddressInbox).toHaveBeenCalledTimes(2);
    expect(await runtime.props.historyServices.wallet!.history()).toMatchObject({
      ok: true,
      value: [{ id: 'persisted-payment', amountXof: 900 }],
    });
    expect(phone.persisted()).toEqual(before);
    expect(phone.native.create).not.toHaveBeenCalled();
    expect(phone.native.restore).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it('retrouve une intention fictive après rotation du jeton et redémarrage de la composition', async () => {
    const phone = fakeNative();
    const { runtime, options, fetch, journalStorage } = setup(phone.native);
    await open(runtime);
    const instant = Date.now();
    const intent: WithdrawIntent = {
      version: 1,
      key,
      quote: {
        id: quoteId,
        simulation: true,
        operator: 'wave',
        recipientId: 'wave-demo-001',
        amountXof: 1000,
        feeXof: 100,
        totalXof: 1100,
        amountSats: 2000,
        feeSats: 200,
        totalSats: 2200,
        xofPerBtc: 50_000_000,
        source: 'fixe',
        createdAt: new Date(instant).toISOString(),
        expiresAt: new Date(instant + 300_000).toISOString(),
      },
    };
    expect(await runtime.props.withdrawServices.journal!.save(intent)).toEqual({
      ok: true,
      value: undefined,
    });
    await runtime.setActive(false);
    phone.rotateBridgeToken('b');
    runtime.dispose();
    const restarted = createAppRuntime(options);
    await open(restarted);
    expect(await restarted.props.withdrawServices.journal!.load()).toEqual({
      ok: true,
      value: intent,
    });
    expect(await restarted.props.withdrawServices.bridge!.balance()).toMatchObject({ ok: true });
    expect(fetch.mock.calls.at(-1)![1].headers.Authorization).toBe(`Bearer ${syntheticToken('b')}`);
    expect(phone.native.sha256Hex).toHaveBeenLastCalledWith(`${nodeId}:${apiUrl}:demo-client-a`);
    expect(jest.mocked(journalStorage.setItem).mock.calls).toHaveLength(1);
    expect(jest.mocked(journalStorage.getItem).mock.calls.at(-1)![0]).toBe(
      jest.mocked(journalStorage.setItem).mock.calls[0]![0],
    );
    expect(phone.native.create).not.toHaveBeenCalled();
    expect(phone.native.restore).not.toHaveBeenCalled();
    restarted.dispose();
  });
});
