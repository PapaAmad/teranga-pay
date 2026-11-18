import { lstat, realpath, statfs, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isMain } from './github/lib.mjs';
import { runTool, workspace } from './mobile-e2e.mjs';

export const SDK_ROOT = '/usr/local/lib/android/sdk';
export const NDK_ROOT = SDK_ROOT + '/ndk';
export const GIB = 1024n ** 3n;
export const MINIMUM_BYTES = { prepare: 13n * GIB, 'check-boot': 9n * GIB };

export function parseSpaceMode(args) {
  if (args.length !== 1 || !Object.hasOwn(MINIMUM_BYTES, args[0]))
    throw new Error('E2E_SPACE_MODE_REQUIRED');
  return args[0];
}

export function assertHostedRuntime({ platform, env }) {
  if (
    platform !== 'linux' ||
    env.GITHUB_ACTIONS !== 'true' ||
    env.RUNNER_ENVIRONMENT !== 'github-hosted'
  )
    throw new Error('E2E_SPACE_HOST_REQUIRED');
  if (env.ANDROID_HOME !== SDK_ROOT) throw new Error('E2E_SPACE_SDK_UNEXPECTED');
}

async function checkedDirectory(fs, directory, optional = false) {
  let info;
  try {
    info = await fs.lstat(directory);
  } catch (error) {
    if (optional && error.code === 'ENOENT') return false;
    throw new Error('E2E_SPACE_PATH_UNSAFE', { cause: error });
  }
  if (info.isSymbolicLink() || !info.isDirectory() || (await fs.realpath(directory)) !== directory)
    throw new Error('E2E_SPACE_PATH_UNSAFE');
  return true;
}

async function recordReceipt(mode, receipt) {
  const directory = path.join(workspace, '.tmp/e2e');
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'disk-' + mode + '.json'),
    JSON.stringify(receipt, null, 2) + '\n',
  );
}

/** Injection réservée aux tests ; le CLI utilise le contexte et les outils réels. */
export async function ensureAndroidE2ESpace(
  mode,
  {
    context = { platform: process.platform, env: process.env },
    fs = { lstat, realpath, statfs },
    run = runTool,
    record = recordReceipt,
    log = console.info,
  } = {},
) {
  parseSpaceMode([mode]);
  assertHostedRuntime(context);
  await checkedDirectory(fs, SDK_ROOT);
  let ndkRemoved = false;
  let directory = workspace;
  if (mode === 'prepare') {
    if (await checkedDirectory(fs, NDK_ROOT, true)) {
      log(run('du', ['-sh', '--', NDK_ROOT]).trim());
      // Seul ce composant inutilisé du SDK de la VM hébergée peut être supprimé.
      run('sudo', ['rm', '-rf', '--one-file-system', '--', NDK_ROOT]);
      ndkRemoved = true;
    }
  } else {
    const avd = context.env.ANDROID_AVD_HOME;
    if (typeof avd !== 'string' || !path.posix.isAbsolute(avd))
      throw new Error('E2E_SPACE_AVD_REQUIRED');
    directory = await fs.realpath(avd);
    await checkedDirectory(fs, directory);
  }
  log(run('df', ['-h', '--', directory]).trim());
  const space = await fs.statfs(directory, { bigint: true });
  if (
    typeof space.bavail !== 'bigint' ||
    typeof space.bsize !== 'bigint' ||
    space.bavail < 0n ||
    space.bsize <= 0n
  )
    throw new Error('E2E_SPACE_MEASURE_INVALID');
  const free = space.bavail * space.bsize;
  const minimum = MINIMUM_BYTES[mode];
  const receipt = {
    kind: 'android-e2e-space',
    phase: mode,
    sdkRoot: SDK_ROOT,
    directory,
    ndkRemoved,
    freeBytes: free.toString(),
    minimumBytes: minimum.toString(),
    sufficient: free >= minimum,
  };
  await record(mode, receipt);
  log(JSON.stringify(receipt));
  if (!receipt.sufficient)
    throw new Error(
      'E2E_SPACE_LOW: ' +
        mode +
        ' | ' +
        (Number(free) / Number(GIB)).toFixed(2) +
        ' Gio libres | ' +
        minimum / GIB +
        ' Gio requis',
    );
  return receipt;
}

if (isMain(import.meta.url)) {
  Promise.resolve()
    .then(() => ensureAndroidE2ESpace(parseSpaceMode(process.argv.slice(2))))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
