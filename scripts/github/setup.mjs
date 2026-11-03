import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertRepositoryTarget,
  assertReusableProject,
  buildIssueBody,
  collectConnection,
  existingLabel,
  existingNamedResource,
  hasFrenchTrackingOptions,
  indexTaskIssues,
  isMain,
  labelPayload,
  planTaskAssignees,
  readJson,
  root,
  selectTrackingField,
  selectTaskIssues,
  validateBacklog,
  validateConfig,
} from './lib.mjs';

const sections = ['settings', 'labels', 'issues', 'project'];
const projectQuery = `query($owner: String!, $after: String) {
  repositoryOwner(login: $owner) {
    ... on ProjectV2Owner {
      projectsV2(first: 100, after: $after) {
        nodes { id number title url public closed }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;
const itemsQuery = `query($project: ID!, $after: String) {
  node(id: $project) {
    ... on ProjectV2 {
      items(first: 100, after: $after, archivedStates: [ARCHIVED, NOT_ARCHIVED]) {
        nodes {
          id isArchived
          content { __typename ... on Issue { url } ... on PullRequest { url } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;
const fieldsQuery = `query($project: ID!, $after: String) {
  node(id: $project) {
    ... on ProjectV2 {
      fields(first: 100, after: $after) {
        nodes {
          ... on ProjectV2FieldCommon { id name }
          ... on ProjectV2SingleSelectField { options { id name } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

function options(args) {
  const result = { apply: false, section: 'all', config: resolve(root, '.github/repository.json') };
  if (args.includes('--apply') && args.includes('--dry-run')) {
    throw new Error('Choisir --apply ou --dry-run, jamais les deux.');
  }
  for (const arg of args) {
    if (arg === '--apply') result.apply = true;
    else if (arg === '--dry-run') result.apply = false;
    else if (arg.startsWith('--section=')) result.section = arg.slice('--section='.length);
    else if (arg.startsWith('--config=')) result.config = resolve(arg.slice('--config='.length));
    else if (arg === '--help') return null;
    else throw new Error(`Option inconnue : ${arg}`);
  }
  if (![...sections, 'all'].includes(result.section))
    throw new Error(`Section attendue : ${sections.join(', ')} ou all.`);
  return result;
}

function gh(args, input) {
  const result = spawnSync('gh', args, {
    cwd: root,
    encoding: 'utf8',
    input,
    shell: false,
    windowsHide: true,
  });
  if (result.error)
    throw new Error(
      'GitHub CLI (gh) est nécessaire pour --apply. Installer gh puis lancer gh auth login.',
    );
  if (result.status !== 0)
    throw new Error(
      `Échec de gh ${args.slice(0, 3).join(' ')} : ${result.stderr.trim() || 'commande refusée'}`,
    );
  return result.stdout.trim();
}

function ghJson(args, input) {
  const output = gh(args, input);
  return output ? JSON.parse(output) : null;
}

function api(endpoint, method, body) {
  return ghJson(
    ['api', endpoint, '--method', method, ...(body ? ['--input', '-'] : [])],
    body ? JSON.stringify(body) : undefined,
  );
}

function apiList(endpoint) {
  return ghJson(['api', endpoint, '--paginate', '--slurp']).flat();
}

function graphql(query, variables, call) {
  const result = call(['api', 'graphql', '--input', '-'], JSON.stringify({ query, variables }));
  if (result?.errors?.length) {
    throw new Error(result.errors.map(({ message }) => message).join(' | '));
  }
  if (!result?.data) throw new Error('La réponse GraphQL ne contient aucune donnée.');
  return result.data;
}

function ensureSettings(config) {
  const repo = config.repository;
  const info = api(`repos/${repo}`, 'GET');
  assertRepositoryTarget(info, config);
  api(`repos/${repo}/branches/main`, 'GET');
  api(`repos/${repo}`, 'PATCH', {
    allow_squash_merge: true,
    allow_merge_commit: false,
    allow_rebase_merge: false,
    delete_branch_on_merge: true,
    squash_merge_commit_title: 'PR_TITLE',
    squash_merge_commit_message: 'PR_BODY',
  });
  try {
    api(`repos/${repo}`, 'PATCH', {
      security_and_analysis: {
        secret_scanning: { status: 'enabled' },
        secret_scanning_push_protection: { status: 'enabled' },
      },
    });
    console.info('Activation de secret scanning et de la protection au push demandée.');
  } catch (error) {
    console.warn(
      `Analyse des secrets et protection au push non configurées automatiquement : ${error.message}. Vérifier leur disponibilité et leur état dans les réglages du dépôt ; les autres réglages continuent.`,
    );
  }
  const ruleset = readJson('.github/main-ruleset.json');
  const existing = existingNamedResource(
    apiList(`repos/${repo}/rulesets?per_page=100`),
    ruleset.name,
    'name',
    'rulesets',
  );
  api(
    `repos/${repo}/rulesets${existing ? `/${existing.id}` : ''}`,
    existing ? 'PUT' : 'POST',
    ruleset,
  );
  console.info(`Réglages et protection main appliqués : ${repo}`);
}

function ensureLabels(config, labels) {
  const current = apiList(`repos/${config.repository}/labels?per_page=100`);
  for (const label of labels) {
    const existing = existingLabel(current, label.name);
    api(
      `repos/${config.repository}/labels${existing ? `/${encodeURIComponent(existing.name)}` : ''}`,
      existing ? 'PATCH' : 'POST',
      labelPayload(label, Boolean(existing)),
    );
  }
  console.info(`${labels.length} labels synchronisés.`);
}

export function ensureIssues(config, backlog, remote = { apiList, api }) {
  const issues = remote
    .apiList(`repos/${config.repository}/issues?state=all&per_page=100`)
    .filter((issue) => !issue.pull_request);
  const assignableLogins = remote
    .apiList(`repos/${config.repository}/assignees?per_page=100`)
    .map(({ login }) => login);
  const selectedIssues = indexTaskIssues(backlog, issues);
  const pendingAssignees = new Set();
  const result = [];
  for (const task of backlog) {
    let issue = selectedIssues.get(task.id);
    const assignment = planTaskAssignees(
      task,
      config,
      assignableLogins,
      issue?.assignees?.map(({ login }) => login),
    );
    for (const login of assignment.pending) pendingAssignees.add(login);
    if (!issue) {
      issue = remote.api(`repos/${config.repository}/issues`, 'POST', {
        title: `${task.id} | ${task.title}`,
        body: buildIssueBody(task, config),
        labels: task.labels,
        assignees: assignment.assignable,
      });
      console.info(`Créée : ${task.id} → #${issue.number}`);
    } else {
      if (assignment.toAdd.length) {
        issue = remote.api(`repos/${config.repository}/issues/${issue.number}/assignees`, 'POST', {
          assignees: assignment.toAdd,
        });
        console.info(`Assignations ajoutées : ${task.id} → ${assignment.toAdd.join(', ')}`);
      }
      console.info(`Conservée : ${task.id} → #${issue.number} (${issue.state})`);
    }
    result.push(issue);
  }
  if (pendingAssignees.size) {
    console.warn(
      `Assignations en attente pour ${[...pendingAssignees].join(', ')} : les responsabilités restent indiquées dans les issues. Après acceptation des invitations et accès effectif, relancer --apply --section=issues pour ajouter les assignations sans retirer les responsables ajoutés manuellement.`,
    );
  }
  return result;
}

export function ensureProject(config, issues, remote = { gh, ghJson }) {
  const owner = config.repository.split('/')[0];
  const projects = collectConnection(
    (after) => graphql(projectQuery, { owner, after }, remote.ghJson).repositoryOwner?.projectsV2,
    'des Projects',
  );
  const existing = existingNamedResource(projects, config.projectTitle, 'title', 'Projects');
  const project =
    existing ??
    remote.ghJson([
      'project',
      'create',
      '--owner',
      owner,
      '--title',
      config.projectTitle,
      '--format',
      'json',
    ]);
  assertReusableProject(project);
  const items = collectConnection(
    (after) => graphql(itemsQuery, { project: project.id, after }, remote.ghJson).node?.items,
    'des cartes',
  );
  if (items.some((item) => !item.content)) {
    throw new Error(
      `Des cartes sont inaccessibles ; ouvrir ${project.url ?? `le Project n°${project.number} de ${owner}`} et vérifier les permissions ou les cartes supprimées avant de relancer --apply --section=project. Aucune carte n’est supprimée automatiquement.`,
    );
  }
  const fields = collectConnection(
    (after) => graphql(fieldsQuery, { project: project.id, after }, remote.ghJson).node?.fields,
    'des champs',
  );
  if (project.title !== config.projectTitle) {
    const result = graphql(
      'mutation($input: UpdateProjectV2Input!) { updateProjectV2(input: $input) { projectV2 { id title } } }',
      { input: { projectId: project.id, title: config.projectTitle } },
      remote.ghJson,
    );
    const renamed = result.updateProjectV2?.projectV2;
    if (renamed?.id !== project.id || renamed.title !== config.projectTitle) {
      throw new Error('Le renommage du Project existant n’a pas été confirmé.');
    }
  }
  remote.gh([
    'project',
    'link',
    String(project.number),
    '--owner',
    owner,
    '--repo',
    config.repository,
  ]);
  let trackingField = selectTrackingField(fields);
  if (!trackingField) {
    trackingField = remote.ghJson([
      'project',
      'field-create',
      String(project.number),
      '--owner',
      owner,
      '--name',
      'Avancement',
      '--data-type',
      'SINGLE_SELECT',
      '--single-select-options',
      'À faire,En cours,En revue,Terminé',
      '--format',
      'json',
    ]);
  }
  if (trackingField.name === 'Status' && !hasFrenchTrackingOptions(trackingField)) {
    console.warn(
      'Le champ Status existant est conservé. Finaliser ses options À faire, En cours, En revue et Terminé dans GitHub ; aucun second champ de suivi n’est créé.',
    );
  }
  const urls = new Set(items.map((item) => item.content?.url));
  const archivedUrls = new Set(
    items.filter((item) => item.isArchived).map((item) => item.content?.url),
  );
  for (const issue of issues) {
    if (archivedUrls.has(issue.html_url)) {
      console.warn(
        `Carte archivée conservée pour ${issue.html_url} ; la restaurer dans les archives du Project si elle doit revenir sur le tableau.`,
      );
    }
    if (!urls.has(issue.html_url)) {
      remote.gh([
        'project',
        'item-add',
        String(project.number),
        '--owner',
        owner,
        '--url',
        issue.html_url,
      ]);
      urls.add(issue.html_url);
    }
  }
  console.info(
    `Project ${project.url ?? project.number} préparé. Dans l’interface, choisir Board et grouper par ${trackingField.name} ; initialiser seulement les nouvelles cartes et conserver l’état des cartes existantes.`,
  );
}

export function runSetup(args = process.argv.slice(2)) {
  const opts = options(args);
  if (!opts) {
    console.info(
      'node scripts/github/setup.mjs [--dry-run|--apply] [--section=all|settings|labels|issues|project] [--config=chemin.json]',
    );
  } else {
    const config = validateConfig(JSON.parse(readFileSync(opts.config, 'utf8')));
    const labels = readJson('.github/labels.json');
    const backlog = readJson('scripts/github/backlog.json');
    validateBacklog(backlog, labels);
    const selected = opts.section === 'all' ? sections : [opts.section];
    console.info(
      `${opts.apply ? 'APPLICATION' : 'PRÉVISUALISATION LOCALE'} | ${config.repository} (visibilité attendue : ${config.visibility})`,
    );
    console.info(`Sections : ${selected.join(', ')} ; PAN @${config.pan} ; Salam @${config.salam}`);
    if (!opts.apply) {
      if (selected.includes('settings'))
        console.info(
          'Prévu : squash seul, suppression des branches fusionnées, protection main avec 1 approbation et 6 contrôles ; tentative d’activation de l’analyse des secrets selon la disponibilité du dépôt. La visibilité ne sera pas modifiée.',
        );
      if (selected.includes('labels'))
        console.info(`Prévu : synchroniser ${labels.length} labels sans supprimer les autres.`);
      if (selected.includes('issues')) {
        console.info(
          `Prévu : créer les ${backlog.length} tâches absentes T06 à T40 et conserver les issues déjà présentes.`,
        );
        for (const task of backlog)
          console.info(`${task.id} | ${task.due} | ${task.responsible} | ${task.title}`);
      }
      if (selected.includes('project'))
        console.info(
          `Prévu : retrouver « ${config.projectTitle} » ou le créer s’il est absent ; réutiliser le champ Avancement ou Status existant, créer Avancement seulement si aucun des deux n’existe, ajouter les issues absentes. Vue Board et nouvelles cartes à finaliser dans GitHub.`,
        );
      console.info(
        'Aucun appel réseau et aucune modification. L’existence du dépôt, les permissions et les doublons distants ne sont pas vérifiés dans ce mode.',
      );
    } else {
      gh(['auth', 'status']);
      if (selected.includes('settings')) ensureSettings(config);
      if (selected.includes('labels')) ensureLabels(config, labels);
      let issues;
      if (selected.includes('issues')) issues = ensureIssues(config, backlog);
      if (selected.includes('project')) {
        issues ??= selectTaskIssues(
          backlog,
          apiList(`repos/${config.repository}/issues?state=all&per_page=100`),
        );
        ensureProject(config, issues);
      }
      console.info(
        'Sections demandées appliquées. Relire les réglages et vérifier une PR de test avant de clôturer T02 à T07.',
      );
    }
  }
}

if (isMain(import.meta.url)) {
  try {
    runSetup();
  } catch (error) {
    console.error(error.message);
    console.error(
      'Arrêt : des étapes précédentes peuvent déjà avoir été appliquées. Corriger puis relancer ; les issues existantes sont conservées.',
    );
    process.exitCode = 1;
  }
}
