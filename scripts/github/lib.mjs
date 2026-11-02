import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const NO_REVIEWER = null;
const DEFAULT_VISIBILITY = 'private';
const titleSeparators = ['|', '\u2014'];

export function normalizeDisplayName(value) {
  if (typeof value !== 'string') return undefined;
  return titleSeparators.reduce(
    (name, separator) => name.replaceAll(` ${separator} `, ' | '),
    value,
  );
}

export function existingNamedResource(resources, expectedName, field, kind) {
  if (typeof expectedName !== 'string' || !expectedName.trim())
    throw new Error(`Nom attendu invalide pour ${kind}.`);
  const expected = normalizeDisplayName(expectedName);
  const matches = resources.filter(
    (resource) => normalizeDisplayName(resource[field]) === expected,
  );
  if (matches.length > 1) {
    throw new Error(`Plusieurs ${kind} correspondent à « ${expectedName} » ; résoudre le doublon.`);
  }
  return matches[0];
}

export function assertCompleteInventory(inventory, field, kind) {
  const values = inventory[field];
  if (
    !Array.isArray(values) ||
    !Number.isInteger(inventory.totalCount) ||
    inventory.totalCount !== values.length
  ) {
    throw new Error(
      `Inventaire ${kind} incomplet ; compléter la pagination avant toute modification.`,
    );
  }
  return values;
}

export function assertReusableProject(project) {
  if (!project) return;
  if (project.closed) throw new Error('Le Project existant est fermé ; le rouvrir explicitement.');
  if (project.public !== false)
    throw new Error(
      'Le Project doit être privé ; corriger sa visibilité avant toute modification.',
    );
}

export function existingLabel(labels, name) {
  const matches = labels.filter((label) => label.name.toLowerCase() === name.toLowerCase());
  if (matches.length > 1) throw new Error(`Plusieurs labels correspondent à « ${name} ».`);
  return matches[0];
}

export function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));
}

export function validateConfig(config) {
  const login = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/iu;
  const repository = /^([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)\/[a-z\d._-]+$/iu;
  if (!config || typeof config.repository !== 'string' || !repository.test(config.repository)) {
    throw new Error('repository doit avoir le format propriétaire/dépôt.');
  }
  if (
    typeof config.pan !== 'string' ||
    typeof config.salam !== 'string' ||
    !login.test(config.pan) ||
    !login.test(config.salam)
  ) {
    throw new Error('Les pseudos GitHub de PAN et Salam sont nécessaires.');
  }
  if (config.pan.toLowerCase() === config.salam.toLowerCase()) {
    throw new Error('PAN et Salam doivent être deux comptes distincts.');
  }
  if (typeof config.projectTitle !== 'string' || !config.projectTitle.trim()) {
    throw new Error('projectTitle est nécessaire.');
  }
  const visibility = config.visibility === undefined ? DEFAULT_VISIBILITY : config.visibility;
  if (!['private', 'public'].includes(visibility)) {
    throw new Error('visibility doit être private ou public.');
  }
  return { ...config, visibility };
}

export function assertRepositoryTarget(info, config) {
  const expectedVisibility = config.visibility ?? DEFAULT_VISIBILITY;
  if (info.default_branch !== 'main') {
    throw new Error(
      'Le dépôt doit avoir main comme branche par défaut. Suivre le bootstrap documenté.',
    );
  }
  if (info.private !== (expectedVisibility === 'private')) {
    throw new Error(
      `Visibilité inattendue : ${expectedVisibility} attendu. Aucun changement automatique de visibilité n’est effectué.`,
    );
  }
}

export function validateBacklog(backlog, labels) {
  if (!Array.isArray(backlog) || backlog.length !== 35) {
    throw new Error('Le backlog doit contenir les 35 tâches T06 à T40.');
  }
  const availableLabels = new Set(labels.map(({ name }) => name));
  const ids = new Set(backlog.map(({ id }) => id));
  if (ids.size !== 35) throw new Error('Identifiants de tâches en double.');
  for (let n = 6; n <= 40; n += 1) {
    const id = `T${String(n).padStart(2, '0')}`;
    const task = backlog.find((entry) => entry.id === id);
    if (!task) throw new Error(`Tâche absente : ${id}`);
    if (!['PAN', 'Salam', 'Les deux'].includes(task.responsible)) {
      throw new Error(`Responsable incorrect : ${id}`);
    }
    if (!['PAN', 'Salam', NO_REVIEWER].includes(task.reviewer)) {
      throw new Error(`Relecteur incorrect : ${id}`);
    }
    const expectedReviewer =
      task.responsible === 'Les deux' ? NO_REVIEWER : task.responsible === 'PAN' ? 'Salam' : 'PAN';
    if (task.reviewer !== expectedReviewer) {
      throw new Error(`La relecture doit être croisée : ${id}`);
    }
    if (
      typeof task.due !== 'string' ||
      !/^2026-11-(0[1-9]|1\d|20)$/u.test(task.due) ||
      !['S', 'M', 'L'].includes(task.size)
    ) {
      throw new Error(`Date ou taille incorrecte : ${id}`);
    }
    if (!Number.isInteger(task.phase) || task.phase < 0 || task.phase > 4) {
      throw new Error(`Phase incorrecte : ${id}`);
    }
    if (
      typeof task.title !== 'string' ||
      !task.title.trim() ||
      !Array.isArray(task.acceptance) ||
      task.acceptance.length < 1 ||
      task.acceptance.some((criterion) => typeof criterion !== 'string' || !criterion.trim())
    ) {
      throw new Error(`Objectif ou critères manquants : ${id}`);
    }
    if (
      !Array.isArray(task.labels) ||
      task.labels.length < 1 ||
      task.labels.some((label) => !availableLabels.has(label))
    ) {
      throw new Error(`Label inconnu : ${id}`);
    }
    if (
      !Array.isArray(task.dependsOn) ||
      task.dependsOn.some((dependency) => !ids.has(dependency) || dependency === id)
    ) {
      throw new Error(`Dépendance inconnue ou autoréférence : ${id}`);
    }
  }
  const visited = new Set();
  const active = new Set();
  function visit(task) {
    if (active.has(task.id)) throw new Error(`Cycle de dépendances : ${task.id}`);
    if (visited.has(task.id)) return;
    active.add(task.id);
    for (const dependency of task.dependsOn) visit(backlog.find(({ id }) => id === dependency));
    active.delete(task.id);
    visited.add(task.id);
  }
  for (const task of backlog) visit(task);
}

export function taskAssignees(task, config) {
  if (task.responsible === 'Les deux') return [config.pan, config.salam];
  return [task.responsible === 'PAN' ? config.pan : config.salam];
}

export function labelPayload(label, exists) {
  const { name, color, description } = label;
  return exists ? { new_name: name, color, description } : { name, color, description };
}

export function planTaskAssignees(task, config, assignableLogins, currentLogins = []) {
  const expected = taskAssignees(task, config);
  const available = new Set(assignableLogins.map((login) => login.toLowerCase()));
  const current = new Set(currentLogins.map((login) => login.toLowerCase()));
  const assignable = expected.filter((login) => available.has(login.toLowerCase()));
  return {
    assignable,
    pending: expected.filter((login) => !available.has(login.toLowerCase())),
    toAdd: assignable.filter((login) => !current.has(login.toLowerCase())),
  };
}

export function selectTrackingField(fields) {
  return (
    fields.find(({ name }) => name === 'Avancement') ?? fields.find(({ name }) => name === 'Status')
  );
}

export function hasFrenchTrackingOptions(field) {
  const names = new Set(field.options?.map(({ name }) => name) ?? []);
  return ['À faire', 'En cours', 'En revue', 'Terminé'].every((name) => names.has(name));
}

export function buildIssueBody(task, config) {
  const reviewer =
    task.reviewer === NO_REVIEWER
      ? 'validation commune'
      : `@${task.reviewer === 'PAN' ? config.pan : config.salam}`;
  return [
    `<!-- teranga-task:${task.id} -->`,
    '## En clair',
    '',
    task.title,
    '',
    `- Responsable : ${taskAssignees(task, config)
      .map((login) => `@${login}`)
      .join(', ')}`,
    `- Relecture : ${reviewer}`,
    `- Échéance : ${task.due} (Africa/Dakar)`,
    `- Taille : ${task.size} ; phase : ${task.phase}`,
    '',
    '## Critères d’acceptation',
    '',
    ...task.acceptance.map((criterion) => `- [ ] ${criterion}`),
    '- [ ] Format, lint, types et tests passent ; relecture humaine obtenue.',
    '- [ ] Documentation à jour et aucun secret ni donnée personnelle.',
    '',
    '## Dépendances',
    '',
    task.dependsOn.length ? task.dependsOn.join(', ') : 'Aucune dépendance bloquante identifiée.',
    '',
    'Source : plan d’équipe v1.0 du 1er novembre 2026. Les critères détaillent la tâche ; ils restent à valider pendant la relecture.',
    '',
  ].join('\n');
}

export function existingTaskIssue(task, issues) {
  const matches = issues.filter(
    (issue) =>
      issue.body?.includes(`<!-- teranga-task:${task.id} -->`) ||
      normalizeDisplayName(issue.title)?.startsWith(`${task.id} | `),
  );
  if (matches.length > 1)
    throw new Error(
      `Plusieurs issues correspondent à ${task.id} : résoudre le doublon avant de continuer.`,
    );
  return matches[0];
}

export function selectTaskIssues(backlog, issues) {
  const candidates = issues.filter((issue) => !issue.pull_request);
  return backlog.map((task) => existingTaskIssue(task, candidates)).filter(Boolean);
}
