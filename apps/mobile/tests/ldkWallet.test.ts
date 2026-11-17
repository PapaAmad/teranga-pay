import type {
  NativeInvoiceInfo,
  NativePayment,
  NativeWallet,
  NativeWalletEvent,
  PinResult,
} from '../modules/teranga-wallet/src';
import type { WalletEvent } from '@teranga-pay/contracts';
import { createJournal, journalFor, parseJournal } from '../src/wallet/journal';
import { createLdkWallet, failureCode, maxFeeFor, toErrorCode } from '../src/wallet/ldkWallet';

const settings = {
  electrumUrl: 'tcp://10.0.2.2:50001',
  peerId: `02${'b'.repeat(64)}`,
  peerAddress: '10.0.2.2:9735',
};
const pin = '135790';
const codedError = (code: string) => Object.assign(new Error(code), { code });

/** Hachage factice et déterministe : les tests ne comparent que des égalités. */
const fakeSha256 = (text: string) => `sha256(${text})`;

/** Faux module natif : reproduit les réponses du module Kotlin. */
function fakeNative({ invoices = new Map<string, Partial<NativeInvoiceInfo>>() } = {}) {
  let created = false;
  let running = false;
  let attempts = 0;
  const payments: NativePayment[] = [];
  const sends: { invoice: string; amountSats: number | null; maxFeeSats: number | null }[] = [];
  let listener: ((event: NativeWalletEvent) => void) | null = null;
  let journalText: string | null = null;
  let invoiceCount = 0;
  /** Réserve de canal : comptée dans le total, jamais envoyable. */
  let reserveSats = 0;
  let sendStatus: NativePayment['status'] | null = null;
  const pinCheck = (candidate: string): PinResult => {
    if (candidate === pin) {
      attempts = 0;
      return { ok: true };
    }
    attempts += 1;
    return attempts >= 5
      ? { ok: false, code: 'PIN_LOCKED', retryAfterSeconds: 30 }
      : { ok: false, code: 'PIN_INVALID', attemptsLeft: 5 - attempts };
  };
  const native: NativeWallet = {
    exists: () => created,
    isRunning: () => running,
    setScreenSecure: jest.fn(async () => true),
    create: jest.fn(async () => {
      if (created) throw codedError('WALLET_EXISTS');
      created = true;
      return Array.from({ length: 12 }, (_, i) => `mot${i}`);
    }),
    restore: jest.fn(async () => {
      created = true;
    }),
    unlock: jest.fn(async (candidate: string) => {
      const result = pinCheck(candidate);
      if (result.ok) running = true;
      return result;
    }),
    verifyPin: jest.fn(async (candidate: string) => pinCheck(candidate)),
    lock: jest.fn(async () => {
      running = false;
    }),
    nodeId: jest.fn(async () => `03${'c'.repeat(64)}`),
    balance: jest.fn(async () => {
      if (!running) throw codedError('WALLET_LOCKED');
      const lightningSats = payments.reduce(
        (sum, p) =>
          p.status !== 'reussi'
            ? sum
            : sum + (p.direction === 'recu' ? p.amountSats : -p.amountSats - p.feeSats),
        0,
      );
      return {
        lightningSats,
        spendableSats: Math.max(0, lightningSats - reserveSats),
        outboundSats: Math.max(0, lightningSats - reserveSats),
        inboundSats: 0,
        onchainSats: 0,
        channelsReady: 1,
      };
    }),
    receive: jest.fn(async (amountSats: number | null) => {
      invoiceCount += 1;
      const paymentId = `hash-${invoiceCount}`;
      // Comme LDK : une entrée « en attente » existe dès la création de la facture.
      payments.push({
        id: paymentId,
        direction: 'recu',
        status: 'en_attente',
        amountSats: amountSats ?? 0,
        feeSats: 0,
        updatedAt: 1_700_000_000 + invoiceCount,
      });
      return { paymentRequest: `lnbcrt${amountSats ?? 0}fausse`, paymentId };
    }),
    decode: jest.fn(async (invoice: string) => {
      if (invoice.includes('illisible')) throw codedError('DESTINATION_INVALID');
      return {
        amountSats: invoice.includes('sansmontant') ? null : 2_000,
        expiresAt: 1_800_000_000,
        expired: invoice.includes('expiree'),
        regtest: invoice.startsWith('lnbcrt'),
        payee: invoice.includes('awa') ? 'awa' : 'autre',
        paymentHash: `empreinte-${invoice}`,
        descriptionHash: null,
        ...invoices.get(invoice),
      };
    }),
    send: jest.fn(async (invoice: string, amountSats: number | null, maxFeeSats: number | null) => {
      sends.push({ invoice, amountSats, maxFeeSats });
      if (invoice.includes('coupure')) {
        // Arrêt brutal pendant l'appel : LDK a enregistré l'envoi (identifié par le
        // hash de la facture), mais l'application n'a jamais reçu la réponse.
        payments.push({
          id: `empreinte-${invoice}`,
          direction: 'envoye',
          status: 'en_attente',
          amountSats: invoices.get(invoice)?.amountSats ?? 2_000,
          feeSats: 0,
          updatedAt: 1_700_000_100,
        });
        throw codedError('UNKNOWN');
      }
      const id = `envoi-${sends.length}`;
      payments.push({
        id,
        direction: 'envoye',
        status:
          sendStatus ??
          (invoice.includes('echec')
            ? 'echoue'
            : invoice.includes('lent')
              ? 'en_attente'
              : 'reussi'),
        amountSats: amountSats ?? invoices.get(invoice)?.amountSats ?? 2_000,
        feeSats: 3,
        updatedAt: 1_700_000_100 + sends.length,
        failureReason: invoice.includes('echecexpire')
          ? 'PAYMENT_EXPIRED'
          : invoice.includes('echec')
            ? 'ROUTE_NOT_FOUND'
            : null,
      });
      return id;
    }),
    sha256Hex: fakeSha256,
    payments: jest.fn(async () => payments.map((payment) => ({ ...payment }))),
    journalRead: jest.fn(async () => journalText),
    journalWrite: jest.fn(async (text: string) => {
      journalText = text;
    }),
    addListener: jest.fn((_name, callback) => {
      listener = callback;
      return { remove: () => (listener = null) };
    }),
  };
  return {
    native,
    sends,
    payments,
    setReserve(sats: number) {
      reserveSats = sats;
    },
    /** Les prochains envois restent dans cet état (par défaut : issue immédiate). */
    setSendStatus(status: NativePayment['status'] | null) {
      sendStatus = status;
    },
    /** Change l'état d'un paiement natif et émet l'événement LDK correspondant. */
    settle(id: string, status: 'reussi' | 'echoue') {
      const payment = payments.find((entry) => entry.id === id);
      if (!payment) throw new Error(`paiement ${id} inconnu`);
      payment.status = status;
      payment.updatedAt += 10;
      if (status === 'echoue') listener?.({ type: 'paiement_echoue', id, reason: null });
      else if (payment.direction === 'recu') {
        listener?.({ type: 'paiement_recu', id, amountSats: payment.amountSats });
      } else listener?.({ type: 'paiement_envoye', id });
    },
    receiveFromDiaspora(amountSats: number) {
      const id = `recu-${payments.length}`;
      payments.push({
        id,
        direction: 'recu',
        status: 'reussi',
        amountSats,
        feeSats: 0,
        updatedAt: 1_700_000_000,
      });
      listener?.({ type: 'paiement_recu', id, amountSats });
    },
  };
}

let xofPerBtc = 45_000_000;
const options = {
  rate: () => ({
    xofPerBtc,
    source: 'fixe' as const,
    fetchedAt: '2026-11-07T12:00:00.000Z',
  }),
  sleep: async () => undefined,
};

describe('wallet LDK Node (adaptateur du contrat T11)', () => {
  it('crée, déverrouille et reçoit un paiement de la diaspora', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, options);
    expect(await wallet.state()).toBe('absent');
    const created = await wallet.create(pin);
    expect(created.ok && created.value.recoveryWords).toHaveLength(12);
    expect(fake.native.unlock).toHaveBeenCalledWith(pin, settings);
    expect(await wallet.state()).toBe('pret');

    const events: string[] = [];
    const unsubscribe = wallet.subscribe((event) => events.push(event.type));
    const invoice = await wallet.receive({ amountSats: 10_000 });
    expect(invoice.ok && invoice.value.paymentRequest).toBe('lnbcrt10000fausse');
    fake.receiveFromDiaspora(10_000);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(['paiement', 'solde']);
    const balance = await wallet.balance();
    expect(balance.ok && balance.value).toMatchObject({
      spendableSats: 10_000,
      spendableXof: 4_500,
    });
    unsubscribe();
  });

  it('refuse un PIN mal formé sans appeler le natif et relaie les essais restants', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, options);
    expect(await wallet.create('12ab')).toEqual({ ok: false, error: { code: 'PIN_FORMAT' } });
    expect(fake.native.create).not.toHaveBeenCalled();
    await wallet.create(pin);
    await wallet.lock();
    expect(await wallet.unlock('000000')).toEqual({
      ok: false,
      error: { code: 'PIN_INVALID', attemptsLeft: 4 },
    });
    expect(await wallet.balance()).toEqual({ ok: false, error: { code: 'WALLET_LOCKED' } });
  });

  it('revérifie le PIN, borne les frais et attend la confirmation de l’envoi', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, options);
    await wallet.create(pin);
    fake.receiveFromDiaspora(50_000);

    const refused = await wallet.send({ destination: 'lnbcrtawa', pin: '999999' });
    expect(refused).toEqual({ ok: false, error: { code: 'PIN_INVALID', attemptsLeft: 4 } });
    expect(fake.sends).toHaveLength(0);

    const preview = await wallet.preview('lnbcrtawa');
    expect(preview.ok && preview.value).toMatchObject({
      amountSats: 2_000,
      maxFeeSats: 20,
      newRecipient: true,
    });

    const sent = await wallet.send({ destination: 'lightning:lnbcrtawa', pin });
    expect(sent.ok && sent.value).toMatchObject({
      direction: 'envoye',
      amountSats: 2_000,
      feeSats: 3,
    });
    expect(fake.sends[0]).toEqual({ invoice: 'lnbcrtawa', amountSats: null, maxFeeSats: 20 });
    const again = await wallet.preview('lnbcrtawa');
    expect(again.ok && again.value.newRecipient).toBe(false);
  });

  it('renvoie des codes pour les destinations refusées', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, options);
    await wallet.create(pin);
    const code = async (destination: string, amountSats?: number) => {
      const result = await wallet.preview(destination, amountSats);
      return result.ok ? 'ok' : result.error.code;
    };
    expect(await code('lnbc1mainnet')).toBe('DESTINATION_WRONG_NETWORK');
    expect(await code('lnbcrtexpiree')).toBe('INVOICE_EXPIRED');
    expect(await code('lnbcrtillisible')).toBe('DESTINATION_INVALID');
    expect(await code('lnbcrtawa', 5)).toBe('AMOUNT_INVALID');
    expect(await code('lnbcrtsansmontant')).toBe('ok');
    fake.receiveFromDiaspora(50_000);
    const failed = await wallet.send({ destination: 'lnbcrtawaechec', pin });
    expect(failed).toEqual({ ok: false, error: { code: 'NO_ROUTE' } });
  });

  it('pagine l’historique par identifiant, sans perdre d’opération', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, options);
    await wallet.create(pin);
    fake.receiveFromDiaspora(1);
    fake.receiveFromDiaspora(2);
    fake.receiveFromDiaspora(3);
    const first = await wallet.history({ limit: 2 });
    expect(first.ok && first.value).toHaveLength(2);
    const last = first.ok ? first.value[1]?.id : undefined;
    const second = await wallet.history({ limit: 2, before: last });
    expect(second.ok && second.value).toHaveLength(1);
  });
});

describe('remarques de relecture T16/T22', () => {
  beforeEach(() => {
    xofPerBtc = 45_000_000;
  });
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('ne présente comme disponible que la capacité réellement envoyable', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, options);
    await wallet.create(pin);
    fake.receiveFromDiaspora(10_000);
    fake.setReserve(1_000);
    const balance = await wallet.balance();
    expect(balance.ok && balance.value).toMatchObject({
      spendableSats: 9_000,
      pendingSats: 1_000,
      spendableXof: 4_050,
    });
  });

  it('garde la valeur FCFA du moment du paiement, même après redémarrage', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, options);
    await wallet.create(pin);
    wallet.subscribe(() => undefined);
    fake.receiveFromDiaspora(100_000);
    await flush();
    xofPerBtc = 50_000_000;
    const later = await wallet.history();
    expect(later.ok && later.value[0]?.amountXof).toBe(45_000);

    const reopened = createLdkWallet(fake.native, settings, options);
    const afterRestart = await reopened.history();
    expect(afterRestart.ok && afterRestart.value[0]?.amountXof).toBe(45_000);

    // Paiement jamais vu par l'application : aucune valeur inventée au cours actuel.
    fake.receiveFromDiaspora(20_000);
    const unknown = await reopened.history();
    const byId = new Map(unknown.ok ? unknown.value.map((p) => [p.id, p.amountXof]) : []);
    expect(Object.fromEntries(byId)).toEqual({ 'recu-0': 45_000, 'recu-1': null });
  });

  it('publie l’échec d’un envoi resté en attente', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, { ...options, paymentTimeoutMs: 0 });
    await wallet.create(pin);
    fake.receiveFromDiaspora(50_000);
    fake.setSendStatus('en_attente');
    const sent = await wallet.send({ destination: 'lnbcrtawa', pin });
    expect(sent).toEqual({
      ok: false,
      // Même identifiant que l'événement qui arrivera ensuite : l'écran peut le suivre.
      error: { code: 'PAYMENT_TIMEOUT', paymentId: 'envoi-1' },
    });

    const events: WalletEvent[] = [];
    wallet.subscribe((event) => events.push(event));
    fake.settle('envoi-1', 'echoue');
    await flush();
    expect(events.map((event) => event.type)).toEqual(['paiement', 'solde']);
    expect(events[0]).toMatchObject({
      type: 'paiement',
      payment: { id: 'envoi-1', status: 'echoue', failure: 'NO_ROUTE' },
    });
  });

  it('relie la facture à son règlement exact et garde le prix du devis', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, options);
    await wallet.create(pin);
    wallet.subscribe(() => undefined);
    const sale = await wallet.receive({ amountSats: 5_556, amountXof: 2_500, expiresInSecs: 300 });
    const other = await wallet.receive({ amountSats: 5_556, amountXof: 2_500 });
    if (!sale.ok || !other.ok) throw new Error('facture non créée');
    expect(fake.native.receive).toHaveBeenNthCalledWith(1, 5_556, 'Teranga Pay', 300);
    expect(sale.value.paymentId).not.toBe(other.value.paymentId);

    const waiting = await wallet.lookupInvoice(sale.value.paymentId);
    expect(waiting).toEqual({ ok: true, value: { invoice: sale.value, payment: null } });
    // Une facture non réglée n'est pas une opération de l'historique.
    const empty = await wallet.history();
    expect(empty.ok && empty.value).toEqual([]);

    fake.settle(other.value.paymentId, 'reussi');
    await flush();
    const still = await wallet.lookupInvoice(sale.value.paymentId);
    expect(still.ok && still.value?.payment).toBeNull();

    xofPerBtc = 50_000_000;
    fake.settle(sale.value.paymentId, 'reussi');
    await flush();
    // Relue après redémarrage, la vente garde son lien et le prix FCFA du devis.
    const reopened = createLdkWallet(fake.native, settings, options);
    const paid = await reopened.lookupInvoice(sale.value.paymentId);
    expect(paid.ok && paid.value?.payment).toMatchObject({
      id: sale.value.paymentId,
      status: 'reussi',
      amountXof: 2_500,
    });
    expect(await reopened.lookupInvoice('inconnu')).toEqual({ ok: true, value: null });
  });

  it('refuse une durée de facture hors bornes sans appeler le natif', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, options);
    await wallet.create(pin);
    for (const expiresInSecs of [59, 3_601, 1.5]) {
      expect(await wallet.receive({ amountSats: 100, expiresInSecs })).toEqual({
        ok: false,
        error: { code: 'EXPIRY_INVALID' },
      });
    }
    expect(fake.native.receive).not.toHaveBeenCalled();
  });
});

describe('journal', () => {
  it('repart vide sur un fichier illisible et ignore les valeurs invalides', () => {
    expect(parseJournal('pas du json')).toEqual({ version: 1, xof: {}, invoices: {}, sends: {} });
    expect(
      parseJournal(JSON.stringify({ version: 1, sends: { 'a|1': 'id-1', 'b|2': '', 'c|3': 7 } }))
        .sends,
    ).toEqual({ 'a|1': 'id-1' });
    expect(parseJournal(JSON.stringify({ version: 2, xof: { a: 1 } })).xof).toEqual({});
    const data = parseJournal(
      JSON.stringify({ version: 1, xof: { a: 10, b: -1, c: 1.5, d: null }, invoices: {} }),
    );
    expect(data.xof).toEqual({ a: 10, d: null });
  });

  it('enchaîne les écritures sans en perdre', async () => {
    let stored: string | null = null;
    const journal = createJournal({
      journalRead: async () => stored,
      journalWrite: async (text) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        stored = text;
      },
    });
    await Promise.all(
      ['a', 'b', 'c'].map((id, index) =>
        journal.update((data) => {
          data.xof[id] = index;
        }),
      ),
    );
    expect(parseJournal(stored).xof).toEqual({ a: 0, b: 1, c: 2 });
  });
});

describe('relecture du 11 novembre', () => {
  it('deux adaptateurs ouverts ensemble ne s’effacent pas leurs données', async () => {
    const fake = fakeNative();
    const first = createLdkWallet(fake.native, settings, options);
    await first.create(pin);
    const second = createLdkWallet(fake.native, settings, options);
    await second.history(); // charge le journal avant la facture du premier
    const invoice = await first.receive({ amountSats: 1_000, amountXof: 450 });
    const paymentId = invoice.ok ? invoice.value.paymentId : '';
    second.subscribe(() => undefined);
    fake.receiveFromDiaspora(5_000); // le second écrit le journal
    await new Promise((resolve) => setTimeout(resolve, 0));
    const restarted = createLdkWallet(fake.native, settings, options);
    const found = await restarted.lookupInvoice(paymentId);
    expect(found.ok && found.value?.invoice.amountXof).toBe(450);
    expect(journalFor(fake.native)).toBe(journalFor(fake.native));
  });

  it('refuse un plafond de frais négatif, non entier ou NaN sans appeler le natif', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, options);
    await wallet.create(pin);
    fake.receiveFromDiaspora(100_000);
    for (const maxFeeSats of [-5_000, 1.5, Number.NaN]) {
      const result = await wallet.send({ destination: 'lnbcrtawa', pin, maxFeeSats });
      expect(result).toEqual({ ok: false, error: { code: 'AMOUNT_INVALID' } });
    }
    expect(fake.sends).toHaveLength(0);
    const fine = await wallet.send({ destination: 'lnbcrtawa', pin, maxFeeSats: 0 });
    expect(fine.ok).toBe(true);
  });

  it('réessaie la lecture du journal après un échec', async () => {
    let fails = 1;
    const journal = createJournal({
      journalRead: async () => {
        if (fails-- > 0) throw new Error('disque occupé');
        return JSON.stringify({ version: 1, xof: { a: 5 }, invoices: {} });
      },
      journalWrite: async () => undefined,
    });
    await expect(journal.read()).rejects.toThrow('disque occupé');
    expect((await journal.read()).xof).toEqual({ a: 5 });
  });

  it('ne garde pas une modification dont l’écriture a échoué', async () => {
    let stored: string | null = null;
    let failNext = true;
    const journal = createJournal({
      journalRead: async () => stored,
      journalWrite: async (text) => {
        if (failNext) {
          failNext = false;
          throw new Error('disque plein');
        }
        stored = text;
      },
    });
    await expect(
      journal.update((data) => {
        data.xof.perdu = 1;
      }),
    ).rejects.toThrow('disque plein');
    expect((await journal.read()).xof).toEqual({});
    await journal.update((data) => {
      data.xof.garde = 2;
    });
    expect(parseJournal(stored).xof).toEqual({ garde: 2 });
  });

  it('note la valeur FCFA d’un paiement récent reçu sans écran à l’écoute', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, {
      ...options,
      now: () => 1_700_000_000_000 + 60_000,
    });
    await wallet.create(pin);
    fake.receiveFromDiaspora(100_000); // horodaté à 1 700 000 000 s, il y a une minute
    const history = await wallet.history();
    expect(history.ok && history.value[0]?.amountXof).toBe(45_000);
  });

  it('renvoie une page vide pour un curseur inconnu', async () => {
    const fake = fakeNative();
    const wallet = createLdkWallet(fake.native, settings, options);
    await wallet.create(pin);
    fake.receiveFromDiaspora(1_000);
    expect(await wallet.history({ before: 'inconnu' })).toEqual({ ok: true, value: [] });
  });
});

describe('aides', () => {
  it('fixe les frais à 1 % avec un minimum de 10 sats', () => {
    expect(maxFeeFor(500)).toBe(10);
    expect(maxFeeFor(2_000)).toBe(20);
    expect(maxFeeFor(2_050)).toBe(21);
  });

  it('ne laisse passer que les codes connus du contrat', () => {
    expect(toErrorCode(codedError('INSUFFICIENT_FUNDS'))).toBe('INSUFFICIENT_FUNDS');
    expect(toErrorCode(codedError('ERR_INTERNE'))).toBe('UNKNOWN');
    expect(toErrorCode(null)).toBe('UNKNOWN');
  });
});

/** Faux serveur LNURL (T19) pour `mame@teranga.example`, servi par l'API de démo. */
function fakeLnurl({
  metadata = '[["text/plain","Payer mame@teranga.example"]]',
  callback = 'http://api.test/v1/lnurlp/mame/callback',
  answer = (amountMsat: number): unknown => ({ pr: `lnbcrtadresse${amountMsat}`, routes: [] }),
  offline = false,
} = {}) {
  const urls: string[] = [];
  const fetch = jest.fn(async (url: string) => {
    urls.push(url);
    if (offline) throw new TypeError('Network request failed');
    const parsed = new URL(url);
    const body =
      parsed.pathname === '/.well-known/lnurlp/mame'
        ? { tag: 'payRequest', callback, minSendable: 1_000, maxSendable: 50_000_000, metadata }
        : parsed.pathname === '/v1/lnurlp/mame/callback'
          ? answer(Number(parsed.searchParams.get('amount')))
          : { status: 'ERROR', reason: 'inconnu' };
    return { ok: true, status: 200, json: async () => body };
  });
  return { fetch, urls, metadataHash: fakeSha256(metadata) };
}

describe('envoi Lightning T21', () => {
  const demo = { domain: 'teranga.example', apiUrl: 'http://api.test' };

  async function ready(
    lnurl = fakeLnurl(),
    invoices = new Map<string, Partial<NativeInvoiceInfo>>([
      ['lnbcrtadresse5000000', { amountSats: 5_000, descriptionHash: lnurl.metadataHash }],
    ]),
  ) {
    const fake = fakeNative({ invoices });
    let clock = 0;
    const wallet = createLdkWallet(fake.native, settings, {
      ...options,
      now: () => clock,
      sleep: async (ms: number) => {
        clock += ms;
      },
      paymentTimeoutMs: 2_000,
      lightningAddress: { fetch: lnurl.fetch, demo },
    });
    await wallet.create(pin);
    fake.receiveFromDiaspora(100_000);
    return { fake, wallet, lnurl };
  }

  it('paie une adresse Lightning après avoir vérifié la facture', async () => {
    const { fake, wallet, lnurl } = await ready();
    const preview = await wallet.preview('Mame@Teranga.example', 5_000);
    expect(preview.ok && preview.value).toMatchObject({
      kind: 'adresse_lightning',
      destination: 'mame@teranga.example',
      amountSats: 5_000,
      maxFeeSats: 50,
      expiresAt: null,
      newRecipient: true,
    });
    const sent = await wallet.send({ destination: 'mame@teranga.example', amountSats: 5_000, pin });
    expect(sent.ok && sent.value).toMatchObject({ direction: 'envoye', amountSats: 5_000 });
    expect(fake.sends).toEqual([
      { invoice: 'lnbcrtadresse5000000', amountSats: null, maxFeeSats: 50 },
    ]);
    expect(lnurl.urls).toContain('http://api.test/v1/lnurlp/mame/callback?amount=5000000');
    const again = await wallet.preview('mame@teranga.example', 5_000);
    expect(again.ok && again.value.newRecipient).toBe(false);
  });

  const refusals: Array<
    [
      string,
      () => ReturnType<typeof fakeLnurl>,
      Map<string, Partial<NativeInvoiceInfo>> | null,
      string,
    ]
  > = [
    [
      'une facture dont la description ne correspond pas aux métadonnées',
      () => fakeLnurl(),
      new Map([
        ['lnbcrtadresse5000000', { amountSats: 5_000, descriptionHash: 'sha256(autre chose)' }],
      ]),
      'DESTINATION_INVALID',
    ],
    ['une facture d’un autre montant', () => fakeLnurl(), null, 'AMOUNT_INVALID'],
    [
      'une facture hors regtest',
      () => fakeLnurl({ answer: () => ({ pr: 'lnbc1mainnet' }) }),
      null,
      'DESTINATION_WRONG_NETWORK',
    ],
    [
      'un callback qui pointe vers un autre site',
      () => fakeLnurl({ callback: 'https://ailleurs.example/vol' }),
      null,
      'DESTINATION_INVALID',
    ],
    [
      'un téléphone destinataire hors ligne (erreur LNURL)',
      () => fakeLnurl({ answer: () => ({ status: 'ERROR', reason: 'Téléphone hors ligne' }) }),
      null,
      'NO_ROUTE',
    ],
    ['un réseau coupé', () => fakeLnurl({ offline: true }), null, 'NETWORK_OFFLINE'],
  ];

  for (const [label, makeLnurl, invoices, code] of refusals) {
    it(`ne paie pas ${label}`, async () => {
      const lnurl = makeLnurl();
      const { fake, wallet } = await ready(
        lnurl,
        invoices ??
          new Map([
            ['lnbcrtadresse5000000', { amountSats: 4_999, descriptionHash: lnurl.metadataHash }],
          ]),
      );
      const result = await wallet.send({
        destination: 'mame@teranga.example',
        amountSats: 5_000,
        pin,
      });
      expect(result).toEqual({ ok: false, error: { code } });
      expect(fake.sends).toHaveLength(0);
    });
  }

  it('refuse un montant hors des bornes annoncées', async () => {
    const { wallet } = await ready();
    const result = await wallet.preview('mame@teranga.example', 60_000);
    expect(result).toEqual({ ok: false, error: { code: 'AMOUNT_INVALID' } });
  });

  it('n’envoie pas deux fois après un délai dépassé, puis réautorise après l’échec', async () => {
    const lnurl = fakeLnurl({ answer: () => ({ pr: 'lnbcrtadresselent' }) });
    const { fake, wallet } = await ready(
      lnurl,
      new Map([['lnbcrtadresselent', { amountSats: 5_000, descriptionHash: lnurl.metadataHash }]]),
    );
    const request = { destination: 'mame@teranga.example', amountSats: 5_000, pin };
    expect(await wallet.send(request)).toEqual({
      ok: false,
      error: { code: 'PAYMENT_TIMEOUT', paymentId: 'envoi-1' },
    });
    expect(await wallet.send(request)).toEqual({
      ok: false,
      error: { code: 'PAYMENT_PENDING', paymentId: 'envoi-1' },
    });
    expect(fake.sends).toHaveLength(1);

    const pending = fake.payments.find((payment) => payment.id === 'envoi-1');
    if (pending) {
      pending.status = 'echoue';
      pending.failureReason = 'ROUTE_NOT_FOUND';
    }
    expect(await wallet.send(request)).toEqual({
      ok: false,
      error: { code: 'PAYMENT_TIMEOUT', paymentId: 'envoi-2' },
    });
    expect(fake.sends).toHaveLength(2);
  });

  it('ne paie qu’une fois quand on appuie deux fois très vite', async () => {
    const lnurl = fakeLnurl({ answer: () => ({ pr: 'lnbcrtadresselent' }) });
    const { fake, wallet } = await ready(
      lnurl,
      new Map([['lnbcrtadresselent', { amountSats: 5_000, descriptionHash: lnurl.metadataHash }]]),
    );
    const request = { destination: 'mame@teranga.example', amountSats: 5_000, pin };
    const results = await Promise.all([wallet.send(request), wallet.send(request)]);
    expect(results.map((result) => (result.ok ? 'ok' : result.error.code)).sort()).toEqual([
      'PAYMENT_PENDING',
      'PAYMENT_TIMEOUT',
    ]);
    expect(fake.sends).toHaveLength(1);
    // Une seule facture demandée au destinataire.
    expect(lnurl.urls.filter((url) => url.includes('/callback')).length).toBe(1);
  });

  it('refuse toujours un renvoi après redémarrage tant que le premier envoi est en attente', async () => {
    const lnurl = fakeLnurl({ answer: () => ({ pr: 'lnbcrtadresselent' }) });
    const { fake, wallet } = await ready(
      lnurl,
      new Map([['lnbcrtadresselent', { amountSats: 5_000, descriptionHash: lnurl.metadataHash }]]),
    );
    const request = { destination: 'mame@teranga.example', amountSats: 5_000, pin };
    expect(await wallet.send(request)).toEqual({
      ok: false,
      error: { code: 'PAYMENT_TIMEOUT', paymentId: 'envoi-1' },
    });

    // Nouvel adaptateur, comme après un redémarrage de l'application : mémoire vide,
    // mais même module natif (paiements LDK et journal sur le disque).
    const restarted = createLdkWallet(fake.native, settings, {
      ...options,
      paymentTimeoutMs: 0,
      lightningAddress: { fetch: lnurl.fetch, demo },
    });
    expect(await restarted.send(request)).toEqual({
      ok: false,
      error: { code: 'PAYMENT_PENDING', paymentId: 'envoi-1' },
    });
    expect(fake.sends).toHaveLength(1);
  });

  it('refuse un renvoi quand l’application s’est arrêtée pendant l’envoi', async () => {
    const lnurl = fakeLnurl({ answer: () => ({ pr: 'lnbcrtadressecoupure' }) });
    const { fake, wallet } = await ready(
      lnurl,
      new Map([
        ['lnbcrtadressecoupure', { amountSats: 5_000, descriptionHash: lnurl.metadataHash }],
      ]),
    );
    const request = { destination: 'mame@teranga.example', amountSats: 5_000, pin };
    expect(await wallet.send(request)).toEqual({ ok: false, error: { code: 'UNKNOWN' } });
    const restarted = createLdkWallet(fake.native, settings, {
      ...options,
      paymentTimeoutMs: 0,
      lightningAddress: { fetch: lnurl.fetch, demo },
    });
    expect(await restarted.send(request)).toEqual({
      ok: false,
      // Même après un arrêt brutal, l'identifiant (hash de la facture) est connu.
      error: { code: 'PAYMENT_PENDING', paymentId: 'empreinte-lnbcrtadressecoupure' },
    });
    expect(fake.sends).toHaveLength(1);
  });

  it('reprend un envoi réservé mais jamais parti (arrêt avant le paiement)', async () => {
    const { fake, wallet } = await ready();
    // Réservation laissée par un arrêt brutal juste avant l'appel natif : LDK ne connaît pas ce paiement.
    await fake.native.journalWrite(
      JSON.stringify({
        version: 1,
        xof: {},
        invoices: {},
        sends: { 'mame@teranga.example|5000': 'empreinte-jamais-partie' },
      }),
    );
    const sent = await wallet.send({ destination: 'mame@teranga.example', amountSats: 5_000, pin });
    expect(sent.ok).toBe(true);
    expect(fake.sends).toHaveLength(1);
  });

  it('ne paie qu’une fois quand deux adaptateurs envoient en même temps', async () => {
    const lnurl = fakeLnurl({ answer: () => ({ pr: 'lnbcrtadresselent' }) });
    const { fake, wallet } = await ready(
      lnurl,
      new Map([['lnbcrtadresselent', { amountSats: 5_000, descriptionHash: lnurl.metadataHash }]]),
    );
    const other = createLdkWallet(fake.native, settings, {
      ...options,
      paymentTimeoutMs: 0,
      lightningAddress: { fetch: lnurl.fetch, demo },
    });
    const request = { destination: 'mame@teranga.example', amountSats: 5_000, pin };
    const results = await Promise.all([wallet.send(request), other.send(request)]);
    expect(
      results.filter((result) => !result.ok && result.error.code === 'PAYMENT_PENDING'),
    ).toHaveLength(1);
    expect(fake.sends).toHaveLength(1);
  });

  it('ne bloque pas un envoi à cause d’une facture reçue au même identifiant', async () => {
    const { fake, wallet } = await ready();
    // Réservation pointant vers un identifiant qui n'existe que comme réception en attente.
    const received = await wallet.receive({ amountSats: 5_000 });
    const sharedId = received.ok ? received.value.paymentId : '';
    await fake.native.journalWrite(
      JSON.stringify({
        version: 1,
        xof: {},
        invoices: {},
        sends: { 'mame@teranga.example|5000': sharedId },
      }),
    );
    const restarted = createLdkWallet(fake.native, settings, {
      ...options,
      journal: createJournal(fake.native),
      lightningAddress: { fetch: fakeLnurl().fetch, demo },
    });
    const sent = await restarted.send({
      destination: 'mame@teranga.example',
      amountSats: 5_000,
      pin,
    });
    expect(sent.ok).toBe(true);
  });

  it('ne répond jamais « inconnu » une fois l’argent parti', async () => {
    const { fake, wallet } = await ready();
    const write = fake.native.journalWrite;
    // Disque plein juste après l'envoi : le paiement est parti, le journal ne s'écrit plus.
    fake.native.journalWrite = jest.fn(async (text: string) => {
      if (fake.sends.length > 0) throw new Error('disque plein');
      return write(text);
    });
    const sent = await wallet.send({ destination: 'mame@teranga.example', amountSats: 5_000, pin });
    expect(sent).toEqual({ ok: false, error: { code: 'PAYMENT_TIMEOUT', paymentId: 'envoi-1' } });
    expect(fake.sends).toHaveLength(1);
  });

  it('attend la raison d’un échec avant de répondre', async () => {
    const { fake, wallet } = await ready();
    const payments = fake.native.payments;
    let calls = 0;
    // Les deux premières lectures voient l'échec sans sa raison, comme juste après LDK.
    fake.native.payments = jest.fn(async () => {
      calls += 1;
      const list = await payments();
      return calls <= 2 ? list.map((p) => ({ ...p, failureReason: null })) : list;
    });
    const sent = await wallet.send({ destination: 'lnbcrtawaechecexpire', pin });
    expect(sent).toEqual({ ok: false, error: { code: 'INVOICE_EXPIRED' } });
  });

  it('autorise un second envoi identique une fois le premier réussi', async () => {
    const { fake, wallet } = await ready();
    const request = { destination: 'mame@teranga.example', amountSats: 5_000, pin };
    expect((await wallet.send(request)).ok).toBe(true);
    expect((await wallet.send(request)).ok).toBe(true);
    expect(fake.sends).toHaveLength(2);
  });

  it('refuse avant d’envoyer quand le solde ne couvre pas montant et frais', async () => {
    const { fake, wallet } = await ready();
    // 99 500 sats + 995 sats de frais maximum > 100 000 sats disponibles.
    const result = await wallet.send({ destination: 'lnbcrtsansmontant', amountSats: 99_500, pin });
    expect(result).toEqual({ ok: false, error: { code: 'INSUFFICIENT_FUNDS' } });
    expect(fake.sends).toHaveLength(0);
  });

  it('traduit la raison LDK d’un échec', async () => {
    const { wallet } = await ready();
    const expired = await wallet.send({ destination: 'lnbcrtawaechecexpire', pin });
    expect(expired).toEqual({ ok: false, error: { code: 'INVOICE_EXPIRED' } });
    expect(failureCode('RETRIES_EXHAUSTED')).toBe('NO_ROUTE');
    expect(failureCode('UNEXPECTED_ERROR')).toBe('UNKNOWN');
    expect(failureCode(null)).toBe('NO_ROUTE');
  });
});
