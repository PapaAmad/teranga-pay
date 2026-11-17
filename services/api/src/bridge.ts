import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  createBridgeService,
  createBridgeStore,
  createSimulatedProvider,
  type BridgeService,
  type BridgeStore,
  type Scenario,
} from '@teranga-pay/bridge-sim';

export type BridgeRuntime = {
  store: BridgeStore;
  service: BridgeService;
  ownerForAuthorization(header: unknown): string | null;
  close(): void;
};

/** Comptes de démonstration uniquement ; aucune identité ni clé du wallet. */
export function createBridgeRuntime(options: {
  path: string;
  token?: string;
  principals?: readonly { id: string; token: string }[];
  scenario?: Scenario;
  now?: () => number;
}): BridgeRuntime {
  const principals = options.principals ?? [{ id: 'demo-client-a', token: options.token ?? '' }];
  const ids = new Set<string>();
  const tokens = new Set<string>();
  if (!principals.length) throw new Error('BRIDGE_AUTH_CONFIGURATION');
  const hash = (value: string) => createHash('sha256').update(value).digest();
  const credentials = principals.map(({ id, token }) => {
    if (
      !/^demo-[a-z0-9-]{1,40}$/.test(id) ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(token) ||
      ids.has(id) ||
      tokens.has(token)
    )
      throw new Error('BRIDGE_AUTH_CONFIGURATION');
    ids.add(id);
    tokens.add(token);
    return { id, hash: hash(token) };
  });
  if (options.path !== ':memory:') mkdirSync(dirname(resolve(options.path)), { recursive: true });
  const store = createBridgeStore({ path: options.path, now: options.now });
  try {
    for (const { id } of credentials) store.seedAccount(id, 2_000_000);
  } catch (error) {
    store.close();
    throw error;
  }
  const service = createBridgeService({
    store,
    provider: createSimulatedProvider(store, { scenario: options.scenario }),
  });
  let closed = false;
  return {
    store,
    service,
    ownerForAuthorization(header) {
      if (typeof header !== 'string') return null;
      const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(header);
      if (!match) return null;
      const candidate = hash(match[1]!);
      let owner: string | null = null;
      for (const credential of credentials)
        if (timingSafeEqual(candidate, credential.hash)) owner = credential.id;
      return owner;
    },
    close() {
      if (!closed) {
        closed = true;
        store.close();
      }
    },
  };
}
