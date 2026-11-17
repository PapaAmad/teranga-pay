import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { send } from './clients.mjs';

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
