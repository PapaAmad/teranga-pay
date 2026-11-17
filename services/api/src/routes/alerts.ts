import type { FastifyInstance } from 'fastify';
import {
  assessPayment,
  defaultFraudConfig,
  type FraudConfig,
  type PaymentCheck,
} from '../fraud.ts';

const sats = { type: 'integer', minimum: 0, maximum: 2_100_000_000_000_000 } as const;

/** Analyse de risque d'un envoi (T26). Le corps ne contient que des nombres. */
export async function alertRoutes(
  app: FastifyInstance,
  { config = defaultFraudConfig }: { config?: FraudConfig } = {},
): Promise<void> {
  app.post<{ Body: PaymentCheck }>(
    '/v1/alerts/payment-check',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['amountSats', 'newRecipient', 'recentPayments', 'usualAmountsSats'],
          properties: {
            amountSats: { ...sats, minimum: 1 },
            newRecipient: { type: 'boolean' },
            recentPayments: {
              type: 'array',
              maxItems: 50,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['amountSats', 'ageSeconds'],
                properties: {
                  amountSats: sats,
                  ageSeconds: { type: 'integer', minimum: 0, maximum: 86_400 },
                },
              },
            },
            usualAmountsSats: { type: 'array', maxItems: 50, items: sats },
            localHour: { type: 'integer', minimum: 0, maximum: 23 },
            balanceSats: sats,
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['score', 'level', 'confirmationRequired', 'reasons'],
            properties: {
              score: { type: 'integer' },
              level: { type: 'string', enum: ['faible', 'moyen', 'eleve'] },
              confirmationRequired: { type: 'boolean' },
              reasons: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['code', 'points'],
                  properties: { code: { type: 'string' }, points: { type: 'integer' } },
                },
              },
            },
          },
        },
      },
    },
    async (request) => assessPayment(request.body, config),
  );
}
