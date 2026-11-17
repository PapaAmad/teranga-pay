import { MAX_XOF_PER_BTC, MIN_XOF_PER_BTC } from './rates.ts';
import type { Scenario } from '@teranga-pay/bridge-sim';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export type ApiConfig = {
  host: string;
  port: number;
  logLevel: LogLevel;
  rateLimit: { max: number; windowMs: number };
  bodyLimitBytes: number;
  rate: RateConfig;
  quoteTtlSeconds: number;
  lightningAddress: LightningAddressConfig;
  bridge?: { token: string; path: string; scenario: Scenario };
};

export type LightningAddressConfig = {
  /** Domaine des adresses, par exemple `teranga.example` dans `mame@teranga.example`. */
  domain: string;
  /** URL publique de l'API, utilisée dans le `callback` LNURL. */
  publicBaseUrl: string;
  /** Temps laissé au téléphone pour fournir sa facture. */
  callbackTimeoutMs: number;
  minSendableMsat: number;
  maxSendableMsat: number;
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
  lightningAddress: {
    domain: 'teranga.example',
    publicBaseUrl: 'http://127.0.0.1:3000',
    callbackTimeoutMs: 15_000,
    minSendableMsat: 1_000,
    // 5 000 000 sats, cohérent avec le plafond des devis.
    maxSendableMsat: 5_000_000_000,
  },
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

function readUrl(env: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/.test(raw)) {
    throw new Error(
      `${name} doit être une URL http(s) sans chemin, par exemple http://10.0.2.2:3000.`,
    );
  }
  return raw;
}

function readDomain(env: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(raw))
    throw new Error(`${name} doit être un nom de domaine.`);
  return raw;
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
  const enabled = env.BRIDGE_SIM_ENABLED;
  if (enabled !== undefined && enabled !== '' && enabled !== 'true' && enabled !== 'false')
    throw new Error('BRIDGE_SIM_ENABLED doit valoir true ou false.');
  let bridge: ApiConfig['bridge'];
  if (enabled === 'true') {
    if (!['127.0.0.1', '::1'].includes(host))
      throw new Error('La passerelle simulée nécessite une écoute loopback.');
    const token = env.BRIDGE_SIM_TOKEN ?? '';
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token))
      throw new Error('BRIDGE_SIM_TOKEN doit être un jeton aléatoire de 32 à 128 caractères.');
    const path = env.BRIDGE_SIM_DB_PATH || '.data/bridge-sim.sqlite';
    if (
      path === ':memory:' ||
      /^file:/i.test(path) ||
      [...path].some((character) => character.charCodeAt(0) < 32)
    )
      throw new Error('BRIDGE_SIM_DB_PATH doit désigner une base persistante.');
    const scenario = env.BRIDGE_SIM_SCENARIO || 'success';
    if (!['success', 'declined', 'timeout_after_success', 'unavailable'].includes(scenario))
      throw new Error('BRIDGE_SIM_SCENARIO est invalide.');
    bridge = { token, path, scenario: scenario as Scenario };
  }
  return {
    host,
    ...(bridge ? { bridge } : {}),
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
    lightningAddress: {
      ...defaultConfig.lightningAddress,
      domain: readDomain(env, 'LNADDRESS_DOMAIN', defaultConfig.lightningAddress.domain),
      publicBaseUrl: readUrl(env, 'PUBLIC_BASE_URL', defaultConfig.lightningAddress.publicBaseUrl),
      callbackTimeoutMs: readInteger(
        env,
        'LNURL_CALLBACK_TIMEOUT_MS',
        defaultConfig.lightningAddress.callbackTimeoutMs,
        1_000,
        60_000,
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
