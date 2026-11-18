import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

/** Empreinte SHA-256 du certificat de signature, lue dans la sortie d'`apksigner --print-certs`. */
export function signerDigest(apksignerOutput) {
  const match = /certificate SHA-256 digest:\s*([0-9a-f]{64})/iu.exec(apksignerOutput);
  if (!match) throw new Error('Empreinte du certificat introuvable : APK non signé ?');
  return match[1].toLowerCase();
}

/** Consignes d'installation et de vérification publiées avec chaque Release (T35). */
export function releaseNotes({ apkName, sha256, certificateSha256 }) {
  if (!/^[0-9a-f]{64}$/u.test(sha256)) throw new Error('Somme SHA-256 invalide');
  return `## ⚠️ Démonstration uniquement

Cet APK fonctionne sur le **réseau de test regtest** : aucun vrai bitcoin, aucun vrai franc CFA. Le retrait Wave / Orange Money est **simulé**. N'y mettez jamais de vrais fonds ni votre vraie phrase secrète.

## Vérifier avant d'installer

Ne l'installez que s'il vient de cette page. Une copie reçue par WhatsApp peut avoir été modifiée.

1. Somme de contrôle de \`${apkName}\` :

   \`\`\`
   ${sha256}
   \`\`\`

   - Linux : \`sha256sum -c ${apkName}.sha256\`
   - macOS : \`shasum -a 256 ${apkName}\`
   - Windows (PowerShell) : \`Get-FileHash ${apkName} -Algorithm SHA256\`

2. Certificat de signature (SHA-256), identique d'une version à l'autre :

   \`\`\`
   ${certificateSha256}
   \`\`\`

   Vérification : \`apksigner verify --print-certs ${apkName}\`

## Installer

1. Télécharger l'APK sur un téléphone Android 7 ou plus récent.
2. Autoriser l'installation depuis cette source quand Android le demande.
3. Ouvrir Teranga Pay. Le réseau de démo doit tourner sur l'ordinateur (\`npm run regtest:up\`, voir le README).
`;
}

async function main() {
  const [apkPath, signaturePath] = process.argv.slice(2);
  if (!apkPath || !signaturePath) {
    throw new Error('Usage : node release-notes.mjs <apk> <sortie apksigner>');
  }
  const sha256 = createHash('sha256')
    .update(await readFile(apkPath))
    .digest('hex');
  const certificateSha256 = signerDigest(await readFile(signaturePath, 'utf8'));
  process.stdout.write(releaseNotes({ apkName: basename(apkPath), sha256, certificateSha256 }));
}

function isMain() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  main().catch((error) => {
    console.error(`Consignes de Release impossibles : ${error.message}`);
    process.exit(1);
  });
}
