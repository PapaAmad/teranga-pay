import { fetchPayParams, normalizeAddress } from '../src/wallet/lightningAddress';

const demo = { domain: 'teranga.example', apiUrl: 'http://10.0.2.2:3000/' };

function deps(body: unknown, status = 200) {
  const urls: string[] = [];
  return {
    urls,
    value: {
      fetch: async (url: string) => {
        urls.push(url);
        return { ok: status < 400, status, json: async () => body };
      },
      decode: async () => {
        throw new Error('non utilisé');
      },
      sha256Hex: () => '',
      demo,
    },
  };
}

const payRequest = (callback: string) => ({
  tag: 'payRequest',
  callback,
  minSendable: 1_500,
  maxSendable: 9_999_999,
  metadata: '[]',
});

describe('adresse Lightning', () => {
  it('normalise et refuse les formes invalides', () => {
    expect(normalizeAddress(' lightning:Mame@Teranga.Example ')).toBe('mame@teranga.example');
    expect(normalizeAddress('mame@teranga')).toBeNull();
    expect(normalizeAddress('ma me@teranga.example')).toBeNull();
  });

  it('joint le domaine de démo par l’API locale et arrondit les bornes vers l’intérieur', async () => {
    const fake = deps(payRequest('http://10.0.2.2:3000/v1/lnurlp/mame/callback'));
    const params = await fetchPayParams('mame@teranga.example', fake.value);
    expect(fake.urls).toEqual(['http://10.0.2.2:3000/.well-known/lnurlp/mame']);
    expect(params.ok && params.value).toMatchObject({ minSats: 2, maxSats: 9_999 });
  });

  it('joint tout autre domaine en HTTPS uniquement', async () => {
    const fake = deps(payRequest('https://wallet.example/cb'));
    const params = await fetchPayParams('ousmane@wallet.example', fake.value);
    expect(fake.urls).toEqual(['https://wallet.example/.well-known/lnurlp/ousmane']);
    expect(params.ok).toBe(true);
  });

  it('refuse une réponse qui n’est pas une demande de paiement', async () => {
    const fake = deps({ tag: 'withdrawRequest' });
    expect(await fetchPayParams('mame@teranga.example', fake.value)).toEqual({
      ok: false,
      error: { code: 'DESTINATION_INVALID' },
    });
  });

  it('refuse un nom inconnu (404)', async () => {
    const fake = deps({}, 404);
    expect(await fetchPayParams('personne@teranga.example', fake.value)).toEqual({
      ok: false,
      error: { code: 'DESTINATION_INVALID' },
    });
  });

  it('refuse des bornes incohérentes', async () => {
    const fake = deps({
      ...payRequest('http://10.0.2.2:3000/cb'),
      minSendable: 5_000,
      maxSendable: 10,
    });
    expect((await fetchPayParams('mame@teranga.example', fake.value)).ok).toBe(false);
  });
});
