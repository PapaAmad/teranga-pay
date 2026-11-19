import type { FastifyInstance, FastifyReply } from 'fastify';
import type { LightningAddressConfig } from '../config.ts';
import { errorCodes, sendError } from '../errors.ts';
import { lnurlMetadata, type LightningAddressDirectory } from '../lightning-address.ts';

const usernameParam = {
  type: 'object',
  additionalProperties: false,
  required: ['username'],
  properties: { username: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

/** Réponse d'erreur au format LNURL (LUD-06), lue par le wallet du payeur. */
const lnurlError = (reply: FastifyReply, status: number, reason: string) =>
  reply.code(status).send({ status: 'ERROR', reason });

function bearer(header: string | undefined): string | undefined {
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(header ?? '');
  return match?.[1];
}

/** Adresse Lightning nom@domaine via LNURL-pay (T19), sans garde des fonds par le serveur. */
export async function lightningAddressRoutes(
  app: FastifyInstance,
  {
    directory,
    config,
    longPollMs,
  }: { directory: LightningAddressDirectory; config: LightningAddressConfig; longPollMs: number },
): Promise<void> {
  // --- Côté payeur (protocole LNURL-pay) -------------------------------------------

  app.get<{ Params: { username: string } }>(
    '/.well-known/lnurlp/:username',
    { schema: { params: usernameParam } },
    async (request, reply) => {
      const username = request.params.username.toLowerCase();
      if (!directory.has(username)) return lnurlError(reply, 404, 'Adresse inconnue');
      const { metadata } = lnurlMetadata(username, config.domain);
      return {
        tag: 'payRequest',
        callback: `${config.publicBaseUrl}/v1/lnurlp/${username}/callback`,
        minSendable: config.minSendableMsat,
        maxSendable: config.maxSendableMsat,
        metadata,
      };
    },
  );

  app.get<{ Params: { username: string }; Querystring: { amount: number } }>(
    '/v1/lnurlp/:username/callback',
    {
      schema: {
        params: usernameParam,
        querystring: {
          type: 'object',
          // Les wallets payeurs ajoutent parfois des paramètres (nonce, comment) : ils sont ignorés.
          additionalProperties: true,
          required: ['amount'],
          properties: { amount: { type: 'integer' } },
        },
      },
    },
    async (request, reply) => {
      const username = request.params.username.toLowerCase();
      if (!directory.has(username)) return lnurlError(reply, 404, 'Adresse inconnue');
      const amount = request.query.amount;
      if (amount < config.minSendableMsat || amount > config.maxSendableMsat) {
        return lnurlError(reply, 400, 'Montant hors limites');
      }
      const { descriptionHash } = lnurlMetadata(username, config.domain);
      const paymentRequest = await directory.requestInvoice(
        username,
        amount,
        descriptionHash,
        config.callbackTimeoutMs,
      );
      if (!paymentRequest) {
        return lnurlError(reply, 503, 'Destinataire injoignable, réessayez dans un instant');
      }
      return { pr: paymentRequest, routes: [] };
    },
  );

  // --- Côté téléphone du destinataire ------------------------------------------------

  app.post<{ Body: { username: string; registrationToken?: string } }>(
    '/v1/lightning-addresses',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['username'],
          properties: {
            username: { type: 'string', minLength: 1, maxLength: 64 },
            registrationToken: {
              type: 'string',
              minLength: 43,
              maxLength: 43,
              pattern: '^[A-Za-z0-9_-]{43}$',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const username = request.body.username;
      const result = directory.register(username, request.body.registrationToken);
      if (result === 'invalide') return sendError(reply, request, 400, errorCodes.usernameInvalid);
      if (result === 'pris') return sendError(reply, request, 409, errorCodes.usernameTaken);
      if (result === 'complet') return sendError(reply, request, 503, errorCodes.capacityReached);
      // Le serveur ne garde que l'empreinte SHA-256. Un rejeu peut seulement
      // rendre le jeton déjà fourni par ce même téléphone, jamais le deviner.
      return reply.code(201).send({ address: `${username}@${config.domain}`, token: result.token });
    },
  );

  app.get(
    '/v1/lightning-addresses/me/requests',
    { schema: { querystring: { type: 'object', additionalProperties: false, properties: {} } } },
    async (request, reply) => {
      const username = directory.authenticate(bearer(request.headers.authorization));
      if (!username) return sendError(reply, request, 401, errorCodes.unauthorized);
      const requests = await directory.waitForRequests(username, longPollMs);
      return {
        requests: requests.map((item) => ({
          ...item,
          expiresAt: new Date(item.expiresAt).toISOString(),
        })),
      };
    },
  );

  app.post<{ Params: { id: string }; Body: { paymentRequest: string } }>(
    '/v1/lightning-addresses/me/requests/:id',
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['paymentRequest'],
          properties: { paymentRequest: { type: 'string', minLength: 10, maxLength: 2_000 } },
        },
      },
    },
    async (request, reply) => {
      const username = directory.authenticate(bearer(request.headers.authorization));
      if (!username) return sendError(reply, request, 401, errorCodes.unauthorized);
      const result = directory.answer(username, request.params.id, request.body.paymentRequest);
      if (result === 'inconnue') return sendError(reply, request, 404, errorCodes.requestNotFound);
      if (result === 'invalide') return sendError(reply, request, 400, errorCodes.invoiceInvalid);
      return reply.code(204).send();
    },
  );
}
