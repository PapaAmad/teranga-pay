import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { E2E_APP_ID, toolInvocation, workspace } from './mobile-e2e.mjs';

function run(binary, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const invocation = toolInvocation(binary, args);
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      env,
      windowsHide: true,
      windowsVerbatimArguments: invocation.windowsVerbatimArguments ?? false,
      stdio: 'inherit',
    });
    child.once('error', () => reject(new Error('E2E_BUILD_TOOL_UNAVAILABLE')));
    child.once('close', (code) =>
      code === 0 ? resolve() : reject(new Error('E2E_BUILD_FAILED: ' + code)),
    );
  });
}

export async function buildE2E() {
  const mobile = path.join(workspace, 'apps/mobile'),
    manifest = path.join(mobile, 'package.json');
  const beforeText = await readFile(manifest, 'utf8'),
    before = JSON.parse(beforeText);
  const env = {
    ...process.env,
    TERANGA_E2E_BUILD: '1',
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    DEBUG: '',
  };
  let prebuildError;
  try {
    await run(
      process.execPath,
      [
        path.join(workspace, 'node_modules/expo/bin/cli'),
        'prebuild',
        '--platform',
        'android',
        '--no-install',
      ],
      mobile,
      env,
    );
  } catch (error) {
    prebuildError = error;
  }
  // Prebuild adapte les scripts Expo Go, même lors d’un échec partiel.
  // Restaurer seulement ces changements connus, sans masquer une autre modification.
  const after = JSON.parse(await readFile(manifest, 'utf8'));
  for (const key of ['android', 'ios']) {
    if (after.scripts?.[key] === 'expo run:' + key) after.scripts[key] = before.scripts[key];
  }
  if (JSON.stringify(after) !== JSON.stringify(before))
    throw new Error('E2E_PREBUILD_CHANGED_DEPENDENCIES: vérifier le manifeste avant compilation', {
      cause: prebuildError,
    });
  await writeFile(manifest, beforeText);
  if (prebuildError) throw prebuildError;
  const android = path.join(mobile, 'android'),
    gradle = await readFile(path.join(android, 'app/build.gradle'), 'utf8');
  if (
    !gradle.includes("applicationId '" + E2E_APP_ID + "'") &&
    !gradle.includes('applicationId "' + E2E_APP_ID + '"')
  )
    throw new Error('E2E_ANDROID_ID_MISMATCH');
  await run(
    path.join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'),
    [':app:assembleDebug', '-PreactNativeArchitectures=x86_64', '--no-daemon', '--max-workers=2'],
    android,
    env,
  );
  const apk = path.join(android, 'app/build/outputs/apk/debug/app-debug.apk');
  await access(apk);
  console.info(
    JSON.stringify({ kind: 'debug-apk-build', appId: E2E_APP_ID, apk, maestroExecuted: false }),
  );
  return apk;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  buildE2E().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
