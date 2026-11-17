import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildApp } from './app.ts';
import { defaultConfig } from './config.ts';
import { assessPayment, rulePoints, type PaymentCheck } from './fraud.ts';

/** Profil fictif : envois habituels de 5 000 à 7 000 sats (2 250 à 3 150 FCFA). */
const habitual: PaymentCheck = {
  amountSats: 6_000,
  newRecipient: false,
  recentPayments: [{ amountSats: 5_000, ageSeconds: 7_200 }],
  usualAmountsSats: [5_000, 6_000, 7_000, 5_500],
  localHour: 14,
  balanceSats: 100_000,
};

const codes = (check: PaymentCheck) => assessPayment(check).reasons.map((r) => r.code);

describe('règles d’alerte', () => {
  it('ne signale rien pour un envoi habituel', () => {
    assert.deepEqual(assessPayment(habitual), {
      score: 0,
      level: 'faible',
      confirmationRequired: false,
      reasons: [],
    });
  });

  it('signale un nouveau destinataire sans exiger de confirmation à lui seul', () => {
    const result = assessPayment({ ...habitual, newRecipient: true });
    assert.deepEqual(result.reasons, [{ code: 'NOUVEAU_DESTINATAIRE', points: 30 }]);
    assert.equal(result.level, 'moyen');
    assert.equal(result.confirmationRequired, false);
  });

  it('repère un montant inhabituel puis très inhabituel', () => {
    assert.deepEqual(codes({ ...habitual, amountSats: 20_000 }), ['MONTANT_INHABITUEL']);
    assert.deepEqual(codes({ ...habitual, amountSats: 60_000 }), ['MONTANT_TRES_INHABITUEL']);
  });

  it('n’utilise pas l’historique tant qu’il compte moins de trois envois', () => {
    assert.deepEqual(codes({ ...habitual, amountSats: 60_000, usualAmountsSats: [1_000] }), []);
  });

  it('repère un gros montant, un rythme anormal, presque tout le solde et la nuit', () => {
    assert.ok(
      codes({ ...habitual, amountSats: 200_000, balanceSats: 1_000_000 }).includes('GROS_MONTANT'),
    );
    const burst = [60, 120, 180, 240].map((ageSeconds) => ({ amountSats: 5_000, ageSeconds }));
    assert.deepEqual(codes({ ...habitual, recentPayments: burst }), ['RYTHME_ANORMAL']);
    assert.deepEqual(codes({ ...habitual, amountSats: 6_000, balanceSats: 6_500 }), [
      'PRESQUE_TOUT_LE_SOLDE',
    ]);
    assert.deepEqual(codes({ ...habitual, localHour: 3 }), ['HEURE_INHABITUELLE']);
    assert.deepEqual(codes({ ...habitual, localHour: 5 }), []);
  });

  it('scénario de faux agent : nouveau destinataire, gros montant et tout le solde', () => {
    const result = assessPayment({
      ...habitual,
      newRecipient: true,
      amountSats: 300_000,
      balanceSats: 310_000,
      localHour: 23,
    });
    assert.equal(result.level, 'eleve');
    assert.equal(result.confirmationRequired, true);
    assert.equal(result.score, 100, 'score plafonné à 100');
    assert.equal(
      result.reasons[0]?.code,
      'MONTANT_TRES_INHABITUEL',
      'raison la plus lourde d’abord',
    );
    assert.deepEqual(result.reasons.map((r) => r.code).sort(), [
      'GROS_MONTANT',
      'MONTANT_TRES_INHABITUEL',
      'NOUVEAU_DESTINATAIRE',
      'PRESQUE_TOUT_LE_SOLDE',
    ]);
  });

  it('demande confirmation dès le seuil de 50 points', () => {
    // Nouveau destinataire (30) + gros montant (20) = 50.
    const result = assessPayment({
      ...habitual,
      newRecipient: true,
      amountSats: 200_000,
      usualAmountsSats: [],
      balanceSats: 10_000_000,
    });
    assert.equal(result.score, rulePoints.NOUVEAU_DESTINATAIRE + rulePoints.GROS_MONTANT);
    assert.equal(result.confirmationRequired, true);
  });
});

describe('route POST /v1/alerts/payment-check', () => {
  it('renvoie le score et les raisons, sans rien journaliser du corps', async () => {
    let logs = '';
    const { Writable } = await import('node:stream');
    const app = await buildApp({
      config: { ...defaultConfig },
      logStream: new Writable({
        write(chunk, _encoding, callback) {
          logs += chunk.toString();
          callback();
        },
      }),
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/alerts/payment-check',
      payload: { ...habitual, newRecipient: true, amountSats: 987_654 },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().confirmationRequired, true);
    assert.ok(!logs.includes('987654'), 'aucun montant dans les journaux');
    await app.close();
  });

  it('refuse un champ inconnu, comme un numéro ou un nom', async () => {
    const app = await buildApp({ config: { ...defaultConfig, logLevel: 'silent' } });
    for (const [field, value] of [
      ['telephone', '+221 00 000 00 01'],
      ['destination', 'mame@teranga.example'],
    ] as const) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/alerts/payment-check',
        payload: { ...habitual, [field]: value },
      });
      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.json().error.fields, [`body.${field}`]);
    }
    const tooMany = await app.inject({
      method: 'POST',
      url: '/v1/alerts/payment-check',
      payload: {
        ...habitual,
        recentPayments: Array.from({ length: 51 }, () => ({ amountSats: 1, ageSeconds: 1 })),
      },
    });
    assert.equal(tooMany.statusCode, 400);
    const zero = await app.inject({
      method: 'POST',
      url: '/v1/alerts/payment-check',
      payload: { ...habitual, amountSats: 0 },
    });
    assert.equal(zero.statusCode, 400);
    await app.close();
  });
});
