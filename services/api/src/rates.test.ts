import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.ts';
import { defaultConfig, loadConfig } from './config.ts';
import { createQuoteStore, satsForXof } from './quotes.ts';
import {
  XOF_PER_EUR,
  fixedRateProvider,
  krakenRateProvider,
  parseKrakenEur,
  RateUnavailableError,
  type RateProvider,
} from './rates.ts';

function clock(start = Date.UTC(2026, 10, 7, 12)) {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

async function app(options: { rates?: RateProvider; now?: () => number } = {}) {
  const instance: FastifyInstance = await buildApp({
    config: { ...defaultConfig, logLevel: 'silent' },
    ...options,
  });
  return instance;
}

const krakenBody = (eur: string) => ({ error: [], result: { XXBTZEUR: { c: [eur, '0.1'] } } });

describe('conversion FCFA → sats', () => {
  it('arrondit au sat supérieur pour ne jamais sous-payer le commerçant', () => {
    assert.equal(satsForXof(2_500, 45_000_000), 5_556); // 5 555,55… → 5 556
    assert.equal(satsForXof(45_000_000, 45_000_000), 100_000_000);
    assert.equal(satsForXof(450, 45_000_000), 1_000); // division exacte
    assert.equal(satsForXof(1, 45_000_000), 3);
  });

  it('reste exact sur de grands montants', () => {
    assert.equal(satsForXof(5_000_000, 44_712_345), 11_182_594);
  });
});

describe('sources de taux', () => {
  it('convertit le prix Kraken en FCFA par la parité fixe', async () => {
    const time = clock();
    let calls = 0;
    const provider = krakenRateProvider({
      now: time.now,
      fetch: async () => {
        calls += 1;
        return { ok: true, json: async () => krakenBody('68161.0') };
      },
    });
    const rate = await provider.current();
    assert.equal(rate.xofPerBtc, Math.round(68_161 * XOF_PER_EUR));
    assert.equal(rate.source, 'kraken');
    await provider.current();
    assert.equal(calls, 1, 'mesure gardée en cache une minute');
    time.advance(61_000);
    await provider.current();
    assert.equal(calls, 2);
  });

  it('garde la dernière mesure dix minutes en cas de panne, puis échoue', async () => {
    const time = clock();
    let up = true;
    const provider = krakenRateProvider({
      now: time.now,
      fetch: async () => {
        if (!up) throw new Error('réseau coupé');
        return { ok: true, json: async () => krakenBody('60000') };
      },
    });
    const first = await provider.current();
    up = false;
    time.advance(5 * 60_000);
    assert.deepEqual(await provider.current(), first);
    time.advance(6 * 60_000);
    await assert.rejects(provider.current(), RateUnavailableError);
  });

  it('partage une seule requête Kraken entre des appels simultanés', async () => {
    const time = clock();
    let calls = 0;
    let fail = true;
    const provider = krakenRateProvider({
      now: time.now,
      fetch: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (fail) throw new Error('réseau coupé');
        return { ok: true, json: async () => krakenBody('60000') };
      },
    });
    const failed = await Promise.allSettled(Array.from({ length: 20 }, () => provider.current()));
    assert.equal(calls, 1, 'une seule requête pour vingt appels en échec');
    assert.ok(failed.every((result) => result.status === 'rejected'));

    fail = false;
    const rates = await Promise.all(Array.from({ length: 20 }, () => provider.current()));
    assert.equal(calls, 2, 'nouvel essai après un échec, partagé lui aussi');
    assert.ok(rates.every((rate) => rate.xofPerBtc === Math.round(60_000 * XOF_PER_EUR)));
  });

  it('refuse un prix Kraken hors des bornes plausibles', async () => {
    for (const eur of ['0.000001', '1', '99999999']) {
      const provider = krakenRateProvider({
        now: clock().now,
        fetch: async () => ({ ok: true, json: async () => krakenBody(eur) }),
      });
      await assert.rejects(provider.current(), RateUnavailableError, eur);
    }
  });

  it('refuse une réponse Kraken illisible', () => {
    assert.throws(() => parseKrakenEur({ result: {} }), RateUnavailableError);
    assert.throws(() => parseKrakenEur(krakenBody('-1')), RateUnavailableError);
    assert.throws(() => parseKrakenEur(null), RateUnavailableError);
  });

  it('lit la source et le taux fixe depuis la configuration', () => {
    const config = loadConfig({ RATE_SOURCE: 'kraken', RATE_FIXED_XOF_PER_BTC: '50000000' });
    assert.deepEqual(config.rate, { source: 'kraken', fixedXofPerBtc: 50_000_000 });
    assert.equal(loadConfig({}).rate.source, 'fixe');
    assert.throws(() => loadConfig({ RATE_SOURCE: 'binance' }), /RATE_SOURCE/);
    assert.throws(() => loadConfig({ RATE_FIXED_XOF_PER_BTC: '12' }), /RATE_FIXED/);
    assert.throws(() => loadConfig({ QUOTE_TTL_SECONDS: '5' }), /QUOTE_TTL_SECONDS/);
  });
});

describe('routes de taux et de devis', () => {
  it('affiche le taux et sa source', async () => {
    const time = clock();
    const api = await app({ rates: fixedRateProvider(45_000_000, time.now), now: time.now });
    const response = await api.inject({ method: 'GET', url: '/v1/rate' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      xofPerBtc: 45_000_000,
      source: 'fixe',
      fetchedAt: '2026-11-07T12:00:00.000Z',
    });
    await api.close();
  });

  it('fige le taux du devis pendant cinq minutes puis le déclare expiré', async () => {
    const time = clock();
    let xofPerBtc = 45_000_000;
    const rates: RateProvider = {
      current: async () => ({ xofPerBtc, source: 'kraken', fetchedAt: time.now() }),
    };
    const api = await app({ rates, now: time.now });
    const created = await api.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: { amountXof: 2_500 },
    });
    assert.equal(created.statusCode, 201);
    const quote = created.json();
    assert.equal(quote.amountSats, 5_556);
    assert.equal(quote.expiresAt, '2026-11-07T12:05:00.000Z');

    xofPerBtc = 30_000_000; // le marché bouge
    time.advance(4 * 60_000 + 59_000);
    const still = await api.inject({ method: 'GET', url: `/v1/quotes/${quote.id}` });
    assert.equal(still.statusCode, 200);
    assert.equal(still.json().amountSats, 5_556, 'taux figé malgré le marché');
    assert.equal(still.json().xofPerBtc, 45_000_000);

    time.advance(1_000);
    const expired = await api.inject({ method: 'GET', url: `/v1/quotes/${quote.id}` });
    assert.equal(expired.statusCode, 410);
    assert.equal(expired.json().error.code, 'QUOTE_EXPIRED');
    await api.close();
  });

  it('distingue un devis inconnu et refuse un identifiant mal formé', async () => {
    const api = await app();
    const unknown = await api.inject({
      method: 'GET',
      url: '/v1/quotes/7c9e6679-7425-40de-944b-e07fc1f90ae7',
    });
    assert.equal(unknown.statusCode, 404);
    assert.equal(unknown.json().error.code, 'QUOTE_NOT_FOUND');
    const bad = await api.inject({ method: 'GET', url: '/v1/quotes/pas-un-uuid' });
    assert.equal(bad.statusCode, 400);
    assert.deepEqual(bad.json().error.fields, ['params.id']);
    await api.close();
  });

  it('valide le montant demandé', async () => {
    const api = await app();
    for (const amountXof of [0, -10, 2.5, 5_000_001, '2500']) {
      const response = await api.inject({
        method: 'POST',
        url: '/v1/quotes',
        payload: { amountXof },
      });
      assert.equal(response.statusCode, 400, `refus de ${amountXof}`);
      assert.deepEqual(response.json().error.fields, ['body.amountXof']);
    }
    await api.close();
  });

  it('répond 503 codé quand aucun taux n’est disponible', async () => {
    const rates: RateProvider = {
      current: async () => {
        throw new RateUnavailableError('panne');
      },
    };
    const api = await app({ rates });
    const rate = await api.inject({ method: 'GET', url: '/v1/rate' });
    assert.equal(rate.statusCode, 503);
    assert.equal(rate.json().error.code, 'RATE_UNAVAILABLE');
    const quote = await api.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: { amountXof: 1_000 },
    });
    assert.equal(quote.statusCode, 503);
    await api.close();
  });
});

describe('mémoire des devis', () => {
  it('borne le nombre de devis et oublie les expirés après une heure', () => {
    const time = clock();
    const store = createQuoteStore({ ttlMs: 300_000, now: time.now, maxQuotes: 3 });
    const rate = { xofPerBtc: 45_000_000, source: 'fixe' as const, fetchedAt: time.now() };
    const first = store.create(1_000, rate);
    store.create(1_000, rate);
    store.create(1_000, rate);
    store.create(1_000, rate);
    assert.equal(store.size(), 3);
    assert.equal(store.get(first.id).status, 'inconnu', 'le plus ancien cède sa place');
    time.advance(2 * 3_600_000);
    store.create(1_000, rate);
    assert.equal(store.size(), 1);
  });
});
