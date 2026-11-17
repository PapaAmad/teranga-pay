import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultConfig, loadConfig } from './config.ts';

describe('configuration', () => {
  it('utilise des valeurs sûres par défaut', () => {
    assert.deepEqual(loadConfig({}), defaultConfig);
    assert.equal(defaultConfig.host, '127.0.0.1');
  });

  it("lit les variables d'environnement valides", () => {
    const config = loadConfig({
      API_HOST: '0.0.0.0',
      API_PORT: '8080',
      API_LOG_LEVEL: 'warn',
      API_RATE_LIMIT_MAX: '10',
      API_RATE_LIMIT_WINDOW_MS: '5000',
    });
    assert.equal(config.host, '0.0.0.0');
    assert.equal(config.port, 8080);
    assert.equal(config.logLevel, 'warn');
    assert.deepEqual(config.rateLimit, { max: 10, windowMs: 5000 });
  });

  it('refuse les valeurs invalides', () => {
    assert.throws(() => loadConfig({ API_PORT: 'abc' }), /API_PORT/);
    assert.throws(() => loadConfig({ API_PORT: '70000' }), /API_PORT/);
    assert.throws(() => loadConfig({ API_PORT: '-1' }), /API_PORT/);
    assert.throws(() => loadConfig({ API_LOG_LEVEL: 'bavard' }), /API_LOG_LEVEL/);
    assert.throws(() => loadConfig({ API_RATE_LIMIT_MAX: '0' }), /API_RATE_LIMIT_MAX/);
    assert.throws(() => loadConfig({ API_RATE_LIMIT_WINDOW_MS: '10' }), /API_RATE_LIMIT_WINDOW_MS/);
  });
});
