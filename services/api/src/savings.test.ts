import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.ts';
import { defaultConfig } from './config.ts';
import {
  classicFees,
  defaultSavingsAssumptions,
  estimateSavings,
  loadSavingsAssumptions,
  validateSavingsAssumptions,
  type SavingsAssumptions,
} from './savings.ts';

const corridor = (id: string) => {
  const found = defaultSavingsAssumptions.corridors.find((item) => item.id === id);
  assert.ok(found);
  return found;
};

describe('frais classiques', () => {
  it('applique la fourchette France → Sénégal sans TTA', () => {
    // 100 000 FCFA à 2,5 % – 3,8 %.
    assert.deepEqual(classicFees(100_000, corridor('france_senegal'), defaultSavingsAssumptions), {
      min: 2_500,
      max: 3_800,
    });
  });

  it('ajoute la TTA de 0,5 % aux envois mobile money locaux', () => {
    // Wave 1 % de 20 000 = 200, TTA 0,5 % = 100.
    assert.deepEqual(classicFees(20_000, corridor('wave_local'), defaultSavingsAssumptions), {
      min: 300,
      max: 300,
    });
  });

  it('plafonne la TTA à 2 000 FCFA', () => {
    // Orange Money 0,8 % de 1 000 000 = 8 000 ; TTA 5 000 plafonnée à 2 000.
    const fees = classicFees(1_000_000, corridor('orange_money_local'), defaultSavingsAssumptions);
    assert.deepEqual(fees, { min: 10_000, max: 10_000 });
  });

  it('arrondit la borne basse vers le bas et la haute vers le haut', () => {
    // 2,5 % de 999 = 24,975 ; 3,8 % de 999 = 37,962.
    assert.deepEqual(classicFees(999, corridor('france_senegal'), defaultSavingsAssumptions), {
      min: 24,
      max: 38,
    });
  });
});

describe('estimation d’économies', () => {
  it('soustrait les frais réellement payés et signale une économie certaine', () => {
    const result = estimateSavings(
      [{ amountXof: 100_000, corridor: 'france_senegal', actualFeesXof: 150 }],
      defaultSavingsAssumptions,
    );
    assert.equal(result.estimate, true);
    assert.equal(result.formula, 'classicFeesXof - actualFeesXof');
    assert.deepEqual(result.transfers[0]?.savingsXof, { min: 2_350, max: 3_650 });
    assert.equal(result.transfers[0]?.outcome, 'economie');
  });

  it('annonce un surcoût au lieu de cacher un résultat négatif', () => {
    // Le local est déjà bon marché : 300 FCFA chez Wave contre 450 payés ici.
    const result = estimateSavings(
      [{ amountXof: 20_000, corridor: 'wave_local', actualFeesXof: 450 }],
      defaultSavingsAssumptions,
    );
    assert.deepEqual(result.total.savingsXof, { min: -150, max: -150 });
    assert.equal(result.total.outcome, 'surcout');
  });

  it('dit « comparable » quand la fourchette passe par zéro', () => {
    const result = estimateSavings(
      [{ amountXof: 100_000, corridor: 'france_senegal', actualFeesXof: 3_000 }],
      defaultSavingsAssumptions,
    );
    assert.deepEqual(result.total.savingsXof, { min: -500, max: 800 });
    assert.equal(result.total.outcome, 'comparable');
  });

  it('additionne un historique de plusieurs envois', () => {
    const result = estimateSavings(
      [
        { amountXof: 100_000, corridor: 'france_senegal', actualFeesXof: 150 },
        { amountXof: 50_000, corridor: 'hors_zone_cfa', actualFeesXof: 100 },
      ],
      defaultSavingsAssumptions,
    );
    assert.deepEqual(result.total, {
      amountXof: 150_000,
      actualFeesXof: 250,
      classicFeesXof: { min: 2_500 + 5_000, max: 3_800 + 7_500 },
      savingsXof: { min: 7_250, max: 11_050 },
      outcome: 'economie',
    });
  });
});

describe('hypothèses configurables', () => {
  const valid: SavingsAssumptions = {
    version: '2026-12-01',
    ttaBasisPoints: 50,
    ttaCapXof: 2_000,
    corridors: [
      { id: 'essai', minBasisPoints: 100, maxBasisPoints: 200, addsTta: false, source: 'Essai' },
    ],
  };

  it('garde les hypothèses par défaut sans variable', () => {
    assert.equal(loadSavingsAssumptions({}), defaultSavingsAssumptions);
  });

  it('lit un fichier JSON valide', () => {
    const loaded = loadSavingsAssumptions({ SAVINGS_ASSUMPTIONS_FILE: 'x.json' }, () =>
      JSON.stringify(valid),
    );
    assert.deepEqual(loaded, valid);
  });

  it('refuse un JSON illisible sans recopier le chemin', () => {
    assert.throws(
      () => loadSavingsAssumptions({ SAVINGS_ASSUMPTIONS_FILE: '/home/awa/x.json' }, () => '{'),
      (error: Error) => /illisible/u.test(error.message) && !error.message.includes('awa'),
    );
  });

  const broken: Array<[string, unknown]> = [
    ['champ inconnu', { ...valid, bonus: 1 }],
    ['version mal formée', { ...valid, version: 'demain' }],
    [
      'min au-dessus de max',
      { ...valid, corridors: [{ ...valid.corridors[0], minBasisPoints: 300 }] },
    ],
    ['identifiant en double', { ...valid, corridors: [valid.corridors[0], valid.corridors[0]] }],
    ['source absente', { ...valid, corridors: [{ ...valid.corridors[0], source: '' }] }],
    ['taux non entier', { ...valid, corridors: [{ ...valid.corridors[0], maxBasisPoints: 2.5 }] }],
    ['TTA négative', { ...valid, ttaBasisPoints: -1 }],
    ['aucun corridor', { ...valid, corridors: [] }],
  ];
  for (const [label, input] of broken) {
    it(`refuse : ${label}`, () => {
      assert.throws(() => validateSavingsAssumptions(input), /Hypothèses d'économies invalides/u);
    });
  }

  it('accepte les hypothèses par défaut', () => {
    assert.deepEqual(
      validateSavingsAssumptions(defaultSavingsAssumptions),
      defaultSavingsAssumptions,
    );
  });
});

describe('routes /v1/savings', () => {
  const apps: FastifyInstance[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });
  async function app(savingsAssumptions?: SavingsAssumptions) {
    const instance = await buildApp({
      config: { ...defaultConfig, logLevel: 'silent' },
      savingsAssumptions,
    });
    apps.push(instance);
    return instance;
  }

  it('publie les hypothèses et la formule', async () => {
    const response = await (await app()).inject({ method: 'GET', url: '/v1/savings/assumptions' });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.formula, 'classicFeesXof - actualFeesXof');
    assert.equal(body.corridors.length, 4);
    assert.ok(body.corridors.every((item: { source: string }) => item.source.length > 0));
  });

  it('calcule une estimation', async () => {
    const response = await (
      await app()
    ).inject({
      method: 'POST',
      url: '/v1/savings/estimate',
      payload: {
        transfers: [{ amountXof: 100_000, corridor: 'france_senegal', actualFeesXof: 150 }],
      },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().total.savingsXof, { min: 2_350, max: 3_650 });
  });

  it('suit des hypothèses remplacées par configuration', async () => {
    const custom: SavingsAssumptions = {
      version: '2026-12-01',
      ttaBasisPoints: 0,
      ttaCapXof: 0,
      corridors: [
        { id: 'essai', minBasisPoints: 500, maxBasisPoints: 500, addsTta: false, source: 'Essai' },
      ],
    };
    const instance = await app(custom);
    const refused = await instance.inject({
      method: 'POST',
      url: '/v1/savings/estimate',
      payload: { transfers: [{ amountXof: 1_000, corridor: 'france_senegal', actualFeesXof: 0 }] },
    });
    assert.equal(refused.statusCode, 400);
    const accepted = await instance.inject({
      method: 'POST',
      url: '/v1/savings/estimate',
      payload: { transfers: [{ amountXof: 1_000, corridor: 'essai', actualFeesXof: 10 }] },
    });
    assert.deepEqual(accepted.json().total.savingsXof, { min: 40, max: 40 });
    assert.equal(accepted.json().assumptionsVersion, '2026-12-01');
  });

  const invalid: Array<[string, unknown]> = [
    ['liste vide', { transfers: [] }],
    ['montant nul', { transfers: [{ amountXof: 0, corridor: 'wave_local', actualFeesXof: 0 }] }],
    [
      'montant en texte',
      { transfers: [{ amountXof: '500', corridor: 'wave_local', actualFeesXof: 0 }] },
    ],
    [
      'frais négatifs',
      { transfers: [{ amountXof: 500, corridor: 'wave_local', actualFeesXof: -1 }] },
    ],
    [
      'champ en trop',
      { transfers: [{ amountXof: 500, corridor: 'wave_local', actualFeesXof: 0, nom: 'Awa' }] },
    ],
    [
      'plus de 100 envois',
      {
        transfers: Array.from({ length: 101 }, () => ({
          amountXof: 1,
          corridor: 'wave_local',
          actualFeesXof: 0,
        })),
      },
    ],
  ];
  for (const [label, payload] of invalid) {
    it(`refuse : ${label}`, async () => {
      const response = await (
        await app()
      ).inject({
        method: 'POST',
        url: '/v1/savings/estimate',
        payload: payload as object,
      });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, 'VALIDATION_ERROR');
    });
  }
});
