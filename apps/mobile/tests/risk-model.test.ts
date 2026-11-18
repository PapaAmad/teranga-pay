import type { HomeBalance, HomePayment } from '../src/home/ports';
import type { SendPaymentPreview } from '../src/send/ports';
import { buildRiskCheck, createRiskPort, readRiskAssessment } from '../src/risk/assessment';
import type { RiskAssessment, RiskCheck, RiskReasonCode } from '../src/risk/ports';

const now = Date.parse('2026-11-12T12:00:00.000Z');
const iso = (offset = 0) => new Date(now + offset).toISOString();
const maxSats = 2_100_000_000_000_000;
const preview: SendPaymentPreview = {
  kind: 'adresse_lightning',
  destination: 'destinataire@teranga.example',
  amountSats: 20_000,
  maxFeeSats: 100,
  amountXof: 9000,
  maxFeeXof: 45,
  memo: 'Mémo fictif réservé au téléphone',
  expiresAt: iso(300_000),
  newRecipient: true,
};
const balance: HomeBalance = {
  spendableSats: 100_000,
  pendingSats: 0,
  spendableXof: 45_000,
  rate: { xofPerBtc: 45_000_000, source: 'fixe', fetchedAt: iso() },
  updatedAt: iso(),
};
const reasonCodes: RiskReasonCode[] = [
  'NOUVEAU_DESTINATAIRE',
  'MONTANT_INHABITUEL',
  'MONTANT_TRES_INHABITUEL',
  'GROS_MONTANT',
  'RYTHME_ANORMAL',
  'PRESQUE_TOUT_LE_SOLDE',
  'HEURE_INHABITUELLE',
];
function assessment(patch: Partial<RiskAssessment> = {}): RiskAssessment {
  return {
    score: 50,
    level: 'moyen',
    confirmationRequired: true,
    reasons: [
      { code: 'NOUVEAU_DESTINATAIRE', points: 30 },
      { code: 'GROS_MONTANT', points: 20 },
    ],
    ...patch,
  };
}
function payment(patch: Partial<HomePayment> = {}): HomePayment {
  return {
    id: 'paiement-fictif',
    direction: 'envoye',
    status: 'reussi',
    amountSats: 1000,
    feeSats: 2,
    amountXof: 450,
    memo: 'Libellé local fictif',
    createdAt: iso(-60_000),
    failure: null,
    ...patch,
  };
}
function check(patch: Partial<RiskCheck> = {}): RiskCheck {
  return {
    amountSats: 20_000,
    newRecipient: true,
    recentPayments: [{ amountSats: 1000, ageSeconds: 60 }],
    usualAmountsSats: [1000],
    balanceSats: 100_000,
    localHour: 12,
    ...patch,
  };
}
const build = (history: HomePayment[] = [payment()]) =>
  buildRiskCheck({ preview, balance, history, now });

describe('réponse T26', () => {
  it('conserve une confirmation au niveau moyen, sans imposer un seuil local', () => {
    expect(readRiskAssessment(assessment())).toEqual(assessment());
    expect(
      readRiskAssessment(assessment({ score: 30, confirmationRequired: false })),
    ).toMatchObject({ confirmationRequired: false });
    expect(
      readRiskAssessment(assessment({ score: 5, level: 'faible', confirmationRequired: true })),
    ).toMatchObject({ score: 5, confirmationRequired: true });
  });

  it('accepte une absence de signal sans déclarer une garantie de sécurité', () => {
    const source = assessment({
      score: 0,
      level: 'faible',
      confirmationRequired: false,
      reasons: [],
    });
    expect(readRiskAssessment(source)).toEqual(source);
  });

  it('copie et fige la réponse, les raisons et leurs éléments', () => {
    const source = {
      ...assessment(),
      reasons: [{ code: 'NOUVEAU_DESTINATAIRE', points: 30 }],
      secret: 'valeur-locale-fictive',
    };
    const result = readRiskAssessment(source)!;
    source.score = 99;
    source.reasons[0]!.points = 99;
    expect(result.score).toBe(50);
    expect(result.reasons[0]!.points).toBe(30);
    expect(result).not.toHaveProperty('secret');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reasons)).toBe(true);
    expect(Object.isFrozen(result.reasons[0])).toBe(true);
  });

  it.each([null, undefined, [], '50', true])('refuse une réponse non objet : %p', (source) => {
    expect(readRiskAssessment(source)).toBeNull();
  });

  it.each([-1, 101, 0.5, NaN, Infinity, '50', null])('refuse le score %p', (score) => {
    expect(readRiskAssessment({ ...assessment(), score })).toBeNull();
  });

  it.each(['élevé', 'unknown', '', null, 1])('refuse le niveau %p', (level) => {
    expect(readRiskAssessment({ ...assessment(), level })).toBeNull();
  });

  it.each([0, 1, 'true', null, undefined])('refuse une décision non booléenne : %p', (flag) => {
    expect(readRiskAssessment({ ...assessment(), confirmationRequired: flag })).toBeNull();
  });

  it('refuse une confirmation sans raison et les codes inconnus ou dupliqués', () => {
    expect(readRiskAssessment(assessment({ reasons: [] }))).toBeNull();
    expect(
      readRiskAssessment({ ...assessment(), reasons: [{ code: 'AUTRE', points: 20 }] }),
    ).toBeNull();
    expect(
      readRiskAssessment({
        ...assessment(),
        reasons: [
          { code: 'GROS_MONTANT', points: 20 },
          { code: 'GROS_MONTANT', points: 20 },
        ],
      }),
    ).toBeNull();
  });

  it.each([-1, 101, 1.5, NaN, Infinity, '30', null])('refuse les points %p', (points) => {
    expect(
      readRiskAssessment({ ...assessment(), reasons: [{ code: 'GROS_MONTANT', points }] }),
    ).toBeNull();
  });

  it('accepte les sept codes avec leurs bornes et conserve leur ordre serveur', () => {
    const reasons = reasonCodes.map((code, index) => ({ code, points: index === 0 ? 0 : 100 }));
    expect(readRiskAssessment(assessment({ reasons }))?.reasons).toEqual(reasons);
    expect(readRiskAssessment(assessment({ reasons: [...reasons, reasons[0]!] }))).toBeNull();
    expect(readRiskAssessment({ ...assessment(), reasons: [null] })).toBeNull();
    expect(readRiskAssessment({ ...assessment(), reasons: {} })).toBeNull();
  });
});

describe('construction minimale du corps T26', () => {
  it('envoie uniquement une vue numérique des opérations sortantes', () => {
    const history = [
      payment({ id: 'ancien', amountSats: 500, createdAt: iso(-90_000_000) }),
      payment({ id: 'succes', amountSats: 2000, createdAt: iso(-120_000) }),
      payment({ id: 'attente', amountSats: 3000, status: 'en_attente', createdAt: iso(-60_000) }),
      payment({ id: 'recu', direction: 'recu', amountSats: 4000 }),
      payment({ id: 'echec', status: 'echoue', amountSats: 5000 }),
      payment({ id: 'futur', createdAt: iso(1), amountSats: 6000 }),
    ];
    expect(build(history)).toEqual({
      amountSats: 20_000,
      newRecipient: true,
      recentPayments: [
        { amountSats: 3000, ageSeconds: 60 },
        { amountSats: 2000, ageSeconds: 120 },
      ],
      usualAmountsSats: [2000, 500],
      localHour: new Date(now).getHours(),
      balanceSats: 100_000,
    });
    expect(history.map((row) => row.id)).toEqual([
      'ancien',
      'succes',
      'attente',
      'recu',
      'echec',
      'futur',
    ]);
    const serialized = JSON.stringify(build(history));
    expect(serialized).not.toMatch(
      /destinataire|teranga\.example|mémo|Libellé|paiement|succes|ancien/i,
    );
  });

  it('inclut exactement la limite des 24 h et arrondit les âges à la seconde entière', () => {
    expect(
      build([
        payment({ id: 'limite', createdAt: iso(-86_400_000), amountSats: 100 }),
        payment({ id: 'hors', createdAt: iso(-86_400_001), amountSats: 200 }),
        payment({ id: 'recent', createdAt: iso(-1999), amountSats: 300 }),
      ])?.recentPayments,
    ).toEqual([
      { amountSats: 300, ageSeconds: 1 },
      { amountSats: 100, ageSeconds: 86_400 },
    ]);
  });

  it('accepte un historique vide et les 50 dernières opérations valides', () => {
    expect(build([])).toMatchObject({ recentPayments: [], usualAmountsSats: [] });
    const history = Array.from({ length: 50 }, (_, index) => payment({ id: `fictif-${index}` }));
    expect(build(history)?.recentPayments).toHaveLength(50);
    expect(build([...history, payment({ id: 'supplementaire' })])).toBeNull();
  });

  it('refuse les doublons au lieu de compter deux fois un même envoi', () => {
    expect(build([payment(), payment()])).toBeNull();
  });

  it('copie et fige les tableaux numériques et les éléments récents', () => {
    const source = [payment()];
    const result = build(source)!;
    source[0]!.amountSats = 9999;
    expect(result.usualAmountsSats).toEqual([1000]);
    expect(result.recentPayments[0]!.amountSats).toBe(1000);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.recentPayments)).toBe(true);
    expect(Object.isFrozen(result.recentPayments[0])).toBe(true);
    expect(Object.isFrozen(result.usualAmountsSats)).toBe(true);
  });

  it.each([0, -1, 0.5, maxSats + 1, NaN, Infinity, null])(
    'refuse un montant à envoyer invalide : %p',
    (amountSats) => {
      expect(
        buildRiskCheck({ preview: { ...preview, amountSats }, balance, history: [], now }),
      ).toBeNull();
    },
  );

  it('respecte la borne Bitcoin et accepte le solde nul sans taux FCFA', () => {
    expect(
      buildRiskCheck({
        preview: { ...preview, amountSats: maxSats },
        balance: { ...balance, spendableSats: 0, spendableXof: null, rate: null },
        history: [],
        now,
      }),
    ).toMatchObject({ amountSats: maxSats, balanceSats: 0 });
  });

  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER])(
    'refuse une horloge invalide : %p',
    (clock) => {
      expect(buildRiskCheck({ preview, balance, history: [], now: clock })).toBeNull();
    },
  );

  it.each([
    { spendableSats: maxSats + 1 },
    { pendingSats: -1 },
    { spendableXof: -1 },
    { updatedAt: '2026-02-30T12:00:00.000Z' },
    { rate: null },
    { rate: { xofPerBtc: 0, source: 'fixe' as const, fetchedAt: iso() } },
  ])('refuse un solde malformé : %p', (patch) => {
    expect(
      buildRiskCheck({ preview, balance: { ...balance, ...patch }, history: [], now }),
    ).toBeNull();
  });

  it.each([
    { amountSats: 0 },
    { amountSats: maxSats + 1 },
    { feeSats: -1 },
    { createdAt: '2026-02-30T12:00:00.000Z' },
    { id: '' },
    { memo: 'texte\nnon admis' },
    { amountXof: -1 },
  ])('refuse tout historique malformé, y compris une opération reçue : %p', (patch) => {
    expect(build([payment({ ...patch, direction: 'recu' })])).toBeNull();
  });
});

describe('transport injecté T26', () => {
  it('utilise le chemin T26, filtre les champs privés et valide la réponse', async () => {
    const transport = jest.fn(async () => ({ ...assessment(), detailInterne: 'ignoré' }));
    const port = createRiskPort(transport);
    const source = { ...check(), destination: 'destinataire@teranga.example', memo: 'local' };
    await expect(port.check(source)).resolves.toEqual(assessment());
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith('/v1/alerts/payment-check', check());
    const body = (transport.mock.calls as unknown as [string, RiskCheck][])[0]![1];
    expect(body).not.toBe(source);
    expect(Object.isFrozen(body)).toBe(true);
    expect(Object.isFrozen(body.recentPayments[0])).toBe(true);
  });

  it('accepte les champs optionnels absents et ne les envoie pas comme undefined', async () => {
    const transport = jest.fn(async () => assessment());
    const input: RiskCheck = {
      amountSats: 20_000,
      newRecipient: true,
      recentPayments: [],
      usualAmountsSats: [],
    };
    await createRiskPort(transport).check(input);
    const body = (transport.mock.calls as unknown as [string, RiskCheck][])[0]![1];
    expect(Object.keys(body).sort()).toEqual([
      'amountSats',
      'newRecipient',
      'recentPayments',
      'usualAmountsSats',
    ]);
  });

  it.each([
    { amountSats: 0 },
    { amountSats: maxSats + 1 },
    { localHour: 24 },
    { balanceSats: -1 },
    { recentPayments: [{ amountSats: 1, ageSeconds: 86_401 }] },
    { recentPayments: [{ amountSats: -1, ageSeconds: 1 }] },
    { recentPayments: Array.from({ length: 51 }, () => ({ amountSats: 1, ageSeconds: 1 })) },
    { usualAmountsSats: [-1] },
    { usualAmountsSats: Array.from({ length: 51 }, () => 1) },
  ])('ne contacte jamais le serveur pour une requête invalide : %p', async (patch) => {
    const transport = jest.fn(async () => assessment());
    await expect(createRiskPort(transport).check(check(patch))).rejects.toThrow(
      'RISK_INVALID_INPUT',
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('nettoie les exceptions du transport sans exposer leur contenu', async () => {
    const transport = jest.fn(async () => {
      throw new Error('détail sensible fictif du transport');
    });
    await expect(createRiskPort(transport).check(check())).rejects.toThrow(/^RISK_UNAVAILABLE$/);
  });

  it('refuse une erreur HTTP passée telle quelle ou une réponse inconnue', async () => {
    const transport = jest.fn(async () => ({
      error: { code: 'RATE_LIMITED', requestId: 'fictif' },
    }));
    await expect(createRiskPort(transport).check(check())).rejects.toThrow(
      /^RISK_INVALID_RESPONSE$/,
    );
  });
});
