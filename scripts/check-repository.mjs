import { spawn } from 'node:child_process';
import { readdir, readFile, access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { root as defaultRoot } from './github/lib.mjs';

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

function readDelimited(contents, start, opening, closing) {
  let depth = 1;
  let cursor = start + 1;
  for (; cursor < contents.length; cursor += 1) {
    if (contents[cursor] === '\\') {
      cursor += 1;
    } else if (contents[cursor] === closing) {
      depth -= 1;
      if (!depth) return cursor;
    } else if (opening !== closing && contents[cursor] === opening) {
      depth += 1;
    }
  }
  return -1;
}

function markdownDestinations(contents) {
  let fence;
  contents = contents
    .split(/\r?\n/u)
    .map((line) => {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
      if (fence) {
        if (
          marker &&
          marker[1][0] === fence.character &&
          marker[1].length >= fence.length &&
          !marker[2].trim()
        )
          fence = undefined;
        return '';
      }
      if (marker) {
        fence = { character: marker[1][0], length: marker[1].length };
        return '';
      }
      return line;
    })
    .join('\n')
    .replace(/(`+)(?!`)[\s\S]*?\1(?!`)/gu, '');
  const destinations = [];
  for (const match of contents.matchAll(/\]\(\s*/g)) {
    const start = match.index + match[0].length;
    let cursor = start;
    let href;
    if (contents[cursor] === '<') {
      const end = readDelimited(contents, cursor, '<', '>');
      if (end < 0) continue;
      href = contents.slice(cursor + 1, end);
      cursor = end + 1;
    } else {
      let depth = 0;
      for (; cursor < contents.length; cursor += 1) {
        const character = contents[cursor];
        if (character === '\\') cursor += 1;
        else if (character === '(') depth += 1;
        else if (character === ')') {
          if (!depth) break;
          depth -= 1;
        } else if (/\s/.test(character) && !depth) break;
      }
      if (depth) continue;
      href = contents.slice(start, cursor);
    }
    while (/\s/.test(contents[cursor] ?? '') && cursor < contents.length) cursor += 1;
    if (['"', "'", '('].includes(contents[cursor])) {
      const opening = contents[cursor];
      const end = readDelimited(contents, cursor, opening, opening === '(' ? ')' : opening);
      if (end < 0) continue;
      cursor = end + 1;
      while (/\s/.test(contents[cursor] ?? '') && cursor < contents.length) cursor += 1;
    }
    if (contents[cursor] === ')') {
      destinations.push(href.replace(/\\([\\()[\]<>])/g, '$1'));
    }
  }
  return destinations;
}

export async function checkRepository(root) {
  root = path.resolve(root);
  const errors = [];
  const markdown = [];
  const warnings = [];
  const inventory = await git(root, [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
    '--',
    '.',
  ]);
  const useGit = inventory.code === 0;
  const included = new Set(inventory.stdout.split('\0').filter(Boolean));
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
          const relative = path
            .relative(root, path.join(directory, entry.name))
            .split(path.sep)
            .join('/');
          return useGit
            ? included.has(relative) || parents.has(relative)
            : !fallbackIgnored.has(entry.name);
        }),
      })),
    );
    const candidates = directories.flatMap(({ directory, entries }) =>
      entries
        .filter((entry) => entry.name !== '.git')
        .map((entry) => ({
          directory,
          entry,
          target: path.join(directory, entry.name),
          relative: path.relative(root, path.join(directory, entry.name)).split(path.sep).join('/'),
        })),
    );
    pending = [];
    for (const { directory, entries } of directories) {
      const relative = path.relative(root, directory).split(path.sep).join('/');
      const github = relative === '.github' || relative.startsWith('.github/');
      const documentation =
        relative === '.github/ISSUE_TEMPLATE' ? 'GUIDE.txt' : github ? 'GUIDE.md' : 'README.md';
      const docEntry = entries.find((entry) => entry.name === documentation);
      const hasDocumentation =
        docEntry?.isFile() ||
        (docEntry?.isSymbolicLink() &&
          (await stat(path.join(directory, documentation)).catch(() => null))?.isFile());
      if (!hasDocumentation) errors.push(`${relative || '.'} : ${documentation} manquant`);
      if (github && entries.some((entry) => /^readme(?:\.|$)/i.test(entry.name))) {
        errors.push(
          `${relative} : utiliser ${documentation} ; un README dans .github peut masquer le projet ou devenir un modèle GitHub.`,
        );
      }
    }
    for (const { directory, entry, target } of candidates) {
      if (path.relative(root, directory) === '.husky' && entry.name === '_') continue;
      if (entry.isDirectory()) pending.push(target);
      else if (
        entry.name.endsWith('.md') &&
        (entry.isFile() ||
          (entry.isSymbolicLink() && (await stat(target).catch(() => null))?.isFile()))
      )
        markdown.push(target);
    }
  }
  for (const file of markdown) {
    const contents = await readFile(file, 'utf8');
    for (const destination of markdownDestinations(contents)) {
      const href = destination.split('#')[0];
      if (!href || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('/')) continue;
      try {
        await access(path.resolve(path.dirname(file), decodeURIComponent(href)));
      } catch {
        errors.push(`${path.relative(root, file)} : lien introuvable ${href}`);
      }
    }
  }
  return { errors, warnings, markdownCount: markdown.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
