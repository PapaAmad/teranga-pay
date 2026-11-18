import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';
import { releaseNotes, signerDigest } from './release-notes.mjs';

const digest = 'ab'.repeat(32);
const apksignerOutput = `Signer #1 certificate DN: CN=Teranga Demo
Signer #1 certificate SHA-256 digest: ${digest.toUpperCase()}
Signer #1 certificate SHA-1 digest: 0000000000000000000000000000000000000000
`;

describe('consignes de Release', () => {
  it('lit l’empreinte SHA-256 du certificat', () => {
    assert.equal(signerDigest(apksignerOutput), digest);
  });

  it('refuse un APK sans signature', () => {
    assert.throws(() => signerDigest('DOES NOT VERIFY'), /introuvable/u);
  });

  it('affiche somme, certificat et avertissement regtest', () => {
    const notes = releaseNotes({
      apkName: 'teranga-pay-v1.0.0.apk',
      sha256: 'cd'.repeat(32),
      certificateSha256: digest,
    });
    assert.match(notes, /regtest/u);
    assert.match(notes, /simulé/u);
    assert.ok(notes.includes('cd'.repeat(32)));
    assert.ok(notes.includes(digest));
    assert.match(notes, /sha256sum -c teranga-pay-v1\.0\.0\.apk\.sha256/u);
  });

  it('refuse une somme mal formée', () => {
    assert.throws(
      () => releaseNotes({ apkName: 'a.apk', sha256: 'xyz', certificateSha256: digest }),
      /invalide/u,
    );
  });

  it('calcule la vraie somme du fichier en ligne de commande', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'teranga-release-'));
    const apk = join(dir, 'teranga-pay-v0.0.1.apk');
    const signature = join(dir, 'signature.txt');
    await writeFile(apk, 'contenu de test');
    await writeFile(signature, apksignerOutput);
    const { stdout } = await promisify(execFile)(process.execPath, [
      fileURLToPath(new URL('./release-notes.mjs', import.meta.url)),
      apk,
      signature,
    ]);
    const expected = createHash('sha256').update('contenu de test').digest('hex');
    assert.ok(stdout.includes(expected));
  });
});
