import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { amounts, runSeed } from './seed.mjs';

/** Faux réseau regtest en mémoire : blocs, fonds, pairs et canaux. */
function fakeNetwork({ payResults = [], activateChannels = true } = {}) {
  const calls = { mine: 0, send: 0, connect: 0, open: 0, pay: 0 };
  const chain = { height: 0, minerSats: 0, pendingSends: [] };
  const pendingChannels = [];

  function node(name, pubkey) {
    return {
      name,
      pubkey,
      sats: 0,
      pendingSats: 0,
      peerSet: new Set(),
      channelList: [],
      async info() {
        return { pubkey, synced: true, height: chain.height };
      },
      async walletSats() {
        return { confirmed: this.sats, unconfirmed: this.pendingSats };
      },
      async newAddress() {
        return `adresse-${name}`;
      },
      async peers() {
        return [...this.peerSet];
      },
      async connect(key) {
        calls.connect += 1;
        this.peerSet.add(key);
      },
      async channels() {
        return this.channelList;
      },
      async pendingChannels() {
        return pendingChannels.filter((c) => c.from === this).map((c) => c.to);
      },
      async openChannel(key, sats) {
        if (this.sats < sats) throw new Error('fonds confirmés insuffisants');
        calls.open += 1;
        this.sats -= sats;
        pendingChannels.push({ from: this, to: key, sats });
      },
      async addInvoice() {
        return 'lnbcrt-fictive';
      },
      async pay() {
        calls.pay += 1;
        return payResults.shift() ?? { status: 'SUCCEEDED' };
      },
    };
  }

  const teranga = node('teranga', '02teranga');
  const diaspora = node('diaspora', '03diaspora');
  const byAddress = { 'adresse-teranga': teranga, 'adresse-diaspora': diaspora };

  const bitcoin = {
    async ensureWallet() {
      return 'créé';
    },
    async height() {
      return chain.height;
    },
    async newAddress() {
      return 'adresse-mineur';
    },
    async spendableSats() {
      return chain.minerSats;
    },
    async mine(blocks) {
      calls.mine += 1;
      chain.height += blocks;
      chain.minerSats += blocks >= 101 ? 50 * 100_000_000 : 0;
      for (const { address, sats } of chain.pendingSends.splice(0)) {
        byAddress[address].sats += sats;
        byAddress[address].pendingSats -= sats;
      }
      for (const channel of pendingChannels.splice(0)) {
        channel.from.channelList.push({
          remotePubkey: channel.to,
          active: activateChannels,
          capacity: channel.sats,
        });
      }
    },
    async sendSats(address, sats) {
      calls.send += 1;
      chain.minerSats -= sats;
      chain.pendingSends.push({ address, sats });
      byAddress[address].pendingSats += sats; // non confirmé jusqu'au prochain bloc
    },
  };

  return { bitcoin, teranga, diaspora, calls, pendingChannels };
}

const quiet = { log: () => {}, sleep: async () => {}, attempts: 5 };

describe('initialisation du réseau regtest', () => {
  it('prépare un réseau vide puis ne refait rien à la relance', async () => {
    const network = fakeNetwork();
    const first = await runSeed({ ...network, ...quiet });
    assert.equal(first.channelOpened, true);
    assert.deepEqual(first.fundedNodes, ['teranga', 'diaspora']);
    assert.equal(first.payment, 'réussi');
    assert.equal(network.calls.send, 2);
    assert.equal(network.calls.open, 1);
    assert.equal(network.calls.connect, 1);
    assert.ok(network.diaspora.channelList[0].active);
    assert.equal(network.diaspora.channelList[0].capacity, amounts.channelSats);

    const second = await runSeed({ ...network, ...quiet });
    assert.deepEqual(second, {
      minedBlocks: 0,
      fundedNodes: [],
      channelOpened: false,
      payment: 'réussi',
    });
    assert.equal(network.calls.send, 2, 'aucun nouvel envoi de fonds');
    assert.equal(network.calls.open, 1, 'aucun canal en double');
    assert.equal(network.calls.connect, 1);
  });

  it("confirme un canal en attente au lieu d'en ouvrir un second", async () => {
    const network = fakeNetwork();
    network.teranga.sats = amounts.nodeFundingSats;
    network.diaspora.sats = amounts.nodeFundingSats;
    network.diaspora.peerSet.add('02teranga');
    network.pendingChannels.push({ from: network.diaspora, to: '02teranga', sats: 1 });
    const summary = await runSeed({ ...network, ...quiet, verifyPayment: false });
    assert.equal(network.calls.open, 0);
    assert.equal(summary.channelOpened, false);
    assert.equal(network.diaspora.channelList.length, 1);
    assert.equal(summary.payment, 'ignoré');
  });

  it('réessaie le paiement tant que le canal vient juste de s’activer', async () => {
    const network = fakeNetwork({
      payResults: [
        { status: 'FAILED', reason: 'FAILURE_REASON_INSUFFICIENT_BALANCE' },
        { status: 'FAILED', reason: 'FAILURE_REASON_NO_ROUTE' },
      ],
    });
    const summary = await runSeed({ ...network, ...quiet });
    assert.equal(summary.payment, 'réussi');
    assert.equal(network.calls.pay, 3);
  });

  it('échoue immédiatement sur un refus de paiement non temporaire', async () => {
    const network = fakeNetwork({
      payResults: [{ status: 'FAILED', reason: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS' }],
    });
    await assert.rejects(runSeed({ ...network, ...quiet }), /INCORRECT_PAYMENT_DETAILS/);
    assert.equal(network.calls.pay, 1);
  });

  it('abandonne avec un message clair si le canal ne devient jamais actif', async () => {
    const network = fakeNetwork({ activateChannels: false });
    await assert.rejects(runSeed({ ...network, ...quiet }), /Délai dépassé : activation du canal/);
  });
});

describe('reprise après interruption', () => {
  it('confirme un virement déjà diffusé sans le renvoyer', async () => {
    const network = fakeNetwork();
    // Première exécution interrompue juste après les deux envois, avant le minage.
    await network.bitcoin.mine(101);
    await network.bitcoin.sendSats('adresse-teranga', amounts.nodeFundingSats);
    await network.bitcoin.sendSats('adresse-diaspora', amounts.nodeFundingSats);
    const sendsBefore = network.calls.send;
    const summary = await runSeed({ ...network, ...quiet, verifyPayment: false });
    assert.equal(network.calls.send, sendsBefore, 'aucun second envoi');
    assert.deepEqual(summary.fundedNodes, []);
    assert.ok(summary.minedBlocks >= amounts.confirmations, 'les virements sont confirmés');
    assert.equal(summary.channelOpened, true);
  });
});

describe('données fictives', () => {
  it('reprend les trois personnages sans numéro attribuable', async () => {
    const { readFile } = await import('node:fs/promises');
    const data = JSON.parse(await readFile(new URL('./demo-data.json', import.meta.url), 'utf8'));
    assert.deepEqual(
      data.personas.map((p) => p.id),
      ['awa', 'mame', 'ousmane'],
    );
    for (const persona of data.personas) {
      if (persona.telephoneFictif) assert.match(persona.telephoneFictif, /^\+221 00 /);
    }
  });
});
