export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export type ApiConfig = {
  host: string;
  port: number;
  logLevel: LogLevel;
  rateLimit: { max: number; windowMs: number };
  bodyLimitBytes: number;
};

const logLevels: readonly LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
];

export const defaultConfig: ApiConfig = {
  host: '127.0.0.1',
  port: 3000,
  logLevel: 'info',
  rateLimit: { max: 60, windowMs: 60_000 },
  bodyLimitBytes: 16 * 1024,
};

function readInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} doit être un entier positif.`);
  const value = Number(raw);
  if (value < min || value > max) {
    throw new Error(`${name} doit être compris entre ${min} et ${max}.`);
  }
  return value;
}

/** Lit la configuration depuis l'environnement et refuse toute valeur invalide. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const logLevel = env.API_LOG_LEVEL || defaultConfig.logLevel;
  if (!logLevels.includes(logLevel as LogLevel)) {
    throw new Error(`API_LOG_LEVEL doit valoir : ${logLevels.join(', ')}.`);
  }
  const host = env.API_HOST || defaultConfig.host;
  return {
    host,
    port: readInteger(env, 'API_PORT', defaultConfig.port, 1, 65_535),
    logLevel: logLevel as LogLevel,
    rateLimit: {
      max: readInteger(env, 'API_RATE_LIMIT_MAX', defaultConfig.rateLimit.max, 1, 100_000),
      windowMs: readInteger(
        env,
        'API_RATE_LIMIT_WINDOW_MS',
        defaultConfig.rateLimit.windowMs,
        1_000,
        3_600_000,
      ),
    },
    bodyLimitBytes: defaultConfig.bodyLimitBytes,
  };
}
