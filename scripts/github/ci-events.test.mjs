import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const workflow = readFileSync(
  new URL('../../.github/workflows/ci.yml', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n');
const titleWorkflow = readFileSync(
  new URL('../../.github/workflows/pr-title.yml', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n');
const ruleset = JSON.parse(
  readFileSync(new URL('../../.github/main-ruleset.json', import.meta.url), 'utf8'),
);
const required = ruleset.rules
  .find(({ type }) => type === 'required_status_checks')
  .parameters.required_status_checks.map(({ context }) => context);

function scalar(block, key, indent) {
  const match = block.match(new RegExp(`^${' '.repeat(indent)}${key}: (.+)$`, 'mu'));
  assert.ok(match, `Champ ${key} absent du workflow`);
  return match[1];
}

function job(id) {
  const match = workflow.match(
    new RegExp(`^  ${id}:\\n([\\s\\S]*?)(?=^  \\w+:|$(?![\\s\\S]))`, 'mu'),
  );
  assert.ok(match, `Job ${id} absent du workflow`);
  return match[1];
}

const quality = job('quality');
const secrets = job('secrets');
const checkNames = [...quality.matchAll(/^ {10}- check: (.+)$/gmu)].map(([, check]) => check);

// Ces expressions utilisent uniquement !, ==, !=, &&, || et l'accès aux
// propriétés : leur résultat est identique en JavaScript pour ces fixtures.
// actionlint vérifie séparément la syntaxe complète GitHub Actions.
function evaluate(expression, github, matrix) {
  return runInNewContext(expression.trim(), { github, matrix }, { timeout: 100 });
}

function interpolate(template, github, matrix) {
  return template.replace(/\$\{\{(.*?)\}\}/gu, (_, expression) =>
    String(evaluate(expression, github, matrix)),
  );
}

function enabled(block, github) {
  const expression = scalar(block, 'if', 4).match(/^\$\{\{(.*)\}\}$/u);
  assert.ok(expression, 'Condition de job non reconnue');
  return Boolean(evaluate(expression[1], github));
}

function event(action, changes = {}) {
  return {
    workflow: 'CI',
    ref: 'refs/pull/38/merge',
    event: { action, changes, pull_request: { number: 38 } },
  };
}

function checks(github) {
  const qualityEnabled = enabled(quality, github);
  // GitHub évalue if avant la matrice : le nom de repli doit rester sûr même
  // sans matrix sur les événements ignorés.
  const matrix = qualityEnabled ? checkNames.map((check) => ({ check })) : [undefined];
  return [
    ...matrix.map((entry) => ({
      name: interpolate(scalar(quality, 'name', 4), github, entry),
      status: qualityEnabled ? 'queued' : 'skipped',
    })),
    {
      name: interpolate(scalar(secrets, 'name', 4), github),
      status: enabled(secrets, github) ? 'queued' : 'skipped',
    },
  ];
}

function concurrency(github) {
  return interpolate(scalar(workflow, 'group', 2), github);
}

test('ouverture, nouveau commit et changement de cible retestent les cinq contrôles', () => {
  assert.match(scalar(workflow, 'types', 4), /\bedited\b/u);
  for (const github of [
    event('opened'),
    event('synchronize'),
    event('reopened'),
    event('ready_for_review'),
    event('edited', { base: { ref: { from: 'develop' } } }),
  ]) {
    const planned = checks(github);
    assert.ok(planned.every(({ status }) => status === 'queued'));
    assert.deepEqual(
      planned.map(({ name }) => name).sort(),
      required.filter((name) => name !== 'Titre PR').sort(),
    );
    assert.equal(concurrency(github), concurrency(event('opened')));
  }
});

test('titre et description ne masquent pas un contrôle de qualité échoué', () => {
  assert.match(scalar(titleWorkflow, 'types', 4), /\bedited\b/u);
  const qualityChecks = required.filter((name) => name !== 'Titre PR');
  const results = new Map(qualityChecks.map((name) => [name, 'failure']));
  for (const changes of [{ title: { from: 'ancien' } }, { body: { from: 'ancien' } }]) {
    const planned = checks(event('edited', changes));
    assert.ok(planned.every(({ status }) => status === 'skipped'));
    for (const { name, status } of planned) {
      assert.ok(!required.includes(name), `${name} masquerait un ancien résultat`);
      results.set(name, status);
    }
  }
  for (const name of qualityChecks) assert.equal(results.get(name), 'failure');
});

test('les modifications de métadonnées ne peuvent pas annuler une CI utile', () => {
  assert.equal(scalar(workflow, 'cancel-in-progress', 2), 'true');
  const useful = event('synchronize');
  for (const changes of [{ body: { from: '' } }, { title: { from: '' } }]) {
    assert.notEqual(concurrency(event('edited', changes)), concurrency(useful));
  }
  assert.equal(
    concurrency(event('edited', { base: { ref: { from: 'develop' } } })),
    concurrency(useful),
  );
  const otherPR = event('opened');
  otherPR.event.pull_request.number = 39;
  assert.notEqual(concurrency(otherPR), concurrency(useful));
  assert.notEqual(interpolate(scalar(titleWorkflow, 'group', 2), useful), concurrency(useful));
});

test('push sur main et lancement manuel conservent les contrôles de qualité', () => {
  for (const github of [
    { workflow: 'CI', ref: 'refs/heads/main', event: { pull_request: {} } },
    { workflow: 'CI', ref: 'refs/heads/docs/T07-validation-ci', event: { pull_request: {} } },
  ]) {
    assert.ok(checks(github).every(({ status }) => status === 'queued'));
    assert.ok(concurrency(github).includes(github.ref));
  }
});
