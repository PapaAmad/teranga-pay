import type { HomeBalance, HomePayment } from '../home/ports';
import type { SendPaymentPreview } from '../send/ports';
import type { RiskAssessment, RiskCheck, RiskPort, RiskReasonCode } from './ports';

const maxSats = 2_100_000_000_000_000;
const reasonCodes: ReadonlySet<string> = new Set([
  'NOUVEAU_DESTINATAIRE',
  'MONTANT_INHABITUEL',
  'MONTANT_TRES_INHABITUEL',
  'GROS_MONTANT',
  'RYTHME_ANORMAL',
  'PRESQUE_TOUT_LE_SOLDE',
  'HEURE_INHABITUELLE',
]);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const sats = (value: unknown, min = 0): value is number => integer(value, min, maxSats);
const iso = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z');

function safeText(value: unknown, max: number): value is string {
  if (typeof value !== 'string' || value.length > max) return false;
  for (const character of value) {
    const point = character.charCodeAt(0);
    if (
      point < 32 ||
      (point >= 127 && point <= 159) ||
      (point >= 0x202a && point <= 0x202e) ||
      (point >= 0x2066 && point <= 0x2069)
    )
      return false;
  }
  return true;
}

/** Aucun seuil, poids ni niveau n'est recalculé par le téléphone. */
export function readRiskAssessment(value: unknown): RiskAssessment | null {
  if (
    !record(value) ||
    !integer(value.score, 0, 100) ||
    !['faible', 'moyen', 'eleve'].includes(value.level as string) ||
    typeof value.confirmationRequired !== 'boolean' ||
    !Array.isArray(value.reasons) ||
    value.reasons.length > 7 ||
    (value.confirmationRequired && value.reasons.length === 0)
  )
    return null;
  const reasons: { code: RiskReasonCode; points: number }[] = [];
  const seen = new Set<string>();
  for (const reason of value.reasons) {
    if (
      !record(reason) ||
      typeof reason.code !== 'string' ||
      !reasonCodes.has(reason.code) ||
      seen.has(reason.code) ||
      !integer(reason.points, 0, 100)
    )
      return null;
    seen.add(reason.code);
    reasons.push(Object.freeze({ code: reason.code as RiskReasonCode, points: reason.points }));
  }
  return Object.freeze({
    score: value.score,
    level: value.level as RiskAssessment['level'],
    confirmationRequired: value.confirmationRequired,
    reasons: Object.freeze(reasons),
  });
}

function readRiskCheck(value: unknown): RiskCheck | null {
  if (
    !record(value) ||
    !sats(value.amountSats, 1) ||
    typeof value.newRecipient !== 'boolean' ||
    !Array.isArray(value.recentPayments) ||
    value.recentPayments.length > 50 ||
    !Array.isArray(value.usualAmountsSats) ||
    value.usualAmountsSats.length > 50 ||
    (value.localHour !== undefined && !integer(value.localHour, 0, 23)) ||
    (value.balanceSats !== undefined && !sats(value.balanceSats))
  )
    return null;
  const recent: { amountSats: number; ageSeconds: number }[] = [];
  for (const payment of value.recentPayments) {
    if (!record(payment) || !sats(payment.amountSats) || !integer(payment.ageSeconds, 0, 86_400))
      return null;
    recent.push(Object.freeze({ amountSats: payment.amountSats, ageSeconds: payment.ageSeconds }));
  }
  if (!value.usualAmountsSats.every((amount) => sats(amount))) return null;
  return Object.freeze({
    amountSats: value.amountSats,
    newRecipient: value.newRecipient,
    recentPayments: Object.freeze(recent),
    usualAmountsSats: Object.freeze([...value.usualAmountsSats]) as readonly number[],
    ...(value.localHour === undefined ? {} : { localHour: value.localHour as number }),
    ...(value.balanceSats === undefined ? {} : { balanceSats: value.balanceSats as number }),
  });
}

function validBalance(value: unknown): value is HomeBalance {
  if (
    !record(value) ||
    !sats(value.spendableSats) ||
    !sats(value.pendingSats) ||
    !(value.spendableXof === null || integer(value.spendableXof)) ||
    !iso(value.updatedAt)
  )
    return false;
  if (value.rate === null) return value.spendableXof === null;
  return (
    record(value.rate) &&
    integer(value.rate.xofPerBtc, 1) &&
    ['fixe', 'kraken'].includes(value.rate.source as string) &&
    iso(value.rate.fetchedAt)
  );
}

function validPayment(value: unknown): value is HomePayment {
  return (
    record(value) &&
    safeText(value.id, 128) &&
    value.id.length > 0 &&
    ['recu', 'envoye'].includes(value.direction as string) &&
    ['reussi', 'en_attente', 'echoue'].includes(value.status as string) &&
    sats(value.amountSats, 1) &&
    sats(value.feeSats) &&
    (value.amountXof === null || integer(value.amountXof)) &&
    (value.memo === null || safeText(value.memo, 512)) &&
    iso(value.createdAt) &&
    (value.failure === null || safeText(value.failure, 128))
  );
}

/**
 * Vue numérique des 50 dernières opérations fournies par le wallet.
 * Les attentes comptent pour le rythme, seuls les succès forment les habitudes.
 */
export function buildRiskCheck({
  preview,
  balance,
  history,
  now,
}: {
  preview: SendPaymentPreview;
  balance: HomeBalance;
  history: HomePayment[];
  now: number;
}): RiskCheck | null {
  if (
    !record(preview) ||
    !sats(preview.amountSats, 1) ||
    typeof preview.newRecipient !== 'boolean' ||
    !validBalance(balance) ||
    !Array.isArray(history) ||
    history.length > 50 ||
    !integer(now, 0) ||
    !Number.isFinite(new Date(now).getTime())
  )
    return null;
  const identifiers = new Set<string>();
  for (const payment of history) {
    if (!validPayment(payment) || identifiers.has(payment.id)) return null;
    identifiers.add(payment.id);
  }
  const eligible = history
    .filter(
      (payment) =>
        payment.direction === 'envoye' &&
        payment.status !== 'echoue' &&
        Date.parse(payment.createdAt) <= now,
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return readRiskCheck({
    amountSats: preview.amountSats,
    newRecipient: preview.newRecipient,
    recentPayments: eligible
      .filter((payment) => now - Date.parse(payment.createdAt) <= 86_400_000)
      .map((payment) => ({
        amountSats: payment.amountSats,
        ageSeconds: Math.floor((now - Date.parse(payment.createdAt)) / 1000),
      })),
    usualAmountsSats: eligible
      .filter((payment) => payment.status === 'reussi')
      .map((payment) => payment.amountSats),
    localHour: new Date(now).getHours(),
    balanceSats: balance.spendableSats,
  });
}

/** Le transport est injecté par la composition ; aucune URL ni clé n'est embarquée ici. */
export function createRiskPort(
  transport: (path: string, body: RiskCheck) => Promise<unknown>,
): RiskPort {
  return Object.freeze({
    async check(input: RiskCheck): Promise<RiskAssessment> {
      const check = readRiskCheck(input);
      if (!check) throw new Error('RISK_INVALID_INPUT');
      let response: unknown;
      try {
        response = await transport('/v1/alerts/payment-check', check);
      } catch {
        throw new Error('RISK_UNAVAILABLE');
      }
      const assessment = readRiskAssessment(response);
      if (!assessment) throw new Error('RISK_INVALID_RESPONSE');
      return assessment;
    },
  });
}
