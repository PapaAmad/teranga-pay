import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
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

function git(root, args, input) {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    input,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
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

test('les README documentaires sont réservés, sans interdire un workflow readme.yml', async (t) => {
  const files = {
    'README.md': '# Projet\n',
    '.github/GUIDE.md': '# GitHub\n',
    '.github/workflows/GUIDE.md': '# CI\n',
    '.github/workflows/readme.yml': 'name: Vérifier les documents\n',
  };
  const root = await fixture(t, files);
  assert.deepEqual((await checkRepository(root)).errors, []);
  for (const name of [
    'README',
    'Readme.markdown',
    'README.mdown',
    'README.txt',
    'readme.rst',
    'README.rst.txt',
    'README.rdoc',
    'README.org',
    'README.adoc',
    'README.pod6',
    'README.mdx',
    'README.litcoffee',
  ]) {
    const documentary = await fixture(t, { ...files, [`.github/${name}`]: 'Documentation\n' });
    assert.ok(
      (await checkRepository(documentary)).errors.some((error) =>
        error.includes('.github : utiliser GUIDE.md'),
      ),
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

test('un README symbolique vers un fichier est accepté', async (t) => {
  const root = await fixture(t, { 'guide.md': '# Guide\n' });
  try {
    await symlink(path.join(root, 'guide.md'), path.join(root, 'README.md'), 'file');
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM')
      return t.skip('Création de liens symboliques non autorisée sur ce poste Windows.');
    throw error;
  }
  assert.deepEqual((await checkRepository(root)).errors, []);
});

test('les dossiers symboliques externes ne sont pas parcourus', async (t) => {
  const root = await fixture(t);
  const external = await fixture(t, { 'exemple.md': '[Lien externe](absent.md)\n' });
  await symlink(
    external,
    path.join(root, 'lien-dossier'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const result = await checkRepository(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.markdownCount, 1);
});

test('la commande de contrôle s’exécute depuis un dossier symbolique', async (t) => {
  const temporary = await fixture(t, {
    'README.md': '# Projet de test\n',
    'scripts/README.md': '# Scripts de test\n',
    'scripts/github/README.md': '# Entrée CLI de test\n',
  });
  for (const name of ['check-repository.mjs', 'github/lib.mjs']) {
    await copyFile(new URL(name, import.meta.url), path.join(temporary, 'scripts', name));
  }
  const modules = path.join(temporary, 'node_modules');
  await mkdir(modules);
  await symlink(
    path.dirname(fileURLToPath(import.meta.resolve('markdown-it/package.json'))),
    path.join(modules, 'markdown-it'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const alias = path.join(temporary, 'scripts-symboliques');
  await symlink(
    path.join(temporary, 'scripts'),
    alias,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const run = () =>
    spawnSync(process.execPath, [path.join(alias, 'check-repository.mjs')], {
      cwd: temporary,
      encoding: 'utf8',
      windowsHide: true,
    });
  const result = run();
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /Structure vérifiée :.*3 documents aux liens valides/u);
  await writeFile(path.join(temporary, 'README.md'), '[Lien cassé de la fixture](absent.md)\n');
  const invalid = run();
  assert.equal(invalid.status, 1, invalid.stderr || invalid.error?.message);
  assert.match(invalid.stderr, /README\.md : lien introuvable absent\.md/u);
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
    '.gitignore': '.github/README.md\n',
    '.github/GUIDE.md': '# GitHub\n',
    '.github/README.md': 'Note locale ignorée\n',
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

test('un gitlink est une feuille et son contenu externe reste hors du contrôle', async (t) => {
  const root = await fixture(t, {
    'README.md': '# Projet\n',
    'externe/README.md': '[Hors du dépôt](absent.md)\n',
    'externe/sans-guide/exemple.md': '[Externe](autre.md)\n',
  });
  git(root, ['init', '--quiet']);
  const tree = git(root, ['hash-object', '-t', 'tree', '--stdin', '-w'], '').trim();
  const commit = git(
    root,
    ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit-tree', tree],
    'Sous-module de test\n',
  ).trim();
  git(root, ['update-index', '--add', '--cacheinfo', `160000,${commit},externe`]);
  const result = await checkRepository(root);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.markdownCount, 1);
});

test('les chemins Git NFC retrouvent les fichiers physiques NFD sans masquer leurs erreurs', async (t) => {
  const root = await fixture(t, {
    'README.md': '# Projet\n',
    'cafe\u0301/README.md': '[Cassé](absent.md)\n',
  });
  git(root, ['init', '--quiet']);
  const result = await checkRepository(root, {
    git: async (directory, args) => ({
      code: 0,
      stdout: git(directory, args).normalize('NFC'),
    }),
  });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /lien introuvable absent\.md$/u);
  assert.equal(result.markdownCount, 2);
});

test('les extensions Markdown classiques sont contrôlées sans dépendre de la casse', async (t) => {
  const root = await fixture(t, {
    'README.md': '# Projet\n',
    'guide.MD': '[Cassé](absent.md)\n',
    'guide.markdown': '[Cassé](absent.md)\n',
    'guide.mdown': '[Cassé](absent.md)\n',
    'guide.mdwn': '[Cassé](absent.md)\n',
    'guide.mkd': '[Cassé](absent.md)\n',
    'guide.mkdn': '[Cassé](absent.md)\n',
  });
  const result = await checkRepository(root);
  assert.equal(result.errors.length, 6);
  assert.ok(result.errors.every((error) => /lien introuvable absent\.md$/u.test(error)));
  assert.equal(result.markdownCount, 7);
});

test('les liens avec titres, espaces encadrés et parenthèses sont valides', async (t) => {
  const root = await fixture(t, {
    'README.md': [
      '[simple](guide.md "Titre")',
      "[espace](<guide avec espace.md> 'Titre')",
      '[parenthèses](guide(1).md (Titre))',
      '[échappé](guide\\(1\\).md)',
      '[ancre](guide.md#section)',
      '[encodé](guide%20avec%20espace.md#section)',
      '[dièse encodé](guide%23annexe.md)',
      '[local](#section)',
      '[distant](https://example.invalid/guide.md)',
    ].join('\n'),
    'guide.md': '# Guide\n',
    'guide avec espace.md': '# Guide\n',
    'guide(1).md': '# Guide\n',
    'guide#annexe.md': '# Guide\n',
  });
  assert.deepEqual((await checkRepository(root)).errors, []);
});

test('les chemins encodés sont vérifiés et leurs erreurs affichent les accents et espaces', async (t) => {
  const root = await fixture(t, {
    'README.md': [
      '[valide](d%C3%A9cision%20prise.md)',
      '[absent](d%C3%A9cision%20absente.md)',
    ].join('\n'),
    'décision prise.md': '# Décision\n',
  });
  assert.deepEqual((await checkRepository(root)).errors, [
    'README.md : lien introuvable décision absente.md',
  ]);
});

test('un encodage URI mal formé produit une erreur explicite sans arrêter le contrôle', async (t) => {
  const root = await fixture(t, {
    'README.md': '[encodage invalide](guide%E0%A4.md)\n[autre lien](absent.md)\n',
  });
  assert.deepEqual((await checkRepository(root)).errors, [
    'README.md : encodage de lien invalide guide%E0%A4.md',
    'README.md : lien introuvable absent.md',
  ]);
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

test('un accent grave isolé ne masque pas un lien dans le paragraphe suivant', async (t) => {
  const root = await fixture(t, {
    'README.md': 'Utiliser l`apostrophe ici.\n\n[cassé](absent.md)\n\nPuis `code`.\n',
  });
  const { errors } = await checkRepository(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /lien introuvable absent\.md$/u);
});

test('les liens par référence et les images utilisent uniquement les définitions employées', async (t) => {
  const root = await fixture(t, {
    'README.md': [
      '[complet][guide]',
      '[réduit][]',
      '[raccourci]',
      '![image][logo]',
      '',
      '[guide]: guide.md "Titre"',
      '[réduit]: <guide avec espace.md>',
      '[raccourci]: guide.md#section',
      '[logo]: image.png',
      '[inutilisé]: absent.md',
    ].join('\n'),
    'guide.md': '# Guide\n',
    'guide avec espace.md': '# Guide\n',
    'image.png': 'Image de test\n',
  });
  assert.deepEqual((await checkRepository(root)).errors, []);
});

test('les références cassées et les images absentes sont détectées', async (t) => {
  for (const markdown of [
    '[complet][guide]\n\n[guide]: absent.md\n',
    '[réduit][]\n\n[réduit]: absent.md\n',
    '[raccourci]\n\n[raccourci]: absent.md\n',
    '![image][logo]\n\n[logo]: absent.md\n',
    '![image](absent.md)\n',
    '[[crochets]](absent.md)\n',
  ]) {
    const root = await fixture(t, { 'README.md': markdown });
    const { errors } = await checkRepository(root);
    assert.equal(errors.length, 1, markdown);
    assert.match(errors[0], /lien introuvable absent\.md$/u);
  }
});

test('les commentaires HTML, crochets échappés et textes alternatifs ne créent pas de liens', async (t) => {
  const root = await fixture(t, {
    'README.md': [
      '<!-- [commentaire](absent.md)',
      '',
      '![commentaire](autre.md) -->',
      'Un commentaire <!-- [inline](absent.md) --> discret.',
      '\\[échappé](absent.md)',
      '![texte [lien](absent.md)](image.png)',
      '[![image](image.png)](guide.md)',
    ].join('\n'),
    'guide.md': '# Guide\n',
    'image.png': 'Image de test\n',
  });
  assert.deepEqual((await checkRepository(root)).errors, []);
});

test('les attributs HTML bruts restent hors du périmètre des liens Markdown', async (t) => {
  const root = await fixture(t, {
    'README.md': [
      '<img src="image-html-absente.png">',
      '',
      '<a href="lien-html-absent.md">Lien HTML</a>',
      '',
      '![image Markdown](image-markdown.png)',
      '[lien Markdown](lien-markdown-absent.md)',
    ].join('\n'),
    'image-markdown.png': 'Image de test\n',
  });
  assert.deepEqual((await checkRepository(root)).errors, [
    'README.md : lien introuvable lien-markdown-absent.md',
  ]);
});

test('un vrai lien cassé reste signalé sans confondre son titre avec le chemin', async (t) => {
  const root = await fixture(t, { 'README.md': '[cassé](absent.md "Titre")\n' });
  const { errors } = await checkRepository(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /lien introuvable absent\.md$/u);
});
