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
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

export type ErrorBody = {
  error: {
    code: ErrorCode;
    requestId: string;
    /** Champs refusés, sans leurs valeurs, pour les erreurs de validation. */
    fields?: string[];
  };
};
