import type { RateConfig, RateSource } from './config.ts';

/** Parité fixe du franc CFA (UEMOA) : 1 euro = 655,957 FCFA. */
export const XOF_PER_EUR = 655.957;

/** Bornes plausibles d'un taux BTC/FCFA, communes au taux fixe et à Kraken. */
export const MIN_XOF_PER_BTC = 1_000_000;
export const MAX_XOF_PER_BTC = 10_000_000_000;

export type Rate = {
  /** Nombre entier de FCFA pour 1 BTC. */
  xofPerBtc: number;
  source: RateSource;
  /** Date de la mesure, en millisecondes. */
  fetchedAt: number;
};

export interface RateProvider {
  current(): Promise<Rate>;
}

export class RateUnavailableError extends Error {}

type Fetch = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

export function fixedRateProvider(xofPerBtc: number, now: () => number): RateProvider {
  return { current: async () => ({ xofPerBtc, source: 'fixe', fetchedAt: now() }) };
}

export const krakenUrl = 'https://api.kraken.com/0/public/Ticker?pair=XBTEUR';

/** Lit le dernier prix BTC/EUR de Kraken et le convertit en FCFA par la parité fixe. */
export function parseKrakenEur(body: unknown): number {
  const result = (body as { result?: Record<string, { c?: unknown[] }> } | null)?.result;
  const last = result ? Object.values(result)[0]?.c?.[0] : undefined;
  const eur = typeof last === 'string' ? Number(last) : NaN;
  if (!Number.isFinite(eur) || eur <= 0) throw new RateUnavailableError('prix Kraken illisible');
  return eur;
}

/**
 * Taux en direct : une mesure reste en cache une minute. Si Kraken ne répond pas,
 * la dernière mesure sert encore dix minutes, puis le taux devient indisponible.
 */
export function krakenRateProvider({
  fetch: fetchImpl = globalThis.fetch as Fetch,
  now,
  cacheMs = 60_000,
  maxStaleMs = 600_000,
}: {
  fetch?: Fetch;
  now: () => number;
  cacheMs?: number;
  maxStaleMs?: number;
}): RateProvider {
  let last: Rate | undefined;
  let pending: Promise<Rate> | undefined;

  async function refresh(): Promise<Rate> {
    try {
      const response = await fetchImpl(krakenUrl, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) throw new RateUnavailableError('réponse Kraken en erreur');
      const xofPerBtc = Math.round(parseKrakenEur(await response.json()) * XOF_PER_EUR);
      // Un prix absurde donnerait des devis faux, voire un taux nul (division par zéro).
      if (xofPerBtc < MIN_XOF_PER_BTC || xofPerBtc > MAX_XOF_PER_BTC) {
        throw new RateUnavailableError('prix Kraken hors bornes');
      }
      last = { xofPerBtc, source: 'kraken', fetchedAt: now() };
      return last;
    } catch (error) {
      if (last && now() - last.fetchedAt < maxStaleMs) return last;
      throw error instanceof RateUnavailableError
        ? error
        : new RateUnavailableError('taux indisponible');
    }
  }

  return {
    current() {
      if (last && now() - last.fetchedAt < cacheMs) return Promise.resolve(last);
      // Des appels simultanés partagent la même requête Kraken, réussie ou non.
      pending ??= refresh().finally(() => {
        pending = undefined;
      });
      return pending;
    },
  };
}

export function createRateProvider(config: RateConfig, { now }: { now: () => number }) {
  return config.source === 'kraken'
    ? krakenRateProvider({ now })
    : fixedRateProvider(config.fixedXofPerBtc, now);
}
