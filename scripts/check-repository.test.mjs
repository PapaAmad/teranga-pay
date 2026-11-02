import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkRepository } from './check-repository.mjs';

async function fixture(t, files = { 'README.md': '# Projet\n' }) {
  const parent = path.resolve(tmpdir());
  const root = await mkdtemp(path.join(parent, 'teranga-repo-check-'));
  t.after(async () => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith('teranga-repo-check-'));
    await rm(root, { recursive: true, force: true });
  });
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(root, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  return root;
}

test('les trois dossiers GitHub utilisent leurs guides réservés', async (t) => {
  const root = await fixture(t, {
    'README.md': '[GitHub](.github/GUIDE.md)\n',
    '.github/GUIDE.md': '[Formulaires](ISSUE_TEMPLATE/GUIDE.txt)\n',
    '.github/workflows/GUIDE.md': '# CI\n',
    '.github/ISSUE_TEMPLATE/GUIDE.txt': 'Modèles\n',
  });
  const result = await checkRepository(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.markdownCount, 3);
});

test('un README réservé est refusé même quand le guide est présent', async (t) => {
  for (const relative of ['.github', '.github/workflows', '.github/ISSUE_TEMPLATE']) {
    const root = await fixture(t, {
      'README.md': '# Projet\n',
      '.github/GUIDE.md': '# GitHub\n',
      [`${relative}/${relative.endsWith('ISSUE_TEMPLATE') ? 'GUIDE.txt' : 'GUIDE.md'}`]: 'Guide\n',
      [`${relative}/README.md`]: '# À déplacer\n',
    });
    assert.ok(
      (await checkRepository(root)).errors.some((x) => x.includes(`${relative} : utiliser GUIDE`)),
    );
  }
});

test('un guide manquant et un README qui est un dossier sont détectés', async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, '.github'));
  await mkdir(path.join(root, 'service', 'README.md'), { recursive: true });
  const { errors } = await checkRepository(root);
  assert.ok(errors.includes('.github : GUIDE.md manquant'));
  assert.ok(errors.includes('service : README.md manquant'));
});

test('un README symbolique vers un fichier est accepté, sans suivre les dossiers liés', async (t) => {
  const root = await fixture(t, { 'guide.md': '# Guide\n' });
  const external = await fixture(t, { 'exemple.txt': 'Sans README\n' });
  try {
    await symlink(path.join(root, 'guide.md'), path.join(root, 'README.md'), 'file');
    await symlink(
      external,
      path.join(root, 'lien-dossier'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM')
      return t.skip('Création de liens symboliques non autorisée sur ce poste Windows.');
    throw error;
  }
  assert.deepEqual((await checkRepository(root)).errors, []);
});

test('les exclusions du gitignore sont respectées pour les dossiers locaux', async (t) => {
  const root = await fixture(t, {
    'README.md': '# Projet\n',
    '.gitignore': 'personnel/\n.vscode/\n',
    'personnel/fichier.md': '[Exemple ignoré](absent.md)\n',
    '.vscode/settings.json': '{}\n',
  });
  const initialized = spawnSync('git', ['init', '--quiet', root], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(initialized.status, 0, initialized.stderr || initialized.error?.message);
  const result = await checkRepository(root);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.markdownCount, 1);
});

test('un README local ignoré dans .github ne déclenche pas le garde réservé', async (t) => {
  const root = await fixture(t, {
    'README.md': '# Projet\n',
    '.gitignore': '.github/README.local\n',
    '.github/GUIDE.md': '# GitHub\n',
    '.github/README.local': 'Note personnelle\n',
  });
  const initialized = spawnSync('git', ['init', '--quiet', root], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(initialized.status, 0, initialized.stderr);
  assert.deepEqual((await checkRepository(root)).errors, []);
});

test('un fichier suivi reste contrôlé même si un gitignore le couvre ensuite', async (t) => {
  const root = await fixture(t, {
    'README.md': '# Projet\n',
    '.gitignore': '.github/GUIDE.md\n',
    '.github/GUIDE.md': '[cassé](absent.md "Titre")\n',
  });
  for (const args of [
    ['init', '--quiet', root],
    ['-C', root, 'add', '-f', '.github/GUIDE.md'],
  ]) {
    const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
  }
  const result = await checkRepository(root);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /lien introuvable absent\.md$/u);
  assert.equal(result.markdownCount, 2);
});

test('les liens avec titres, espaces encadrés et parenthèses sont valides', async (t) => {
  const root = await fixture(t, {
    'README.md': [
      '[simple](guide.md "Titre")',
      "[espace](<guide avec espace.md> 'Titre')",
      '[parenthèses](guide(1).md (Titre))',
      '[échappé](guide\\(1\\).md)',
      '[ancre](guide.md#section)',
    ].join('\n'),
    'guide.md': '# Guide\n',
    'guide avec espace.md': '# Guide\n',
    'guide(1).md': '# Guide\n',
  });
  assert.deepEqual((await checkRepository(root)).errors, []);
});

test('les exemples de liens dans le code ne sont pas vérifiés', async (t) => {
  const root = await fixture(t, {
    'README.md': [
      '`[inline](absent.md)`',
      '``[inline](autre.md) avec ` interne``',
      '```md',
      '[exemple](absent.md)',
      '```',
      '~~~~md',
      '[exemple](autre.md)',
      '~~~',
      '[toujours dans le code](encore.md)',
      '~~~~',
      '[réel](guide.md "Titre")',
    ].join('\n'),
    'guide.md': '# Guide\n',
  });
  assert.deepEqual((await checkRepository(root)).errors, []);
});

test('un vrai lien cassé reste signalé sans confondre son titre avec le chemin', async (t) => {
  const root = await fixture(t, { 'README.md': '[cassé](absent.md "Titre")\n' });
  const { errors } = await checkRepository(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /lien introuvable absent\.md$/u);
});
