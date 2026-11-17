import type { FastifyInstance } from 'fastify';
import {
  defaultSavingsAssumptions,
  estimateSavings,
  type SavingsAssumptions,
  type Transfer,
} from '../savings.ts';

const range = {
  type: 'object',
  additionalProperties: false,
  required: ['min', 'max'],
  properties: { min: { type: 'integer' }, max: { type: 'integer' } },
} as const;

const outcome = { type: 'string', enum: ['economie', 'comparable', 'surcout'] } as const;

/** Estimation d'économies (T34) : hypothèses consultables et calcul par envoi ou pour un historique. */
export async function savingsRoutes(
  app: FastifyInstance,
  { assumptions = defaultSavingsAssumptions }: { assumptions?: SavingsAssumptions } = {},
): Promise<void> {
  const corridorIds = assumptions.corridors.map((corridor) => corridor.id);

  app.get(
    '/v1/savings/assumptions',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['version', 'formula', 'ttaBasisPoints', 'ttaCapXof', 'corridors'],
            properties: {
              version: { type: 'string' },
              formula: { type: 'string' },
              ttaBasisPoints: { type: 'integer' },
              ttaCapXof: { type: 'integer' },
              corridors: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'minBasisPoints', 'maxBasisPoints', 'addsTta', 'source'],
                  properties: {
                    id: { type: 'string' },
                    minBasisPoints: { type: 'integer' },
                    maxBasisPoints: { type: 'integer' },
                    addsTta: { type: 'boolean' },
                    source: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => ({ ...assumptions, formula: 'classicFeesXof - actualFeesXof' }),
  );

  const transferSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['amountXof', 'corridor', 'actualFeesXof'],
    properties: {
      amountXof: { type: 'integer', minimum: 1, maximum: 100_000_000 },
      corridor: { type: 'string', enum: corridorIds },
      actualFeesXof: { type: 'integer', minimum: 0, maximum: 100_000_000 },
    },
  } as const;

  const estimateSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['amountXof', 'corridor', 'actualFeesXof', 'classicFeesXof', 'savingsXof', 'outcome'],
    properties: {
      ...transferSchema.properties,
      classicFeesXof: range,
      savingsXof: range,
      outcome,
    },
  } as const;

  app.post<{ Body: { transfers: Transfer[] } }>(
    '/v1/savings/estimate',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['transfers'],
          properties: {
            transfers: { type: 'array', minItems: 1, maxItems: 100, items: transferSchema },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['estimate', 'formula', 'assumptionsVersion', 'transfers', 'total'],
            properties: {
              estimate: { type: 'boolean', const: true },
              formula: { type: 'string' },
              assumptionsVersion: { type: 'string' },
              transfers: { type: 'array', items: estimateSchema },
              total: {
                type: 'object',
                additionalProperties: false,
                required: ['amountXof', 'actualFeesXof', 'classicFeesXof', 'savingsXof', 'outcome'],
                properties: {
                  amountXof: { type: 'integer' },
                  actualFeesXof: { type: 'integer' },
                  classicFeesXof: range,
                  savingsXof: range,
                  outcome,
                },
              },
            },
          },
        },
      },
    },
    async (request) => estimateSavings(request.body.transfers, assumptions),
  );
}
