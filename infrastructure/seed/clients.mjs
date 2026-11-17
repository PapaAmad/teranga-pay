import { readFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';

export function send(transport, options, body) {
  return new Promise((resolve, reject) => {
    const request = transport.request(options, (response) => {
      let text = '';
      let finished = false;
      response.setEncoding('utf8');
      response.on('data', (chunk) => (text += chunk));
      response.on('end', () => {
        finished = true;
        resolve({ status: response.statusCode ?? 0, text });
      });
      // Une connexion coupée après les en-têtes n'émet pas toujours `end` :
      // sans ce rejet, la promesse resterait pendante et le seed sortirait en succès.
      response.on('error', reject);
      response.on('close', () => {
        if (!finished) reject(new Error('réponse interrompue avant la fin'));
      });
    });
    request.on('error', reject);
    request.setTimeout(60_000, () => request.destroy(new Error('délai dépassé')));
    if (body !== undefined) request.write(body);
    request.end();
  });
}

/** Client JSON-RPC de Bitcoin Core, authentifié par le cookie relu à chaque appel. */
export function bitcoinClient({ host, port = 18443, cookieFile, wallet }) {
  async function call(method, params = [], { useWallet = true } = {}) {
    const cookie = (await readFile(cookieFile, 'utf8')).trim();
    const body = JSON.stringify({ jsonrpc: '1.0', id: method, method, params });
    const { status, text } = await send(
      http,
      {
        host,
        port,
        method: 'POST',
        path: useWallet ? `/wallet/${encodeURIComponent(wallet)}` : '/',
        headers: {
          authorization: `Basic ${Buffer.from(cookie).toString('base64')}`,
          'content-type': 'application/json',
        },
      },
      body,
    );
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`bitcoind ${method} : réponse HTTP ${status} illisible`);
    }
    if (parsed.error) {
      const error = new Error(`bitcoind ${method} : ${parsed.error.message}`);
      error.code = parsed.error.code;
      throw error;
    }
    return parsed.result;
  }

  return {
    async ensureWallet() {
      const loaded = await call('listwallets', [], { useWallet: false });
      if (loaded.includes(wallet)) return 'chargé';
      try {
        await call('loadwallet', [wallet], { useWallet: false });
        return 'rechargé';
      } catch (error) {
        if (error.code !== -18) throw error;
        await call('createwallet', [wallet], { useWallet: false });
        return 'créé';
      }
    },
    height: () => call('getblockcount', [], { useWallet: false }),
    newAddress: () => call('getnewaddress'),
    async spendableSats() {
      const balances = await call('getbalances');
      return Math.round(balances.mine.trusted * 1e8);
    },
    mine: (blocks, address) => call('generatetoaddress', [blocks, address]),
    sendSats: (address, sats) => call('sendtoaddress', [address, sats / 1e8]),
  };
}

/** Client REST d'un nœud LND : certificat TLS et macaroon lus dans son volume. */
export async function lndClient({ name, host, port = 8080, dir }) {
  const ca = await readFile(`${dir}/tls.cert`);
  const macaroon = (await readFile(`${dir}/data/chain/bitcoin/regtest/admin.macaroon`)).toString(
    'hex',
  );

  async function call(method, path, payload) {
    const body = payload === undefined ? undefined : JSON.stringify(payload);
    const { status, text } = await send(
      https,
      {
        host,
        port,
        method,
        path,
        ca,
        servername: host,
        headers: { 'grpc-metadata-macaroon': macaroon, 'content-type': 'application/json' },
      },
      body,
    );
    // /v2/router/send répond par une suite de lignes JSON ; on garde la dernière.
    const lines = text.trim().split('\n').filter(Boolean);
    const last = lines.length > 0 ? JSON.parse(lines.at(-1)) : {};
    if (status >= 400 || last.error || last.code) {
      const message = last.error?.message ?? last.message ?? `HTTP ${status}`;
      throw new Error(`${name} ${method} ${path} : ${message}`);
    }
    return last.result ?? last;
  }

  return {
    name,
    async info() {
      const info = await call('GET', '/v1/getinfo');
      return {
        pubkey: info.identity_pubkey,
        synced: Boolean(info.synced_to_chain),
        height: Number(info.block_height ?? 0),
      };
    },
    async walletSats() {
      const balance = await call('GET', '/v1/balance/blockchain');
      return {
        confirmed: Number(balance.confirmed_balance ?? 0),
        unconfirmed: Number(balance.unconfirmed_balance ?? 0),
      };
    },
    async newAddress() {
      return (await call('GET', '/v1/newaddress?type=WITNESS_PUBKEY_HASH')).address;
    },
    async peers() {
      return ((await call('GET', '/v1/peers')).peers ?? []).map((peer) => peer.pub_key);
    },
    connect: (pubkey, address) =>
      call('POST', '/v1/peers', { addr: { pubkey, host: address }, perm: false }),
    async channels() {
      return ((await call('GET', '/v1/channels')).channels ?? []).map((channel) => ({
        remotePubkey: channel.remote_pubkey,
        active: Boolean(channel.active),
        capacity: Number(channel.capacity ?? 0),
      }));
    },
    async pendingChannels() {
      const pending = await call('GET', '/v1/channels/pending');
      return (pending.pending_open_channels ?? []).map((item) => item.channel.remote_node_pub);
    },
    openChannel: (pubkey, sats, pushSats, { private: isPrivate = false } = {}) =>
      call('POST', '/v1/channels', {
        node_pubkey: Buffer.from(pubkey, 'hex').toString('base64'),
        local_funding_amount: String(sats),
        push_sat: String(pushSats),
        private: isPrivate,
      }),
    async addInvoice(sats, memo) {
      return (await call('POST', '/v1/invoices', { value: String(sats), memo })).payment_request;
    },
    async pay(paymentRequest) {
      const result = await call('POST', '/v2/router/send', {
        payment_request: paymentRequest,
        timeout_seconds: 30,
        fee_limit_sat: '100',
      });
      return { status: result.status, reason: result.failure_reason };
    },
  };
}
