import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// Le jeton reste dans un fichier ignoré ; il n'est jamais affiché dans les journaux.
try {
  writeFileSync(
    '.env.bridge-sim',
    [
      'BRIDGE_SIM_ENABLED=true',
      `BRIDGE_SIM_TOKEN=${randomBytes(32).toString('base64url')}`,
      'BRIDGE_SIM_DB_PATH=.data/bridge-sim.sqlite',
      'BRIDGE_SIM_SCENARIO=success',
      'API_HOST=127.0.0.1',
      '',
    ].join('\n'),
    { flag: 'wx', mode: 0o600 },
  );
  console.info(
    'Configuration fictive créée dans .env.bridge-sim. Démarrer avec npm run bridge:demo.',
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'EEXIST')
    console.info('Le fichier .env.bridge-sim existe déjà ; il est conservé.');
  else {
    console.error('Configuration fictive impossible à créer.');
    process.exitCode = 1;
  }
}
