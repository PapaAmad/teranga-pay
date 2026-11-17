import type { NativeWallet } from '../../modules/teranga-wallet/src';

/**
 * Réception sur une adresse Lightning `nom@teranga.example` (T15 + T19), sans garde
 * des fonds : le serveur relaie les demandes de facture, le téléphone crée la facture
 * avec son propre nœud et la renvoie. L'argent arrive directement dans le téléphone.
 */

type FetchLike = (
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type AddressRegistration =
  | { ok: true; address: string; token: string }
  | { ok: false; code: 'USERNAME_INVALID' | 'USERNAME_TAKEN' | 'NETWORK_OFFLINE' | 'UNKNOWN' };

/** Réserve `nom@domaine` auprès de l'API. Le jeton n'est donné qu'une fois : le garder secret. */
export async function registerAddress(
  apiUrl: string,
  username: string,
  fetch: FetchLike,
): Promise<AddressRegistration> {
  const name = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(name)) return { ok: false, code: 'USERNAME_INVALID' };
  try {
    const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/v1/lightning-addresses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: name }),
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (
      response.status === 201 &&
      typeof body?.address === 'string' &&
      typeof body.token === 'string'
    ) {
      return { ok: true, address: body.address, token: body.token };
    }
    if (response.status === 409) return { ok: false, code: 'USERNAME_TAKEN' };
    if (response.status === 400) return { ok: false, code: 'USERNAME_INVALID' };
    return { ok: false, code: 'UNKNOWN' };
  } catch {
    return { ok: false, code: 'NETWORK_OFFLINE' };
  }
}

export type InvoiceRequest = {
  id: string;
  amountMsat: number;
  descriptionHash: string;
  expiresAt: string;
};

/** Plafond de sécurité : une demande plus grosse est ignorée (5 000 000 sats, comme l'API). */
export const maxRequestMsat = 5_000_000_000;

/** Vrai si la demande est bien formée, raisonnable et pas expirée. */
export function isAcceptableRequest(item: unknown, nowMs: number): item is InvoiceRequest {
  if (typeof item !== 'object' || item === null) return false;
  const request = item as Record<string, unknown>;
  const expires = typeof request.expiresAt === 'string' ? Date.parse(request.expiresAt) : NaN;
  return (
    typeof request.id === 'string' &&
    /^[0-9a-f-]{36}$/.test(request.id) &&
    Number.isSafeInteger(request.amountMsat) &&
    (request.amountMsat as number) >= 1_000 &&
    (request.amountMsat as number) <= maxRequestMsat &&
    typeof request.descriptionHash === 'string' &&
    /^[0-9a-f]{64}$/.test(request.descriptionHash) &&
    Number.isFinite(expires) &&
    expires > nowMs
  );
}

export type InboxOptions = {
  apiUrl: string;
  token: string;
  fetch: FetchLike;
  native: Pick<NativeWallet, 'receiveForDescriptionHash'>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Attente maximale d'une réponse « longue » du serveur (il répond en 25 s au plus). */
  pollTimeoutMs?: number;
  /** Prévenu à chaque facture renvoyée ou erreur, pour l'écran (aucune donnée personnelle). */
  onEvent?: (
    event: { type: 'facture_envoyee'; amountMsat: number } | { type: 'erreur'; code: string },
  ) => void;
};

/**
 * Un tour d'écoute : attend les demandes, crée et renvoie une facture pour chacune.
 * Renvoie `'ok'`, `'jeton_refuse'` (arrêter) ou `'reseau'` (réessayer plus tard).
 */
export async function pollOnce(
  options: InboxOptions,
  answered: Set<string>,
): Promise<'ok' | 'jeton_refuse' | 'reseau'> {
  const { apiUrl, token, fetch, native, onEvent } = options;
  const now = options.now ?? Date.now;
  const base = apiUrl.replace(/\/+$/, '');
  const auth = { authorization: `Bearer ${token}` };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.pollTimeoutMs ?? 35_000);
  let items: unknown[];
  try {
    const response = await fetch(`${base}/v1/lightning-addresses/me/requests`, {
      headers: auth,
      signal: controller.signal,
    });
    if (response.status === 401) return 'jeton_refuse';
    if (!response.ok) return 'reseau';
    const body = (await response.json()) as { requests?: unknown };
    items = Array.isArray(body.requests) ? body.requests : [];
  } catch {
    return 'reseau';
  } finally {
    clearTimeout(timer);
  }

  for (const item of items) {
    if (!isAcceptableRequest(item, now()) || answered.has(item.id)) continue;
    answered.add(item.id);
    try {
      const paymentRequest = await native.receiveForDescriptionHash(
        item.amountMsat,
        item.descriptionHash,
        600,
      );
      const response = await fetch(`${base}/v1/lightning-addresses/me/requests/${item.id}`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ paymentRequest }),
      });
      onEvent?.(
        response.status === 204
          ? { type: 'facture_envoyee', amountMsat: item.amountMsat }
          : { type: 'erreur', code: `HTTP_${response.status}` },
      );
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      onEvent?.({ type: 'erreur', code: typeof code === 'string' ? code : 'UNKNOWN' });
    }
  }
  return 'ok';
}

/** Écoute en continu jusqu'à `stop()`. Après une coupure, attend 1 s, 2 s, 4 s… jusqu'à 30 s. */
export function startAddressInbox(options: InboxOptions): { stop: () => void } {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const answered = new Set<string>();
  let running = true;
  void (async () => {
    let backoff = 1_000;
    while (running) {
      const result = await pollOnce(options, answered);
      if (!running) break;
      if (result === 'jeton_refuse') {
        options.onEvent?.({ type: 'erreur', code: 'UNAUTHORIZED' });
        break;
      }
      if (result === 'reseau') {
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 30_000);
      } else {
        backoff = 1_000;
      }
      // Garde une trace bornée des demandes déjà traitées.
      if (answered.size > 500) answered.clear();
    }
  })();
  return {
    stop: () => {
      running = false;
    },
  };
}
