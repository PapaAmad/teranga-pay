import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  BridgeError,
  type BridgeBalance,
  type BridgeProviderResult,
  type BridgeQuote,
  type BridgeQuoteInput,
  type BridgeStore,
  type Withdrawal,
  type WithdrawalStatus,
} from './types.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNER = /^demo-[a-z0-9-]{1,40}$/;
const INPUT_FIELDS = [
  'id',
  'operator',
  'recipientId',
  'amountXof',
  'feeXof',
  'totalXof',
  'amountSats',
  'feeSats',
  'totalSats',
  'xofPerBtc',
  'source',
  'createdAt',
  'expiresAt',
] as const;

function ownerId(value: unknown): string {
  if (typeof value !== 'string' || !OWNER.test(value)) throw new BridgeError('INVALID_INPUT');
  return value;
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new BridgeError('INVALID_INPUT');
  return value.toLowerCase();
}
function integer(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}
function instant(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value))
    throw new BridgeError('INVALID_INPUT');
  const time = Date.parse(value);
  const normal = value.replace(
    /(?:\.(\d{1,3}))?Z$/,
    (_match, fraction: string | undefined) => `.${(fraction ?? '').padEnd(3, '0')}Z`,
  );
  if (!Number.isFinite(time) || new Date(time).toISOString() !== normal)
    throw new BridgeError('INVALID_INPUT');
  return normal;
}
function validQuote(input: BridgeQuoteInput, now: number): BridgeQuote {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== INPUT_FIELDS.length ||
    Object.keys(input).some((key) => !INPUT_FIELDS.includes(key as (typeof INPUT_FIELDS)[number]))
  )
    throw new BridgeError('INVALID_INPUT');
  const id = uuid(input.id);
  if (
    (input.operator !== 'wave' && input.operator !== 'orange_money') ||
    input.recipientId !== (input.operator === 'wave' ? 'wave-demo-001' : 'orange-demo-001') ||
    !integer(input.amountXof, 1) ||
    input.amountXof > 5_000_000 ||
    input.feeXof !== 100 ||
    input.totalXof !== input.amountXof + input.feeXof ||
    !integer(input.xofPerBtc, 1) ||
    !integer(input.amountSats, 1) ||
    !integer(input.feeSats) ||
    !integer(input.totalSats, 1) ||
    (input.source !== 'fixe' && input.source !== 'kraken')
  )
    throw new BridgeError('INVALID_INPUT');
  const sats = (xof: number) =>
    (BigInt(xof) * 100_000_000n + BigInt(input.xofPerBtc) - 1n) / BigInt(input.xofPerBtc);
  if (
    BigInt(input.amountSats) !== sats(input.amountXof) ||
    BigInt(input.totalSats) !== sats(input.totalXof) ||
    input.feeSats !== input.totalSats - input.amountSats
  )
    throw new BridgeError('INVALID_INPUT');
  const createdAt = instant(input.createdAt),
    expiresAt = instant(input.expiresAt);
  const created = Date.parse(createdAt),
    expires = Date.parse(expiresAt);
  if (expires <= created || expires - created > 300_000 || expires <= now || created > now + 30_000)
    throw new BridgeError('INVALID_INPUT');
  return Object.freeze({ ...input, id, createdAt, expiresAt, simulation: true });
}

type Row = Record<string, string | number | bigint | Uint8Array | null>;
function parseQuote(row: Row): BridgeQuote {
  return Object.freeze(JSON.parse(String(row.payload)) as BridgeQuote);
}
function parseWithdrawal(row: Row): Withdrawal {
  return Object.freeze({
    ...JSON.parse(String(row.payload)),
    status: row.status as WithdrawalStatus,
    failure: row.failure as string | null,
    updatedAt: String(row.updated_at),
  }) as Withdrawal;
}
const providerPayload = (withdrawal: Withdrawal) =>
  JSON.stringify({
    simulation: true,
    operationId: withdrawal.id,
    operator: withdrawal.operator,
    recipientId: withdrawal.recipientId,
    amountXof: withdrawal.amountXof,
  });

/** Petit journal SQLite de démonstration, synchrone et durable. */
export function createBridgeStore({
  path,
  now = Date.now,
}: {
  path: string;
  now?: () => number;
}): BridgeStore {
  if (typeof path !== 'string' || !path || path.includes('\0') || /^file:/i.test(path))
    throw new BridgeError('INVALID_INPUT');
  const db = new DatabaseSync(path, { timeout: 5_000 });
  let closed = false;
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS bridge_accounts (
      owner TEXT PRIMARY KEY, available_sats INTEGER NOT NULL CHECK(available_sats >= 0),
      held_sats INTEGER NOT NULL DEFAULT 0 CHECK(held_sats >= 0)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS bridge_quotes (
      owner TEXT NOT NULL REFERENCES bridge_accounts(owner), id TEXT NOT NULL,
      payload TEXT NOT NULL, PRIMARY KEY(owner, id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS bridge_withdrawals (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, idempotency_key TEXT NOT NULL,
      quote_id TEXT NOT NULL, payload TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('en_attente','incertain','reussi','echoue')),
      failure TEXT, reserved_sats INTEGER NOT NULL CHECK(reserved_sats > 0),
      updated_at TEXT NOT NULL, UNIQUE(owner, idempotency_key), UNIQUE(owner, quote_id),
      FOREIGN KEY(owner, quote_id) REFERENCES bridge_quotes(owner, id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS bridge_provider_results (
      operation_id TEXT PRIMARY KEY REFERENCES bridge_withdrawals(id),
      payload TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('reussi','echoue')),
      failure TEXT, credit_xof INTEGER NOT NULL CHECK(credit_xof >= 0)
    ) STRICT;
  `);
  function open() {
    if (closed) throw new BridgeError('STORAGE_CLOSED');
  }
  function clock(): number {
    const value = now();
    if (!integer(value) || !Number.isFinite(new Date(value).getTime()))
      throw new BridgeError('INVALID_INPUT');
    return value;
  }
  function transaction<T>(run: () => T): T {
    open();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = run();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        /* SQLite peut déjà avoir annulé la transaction. */
      }
      throw error;
    }
  }
  function account(owner: string): Row {
    const row = db
      .prepare('SELECT available_sats, held_sats FROM bridge_accounts WHERE owner = ?')
      .get(owner);
    if (!row) throw new BridgeError('ACCOUNT_NOT_FOUND');
    return row;
  }
  function withdrawalById(id: string): Row {
    const row = db.prepare('SELECT * FROM bridge_withdrawals WHERE id = ?').get(id);
    if (!row) throw new BridgeError('WITHDRAWAL_NOT_FOUND');
    return row;
  }
  return {
    seedAccount(owner, availableSats) {
      open();
      ownerId(owner);
      if (!integer(availableSats)) throw new BridgeError('INVALID_INPUT');
      db.prepare('INSERT OR IGNORE INTO bridge_accounts(owner, available_sats) VALUES (?, ?)').run(
        owner,
        availableSats,
      );
    },
    offer(owner, input) {
      ownerId(owner);
      const quote = validQuote(input, clock()),
        payload = JSON.stringify(quote);
      return transaction(() => {
        account(owner);
        const existing = db
          .prepare('SELECT payload FROM bridge_quotes WHERE owner = ? AND id = ?')
          .get(owner, quote.id);
        if (existing) {
          if (existing.payload !== payload) throw new BridgeError('QUOTE_CONFLICT');
          return parseQuote(existing);
        }
        db.prepare('INSERT INTO bridge_quotes(owner, id, payload) VALUES (?, ?, ?)').run(
          owner,
          quote.id,
          payload,
        );
        return quote;
      });
    },
    getQuote(owner, id) {
      open();
      ownerId(owner);
      id = uuid(id);
      const row = db
        .prepare('SELECT payload FROM bridge_quotes WHERE owner = ? AND id = ?')
        .get(owner, id);
      return row ? parseQuote(row) : null;
    },
    balance(owner): BridgeBalance {
      open();
      const row = account(ownerId(owner));
      return Object.freeze({
        simulation: true,
        availableSats: Number(row.available_sats),
        heldSats: Number(row.held_sats),
      });
    },
    close() {
      if (!closed) {
        db.close();
        closed = true;
      }
    },
    reserve(owner, key, quoteId) {
      ownerId(owner);
      key = uuid(key);
      quoteId = uuid(quoteId);
      return transaction(() => {
        const replay = db
          .prepare('SELECT * FROM bridge_withdrawals WHERE owner = ? AND idempotency_key = ?')
          .get(owner, key);
        if (replay) {
          if (replay.quote_id !== quoteId)
            throw new BridgeError('IDEMPOTENCY_CONFLICT', { withdrawalId: String(replay.id) });
          return { withdrawal: parseWithdrawal(replay), replayed: true };
        }
        const used = db
          .prepare('SELECT id FROM bridge_withdrawals WHERE owner = ? AND quote_id = ?')
          .get(owner, quoteId);
        if (used) throw new BridgeError('QUOTE_ALREADY_USED', { withdrawalId: String(used.id) });
        const quoteRow = db
          .prepare('SELECT payload FROM bridge_quotes WHERE owner = ? AND id = ?')
          .get(owner, quoteId);
        if (!quoteRow) throw new BridgeError('QUOTE_NOT_FOUND');
        const quote = parseQuote(quoteRow),
          time = clock();
        if (time >= Date.parse(quote.expiresAt)) throw new BridgeError('QUOTE_EXPIRED');
        const balance = account(owner);
        if (Number(balance.available_sats) < quote.totalSats)
          throw new BridgeError('INSUFFICIENT_FUNDS');
        const { createdAt: quoteCreatedAt, expiresAt: quoteExpiresAt, ...values } = quote;
        const createdAt = new Date(time).toISOString();
        const withdrawal: Withdrawal = Object.freeze({
          ...values,
          id: randomUUID(),
          quoteId,
          quoteCreatedAt,
          quoteExpiresAt,
          createdAt,
          updatedAt: createdAt,
          status: 'en_attente',
          failure: null,
        });
        db.prepare(
          'UPDATE bridge_accounts SET available_sats = available_sats - ?, held_sats = held_sats + ? WHERE owner = ?',
        ).run(quote.totalSats, quote.totalSats, owner);
        db.prepare(
          'INSERT INTO bridge_withdrawals(id, owner, idempotency_key, quote_id, payload, status, failure, reserved_sats, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          withdrawal.id,
          owner,
          key,
          quoteId,
          JSON.stringify(withdrawal),
          withdrawal.status,
          null,
          quote.totalSats,
          createdAt,
        );
        return { withdrawal, replayed: false };
      });
    },
    find(owner, id) {
      open();
      ownerId(owner);
      id = uuid(id);
      const row = db
        .prepare('SELECT * FROM bridge_withdrawals WHERE owner = ? AND id = ?')
        .get(owner, id);
      return row ? parseWithdrawal(row) : null;
    },
    history(owner, options = {}) {
      open();
      ownerId(owner);
      if (
        !options ||
        typeof options !== 'object' ||
        Array.isArray(options) ||
        Object.keys(options).some((key) => key !== 'limit' && key !== 'before')
      )
        throw new BridgeError('INVALID_INPUT');
      const limit = options.limit === undefined ? 20 : options.limit;
      if (!integer(limit, 1) || limit > 100) throw new BridgeError('INVALID_INPUT');
      const before = options.before === undefined ? null : uuid(options.before);
      account(owner);
      const anchor = before
        ? db
            .prepare(
              "SELECT json_extract(payload, '$.createdAt') AS created_at FROM bridge_withdrawals WHERE owner = ? AND id = ?",
            )
            .get(owner, before)
        : null;
      if (before && !anchor) throw new BridgeError('WITHDRAWAL_NOT_FOUND');
      // La date de création du retrait et son identifiant ne changent jamais :
      // une confirmation tardive ne déplace pas les lignes entre deux pages.
      const rows = anchor
        ? db
            .prepare(
              `SELECT * FROM bridge_withdrawals
               WHERE owner = ? AND (
                 json_extract(payload, '$.createdAt') < ? OR
                 (json_extract(payload, '$.createdAt') = ? AND id < ?)
               )
               ORDER BY json_extract(payload, '$.createdAt') DESC, id DESC LIMIT ?`,
            )
            .all(owner, anchor.created_at!, anchor.created_at!, before, limit + 1)
        : db
            .prepare(
              `SELECT * FROM bridge_withdrawals WHERE owner = ?
               ORDER BY json_extract(payload, '$.createdAt') DESC, id DESC LIMIT ?`,
            )
            .all(owner, limit + 1);
      const items = Object.freeze(rows.slice(0, limit).map(parseWithdrawal));
      return Object.freeze({
        simulation: true as const,
        items,
        nextCursor: rows.length > limit ? items[items.length - 1]!.id : null,
      });
    },
    settle(id, result, failure = null) {
      id = uuid(id);
      if (
        !['reussi', 'echoue', 'incertain'].includes(result) ||
        (failure !== null &&
          (typeof failure !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(failure)))
      )
        throw new BridgeError('INVALID_INPUT');
      return transaction(() => {
        const row = withdrawalById(id);
        if (row.status === 'reussi' || row.status === 'echoue') return parseWithdrawal(row);
        if (result !== 'incertain') {
          db.prepare(
            'UPDATE bridge_accounts SET available_sats = available_sats + ?, held_sats = held_sats - ? WHERE owner = ?',
          ).run(result === 'echoue' ? row.reserved_sats! : 0, row.reserved_sats!, row.owner!);
        }
        const updatedAt = new Date(clock()).toISOString();
        const code =
          result === 'reussi'
            ? null
            : (failure ?? (result === 'echoue' ? 'PROVIDER_DECLINED' : 'PROVIDER_UNAVAILABLE'));
        db.prepare(
          'UPDATE bridge_withdrawals SET status = ?, failure = ?, updated_at = ? WHERE id = ?',
        ).run(result, code, updatedAt, id);
        return parseWithdrawal(withdrawalById(id));
      });
    },
    recordProvider(withdrawal, status) {
      const id = uuid(withdrawal.id);
      if (status !== 'reussi' && status !== 'echoue') throw new BridgeError('INVALID_INPUT');
      return transaction(() => {
        const current = parseWithdrawal(withdrawalById(id));
        const payload = providerPayload(current);
        if (providerPayload(withdrawal) !== payload) throw new BridgeError('PROVIDER_MISMATCH');
        const existing = db
          .prepare('SELECT * FROM bridge_provider_results WHERE operation_id = ?')
          .get(id);
        if (existing) {
          if (existing.payload !== payload) throw new BridgeError('PROVIDER_MISMATCH');
          return Object.freeze({
            ...JSON.parse(payload),
            status: existing.status,
            failure: existing.failure,
          }) as BridgeProviderResult;
        }
        const failure = status === 'echoue' ? 'PROVIDER_DECLINED' : null;
        db.prepare(
          'INSERT INTO bridge_provider_results(operation_id, payload, status, failure, credit_xof) VALUES (?, ?, ?, ?, ?)',
        ).run(id, payload, status, failure, status === 'reussi' ? current.amountXof : 0);
        return Object.freeze({ ...JSON.parse(payload), status, failure }) as BridgeProviderResult;
      });
    },
    lookupProvider(id) {
      open();
      id = uuid(id);
      const row = db
        .prepare('SELECT * FROM bridge_provider_results WHERE operation_id = ?')
        .get(id);
      return row
        ? (Object.freeze({
            ...JSON.parse(String(row.payload)),
            status: row.status,
            failure: row.failure,
          }) as BridgeProviderResult)
        : null;
    },
  };
}
