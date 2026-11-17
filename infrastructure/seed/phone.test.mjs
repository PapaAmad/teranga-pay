import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { openPhoneChannel, payFromDiaspora } from './phone.mjs';

const phone = `02${'a'.repeat(64)}`;

function fakes({ connected = true, activateAfter = 1 } = {}) {
  const calls = { open: [], mine: 0 };
  let channels = [];
  let pending = [];
  let checks = 0;
  const teranga = {
    async peers() {
      return connected ? [phone] : [];
    },
    async channels() {
      checks += 1;
      if (pending.length > 0 && checks > activateAfter) {
        channels = pending.map((pubkey) => ({ remotePubkey: pubkey, active: true }));
        pending = [];
      }
      return channels;
    },
    async pendingChannels() {
      return pending;
    },
    async openChannel(pubkey, sats, push, options) {
      calls.open.push({ pubkey, sats, push, options });
      pending.push(pubkey);
    },
  };
  const bitcoin = {
    async newAddress() {
      return 'adresse';
    },
    async mine() {
      calls.mine += 1;
    },
  };
  return { teranga, bitcoin, calls };
}

const quiet = { log: () => {}, sleep: async () => {}, attempts: 5 };

describe('canal vers le téléphone', () => {
  it('ouvre un canal privé sans fonds poussés puis ne le duplique pas', async () => {
    const { teranga, bitcoin, calls } = fakes();
    assert.deepEqual(await openPhoneChannel({ bitcoin, teranga, pubkey: phone, ...quiet }), {
      opened: true,
    });
    assert.deepEqual(calls.open, [
      { pubkey: phone, sats: 2_000_000, push: 0, options: { private: true } },
    ]);
    assert.deepEqual(await openPhoneChannel({ bitcoin, teranga, pubkey: phone, ...quiet }), {
      opened: false,
    });
    assert.equal(calls.open.length, 1);
  });

  it('demande d’ouvrir l’application si le téléphone n’est pas connecté', async () => {
    const { teranga, bitcoin, calls } = fakes({ connected: false });
    await assert.rejects(
      openPhoneChannel({ bitcoin, teranga, pubkey: phone, ...quiet }),
      /pas connecté/,
    );
    assert.equal(calls.open.length, 0);
  });

  it('refuse une clé mal formée', async () => {
    const { teranga, bitcoin } = fakes();
    await assert.rejects(
      openPhoneChannel({ bitcoin, teranga, pubkey: 'abc', ...quiet }),
      /invalide/,
    );
  });

  it('abandonne si le canal ne devient jamais actif', async () => {
    const { teranga, bitcoin } = fakes({ activateAfter: 100 });
    await assert.rejects(
      openPhoneChannel({ bitcoin, teranga, pubkey: phone, ...quiet }),
      /Délai dépassé/,
    );
  });
});

describe('paiement depuis diaspora', () => {
  it('paie une facture regtest et refuse le reste', async () => {
    const diaspora = { pay: async () => ({ status: 'SUCCEEDED' }) };
    await payFromDiaspora({ diaspora, invoice: 'lnbcrt10u1pexemple', log: () => {} });
    await assert.rejects(
      payFromDiaspora({ diaspora, invoice: 'lnbc10u1pmainnet', log: () => {} }),
      /regtest/,
    );
    const failing = { pay: async () => ({ status: 'FAILED', reason: 'FAILURE_REASON_NO_ROUTE' }) };
    await assert.rejects(
      payFromDiaspora({ diaspora: failing, invoice: 'lnbcrt1pexemple', log: () => {} }),
      /NO_ROUTE/,
    );
  });
});
