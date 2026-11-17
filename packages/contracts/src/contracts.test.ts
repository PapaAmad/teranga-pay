import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectDestination,
  isValidPinFormat,
  satsToXof,
  walletErrorCodes,
  xofToSats,
  type WalletEvent,
} from '@teranga-pay/contracts';
import { createFakeWallet, fakeRecoveryWords } from '@teranga-pay/contracts/fake';

describe('conversions de montants', () => {
  it('arrondit FCFA → sats au supérieur et sats → FCFA au inférieur', () => {
    assert.equal(xofToSats(2_500, 45_000_000), 5_556);
    assert.equal(satsToXof(5_556, 45_000_000), 2_500);
    assert.equal(satsToXof(5_555, 45_000_000), 2_499);
    assert.equal(satsToXof(100_000_000, 44_710_685), 44_710_685);
  });

  it('refuse les montants non entiers ou négatifs', () => {
    assert.throws(() => xofToSats(2.5, 45_000_000), RangeError);
    assert.throws(() => satsToXof(-1, 45_000_000), RangeError);
    assert.throws(() => xofToSats(100, 0), RangeError);
  });
});

describe('aides de saisie', () => {
  it('reconnaît factures et adresses Lightning', () => {
    assert.equal(detectDestination('lnbcrt10u1pjexemple'), 'facture');
    assert.equal(detectDestination('lightning:LNBC1PEXEMPLE'), 'facture');
    assert.equal(detectDestination(' mame@teranga.example '), 'adresse_lightning');
    assert.equal(detectDestination('mame+cadeau@teranga.example'), 'adresse_lightning');
    assert.equal(detectDestination('77 000 00 00'), null);
  });

  it('accepte uniquement un PIN de six chiffres', () => {
    assert.ok(isValidPinFormat('123456'));
    for (const pin of ['12345', '1234567', '12345a', ' 123456']) assert.ok(!isValidPinFormat(pin));
  });

  it('expose des codes d’erreur uniques', () => {
    assert.equal(new Set(walletErrorCodes).size, walletErrorCodes.length);
  });
});

describe('faux wallet', () => {
  const pin = '246810';

  it('suit le parcours création → réception → envoi → historique', async () => {
    const wallet = createFakeWallet({ now: () => Date.UTC(2026, 10, 7, 12) });
    const events: WalletEvent['type'][] = [];
    wallet.subscribe((event) => events.push(event.type));
    assert.equal(await wallet.state(), 'absent');

    const created = await wallet.create(pin);
    assert.ok(created.ok);
    assert.deepEqual(created.value.recoveryWords, fakeRecoveryWords);
    assert.equal(await wallet.state(), 'pret');

    const invoice = await wallet.receive({ amountSats: 5_556, amountXof: 2_500 });
    assert.ok(invoice.ok);
    assert.equal(detectDestination(invoice.value.paymentRequest), 'facture');

    wallet.simulateIncomingPayment(25_000, 'Reçu de Ousmane');
    const balance = await wallet.balance();
    assert.ok(balance.ok);
    assert.equal(balance.value.spendableSats, 25_000);
    assert.equal(balance.value.spendableXof, 11_250);

    const preview = await wallet.preview('awa@teranga.example', 5_556);
    assert.ok(preview.ok);
    assert.equal(preview.value.newRecipient, true);
    assert.equal(preview.value.amountXof, 2_500);

    const sent = await wallet.send({ destination: 'awa@teranga.example', amountSats: 5_556, pin });
    assert.ok(sent.ok);
    assert.equal(sent.value.feeSats, 2);
    const again = await wallet.preview('awa@teranga.example', 100);
    assert.ok(again.ok);
    assert.equal(again.value.newRecipient, false);

    const history = await wallet.history();
    assert.ok(history.ok);
    assert.deepEqual(
      history.value.map((p) => [p.direction, p.amountSats]),
      [
        ['envoye', 5_556],
        ['recu', 25_000],
      ],
    );
    assert.ok(events.includes('paiement') && events.includes('solde') && events.includes('etat'));
  });

  it('protège par PIN et bloque après cinq erreurs', async () => {
    let time = 0;
    const wallet = createFakeWallet({ now: () => time });
    await wallet.create(pin);
    await wallet.lock();
    assert.deepEqual(await wallet.balance(), { ok: false, error: { code: 'WALLET_LOCKED' } });
    for (let left = 4; left >= 1; left -= 1) {
      assert.deepEqual(await wallet.unlock('000000'), {
        ok: false,
        error: { code: 'PIN_INVALID', attemptsLeft: left },
      });
    }
    assert.deepEqual(await wallet.unlock('000000'), {
      ok: false,
      error: { code: 'PIN_LOCKED', retryAfterSeconds: 30 },
    });
    const stillLocked = await wallet.unlock(pin);
    assert.equal(!stillLocked.ok && stillLocked.error.code, 'PIN_LOCKED');
    time += 30_000;
    assert.deepEqual(await wallet.unlock(pin), { ok: true, value: undefined });
  });

  it('renvoie des codes pour les cas d’échec prévus', async () => {
    const wallet = createFakeWallet({ now: () => 1_000 });
    assert.equal((await wallet.create('12')).ok, false);
    await wallet.create(pin);
    const code = async (promise: Promise<{ ok: boolean; error?: { code: string } }>) =>
      (await promise).error?.code;

    assert.equal(await code(wallet.create(pin)), 'WALLET_EXISTS');
    assert.equal(await code(wallet.preview('bonjour')), 'DESTINATION_INVALID');
    assert.equal(await code(wallet.preview('lnbc10u1pmainnet')), 'DESTINATION_WRONG_NETWORK');
    assert.equal(
      await code(wallet.send({ destination: 'awa@teranga.example', amountSats: 10, pin })),
      'INSUFFICIENT_FUNDS',
    );
    assert.equal(
      await code(wallet.send({ destination: 'awa@teranga.example', pin })),
      'AMOUNT_INVALID',
    );
    assert.equal(
      await code(wallet.send({ destination: 'awa@teranga.example', amountSats: 1, pin: '999999' })),
      'PIN_INVALID',
    );
    wallet.setOnline(false);
    assert.equal(await wallet.state(), 'hors_ligne');
    assert.equal(await code(wallet.receive({ amountSats: 10 })), 'NETWORK_OFFLINE');
    assert.ok((await wallet.balance()).ok, 'solde local lisible hors ligne');
  });

  it('refuse une facture expirée ou déjà payée', async () => {
    let time = 0;
    const wallet = createFakeWallet({ now: () => time, invoiceTtlSeconds: 60 });
    await wallet.create(pin);
    wallet.simulateIncomingPayment(10_000);
    const invoice = await wallet.receive({ amountSats: 100 });
    assert.ok(invoice.ok);
    const destination = invoice.value.paymentRequest;
    assert.ok((await wallet.send({ destination, pin })).ok);
    const twice = await wallet.send({ destination, pin });
    assert.equal(!twice.ok && twice.error.code, 'ALREADY_PAID');

    const late = await wallet.receive({ amountSats: 100 });
    assert.ok(late.ok);
    time += 61_000;
    const expired = await wallet.preview(late.value.paymentRequest);
    assert.equal(!expired.ok && expired.error.code, 'INVOICE_EXPIRED');
  });

  it('refuse une facture déjà payée même recopiée en majuscules', async () => {
    const wallet = createFakeWallet({ now: () => 0 });
    await wallet.create(pin);
    wallet.simulateIncomingPayment(10_000);
    const invoice = await wallet.receive({ amountSats: 100 });
    assert.ok(invoice.ok);
    assert.ok((await wallet.send({ destination: invoice.value.paymentRequest, pin })).ok);
    const upper = invoice.value.paymentRequest.toUpperCase();
    const again = await wallet.send({ destination: upper, pin });
    assert.equal(!again.ok && again.error.code, 'ALREADY_PAID');
    const balance = await wallet.balance();
    assert.equal(balance.ok && balance.value.spendableSats, 10_000 - 102);
  });

  it('refuse un montant différent de celui fixé par la facture', async () => {
    const wallet = createFakeWallet({ now: () => 0 });
    await wallet.create(pin);
    wallet.simulateIncomingPayment(10_000);
    const invoice = await wallet.receive({ amountSats: 100 });
    assert.ok(invoice.ok);
    const destination = invoice.value.paymentRequest;
    const preview = await wallet.preview(destination, 5_000);
    assert.equal(!preview.ok && preview.error.code, 'AMOUNT_INVALID');
    const sent = await wallet.send({ destination, amountSats: 5_000, pin });
    assert.equal(!sent.ok && sent.error.code, 'AMOUNT_INVALID');
    assert.ok((await wallet.preview(destination, 100)).ok);
  });

  it('refuse un montant FCFA sans montant en sats ou non entier', async () => {
    const wallet = createFakeWallet({ now: () => 0 });
    await wallet.create(pin);
    for (const request of [
      { amountXof: 2_500 },
      { amountSats: 5_556, amountXof: 2.5 },
      { amountSats: 5_556, amountXof: -1 },
    ]) {
      const invoice = await wallet.receive(request);
      assert.equal(!invoice.ok && invoice.error.code, 'AMOUNT_INVALID');
    }
  });

  it('confirme un envoi réussi même si un abonné plante', async () => {
    const wallet = createFakeWallet({ now: () => 0 });
    await wallet.create(pin);
    wallet.simulateIncomingPayment(10_000);
    wallet.subscribe(() => {
      throw new Error('écran démonté');
    });
    const sent = await wallet.send({ destination: 'awa@teranga.example', amountSats: 100, pin });
    assert.ok(sent.ok);
  });

  it('refuse sans planter une facture à date d’expiration impossible', async () => {
    const wallet = createFakeWallet({ now: () => 0 });
    await wallet.create(pin);
    const preview = await wallet.preview('lnbcrtfake1n1t999999999999999999999');
    assert.equal(!preview.ok && preview.error.code, 'DESTINATION_INVALID');
  });

  it('pagine l’historique sans perdre les paiements du même instant', async () => {
    const wallet = createFakeWallet({ now: () => 1_000 });
    await wallet.create(pin);
    for (const amount of [10, 20, 30]) wallet.simulateIncomingPayment(amount);
    const seen: number[] = [];
    let before: string | undefined;
    for (let page = 0; page < 4; page += 1) {
      const result = await wallet.history({ limit: 1, before });
      assert.ok(result.ok);
      if (result.value.length === 0) break;
      seen.push(...result.value.map((payment) => payment.amountSats));
      before = result.value.at(-1)?.id;
    }
    assert.deepEqual(seen, [30, 20, 10]);
  });

  it('refuse un envoi dont les frais dépassent le maximum accepté', async () => {
    const wallet = createFakeWallet({ now: () => 0, feeSats: 2 });
    await wallet.create(pin);
    wallet.simulateIncomingPayment(10_000);
    const destination = 'awa@teranga.example';
    const tooHigh = await wallet.send({ destination, amountSats: 100, maxFeeSats: 1, pin });
    assert.equal(!tooHigh.ok && tooHigh.error.code, 'FEE_TOO_HIGH');
    const balance = await wallet.balance();
    assert.equal(balance.ok && balance.value.spendableSats, 10_000);
    const invalid = await wallet.send({ destination, amountSats: 100, maxFeeSats: -1, pin });
    assert.equal(!invalid.ok && invalid.error.code, 'AMOUNT_INVALID');
    assert.ok((await wallet.send({ destination, amountSats: 100, maxFeeSats: 2, pin })).ok);
  });

  it('relie une facture à son règlement exact et garde le prix du devis', async () => {
    let time = 0;
    const wallet = createFakeWallet({
      now: () => time,
      // Le marché a bougé depuis le devis (45 M) : le taux courant vaut 50 M.
      rate: { xofPerBtc: 50_000_000, source: 'fixe', fetchedAt: '2026-11-07T12:00:00.000Z' },
    });
    await wallet.create(pin);
    const sale = await wallet.receive({ amountSats: 5_556, amountXof: 2_500 });
    const other = await wallet.receive({ amountSats: 5_556, amountXof: 2_500 });
    assert.ok(sale.ok && other.ok);
    assert.notEqual(sale.value.paymentId, other.value.paymentId);

    const waiting = await wallet.lookupInvoice(sale.value.paymentId);
    assert.deepEqual(waiting.ok && waiting.value, { invoice: sale.value, payment: null });

    // Un paiement du même montant pour une autre facture ne règle pas cette vente.
    assert.ok(wallet.simulateInvoicePaid(other.value.paymentId));
    const stillWaiting = await wallet.lookupInvoice(sale.value.paymentId);
    assert.equal(stillWaiting.ok && stillWaiting.value?.payment, null);

    time += 1_000;
    const paid = wallet.simulateInvoicePaid(sale.value.paymentId);
    assert.equal(paid?.id, sale.value.paymentId);
    // Prix du devis (2 500 FCFA), pas 2 778 recalculés au taux courant.
    assert.equal(paid?.amountXof, 2_500);
    const settled = await wallet.lookupInvoice(sale.value.paymentId);
    assert.equal(settled.ok && settled.value?.payment?.id, sale.value.paymentId);
    assert.equal(wallet.simulateInvoicePaid(sale.value.paymentId), null);
    const unknown = await wallet.lookupInvoice('inconnu');
    assert.equal(unknown.ok && unknown.value, null);
  });

  it('donne l’identifiant d’un envoi incertain pour le suivre jusqu’au bout', async () => {
    const wallet = createFakeWallet({ now: () => 0 });
    await wallet.create(pin);
    wallet.simulateIncomingPayment(10_000);
    const invoice = await wallet.receive({ amountSats: 100 });
    assert.ok(invoice.ok);
    const destination = invoice.value.paymentRequest;
    const events: Array<{ id: string; status: string }> = [];
    wallet.subscribe((event) => {
      if (event.type === 'paiement')
        events.push({ id: event.payment.id, status: event.payment.status });
    });

    wallet.simulateSlowNextSend();
    const slow = await wallet.send({ destination, pin });
    assert.ok(!slow.ok && slow.error.code === 'PAYMENT_TIMEOUT');
    const paymentId = !slow.ok ? slow.error.paymentId : undefined;
    assert.ok(paymentId);

    // Renvoi pendant l'attente : refusé, avec le même identifiant.
    const again = await wallet.send({ destination, pin });
    assert.deepEqual(!again.ok && again.error, { code: 'PAYMENT_PENDING', paymentId });

    // L'issue arrive ensuite avec le même identifiant.
    assert.equal(wallet.simulateSendSettled(paymentId, 'reussi')?.status, 'reussi');
    assert.deepEqual(events.at(-1), { id: paymentId, status: 'reussi' });
    const after = await wallet.send({ destination, pin });
    assert.equal(!after.ok && after.error.code, 'ALREADY_PAID');
  });

  it('rend les fonds d’un envoi incertain qui échoue finalement', async () => {
    const wallet = createFakeWallet({ now: () => 0 });
    await wallet.create(pin);
    wallet.simulateIncomingPayment(10_000);
    wallet.simulateSlowNextSend();
    const slow = await wallet.send({ destination: 'mame@teranga.example', amountSats: 1_000, pin });
    const paymentId = !slow.ok ? slow.error.paymentId : undefined;
    assert.ok(paymentId);
    assert.equal(wallet.simulateSendSettled(paymentId, 'echoue')?.failure, 'NO_ROUTE');
    const balance = await wallet.balance();
    assert.equal(balance.ok && balance.value.spendableSats, 10_000);
    assert.equal(wallet.simulateSendSettled(paymentId, 'reussi'), null);
  });

  it('signale l’envoi en cours avant le solde, et seulement pour le même montant', async () => {
    const wallet = createFakeWallet({ now: () => 0 });
    await wallet.create(pin);
    wallet.simulateIncomingPayment(10_000);
    wallet.simulateSlowNextSend();
    const big = { destination: 'mame@teranga.example', amountSats: 9_000, pin };
    const slow = await wallet.send(big);
    const paymentId = !slow.ok ? slow.error.paymentId : undefined;
    // Les fonds de ce même envoi sont réservés : le renvoi est « en cours », pas « solde insuffisant ».
    assert.deepEqual(await wallet.send(big), {
      ok: false,
      error: { code: 'PAYMENT_PENDING', paymentId },
    });
    // Même adresse, autre montant : un autre paiement, non bloqué.
    const other = await wallet.send({ destination: 'mame@teranga.example', amountSats: 500, pin });
    assert.ok(other.ok);
  });

  it('borne réellement la facture à la durée du devis', async () => {
    let time = 0;
    const wallet = createFakeWallet({ now: () => time });
    await wallet.create(pin);
    const invoice = await wallet.receive({ amountSats: 100, expiresInSecs: 300 });
    assert.ok(invoice.ok);
    assert.equal(invoice.value.expiresAt, new Date(300_000).toISOString());
    time = 300_000;
    assert.equal(wallet.simulateInvoicePaid(invoice.value.paymentId), null);
    for (const expiresInSecs of [59, 3_601, 120.5, Number.NaN]) {
      const refused = await wallet.receive({ amountSats: 100, expiresInSecs });
      assert.equal(!refused.ok && refused.error.code, 'EXPIRY_INVALID', String(expiresInSecs));
    }
    assert.ok((await wallet.receive({ amountSats: 100, expiresInSecs: 60 })).ok);
    assert.ok((await wallet.receive({ amountSats: 100, expiresInSecs: 3_600 })).ok);
  });
});
