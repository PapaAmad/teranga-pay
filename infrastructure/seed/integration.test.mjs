import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checks, runIntegration } from './integration.mjs';

/** Deux nœuds reliés par un canal direct en mémoire, avec factures et soldes. */
function fakeChannel({ terangaSats = 1_000_000, diasporaSats = 3_990_000, tweak = {} } = {}) {
  const invoices = new Map();
  let counter = 0;
  const calls = { pay: 0 };

  function node(name, sats) {
    return {
      name,
      sats,
      async channelSats() {
        return this.sats;
      },
      async createInvoice(amount) {
        counter += 1;
        const hash = counter.toString(16).padStart(64, '0');
        const paymentRequest = `lnbcrt-${name}-${counter}`;
        invoices.set(paymentRequest, { hash, payee: this, amount, state: 'OPEN', paid: 0 });
        return { paymentRequest, hash };
      },
      async lookupInvoice(hash) {
        const invoice = [...invoices.values()].find((item) => item.hash === hash);
        return { state: invoice.state, paidSats: invoice.paid };
      },
      async pay(paymentRequest) {
        calls.pay += 1;
        const invoice = invoices.get(paymentRequest);
        const forced = tweak.pay?.({ node: this, invoice, call: calls.pay });
        if (forced) return forced;
        if (invoice.state === 'SETTLED') return { status: 'FAILED', reason: 'ALREADY_PAID' };
        if (invoice.amount > this.sats) {
          return { status: 'FAILED', reason: 'FAILURE_REASON_INSUFFICIENT_BALANCE' };
        }
        this.sats -= invoice.amount;
        invoice.payee.sats += tweak.credit?.(invoice.amount) ?? invoice.amount;
        invoice.state = 'SETTLED';
        invoice.paid = invoice.amount;
        return { status: 'SUCCEEDED' };
      },
    };
  }
  return { teranga: node('teranga', terangaSats), diaspora: node('diaspora', diasporaSats), calls };
}

const quiet = { log: () => {}, sleep: async () => {} };

describe('runIntegration', () => {
  it('réussit quand les paiements sont réels et exacts', async () => {
    const network = fakeChannel();
    const summary = await runIntegration({ ...network, ...quiet });
    assert.deepEqual(summary, {
      inbound: checks.inboundSats,
      outbound: checks.outboundSats,
      replay: 'refusé',
    });
    assert.equal(network.teranga.sats, 1_000_000 + checks.inboundSats - checks.outboundSats);
  });

  it('réessaie un refus temporaire puis réussit', async () => {
    const network = fakeChannel({
      tweak: {
        pay: ({ call }) =>
          call === 1 ? { status: 'FAILED', reason: 'FAILURE_REASON_NO_ROUTE' } : undefined,
      },
    });
    await runIntegration({ ...network, ...quiet });
    assert.ok(network.calls.pay >= 5);
  });

  it('échoue sur un refus définitif', async () => {
    const network = fakeChannel({
      tweak: {
        pay: () => ({ status: 'FAILED', reason: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS' }),
      },
    });
    await assert.rejects(runIntegration({ ...network, ...quiet }), /paiement refusé/u);
  });

  it('échoue quand les refus temporaires durent trop longtemps', async () => {
    const network = fakeChannel({
      tweak: { pay: () => ({ status: 'FAILED', reason: 'FAILURE_REASON_NO_ROUTE' }) },
    });
    await assert.rejects(
      runIntegration({ ...network, ...quiet, attempts: 3 }),
      /FAILURE_REASON_NO_ROUTE/u,
    );
    assert.equal(network.calls.pay, 3);
  });

  it('échoue quand le receveur ne reçoit pas le montant exact', async () => {
    const network = fakeChannel({ tweak: { credit: (amount) => amount - 1 } });
    await assert.rejects(runIntegration({ ...network, ...quiet }), /au lieu de \+2500/u);
  });

  it('échoue quand une même facture est payée deux fois', async () => {
    const network = fakeChannel({
      tweak: {
        pay: ({ invoice }) => (invoice.state === 'SETTLED' ? { status: 'SUCCEEDED' } : undefined),
      },
    });
    await assert.rejects(
      runIntegration({ ...network, ...quiet }),
      /^Error: Double paiement accepté pour une même facture$/u,
    );
  });

  it('échoue quand un paiement plus gros que le canal est accepté', async () => {
    const network = fakeChannel({
      tweak: {
        pay: ({ invoice }) =>
          invoice.amount === checks.impossibleSats ? { status: 'SUCCEEDED' } : undefined,
      },
    });
    await assert.rejects(
      runIntegration({ ...network, ...quiet }),
      /^Error: Paiement plus gros que le canal accepté$/u,
    );
  });

  it('échoue quand la facture payée n’est pas réglée chez le receveur', async () => {
    const network = fakeChannel();
    const original = network.teranga.lookupInvoice;
    network.teranga.lookupInvoice = async (hash) => ({ ...(await original(hash)), state: 'OPEN' });
    await assert.rejects(runIntegration({ ...network, ...quiet }), /facture non réglée/u);
  });
  it('échoue quand le double paiement est refusé pour une autre raison que « déjà payée »', async () => {
    const network = fakeChannel({
      tweak: {
        pay: ({ invoice }) =>
          invoice.state === 'SETTLED'
            ? { status: 'FAILED', reason: 'FAILURE_REASON_INSUFFICIENT_BALANCE' }
            : undefined,
      },
    });
    await assert.rejects(
      runIntegration({ ...network, ...quiet }),
      /^Error: Double paiement : refus non terminal ou inattendu \(FAILED, FAILURE_REASON_INSUFFICIENT_BALANCE\)$/u,
    );
  });

  it('échoue quand le paiement impossible est refusé comme « déjà payé »', async () => {
    const network = fakeChannel({
      tweak: {
        pay: ({ invoice }) =>
          invoice.amount === checks.impossibleSats
            ? { status: 'FAILED', reason: 'ALREADY_PAID' }
            : undefined,
      },
    });
    await assert.rejects(
      runIntegration({ ...network, ...quiet }),
      /^Error: Paiement impossible : refus non terminal ou inattendu \(FAILED, ALREADY_PAID\)$/u,
    );
  });

  for (const [label, outcome, expected] of [
    ['encore en cours', () => ({ status: 'IN_FLIGHT' }), 'refus non terminal'],
    ['coupé par le réseau', () => Promise.reject(new Error('socket hang up')), 'socket hang up'],
  ]) {
    it(`échoue quand le double paiement est ${label} au lieu d’être refusé`, async () => {
      const network = fakeChannel({
        tweak: { pay: ({ invoice }) => (invoice.state === 'SETTLED' ? outcome() : undefined) },
      });
      await assert.rejects(runIntegration({ ...network, ...quiet }), (error) => {
        assert.match(error.message, new RegExp(expected, 'u'));
        if (expected !== 'socket hang up') assert.match(error.message, /^Double paiement/u);
        return true;
      });
    });

    it(`échoue quand le paiement impossible est ${label} au lieu d’être refusé`, async () => {
      const network = fakeChannel({
        tweak: {
          pay: ({ invoice }) => (invoice.amount === checks.impossibleSats ? outcome() : undefined),
        },
      });
      await assert.rejects(runIntegration({ ...network, ...quiet }), (error) => {
        assert.match(error.message, new RegExp(expected, 'u'));
        if (expected !== 'socket hang up') assert.match(error.message, /^Paiement impossible/u);
        return true;
      });
    });
  }
});
