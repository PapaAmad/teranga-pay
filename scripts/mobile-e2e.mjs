import { spawnSync } from 'node:child_process';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAESTRO_VERSION, maestroExecutable } from './install-maestro.mjs';

export const workspace = fileURLToPath(new URL('..', import.meta.url));
export const E2E_APP_ID = 'pay.teranga.demo.e2e';
export const flowDirectory = path.join(workspace, 'tests/e2e/flows');

export function toolInvocation(binary, args, platform = process.platform) {
  if (platform !== 'win32' || !/\.(bat|cmd)$/i.test(binary)) return { command: binary, args };
  const values = [binary, ...args];
  if (values.some((value) => /[%!&|<>^"\r\n]/.test(value)))
    throw new Error('E2E_UNSAFE_BATCH_ARGUMENT');
  return {
    command: process.env.ComSpec || 'cmd.exe',
    windowsVerbatimArguments: true,
    args: ['/d', '/s', '/c', '"' + values.map((value) => '"' + value + '"').join(' ') + '"'],
  };
}

export function runTool(binary, args, { cwd = workspace, env = process.env } = {}) {
  const invocation = toolInvocation(binary, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    env: {
      ...env,
      DEBUG: '',
      MAESTRO_CLI_NO_ANALYTICS: 'true',
      MAESTRO_DISABLE_UPDATE_CHECK: 'true',
      MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
    },
    encoding: 'utf8',
    windowsHide: true,
    windowsVerbatimArguments: invocation.windowsVerbatimArguments ?? false,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const error = new Error(
      'E2E_TOOL_FAILED: ' + path.basename(binary) + ' (' + (result.status ?? 'unavailable') + ')',
    );
    error.output = (result.stderr ?? '') + (result.stdout ?? '');
    throw error;
  }
  return result.stdout;
}

export function parseOptions(args) {
  const [mode, ...rest] = args;
  if (!['check', 'android'].includes(mode)) throw new Error('E2E_MODE_REQUIRED');
  let device;
  for (let index = 0; index < rest.length; index += 1) {
    if (
      rest[index] !== '--device' ||
      device !== undefined ||
      !/^[a-zA-Z0-9_.:-]{1,128}$/.test(rest[index + 1] ?? '')
    )
      throw new Error('E2E_INVALID_ARGUMENT');
    device = rest[++index];
  }
  if (mode === 'check' && device) throw new Error('E2E_CHECK_HAS_NO_DEVICE');
  return { mode, device };
}

export function selectDevice(stdout, requested) {
  const devices = stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(
      (parts) => parts.length >= 2 && ['device', 'offline', 'unauthorized'].includes(parts[1]),
    );
  if (requested) {
    if (!devices.some(([id, state]) => id === requested && state === 'device'))
      throw new Error('E2E_DEVICE_NOT_READY');
    return requested;
  }
  const emulators = devices.filter(
    ([id, state]) => /^emulator-\d+$/.test(id) && state === 'device',
  );
  if (emulators.length !== 1) throw new Error('E2E_EXPLICIT_DEVICE_REQUIRED');
  return emulators[0][0];
}

export function assertTestPackage(stdout) {
  if (!stdout.split(/\r?\n/).some((line) => line.trim() === 'package:' + E2E_APP_ID))
    throw new Error('E2E_ISOLATED_APP_NOT_INSTALLED');
}

export async function findFlows(directory = flowDirectory) {
  const files = (await readdir(directory))
    .filter((name) => /^\d{2}-[a-z0-9-]+\.yaml$/.test(name))
    .sort();
  if (!files.length) throw new Error('E2E_NO_FLOWS');
  for (const file of files) {
    const text = await readFile(path.join(directory, file), 'utf8');
    const first = text.split(/\r?\n/).find((line) => line.trim() && !line.trim().startsWith('#'));
    if (first !== 'appId: ' + E2E_APP_ID) throw new Error('E2E_FLOW_PACKAGE_MISMATCH: ' + file);
  }
  return files.map((file) => path.join(directory, file));
}

export async function executeE2E(
  { mode, device: requested },
  {
    run = runTool,
    request = fetch,
    flows,
    output,
    record = async (file, receipt) => {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(receipt, null, 2) + '\n');
    },
    maestro = process.env.MAESTRO_BIN || maestroExecutable(workspace),
    adb = process.env.ADB_BIN || 'adb',
  } = {},
) {
  if (!['check', 'android'].includes(mode)) throw new Error('E2E_MODE_REQUIRED');
  if (requested && !/^[a-zA-Z0-9_.:-]{1,128}$/.test(requested))
    throw new Error('E2E_INVALID_DEVICE');
  const selected = flows ?? (await findFlows());
  if (!selected.length) throw new Error('E2E_NO_FLOWS');
  const version = run(maestro, ['--version']);
  if (!version.split(/\r?\n/).some((line) => line.trim() === MAESTRO_VERSION))
    throw new Error('E2E_MAESTRO_VERSION_MISMATCH');
  for (const file of selected) run(maestro, ['check-syntax', file]);
  const directory =
    output ?? path.join(workspace, '.tmp/e2e', new Date().toISOString().replace(/[:.]/g, '-'));
  if (mode === 'check') {
    const receipt = {
      kind: 'syntax',
      maestro: MAESTRO_VERSION,
      flows: selected.map((file) => path.basename(file)),
      nativeDeviceExecuted: false,
    };
    await record(path.join(directory, 'syntax.json'), receipt);
    return receipt;
  }
  const device = selectDevice(run(adb, ['devices']), requested);
  assertTestPackage(run(adb, ['-s', device, 'shell', 'pm', 'list', 'packages', E2E_APP_ID]));
  const status = await request('http://127.0.0.1:8081/status', {
    signal: AbortSignal.timeout(5000),
  });
  if (!status.ok || (await status.text()) !== 'packager-status:running')
    throw new Error('E2E_METRO_NOT_READY');
  await mkdir(path.dirname(directory), { recursive: true });
  // Une preuve appartient à cette exécution, jamais à un rapport déjà présent.
  await mkdir(directory);
  run(adb, ['-s', device, 'reverse', 'tcp:8081', 'tcp:8081']);
  const report = path.join(directory, 'results.xml');
  run(maestro, [
    '--device',
    device,
    'test',
    '--format',
    'JUNIT',
    '--output',
    report,
    '--test-output-dir',
    directory,
    ...selected,
  ]);
  // Un code zéro sans rapport ne constitue pas une preuve d'exécution.
  await access(report);
  const xml = await readFile(report, 'utf8');
  if (
    !/<testsuite\b/.test(xml) ||
    !/<testcase\b/.test(xml) ||
    /<(failure|error|skipped)\b/.test(xml) ||
    /\b(?:failures|errors|skipped)=["'][1-9]\d*["']/.test(xml)
  )
    throw new Error('E2E_REPORT_NOT_SUCCESSFUL');
  const count = (xml.match(/<testcase\b/g) ?? []).length;
  if (count !== selected.length) throw new Error('E2E_REPORT_INCOMPLETE');
  const receipt = {
    kind: 'installed-android-ui-preview',
    appId: E2E_APP_ID,
    maestro: MAESTRO_VERSION,
    device,
    flows: selected.map((file) => path.basename(file)),
    cases: count,
    nativeDeviceExecuted: true,
    realWalletUsed: false,
    regtestPaymentProved: false,
  };
  await record(path.join(directory, 'execution.json'), receipt);
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  executeE2E(parseOptions(process.argv.slice(2)))
    .then((result) => console.info(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message);
      if (error.output) console.error(error.output.slice(-6000));
      process.exitCode = 1;
    });
}
