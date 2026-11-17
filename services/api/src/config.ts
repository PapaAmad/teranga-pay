import { MAX_XOF_PER_BTC, MIN_XOF_PER_BTC } from './rates.ts';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export type ApiConfig = {
  host: string;
  port: number;
  logLevel: LogLevel;
  rateLimit: { max: number; windowMs: number };
  bodyLimitBytes: number;
  rate: RateConfig;
  quoteTtlSeconds: number;
};

export type RateSource = 'fixe' | 'kraken';
export type RateConfig = { source: RateSource; fixedXofPerBtc: number };

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
  // Taux de démonstration reproductible, proche du marché de novembre 2026.
  rate: { source: 'fixe', fixedXofPerBtc: 45_000_000 },
  quoteTtlSeconds: 300,
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

function readRateSource(env: NodeJS.ProcessEnv): RateSource {
  const source = env.RATE_SOURCE || defaultConfig.rate.source;
  if (source !== 'fixe' && source !== 'kraken') {
    throw new Error('RATE_SOURCE doit valoir : fixe, kraken.');
  }
  return source;
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
    rate: {
      source: readRateSource(env),
      fixedXofPerBtc: readInteger(
        env,
        'RATE_FIXED_XOF_PER_BTC',
        defaultConfig.rate.fixedXofPerBtc,
        MIN_XOF_PER_BTC,
        MAX_XOF_PER_BTC,
      ),
    },
    quoteTtlSeconds: readInteger(
      env,
      'QUOTE_TTL_SECONDS',
      defaultConfig.quoteTtlSeconds,
      30,
      3_600,
    ),
  };
}
