import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set([
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
]);
const errors = [];
const markdown = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const relative = path.relative(root, directory);
  const documentation = relative === '.github' ? 'GUIDE.md' : 'README.md';
  if (!entries.some((entry) => entry.name === documentation && entry.isFile())) {
    errors.push(`${relative || '.'} : ${documentation} manquant`);
  }
  if (relative === '.github' && entries.some((entry) => /^readme(?:\.|$)/i.test(entry.name))) {
    errors.push('.github : un README masque le README du projet sur GitHub ; utiliser GUIDE.md.');
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const target = path.join(directory, entry.name);
    if (
      entry.isDirectory() &&
      !ignored.has(entry.name) &&
      !(relative === '.husky' && entry.name === '_')
    ) {
      await walk(target);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      markdown.push(target);
    }
  }
}

await walk(root);
for (const file of markdown) {
  const contents = await readFile(file, 'utf8');
  for (const match of contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!href || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('/')) continue;
    try {
      await access(path.resolve(path.dirname(file), decodeURIComponent(href)));
    } catch {
      errors.push(`${path.relative(root, file)} : lien introuvable ${href}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.info(
    `Structure vérifiée : documentation des dossiers présente, ${markdown.length} documents aux liens valides.`,
  );
}
