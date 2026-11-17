import assert from 'node:assert/strict';
import { hostname } from 'node:os';
import { Writable } from 'node:stream';
import { afterEach, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.ts';
import { defaultConfig, type ApiConfig } from './config.ts';

type Harness = { app: FastifyInstance; logs: () => string };

const apps: FastifyInstance[] = [];

async function harness(overrides: Partial<ApiConfig> = {}): Promise<Harness> {
  let output = '';
  const logStream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  const app = await buildApp({ config: { ...defaultConfig, ...overrides }, logStream });
  apps.push(app);
  return { app, logs: () => output };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('contrôle de santé', () => {
  it('répond ok avec les en-têtes de sécurité', async () => {
    const { app } = await harness();
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok', service: 'teranga-api' });
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(String(response.headers['x-request-id']), /^[0-9a-f-]{36}$/);
  });

  it('refuse un paramètre inattendu avec le nom du champ seulement', async () => {
    const { app } = await harness();
    const response = await app.inject({ method: 'GET', url: '/health?telephone=770000000' });
    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(body.error.fields, ['querystring.telephone']);
    assert.doesNotMatch(response.body, /770000000/);
  });
});

describe('validation des entrées', () => {
  it('refuse un corps invalide sans renvoyer la valeur reçue', async () => {
    const { app } = await harness();
    app.post(
      '/essai',
      {
        schema: {
          body: {
            type: 'object',
            required: ['montantXof'],
            additionalProperties: false,
            properties: { montantXof: { type: 'integer', minimum: 1 } },
          },
        },
      },
      async () => ({ ok: true }),
    );
    const missing = await app.inject({ method: 'POST', url: '/essai', payload: {} });
    assert.equal(missing.statusCode, 400);
    assert.deepEqual(missing.json().error.fields, ['body.montantXof']);

    const extra = await app.inject({
      method: 'POST',
      url: '/essai',
      payload: { montantXof: 500, secret: 'phrase-fictive' },
    });
    assert.equal(extra.statusCode, 400);
    assert.deepEqual(extra.json().error.fields, ['body.secret']);
    assert.doesNotMatch(extra.body, /phrase-fictive/);

    const negative = await app.inject({
      method: 'POST',
      url: '/essai',
      payload: { montantXof: -3 },
    });
    assert.equal(negative.statusCode, 400);
    assert.deepEqual(negative.json().error.fields, ['body.montantXof']);

    const ok = await app.inject({ method: 'POST', url: '/essai', payload: { montantXof: 500 } });
    assert.equal(ok.statusCode, 200);
  });

  it('ne convertit pas les types dans un corps JSON', async () => {
    const { app } = await harness();
    app.post<{ Body: { montantXof: number } }>(
      '/essai',
      {
        schema: {
          body: {
            type: 'object',
            required: ['montantXof'],
            additionalProperties: false,
            properties: { montantXof: { type: 'integer', minimum: 1 } },
          },
        },
      },
      async (request) => ({ recu: request.body.montantXof }),
    );
    for (const montantXof of [true, '500', [7], null]) {
      const response = await app.inject({ method: 'POST', url: '/essai', payload: { montantXof } });
      assert.equal(response.statusCode, 400, `montantXof=${JSON.stringify(montantXof)}`);
      assert.deepEqual(response.json().error.fields, ['body.montantXof']);
    }
  });

  it('convertit toujours les paramètres de requête et de chemin', async () => {
    const { app } = await harness();
    app.get<{ Querystring: { page: number }; Params: { id: number } }>(
      '/essai/:id',
      {
        schema: {
          params: { type: 'object', properties: { id: { type: 'integer' } } },
          querystring: { type: 'object', properties: { page: { type: 'integer' } } },
        },
      },
      async (request) => ({ id: request.params.id, page: request.query.page }),
    );
    const response = await app.inject({ method: 'GET', url: '/essai/12?page=3' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { id: 12, page: 3 });
  });

  it('refuse un JSON mal formé, un corps trop gros et un type inconnu', async () => {
    const { app } = await harness({ bodyLimitBytes: 64 });
    app.post('/essai', async () => ({ ok: true }));
    const malformed = await app.inject({
      method: 'POST',
      url: '/essai',
      headers: { 'content-type': 'application/json' },
      payload: '{"montant":',
    });
    assert.equal(malformed.statusCode, 400);
    assert.equal(malformed.json().error.code, 'BAD_REQUEST');

    const large = await app.inject({
      method: 'POST',
      url: '/essai',
      payload: { x: 'a'.repeat(100) },
    });
    assert.equal(large.statusCode, 413);
    assert.equal(large.json().error.code, 'PAYLOAD_TOO_LARGE');

    const xml = await app.inject({
      method: 'POST',
      url: '/essai',
      headers: { 'content-type': 'application/xml' },
      payload: '<a/>',
    });
    assert.equal(xml.statusCode, 415);
    assert.equal(xml.json().error.code, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('masque le détail des erreurs internes', async () => {
    const { app, logs } = await harness();
    app.get('/panne', async () => {
      throw new Error('mot de passe base=fictif');
    });
    const response = await app.inject({ method: 'GET', url: '/panne' });
    assert.equal(response.statusCode, 500);
    assert.equal(response.json().error.code, 'INTERNAL_ERROR');
    assert.doesNotMatch(response.body, /mot de passe/);
    assert.doesNotMatch(logs(), /mot de passe/);
  });

  it('renvoie une erreur codée pour une route inconnue', async () => {
    const { app } = await harness();
    const response = await app.inject({ method: 'GET', url: '/inconnue' });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, 'NOT_FOUND');
  });
});

describe('limitation de débit', () => {
  it('bloque au-delà du quota par adresse puis répond 429 codé', async () => {
    const { app } = await harness({ rateLimit: { max: 2, windowMs: 60_000 } });
    const call = (remoteAddress: string) =>
      app.inject({ method: 'GET', url: '/health', remoteAddress });
    assert.equal((await call('10.0.0.1')).statusCode, 200);
    assert.equal((await call('10.0.0.1')).statusCode, 200);
    const blocked = await call('10.0.0.1');
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.json().error.code, 'RATE_LIMITED');
    assert.ok(blocked.headers['retry-after']);
    assert.equal((await call('10.0.0.2')).statusCode, 200);
  });

  it('compte aussi les routes inconnues', async () => {
    const { app } = await harness({ rateLimit: { max: 1, windowMs: 60_000 } });
    assert.equal((await app.inject({ method: 'GET', url: '/a' })).statusCode, 404);
    assert.equal((await app.inject({ method: 'GET', url: '/b' })).statusCode, 429);
  });

  it('compte les routes inconnues même quand le corps est refusé', async () => {
    const cases = [
      { headers: { 'content-type': 'application/json' }, payload: '{' },
      { headers: { 'content-type': 'application/json' }, payload: `"${'a'.repeat(100)}"` },
      { headers: { 'content-type': 'application/xml' }, payload: '<a/>' },
    ];
    for (const badRequest of cases) {
      const { app } = await harness({
        bodyLimitBytes: 64,
        rateLimit: { max: 1, windowMs: 60_000 },
      });
      for (let index = 0; index < 3; index += 1) {
        await app.inject({ method: 'POST', url: '/inconnue', ...badRequest });
      }
      const health = await app.inject({ method: 'GET', url: '/health' });
      assert.equal(health.statusCode, 429, badRequest.payload.slice(0, 10));
    }
  });

  it('ne compte une route inconnue qu’une seule fois', async () => {
    const { app } = await harness({ rateLimit: { max: 2, windowMs: 60_000 } });
    assert.equal((await app.inject({ method: 'GET', url: '/a' })).statusCode, 404);
    assert.equal((await app.inject({ method: 'GET', url: '/health' })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/health' })).statusCode, 429);
  });

  it("ignore l'en-tête X-Forwarded-For pour ne pas contourner le quota", async () => {
    const { app } = await harness({ rateLimit: { max: 1, windowMs: 60_000 } });
    const first = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(first.statusCode, 200);
    const spoofed = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    assert.equal(spoofed.statusCode, 429);
  });
});

describe('journaux sans donnée personnelle', () => {
  it("n'écrit ni IP, ni en-têtes, ni paramètres, ni corps", async () => {
    const { app, logs } = await harness();
    app.post('/essai/:numero', async () => ({ ok: true }));
    await app.inject({
      method: 'POST',
      url: '/essai/770000001?nom=Fatou',
      remoteAddress: '198.51.100.23',
      headers: { authorization: 'Bearer jeton-fictif', 'user-agent': 'Telephone-Test' },
      payload: { phrase: 'mots-fictifs' },
    });
    const output = logs();
    assert.ok(output.length > 0, 'des journaux sont produits');
    for (const forbidden of [
      '198.51.100.23',
      '770000001',
      'Fatou',
      'jeton-fictif',
      'Telephone-Test',
      'mots-fictifs',
    ]) {
      assert.ok(!output.includes(forbidden), `journal sans ${forbidden}`);
    }
    assert.match(output, /"route":"\/essai\/:numero"/);
    assert.ok(!output.includes(hostname()), 'journal sans nom de machine');
    assert.match(output, /"service":"teranga-api"/);
  });
});
