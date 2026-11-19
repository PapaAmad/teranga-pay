import type { NativeWallet } from '../../modules/teranga-wallet/src';

export type IntegrationData = {
  version: 1;
  address?: { address: string; token: string };
  bridgeToken?: string;
};

export type IntegrationStore = {
  read(): Promise<IntegrationData>;
  update(change: (data: IntegrationData) => IntegrationData): Promise<IntegrationData>;
};

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const bridgeTokenPattern = /^[A-Za-z0-9_-]{32,128}$/;
const addressPattern = /^[a-z0-9][a-z0-9._-]{2,31}@[a-z0-9.-]+$/;

function invalid(): never {
  throw new Error('INTEGRATION_INVALID');
}

/** Secrets de raccordement uniquement ; le coffre garde séparément le PIN et les clés. */
export function parseIntegration(text: string): IntegrationData {
  if (typeof text !== 'string' || text.length > 16_384) invalid();
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const data = value as Record<string, unknown>;
  if (
    data.version !== 1 ||
    Object.keys(data).some((k) => !['version', 'address', 'bridgeToken'].includes(k))
  )
    invalid();
  if (
    'bridgeToken' in data &&
    (typeof data.bridgeToken !== 'string' ||
      !bridgeTokenPattern.test(data.bridgeToken) ||
      /[^A-Za-z0-9_-]/.test(data.bridgeToken))
  )
    invalid();
  if ('address' in data) {
    if (!data.address || typeof data.address !== 'object' || Array.isArray(data.address)) invalid();
    const address = data.address as Record<string, unknown>;
    if (
      Object.keys(address).length !== 2 ||
      typeof address.address !== 'string' ||
      address.address.length > 255 ||
      address.address.trim() !== address.address ||
      !addressPattern.test(address.address) ||
      typeof address.token !== 'string' ||
      address.token.length !== 43 ||
      !tokenPattern.test(address.token)
    )
      invalid();
  }
  return data as IntegrationData;
}

/** Pas de cache de jeton entre sessions, ni de repli vide en cas de chiffrement illisible. */
export function createIntegrationStore(
  native: NativeWallet,
  allowed: () => boolean,
): IntegrationStore {
  let queue: Promise<unknown> = Promise.resolve();
  function check() {
    if (!allowed() || !native.isRunning()) throw new Error('WALLET_LOCKED');
    if (!native.integrationRead || !native.integrationWrite)
      throw new Error('INTEGRATION_UNAVAILABLE');
  }
  async function read() {
    check();
    const raw = await native.integrationRead!();
    check();
    let data = raw === null ? { version: 1 as const } : parseIntegration(raw);
    const imported = await native.integrationImport?.();
    check();
    if (imported != null) {
      const incoming = parseIntegration(imported);
      // Le provisionnement de la passerelle ne remplace jamais l'adresse existante.
      if (incoming.address) invalid();
      data = parseIntegration(JSON.stringify({ ...data, ...incoming }));
      await native.integrationWrite!(JSON.stringify(data));
      check();
    }
    return data;
  }
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation);
    queue = next.catch(() => undefined);
    return next;
  }
  return {
    read: () => serial(read),
    update: (change) =>
      serial(async () => {
        const data = parseIntegration(JSON.stringify(change(await read())));
        check();
        await native.integrationWrite!(JSON.stringify(data));
        check();
        return data;
      }),
  };
}
