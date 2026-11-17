import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { BridgeError, type Operator } from '@teranga-pay/bridge-sim';
import type { BridgeRuntime } from '../bridge.ts';
import { sendError, type ErrorCode } from '../errors.ts';
import { satsForXof } from '../quotes.ts';
import { RateUnavailableError, type RateProvider } from '../rates.ts';

const feeXof = 100; // Tarif fictif de démonstration, sans lien avec les opérateurs.
const uuid = { type: 'string', format: 'uuid' } as const;
const integer = { type: 'integer', minimum: 0 } as const;
const iso = { type: 'string', format: 'date-time' } as const;
const emptyQuery = { type: 'object', additionalProperties: false, properties: {} } as const;
const params = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: uuid },
} as const;
const common = {
  id: uuid,
  simulation: { const: true, type: 'boolean' },
  operator: { type: 'string', enum: ['wave', 'orange_money'] },
  recipientId: { type: 'string', enum: ['wave-demo-001', 'orange-demo-001'] },
  amountXof: integer,
  feeXof: integer,
  totalXof: integer,
  amountSats: integer,
  feeSats: integer,
  totalSats: integer,
  xofPerBtc: integer,
  source: { type: 'string', enum: ['fixe', 'kraken'] },
} as const;
const quoteSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...Object.keys(common), 'createdAt', 'expiresAt'],
  properties: { ...common, createdAt: iso, expiresAt: iso },
} as const;
const withdrawalSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    ...Object.keys(common),
    'quoteId',
    'quoteCreatedAt',
    'quoteExpiresAt',
    'status',
    'failure',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    ...common,
    quoteId: uuid,
    quoteCreatedAt: iso,
    quoteExpiresAt: iso,
    createdAt: iso,
    updatedAt: iso,
    status: { type: 'string', enum: ['en_attente', 'incertain', 'reussi', 'echoue'] },
    failure: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
} as const;
const historySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['simulation', 'items', 'nextCursor'],
  properties: {
    simulation: common.simulation,
    items: { type: 'array', maxItems: 100, items: withdrawalSchema },
    nextCursor: { anyOf: [uuid, { type: 'null' }] },
  },
} as const;
const balanceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['simulation', 'availableSats', 'heldSats'],
  properties: { simulation: common.simulation, availableSats: integer, heldSats: integer },
} as const;
const errorStatuses: Partial<Record<ErrorCode, number>> = {
  INVALID_INPUT: 400,
  ACCOUNT_NOT_FOUND: 404,
  QUOTE_NOT_FOUND: 404,
  QUOTE_EXPIRED: 410,
  QUOTE_ALREADY_USED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  INSUFFICIENT_FUNDS: 409,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_MISMATCH: 409,
  QUOTE_CONFLICT: 409,
  STORAGE_CLOSED: 503,
};

/** Le contrôle d'accès de ce plugin n'affecte pas les routes publiques T13/T17. */
export async function withdrawalRoutes(
  app: FastifyInstance,
  {
    bridge,
    rates,
    now,
    quoteTtlMs,
  }: {
    bridge: BridgeRuntime;
    rates: RateProvider;
    now: () => number;
    quoteTtlMs: number;
  },
): Promise<void> {
  if (!Number.isSafeInteger(quoteTtlMs) || quoteTtlMs < 1 || quoteTtlMs > 300_000)
    throw new BridgeError('INVALID_INPUT');
  const owners = new WeakMap<FastifyRequest, string>();
  app.addHook('onRequest', async (request, reply) => {
    const owner = bridge.ownerForAuthorization(request.headers.authorization);
    if (!owner) {
      reply.header('www-authenticate', 'Bearer');
      return sendError(reply, request, 401, 'UNAUTHORIZED');
    }
    owners.set(request, owner);
  });
  const owner = (request: FastifyRequest) => owners.get(request)!;
  // Les messages d'exception et données des fournisseurs ne sont jamais renvoyés.
  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof BridgeError && error.code === 'WITHDRAWAL_NOT_FOUND')
      return sendError(
        reply,
        request,
        404,
        request.method === 'GET' && request.routeOptions.url === '/v1/withdrawals'
          ? 'NOT_FOUND'
          : 'WITHDRAWAL_NOT_FOUND',
      );
    if (error instanceof BridgeError && errorStatuses[error.code as ErrorCode]) {
      let withdrawalId: string | undefined;
      if (
        error.withdrawalId &&
        ['QUOTE_ALREADY_USED', 'IDEMPOTENCY_CONFLICT'].includes(error.code)
      ) {
        try {
          withdrawalId = bridge.store.find(owner(request), error.withdrawalId)?.id;
        } catch {
          // Aucune référence non vérifiée ne quitte cette frontière d’authentification.
        }
      }
      return sendError(
        reply,
        request,
        errorStatuses[error.code as ErrorCode]!,
        error.code as ErrorCode,
        undefined,
        withdrawalId ? { withdrawalId } : undefined,
      );
    }
    throw error; // Le gestionnaire T13 parent conserve validation, limites et erreurs internes.
  });

  app.get('/v1/withdrawal-options', { schema: { querystring: emptyQuery } }, async () => ({
    simulation: true,
    currency: 'XOF',
    feeXof,
    maxAmountXof: 5_000_000,
    operators: [
      { operator: 'wave', recipientId: 'wave-demo-001' },
      { operator: 'orange_money', recipientId: 'orange-demo-001' },
    ],
  }));
  app.get(
    '/v1/withdrawal-balance',
    { schema: { querystring: emptyQuery, response: { 200: balanceSchema } } },
    async (request) => bridge.store.balance(owner(request)),
  );
  app.get<{ Querystring: { limit?: number; before?: string } }>(
    '/v1/withdrawals',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            before: uuid,
          },
        },
        response: { 200: historySchema },
      },
    },
    async (request) => bridge.service.history(owner(request), request.query),
  );
  app.post<{ Body: { amountXof: number; operator: Operator; recipientId: string } }>(
    '/v1/withdrawal-quotes',
    {
      schema: {
        querystring: emptyQuery,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['amountXof', 'operator', 'recipientId'],
          properties: {
            amountXof: { type: 'integer', minimum: 1, maximum: 5_000_000 },
            operator: common.operator,
            recipientId: common.recipientId,
          },
        },
        response: { 201: quoteSchema },
      },
    },
    async (request, reply) => {
      const input = request.body;
      if (input.recipientId !== (input.operator === 'wave' ? 'wave-demo-001' : 'orange-demo-001'))
        return sendError(reply, request, 400, 'INVALID_INPUT');
      let rate;
      try {
        rate = await rates.current();
      } catch (error) {
        if (error instanceof RateUnavailableError)
          return sendError(reply, request, 503, 'RATE_UNAVAILABLE');
        throw error;
      }
      const totalXof = input.amountXof + feeXof;
      const createdAt = now();
      const totalSats = satsForXof(totalXof, rate.xofPerBtc);
      const amountSats = satsForXof(input.amountXof, rate.xofPerBtc);
      const quote = bridge.store.offer(owner(request), {
        id: randomUUID(),
        ...input,
        feeXof,
        totalXof,
        amountSats,
        feeSats: totalSats - amountSats,
        totalSats,
        xofPerBtc: rate.xofPerBtc,
        source: rate.source,
        createdAt: new Date(createdAt).toISOString(),
        expiresAt: new Date(createdAt + quoteTtlMs).toISOString(),
      });
      return reply.code(201).send(quote);
    },
  );
  app.get<{ Params: { id: string } }>(
    '/v1/withdrawal-quotes/:id',
    { schema: { params, querystring: emptyQuery, response: { 200: quoteSchema } } },
    async (request, reply) => {
      const quote = bridge.store.getQuote(owner(request), request.params.id);
      return quote ?? sendError(reply, request, 404, 'QUOTE_NOT_FOUND');
    },
  );
  app.post<{ Body: { quoteId: string }; Headers: { 'idempotency-key': string } }>(
    '/v1/withdrawals',
    {
      schema: {
        querystring: emptyQuery,
        headers: {
          type: 'object',
          required: ['idempotency-key'],
          properties: { 'idempotency-key': uuid },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['quoteId'],
          properties: { quoteId: uuid },
        },
        response: { 200: withdrawalSchema, 201: withdrawalSchema, 202: withdrawalSchema },
      },
    },
    async (request, reply) => {
      const result = await bridge.service.create(
        owner(request),
        request.headers['idempotency-key'],
        request.body.quoteId,
      );
      reply.header('idempotent-replay', String(result.replayed));
      const status = ['en_attente', 'incertain'].includes(result.withdrawal.status)
        ? 202
        : result.replayed
          ? 200
          : 201;
      return reply.code(status).send(result.withdrawal);
    },
  );
  app.get<{ Params: { id: string } }>(
    '/v1/withdrawals/:id',
    { schema: { params, querystring: emptyQuery, response: { 200: withdrawalSchema } } },
    async (request, reply) => {
      const withdrawal = bridge.service.get(owner(request), request.params.id);
      return withdrawal ?? sendError(reply, request, 404, 'WITHDRAWAL_NOT_FOUND');
    },
  );
  app.post<{ Params: { id: string } }>(
    '/v1/withdrawals/:id/reconcile',
    {
      schema: {
        params,
        querystring: emptyQuery,
        body: emptyQuery,
        response: { 200: withdrawalSchema },
      },
    },
    async (request, reply) => {
      const withdrawal = await bridge.service.reconcile(owner(request), request.params.id);
      return withdrawal ?? sendError(reply, request, 404, 'WITHDRAWAL_NOT_FOUND');
    },
  );
  app.post<{ Params: { id: string } }>(
    '/v1/withdrawals/:id/retry',
    {
      schema: {
        params,
        querystring: emptyQuery,
        body: emptyQuery,
        response: { 200: withdrawalSchema, 202: withdrawalSchema },
      },
    },
    async (request, reply) => {
      const withdrawal = await bridge.service.retry(owner(request), request.params.id);
      if (!withdrawal) return sendError(reply, request, 404, 'WITHDRAWAL_NOT_FOUND');
      return reply
        .code(['en_attente', 'incertain'].includes(withdrawal.status) ? 202 : 200)
        .send(withdrawal);
    },
  );
}
