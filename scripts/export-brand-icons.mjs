import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { isMain } from './github/lib.mjs';

export function exportBrandIcons(directory = new URL('../assets/brand/icons/', import.meta.url)) {
  const source = JSON.parse(readFileSync(new URL('paths.json', directory), 'utf8'));
  for (const [name, paths] of Object.entries(source.icons)) {
    if (!/^[a-z]+$/u.test(name)) throw new Error('Nom de pictogramme invalide.');
    const body = paths.map((path) => `<path d="${path}"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${source.viewBox}" role="img"><title>Teranga Pay | ${name}</title><g fill="none" stroke="currentColor" stroke-width="${source.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`;
    writeFileSync(new URL(`${name}.svg`, directory), svg);
  }
  return Object.keys(source.icons).length;
}

if (isMain(import.meta.url)) {
  const count = exportBrandIcons();
  console.info(
    `${count} icônes exportées dans ${fileURLToPath(new URL('../assets/brand/icons/', import.meta.url))}`,
  );
}
