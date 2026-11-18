import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const directory = new URL('../assets/operators/', import.meta.url);
test('les logos livrés conservent les fichiers et empreintes de leur provenance', () => {
  const sources = JSON.parse(readFileSync(new URL('sources.json', directory), 'utf8'));
  assert.equal(sources.assets.length, 2);
  for (const asset of sources.assets) {
    assert.match(
      new URL(asset.url).hostname,
      /(^|\.)(wave\.com|orange\.sn|orange\.ci|upload\.wikimedia\.org)$/,
    );
    assert.equal(
      createHash('sha256')
        .update(readFileSync(new URL(asset.file, directory)))
        .digest('hex'),
      asset.sha256,
    );
  }
});
test('le SVG natif Orange Money reprend les octets du fichier et sa variante orange', () => {
  const artwork = JSON.parse(readFileSync(new URL('artwork.json', directory), 'utf8'));
  const svg = readFileSync(new URL('orange-money.svg', directory), 'utf8');
  assert.equal(artwork.orangeMoneySvg, svg);
  assert.match(svg, /fill:#ff7900/);
  assert.match(svg, /viewBox="0 0 431 115"/);
  assert.doesNotMatch(svg, /<script|<image|href=/i);
});
