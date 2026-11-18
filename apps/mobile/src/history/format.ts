import { formatHomeNumber } from '../home/format';
import type { HistoryEntry } from './ports';
import { historyDayKey } from './summary';

const dayFormat = new Intl.DateTimeFormat('fr-SN', {
  timeZone: 'Africa/Dakar',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const hourFormat = new Intl.DateTimeFormat('fr-SN', {
  timeZone: 'Africa/Dakar',
  hour: '2-digit',
  minute: '2-digit',
});
const dateTimeFormat = new Intl.DateTimeFormat('fr-SN', {
  timeZone: 'Africa/Dakar',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
export const historyDate = (value: string) => dateTimeFormat.format(new Date(value));
export const historyHour = (value: string) => hourFormat.format(new Date(value));
export const historyDayLabel = (key: string) => dayFormat.format(new Date(`${key}T12:00:00.000Z`));
export const historyEntryDate = (entry: HistoryEntry) =>
  entry.source === 'wallet' ? entry.payment.createdAt : entry.withdrawal.createdAt;
export const historyEntryStatus = (entry: HistoryEntry) =>
  entry.source === 'wallet' ? entry.payment.status : entry.withdrawal.status;
export const historyEntryId = (entry: HistoryEntry) =>
  entry.source === 'wallet' ? entry.payment.id : entry.withdrawal.id;
export function historySections(entries: readonly HistoryEntry[]) {
  const groups = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const key = historyDayKey(historyEntryDate(entry));
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return [...groups].map(([key, data]) => ({ key, data }));
}
export function historyAmountValue(entry: HistoryEntry) {
  return entry.source === 'wallet' ? entry.payment.amountXof : entry.withdrawal.amountXof;
}
export const historySatsValue = (entry: HistoryEntry) =>
  entry.source === 'wallet' ? entry.payment.amountSats : entry.withdrawal.amountSats;
export const historySignedNumber = (entry: HistoryEntry, value: number) =>
  `${entry.source === 'wallet' && entry.payment.direction === 'recu' ? '+' : '\u2212'}${formatHomeNumber(value)}`;
