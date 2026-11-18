import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { payOutcome, send } from './clients.mjs';

function server(handler) {
  return new Promise((resolve) => {
    const instance = http.createServer(handler).listen(0, '127.0.0.1', () => resolve(instance));
  });
}

describe('transport HTTP du seed', () => {
  it('rejette une réponse coupée après les en-têtes au lieu de rester pendant', async () => {
    const instance = await server((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.write('{"result":');
      setTimeout(() => response.socket.destroy(), 20);
    });
    const { port } = instance.address();
    const outcome = await Promise.race([
      send(http, { host: '127.0.0.1', port, method: 'POST', path: '/' }, '{}').then(
        () => 'résolu',
        (error) => `rejeté : ${error.message}`,
      ),
      new Promise((resolve) => setTimeout(() => resolve('pendant'), 2_000)),
    ]);
    instance.close();
    assert.match(outcome, /^rejeté/);
  });

  it('renvoie le corps complet d’une réponse normale', async () => {
    const instance = await server((_request, response) => {
      response.writeHead(200);
      response.end('{"result":42}');
    });
    const { port } = instance.address();
    const result = await send(http, { host: '127.0.0.1', port, method: 'GET', path: '/' });
    instance.close();
    assert.deepEqual(result, { status: 200, text: '{"result":42}' });
  });
});

describe('résultat d’un paiement LND', () => {
  it('traduit « facture déjà payée » en refus terminal', async () => {
    const outcome = await payOutcome(async () => {
      throw new Error('diaspora POST /v2/router/send : invoice is already paid');
    });
    assert.deepEqual(outcome, { status: 'FAILED', reason: 'ALREADY_PAID' });
  });

  it('propage une coupure au lieu de la compter comme un refus', async () => {
    await assert.rejects(
      payOutcome(async () => {
        throw new Error('socket hang up');
      }),
      /socket hang up/u,
    );
  });

  it('garde le statut et la raison renvoyés par LND', async () => {
    const outcome = await payOutcome(async () => ({
      status: 'FAILED',
      failure_reason: 'FAILURE_REASON_INSUFFICIENT_BALANCE',
    }));
    assert.deepEqual(outcome, { status: 'FAILED', reason: 'FAILURE_REASON_INSUFFICIENT_BALANCE' });
  });
});
