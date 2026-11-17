import { createHash, randomBytes, randomUUID } from 'node:crypto';

/** Nom d'adresse Lightning : minuscules, chiffres, « . », « _ » et « - » (LUD-16), 3 à 32 caractères. */
export const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const reservedUsernames = new Set(['admin', 'root', 'support', 'teranga', 'api', 'www']);

export type InvoiceRequest = {
  id: string;
  amountMsat: number;
  /** SHA-256 hexadécimal des métadonnées LNURL : la facture doit porter ce hachage (LUD-06). */
  descriptionHash: string;
  expiresAt: number;
};

type Pending = InvoiceRequest & {
  username: string;
  delivered: boolean;
  resolve: (paymentRequest: string | null) => void;
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Lit le montant inscrit dans la partie lisible d'une facture BOLT11 regtest
 * (`lnbcrt<montant><multiplicateur>1…`) et le renvoie en millisatoshis.
 * Renvoie `null` si la facture n'est pas une facture regtest lisible.
 */
export function regtestInvoiceAmountMsat(paymentRequest: string): bigint | null {
  const value = paymentRequest.toLowerCase();
  if (!/^lnbcrt[0-9a-z]+$/.test(value) || value.length > 2_000) return null;
  const separator = value.lastIndexOf('1');
  const match = /^lnbcrt(\d+)([munp])?$/.exec(value.slice(0, separator));
  if (!match) return null;
  const amount = BigInt(match[1] ?? '0');
  // 1 BTC = 10^11 msat.
  const msatPerUnit: Record<string, bigint> = {
    '': 100_000_000_000n,
    m: 100_000_000n,
    u: 100_000n,
    n: 100n,
  };
  const multiplier = match[2] ?? '';
  if (multiplier === 'p') {
    if (amount % 10n !== 0n) return null;
    return amount / 10n;
  }
  return amount * (msatPerUnit[multiplier] ?? 0n);
}

/**
 * Annuaire des adresses Lightning, en mémoire. Le serveur ne crée jamais de
 * facture : il relaie la demande du payeur au téléphone du destinataire, qui
 * fabrique la facture avec son propre wallet (les clés restent dans le téléphone).
 */
export function createLightningAddressDirectory({
  now = Date.now,
  maxUsers = 1_000,
  maxPendingPerUser = 10,
}: { now?: () => number; maxUsers?: number; maxPendingPerUser?: number } = {}) {
  const usersByTokenHash = new Map<string, string>();
  const users = new Set<string>();
  const pending = new Map<string, Pending>();
  const waiters = new Map<string, Set<() => void>>();

  const wake = (username: string) => {
    for (const notify of waiters.get(username) ?? []) notify();
  };
  const openRequests = (username: string) =>
    [...pending.values()].filter((item) => item.username === username && item.expiresAt > now());

  return {
    register(username: string): { token: string } | 'pris' | 'complet' | 'invalide' {
      if (!usernamePattern.test(username) || reservedUsernames.has(username)) return 'invalide';
      if (users.has(username)) return 'pris';
      if (users.size >= maxUsers) return 'complet';
      const token = randomBytes(32).toString('base64url');
      users.add(username);
      usersByTokenHash.set(hashToken(token), username);
      return { token };
    },

    has: (username: string) => users.has(username),

    /** Retrouve le nom associé à un jeton ; le jeton lui-même n'est jamais conservé. */
    authenticate(token: string | undefined): string | null {
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      return usersByTokenHash.get(hashToken(token)) ?? null;
    },

    /**
     * Demande une facture au téléphone et attend sa réponse. Renvoie `null` si le
     * téléphone ne répond pas à temps (hors ligne) ou si trop de demandes attendent.
     */
    requestInvoice(
      username: string,
      amountMsat: number,
      descriptionHash: string,
      timeoutMs: number,
    ): Promise<string | null> {
      if (openRequests(username).length >= maxPendingPerUser) return Promise.resolve(null);
      return new Promise((resolve) => {
        const id = randomUUID();
        const timer = setTimeout(() => {
          pending.delete(id);
          resolve(null);
        }, timeoutMs);
        pending.set(id, {
          id,
          username,
          amountMsat,
          descriptionHash,
          expiresAt: now() + timeoutMs,
          delivered: false,
          resolve: (paymentRequest) => {
            clearTimeout(timer);
            pending.delete(id);
            resolve(paymentRequest);
          },
        });
        wake(username);
      });
    },

    /** Attente longue côté téléphone : renvoie les demandes dès qu'il y en a, ou une liste vide. */
    waitForRequests(username: string, timeoutMs: number): Promise<InvoiceRequest[]> {
      const take = () =>
        openRequests(username).map(({ id, amountMsat, descriptionHash, expiresAt }) => ({
          id,
          amountMsat,
          descriptionHash,
          expiresAt,
        }));
      const ready = take();
      if (ready.length > 0) return Promise.resolve(ready);
      return new Promise((resolve) => {
        const set = waiters.get(username) ?? new Set();
        waiters.set(username, set);
        const done = () => {
          clearTimeout(timer);
          set.delete(done);
          if (set.size === 0) waiters.delete(username);
          resolve(take());
        };
        const timer = setTimeout(done, timeoutMs);
        set.add(done);
      });
    },

    /** Le téléphone répond avec sa facture. Le montant inscrit doit être exactement celui demandé. */
    answer(
      username: string,
      requestId: string,
      paymentRequest: string,
    ): 'ok' | 'inconnue' | 'invalide' {
      const item = pending.get(requestId);
      if (!item || item.username !== username) return 'inconnue';
      if (regtestInvoiceAmountMsat(paymentRequest) !== BigInt(item.amountMsat)) return 'invalide';
      item.resolve(paymentRequest.toLowerCase());
      return 'ok';
    },

    /** Libère toutes les attentes (arrêt du serveur). */
    close() {
      for (const item of pending.values()) item.resolve(null);
      for (const username of [...waiters.keys()]) wake(username);
    },
  };
}

export type LightningAddressDirectory = ReturnType<typeof createLightningAddressDirectory>;

/** Métadonnées LNURL-pay (LUD-06/LUD-16) et leur hachage, qui lie la facture à l'adresse. */
export function lnurlMetadata(username: string, domain: string) {
  const metadata = JSON.stringify([
    ['text/plain', `Paiement à ${username} via Teranga Pay`],
    ['text/identifier', `${username}@${domain}`],
  ]);
  return { metadata, descriptionHash: createHash('sha256').update(metadata).digest('hex') };
}
