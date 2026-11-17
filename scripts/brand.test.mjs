import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildContrastReport,
  contrastPairs,
  contrastRatio,
  relativeLuminance,
} from './brand-colors.mjs';

const tokens = JSON.parse(readFileSync(new URL('../assets/brand/tokens.json', import.meta.url)));
const iconSource = JSON.parse(
  readFileSync(new URL('../assets/brand/icons/paths.json', import.meta.url)),
);

test('le calcul respecte les bornes sRGB connues et reste symétrique', () => {
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(relativeLuminance('#FFFFFF'), 1);
  assert.equal(relativeLuminance('#FF0000'), 0.2126);
  assert.equal(relativeLuminance('#00FF00'), 0.7152);
  assert.equal(relativeLuminance('#0000FF'), 0.0722);
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(contrastRatio('#FFFFFF', '#000000'), 21);
  assert.equal(contrastRatio('#255ba6', '#255BA6'), 1);
  assert.equal(contrastRatio('#123456', '#ABCDEF'), contrastRatio('#ABCDEF', '#123456'));
});

test('les seuils ne sont pas arrondis pour faire passer une paire insuffisante', () => {
  assert.ok(contrastRatio('#767676', '#FFFFFF') >= 4.5);
  assert.ok(contrastRatio('#777777', '#FFFFFF') < 4.5);
  assert.ok(contrastRatio('#949494', '#FFFFFF') >= 3);
  assert.ok(contrastRatio('#959595', '#FFFFFF') < 3);
});

test('une couleur absente, invalide ou transparente est refusée au lieu de produire un ratio', () => {
  for (const color of [undefined, null, 'red', '#fff', '#GGGGGG', '#12345600']) {
    assert.throws(() => contrastRatio(color, '#FFFFFF'), /#RRGGBB/u);
  }
  const incomplete = structuredClone(tokens);
  delete incomplete.colors.selectionSurface;
  assert.throws(() => buildContrastReport(incomplete), /#RRGGBB/u);
});

test('les SVG livrés partagent les tracés du rendu natif et sa grille', () => {
  for (const [name, paths] of Object.entries(iconSource.icons)) {
    const svg = readFileSync(new URL(`../assets/brand/icons/${name}.svg`, import.meta.url), 'utf8');
    assert.ok(svg.includes(`viewBox="${iconSource.viewBox}"`), name);
    assert.deepEqual(
      [...svg.matchAll(/<path d="([^"]+)"/gu)].map((match) => match[1]),
      paths,
      name,
    );
  }
});

test('le symbole SVG conserve le monogramme et la couleur de la direction native retenue', () => {
  const mark = JSON.parse(
    readFileSync(new URL('../assets/brand/logos/mark.json', import.meta.url)),
  );
  const svg = readFileSync(new URL('../assets/brand/logos/symbole.svg', import.meta.url), 'utf8');
  assert.equal(svg.match(/<path[^>]*\bd="([^"]+)"/u)?.[1], mark.path);
  assert.ok(svg.includes(`fill="${tokens.colors.primary}"`));
});

test('les couples de texte de la charte gardent au moins 4,5:1', () => {
  const pairs = contrastPairs.filter((pair) => pair.kind === 'text');
  assert.equal(pairs.length, 12);
  for (const { foreground, background, minimum } of pairs) {
    assert.equal(minimum, 4.5);
    assert.ok(
      contrastRatio(tokens.colors[foreground], tokens.colors[background]) >= minimum,
      `${foreground}/${background} doit rester lisible.`,
    );
  }
});

test('les indices fonctionnels se détachent des surfaces avec au moins 3:1', () => {
  const pairs = contrastPairs.filter((pair) => pair.kind === 'graphic');
  assert.equal(pairs.length, 6);
  for (const { foreground, background, minimum } of pairs) {
    assert.equal(minimum, 3);
    assert.ok(
      contrastRatio(tokens.colors[foreground], tokens.colors[background]) >= minimum,
      `${foreground}/${background} doit identifier le contrôle.`,
    );
  }
  assert.ok(
    contrastRatio(tokens.colors.onAccent, tokens.colors.accent) >
      contrastRatio('#FFFFFF', tokens.colors.accent),
    'Le texte sombre est requis sur l’accent citron.',
  );
});

test('le rapport livré reste à jour avec les couleurs réelles des tokens et les 18 couples', () => {
  const delivered = JSON.parse(
    readFileSync(new URL('../assets/brand/contrast.json', import.meta.url), 'utf8'),
  );
  const expected = buildContrastReport(tokens);
  assert.equal(expected.pairs.length, 18);
  assert.deepEqual(delivered, expected, 'Régénérer avec node scripts/export-brand-contrast.mjs.');
  const modified = structuredClone(tokens);
  modified.colors.primary = '#FFFFFF';
  const changed = buildContrastReport(modified);
  assert.notDeepEqual(delivered, changed);
  assert.equal(
    changed.pairs.find((pair) => pair.foreground === 'onPrimary' && pair.background === 'primary')
      .passes,
    false,
  );
});

test('le relevé du document correspond au HTML livré', () => {
  const source = readFileSync(new URL('../assets/brand/exploration.html', import.meta.url));
  const proof = JSON.parse(
    readFileSync(new URL('../assets/brand/exports/validation.json', import.meta.url)),
  );
  assert.equal(
    proof.documentSha256,
    createHash('sha256').update(source).digest('hex'),
    'Le document a changé : régénérer les exports et leur relevé avec brand:document.',
  );
});

test('les trois polices et les deux licences correspondent aux fichiers livrés du manifeste', () => {
  const directory = new URL('../assets/brand/fonts/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('sources.json', directory), 'utf8'));
  assert.deepEqual(manifest.files.map(({ file }) => file).sort(), [
    'Manrope-Bold.ttf',
    'NotoSans-Regular.ttf',
    'NotoSans-SemiBold.ttf',
    'OFL-Manrope.txt',
    'OFL-NotoSans.txt',
  ]);
  for (const { file, bytes, sha256 } of manifest.files) {
    const contents = readFileSync(new URL(file, directory));
    assert.equal(contents.length, bytes, `${file} : taille différente du manifeste.`);
    assert.equal(
      createHash('sha256').update(contents).digest('hex'),
      sha256,
      `${file} : les octets diffèrent du manifeste, sans normalisation autorisée.`,
    );
  }
});
