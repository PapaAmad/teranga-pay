import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBridgeProvisioning, provisioningCommand } from './provision-mobile.mjs';

test('le provisionnement ne transporte que le jeton de la simulation activée', () => {
  const token = 'example-not-a-credential-000000000000000000000';
  const result = JSON.parse(
    readBridgeProvisioning(
      `BRIDGE_SIM_ENABLED=true\nBRIDGE_SIM_TOKEN=${token}\nAPI_HOST=127.0.0.1`,
    ),
  );
  assert.deepEqual(result, { version: 1, bridgeToken: token });
  assert.ok(!provisioningCommand.includes(token));
  assert.ok(provisioningCommand.startsWith('run-as pay.teranga.demo '));
});

for (const value of [
  '',
  'BRIDGE_SIM_ENABLED=false\nBRIDGE_SIM_TOKEN=' + 'a'.repeat(43),
  'BRIDGE_SIM_ENABLED=true\nBRIDGE_SIM_TOKEN=short',
  'BRIDGE_SIM_ENABLED=true\nBRIDGE_SIM_TOKEN="' + 'a'.repeat(43) + '\\n"',
]) {
  test(
    'une configuration inactive ou invalide ne fournit pas de secret au téléphone : ' +
      value.length,
    () => {
      assert.throws(() => readBridgeProvisioning(value), { message: 'PROVISION_INVALID' });
    },
  );
}
