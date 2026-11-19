import {
  isAcceptableRequest,
  pollOnce,
  registerAddress,
  startAddressInbox,
  type InboxOptions,
} from '../src/wallet/addressInbox';

const now = Date.parse('2026-11-07T12:00:00.000Z');
const hash = 'a'.repeat(64);
const request = (overrides: Record<string, unknown> = {}) => ({
  id: '11111111-2222-4333-8444-555555555555',
  amountMsat: 5_000_000,
  descriptionHash: hash,
  expiresAt: '2026-11-07T12:00:20.000Z',
  ...overrides,
});

type Call = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  redirect?: 'error';
};

function fakeApi(responses: Array<{ status: number; body?: unknown } | Error>) {
  const calls: Call[] = [];
  const fetch = jest.fn(
    async (
      url: string,
      init: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        redirect?: 'error';
      },
    ) => {
      calls.push({
        url,
        method: init.method ?? 'GET',
        headers: init.headers,
        body: init.body,
        redirect: init.redirect,
      });
      if (init.method === 'POST' && url.includes('/me/requests/')) {
        return { ok: true, status: 204, json: async () => null };
      }
      const next = responses.shift() ?? { status: 200, body: { requests: [] } };
      if (next instanceof Error) throw next;
      return { ok: next.status < 400, status: next.status, json: async () => next.body };
    },
  );
  return { fetch, calls };
}

function options(fetch: InboxOptions['fetch'], events: unknown[] = []): InboxOptions {
  return {
    apiUrl: 'http://api.test/',
    token: 'jeton-secret',
    fetch,
    native: { receiveForDescriptionHash: jest.fn(async (msat: number) => `lnbcrtfacture${msat}`) },
    now: () => now,
    onEvent: (event) => events.push(event),
  };
}

describe('adresse Lightning du téléphone (réception)', () => {
  it('transmet le même jeton déjà préparé et refuse tout remplacement dans la réponse', async () => {
    const token = 'demo'.repeat(10) + 'abc';
    const { fetch, calls } = fakeApi([
      { status: 201, body: { address: 'mame@teranga.example', token } },
      { status: 201, body: { address: 'mame@teranga.example', token: 'other'.repeat(8) + 'abc' } },
      { status: 201, body: { address: 'someone@teranga.example', token } },
      { status: 201, body: { address: 'mame@invalid domain', token } },
    ]);
    await expect(registerAddress('http://api.test', ' Mame ', fetch, token)).resolves.toEqual({
      ok: true,
      address: 'mame@teranga.example',
      token,
    });
    expect(JSON.parse(calls[0]!.body!)).toEqual({ username: 'mame', registrationToken: token });
    expect(calls[0]!.redirect).toBe('error');
    for (let index = 0; index < 3; index += 1)
      await expect(registerAddress('http://api.test', 'mame', fetch, token)).resolves.toEqual({
        ok: false,
        code: 'UNKNOWN',
      });
  });

  it.each([
    '',
    'short',
    'a'.repeat(42),
    'a'.repeat(44),
    'a'.repeat(42) + '!',
    'a'.repeat(43) + '\n',
  ])('refuse le jeton client invalide avant transport : %s', async (token) => {
    const { fetch } = fakeApi([]);
    await expect(registerAddress('http://api.test', 'mame', fetch, token)).resolves.toEqual({
      ok: false,
      code: 'UNKNOWN',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('réserve un nom et rend le jeton une seule fois', async () => {
    const { fetch, calls } = fakeApi([
      { status: 201, body: { address: 'mame@teranga.example', token: 'jeton' } },
    ]);
    expect(await registerAddress('http://api.test', ' Mame ', fetch)).toEqual({
      ok: true,
      address: 'mame@teranga.example',
      token: 'jeton',
    });
    expect(calls[0]).toMatchObject({
      url: 'http://api.test/v1/lightning-addresses',
      method: 'POST',
    });
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ username: 'mame' });
  });

  it('traduit nom pris, nom invalide et réseau coupé', async () => {
    expect(
      await registerAddress('http://api.test', 'mame', fakeApi([{ status: 409 }]).fetch),
    ).toEqual({
      ok: false,
      code: 'USERNAME_TAKEN',
    });
    expect(await registerAddress('http://api.test', 'a', fakeApi([]).fetch)).toEqual({
      ok: false,
      code: 'USERNAME_INVALID',
    });
    expect(
      await registerAddress('http://api.test', 'mame', fakeApi([new TypeError('réseau')]).fetch),
    ).toEqual({ ok: false, code: 'NETWORK_OFFLINE' });
  });

  it('répond à une demande avec une facture au montant et au hachage demandés', async () => {
    const events: unknown[] = [];
    const { fetch, calls } = fakeApi([{ status: 200, body: { requests: [request()] } }]);
    const opts = options(fetch, events);
    expect(await pollOnce(opts, new Set())).toBe('ok');
    expect(opts.native.receiveForDescriptionHash).toHaveBeenCalledWith(5_000_000, hash, 600);
    expect(calls[0]?.headers).toEqual({ authorization: 'Bearer jeton-secret' });
    expect(calls[1]).toMatchObject({
      url: 'http://api.test/v1/lightning-addresses/me/requests/11111111-2222-4333-8444-555555555555',
      method: 'POST',
    });
    expect(JSON.parse(calls[1]?.body ?? '{}')).toEqual({ paymentRequest: 'lnbcrtfacture5000000' });
    expect(events).toEqual([{ type: 'facture_envoyee', amountMsat: 5_000_000 }]);
  });

  it('ne répond jamais deux fois à la même demande', async () => {
    const { fetch } = fakeApi([
      { status: 200, body: { requests: [request()] } },
      { status: 200, body: { requests: [request()] } },
    ]);
    const opts = options(fetch);
    const answered = new Set<string>();
    await pollOnce(opts, answered);
    await pollOnce(opts, answered);
    expect(opts.native.receiveForDescriptionHash).toHaveBeenCalledTimes(1);
  });

  const invalid: Array<[string, Record<string, unknown>]> = [
    ['expirée', { expiresAt: '2026-11-07T11:59:59.000Z' }],
    ['montant trop gros', { amountMsat: 5_000_000_001 }],
    ['montant sous 1 sat', { amountMsat: 999 }],
    ['montant non entier', { amountMsat: 1_500.5 }],
    ['hachage mal formé', { descriptionHash: 'zz' }],
    ['identifiant piégé', { id: '../../admin' }],
  ];
  for (const [label, overrides] of invalid) {
    it(`ignore une demande ${label}`, () => {
      expect(isAcceptableRequest(request(overrides), now)).toBe(false);
    });
  }

  it('signale un jeton refusé et une coupure réseau', async () => {
    expect(await pollOnce(options(fakeApi([{ status: 401 }]).fetch), new Set())).toBe(
      'jeton_refuse',
    );
    expect(await pollOnce(options(fakeApi([new TypeError('réseau')]).fetch), new Set())).toBe(
      'reseau',
    );
  });

  it('espace les essais après des coupures, puis s’arrête sur demande', async () => {
    const waits: number[] = [];
    const { fetch } = fakeApi([new TypeError('a'), new TypeError('b'), new TypeError('c')]);
    let inbox: { stop: () => void } | null = null;
    inbox = startAddressInbox({
      ...options(fetch),
      sleep: async (ms) => {
        waits.push(ms);
        if (waits.length === 3) inbox?.stop();
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(waits).toEqual([1_000, 2_000, 4_000]);
  });

  it('coupe l’attente en cours à l’arrêt et ne répond plus ensuite', async () => {
    let aborted = false;
    let release: (() => void) | null = null;
    const fetch = jest.fn(
      (_url: string, init: { signal?: AbortSignal }) =>
        new Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>(
          (resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              aborted = true;
              reject(new Error('annulé'));
            });
            // Si l'arrêt ne coupait pas l'attente, le serveur répondrait avec une demande.
            release = () =>
              resolve({ ok: true, status: 200, json: async () => ({ requests: [request()] }) });
          },
        ),
    );
    const opts = options(fetch);
    const inbox = startAddressInbox(opts);
    await new Promise((resolve) => setTimeout(resolve, 0));
    inbox.stop();
    (release as (() => void) | null)?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(aborted).toBe(true);
    expect(opts.native.receiveForDescriptionHash).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('ne renvoie rien si l’arrêt survient pendant la création de la facture', async () => {
    const events: unknown[] = [];
    const { fetch, calls } = fakeApi([{ status: 200, body: { requests: [request()] } }]);
    const stopper = new AbortController();
    const opts: InboxOptions = {
      ...options(fetch, events),
      signal: stopper.signal,
      native: {
        receiveForDescriptionHash: jest.fn(async () => {
          stopper.abort();
          return 'lnbcrtfacture';
        }),
      },
    };
    expect(await pollOnce(opts, new Set())).toBe('arrete');
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
    expect(events).toEqual([]);
  });

  it('n’annonce rien si l’arrêt survient pendant la réponse au serveur', async () => {
    const events: unknown[] = [];
    const stopper = new AbortController();
    let postSignal: AbortSignal | undefined;
    const fetch = jest.fn(async (_url: string, init: { method?: string; signal?: AbortSignal }) => {
      if (init.method === 'POST') {
        postSignal = init.signal;
        stopper.abort();
        throw new Error('annulé');
      }
      return { ok: true, status: 200, json: async () => ({ requests: [request()] }) };
    });
    const opts: InboxOptions = { ...options(fetch, events), signal: stopper.signal };
    expect(await pollOnce(opts, new Set())).toBe('arrete');
    expect(postSignal).toBe(stopper.signal);
    expect(events).toEqual([]);
  });
  it('n’annonce rien si l’arrêt survient alors que le serveur accepte la facture', async () => {
    const events: unknown[] = [];
    const stopper = new AbortController();
    const fetch = jest.fn(async (_url: string, init: { method?: string }) => {
      if (init.method === 'POST') {
        stopper.abort();
        return { ok: true, status: 204, json: async () => null };
      }
      return { ok: true, status: 200, json: async () => ({ requests: [request()] }) };
    });
    const opts: InboxOptions = { ...options(fetch, events), signal: stopper.signal };
    expect(await pollOnce(opts, new Set())).toBe('arrete');
    expect(events).toEqual([]);
  });
});
