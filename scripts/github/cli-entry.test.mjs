import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMain } from './lib.mjs';

const scripts = fileURLToPath(new URL('./', import.meta.url));

async function linkedScripts(t) {
  const parent = resolve(tmpdir());
  const temporary = await mkdtemp(join(parent, 'teranga-cli-entry-'));
  t.after(async () => {
    assert.equal(dirname(temporary), parent);
    assert.ok(temporary.startsWith(join(parent, 'teranga-cli-entry-')));
    await rm(temporary, { recursive: true, force: true });
  });
  const linked = join(temporary, 'outils liés');
  await symlink(scripts, linked, process.platform === 'win32' ? 'junction' : 'dir');
  return linked;
}

function run(args) {
  return spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true });
}

test('isMain compare les fichiers réels, accepte les liens et distingue un import', async (t) => {
  const linked = await linkedScripts(t);
  assert.equal(isMain(import.meta.url, fileURLToPath(import.meta.url)), true);
  assert.equal(isMain(new URL(import.meta.url), join(linked, 'cli-entry.test.mjs')), true);
  assert.equal(isMain(import.meta.url, join(scripts, 'setup.mjs')), false);
  assert.equal(isMain(import.meta.url, ''), false);
  assert.equal(isMain(import.meta.url, '-'), false);
  assert.equal(isMain(import.meta.url, join(linked, 'absent.mjs')), false);
  assert.equal(isMain(import.meta.url, linked), false);
});

test('setup exécuté via un dossier lié affiche la prévisualisation et refuse les arguments invalides', async (t) => {
  const linked = await linkedScripts(t);
  const entry = join(linked, 'setup.mjs');
  const preview = run([entry, '--dry-run', '--section=labels']);
  assert.equal(preview.status, 0, preview.stderr || preview.error?.message);
  assert.match(preview.stdout, /PRÉVISUALISATION LOCALE/u);
  assert.match(preview.stdout, /Aucun appel réseau et aucune modification/u);

  const invalid = run([entry, '--apply', '--dry-run']);
  assert.equal(invalid.status, 1, invalid.stderr || invalid.error?.message);
  assert.match(invalid.stderr, /Choisir --apply ou --dry-run/u);
});

test('importer setup via un dossier lié reste sans exécution ni sortie CLI', async (t) => {
  const linked = await linkedScripts(t);
  const entryUrl = pathToFileURL(join(linked, 'setup.mjs')).href;
  const imported = run([
    '--input-type=module',
    '-e',
    `const module = await import(${JSON.stringify(entryUrl)}); if (typeof module.runSetup !== 'function') process.exitCode = 1;`,
  ]);
  assert.equal(imported.status, 0, imported.stderr || imported.error?.message);
  assert.equal(imported.stdout, '');
  assert.equal(imported.stderr, '');
});

test('importer setup depuis stdin reste sans exécution ni sortie CLI', () => {
  const entryUrl = new URL('./setup.mjs', import.meta.url).href;
  const imported = spawnSync(process.execPath, ['--input-type=module', '-'], {
    input: `await import(${JSON.stringify(entryUrl)});`,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(imported.status, 0, imported.stderr || imported.error?.message);
  assert.equal(imported.stdout, '');
  assert.equal(imported.stderr, '');
});

test('un import depuis eval ignore un argument qui ne désigne pas un module', () => {
  for (const name of ['setup.mjs', '../check-repository.mjs']) {
    const entryUrl = new URL(name, import.meta.url).href;
    const imported = run([
      '--input-type=module',
      '-e',
      `await import(${JSON.stringify(entryUrl)});`,
      'module-inexistant.mjs',
    ]);
    assert.equal(imported.status, 0, imported.stderr || imported.error?.message);
    assert.equal(imported.stdout, '');
    assert.equal(imported.stderr, '');
  }
});
