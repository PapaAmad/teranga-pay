import { fail, ok, type Result } from '@teranga-pay/contracts';

import type { NativeInvoiceInfo } from '../../modules/teranga-wallet/src';

/**
 * Paiement d'une adresse Lightning `nom@domaine` (LUD-16, LUD-06), côté téléphone (T21).
 * 1. Lire `https://domaine/.well-known/lnurlp/nom` : bornes de montant et métadonnées.
 * 2. Demander une facture au `callback` pour le montant exact.
 * 3. Avant de payer, vérifier la facture : réseau regtest, non expirée, montant identique
 *    et hachage de description égal au SHA-256 des métadonnées. Sinon, on ne paie pas.
 */

export type LightningAddressDeps = {
  fetch: (
    url: string,
    init: { signal: AbortSignal },
  ) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>;
  decode: (invoice: string) => Promise<NativeInvoiceInfo>;
  sha256Hex: (text: string) => string;
  /** Domaine de démonstration servi par l'API locale (HTTP autorisé pour lui seul). */
  demo: { domain: string; apiUrl: string };
  timeoutMs?: number;
};

export type PayParams = {
  address: string;
  callback: string;
  minSats: number;
  maxSats: number;
  metadata: string;
};

const addressPattern = /^([a-z0-9._+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/;

/** Adresse en minuscules, ou null si elle n'a pas la forme `nom@domaine`. */
export function normalizeAddress(input: string): string | null {
  const value = input
    .trim()
    .replace(/^lightning:/i, '')
    .toLowerCase();
  return addressPattern.test(value) ? value : null;
}

function baseUrlFor(domain: string, demo: LightningAddressDeps['demo']): string {
  return domain === demo.domain.toLowerCase()
    ? demo.apiUrl.replace(/\/+$/, '')
    : `https://${domain}`;
}

async function getJson(
  deps: LightningAddressDeps,
  url: string,
): Promise<Result<Record<string, unknown>>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 20_000);
  try {
    const response = await deps.fetch(url, { signal: controller.signal });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return fail('DESTINATION_INVALID');
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return fail('DESTINATION_INVALID');
    }
    const record = body as Record<string, unknown>;
    // LUD-06 : une erreur peut arriver avec un statut HTTP 200 ou 4xx.
    if (record.status === 'ERROR') return fail('NO_ROUTE');
    if (!response.ok) return fail(response.status === 404 ? 'DESTINATION_INVALID' : 'NO_ROUTE');
    return ok(record);
  } catch {
    // Coupure, délai dépassé ou serveur injoignable : rien n'a été payé.
    return fail('NETWORK_OFFLINE');
  } finally {
    clearTimeout(timer);
  }
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/** Étape 1 : bornes et métadonnées publiées par le domaine de l'adresse. */
export async function fetchPayParams(
  input: string,
  deps: LightningAddressDeps,
): Promise<Result<PayParams>> {
  const address = normalizeAddress(input);
  if (!address) return fail('DESTINATION_INVALID');
  const [name, domain] = address.split('@') as [string, string];
  const base = baseUrlFor(domain, deps.demo);
  const response = await getJson(deps, `${base}/.well-known/lnurlp/${encodeURIComponent(name)}`);
  if (!response.ok) return response;
  const { tag, callback, minSendable, maxSendable, metadata } = response.value;
  if (
    tag !== 'payRequest' ||
    typeof callback !== 'string' ||
    typeof metadata !== 'string' ||
    !Number.isSafeInteger(minSendable) ||
    !Number.isSafeInteger(maxSendable) ||
    (minSendable as number) < 1 ||
    (minSendable as number) > (maxSendable as number)
  ) {
    return fail('DESTINATION_INVALID');
  }
  // Le callback doit rester sur le serveur interrogé : une réponse ne peut pas
  // détourner la demande de facture vers un autre site.
  if (!sameOrigin(callback, base)) return fail('DESTINATION_INVALID');
  return ok({
    address,
    callback,
    minSats: Math.ceil((minSendable as number) / 1000),
    maxSats: Math.floor((maxSendable as number) / 1000),
    metadata,
  });
}

/** Étapes 2 et 3 : facture pour `amountSats`, vérifiée avant d'être rendue. */
export async function requestInvoice(
  params: PayParams,
  amountSats: number,
  deps: LightningAddressDeps,
): Promise<Result<{ paymentRequest: string; info: NativeInvoiceInfo }>> {
  if (
    !Number.isSafeInteger(amountSats) ||
    amountSats < params.minSats ||
    amountSats > params.maxSats
  ) {
    return fail('AMOUNT_INVALID');
  }
  const url = new URL(params.callback);
  url.searchParams.set('amount', String(amountSats * 1000));
  const response = await getJson(deps, url.toString());
  if (!response.ok) return response;
  const pr = response.value.pr;
  if (typeof pr !== 'string' || !/^lnbcrt[0-9a-z]+$/i.test(pr)) {
    return fail(
      typeof pr === 'string' && /^ln/i.test(pr)
        ? 'DESTINATION_WRONG_NETWORK'
        : 'DESTINATION_INVALID',
    );
  }
  let info: NativeInvoiceInfo;
  try {
    info = await deps.decode(pr);
  } catch {
    return fail('DESTINATION_INVALID');
  }
  if (!info.regtest) return fail('DESTINATION_WRONG_NETWORK');
  if (info.expired) return fail('INVOICE_EXPIRED');
  if (info.amountSats !== amountSats) return fail('AMOUNT_INVALID');
  if (info.descriptionHash !== deps.sha256Hex(params.metadata)) return fail('DESTINATION_INVALID');
  return ok({ paymentRequest: pr, info });
}
