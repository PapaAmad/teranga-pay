import type { HomeBalance } from './ports';

/** Formats de valeurs uniquement : unités, légendes et libellés viennent de T09. */
const integerFormat = new Intl.NumberFormat('fr-SN', {
  useGrouping: true,
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat('fr-SN', {
  timeZone: 'Africa/Dakar',
  day: 'numeric',
  month: 'short',
});

const dateTimeFormat = new Intl.DateTimeFormat('fr-SN', {
  timeZone: 'Africa/Dakar',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Un ISO UTC valide, sans correction silencieuse des dates impossibles. */
export function isHomeIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!parts) return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  const expected = `${parts[1]}.${(parts[2] ?? '').padEnd(3, '0')}Z`;
  return new Date(time).toISOString() === expected;
}

export function formatHomeNumber(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('INVALID_AMOUNT');
  // Les moteurs Intl emploient deux espaces insécables différents ; stabiliser l'affichage.
  return integerFormat.format(value).replace(/[\u202f\u00a0]/g, '\u00a0');
}

export function formatHomeSignedNumber(value: number, direction: 'recu' | 'envoye'): string {
  return `${direction === 'recu' ? '+' : '\u2212'}${formatHomeNumber(value)}`;
}

/** Même arrondi inférieur que T11 ; aucun nombre non sûr n’est affiché comme une estimation. */
export function estimatePendingHomeXof(
  balance: Pick<HomeBalance, 'pendingSats' | 'rate'>,
): number | null {
  if (
    !Number.isSafeInteger(balance.pendingSats) ||
    balance.pendingSats < 0 ||
    !balance.rate ||
    !Number.isSafeInteger(balance.rate.xofPerBtc) ||
    balance.rate.xofPerBtc <= 0
  )
    return null;
  const amount = (BigInt(balance.pendingSats) * BigInt(balance.rate.xofPerBtc)) / 100_000_000n;
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null;
}

export function formatHomeDate(value: string, options: { time?: boolean } = {}): string {
  if (!isHomeIsoDate(value)) throw new RangeError('INVALID_DATE');
  return (options.time ? dateTimeFormat : dateFormat).format(new Date(value));
}
