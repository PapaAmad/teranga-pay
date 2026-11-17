import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import { describe, it } from 'node:test';
import { buildApp } from './app.ts';
import { defaultConfig, loadConfig } from './config.ts';
import {
  createLightningAddressDirectory,
  lnurlMetadata,
  regtestInvoiceAmountMsat,
} from './lightning-address.ts';

async function api({ callbackTimeoutMs = 2_000, longPollMs = 2_000 } = {}) {
  let logs = '';
  const app = await buildApp({
    config: {
      ...defaultConfig,
      lightningAddress: { ...defaultConfig.lightningAddress, callbackTimeoutMs },
    },
    longPollMs,
    logStream: new Writable({
      write(chunk, _encoding, callback) {
        logs += chunk.toString();
        callback();
      },
    }),
  });
  return { app, logs: () => logs };
}

async function register(app: Awaited<ReturnType<typeof api>>['app'], username = 'mame') {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/lightning-addresses',
    payload: { username },
  });
  assert.equal(response.statusCode, 201);
  return response.json() as { address: string; token: string };
}

describe('montant inscrit dans une facture regtest', () => {
  it('lit les multiplicateurs BOLT11', () => {
    assert.equal(regtestInvoiceAmountMsat('lnbcrt10u1pxyz'), 1_000_000n);
    assert.equal(regtestInvoiceAmountMsat('lnbcrt2500n1pxyz'), 250_000n);
    assert.equal(regtestInvoiceAmountMsat('lnbcrt1m1pxyz'), 100_000_000n);
    assert.equal(regtestInvoiceAmountMsat('lnbcrt10p1pxyz'), 1n);
    assert.equal(regtestInvoiceAmountMsat('LNBCRT10U1PXYZ'), 1_000_000n);
  });

  it('refuse le mainnet, une facture sans montant et un picobitcoin non entier', () => {
    assert.equal(regtestInvoiceAmountMsat('lnbc10u1pxyz'), null);
    assert.equal(regtestInvoiceAmountMsat('lnbcrt1pxyz'), null);
    assert.equal(regtestInvoiceAmountMsat('lnbcrt15p1pxyz'), null);
    assert.equal(regtestInvoiceAmountMsat('pas une facture'), null);
  });
});

describe('adresse Lightning (LNURL-pay)', () => {
  it('relaie la demande du payeur au téléphone et renvoie sa facture', async () => {
    const { app, logs } = await api();
    const { address, token } = await register(app);
    assert.equal(address, 'mame@teranga.example');

    const discovery = await app.inject({ method: 'GET', url: '/.well-known/lnurlp/mame' });
    assert.equal(discovery.statusCode, 200);
    const pay = discovery.json();
    assert.equal(pay.tag, 'payRequest');
    assert.equal(pay.callback, 'http://127.0.0.1:3000/v1/lnurlp/mame/callback');
    assert.deepEqual(JSON.parse(pay.metadata), [
      ['text/plain', 'Paiement à mame via Teranga Pay'],
      ['text/identifier', 'mame@teranga.example'],
    ]);

    // Ousmane demande 10 000 sats ; le téléphone de Mame attend en écoute longue.
    const payer = app.inject({ method: 'GET', url: '/v1/lnurlp/mame/callback?amount=10000000' });
    const poll = await app.inject({
      method: 'GET',
      url: '/v1/lightning-addresses/me/requests',
      headers: { authorization: `Bearer ${token}` },
    });
    const [request] = poll.json().requests;
    assert.equal(request.amountMsat, 10_000_000);
    assert.equal(request.descriptionHash, createHash('sha256').update(pay.metadata).digest('hex'));

    const answered = await app.inject({
      method: 'POST',
      url: `/v1/lightning-addresses/me/requests/${request.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { paymentRequest: 'lnbcrt100u1pfacturedemame' },
    });
    assert.equal(answered.statusCode, 204);
    const callback = await payer;
    assert.deepEqual(callback.json(), { pr: 'lnbcrt100u1pfacturedemame', routes: [] });
    assert.ok(!logs().includes(token), 'le jeton n’apparaît jamais dans les journaux');
    assert.ok(!logs().includes('mame/callback?amount'), 'aucun paramètre d’URL journalisé');
    await app.close();
  });

  it('refuse une facture dont le montant diffère de la demande', async () => {
    const { app } = await api();
    const { token } = await register(app);
    const payer = app.inject({ method: 'GET', url: '/v1/lnurlp/mame/callback?amount=10000000' });
    const poll = await app.inject({
      method: 'GET',
      url: '/v1/lightning-addresses/me/requests',
      headers: { authorization: `Bearer ${token}` },
    });
    const { id } = poll.json().requests[0];
    const wrong = await app.inject({
      method: 'POST',
      url: `/v1/lightning-addresses/me/requests/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { paymentRequest: 'lnbcrt1m1pfacturetropgrosse' },
    });
    assert.equal(wrong.statusCode, 400);
    assert.equal(wrong.json().error.code, 'INVOICE_INVALID');
    await app.close();
    assert.equal((await payer).statusCode, 503, 'le payeur reçoit une erreur LNURL');
  });

  it('répond en erreur LNURL si le téléphone ne répond pas à temps', async () => {
    const { app } = await api({ callbackTimeoutMs: 1_000 });
    await register(app);
    const response = await app.inject({
      method: 'GET',
      url: '/v1/lnurlp/mame/callback?amount=1000',
    });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().status, 'ERROR');
    await app.close();
  });

  it('valide noms, montants et jetons', async () => {
    const { app } = await api({ longPollMs: 1_000 });
    await register(app);
    const taken = await app.inject({
      method: 'POST',
      url: '/v1/lightning-addresses',
      payload: { username: 'mame' },
    });
    assert.equal(taken.json().error.code, 'USERNAME_TAKEN');
    for (const username of ['MAJ', 'ab', 'admin', 'nom avec espace', 'é-accent']) {
      const invalid = await app.inject({
        method: 'POST',
        url: '/v1/lightning-addresses',
        payload: { username },
      });
      assert.equal(invalid.json().error.code, 'USERNAME_INVALID', username);
    }
    const unknown = await app.inject({ method: 'GET', url: '/.well-known/lnurlp/inconnu' });
    assert.equal(unknown.statusCode, 404);
    assert.equal(unknown.json().status, 'ERROR');
    for (const amount of ['999', '5000000001']) {
      const out = await app.inject({
        method: 'GET',
        url: `/v1/lnurlp/mame/callback?amount=${amount}`,
      });
      assert.equal(out.statusCode, 400, amount);
      assert.equal(out.json().reason, 'Montant hors limites');
    }
    for (const authorization of [undefined, 'Bearer faux', `Bearer ${'a'.repeat(43)}`]) {
      const denied = await app.inject({
        method: 'GET',
        url: '/v1/lightning-addresses/me/requests',
        headers: authorization ? { authorization } : {},
      });
      assert.equal(denied.statusCode, 401);
    }
    await app.close();
  });

  it('n’autorise pas un téléphone à répondre à la demande d’un autre', async () => {
    const { app } = await api();
    const mame = await register(app, 'mame');
    const awa = await register(app, 'awa');
    const payer = app.inject({ method: 'GET', url: '/v1/lnurlp/mame/callback?amount=1000' });
    const poll = await app.inject({
      method: 'GET',
      url: '/v1/lightning-addresses/me/requests',
      headers: { authorization: `Bearer ${mame.token}` },
    });
    const { id } = poll.json().requests[0];
    const stolen = await app.inject({
      method: 'POST',
      url: `/v1/lightning-addresses/me/requests/${id}`,
      headers: { authorization: `Bearer ${awa.token}` },
      payload: { paymentRequest: 'lnbcrt10n1pfactureawa' },
    });
    assert.equal(stolen.statusCode, 404);
    await app.close();
    await payer;
  });
});

describe('annuaire', () => {
  it('limite les demandes en attente par adresse', async () => {
    const directory = createLightningAddressDirectory({ maxPendingPerUser: 2 });
    directory.register('mame');
    const { descriptionHash } = lnurlMetadata('mame', 'teranga.example');
    const first = directory.requestInvoice('mame', 1_000, descriptionHash, 5_000);
    const second = directory.requestInvoice('mame', 1_000, descriptionHash, 5_000);
    assert.equal(await directory.requestInvoice('mame', 1_000, descriptionHash, 5_000), null);
    directory.close();
    assert.deepEqual(await Promise.all([first, second]), [null, null]);
  });

  it('lit le domaine et l’URL publique depuis l’environnement', () => {
    const config = loadConfig({
      LNADDRESS_DOMAIN: 'pay.teranga.example',
      PUBLIC_BASE_URL: 'http://10.0.2.2:3000',
    });
    assert.equal(config.lightningAddress.domain, 'pay.teranga.example');
    assert.equal(config.lightningAddress.publicBaseUrl, 'http://10.0.2.2:3000');
    assert.throws(() => loadConfig({ PUBLIC_BASE_URL: 'ftp://x' }), /PUBLIC_BASE_URL/);
    assert.throws(() => loadConfig({ LNADDRESS_DOMAIN: 'pas un domaine' }), /LNADDRESS_DOMAIN/);
  });
});
