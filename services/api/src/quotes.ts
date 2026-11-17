import { randomUUID } from 'node:crypto';
import type { Rate } from './rates.ts';

const SATS_PER_BTC = 100_000_000n;

/**
 * Convertit des FCFA en sats, arrondi au sat supérieur : le commerçant ne reçoit
 * jamais moins que le montant affiché. Calcul entier, sans virgule flottante.
 */
export function satsForXof(amountXof: number, xofPerBtc: number): number {
  const numerator = BigInt(amountXof) * SATS_PER_BTC;
  const rate = BigInt(xofPerBtc);
  return Number((numerator + rate - 1n) / rate);
}

export type Quote = {
  id: string;
  amountXof: number;
  amountSats: number;
  xofPerBtc: number;
  source: Rate['source'];
  createdAt: number;
  expiresAt: number;
};

export type QuoteLookup = { status: 'actif'; quote: Quote } | { status: 'expiré' | 'inconnu' };

/**
 * Devis en mémoire. Un devis garde son taux jusqu'à expiration ; il reste ensuite
 * consultable une heure pour répondre « expiré » plutôt que « inconnu ». Le nombre
 * de devis est borné pour protéger la mémoire du serveur.
 */
export function createQuoteStore({
  ttlMs,
  now,
  maxQuotes = 10_000,
  graceMs = 3_600_000,
}: {
  ttlMs: number;
  now: () => number;
  maxQuotes?: number;
  graceMs?: number;
}) {
  const quotes = new Map<string, Quote>();

  function purge(): void {
    const limit = now() - graceMs;
    for (const [id, quote] of quotes) if (quote.expiresAt < limit) quotes.delete(id);
    while (quotes.size >= maxQuotes) {
      const oldest = quotes.keys().next().value;
      if (oldest === undefined) break;
      quotes.delete(oldest);
    }
  }

  return {
    create(amountXof: number, rate: Rate): Quote {
      purge();
      const createdAt = now();
      const quote: Quote = {
        id: randomUUID(),
        amountXof,
        amountSats: satsForXof(amountXof, rate.xofPerBtc),
        xofPerBtc: rate.xofPerBtc,
        source: rate.source,
        createdAt,
        expiresAt: createdAt + ttlMs,
      };
      quotes.set(quote.id, quote);
      return quote;
    },
    get(id: string): QuoteLookup {
      const quote = quotes.get(id);
      if (!quote) return { status: 'inconnu' };
      if (now() >= quote.expiresAt) return { status: 'expiré' };
      return { status: 'actif', quote };
    },
    size: () => quotes.size,
  };
}

export type QuoteStore = ReturnType<typeof createQuoteStore>;
