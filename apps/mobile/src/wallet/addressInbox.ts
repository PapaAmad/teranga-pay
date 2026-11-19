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
    redirect?: 'error';
  },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type AddressRegistration =
  | { ok: true; address: string; token: string }
  | { ok: false; code: 'USERNAME_INVALID' | 'USERNAME_TAKEN' | 'NETWORK_OFFLINE' | 'UNKNOWN' };

/** Le jeton optionnel est déjà conservé au coffre : son rejeu retrouve la réservation. */
export async function registerAddress(
  apiUrl: string,
  username: string,
  fetch: FetchLike,
  registrationToken?: string,
): Promise<AddressRegistration> {
  const name = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(name)) return { ok: false, code: 'USERNAME_INVALID' };
  if (
    registrationToken !== undefined &&
    (typeof registrationToken !== 'string' ||
      registrationToken.length !== 43 ||
      !/^[A-Za-z0-9_-]{43}$/.test(registrationToken))
  )
    return { ok: false, code: 'UNKNOWN' };
  try {
    const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/v1/lightning-addresses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: name,
        ...(registrationToken === undefined ? {} : { registrationToken }),
      }),
      redirect: 'error',
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (
      response.status === 201 &&
      typeof body?.address === 'string' &&
      typeof body.token === 'string' &&
      (registrationToken === undefined ||
        (body.token === registrationToken &&
          body.address.startsWith(`${name}@`) &&
          /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(body.address.slice(name.length + 1))))
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
  /** Arrêt demandé : coupe l'attente en cours et empêche toute réponse ensuite. */
  signal?: AbortSignal;
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
): Promise<'ok' | 'jeton_refuse' | 'reseau' | 'arrete'> {
  const { apiUrl, token, fetch, native, onEvent } = options;
  const now = options.now ?? Date.now;
  const base = apiUrl.replace(/\/+$/, '');
  const auth = { authorization: `Bearer ${token}` };
  const stopSignal = options.signal;
  if (stopSignal?.aborted) return 'arrete';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.pollTimeoutMs ?? 35_000);
  const onStop = () => controller.abort();
  stopSignal?.addEventListener('abort', onStop);
  let items: unknown[];
  try {
    const response = await fetch(`${base}/v1/lightning-addresses/me/requests`, {
      headers: auth,
      signal: controller.signal,
      redirect: 'error',
    });
    if (response.status === 401) return 'jeton_refuse';
    if (!response.ok) return 'reseau';
    const body = (await response.json()) as { requests?: unknown };
    items = Array.isArray(body.requests) ? body.requests : [];
  } catch {
    return stopSignal?.aborted ? 'arrete' : 'reseau';
  } finally {
    clearTimeout(timer);
    stopSignal?.removeEventListener('abort', onStop);
  }

  for (const item of items) {
    // Une écoute arrêtée ne répond plus : une nouvelle écoute s'en chargera.
    if (stopSignal?.aborted) return 'arrete';
    if (!isAcceptableRequest(item, now()) || answered.has(item.id)) continue;
    answered.add(item.id);
    try {
      const paymentRequest = await native.receiveForDescriptionHash(
        item.amountMsat,
        item.descriptionHash,
        600,
      );
      // Arrêt pendant la création : la facture n'est ni envoyée ni annoncée.
      if (stopSignal?.aborted) return 'arrete';
      const response = await fetch(`${base}/v1/lightning-addresses/me/requests/${item.id}`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ paymentRequest }),
        redirect: 'error',
        ...(stopSignal ? { signal: stopSignal } : {}),
      });
      if (stopSignal?.aborted) return 'arrete';
      onEvent?.(
        response.status === 204
          ? { type: 'facture_envoyee', amountMsat: item.amountMsat }
          : { type: 'erreur', code: `HTTP_${response.status}` },
      );
    } catch (error) {
      if (stopSignal?.aborted) return 'arrete';
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
  const stopper = new AbortController();
  const looped = { ...options, signal: stopper.signal };
  void (async () => {
    let backoff = 1_000;
    while (!stopper.signal.aborted) {
      const result = await pollOnce(looped, answered);
      if (result === 'arrete' || stopper.signal.aborted) break;
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
    // Coupe aussi l'attente longue en cours : aucune réponse n'est envoyée après l'arrêt.
    stop: () => stopper.abort(),
  };
}
