import type { FastifyInstance } from 'fastify';

export const serviceName = 'teranga-api';

/** Contrôle de santé : indique que le processus répond, sans détail interne. */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/health',
    {
      schema: {
        querystring: { type: 'object', additionalProperties: false, properties: {} },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['status', 'service'],
            properties: {
              status: { type: 'string', const: 'ok' },
              service: { type: 'string' },
            },
          },
        },
      },
    },
    async () => ({ status: 'ok' as const, service: serviceName }),
  );
}
