import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable } from 'node:stream';
import { afterEach, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import {
  BridgeError,
  createBridgeService,
  createSimulatedProvider,
  type Scenario,
} from '@teranga-pay/bridge-sim';
import { buildApp } from './app.ts';
import { createBridgeRuntime } from './bridge.ts';
import { defaultConfig, loadConfig } from './config.ts';
import { RateUnavailableError } from './rates.ts';

const apps: FastifyInstance[] = [];
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
const start = Date.UTC(2026, 10, 11, 12);
async function harness(
  options: {
    scenario?: Scenario;
    path?: string;
    token?: string;
    now?: () => number;
    quoteTtlSeconds?: number;
  } = {},
) {
  const token = options.token ?? randomBytes(32).toString('base64url');
  const otherToken = randomBytes(32).toString('base64url');
  const now = options.now ?? (() => start);
  const bridge = createBridgeRuntime({
    path: options.path ?? ':memory:',
    now,
    scenario: options.scenario,
    principals: [
      { id: 'demo-client-a', token },
      { id: 'demo-client-b', token: otherToken },
    ],
  });
  let logs = '';
  const logStream = new Writable({
    write(chunk, _encoding, callback) {
      logs += chunk.toString();
      callback();
    },
  });
  const app = await buildApp({
    config: { ...defaultConfig, quoteTtlSeconds: options.quoteTtlSeconds ?? 300 },
    bridge,
    now,
    logStream,
  });
  apps.push(app);
  const headers = { authorization: `Bearer ${token}` };
  const otherHeaders = { authorization: `Bearer ${otherToken}` };
  async function quote(operator = 'wave', recipientId = 'wave-demo-001', amountXof = 2500) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/withdrawal-quotes',
      headers,
      payload: { amountXof, operator, recipientId },
    });
    assert.equal(response.statusCode, 201, response.body);
    return response.json();
  }
  async function create(quoteId: string, key = randomUUID()) {
    return app.inject({
      method: 'POST',
      url: '/v1/withdrawals',
      headers: { ...headers, 'idempotency-key': key },
      payload: { quoteId },
    });
  }
  return { app, bridge, headers, otherHeaders, token, quote, create, logs: () => logs };
}

describe('T23 | accès et données exclusivement fictives', () => {
  it('laisse les routes de retrait absentes par défaut et la santé publique', async () => {
    const app = await buildApp({ config: { ...defaultConfig, logLevel: 'silent' } });
    apps.push(app);
    assert.equal(
      (await app.inject({ method: 'POST', url: '/v1/withdrawals', payload: {} })).statusCode,
      404,
    );
    assert.equal((await app.inject('/health')).statusCode, 200);
  });
  it('authentifie toutes les routes avant parsing et validation', async () => {
    const { app } = await harness();
    for (const [method, url] of [
      ['GET', '/v1/withdrawal-options'],
      ['GET', '/v1/withdrawal-balance'],
      ['POST', '/v1/withdrawal-quotes'],
      ['GET', `/v1/withdrawal-quotes/${randomUUID()}`],
      ['POST', '/v1/withdrawals'],
      ['GET', '/v1/withdrawals'],
      ['GET', `/v1/withdrawals/${randomUUID()}`],
      ['POST', `/v1/withdrawals/${randomUUID()}/reconcile`],
      ['POST', `/v1/withdrawals/${randomUUID()}/retry`],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        ...(method === 'POST'
          ? { payload: '{', headers: { 'content-type': 'application/json' } }
          : {}),
      });
      assert.equal(response.statusCode, 401, url);
      assert.equal(response.json().error.code, 'UNAUTHORIZED');
      assert.equal(response.headers['www-authenticate'], 'Bearer');
    }
    assert.equal((await app.inject('/health')).statusCode, 200);
  });
  it('refuse le mauvais jeton et les changements d’identité dans le corps', async () => {
    const { app, headers } = await harness();
    const wrong = await app.inject({
      url: '/v1/withdrawal-options',
      headers: { authorization: `Bearer ${randomBytes(32).toString('base64url')}` },
    });
    assert.equal(wrong.statusCode, 401);
    const owner = await app.inject({
      method: 'POST',
      url: '/v1/withdrawal-quotes',
      headers,
      payload: {
        amountXof: 2500,
        operator: 'wave',
        recipientId: 'wave-demo-001',
        owner: 'demo-client-b',
      },
    });
    assert.equal(owner.statusCode, 400);
  });
  for (const amountXof of ['2500', true, 0, -1, 1.5, 5_000_001])
    it(`refuse un montant JSON invalide (${String(amountXof)})`, async () => {
      const { app, headers } = await harness();
      const response = await app.inject({
        method: 'POST',
        url: '/v1/withdrawal-quotes',
        headers,
        payload: { amountXof, operator: 'wave', recipientId: 'wave-demo-001' },
      });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, 'VALIDATION_ERROR');
    });
  it('limite les destinataires à ceux de la simulation et à leur opérateur', async () => {
    const { app, headers } = await harness();
    for (const recipientId of ['orange-demo-001', 'destinataire-inconnu']) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/withdrawal-quotes',
        headers,
        payload: { amountXof: 2500, operator: 'wave', recipientId },
      });
      assert.equal(response.statusCode, 400);
    }
    const personal = await app.inject({
      method: 'POST',
      url: '/v1/withdrawal-quotes',
      headers,
      payload: {
        amountXof: 2500,
        operator: 'wave',
        recipientId: 'wave-demo-001',
        phone: 'valeur-refusee-fictive',
      },
    });
    assert.equal(personal.statusCode, 400);
    assert(!personal.body.includes('valeur-refusee-fictive'));
  });
  it('ne journalise ni jeton, ni clé d’idempotence, ni payload', async () => {
    const h = await harness();
    const q = await h.quote();
    const key = randomUUID();
    const response = await h.create(q.id, key);
    assert.equal(response.statusCode, 201);
    const logs = h.logs();
    for (const hidden of [h.token, key, q.id, 'wave-demo-001'])
      assert(!logs.includes(hidden), 'Donnée de requête présente dans les logs');
    assert(logs.includes('teranga-api'));
    assert.equal(response.headers['cache-control'], 'no-store');
  });
});

describe('journal HTTP des retraits simulés | T24', () => {
  it('répond avec une page vide authentifiée et les en-têtes communs', async () => {
    const h = await harness();
    const response = await h.app.inject({ url: '/v1/withdrawals', headers: h.headers });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { simulation: true, items: [], nextCursor: null });
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal((await h.app.inject('/v1/withdrawals')).statusCode, 401);
  });

  it('parcourt plusieurs pages de même date avec des curseurs exacts', async () => {
    const h = await harness();
    const created: string[] = [];
    for (let index = 0; index < 5; index++) {
      const q = await h.quote();
      created.push((await h.create(q.id)).json().id);
    }
    const first = await h.app.inject({ url: '/v1/withdrawals?limit=2', headers: h.headers });
    assert.equal(first.statusCode, 200);
    const one = first.json();
    assert.equal(one.nextCursor, one.items[1].id);
    const second = await h.app.inject({
      url: `/v1/withdrawals?limit=2&before=${one.nextCursor.toUpperCase()}`,
      headers: h.headers,
    });
    assert.equal(second.statusCode, 200);
    const two = second.json();
    assert.equal(two.nextCursor, two.items[1].id);
    const last = await h.app.inject({
      url: `/v1/withdrawals?limit=2&before=${two.nextCursor}`,
      headers: h.headers,
    });
    assert.equal(last.statusCode, 200);
    const three = last.json();
    assert.equal(three.nextCursor, null);
    const entries = [...one.items, ...two.items, ...three.items];
    assert.deepEqual(
      entries.map((entry) => entry.id),
      created.sort().reverse(),
    );
    assert.equal(new Set(entries.map((entry) => entry.id)).size, 5);
    for (const entry of entries) {
      assert.equal(entry.simulation, true);
      assert(!('owner' in entry));
      assert(!('idempotencyKey' in entry));
    }
  });

  it('limite la lecture à l’identité authentifiée et masque les curseurs étrangers', async () => {
    const h = await harness();
    const q = await h.quote();
    const ownId = (await h.create(q.id)).json().id;
    const otherPage = await h.app.inject({ url: '/v1/withdrawals', headers: h.otherHeaders });
    assert.deepEqual(otherPage.json(), { simulation: true, items: [], nextCursor: null });
    for (const before of [ownId, randomUUID()]) {
      const response = await h.app.inject({
        url: `/v1/withdrawals?before=${before}`,
        headers: h.otherHeaders,
      });
      assert.equal(response.statusCode, 404);
      assert.equal(response.json().error.code, 'NOT_FOUND');
      assert(!response.body.includes(before));
    }
  });

  for (const query of [
    'limit=0',
    'limit=101',
    'limit=-1',
    'limit=1.5',
    'limit=abc',
    'before=',
    'before=invalide',
    'owner=demo-client-b',
    'limit=2&limit=3',
  ]) {
    it(`refuse les paramètres de pagination invalides (${query})`, async () => {
      const h = await harness();
      const response = await h.app.inject({ url: `/v1/withdrawals?${query}`, headers: h.headers });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, 'VALIDATION_ERROR');
    });
  }

  it('relit le journal durable sans résoudre les retraits incertains ni modifier le solde', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'teranga-bridge-api-'));
    directories.push(directory);
    const path = join(directory, 'demo.sqlite');
    const token = randomBytes(32).toString('base64url');
    const h = await harness({ path, token, scenario: 'timeout_after_success' });
    const q = await h.quote();
    const first = await h.create(q.id);
    const balance = h.bridge.store.balance('demo-client-a');
    await h.app.close();
    apps.splice(apps.indexOf(h.app), 1);
    const restarted = await harness({ path, token });
    for (let index = 0; index < 2; index++) {
      const response = await restarted.app.inject({
        url: '/v1/withdrawals',
        headers: restarted.headers,
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().items[0].id, first.json().id);
      assert.equal(response.json().items[0].status, 'incertain');
      assert.equal(response.json().nextCursor, null);
    }
    assert.deepEqual(restarted.bridge.store.balance('demo-client-a'), balance);
  });
});

describe('T23 | devis puis retrait et reprise', () => {
  it('expose les frais fictifs avant confirmation et plafonne le prix à cinq minutes', async () => {
    const h = await harness({ quoteTtlSeconds: 3600 });
    const options = await h.app.inject({ url: '/v1/withdrawal-options', headers: h.headers });
    assert.equal(options.statusCode, 200);
    assert.equal(options.json().simulation, true);
    assert.equal(options.json().feeXof, 100);
    const q = await h.quote();
    assert.equal(q.simulation, true);
    assert.equal(q.amountXof, 2500);
    assert.equal(q.feeXof, 100);
    assert.equal(q.totalXof, 2600);
    assert.equal(q.amountSats + q.feeSats, q.totalSats);
    assert.equal(q.totalSats, 5778);
    assert.equal(Date.parse(q.expiresAt) - Date.parse(q.createdAt), 300_000);
    assert(!('owner' in q));
  });
  for (const [operator, recipientId] of [
    ['wave', 'wave-demo-001'],
    ['orange_money', 'orange-demo-001'],
  ])
    it(`règle une fois le destinataire fictif ${operator}`, async () => {
      const h = await harness();
      const q = await h.quote(operator, recipientId);
      const key = randomUUID();
      const first = await h.create(q.id, key);
      assert.equal(first.statusCode, 201);
      assert.equal(first.json().status, 'reussi');
      assert.equal(first.json().simulation, true);
      assert.equal(first.json().operator, operator);
      const replay = await h.create(q.id, key);
      assert.equal(replay.statusCode, 200);
      assert.equal(replay.headers['idempotent-replay'], 'true');
      assert.deepEqual(replay.json(), first.json());
      const balance = await h.app.inject({ url: '/v1/withdrawal-balance', headers: h.headers });
      assert.equal(balance.json().availableSats, 2_000_000 - q.totalSats);
      assert.equal(balance.json().heldSats, 0);
    });
  it('refuse un autre corps pour la même clé et une autre clé pour le même devis', async () => {
    const h = await harness();
    const q1 = await h.quote();
    const q2 = await h.quote();
    const key = randomUUID();
    assert.equal((await h.create(q1.id, key)).statusCode, 201);
    const conflict = await h.create(q2.id, key);
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.json().error.code, 'IDEMPOTENCY_CONFLICT');
    const used = await h.create(q1.id);
    assert.equal(used.statusCode, 409);
    assert.equal(used.json().error.code, 'QUOTE_ALREADY_USED');
  });
  it('n’exécute qu’un retrait lors de doubles appuis concurrents', async () => {
    const h = await harness();
    const q = await h.quote();
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 12 }, () => h.create(q.id, key)));
    assert.equal(new Set(results.map((r) => r.json().id)).size, 1);
    const balance = h.bridge.store.balance('demo-client-a');
    assert.equal(balance.availableSats, 2_000_000 - q.totalSats);
    assert.equal(balance.heldSats, 0);
  });
  it('refuse le premier retrait expiré mais relit un retrait connu après expiration et redémarrage', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'teranga-bridge-api-'));
    directories.push(directory);
    const path = join(directory, 'demo.sqlite');
    let clock = start;
    const now = () => clock;
    const token = randomBytes(32).toString('base64url');
    const h = await harness({ path, token, now });
    const q = await h.quote();
    const expired = await h.quote();
    const key = randomUUID();
    const first = await h.create(q.id, key);
    assert.equal(first.statusCode, 201);
    clock += 300_000;
    assert.equal((await h.create(expired.id)).statusCode, 410);
    await h.app.close();
    apps.splice(apps.indexOf(h.app), 1);
    const next = await harness({ path, token, now });
    const replay = await next.create(q.id, key);
    assert.equal(replay.statusCode, 200);
    assert.deepEqual(replay.json(), first.json());
    assert.equal(next.bridge.store.balance('demo-client-a').availableSats, 2_000_000 - q.totalSats);
  });
  it('protège lecture, devis et réconciliation d’un autre compte', async () => {
    const h = await harness();
    const q = await h.quote();
    const result = await h.create(q.id);
    const id = result.json().id;
    for (const url of [`/v1/withdrawal-quotes/${q.id}`, `/v1/withdrawals/${id}`])
      assert.equal((await h.app.inject({ url, headers: h.otherHeaders })).statusCode, 404);
    assert.equal(
      (
        await h.app.inject({
          method: 'POST',
          url: `/v1/withdrawals/${id}/reconcile`,
          headers: h.otherHeaders,
          payload: {},
        })
      ).statusCode,
      404,
    );
    const stolen = await h.app.inject({
      method: 'POST',
      url: '/v1/withdrawals',
      headers: { ...h.otherHeaders, 'idempotency-key': randomUUID() },
      payload: { quoteId: q.id },
    });
    assert.equal(stolen.statusCode, 404);
  });
  it('conserve l’incertitude après réponse perdue puis rapproche le succès sans second retrait', async () => {
    const h = await harness({ scenario: 'timeout_after_success' });
    const q = await h.quote();
    const created = await h.create(q.id);
    assert.equal(created.statusCode, 202);
    assert.equal(created.json().status, 'incertain');
    assert.equal(h.bridge.store.balance('demo-client-a').heldSats, q.totalSats);
    for (let i = 0; i < 2; i++) {
      const response = await h.app.inject({
        method: 'POST',
        url: `/v1/withdrawals/${created.json().id}/reconcile`,
        headers: h.headers,
        payload: {},
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().status, 'reussi');
    }
    assert.deepEqual(h.bridge.store.balance('demo-client-a'), {
      simulation: true,
      availableSats: 2_000_000 - q.totalSats,
      heldSats: 0,
    });
  });
  it('garde les fonds fictifs réservés lorsque le fournisseur ne donne pas de preuve', async () => {
    const h = await harness({ scenario: 'unavailable' });
    const q = await h.quote();
    const created = await h.create(q.id);
    assert.equal(created.statusCode, 202);
    const response = await h.app.inject({
      method: 'POST',
      url: `/v1/withdrawals/${created.json().id}/reconcile`,
      headers: h.headers,
      payload: {},
    });
    assert.equal(response.json().status, 'incertain');
    assert.equal(h.bridge.store.balance('demo-client-a').heldSats, q.totalSats);
  });
  it('libère une seule fois la réservation d’un refus définitif', async () => {
    const h = await harness({ scenario: 'declined' });
    const q = await h.quote();
    const key = randomUUID();
    const first = await h.create(q.id, key);
    assert.equal(first.json().status, 'echoue');
    await h.create(q.id, key);
    await h.app.inject({
      method: 'POST',
      url: `/v1/withdrawals/${first.json().id}/reconcile`,
      headers: h.headers,
      payload: {},
    });
    assert.deepEqual(h.bridge.store.balance('demo-client-a'), {
      simulation: true,
      availableSats: 2_000_000,
      heldSats: 0,
    });
  });
  it('signale les fonds fictifs insuffisants sans retrait', async () => {
    const h = await harness();
    const q = await h.quote('wave', 'wave-demo-001', 5_000_000);
    const response = await h.create(q.id);
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error.code, 'INSUFFICIENT_FUNDS');
    assert.equal(h.bridge.store.balance('demo-client-a').heldSats, 0);
  });
  it('refuse les clés absentes, invalides et les champs de confirmation ajoutés', async () => {
    const h = await harness();
    const q = await h.quote();
    for (const key of [undefined, 'mauvaise-cle']) {
      const response = await h.app.inject({
        method: 'POST',
        url: '/v1/withdrawals',
        headers: { ...h.headers, ...(key ? { 'idempotency-key': key } : {}) },
        payload: { quoteId: q.id },
      });
      assert.equal(response.statusCode, 400);
    }
    const response = await h.app.inject({
      method: 'POST',
      url: '/v1/withdrawals',
      headers: { ...h.headers, 'idempotency-key': randomUUID() },
      payload: { quoteId: q.id, amountXof: 1 },
    });
    assert.equal(response.statusCode, 400);
  });
  it('retourne RATE_UNAVAILABLE sans préparer un devis lorsque la source ne répond pas', async () => {
    const token = randomBytes(32).toString('base64url');
    const runtime = createBridgeRuntime({ path: ':memory:', token });
    const app = await buildApp({
      config: { ...defaultConfig, logLevel: 'silent' },
      bridge: runtime,
      rates: {
        current: async () => {
          throw new RateUnavailableError();
        },
      },
    });
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/withdrawal-quotes',
      headers: { authorization: `Bearer ${token}` },
      payload: { amountXof: 2500, operator: 'wave', recipientId: 'wave-demo-001' },
    });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error.code, 'RATE_UNAVAILABLE');
  });
});

describe('T23 | activation sûre de la configuration', () => {
  it('reste désactivé sans option et refuse un flag ambigu', () => {
    assert.equal(loadConfig({}).bridge, undefined);
    assert.throws(() => loadConfig({ BRIDGE_SIM_ENABLED: 'yes' }), /BRIDGE_SIM_ENABLED/);
  });
  for (const env of [
    { BRIDGE_SIM_TOKEN: '' },
    { BRIDGE_SIM_TOKEN: 'court' },
    { API_HOST: '0.0.0.0' },
    { BRIDGE_SIM_DB_PATH: ':memory:' },
    { BRIDGE_SIM_DB_PATH: 'file::memory:?cache=shared' },
    { BRIDGE_SIM_DB_PATH: 'file:demo?mode=memory' },
    { BRIDGE_SIM_SCENARIO: 'real' },
  ])
    it(`refuse une activation incohérente (${Object.keys(env)[0]})`, () => {
      const token = randomBytes(32).toString('base64url');
      assert.throws(() =>
        loadConfig({ BRIDGE_SIM_ENABLED: 'true', BRIDGE_SIM_TOKEN: token, ...env }),
      );
    });
  it('ne révèle jamais la valeur du jeton refusé', () => {
    const value = 'valeur-refusee';
    assert.throws(
      () => loadConfig({ BRIDGE_SIM_ENABLED: 'true', BRIDGE_SIM_TOKEN: value }),
      (error: Error) => !error.message.includes(value),
    );
  });
});

describe('corrections de review | reprise et réponses T23', () => {
  it('renvoie 202 lors du rejeu d’un résultat toujours incertain', async () => {
    const h = await harness({ scenario: 'unavailable' });
    const q = await h.quote();
    const key = randomUUID();
    const first = await h.create(q.id, key);
    const replay = await h.create(q.id, key);
    assert.equal(first.statusCode, 202);
    assert.equal(replay.statusCode, 202);
    assert.equal(replay.headers['idempotent-replay'], 'true');
    assert.equal(replay.json().id, first.json().id);
    assert.equal(replay.json().status, 'incertain');
  });

  it('renvoie 202 pour un rejeu pendant la soumission initiale, puis 201 au résultat terminal initial', async () => {
    const h = await harness();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const provider = createSimulatedProvider(h.bridge.store);
    h.bridge.service = createBridgeService({
      store: h.bridge.store,
      provider: {
        ...provider,
        async submit(withdrawal) {
          entered();
          await gate;
          return provider.submit(withdrawal);
        },
      },
    });
    const q = await h.quote();
    const key = randomUUID();
    const pending = h.create(q.id, key);
    await started;
    const replay = await h.create(q.id, key);
    assert.equal(replay.statusCode, 202);
    assert.equal(replay.headers['idempotent-replay'], 'true');
    assert.equal(replay.json().status, 'en_attente');
    release();
    const first = await pending;
    assert.equal(first.statusCode, 201);
    assert.equal(first.json().id, replay.json().id);
    const finalReplay = await h.create(q.id, key);
    assert.equal(finalReplay.statusCode, 200);
    assert.equal(finalReplay.json().status, 'reussi');
  });

  it('reprend le même retrait après panne, expiration et redémarrage sans nouvelle réservation', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'teranga-bridge-api-'));
    directories.push(directory);
    const path = join(directory, 'demo.sqlite');
    const token = randomBytes(32).toString('base64url');
    let time = start;
    const now = () => time;
    const h = await harness({ path, token, now, scenario: 'unavailable' });
    const q = await h.quote();
    const original = await h.create(q.id);
    time += 600_000;
    await h.app.close();
    apps.splice(apps.indexOf(h.app), 1);
    const next = await harness({ path, token, now });
    for (let index = 0; index < 2; index++) {
      const response = await next.app.inject({
        method: 'POST',
        url: `/v1/withdrawals/${original.json().id}/retry`,
        headers: next.headers,
        payload: {},
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().id, original.json().id);
      assert.equal(response.json().quoteId, q.id);
      assert.equal(response.json().status, 'reussi');
      assert.equal(response.json().quoteExpiresAt, q.expiresAt);
    }
    assert.deepEqual(next.bridge.store.balance('demo-client-a'), {
      simulation: true,
      availableSats: 2_000_000 - q.totalSats,
      heldSats: 0,
    });
    assert.equal(next.bridge.service.history('demo-client-a').items.length, 1);
  });

  it('ne soumet rien quand la lecture de reprise reste indisponible', async () => {
    const h = await harness({ scenario: 'unavailable' });
    const q = await h.quote();
    const original = await h.create(q.id);
    let submissions = 0;
    const provider = createSimulatedProvider(h.bridge.store);
    h.bridge.service = createBridgeService({
      store: h.bridge.store,
      provider: {
        async lookup() {
          throw new Error('lecture fictive indisponible');
        },
        async submit(withdrawal) {
          submissions++;
          return provider.submit(withdrawal);
        },
      },
    });
    const response = await h.app.inject({
      method: 'POST',
      url: `/v1/withdrawals/${original.json().id}/retry`,
      headers: h.headers,
      payload: {},
    });
    assert.equal(response.statusCode, 202);
    assert.equal(response.json().status, 'incertain');
    assert.equal(submissions, 0);
    assert.equal(h.bridge.store.balance('demo-client-a').heldSats, q.totalSats);
  });

  it('retrouve la référence déjà engagée même quand son devis a expiré', async () => {
    let time = start;
    const h = await harness({ now: () => time });
    const q = await h.quote();
    const key = randomUUID();
    const original = await h.create(q.id, key);
    time += 300_000;
    const used = await h.create(q.id);
    assert.equal(used.statusCode, 409);
    assert.equal(used.json().error.code, 'QUOTE_ALREADY_USED');
    assert.equal(used.json().error.withdrawalId, original.json().id);
    const newQuote = await h.quote();
    const conflict = await h.create(newQuote.id, key);
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.json().error.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal(conflict.json().error.withdrawalId, original.json().id);
    const response = await h.app.inject({
      url: `/v1/withdrawals/${used.json().error.withdrawalId}`,
      headers: h.headers,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().id, original.json().id);
  });

  it('n’émet jamais la référence d’un autre propriétaire dans une erreur de conflit', async () => {
    const h = await harness();
    const q = await h.quote();
    const own = await h.create(q.id);
    const stolen = await h.app.inject({
      method: 'POST',
      url: '/v1/withdrawals',
      headers: { ...h.otherHeaders, 'idempotency-key': randomUUID() },
      payload: { quoteId: q.id },
    });
    assert.equal(stolen.statusCode, 404);
    assert.equal(stolen.json().error.withdrawalId, undefined);
    assert(!stolen.body.includes(own.json().id));
    h.bridge.service.create = async () => {
      throw new BridgeError('QUOTE_ALREADY_USED', { withdrawalId: own.json().id });
    };
    const forged = await h.app.inject({
      method: 'POST',
      url: '/v1/withdrawals',
      headers: { ...h.otherHeaders, 'idempotency-key': randomUUID() },
      payload: { quoteId: q.id },
    });
    assert.equal(forged.statusCode, 409);
    assert.equal(forged.json().error.withdrawalId, undefined);
    assert(!forged.body.includes(own.json().id));
  });

  it('emploie WITHDRAWAL_NOT_FOUND pour lecture, réconciliation et reprise absentes ou étrangères', async () => {
    const h = await harness({ scenario: 'unavailable' });
    const q = await h.quote();
    const original = await h.create(q.id);
    for (const [id, headers] of [
      [randomUUID(), h.headers],
      [original.json().id, h.otherHeaders],
    ] as const) {
      for (const suffix of ['', '/reconcile', '/retry']) {
        const response = await h.app.inject({
          url: `/v1/withdrawals/${id}${suffix}`,
          headers,
          ...(suffix ? { method: 'POST' as const, payload: {} } : {}),
        });
        assert.equal(response.statusCode, 404);
        assert.equal(response.json().error.code, 'WITHDRAWAL_NOT_FOUND');
        assert.equal(response.json().error.withdrawalId, undefined);
        assert(!response.body.includes(id));
      }
    }
    assert.equal(h.bridge.store.balance('demo-client-a').heldSats, q.totalSats);
  });

  it('renvoie STORAGE_CLOSED en503 sans exposer de détail de base', async () => {
    const h = await harness();
    h.bridge.store.close();
    const response = await h.app.inject({ url: '/v1/withdrawal-balance', headers: h.headers });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error.code, 'STORAGE_CLOSED');
    assert(!response.body.includes('sqlite'));
    assert(!response.body.includes(':memory:'));
  });

  it('conserve le code WITHDRAWAL_NOT_FOUND si le service signale lui-même la référence absente', async () => {
    const h = await harness();
    const missing = () => {
      throw new BridgeError('WITHDRAWAL_NOT_FOUND');
    };
    h.bridge.service.get = missing;
    h.bridge.service.reconcile = async () => missing();
    h.bridge.service.retry = async () => missing();
    for (const suffix of ['', '/reconcile', '/retry']) {
      const response = await h.app.inject({
        url: `/v1/withdrawals/${randomUUID()}${suffix}`,
        headers: h.headers,
        ...(suffix ? { method: 'POST' as const, payload: {} } : {}),
      });
      assert.equal(response.statusCode, 404);
      assert.equal(response.json().error.code, 'WITHDRAWAL_NOT_FOUND');
    }
  });

  it('refuse les champs de reprise ajoutés et les clés de confirmation qui ne sont pas des UUID', async () => {
    const h = await harness({ scenario: 'unavailable' });
    const q = await h.quote();
    const response = await h.app.inject({
      method: 'POST',
      url: '/v1/withdrawals',
      headers: { ...h.headers, 'idempotency-key': 'cle-opaque-mais-pas-un-uuid' },
      payload: { quoteId: q.id },
    });
    assert.equal(response.statusCode, 400);
    const original = await h.create(q.id);
    const added = await h.app.inject({
      method: 'POST',
      url: `/v1/withdrawals/${original.json().id}/retry`,
      headers: h.headers,
      payload: { quoteId: randomUUID() },
    });
    assert.equal(added.statusCode, 400);
    assert.equal(h.bridge.store.balance('demo-client-a').heldSats, q.totalSats);
  });
});
