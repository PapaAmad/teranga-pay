import assert from 'node:assert/strict';
import test from 'node:test';
import { indexTaskIssues, readJson } from './lib.mjs';
import { ensureIssues, ensureProject } from './setup.mjs';

const config = readJson('.github/repository.json');
const backlog = readJson('scripts/github/backlog.json');
const project = {
  id: 'project-existant',
  number: 3,
  title: config.projectTitle,
  public: false,
  closed: false,
};
const status = {
  id: 'status',
  name: 'Status',
  options: ['À faire', 'En cours', 'En revue', 'Terminé'].map((name) => ({ name })),
};
const issueUrl = (number) => `https://github.com/${config.repository}/issues/${number}`;
const card = (number, archived = false) => ({
  id: `carte-${number}`,
  isArchived: archived,
  content: { __typename: 'Issue', url: issueUrl(number) },
});

function mute(t) {
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'warn', () => {});
}

function projectRemote({
  projects = [[project]],
  items = [[]],
  fields = [[status]],
  overrides = {},
  created = project,
} = {}) {
  const connections = { projects, items, fields };
  const reads = [];
  const mutations = [];
  const queries = [];
  return {
    reads,
    mutations,
    queries,
    gh(args) {
      mutations.push(args);
      if (args[1] === 'item-add') {
        const url = args[args.indexOf('--url') + 1];
        items.at(-1).push({ id: `ajout-${url}`, content: { __typename: 'Issue', url } });
      }
    },
    ghJson(args, input) {
      if (args[0] === 'project') {
        mutations.push(args);
        if (args[1] === 'create') return created;
        if (args[1] === 'field-create') return { id: 'avancement', name: 'Avancement' };
        assert.fail(`Commande inattendue : ${args.join(' ')}`);
      }
      assert.deepEqual(args, ['api', 'graphql', '--input', '-']);
      const { query, variables } = JSON.parse(input);
      queries.push(query);
      if (query.startsWith('mutation')) {
        mutations.push({ query, variables });
        return {
          data: {
            updateProjectV2: {
              projectV2: { id: variables.input.projectId, title: variables.input.title },
            },
          },
        };
      }
      const resource = query.includes('repositoryOwner')
        ? 'projects'
        : query.includes('items(first:')
          ? 'items'
          : 'fields';
      const { after } = variables;
      reads.push({ resource, after });
      const key = `${resource}:${after}`;
      if (Object.hasOwn(overrides, key)) return overrides[key];
      const pages = connections[resource];
      const index = after === null ? 0 : Number(after.split('-').at(-1));
      assert.ok(index < pages.length, 'Le curseur demandé correspond à une page disponible.');
      const connection = {
        nodes: pages[index],
        totalCount: 9999,
        pageInfo: {
          hasNextPage: index + 1 < pages.length,
          endCursor: index + 1 < pages.length ? `${resource}-${index + 1}` : null,
        },
      };
      return resource === 'projects'
        ? { data: { repositoryOwner: { projectsV2: connection } } }
        : { data: { node: { [resource]: connection } } };
    },
  };
}

test('le préflight des issues conserve les correspondances malgré une première tâche absente', (t) => {
  mute(t);
  const existing = {
    number: 2,
    title: 'T07 | conservée',
    assignees: [{ login: config.pan }],
    state: 'closed',
  };
  const mutations = [];
  const remote = {
    apiList(endpoint) {
      return endpoint.includes('/assignees?')
        ? [{ login: config.pan }, { login: config.salam }]
        : [existing];
    },
    api(endpoint, method, body) {
      mutations.push({ endpoint, method, body });
      return { number: 100, state: 'open', ...body };
    },
  };
  const result = ensureIssues(config, backlog.slice(0, 2), remote);
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].body.title, `T06 | ${backlog[0].title}`);
  assert.deepEqual(
    result.map(({ number }) => number),
    [100, 2],
  );
  assert.equal(result[1], existing);
});

test('un doublon sur une tâche ultérieure arrête les issues avant toute création', (t) => {
  mute(t);
  const mutations = [];
  const remote = {
    apiList(endpoint) {
      return endpoint.includes('/assignees?')
        ? []
        : [
            { number: 2, title: 'T07 | existante' },
            { number: 3, body: '<!-- teranga-task:T07 -->' },
          ];
    },
    api(...args) {
      mutations.push(args);
    },
  };
  assert.throws(() => ensureIssues(config, backlog.slice(0, 2), remote), /Plusieurs issues.*T07/u);
  assert.deepEqual(mutations, []);
});

test('le marqueur canonique reste prioritaire sur le titre renommé d’une issue', (t) => {
  mute(t);
  const existing = {
    number: 2,
    title: 'T07 | titre renommé',
    body: '<!-- teranga-task:T06 -->',
    assignees: [{ login: config.pan }],
    state: 'closed',
  };
  const indexed = indexTaskIssues(backlog.slice(0, 2), [existing]);
  assert.equal(indexed.get('T06'), existing);
  assert.equal(indexed.get('T07'), undefined);
  const mutations = [];
  const remote = {
    apiList(endpoint) {
      return endpoint.includes('/assignees?') ? [{ login: config.pan }] : [existing];
    },
    api(endpoint, method, body) {
      mutations.push({ endpoint, method, body });
      return { number: 100, state: 'open', ...body };
    },
  };
  assert.deepEqual(
    ensureIssues(config, backlog.slice(0, 2), remote).map(({ number }) => number),
    [2, 100],
  );
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].body.title, `T07 | ${backlog[1].title}`);
});

test('plusieurs marqueurs distincts sur une issue bloquent le préflight avant création', (t) => {
  mute(t);
  const remote = {
    apiList(endpoint) {
      return endpoint.includes('/assignees?')
        ? []
        : [
            {
              number: 2,
              body: '<!-- teranga-task:T06 -->\n<!-- teranga-task:T07 -->',
            },
          ];
    },
    api() {
      assert.fail('Le préflight doit arrêter le script avant toute mutation.');
    },
  };
  assert.throws(() => ensureIssues(config, backlog.slice(0, 2), remote), /plusieurs marqueurs/u);
});

test('le Project parcourt toutes les pages et conserve les cartes archivées sur deux relances', (t) => {
  mute(t);
  const remote = projectRemote({
    projects: [[{ ...project, id: 'autre', title: 'Autre tableau' }], [project]],
    items: [[card(1)], [card(2, true)]],
    fields: [[{ id: 'titre', name: 'Title' }], [status]],
  });
  const issues = [1, 2, 3].map((number) => ({ html_url: issueUrl(number) }));
  ensureProject(config, issues, remote);
  assert.deepEqual(remote.reads, [
    { resource: 'projects', after: null },
    { resource: 'projects', after: 'projects-1' },
    { resource: 'items', after: null },
    { resource: 'items', after: 'items-1' },
    { resource: 'fields', after: null },
    { resource: 'fields', after: 'fields-1' },
  ]);
  assert.ok(
    remote.queries.some((query) => query.includes('archivedStates: [ARCHIVED, NOT_ARCHIVED]')),
  );
  assert.deepEqual(
    remote.mutations.map((args) => args[1]),
    ['link', 'item-add'],
  );
  assert.equal(remote.mutations[1].at(-1), issueUrl(3));
  ensureProject(config, issues, remote);
  assert.deepEqual(
    remote.mutations.map((args) => args[1]),
    ['link', 'item-add', 'link'],
  );
});

test('le renommage historique conserve le Project et attend les inventaires complets', (t) => {
  mute(t);
  const remote = projectRemote({
    projects: [[{ ...project, title: project.title.replace(' | ', ' \u2014 ') }]],
  });
  ensureProject(config, [], remote);
  assert.deepEqual(remote.mutations[0].variables, {
    input: { projectId: project.id, title: config.projectTitle },
  });
  assert.equal(remote.mutations[1][1], 'link');
  assert.equal(remote.reads.at(-1).resource, 'fields');
});

test('un Project fermé, public ou ambigu entre deux pages ne provoque aucune écriture', (t) => {
  mute(t);
  for (const candidate of [
    { ...project, closed: true },
    { ...project, public: true },
    { ...project, public: undefined },
  ]) {
    const remote = projectRemote({ projects: [[candidate]] });
    assert.throws(() => ensureProject(config, [], remote), /fermé|privé/u);
    assert.deepEqual(remote.mutations, []);
  }
  const ambiguous = projectRemote({
    projects: [
      [project],
      [{ ...project, id: 'doublon', title: project.title.replace(' | ', ' \u2014 ') }],
    ],
  });
  assert.throws(() => ensureProject(config, [], ambiguous), /Plusieurs Projects/u);
  assert.deepEqual(ambiguous.mutations, []);
});

test('les erreurs, pages incomplètes et cartes masquées interrompent le Project avant écriture', (t) => {
  mute(t);
  const cases = [
    { 'projects:null': { data: { repositoryOwner: null } } },
    {
      'items:null': {
        errors: [{ message: 'Accès refusé' }],
        data: { node: { items: { nodes: [] } } },
      },
    },
    {
      'items:null': {
        data: { node: { items: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } } } },
      },
    },
    {
      'items:null': {
        data: {
          node: {
            items: { nodes: [{ id: 'masquée', content: null }], pageInfo: { hasNextPage: false } },
          },
        },
      },
    },
    { 'fields:null': { data: { node: { fields: { nodes: [] } } } } },
  ];
  for (const overrides of cases) {
    const remote = projectRemote({ overrides });
    assert.throws(
      () => ensureProject(config, [{ html_url: issueUrl(1) }], remote),
      /Inventaire|Accès refusé|inaccessibles/u,
    );
    assert.deepEqual(remote.mutations, []);
  }
});

test('les seules ressources absentes sont créées et un nouveau Project public est refusé', (t) => {
  mute(t);
  const remote = projectRemote({ projects: [[]], fields: [[]] });
  ensureProject(config, [{ html_url: issueUrl(1) }], remote);
  assert.deepEqual(
    remote.mutations.map((args) => args[1]),
    ['create', 'link', 'field-create', 'item-add'],
  );
  const invalid = projectRemote({ projects: [[]], created: { ...project, public: true } });
  assert.throws(() => ensureProject(config, [], invalid), /privé/u);
  assert.deepEqual(
    invalid.mutations.map((args) => args[1]),
    ['create'],
  );
});
