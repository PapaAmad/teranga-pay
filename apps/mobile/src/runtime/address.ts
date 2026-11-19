import type { NativeWallet } from '../../modules/teranga-wallet/src';
import type { HomeResult } from '../home/ports';
import type { ReceiveAddressPort } from '../receive/ports';
import { registerAddress, startAddressInbox } from '../wallet/addressInbox';
import type { IntegrationStore } from './integration';

type AddressOptions = {
  native: NativeWallet;
  store: IntegrationStore;
  apiUrl: string;
  domain: string;
  allowed(): boolean;
  createToken(): string;
  fetch?: typeof fetch;
};

/** Le téléphone répond aux demandes LNURL seulement pendant la session ouverte. */
export function createRuntimeAddress(
  options: AddressOptions,
): ReceiveAddressPort & { stop(): void } {
  const request = options.fetch ?? fetch;
  let pending: Promise<HomeResult<{ address: string }>> | null = null;
  let inbox: ReturnType<typeof startAddressInbox> | null = null;
  let generation = 0;
  let rejected = false;
  const allowed = () => options.allowed() && options.native.isRunning();
  async function current(): Promise<HomeResult<{ address: string }>> {
    if (!allowed()) return { ok: false, error: { code: 'WALLET_LOCKED' } };
    const epoch = generation;
    try {
      let saved = (await options.store.read()).address;
      if (!saved) {
        const nodeId = await options.native.nodeId();
        if (!/^[0-9a-f]{66}$/i.test(nodeId)) throw new Error('INVALID_DATA');
        if (!allowed() || epoch !== generation) throw new Error('WALLET_LOCKED');
        const address = `tp-${nodeId.slice(0, 24).toLowerCase()}@${options.domain}`;
        saved = (
          await options.store.update((data) =>
            data.address ? data : { ...data, address: { address, token: options.createToken() } },
          )
        ).address!;
      }
      if (!allowed() || epoch !== generation) throw new Error('WALLET_LOCKED');
      if (!saved.address.endsWith(`@${options.domain}`)) throw new Error('INVALID_DATA');
      if (rejected) return { ok: false, error: { code: 'UNAUTHORIZED' } };
      if (!inbox) {
        // Le jeton est acquitté dans le coffre AVANT le POST idempotent. Une
        // réponse perdue ou un verrouillage ne peut donc plus perdre l'adresse.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
        let registration;
        try {
          registration = await registerAddress(
            options.apiUrl,
            saved.address.split('@')[0]!,
            (url, init) => request(url, { ...init, signal: controller.signal, redirect: 'error' }),
            saved.token,
          );
        } finally {
          clearTimeout(timer);
        }
        if (!registration.ok) return { ok: false, error: { code: registration.code } };
        if (registration.address !== saved.address || registration.token !== saved.token)
          throw new Error('INVALID_DATA');
        if (!allowed() || epoch !== generation) throw new Error('WALLET_LOCKED');
        inbox = startAddressInbox({
          apiUrl: options.apiUrl,
          token: saved.token,
          native: options.native,
          fetch: (url, init) => request(url, { ...init, redirect: 'error' }),
          onEvent(event) {
            if (event.type === 'erreur' && event.code === 'UNAUTHORIZED') rejected = true;
          },
        });
      }
      return { ok: true, value: { address: saved.address } };
    } catch (error) {
      return {
        ok: false,
        error: {
          code:
            error instanceof Error && error.message === 'WALLET_LOCKED'
              ? 'WALLET_LOCKED'
              : 'UNKNOWN',
        },
      };
    }
  }
  return {
    current() {
      // Partagé par l'accueil et Recevoir : un seul enregistrement et une seule écoute.
      if (!pending) {
        const run = current();
        pending = run;
        void run.finally(() => {
          if (pending === run) pending = null;
        });
      }
      return pending;
    },
    stop() {
      generation += 1;
      inbox?.stop();
      inbox = null;
      pending = null;
      rejected = false;
    },
  };
}
