import { randomUUID } from 'node:crypto';
import Fastify, {
  type FastifyError,
  type FastifySchema,
  type FastifySchemaCompiler,
  type FastifyInstance,
} from 'fastify';
import { AjvCompiler } from '@fastify/ajv-compiler';
import rateLimit from '@fastify/rate-limit';
import type { DestinationStream } from 'pino';
import { defaultConfig, type ApiConfig } from './config.ts';
import { errorCodes, sendError } from './errors.ts';
import { createRateProvider, type RateProvider } from './rates.ts';
import { createQuoteStore } from './quotes.ts';
import { rateRoutes } from './routes/rates.ts';
import { healthRoutes } from './routes/health.ts';

export type BuildOptions = {
  config?: ApiConfig;
  /** Flux de journal injectable pour les tests. */
  logStream?: DestinationStream;
  /** Source de taux injectable (tests, démo). Par défaut : selon la configuration. */
  rates?: RateProvider;
  /** Horloge injectable en millisecondes, pour tester l'expiration des devis. */
  now?: () => number;
};

/**
 * Sérialise une requête sans donnée personnelle : ni adresse IP, ni en-têtes,
 * ni paramètres d'URL, ni corps. Seuls la méthode et le modèle de route restent.
 */
export function serializeRequest(request: {
  method: string;
  routeOptions?: { url?: string };
}): Record<string, string> {
  return {
    method: request.method,
    route: request.routeOptions?.url ?? 'non-route',
  };
}

function validationFields(error: FastifyError): string[] {
  const fields = new Set<string>();
  for (const item of error.validation ?? []) {
    const missing = (item.params as { missingProperty?: unknown }).missingProperty;
    const extra = (item.params as { additionalProperty?: unknown }).additionalProperty;
    const base = item.instancePath.replace(/^\//, '').replaceAll('/', '.');
    const name = typeof missing === 'string' ? missing : typeof extra === 'string' ? extra : '';
    const path = [error.validationContext, base, name].filter(Boolean).join('.');
    fields.add(path || (error.validationContext ?? 'request'));
  }
  return [...fields];
}

const ajvOptions = { removeAdditional: false, allErrors: false } as const;

/**
 * Un corps JSON est déjà typé : il est validé tel quel, sans conversion
 * (`true` ou `"500"` ne deviennent pas des montants). Les paramètres d'URL,
 * toujours reçus en texte, restent convertis vers le type du schéma.
 */
function buildValidatorCompiler(): FastifySchemaCompiler<FastifySchema> {
  const buildCompiler = AjvCompiler();
  const strict = buildCompiler({}, { customOptions: { ...ajvOptions, coerceTypes: false } });
  const coercing = buildCompiler({}, { customOptions: { ...ajvOptions, coerceTypes: 'array' } });
  return (route) => (route.httpPart === 'body' ? strict(route) : coercing(route));
}

export async function buildApp(options: BuildOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? defaultConfig;
  const app = Fastify({
    logger: {
      level: config.logLevel,
      // Ni nom de machine ni PID : seul le nom du service identifie la source.
      base: { service: 'teranga-api' },
      ...(options.logStream ? { stream: options.logStream } : {}),
      serializers: {
        req: serializeRequest,
        res: (reply: { statusCode: number }) => ({ statusCode: reply.statusCode }),
      },
    },
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    bodyLimit: config.bodyLimitBytes,
    trustProxy: false,
  });
  app.setValidatorCompiler(buildValidatorCompiler());

  await app.register(rateLimit, {
    global: true,
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    // L'adresse IP reste en mémoire pour le comptage ; elle n'est jamais journalisée.
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      code: 'FST_RATE_LIMITED',
      message: 'rate limited',
    }),
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('cache-control', 'no-store');
    reply.header('x-request-id', _request.id);
    return payload;
  });

  // Les routes déclarées sont comptées dès `onRequest` par le plugin. Une route
  // inconnue l'est ici, avant la lecture du corps : un JSON cassé, trop gros ou
  // d'un type refusé ne permet donc pas d'échapper au quota.
  const limitUnknownRoute = app.rateLimit();
  app.addHook('onRequest', async (request, reply) => {
    if (request.is404) await limitUnknownRoute.call(app, request, reply);
  });

  app.setNotFoundHandler(async (request, reply) =>
    sendError(reply, request, 404, errorCodes.notFound),
  );

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    if (error.validation) {
      return sendError(reply, request, 400, errorCodes.validation, validationFields(error));
    }
    const status = error.statusCode ?? 500;
    if (status === 429) return sendError(reply, request, 429, errorCodes.rateLimited);
    if (status === 413) return sendError(reply, request, 413, errorCodes.payloadTooLarge);
    if (status === 415) return sendError(reply, request, 415, errorCodes.unsupportedMediaType);
    if (status >= 400 && status < 500) {
      return sendError(reply, request, status, errorCodes.badRequest);
    }
    request.log.error({ errorCode: error.code ?? 'UNKNOWN' }, 'erreur interne');
    return sendError(reply, request, 500, errorCodes.internal);
  });

  const now = options.now ?? Date.now;
  await app.register(healthRoutes);
  await app.register(rateRoutes, {
    rates: options.rates ?? createRateProvider(config.rate, { now }),
    quotes: createQuoteStore({ ttlMs: config.quoteTtlSeconds * 1000, now }),
  });
  return app;
}
