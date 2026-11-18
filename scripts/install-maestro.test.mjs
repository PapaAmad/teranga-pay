import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  MAESTRO_VERSION,
  MAESTRO_SHA256,
  MAESTRO_URL,
  downloadVerifiedArchive,
  installMaestro,
  maestroExecutable,
  validateInstallPath,
} from './install-maestro.mjs';

const bytes = Buffer.from('archive fictive de test, sans exécutable réel');
const sha256 = createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'teranga-maestro-'));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
    assert(path.basename(resolved).startsWith('teranga-maestro-'));
    await rm(resolved, { recursive: true, force: true });
  });
  return root;
}
const fetchFixture = async () => new Response(bytes);
async function fakeExtract(root, platform = process.platform) {
  const executable = maestroExecutable(root, platform);
  await mkdir(path.dirname(executable), { recursive: true });
  await writeFile(executable, 'outil fictif non exécutable');
}

test('verrou officiel et chemins locaux sans modification du PATH', () => {
  assert.equal(MAESTRO_VERSION, '2.12.1');
  assert.equal(MAESTRO_SHA256, '54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7');
  assert.equal(new URL(MAESTRO_URL).hostname, 'github.com');
  assert(MAESTRO_URL.includes('/cli-2.12.1/maestro.zip'));
  const root = path.resolve('workspace-fictif');
  assert.equal(
    maestroExecutable(root, 'win32'),
    path.join(root, '.tmp/tooling/maestro/2.12.1/maestro/bin/maestro.bat'),
  );
  assert.equal(
    maestroExecutable(root, 'linux'),
    path.join(root, '.tmp/tooling/maestro/2.12.1/maestro/bin/maestro'),
  );
});

test('importe le module sans téléchargement ni installation', () => {
  const url = new URL('./install-maestro.mjs', import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `globalThis.fetch=()=>{throw Error('réseau interdit')};await import(${JSON.stringify(url)});`,
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('refuse les sorties de racine et les préfixes de dossier voisins', () => {
  const root = path.resolve('workspace-fictif');
  for (const target of [root, path.dirname(root), root + '-voisin/archive.zip'])
    assert.throws(() => validateInstallPath(root, target), { code: 'MAESTRO_PATH_UNSAFE' });
  assert.equal(
    validateInstallPath(root, path.join(root, 'out', 'archive.zip')),
    path.join(root, 'out', 'archive.zip'),
  );
});

test('streaming vérifié avant extraction et cache idempotent sans second téléchargement', async (t) => {
  const root = await fixture(t);
  let fetches = 0,
    extractions = 0;
  const options = {
    root,
    expectedSha256: sha256,
    fetchImpl: async () => {
      fetches++;
      return fetchFixture();
    },
    extractImpl: async (result) => {
      extractions++;
      assert.equal(
        createHash('sha256')
          .update(await readFile(result.archive))
          .digest('hex'),
        sha256,
      );
      await fakeExtract(root);
    },
  };
  const first = await installMaestro(options),
    second = await installMaestro(options);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(fetches, 1);
  assert.equal(extractions, 2);
  assert.equal(await readFile(first.executable, 'utf8'), 'outil fictif non exécutable');
});

test('une empreinte incorrecte interdit toute extraction et ne laisse pas de fichier partiel', async (t) => {
  const root = await fixture(t);
  let extracted = false;
  await assert.rejects(
    installMaestro({
      root,
      fetchImpl: fetchFixture,
      extractImpl: async () => {
        extracted = true;
      },
    }),
    { code: 'MAESTRO_INTEGRITY_MISMATCH' },
  );
  assert.equal(extracted, false);
  const files = await readdir(path.join(root, '.tmp/tooling/maestro/2.12.1'));
  assert.deepEqual(files, []);
});

test('refuse un échec réseau sans exposer ses détails ni extraire', async (t) => {
  const root = await fixture(t);
  let extracted = false;
  await assert.rejects(
    installMaestro({
      root,
      fetchImpl: async () => {
        throw Error('détail-privé-interdit');
      },
      extractImpl: async () => {
        extracted = true;
      },
    }),
    { message: 'MAESTRO_DOWNLOAD_FAILED' },
  );
  assert.equal(extracted, false);
});

test('refuse une réponse HTTP échouée et une réponse sans corps', async (t) => {
  const root = await fixture(t);
  for (const response of [new Response('refus', { status: 503 }), new Response(null)])
    await assert.rejects(downloadVerifiedArchive({ root, fetchImpl: async () => response }), {
      code: 'MAESTRO_DOWNLOAD_FAILED',
    });
});

test('borne aussi les réponses sans Content-Length pendant le streaming', async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    downloadVerifiedArchive({ root, expectedSha256: sha256, maxBytes: 2, fetchImpl: fetchFixture }),
    { code: 'MAESTRO_ARCHIVE_TOO_LARGE' },
  );
  assert.deepEqual(await readdir(path.join(root, '.tmp/tooling/maestro/2.12.1')), []);
});

test('un cache corrompu n’est pas extrait et n’est remplacé qu’après vérification du nouveau fichier', async (t) => {
  const root = await fixture(t),
    directory = path.join(root, '.tmp/tooling/maestro/2.12.1');
  await mkdir(directory, { recursive: true });
  const archive = path.join(directory, 'maestro.zip');
  await writeFile(archive, 'cache incorrect');
  await assert.rejects(
    downloadVerifiedArchive({
      root,
      expectedSha256: sha256,
      fetchImpl: async () => new Response('encore incorrect'),
    }),
    { code: 'MAESTRO_INTEGRITY_MISMATCH' },
  );
  assert.equal(await readFile(archive, 'utf8'), 'cache incorrect');
  const result = await downloadVerifiedArchive({
    root,
    expectedSha256: sha256,
    fetchImpl: fetchFixture,
  });
  assert.equal(result.reused, false);
  assert.deepEqual(await readFile(archive), bytes);
});

test('un échec d’extraction ou un exécutable absent ne devient pas une installation réussie', async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    installMaestro({
      root,
      expectedSha256: sha256,
      fetchImpl: fetchFixture,
      extractImpl: async () => {
        throw Error('erreur outil');
      },
    }),
    { code: 'MAESTRO_EXTRACT_FAILED' },
  );
  await assert.rejects(
    installMaestro({
      root,
      expectedSha256: sha256,
      fetchImpl: fetchFixture,
      extractImpl: async () => {},
    }),
    { code: 'MAESTRO_EXECUTABLE_MISSING' },
  );
});

test('refuse un dossier de cache symbolique au lieu d’écrire hors du workspace', async (t) => {
  const root = await fixture(t),
    outside = await fixture(t);
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  try {
    await symlink(
      outside,
      path.join(root, '.tmp/tooling'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  } catch (error) {
    if (error.code === 'EPERM') {
      t.skip('Liens symboliques non autorisés sur ce poste.');
      return;
    }
    throw error;
  }
  let fetches = 0;
  await assert.rejects(
    downloadVerifiedArchive({
      root,
      expectedSha256: sha256,
      fetchImpl: async () => {
        fetches++;
        return fetchFixture();
      },
    }),
    { code: 'MAESTRO_PATH_UNSAFE' },
  );
  assert.equal(fetches, 0);
  assert.deepEqual(await readdir(outside), []);
});
