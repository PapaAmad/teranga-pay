import type { FastifyInstance } from 'fastify';
import { errorCodes, sendError } from '../errors.ts';
import type { QuoteStore, Quote } from '../quotes.ts';
import { RateUnavailableError, type RateProvider } from '../rates.ts';

export const maxQuoteXof = 5_000_000;

const rateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['xofPerBtc', 'source', 'fetchedAt'],
  properties: {
    xofPerBtc: { type: 'integer' },
    source: { type: 'string', enum: ['fixe', 'kraken'] },
    fetchedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const quoteSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'amountXof', 'amountSats', 'xofPerBtc', 'source', 'createdAt', 'expiresAt'],
  properties: {
    id: { type: 'string' },
    amountXof: { type: 'integer' },
    amountSats: { type: 'integer' },
    xofPerBtc: { type: 'integer' },
    source: { type: 'string', enum: ['fixe', 'kraken'] },
    createdAt: { type: 'string', format: 'date-time' },
    expiresAt: { type: 'string', format: 'date-time' },
  },
} as const;

const iso = (ms: number) => new Date(ms).toISOString();
const quoteBody = (quote: Quote) => ({
  ...quote,
  createdAt: iso(quote.createdAt),
  expiresAt: iso(quote.expiresAt),
});

/** Taux BTC/FCFA et devis figés (T17). */
export async function rateRoutes(
  app: FastifyInstance,
  { rates, quotes }: { rates: RateProvider; quotes: QuoteStore },
): Promise<void> {
  async function currentRate() {
    try {
      return await rates.current();
    } catch (error) {
      if (error instanceof RateUnavailableError) return undefined;
      throw error;
    }
  }

  app.get(
    '/v1/rate',
    {
      schema: {
        querystring: { type: 'object', additionalProperties: false, properties: {} },
        response: { 200: rateSchema },
      },
    },
    async (request, reply) => {
      const rate = await currentRate();
      if (!rate) return sendError(reply, request, 503, errorCodes.rateUnavailable);
      return { ...rate, fetchedAt: iso(rate.fetchedAt) };
    },
  );

  app.post<{ Body: { amountXof: number } }>(
    '/v1/quotes',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['amountXof'],
          properties: { amountXof: { type: 'integer', minimum: 1, maximum: maxQuoteXof } },
        },
        response: { 201: quoteSchema },
      },
    },
    async (request, reply) => {
      const rate = await currentRate();
      if (!rate) return sendError(reply, request, 503, errorCodes.rateUnavailable);
      return reply.code(201).send(quoteBody(quotes.create(request.body.amountXof, rate)));
    },
  );

  app.get<{ Params: { id: string } }>(
    '/v1/quotes/:id',
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: { 200: quoteSchema },
      },
    },
    async (request, reply) => {
      const found = quotes.get(request.params.id);
      if (found.status === 'inconnu') {
        return sendError(reply, request, 404, errorCodes.quoteNotFound);
      }
      if (found.status !== 'actif') {
        return sendError(reply, request, 410, errorCodes.quoteExpired);
      }
      return quoteBody(found.quote);
    },
  );
}
