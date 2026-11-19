import type { NativeWallet, NodeSettings } from '../../modules/teranga-wallet/src';
import type { WithdrawJournalPort, WithdrawResult } from '../withdraw/ports';
import { createWithdrawJournal, type WithdrawJournalStorage } from '../withdraw/journal';
import { createRuntimeApi, runtimeApiOrigin, type RuntimeApiConfig } from './api';
import { createRuntimeAddress } from './address';
import { createIntegrationStore } from './integration';
import { createWalletServices } from './wallet';

export type RuntimeOptions = {
  native: NativeWallet | null;
  settings: NodeSettings;
  apiUrl: string;
  domain: string;
  createKey(): string;
  createAddressToken(): string;
  fetch?: RuntimeApiConfig['fetch'];
  addressFetch?: typeof fetch;
  journalStorage?: WithdrawJournalStorage;
};

/** Racine unique des services métier ; les ateliers ne passent jamais par cette composition. */
export function createAppRuntime(options: RuntimeOptions) {
  let active = true;
  let authenticated = false;
  const native =
    options.native?.integrationRead && options.native.integrationWrite ? options.native : null;
  const allowed = () => active && authenticated;
  const origin = runtimeApiOrigin(options.apiUrl);
  const store = native ? createIntegrationStore(native, allowed) : null;
  const api = createRuntimeApi({
    baseUrl: options.apiUrl,
    fetch: options.fetch,
    bridgeToken: async () => {
      if (!store || !allowed()) return null;
      return (await store.read()).bridgeToken ?? null;
    },
  });
  const services = createWalletServices({
    native,
    settings: options.settings,
    rates: api.rates,
    risk: api.risk,
  });
  const address =
    native && store && origin
      ? createRuntimeAddress({
          native,
          store,
          apiUrl: origin,
          domain: options.domain,
          allowed,
          createToken: options.createAddressToken,
          fetch: options.addressFetch,
        })
      : null;
  const stop = services.wallet?.subscribe((event) => {
    if (event.type !== 'etat') return;
    authenticated = event.state === 'pret' || event.state === 'hors_ligne';
    if (!authenticated) {
      address?.stop();
      api.cancelPending();
    }
    // L'écoute commence dès le déverrouillage, pas seulement sur l'écran Recevoir.
    else if (active) void address?.current();
  });

  async function journal(): Promise<WithdrawJournalPort> {
    if (!native || !store || !allowed()) throw new Error('WALLET_LOCKED');
    const token = (await store.read()).bridgeToken;
    if (!token) throw new Error('UNAUTHORIZED');
    const identity = await native.nodeId();
    if (!allowed()) throw new Error('WALLET_LOCKED');
    const scope = native
      .sha256Hex(`${identity}:${new URL(options.apiUrl).origin}:demo-client-a`)
      .slice(0, 48);
    return createWithdrawJournal(scope, options.journalStorage);
  }
  async function journalResult<T>(
    operation: (port: WithdrawJournalPort) => Promise<WithdrawResult<T>>,
  ): Promise<WithdrawResult<T>> {
    try {
      return await operation(await journal());
    } catch (error) {
      return {
        ok: false,
        error: {
          code:
            error instanceof Error && ['WALLET_LOCKED', 'UNAUTHORIZED'].includes(error.message)
              ? error.message
              : 'JOURNAL_READ_FAILED',
        },
      };
    }
  }
  const withdrawJournal: WithdrawJournalPort = {
    load: () => journalResult((port) => port.load()),
    save: (intent) => journalResult((port) => port.save(intent)),
    clear: (key) => journalResult((port) => port.clear(key)),
  };

  return {
    props: {
      onboardingServices: services.onboarding,
      homeServices: services.home,
      receiveServices:
        native && services.wallet && address
          ? { mode: 'native' as const, wallet: services.wallet, address }
          : { mode: 'unavailable' as const },
      sendServices: services.send,
      collectServices: services.collect,
      historyServices: native
        ? { ...services.history, withdrawals: api.withdrawals }
        : services.history,
      withdrawServices: native
        ? {
            mode: 'simulation' as const,
            bridge: api.bridge,
            journal: withdrawJournal,
            createKey: options.createKey,
          }
        : { mode: 'unavailable' as const },
      sessionWallet: services.wallet ?? undefined,
    },
    async setActive(value: boolean) {
      active = value;
      if (!value) {
        authenticated = false;
        api.cancelPending();
        address?.stop();
        await services.wallet?.lock();
      }
    },
    dispose() {
      active = false;
      authenticated = false;
      stop?.();
      address?.stop();
      api.dispose();
      void services.wallet?.lock().catch(() => undefined);
    },
  };
}
