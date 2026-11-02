import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { isConventionalTitle } from './check-pr-title.mjs';

test('la limite de 72 caractères accepte la borne puis refuse le caractère suivant', () => {
  const prefix = 'chore(deps): ';
  const boundary = prefix + 'a'.repeat(72 - prefix.length);
  assert.equal(isConventionalTitle(boundary), true);
  assert.equal(isConventionalTitle(`${boundary}a`), false);
});

test('un titre Dependabot trop long reste refusé et indique comment le corriger', () => {
  const title =
    'chore(deps): bump @react-navigation/native-stack from 7.0.0 to 7.1.0 in the mobile workspace';
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./check-pr-title.mjs', import.meta.url))],
    {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, PR_TITLE: title, GITHUB_ACTOR: 'dependabot[bot]' },
    },
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /72 caractères maximum/u);
  assert.match(result.stderr, /Raccourcir le titre de la PR/u);
  assert.match(result.stderr, /y compris pour Dependabot/u);
  assert.equal(isConventionalTitle('chore(deps): met à jour native-stack'), true);
});
