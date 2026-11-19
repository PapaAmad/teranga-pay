import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

/** Le contenu reste dans stdin et dans le stockage privé Android, jamais dans argv ou les logs. */
export function readBridgeProvisioning(text) {
  if (typeof text !== 'string' || text.length > 16_384) throw new Error('PROVISION_INVALID');
  const config = parseEnv(text);
  const token = config.BRIDGE_SIM_TOKEN;
  if (
    config.BRIDGE_SIM_ENABLED !== 'true' ||
    typeof token !== 'string' ||
    token.length < 32 ||
    token.length > 128 ||
    /[^A-Za-z0-9_-]/.test(token)
  )
    throw new Error('PROVISION_INVALID');
  return JSON.stringify({ version: 1, bridgeToken: token });
}

export const provisioningCommand =
  "run-as pay.teranga.demo sh -c 'umask 077; mkdir -p no_backup; cat > no_backup/teranga-integration-provisioning.json.tmp && mv no_backup/teranga-integration-provisioning.json.tmp no_backup/teranga-integration-provisioning.json'";

export function provision({ adb = 'adb', serial, text }) {
  if (
    serial !== undefined &&
    (typeof serial !== 'string' || !/^[A-Za-z0-9._:-]+$/.test(serial) || /\s/.test(serial))
  )
    throw new Error('DEVICE_INVALID');
  const input = readBridgeProvisioning(text);
  const target = serial ? ['-s', serial] : [];
  // run-as refuse les APK non débogables ; aucune publication ni modification de clé du wallet.
  const result = spawnSync(adb, [...target, 'shell', provisioningCommand], {
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20_000,
    maxBuffer: 16_384,
  });
  if (result.error || result.status !== 0) throw new Error('PROVISION_FAILED');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => !arg.startsWith('--adb=') && !arg.startsWith('--serial=')))
      throw new Error('ARGUMENT_INVALID');
    const adb = args.find((arg) => arg.startsWith('--adb='))?.slice(6);
    const serial = args.find((arg) => arg.startsWith('--serial='))?.slice(9);
    provision({
      adb,
      serial,
      text: readFileSync(new URL('../services/api/.env.bridge-sim', import.meta.url), 'utf8'),
    });
    console.info(
      'Provisionnement privé envoyé au build Android de développement. Déverrouiller le coffre pour importer la configuration. Aucun jeton affiché.',
    );
  } catch {
    console.error(
      'Provisionnement impossible. Vérifier le build de développement, ADB et la configuration ignorée de la passerelle.',
    );
    process.exitCode = 1;
  }
}
