import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, realpath, rmdir, symlink, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  SDK_ROOT,
  NDK_ROOT,
  GIB,
  MINIMUM_BYTES,
  parseSpaceMode,
  ensureAndroidE2ESpace,
} from './android-e2e-space.mjs';

const avd = '/home/runner/.android/avd';
const directoryInfo = { isSymbolicLink: () => false, isDirectory: () => true };
function fixture() {
  const calls = [],
    receipts = [],
    reads = [];
  const options = {
    context: {
      platform: 'linux',
      env: {
        GITHUB_ACTIONS: 'true',
        RUNNER_ENVIRONMENT: 'github-hosted',
        ANDROID_HOME: SDK_ROOT,
        ANDROID_AVD_HOME: avd,
      },
    },
    fs: {
      lstat: async (file) => {
        reads.push(['lstat', file]);
        return directoryInfo;
      },
      realpath: async (file) => {
        reads.push(['realpath', file]);
        return file;
      },
      statfs: async (file, config) => {
        reads.push(['statfs', file, config]);
        return { bavail: 16n * GIB, bsize: 1n };
      },
    },
    run: (binary, args) => {
      calls.push({ binary, args });
      return 'diagnostic fictif\n';
    },
    record: async (mode, receipt) => {
      receipts.push({ mode, receipt });
    },
    log: () => {},
  };
  return { options, calls, receipts, reads };
}
const deletion = (calls) => calls.filter((call) => call.binary === 'sudo');

test('les modes et leurs seuils sont explicites, sans chemin reçu du CLI', () => {
  assert.equal(parseSpaceMode(['prepare']), 'prepare');
  assert.equal(parseSpaceMode(['check-boot']), 'check-boot');
  assert.equal(MINIMUM_BYTES.prepare, 13n * GIB);
  assert.equal(MINIMUM_BYTES['check-boot'], 9n * GIB);
  for (const args of [[], ['remove'], ['prepare', '/'], ['--help']])
    assert.throws(() => parseSpaceMode(args), /E2E_SPACE_MODE_REQUIRED/);
});

test('refuse une machine locale, un runner autohébergé ou un autre SDK avant tout accès', async () => {
  const changes = [
    (c) => {
      c.platform = 'win32';
    },
    (c) => {
      c.platform = 'darwin';
    },
    (c) => {
      c.env.GITHUB_ACTIONS = 'false';
    },
    (c) => {
      c.env.RUNNER_ENVIRONMENT = 'self-hosted';
    },
    (c) => {
      delete c.env.RUNNER_ENVIRONMENT;
    },
    (c) => {
      c.env.ANDROID_HOME = '/';
    },
    (c) => {
      c.env.ANDROID_HOME = SDK_ROOT + '-voisin';
    },
  ];
  for (const change of changes) {
    const f = fixture();
    change(f.options.context);
    await assert.rejects(
      ensureAndroidE2ESpace('prepare', f.options),
      /E2E_SPACE_(HOST_REQUIRED|SDK_UNEXPECTED)/,
    );
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.reads, []);
    assert.deepEqual(f.receipts, []);
  }
});

test('supprime seulement le NDK canonique avec des arguments sans shell', async () => {
  const f = fixture();
  const receipt = await ensureAndroidE2ESpace('prepare', f.options);
  assert.deepEqual(deletion(f.calls), [
    { binary: 'sudo', args: ['rm', '-rf', '--one-file-system', '--', NDK_ROOT] },
  ]);
  const deletionIndex = f.calls.findIndex((call) => call.binary === 'sudo');
  assert.equal(f.calls[deletionIndex - 1].binary, 'du');
  assert.equal(f.calls[deletionIndex + 1].binary, 'df');
  assert.equal(receipt.ndkRemoved, true);
  assert.equal(receipt.sufficient, true);
  assert.equal(f.receipts[0].receipt, receipt);
});

test('refuse les liens, fichiers et chemins réels divergents avant toute suppression', async () => {
  for (const target of [SDK_ROOT, NDK_ROOT]) {
    for (const kind of ['symlink', 'file', 'realpath']) {
      const f = fixture();
      if (kind === 'realpath')
        f.options.fs.realpath = async (file) => (file === target ? '/ailleurs/sdk' : file);
      else
        f.options.fs.lstat = async (file) =>
          file === target
            ? { isSymbolicLink: () => kind === 'symlink', isDirectory: () => false }
            : directoryInfo;
      await assert.rejects(ensureAndroidE2ESpace('prepare', f.options), /E2E_SPACE_PATH_UNSAFE/);
      assert.deepEqual(deletion(f.calls), []);
      assert.deepEqual(f.receipts, []);
    }
  }
});

test('un NDK absent ne déclenche aucune suppression', async () => {
  const f = fixture();
  f.options.fs.lstat = async (file) => {
    if (file === NDK_ROOT) throw Object.assign(new Error(), { code: 'ENOENT' });
    return directoryInfo;
  };
  const result = await ensureAndroidE2ESpace('prepare', f.options);
  assert.deepEqual(deletion(f.calls), []);
  assert.equal(result.ndkRemoved, false);
  assert.equal(result.sufficient, true);
});

test('une erreur de lecture ou de suppression reste un échec sans preuve suffisante', async () => {
  for (const failure of ['read', 'delete']) {
    const f = fixture();
    if (failure === 'read')
      f.options.fs.lstat = async () => {
        throw Object.assign(new Error(), { code: 'EACCES' });
      };
    else
      f.options.run = (binary) => {
        if (binary === 'sudo') throw new Error('SUPPRESSION_REFUSEE');
        return '';
      };
    await assert.rejects(ensureAndroidE2ESpace('prepare', f.options));
    assert.deepEqual(f.receipts, []);
  }
});

test('le contrôle avant boot mesure le filesystem AVD réel sans suppression', async () => {
  const f = fixture(),
    actual = '/mnt/avd';
  f.options.fs.realpath = async (file) => (file === avd ? actual : file);
  const result = await ensureAndroidE2ESpace('check-boot', f.options);
  assert.equal(result.directory, actual);
  assert.equal(result.ndkRemoved, false);
  assert.deepEqual(deletion(f.calls), []);
  assert.ok(f.reads.some(([method, directory]) => method === 'statfs' && directory === actual));
  assert.ok(!f.reads.some(([method, directory]) => method === 'lstat' && directory === NDK_ROOT));
});

test('le contrôle avant boot exige une cible AVD absolue', async () => {
  for (const value of [undefined, '', 'avd/relatif']) {
    const f = fixture();
    f.options.context.env.ANDROID_AVD_HOME = value;
    await assert.rejects(ensureAndroidE2ESpace('check-boot', f.options), /E2E_SPACE_AVD_REQUIRED/);
    assert.deepEqual(deletion(f.calls), []);
    assert.deepEqual(f.receipts, []);
  }
});

test('chaque seuil accepte exactement sa borne et refuse un octet de moins', async () => {
  for (const mode of ['prepare', 'check-boot']) {
    for (const delta of [0n, -1n]) {
      const f = fixture();
      f.options.fs.statfs = async () => ({ bavail: MINIMUM_BYTES[mode] + delta, bsize: 1n });
      if (delta === 0n)
        assert.equal((await ensureAndroidE2ESpace(mode, f.options)).sufficient, true);
      else {
        await assert.rejects(ensureAndroidE2ESpace(mode, f.options), /E2E_SPACE_LOW/);
        assert.equal(f.receipts[0].receipt.sufficient, false);
        assert.equal(f.receipts[0].receipt.freeBytes, (MINIMUM_BYTES[mode] - 1n).toString());
      }
      if (mode === 'check-boot') assert.deepEqual(deletion(f.calls), []);
    }
  }
});

test('une mesure invalide ne produit pas de relevé de réussite', async () => {
  for (const space of [
    { bavail: 20, bsize: 1 },
    { bavail: -1n, bsize: 4096n },
    { bavail: 20n, bsize: 0n },
  ]) {
    const f = fixture();
    f.options.fs.statfs = async () => space;
    await assert.rejects(
      ensureAndroidE2ESpace('check-boot', f.options),
      /E2E_SPACE_MEASURE_INVALID/,
    );
    assert.deepEqual(f.receipts, []);
    assert.deepEqual(deletion(f.calls), []);
  }
});

test('importer le helper ne lance rien et son CLI refuse un contexte local', () => {
  const url = new URL('./android-e2e-space.mjs', import.meta.url).href;
  const imported = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(url)})`],
    { encoding: 'utf8', windowsHide: true },
  );
  assert.equal(imported.status, 0);
  assert.equal(imported.stdout, '');
  assert.equal(imported.stderr, '');
  const cli = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./android-e2e-space.mjs', import.meta.url)), 'prepare'],
    {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, GITHUB_ACTIONS: 'false', RUNNER_ENVIRONMENT: 'self-hosted' },
    },
  );
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /E2E_SPACE_HOST_REQUIRED/);
});

test('une entrée CLI liée exécute aussi la garde du contexte local', async (t) => {
  const root = await realpath(new URL('..', import.meta.url));
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  const scratch = await realpath(path.join(root, '.tmp'));
  assert.equal(path.relative(root, scratch), '.tmp');
  const temporary = await mkdtemp(path.join(scratch, 't30-space-entry-'));
  const alias = path.join(temporary, 'scripts');
  const target = await realpath(path.join(root, 'scripts'));
  let linked = false;
  try {
    try {
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
      linked = true;
    } catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
        t.skip('Création de jonction non autorisée sur ce poste Windows.');
        return;
      }
      throw error;
    }
    const cli = spawnSync(
      process.execPath,
      [path.join(alias, 'android-e2e-space.mjs'), 'prepare'],
      {
        encoding: 'utf8',
        windowsHide: true,
        env: { ...process.env, GITHUB_ACTIONS: 'false', RUNNER_ENVIRONMENT: 'self-hosted' },
      },
    );
    assert.equal(cli.status, 1);
    assert.equal(cli.stdout, '');
    assert.match(cli.stderr, /E2E_SPACE_HOST_REQUIRED/);
  } finally {
    // Retirer seulement notre lien puis son dossier vide, sans parcours récursif.
    assert.equal(path.dirname(temporary), scratch);
    if (linked) {
      assert.equal((await lstat(alias)).isSymbolicLink(), true);
      assert.equal(await realpath(alias), target);
      await unlink(alias).catch(async (error) => {
        if (error.code !== 'EPERM') throw error;
        await rmdir(alias);
      });
    }
    await rmdir(temporary);
  }
});
