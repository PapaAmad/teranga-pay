import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const available = spawnSync('python', ['--version'], { encoding: 'utf8', windowsHide: true });
test(
  'un ancien Python est refusé avant FontTools et avant toute lecture des originaux',
  {
    skip: available.error
      ? 'Python facultatif non installé : outil de reconstruction des polices.'
      : false,
  },
  () => {
    const script = fileURLToPath(new URL('./subset-brand-fonts.py', import.meta.url));
    const code =
      'import runpy, sys\nfrom pathlib import Path\n' +
      'module = runpy.run_path(sys.argv[1])\nsys.version_info = (3, 9, 6)\n' +
      'module["rebuild"](Path("source-fictive-inexistante"))\n';
    const result = spawnSync('python', ['-I', '-c', code, script], {
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Python 3\.10 ou plus requis/);
    assert.equal(result.stdout, '');
  },
);
