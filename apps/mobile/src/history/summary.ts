import type { HomePayment } from '../home/ports';
import { isHomeIsoDate } from '../home/format';
import type { HistoryWithdrawal } from './ports';

export type HistoryCoverage = 'complete' | 'partial' | 'unavailable';
export type HistoryDailyBucket = Readonly<{
  count: number;
  sats: number | null;
  xof: number | null;
  knownXof: number | null;
  unknownXofCount: number;
  feeSats: number | null;
  overflow: boolean;
}>;
export type HistoryDailySummary = Readonly<{
  dayKey: string;
  timeZone: 'Africa/Dakar';
  dateBasis: 'createdAt';
  received: HistoryDailyBucket;
  sent: HistoryDailyBucket;
  simulatedWithdrawals: HistoryDailyBucket;
  walletCoverage: HistoryCoverage;
  withdrawalCoverage: HistoryCoverage;
  walletStale: boolean;
  withdrawalsStale: boolean;
}>;

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Dakar',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
/** Clé complète du jour d’opération ; indépendante du fuseau du téléphone. */
export function historyDayKey(value: number | string): string {
  if (
    (typeof value === 'string' && !isHomeIsoDate(value)) ||
    !Number.isFinite(new Date(value).getTime())
  )
    throw new RangeError('INVALID_DATE');
  const parts = dayFormat.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function bucket(
  items: readonly { amountSats: number; feeSats: number; amountXof: number | null }[],
): HistoryDailyBucket {
  let sats = 0n,
    fees = 0n,
    xof = 0n,
    unknown = 0;
  for (const item of items) {
    sats += BigInt(item.amountSats);
    fees += BigInt(item.feeSats);
    if (item.amountXof === null) unknown += 1;
    else xof += BigInt(item.amountXof);
  }
  const safe = (amount: bigint) =>
    amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null;
  const knownXof = safe(xof),
    principal = safe(sats),
    feeSats = safe(fees);
  return Object.freeze({
    count: items.length,
    sats: principal,
    xof: unknown ? null : knownXof,
    knownXof,
    unknownXofCount: unknown,
    feeSats,
    overflow: principal === null || knownXof === null || feeSats === null,
  });
}
export function summarizeHistory({
  payments,
  withdrawals,
  now,
  walletCoverage,
  withdrawalCoverage,
  walletStale,
  withdrawalsStale,
}: {
  payments: readonly Readonly<HomePayment>[];
  withdrawals: readonly Readonly<HistoryWithdrawal>[];
  now: number;
  walletCoverage: HistoryCoverage;
  withdrawalCoverage: HistoryCoverage;
  walletStale: boolean;
  withdrawalsStale: boolean;
}): HistoryDailySummary {
  const dayKey = historyDayKey(now);
  const successful = payments.filter(
    (item) => item.status === 'reussi' && historyDayKey(item.createdAt) === dayKey,
  );
  return Object.freeze({
    dayKey,
    timeZone: 'Africa/Dakar',
    dateBasis: 'createdAt',
    received: bucket(successful.filter((item) => item.direction === 'recu')),
    sent: bucket(successful.filter((item) => item.direction === 'envoye')),
    simulatedWithdrawals: bucket(
      withdrawals.filter(
        (item) => item.status === 'reussi' && historyDayKey(item.createdAt) === dayKey,
      ),
    ),
    walletCoverage,
    withdrawalCoverage,
    walletStale,
    withdrawalsStale,
  });
}
