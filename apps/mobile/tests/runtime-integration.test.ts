import type { NativeWallet } from '../modules/teranga-wallet/src';
import { createIntegrationStore, parseIntegration } from '../src/runtime/integration';
import { createRuntimeAddress } from '../src/runtime/address';
import { encodeRegistrationToken } from '../src/runtime/random';
import { startAddressInbox } from '../src/wallet/addressInbox';

jest.mock('../src/wallet/addressInbox', () => ({
  ...jest.requireActual('../src/wallet/addressInbox'),
  startAddressInbox: jest.fn(() => ({ stop: jest.fn() })),
}));
const token = 'a'.repeat(43); // Capacité fictive, sans serveur ni fonds.
const nodeId = '02' + 'a'.repeat(64);
const address = `tp-${nodeId.slice(0, 24)}@teranga.example`;

function setup() {
  let active = true,
    stored: string | null = null,
    imported: string | null = null;
  const native = {
    isRunning: () => active,
    nodeId: jest.fn(async () => nodeId),
    integrationRead: jest.fn(async () => stored),
    integrationWrite: jest.fn(async (text: string) => {
      stored = text;
      imported = null;
    }),
    integrationImport: jest.fn(async () => imported),
  };
  const store = createIntegrationStore(native as unknown as NativeWallet, () => active);
  return {
    native,
    store,
    lock: () => {
      active = false;
    },
    unlock: () => {
      active = true;
    },
    stored: () => stored,
    import: (value: string) => {
      imported = value;
    },
  };
}

beforeEach(() => jest.clearAllMocks());

test('encode exactement 256 bits en base64url sans perte ni remplissage', () => {
  for (const bytes of [
    new Uint8Array(32),
    Uint8Array.from({ length: 32 }, (_, i) => i * 7),
    new Uint8Array(32).fill(255),
  ]) {
    expect(encodeRegistrationToken(bytes)).toBe(
      btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, ''),
    );
  }
  expect(() => encodeRegistrationToken(new Uint8Array(31))).toThrow('RANDOM_UNAVAILABLE');
});

test('le coffre verrouillé ne lit ni ne modifie les secrets', async () => {
  const h = setup();
  h.lock();
  await expect(h.store.read()).rejects.toThrow('WALLET_LOCKED');
  expect(h.native.integrationRead).not.toHaveBeenCalled();
});

test('le provisionnement conserve une adresse existante et survit à une nouvelle instance', async () => {
  const h = setup();
  await h.store.update((data) => ({ ...data, address: { address, token } }));
  h.import(JSON.stringify({ version: 1, bridgeToken: 'b'.repeat(64) }));
  expect(await h.store.read()).toEqual({
    version: 1,
    bridgeToken: 'b'.repeat(64),
    address: { address, token },
  });
  const again = createIntegrationStore(h.native as unknown as NativeWallet, () => true);
  expect(await again.read()).toEqual(JSON.parse(h.stored()!));
});

test('une erreur de chiffrement ne réinitialise pas silencieusement les jetons', async () => {
  const h = setup();
  h.native.integrationRead.mockRejectedValueOnce(new Error('INTEGRATION_READ_FAILED'));
  await expect(h.store.read()).rejects.toThrow('INTEGRATION_READ_FAILED');
  expect(h.native.integrationWrite).not.toHaveBeenCalled();
  expect(await h.store.read()).toEqual({ version: 1 });
});

test.each([
  { version: 1, pin: 'example' },
  { version: 1, bridgeToken: token + '\n' },
  { version: 1, address: { address, token: token + '\n' } },
  { version: 1, address: { address: address + '\n', token } },
])('refuse un contenu non conforme sans garder les champs interdits', (value) => {
  expect(() => parseIntegration(JSON.stringify(value))).toThrow();
});

function receive(h: ReturnType<typeof setup>, request: unknown) {
  return createRuntimeAddress({
    native: h.native as unknown as NativeWallet,
    store: h.store,
    apiUrl: 'http://127.0.0.1:3000',
    domain: 'teranga.example',
    allowed: () => h.native.isRunning(),
    createToken: () => token,
    fetch: request as typeof fetch,
  });
}

test('enregistre la capacité avant le premier POST et partage un seul appel concurrent', async () => {
  const h = setup();
  const request = jest.fn(async (_url: string, init?: RequestInit) => {
    expect(JSON.parse(h.stored()!).address).toEqual({ address, token });
    expect(JSON.parse(String(init?.body))).toEqual({
      username: address.split('@')[0],
      registrationToken: token,
    });
    expect(init?.redirect).toBe('error');
    return { ok: true, status: 201, json: async () => ({ address, token }) } as Response;
  });
  const port = receive(h, request);
  const [one, two] = await Promise.all([port.current(), port.current()]);
  expect(one).toEqual({ ok: true, value: { address } });
  expect(two).toEqual(one);
  expect(request).toHaveBeenCalledTimes(1);
  expect(startAddressInbox).toHaveBeenCalledTimes(1);
  port.stop();
});

test('un verrouillage pendant le POST ne perd pas le jeton et la reprise réemploie la même identité', async () => {
  const h = setup();
  const request = jest.fn(async () => {
    h.lock();
    return { ok: true, status: 201, json: async () => ({ address, token }) } as Response;
  });
  const first = receive(h, request);
  expect(await first.current()).toEqual({ ok: false, error: { code: 'WALLET_LOCKED' } });
  expect(JSON.parse(h.stored()!).address.token).toBe(token);
  expect(startAddressInbox).not.toHaveBeenCalled();
  first.stop();
  h.unlock();
  request.mockImplementation(
    async () => ({ ok: true, status: 201, json: async () => ({ address, token }) }) as Response,
  );
  const resumed = receive(h, request);
  expect(await resumed.current()).toEqual({ ok: true, value: { address } });
  expect(h.native.integrationWrite).toHaveBeenCalledTimes(1);
  resumed.stop();
});

test('ne contacte pas le serveur si la capacité ne peut pas être enregistrée', async () => {
  const h = setup();
  h.native.integrationWrite.mockRejectedValueOnce(new Error('DISK_FULL'));
  const request = jest.fn();
  const port = receive(h, request);
  expect((await port.current()).ok).toBe(false);
  expect(request).not.toHaveBeenCalled();
});
