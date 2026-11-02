import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { isConventionalTitle } from './check-pr-title.mjs';
import {
  assertCompleteInventory,
  assertRepositoryTarget,
  assertReusableProject,
  buildIssueBody,
  existingLabel,
  existingNamedResource,
  existingTaskIssue,
  hasFrenchTrackingOptions,
  labelPayload,
  NO_REVIEWER,
  normalizeDisplayName,
  planTaskAssignees,
  readJson,
  root,
  selectTrackingField,
  selectTaskIssues,
  taskAssignees,
  validateBacklog,
  validateConfig,
} from './lib.mjs';

const config = readJson('.github/repository.json');
const backlog = readJson('scripts/github/backlog.json');
const labels = readJson('.github/labels.json');

test('le suivi réutilise Avancement puis Status sans créer ni modifier de champ existant', () => {
  const status = { id: 'status', name: 'Status', options: [{ name: 'Todo' }] };
  const advancement = { id: 'advancement', name: 'Avancement', options: [] };
  assert.equal(selectTrackingField([status, advancement]), advancement);
  assert.equal(selectTrackingField([status]), status);
  assert.equal(selectTrackingField([{ id: 'title', name: 'Title' }]), undefined);
  assert.deepEqual(status.options, [{ name: 'Todo' }]);
});

test('les quatre étapes françaises sont reconnues et un Status incomplet appelle une finalisation', () => {
  const complete = {
    name: 'Status',
    options: ['À faire', 'En cours', 'En revue', 'Terminé'].map((name) => ({ name })),
  };
  assert.equal(hasFrenchTrackingOptions(complete), true);
  assert.equal(hasFrenchTrackingOptions({ name: 'Status', options: [{ name: 'Todo' }] }), false);
  assert.equal(hasFrenchTrackingOptions({ name: 'Status' }), false);
});

test('la visibilité attendue est privée par défaut et seules private/public sont acceptées', () => {
  const withoutVisibility = { ...config };
  delete withoutVisibility.visibility;
  assert.equal(validateConfig(withoutVisibility).visibility, 'private');
  assert.equal(validateConfig({ ...config, visibility: 'public' }).visibility, 'public');
  assert.throws(() => validateConfig({ ...config, visibility: 'internal' }), /visibility/u);
  assert.throws(() => validateConfig({ ...config, visibility: null }), /visibility/u);
});

test('les réglages acceptent un dépôt privé et refusent un écart sans changer sa visibilité', () => {
  const privateRepo = { default_branch: 'main', private: true };
  assertRepositoryTarget(privateRepo, { ...config, visibility: 'private' });
  assertRepositoryTarget(privateRepo, {});
  const withoutVisibility = { ...config };
  delete withoutVisibility.visibility;
  assertRepositoryTarget(privateRepo, validateConfig(withoutVisibility));
  assert.throws(
    () =>
      assertRepositoryTarget({ default_branch: 'main', private: false }, { visibility: 'private' }),
    /Visibilité inattendue/u,
  );
  assert.throws(
    () =>
      assertRepositoryTarget(
        { default_branch: 'master', private: true },
        { visibility: 'private' },
      ),
    /branche par défaut/u,
  );
  assert.deepEqual(privateRepo, { default_branch: 'main', private: true });
});

test('les labels existants utilisent new_name pour PATCH et les nouveaux name pour POST', () => {
  const label = { name: 'mobile', color: '5319E7', description: 'Application React Native' };
  assert.deepEqual(labelPayload(label, false), label);
  assert.deepEqual(labelPayload(label, true), {
    new_name: 'mobile',
    color: label.color,
    description: label.description,
  });
});

test('les labels existants sont reconnus sans casse avant de choisir PATCH', () => {
  const current = { name: 'Mobile', color: '000000' };
  const expected = { name: 'mobile', color: '5319E7', description: 'Application mobile' };
  const existing = existingLabel([current], expected.name);
  assert.equal(existing, current);
  assert.equal(labelPayload(expected, Boolean(existing)).new_name, 'mobile');
  assert.equal(existingLabel([current], 'api'), undefined);
  assert.throws(() => existingLabel([current, { name: 'MOBILE' }], 'mobile'), /Plusieurs labels/u);
});

test('les noms historiques de rulesets et de Projects réutilisent le même identifiant', () => {
  const resources = [
    { field: 'name', kind: 'rulesets', expected: readJson('.github/main-ruleset.json').name },
    { field: 'title', kind: 'Projects', expected: config.projectTitle },
  ];
  for (const { field, kind, expected } of resources) {
    const legacyName = expected.replace(' | ', ' \u2014 ');
    const legacy = { id: 'existant', [field]: legacyName };
    const current = { id: 'actuel', [field]: expected };
    assert.equal(existingNamedResource([legacy], expected, field, kind), legacy);
    assert.equal(existingNamedResource([current], expected, field, kind), current);
    assert.equal(existingNamedResource([], expected, field, kind), undefined);
    assert.equal(
      existingNamedResource([{ [field]: `${expected} autre` }], expected, field, kind),
      undefined,
    );
    assert.throws(
      () => existingNamedResource([legacy, current], expected, field, kind),
      /résoudre le doublon/u,
    );
    assert.equal(legacy[field], legacyName);
  }
  assert.equal(normalizeDisplayName(undefined), undefined);
  assert.throws(
    () => existingNamedResource([{}], undefined, 'name', 'rulesets'),
    /Nom attendu invalide/u,
  );
});

test('les inventaires tronqués sont refusés avant de déduire une absence', () => {
  const projects = [{ id: 'existant' }];
  assert.equal(
    assertCompleteInventory({ projects, totalCount: 1 }, 'projects', 'des Projects'),
    projects,
  );
  assert.throws(
    () => assertCompleteInventory({ projects, totalCount: 101 }, 'projects', 'des Projects'),
    /pagination/u,
  );
  assert.throws(
    () => assertCompleteInventory({ items: [], totalCount: 1001 }, 'items', 'des cartes'),
    /pagination/u,
  );
  assert.throws(
    () => assertCompleteInventory({ projects }, 'projects', 'des Projects'),
    /incomplet/u,
  );
});

test('un Project fermé ou public est refusé avant sa réutilisation', () => {
  assertReusableProject(undefined);
  const project = { id: 'conservé', public: false, closed: false };
  assertReusableProject(project);
  assert.throws(() => assertReusableProject({ ...project, closed: true }), /fermé/u);
  assert.throws(() => assertReusableProject({ ...project, public: true }), /privé/u);
  assert.throws(() => assertReusableProject({ id: 'visibilité inconnue' }), /privé/u);
  assert.deepEqual(project, { id: 'conservé', public: false, closed: false });
});

test('une invitation en attente ne bloque pas une tâche partagée et conserve ses responsabilités', () => {
  const task = backlog.find(({ id }) => id === 'T11');
  const assignment = planTaskAssignees(task, config, ['papaamad']);
  assert.deepEqual(assignment, {
    assignable: ['PapaAmad'],
    pending: ['AliouneKane'],
    toAdd: ['PapaAmad'],
  });
  assert.match(buildIssueBody(task, config), /Responsable : @PapaAmad, @AliouneKane/u);
  const salamTask = backlog.find(({ id }) => id === 'T10');
  assert.deepEqual(planTaskAssignees(salamTask, config, ['PapaAmad']).assignable, []);
});

test('une relance ajoute seulement les responsables attendus devenus assignables', () => {
  const task = backlog.find(({ id }) => id === 'T11');
  const current = ['papaamad', 'relecteur-manuel'];
  const assignment = planTaskAssignees(task, config, ['PapaAmad', 'aliounekane'], current);
  assert.deepEqual(assignment.pending, []);
  assert.deepEqual(assignment.toAdd, ['AliouneKane']);
  assert.deepEqual(current, ['papaamad', 'relecteur-manuel']);
  assert.deepEqual(
    planTaskAssignees(task, config, ['PapaAmad', 'AliouneKane'], ['PapaAmad', 'AliouneKane']).toAdd,
    [],
  );
});

test('le backlog couvre exactement T06 à T40 avec responsables et labels connus', () => {
  validateConfig(config);
  validateBacklog(backlog, labels);
  assert.throws(() => validateBacklog(backlog.slice(1), labels));
  const invalid = structuredClone(backlog);
  invalid[0].labels.push('label-inconnu');
  assert.throws(() => validateBacklog(invalid, labels), /Label inconnu/u);
});

test('la configuration refuse les comptes identiques et les valeurs non textuelles', () => {
  assert.throws(() => validateConfig({ ...config, salam: config.pan }), /deux comptes distincts/u);
  assert.throws(() => validateConfig({ ...config, pan: 123 }), /pseudos GitHub/u);
  assert.throws(
    () => validateConfig({ ...config, repository: 'compte/sous/depot' }),
    /propriétaire\/dépôt/u,
  );
});

test('les échéances impossibles, la relecture par soi-même et les critères vides sont refusés', () => {
  const invalidDate = structuredClone(backlog);
  invalidDate[0].due = '2026-11-31';
  assert.throws(() => validateBacklog(invalidDate, labels), /Date ou taille incorrecte/u);
  const selfReview = structuredClone(backlog);
  selfReview[0].reviewer = selfReview[0].responsible;
  assert.throws(() => validateBacklog(selfReview, labels), /relecture doit être croisée/u);
  const blankCriterion = structuredClone(backlog);
  blankCriterion[0].acceptance = [' '];
  assert.throws(() => validateBacklog(blankCriterion, labels), /critères manquants/u);
});

test('un cycle de dépendances est détecté avant toute création d’issue', () => {
  const cyclic = structuredClone(backlog);
  cyclic[0].dependsOn = ['T07'];
  assert.throws(() => validateBacklog(cyclic, labels), /Cycle de dépendances/u);
});

test('les responsabilités partagées assignent les deux comptes et la relecture croisée est conservée', () => {
  assert.deepEqual(
    taskAssignees(
      backlog.find(({ id }) => id === 'T11'),
      config,
    ),
    ['PapaAmad', 'AliouneKane'],
  );
  const body = buildIssueBody(backlog[0], config);
  assert.match(body, /Relecture : @AliouneKane/u);
  assert.match(body, /<!-- teranga-task:T06 -->/u);
  assert.match(body, /- \[ \] L’application démarre/u);
});

test('la validation commune utilise une valeur explicite sans autoriser l’auto-relecture', () => {
  const shared = backlog.find(({ id }) => id === 'T11');
  assert.equal(shared.reviewer, NO_REVIEWER);
  assert.match(buildIssueBody(shared, config), /Relecture : validation commune/u);
  const invalidShared = structuredClone(backlog);
  invalidShared.find(({ id }) => id === 'T11').reviewer = 'PAN';
  assert.throws(() => validateBacklog(invalidShared, labels), /relecture doit être croisée/u);
  const missingReviewer = structuredClone(backlog);
  missingReviewer[0].reviewer = NO_REVIEWER;
  assert.throws(() => validateBacklog(missingReviewer, labels), /relecture doit être croisée/u);
});

test('la détection conserve une issue existante, même fermée, et refuse les doublons', () => {
  const existing = {
    number: 12,
    title: 'Titre modifié',
    body: '<!-- teranga-task:T06 -->',
    state: 'closed',
  };
  assert.equal(existingTaskIssue(backlog[0], [existing]), existing);
  for (const title of ['T06 | titre sans marqueur', 'T06 \u2014 titre sans marqueur']) {
    const byTitle = { number: 13, title, state: 'closed' };
    assert.equal(existingTaskIssue(backlog[0], [byTitle]), byTitle);
    assert.throws(() => existingTaskIssue(backlog[0], [existing, byTitle]), /Plusieurs issues/u);
  }
  assert.equal(existingTaskIssue(backlog[0], [{ title: 'T060 | autre tâche' }]), undefined);
});

test('la sélection autonome pour le Project détecte les doublons sur tout le backlog', () => {
  const first = { number: 1, title: 'T06 | existante', state: 'closed' };
  const second = { number: 2, body: '<!-- teranga-task:T06 -->' };
  const pull = { number: 38, title: 'T06 | une PR', pull_request: {} };
  assert.deepEqual(selectTaskIssues(backlog, [first, pull, { title: 'Hors backlog' }]), [first]);
  assert.throws(() => selectTaskIssues(backlog, [first, second]), /Plusieurs issues/u);
});

test('les titres refusent messages multilignes, types inconnus et titres trop longs', () => {
  assert.equal(isConventionalTitle('feat(mobile): ajoute la navigation'), true);
  assert.equal(isConventionalTitle('chore(ci): prépare le dépôt'), true);
  assert.equal(isConventionalTitle('chore: prépare le dépôt'), false);
  assert.equal(isConventionalTitle('ajout: navigation'), false);
  assert.equal(isConventionalTitle('fix(api): corrige\npuis injecte'), false);
  assert.equal(isConventionalTitle(`feat: ${'a'.repeat(80)}`), false);
});

test('la prévisualisation fonctionne sans gh ni réseau et annonce ses limites', () => {
  const result = spawnSync(process.execPath, ['scripts/github/setup.mjs', '--dry-run'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: '' },
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Aucun appel réseau et aucune modification/u);
  assert.match(result.stdout, /T40 \| 2026-11-20/u);
});

test('une option inconnue échoue avant tout appel distant', () => {
  const result = spawnSync(process.execPath, ['scripts/github/setup.mjs', '--section=inconnue'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Section attendue/u);
});

test('les modes apply et dry-run contradictoires sont refusés', () => {
  const result = spawnSync(process.execPath, ['scripts/github/setup.mjs', '--dry-run', '--apply'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: '' },
    windowsHide: true,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /jamais les deux/u);
});
