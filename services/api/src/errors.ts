import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Codes d'erreur stables renvoyés par l'API. L'application traduit ces codes ;
 * le serveur ne renvoie jamais de texte d'interface ni de détail interne.
 */
export const errorCodes = {
  validation: 'VALIDATION_ERROR',
  notFound: 'NOT_FOUND',
  rateLimited: 'RATE_LIMITED',
  payloadTooLarge: 'PAYLOAD_TOO_LARGE',
  unsupportedMediaType: 'UNSUPPORTED_MEDIA_TYPE',
  badRequest: 'BAD_REQUEST',
  internal: 'INTERNAL_ERROR',
  rateUnavailable: 'RATE_UNAVAILABLE',
  quoteNotFound: 'QUOTE_NOT_FOUND',
  quoteExpired: 'QUOTE_EXPIRED',
  unauthorized: 'UNAUTHORIZED',
  usernameTaken: 'USERNAME_TAKEN',
  usernameInvalid: 'USERNAME_INVALID',
  capacityReached: 'CAPACITY_REACHED',
  requestNotFound: 'REQUEST_NOT_FOUND',
  invoiceInvalid: 'INVOICE_INVALID',
  bridgeInvalidInput: 'INVALID_INPUT',
  bridgeAccountNotFound: 'ACCOUNT_NOT_FOUND',
  bridgeQuoteAlreadyUsed: 'QUOTE_ALREADY_USED',
  bridgeIdempotencyConflict: 'IDEMPOTENCY_CONFLICT',
  bridgeInsufficientFunds: 'INSUFFICIENT_FUNDS',
  bridgeProviderUnavailable: 'PROVIDER_UNAVAILABLE',
  bridgeProviderMismatch: 'PROVIDER_MISMATCH',
  bridgeQuoteConflict: 'QUOTE_CONFLICT',
  withdrawalNotFound: 'WITHDRAWAL_NOT_FOUND',
  storageClosed: 'STORAGE_CLOSED',
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

export type ErrorBody = {
  error: {
    code: ErrorCode;
    requestId: string;
    /** Champs refusés, sans leurs valeurs, pour les erreurs de validation. */
    fields?: string[];
    /** Référence existante, uniquement après vérification du propriétaire authentifié. */
    withdrawalId?: string;
  };
};

/** Envoie une erreur au format commun, sans valeur reçue ni détail interne. */
export function sendError(
  reply: FastifyReply,
  request: FastifyRequest,
  statusCode: number,
  code: ErrorCode,
  fields?: string[],
  metadata?: { withdrawalId?: string },
): FastifyReply {
  const body: ErrorBody = { error: { code, requestId: request.id } };
  if (fields && fields.length > 0) body.error.fields = fields;
  if (metadata?.withdrawalId) body.error.withdrawalId = metadata.withdrawalId;
  return reply.code(statusCode).send(body);
}
