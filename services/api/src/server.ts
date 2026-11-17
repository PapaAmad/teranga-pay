import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { loadSavingsAssumptions } from './savings.ts';

let config;
let savingsAssumptions;
try {
  config = loadConfig();
  savingsAssumptions = loadSavingsAssumptions();
} catch (error) {
  console.error(`Configuration invalide : ${(error as Error).message}`);
  process.exit(1);
}

const app = await buildApp({ config, savingsAssumptions });

async function stop(signal: string): Promise<void> {
  app.log.info({ signal }, 'arrêt demandé');
  await app.close();
  process.exit(0);
}

process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(
    { errorCode: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN' },
    'démarrage impossible',
  );
  process.exit(1);
}
