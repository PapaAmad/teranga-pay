import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  E2E_APP_ID,
  assertTestPackage,
  executeE2E,
  findFlows,
  parseOptions,
  selectDevice,
  toolInvocation,
  workspace,
} from './mobile-e2e.mjs';

async function fixture(t) {
  const temporary = path.join(workspace, '.tmp');
  await mkdir(temporary, { recursive: true });
  const root = await mkdtemp(path.join(temporary, 't30-runner-test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(temporary));
    assert(path.basename(root).startsWith('t30-runner-test-'));
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

function junit(count = 2, attributes = '', content = '') {
  const cases = Array.from(
    { length: count },
    (_, index) => `<testcase name="parcours-${index}">${content}</testcase>`,
  ).join('');
  return `<testsuite tests="${count}" ${attributes}>${cases}</testsuite>`;
}

function harness(root, overrides = {}) {
  const calls = [];
  const receipts = [];
  const flows = ['01-onboarding.yaml', '02-parcours.yaml'].map((file) => path.join(root, file));
  const run = (binary, args) => {
    calls.push({ binary, args });
    if (args[0] === '--version') return overrides.version ?? '2.12.1\n';
    if (args[0] === 'check-syntax') {
      if (overrides.syntaxError) throw new Error('syntaxe invalide');
      return '';
    }
    if (binary === 'adb-fictif' && args[0] === 'devices')
      return overrides.devices ?? 'List of devices attached\nemulator-5554\tdevice\n';
    if (args.includes('packages')) return overrides.packages ?? `package:${E2E_APP_ID}\n`;
    if (args.includes('reverse')) return '';
    if (binary === 'maestro-fictif' && args.includes('test')) {
      if (overrides.testError) throw new Error('scénario échoué');
      const report = args[args.indexOf('--output') + 1];
      if (!overrides.noReport) writeFileSync(report, overrides.xml ?? junit());
      return '';
    }
    throw new Error(`Commande inattendue : ${binary} ${args.join(' ')}`);
  };
  const options = {
    run,
    request: async (url, config) => {
      calls.push({ request: url, config });
      if (overrides.requestError) throw new Error('Metro indisponible');
      return {
        ok: overrides.metroOk ?? true,
        text: async () => overrides.metroText ?? 'packager-status:running',
      };
    },
    record: async (file, receipt) => {
      receipts.push({ file, receipt });
    },
    output: path.join(root, 'execution'),
    flows,
    maestro: 'maestro-fictif',
    adb: 'adb-fictif',
  };
  return { calls, receipts, options };
}

const mutatesDevice = (call) => call.args?.includes('reverse') || call.args?.includes('test');

test('arguments : mode explicite et cible Android unique, sans options inconnues', () => {
  assert.deepEqual(parseOptions(['check']), { mode: 'check', device: undefined });
  assert.deepEqual(parseOptions(['android', '--device', 'emulator-5554']), {
    mode: 'android',
    device: 'emulator-5554',
  });
  for (const args of [
    [],
    ['test'],
    ['android', '--device'],
    ['android', '--other'],
    ['android', '--device', 'a', '--device', 'b'],
    ['android', '--device', 'a&b'],
    ['check', '--device', 'emulator-5554'],
  ])
    assert.throws(() => parseOptions(args));
});

test('Windows : les chemins contenant des espaces restent un argument et les métacaractères sont refusés', () => {
  const result = toolInvocation(
    'C:\\Projet démo\\maestro.bat',
    ['check-syntax', 'C:\\Projet démo\\test.yaml'],
    'win32',
  );
  assert.equal(result.windowsVerbatimArguments, true);
  assert.deepEqual(result.args, [
    '/d',
    '/s',
    '/c',
    '""C:\\Projet démo\\maestro.bat" "check-syntax" "C:\\Projet démo\\test.yaml""',
  ]);
  for (const value of ['a&b', 'a|b', '%PATH%', 'a!b', 'a<b', 'a>b', 'a^b', 'a"b', 'a\nb', 'a\rb']) {
    assert.throws(
      () => toolInvocation('maestro.bat', [value], 'win32'),
      /E2E_UNSAFE_BATCH_ARGUMENT/,
    );
    assert.throws(() => toolInvocation(value + '.cmd', [], 'win32'), /E2E_UNSAFE_BATCH_ARGUMENT/);
  }
  assert.deepEqual(toolInvocation('/outils/maestro', ['a b'], 'linux'), {
    command: '/outils/maestro',
    args: ['a b'],
  });
  assert.deepEqual(toolInvocation('adb.exe', ['a b'], 'win32'), {
    command: 'adb.exe',
    args: ['a b'],
  });
});

test('la sélection automatique ne choisit jamais un téléphone physique ou une cible ambiguë', () => {
  const physical = 'List of devices attached\ntelephone-fictif\tdevice\n';
  assert.throws(() => selectDevice(physical), /E2E_EXPLICIT_DEVICE_REQUIRED/);
  assert.equal(selectDevice(physical, 'telephone-fictif'), 'telephone-fictif');
  assert.equal(selectDevice(physical + 'emulator-5554\tdevice\n'), 'emulator-5554');
  for (const devices of [
    '',
    'emulator-5554\toffline',
    'emulator-5554\tunauthorized',
    'emulator-5554\tdevice\nemulator-5556\tdevice',
  ])
    assert.throws(() => selectDevice(devices), /E2E_EXPLICIT_DEVICE_REQUIRED/);
  assert.throws(
    () => selectDevice('emulator-5554\toffline', 'emulator-5554'),
    /E2E_DEVICE_NOT_READY/,
  );
});

test('le paquet normal et les préfixes voisins ne satisfont pas le contrôle d’isolation', () => {
  assert.doesNotThrow(() => assertTestPackage(`package:${E2E_APP_ID}\r\n`));
  for (const packages of [
    'package:pay.teranga.demo',
    `package:${E2E_APP_ID}.voisin`,
    E2E_APP_ID,
    '',
  ])
    assert.throws(() => assertTestPackage(packages), /E2E_ISOLATED_APP_NOT_INSTALLED/);
});

test('la découverte refuse un scénario visant un autre paquet et garde l’ordre numérique', async (t) => {
  const root = await fixture(t);
  await assert.rejects(findFlows(root), /E2E_NO_FLOWS/);
  await writeFile(
    path.join(root, '02-second.yaml'),
    `# exemple fictif\nappId: ${E2E_APP_ID}\n---\n`,
  );
  await writeFile(path.join(root, '01-premier.yaml'), `appId: ${E2E_APP_ID}\n---\n`);
  await writeFile(path.join(root, 'README.md'), 'Documentation, pas un scénario.');
  assert.deepEqual(
    (await findFlows(root)).map((file) => path.basename(file)),
    ['01-premier.yaml', '02-second.yaml'],
  );
  await writeFile(path.join(root, '01-premier.yaml'), 'appId: pay.teranga.demo\n---\n');
  await assert.rejects(findFlows(root), /E2E_FLOW_PACKAGE_MISMATCH/);
});

test('une validation syntaxique ne touche pas ADB et annonce explicitement aucune exécution native', async (t) => {
  const { calls, receipts, options } = harness(await fixture(t));
  const receipt = await executeE2E({ mode: 'check' }, options);
  assert.deepEqual(
    calls.map((call) => call.args[0]),
    ['--version', 'check-syntax', 'check-syntax'],
  );
  assert.equal(receipt.kind, 'syntax');
  assert.equal(receipt.nativeDeviceExecuted, false);
  assert.equal(receipts.length, 1);
  assert.equal(path.basename(receipts[0].file), 'syntax.json');
});

test('un outil incorrect, une syntaxe invalide ou une liste vide bloque toute interaction Android', async (t) => {
  const root = await fixture(t);
  for (const [override, message] of [
    [{ version: '2.12.0\n' }, 'VERSION_MISMATCH'],
    [{ syntaxError: true }, 'syntaxe invalide'],
  ]) {
    const { calls, receipts, options } = harness(root, override);
    await assert.rejects(executeE2E({ mode: 'android' }, options), new RegExp(message));
    assert(calls.every((call) => call.binary === 'maestro-fictif'));
    assert.equal(receipts.length, 0);
  }
  const { calls, options } = harness(root);
  options.flows = [];
  await assert.rejects(executeE2E({ mode: 'android' }, options), /E2E_NO_FLOWS/);
  assert.equal(calls.length, 0);
});

test('cible absente ou paquet non isolé : aucun reverse ni lancement de scénario', async (t) => {
  const root = await fixture(t);
  for (const [override, message] of [
    [{ devices: 'emulator-5554\toffline' }, 'EXPLICIT_DEVICE_REQUIRED'],
    [{ packages: 'package:pay.teranga.demo' }, 'ISOLATED_APP_NOT_INSTALLED'],
  ]) {
    const { calls, receipts, options } = harness(root, override);
    await assert.rejects(executeE2E({ mode: 'android' }, options), new RegExp(message));
    assert(!calls.some(mutatesDevice));
    assert.equal(receipts.length, 0);
  }
});

test('Metro doit répondre avec son état exact avant toute mutation de l’appareil', async (t) => {
  const root = await fixture(t);
  for (const override of [
    { metroOk: false },
    { metroText: '<html>autre service</html>' },
    { requestError: true },
  ]) {
    const { calls, receipts, options } = harness(root, override);
    await assert.rejects(executeE2E({ mode: 'android' }, options));
    assert(!calls.some(mutatesDevice));
    assert.equal(receipts.length, 0);
    assert(!existsSync(options.output));
  }
});

test('les quatre préconditions acquittées permettent le test natif et une preuve limitée aux ateliers', async (t) => {
  const { calls, receipts, options } = harness(await fixture(t));
  const receipt = await executeE2E({ mode: 'android', device: 'emulator-5554' }, options);
  const reverse = calls.findIndex((call) => call.args?.includes('reverse'));
  const native = calls.findIndex((call) => call.args?.includes('test'));
  assert(reverse > calls.findIndex((call) => call.request));
  assert(native > reverse);
  assert.deepEqual(calls[native].args.slice(0, 5), [
    '--device',
    'emulator-5554',
    'test',
    '--format',
    'JUNIT',
  ]);
  assert.equal(receipt.appId, E2E_APP_ID);
  assert.equal(receipt.cases, 2);
  assert.equal(receipt.nativeDeviceExecuted, true);
  assert.equal(receipt.realWalletUsed, false);
  assert.equal(receipt.regtestPaymentProved, false);
  assert.equal(receipts.length, 1);
  assert.equal(path.basename(receipts[0].file), 'execution.json');
});

test('un code zéro sans rapport JUnit ne produit aucune attestation native', async (t) => {
  const { receipts, options } = harness(await fixture(t), { noReport: true });
  await assert.rejects(executeE2E({ mode: 'android' }, options), { code: 'ENOENT' });
  assert.equal(receipts.length, 0);
});

test('un scénario échoué, ignoré ou manquant empêche la preuve de réussite', async (t) => {
  const root = await fixture(t);
  const invalid = [
    junit(2, 'failures="1"'),
    junit(2, 'errors="1"'),
    junit(2, 'skipped="1"'),
    junit(2, '', '<failure message="échec"/>'),
    junit(2, '', '<error/>'),
    junit(2, '', '<skipped/>'),
    junit(1),
    junit(3),
    '<testsuite tests="0"/>',
    'sortie sans XML',
  ];
  for (const [index, xml] of invalid.entries()) {
    const { receipts, options } = harness(root, { xml });
    options.output = path.join(root, `invalid-${index}`);
    await assert.rejects(
      executeE2E({ mode: 'android' }, options),
      /E2E_REPORT_(NOT_SUCCESSFUL|INCOMPLETE)/,
    );
    assert.equal(receipts.length, 0);
  }
});

test('un échec de Maestro n’est pas transformé en succès par un rapport', async (t) => {
  const { receipts, options } = harness(await fixture(t), { testError: true });
  await assert.rejects(executeE2E({ mode: 'android' }, options), /scénario échoué/);
  assert.equal(receipts.length, 0);
});

test('un ancien rapport ne peut pas servir de preuve à une nouvelle exécution', async (t) => {
  const { calls, receipts, options } = harness(await fixture(t), { noReport: true });
  await mkdir(options.output);
  await writeFile(path.join(options.output, 'results.xml'), junit());
  await assert.rejects(executeE2E({ mode: 'android' }, options));
  assert(!calls.some(mutatesDevice));
  assert.equal(receipts.length, 0);
});
