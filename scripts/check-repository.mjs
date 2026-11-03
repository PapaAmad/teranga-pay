import { spawn } from 'node:child_process';
import { readdir, readFile, access, stat } from 'node:fs/promises';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { isMain, root as defaultRoot } from './github/lib.mjs';

const fallbackIgnored = new Set([
  '.git',
  'node_modules',
  '.tmp',
  '.npm-cache',
  '.cache',
  '.expo',
  'coverage',
  'dist',
  'build',
  'android',
  'ios',
  '.idea',
  '.vscode',
]);
const markdownExtensions = new Set(['md', 'mkd', 'mkdn', 'mdwn', 'mdown', 'markdown']);
// Formats pris en charge par github/markup, avec les README texte brut.
const documentaryExtensions = new Set([
  ...markdownExtensions,
  'txt',
  'mdx',
  'litcoffee',
  'textile',
  'rdoc',
  'org',
  'creole',
  'mediawiki',
  'wiki',
  'rst',
  'rst.txt',
  'rest',
  'rest.txt',
  'asciidoc',
  'adoc',
  'asc',
  'pod',
  'pod6',
]);

function isDocumentaryReadme(name) {
  const match = name.match(/^readme(?:\.(.+))?$/iu);
  return Boolean(match && (!match[1] || documentaryExtensions.has(match[1].toLowerCase())));
}

function git(root, args, input = '') {
  return new Promise((resolve) => {
    const child = spawn('git', ['-C', root, ...args], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => resolve({ code: null, stdout, stderr: error.message }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

const markdownParser = new MarkdownIt({ html: true });

function markdownDestinations(contents) {
  const destinations = [];
  function visit(tokens) {
    for (const token of tokens) {
      if (token.type === 'image') {
        destinations.push(token.attrGet('src'));
      } else {
        if (token.type === 'link_open') destinations.push(token.attrGet('href'));
        if (token.children) visit(token.children);
      }
    }
  }
  visit(markdownParser.parse(contents, {}));
  return destinations;
}

function repositoryPath(root, target) {
  return path.relative(root, target).split(path.sep).join('/').normalize('NFC');
}

async function isFileLike(entry, target) {
  return Boolean(
    entry?.isFile() ||
    (entry?.isSymbolicLink() && (await stat(target).catch(() => null))?.isFile()),
  );
}

export async function checkRepository(root, { git: runGit = git } = {}) {
  root = path.resolve(root);
  const errors = [];
  const markdown = [];
  const warnings = [];
  const [inventory, index] = await Promise.all([
    runGit(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '.']),
    runGit(root, ['ls-files', '--stage', '-z', '--', '.']),
  ]);
  const useGit = inventory.code === 0 && index.code === 0;
  const included = new Set(
    inventory.stdout
      .split('\0')
      .filter(Boolean)
      .map((file) => file.normalize('NFC')),
  );
  const gitlinks = new Set(
    index.stdout.split('\0').flatMap((entry) => {
      const match = entry.match(/^160000 [\da-f]+ [0-3]\t([\s\S]+)$/u);
      return match ? [match[1].normalize('NFC')] : [];
    }),
  );
  const parents = new Set();
  if (useGit) {
    for (const file of included) {
      let directory = path.posix.dirname(file);
      while (directory !== '.') {
        parents.add(directory);
        directory = path.posix.dirname(directory);
      }
    }
  }
  if (!useGit)
    warnings.push('Git indisponible : seules les exclusions locales prédéfinies sont utilisées.');
  let pending = [root];
  while (pending.length) {
    const directories = await Promise.all(
      pending.map(async (directory) => ({
        directory,
        entries: (await readdir(directory, { withFileTypes: true })).filter((entry) => {
          if (entry.name === '.git') return false;
          const relative = repositoryPath(root, path.join(directory, entry.name));
          return useGit
            ? included.has(relative) || parents.has(relative)
            : !fallbackIgnored.has(entry.name);
        }),
      })),
    );
    pending = [];
    for (const { directory, entries } of directories) {
      const relative = repositoryPath(root, directory);
      const github = relative === '.github' || relative.startsWith('.github/');
      const documentation =
        relative === '.github/ISSUE_TEMPLATE' ? 'GUIDE.txt' : github ? 'GUIDE.md' : 'README.md';
      const docEntry = entries.find((entry) => entry.name === documentation);
      const hasDocumentation = await isFileLike(docEntry, path.join(directory, documentation));
      if (!hasDocumentation) errors.push(`${relative || '.'} : ${documentation} manquant`);
      if (github && entries.some((entry) => isDocumentaryReadme(entry.name))) {
        errors.push(
          `${relative} : utiliser ${documentation} ; un README dans .github peut masquer le projet ou devenir un modèle GitHub.`,
        );
      }
      for (const entry of entries) {
        const target = path.join(directory, entry.name);
        if (relative === '.husky' && entry.name === '_') continue;
        if (useGit && gitlinks.has(repositoryPath(root, target))) continue;
        if (entry.isDirectory()) pending.push(target);
        else if (
          markdownExtensions.has(path.extname(entry.name).slice(1).toLowerCase()) &&
          (await isFileLike(entry, target))
        )
          markdown.push(target);
      }
    }
  }
  for (const file of markdown) {
    const contents = await readFile(file, 'utf8');
    for (const destination of markdownDestinations(contents)) {
      const href = destination.split('#')[0];
      if (!href || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('/')) continue;
      let localPath;
      try {
        localPath = decodeURIComponent(href);
      } catch {
        errors.push(`${path.relative(root, file)} : encodage de lien invalide ${href}`);
        continue;
      }
      try {
        await access(path.resolve(path.dirname(file), localPath));
      } catch {
        errors.push(`${path.relative(root, file)} : lien introuvable ${localPath}`);
      }
    }
  }
  return { errors, warnings, markdownCount: markdown.length };
}

if (isMain(import.meta.url)) {
  const result = await checkRepository(defaultRoot);
  for (const warning of result.warnings) console.warn(warning);
  if (result.errors.length) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.info(
      `Structure vérifiée : documentation des dossiers présente, ${result.markdownCount} documents aux liens valides.`,
    );
  }
}
