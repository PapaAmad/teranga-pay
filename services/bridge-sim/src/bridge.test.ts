import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, it } from 'node:test';
import {
  createBridgeService,
  createBridgeStore,
  createSimulatedProvider,
  BridgeError,
  type BridgeProvider,
  type BridgeHistoryOptions,
  type BridgeQuoteInput,
  type BridgeStore,
  type Scenario,
} from './index.ts';

const owner = 'demo-client-a';
const other = 'demo-client-b';
const initialTime = Date.UTC(2026, 10, 11, 12);
const stores: BridgeStore[] = [],
  directories: string[] = [];
const initialBalance = 100_000;

function file() {
  const directory = mkdtempSync(join(tmpdir(), 'teranga-bridge-t23-'));
  directories.push(directory);
  return join(directory, 'bridge.sqlite');
}
function quote(overrides: Partial<BridgeQuoteInput> = {}): BridgeQuoteInput {
  return {
    id: randomUUID(),
    operator: 'wave',
    recipientId: 'wave-demo-001',
    amountXof: 2500,
    feeXof: 100,
    totalXof: 2600,
    amountSats: 5556,
    feeSats: 222,
    totalSats: 5778,
    xofPerBtc: 45_000_000,
    source: 'fixe',
    createdAt: new Date(initialTime).toISOString(),
    expiresAt: new Date(initialTime + 300_000).toISOString(),
    ...overrides,
  };
}
function setup({ path = ':memory:', scenario = 'success' as Scenario } = {}) {
  let time = initialTime;
  const store = createBridgeStore({ path, now: () => time });
  stores.push(store);
  store.seedAccount(owner, initialBalance);
  store.seedAccount(other, initialBalance);
  const provider = createSimulatedProvider(store, { scenario });
  const service = createBridgeService({ store, provider });
  return {
    store,
    provider,
    service,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) {
    const resolved = resolve(directory),
      allowed = resolve(tmpdir()) + sep;
    assert(resolved.startsWith(allowed));
    assert(resolved.slice(allowed.length).startsWith('teranga-bridge-t23-'));
    rmSync(resolved, { recursive: true, force: true });
  }
});

describe('journal paginé de la passerelle | lecture T24', () => {
  it('termine explicitement une liste vide et une page exactement pleine', async () => {
    const { store, service } = setup();
    assert.deepEqual(service.history(owner), { simulation: true, items: [], nextCursor: null });
    for (let index = 0; index < 2; index++) {
      const q = store.offer(owner, quote());
      await service.create(owner, randomUUID(), q.id);
    }
    const page = service.history(owner, { limit: 2 });
    assert.equal(page.items.length, 2);
    assert.equal(page.nextCursor, null);
    assert.equal(Object.isFrozen(page), true);
    assert.equal(Object.isFrozen(page.items), true);
  });

  it('parcourt les créations de même date sans doublon ni omission', async () => {
    const { store, service } = setup();
    const created = [];
    for (let index = 0; index < 5; index++) {
      const q = store.offer(owner, quote());
      created.push((await service.create(owner, randomUUID(), q.id)).withdrawal);
    }
    const expected = created
      .map((withdrawal) => withdrawal.id)
      .sort()
      .reverse();
    const first = service.history(owner, { limit: 2 });
    assert.equal(first.nextCursor, first.items[1]!.id);
    const second = service.history(owner, { limit: 2, before: first.nextCursor! });
    assert.equal(second.nextCursor, second.items[1]!.id);
    const last = service.history(owner, { limit: 2, before: second.nextCursor! });
    assert.equal(last.nextCursor, null);
    const ids = [...first.items, ...second.items, ...last.items].map((item) => item.id);
    assert.deepEqual(ids, expected);
    assert.equal(new Set(ids).size, 5);
    assert.deepEqual(
      service.history(owner, { limit: 2, before: first.nextCursor!.toUpperCase() }),
      second,
    );
  });

  it('borne par défaut la première page à vingt éléments et annonce la suite réelle', async () => {
    const { store, service } = setup();
    for (let index = 0; index < 21; index++) {
      const q = store.offer(
        owner,
        quote({ amountXof: 1, totalXof: 101, amountSats: 3, totalSats: 225 }),
      );
      await service.create(owner, randomUUID(), q.id);
    }
    const page = service.history(owner);
    assert.equal(page.items.length, 20);
    assert.equal(page.nextCursor, page.items[19]!.id);
    const last = service.history(owner, { before: page.nextCursor! });
    assert.equal(last.items.length, 1);
    assert.equal(last.nextCursor, null);
  });

  it('trie par création immuable et relit les statuts actualisés après redémarrage', async () => {
    const path = file();
    const { store, service, advance } = setup({ path, scenario: 'timeout_after_success' });
    const q1 = store.offer(owner, quote());
    const oldest = (await service.create(owner, randomUUID(), q1.id)).withdrawal;
    advance(1000);
    const q2 = store.offer(owner, quote());
    const newest = (await service.create(owner, randomUUID(), q2.id)).withdrawal;
    advance(1000);
    await service.reconcile(owner, oldest.id);
    const before = service.history(owner);
    assert.deepEqual(
      before.items.map((item) => item.id),
      [newest.id, oldest.id],
    );
    assert.equal(before.items[1]!.status, 'reussi');
    assert.equal(before.items[1]!.createdAt, oldest.createdAt);
    assert.notEqual(before.items[1]!.updatedAt, oldest.updatedAt);
    store.close();
    const restarted = setup({ path });
    assert.deepEqual(restarted.service.history(owner), before);
  });

  it('isole les listes et cache les curseurs inconnus ou d’un autre propriétaire', async () => {
    const { store, service } = setup();
    const own = store.offer(owner, quote());
    const ownWithdrawal = (await service.create(owner, randomUUID(), own.id)).withdrawal;
    const foreign = store.offer(other, quote());
    const foreignWithdrawal = (await service.create(other, randomUUID(), foreign.id)).withdrawal;
    assert.deepEqual(
      service.history(owner).items.map((item) => item.id),
      [ownWithdrawal.id],
    );
    assert.deepEqual(
      service.history(other).items.map((item) => item.id),
      [foreignWithdrawal.id],
    );
    for (const before of [randomUUID(), foreignWithdrawal.id]) {
      assert.throws(() => service.history(owner, { before }), { code: 'WITHDRAWAL_NOT_FOUND' });
    }
  });

  it('ne soumet ni ne réconcilie un retrait pendant la lecture du journal', async () => {
    const { store, provider } = setup({ scenario: 'timeout_after_success' });
    let submits = 0,
      lookups = 0;
    const service = createBridgeService({
      store,
      provider: {
        async submit(withdrawal) {
          submits++;
          return provider.submit(withdrawal);
        },
        async lookup(id) {
          lookups++;
          return provider.lookup(id);
        },
      },
    });
    const q = store.offer(owner, quote());
    const withdrawal = (await service.create(owner, randomUUID(), q.id)).withdrawal;
    const balance = store.balance(owner);
    for (let index = 0; index < 3; index++) {
      const page = service.history(owner, { limit: 1 });
      assert.equal(page.items[0]!.status, 'incertain');
      assert.equal(page.items[0]!.id, withdrawal.id);
    }
    assert.equal(submits, 1);
    assert.equal(lookups, 0);
    assert.deepEqual(store.balance(owner), balance);
  });

  for (const limit of [0, -1, 101, 1.5, NaN, '2', null]) {
    it(`refuse une limite de page invalide (${String(limit)})`, () => {
      const { store } = setup();
      assert.throws(() => store.history(owner, { limit } as BridgeHistoryOptions), {
        code: 'INVALID_INPUT',
      });
    });
  }

  it('refuse options ou curseur malformés et propriétaire inexistant', () => {
    const { store } = setup();
    for (const options of [
      null,
      [],
      { before: '' },
      { before: null },
      { before: 'invalide' },
      { extra: true },
    ]) {
      assert.throws(() => store.history(owner, options as BridgeHistoryOptions), {
        code: 'INVALID_INPUT',
      });
    }
    assert.throws(() => store.history('demo-absent'), { code: 'ACCOUNT_NOT_FOUND' });
  });
});

describe('reprise explicite du même retrait | review T23', () => {
  it('reprend après panne et redémarrage en conservant identité, devis expiré et réservation', async () => {
    const path = file();
    const first = setup({ path, scenario: 'unavailable' });
    const q = first.store.offer(owner, quote());
    const created = await first.service.create(owner, randomUUID(), q.id);
    first.store.close();
    const next = setup({ path });
    next.advance(600_000);
    const retried = await next.service.retry(owner, created.withdrawal.id);
    assert.equal(retried?.id, created.withdrawal.id);
    assert.equal(retried?.quoteId, q.id);
    assert.equal(retried?.status, 'reussi');
    assert.equal(retried?.quoteExpiresAt, q.expiresAt);
    assert.deepEqual(next.store.balance(owner), {
      simulation: true,
      availableSats: initialBalance - q.totalSats,
      heldSats: 0,
    });
    assert.equal(next.service.history(owner).items.length, 1);
  });

  it('reprend vingt fois simultanément avec un seul effet durable et aucune nouvelle réservation', async () => {
    const path = file();
    const initial = setup({ path, scenario: 'unavailable' });
    const q = initial.store.offer(owner, quote());
    const original = (await initial.service.create(owner, randomUUID(), q.id)).withdrawal;
    const recovery = setup({ path });
    let submissions = 0;
    const service = createBridgeService({
      store: recovery.store,
      provider: {
        ...recovery.provider,
        async submit(withdrawal) {
          submissions++;
          return recovery.provider.submit(withdrawal);
        },
      },
    });
    const results = await Promise.all(
      Array.from({ length: 20 }, () => service.retry(owner, original.id)),
    );
    assert.equal(new Set(results.map((result) => result?.id)).size, 1);
    assert(results.every((result) => result?.status === 'reussi'));
    assert(submissions > 1, 'Le scénario doit exercer la déduplication du journal opérateur.');
    assert.deepEqual(recovery.store.balance(owner), {
      simulation: true,
      availableSats: initialBalance - q.totalSats,
      heldSats: 0,
    });
    const database = new DatabaseSync(path);
    try {
      assert.equal(
        database.prepare('SELECT count(*) AS count FROM bridge_withdrawals').get()!.count,
        1,
      );
      assert.equal(
        database.prepare('SELECT count(*) AS count FROM bridge_provider_results').get()!.count,
        1,
      );
      assert.equal(
        database.prepare('SELECT sum(credit_xof) AS credit FROM bridge_provider_results').get()!
          .credit,
        2500,
      );
    } finally {
      database.close();
    }
  });

  it('rapproche d’abord un succès dont la réponse est perdue sans resoumettre', async () => {
    const h = setup({ scenario: 'timeout_after_success' });
    const q = h.store.offer(owner, quote());
    const original = (await h.service.create(owner, randomUUID(), q.id)).withdrawal;
    let submissions = 0;
    const service = createBridgeService({
      store: h.store,
      provider: {
        ...h.provider,
        async submit(withdrawal) {
          submissions++;
          return h.provider.submit(withdrawal);
        },
      },
    });
    assert.equal((await service.retry(owner, original.id))?.status, 'reussi');
    assert.equal(submissions, 0);
  });

  it('ne soumet rien si la lecture opérateur échoue', async () => {
    const h = setup({ scenario: 'unavailable' });
    const q = h.store.offer(owner, quote());
    const original = (await h.service.create(owner, randomUUID(), q.id)).withdrawal;
    let submissions = 0;
    const service = createBridgeService({
      store: h.store,
      provider: {
        async lookup() {
          throw new Error('indisponibilité fictive');
        },
        async submit(withdrawal) {
          submissions++;
          return h.provider.submit(withdrawal);
        },
      },
    });
    assert.equal((await service.retry(owner, original.id))?.status, 'incertain');
    assert.equal(submissions, 0);
    assert.equal(h.store.balance(owner).heldSats, q.totalSats);
  });

  for (const [label, value] of [
    ['undefined', undefined],
    ['false', false],
    ['objet incomplet', {}],
  ] as const) {
    it(`ne soumet rien si la lecture opérateur renvoie ${label}`, async () => {
      const h = setup({ scenario: 'unavailable' });
      const q = h.store.offer(owner, quote());
      const original = (await h.service.create(owner, randomUUID(), q.id)).withdrawal;
      let submissions = 0;
      const malformed: unknown = value;
      const service = createBridgeService({
        store: h.store,
        provider: {
          async lookup() {
            return malformed as Awaited<ReturnType<BridgeProvider['lookup']>>;
          },
          async submit(withdrawal) {
            submissions++;
            return h.provider.submit(withdrawal);
          },
        },
      });
      assert.equal((await service.retry(owner, original.id))?.status, 'incertain');
      assert.equal(submissions, 0);
      assert.equal(h.store.balance(owner).heldSats, q.totalSats);
    });
  }

  for (const scenario of ['success', 'declined'] as const) {
    it(`garde le résultat terminal ${scenario} sans appel opérateur`, async () => {
      const h = setup({ scenario });
      const q = h.store.offer(owner, quote());
      const original = (await h.service.create(owner, randomUUID(), q.id)).withdrawal;
      let calls = 0;
      const service = createBridgeService({
        store: h.store,
        provider: {
          async lookup(id) {
            calls++;
            return h.provider.lookup(id);
          },
          async submit(withdrawal) {
            calls++;
            return h.provider.submit(withdrawal);
          },
        },
      });
      assert.deepEqual(await service.retry(owner, original.id), original);
      assert.equal(calls, 0);
    });
  }

  it('ne rétrograde pas un succès quand une ancienne reprise échoue ensuite', async () => {
    const h = setup({ scenario: 'unavailable' });
    const q = h.store.offer(owner, quote());
    const original = (await h.service.create(owner, randomUUID(), q.id)).withdrawal;
    const gate = deferred<void>();
    const slow = createBridgeService({
      store: h.store,
      provider: {
        ...h.provider,
        async lookup() {
          await gate.promise;
          throw new Error('ancienne lecture fictive');
        },
      },
    });
    const pending = slow.retry(owner, original.id);
    const recovered = createBridgeService({
      store: h.store,
      provider: createSimulatedProvider(h.store),
    });
    assert.equal((await recovered.retry(owner, original.id))?.status, 'reussi');
    gate.resolve();
    assert.equal((await pending)?.status, 'reussi');
    assert.equal(h.store.balance(owner).heldSats, 0);
  });

  it('retrouve une référence propriétaire déjà engagée avant de contrôler l’expiration', async () => {
    const h = setup();
    const q = h.store.offer(owner, quote());
    const key = randomUUID();
    const original = (await h.service.create(owner, key, q.id)).withdrawal;
    h.advance(300_000);
    await assert.rejects(
      h.service.create(owner, randomUUID(), q.id),
      (error: BridgeError) =>
        error.code === 'QUOTE_ALREADY_USED' && error.withdrawalId === original.id,
    );
    const otherQuote = quote({
      createdAt: new Date(initialTime + 300_000).toISOString(),
      expiresAt: new Date(initialTime + 600_000).toISOString(),
    });
    h.store.offer(owner, otherQuote);
    await assert.rejects(
      h.service.create(owner, key, otherQuote.id),
      (error: BridgeError) =>
        error.code === 'IDEMPOTENCY_CONFLICT' && error.withdrawalId === original.id,
    );
    await assert.rejects(
      h.service.create(other, randomUUID(), q.id),
      (error: BridgeError) => error.code === 'QUOTE_NOT_FOUND' && error.withdrawalId === undefined,
    );
  });

  it('ne reprend ni une référence inconnue ni celle d’un autre propriétaire', async () => {
    const h = setup({ scenario: 'unavailable' });
    const q = h.store.offer(owner, quote());
    const original = (await h.service.create(owner, randomUUID(), q.id)).withdrawal;
    assert.equal(await h.service.retry(other, original.id), null);
    assert.equal(await h.service.retry(owner, randomUUID()), null);
    assert.equal(h.store.balance(owner).heldSats, q.totalSats);
    assert.equal(h.store.lookupProvider(original.id), null);
  });
});

describe('passerelle T23 | comptabilité exclusivement fictive', () => {
  for (const path of ['file::memory:?cache=shared', 'FiLe:demo?mode=memory']) {
    it(`refuse l’URI SQLite ${path} pour ne pas perdre la persistance`, () => {
      assert.throws(() => createBridgeStore({ path }), { code: 'INVALID_INPUT' });
    });
  }

  it('confirme Wave avec un devis et une réservation uniques', async () => {
    const { store, service } = setup();
    const offered = store.offer(owner, quote());
    const result = await service.create(owner, randomUUID(), offered.id);
    assert.equal(result.replayed, false);
    assert.equal(result.withdrawal.status, 'reussi');
    assert.equal(result.withdrawal.simulation, true);
    assert.equal(result.withdrawal.amountXof, 2500);
    assert.equal(result.withdrawal.feeXof, 100);
    assert.equal(result.withdrawal.totalSats, 5778);
    assert.equal(result.withdrawal.failure, null);
    assert.deepEqual(store.balance(owner), {
      simulation: true,
      availableSats: initialBalance - 5778,
      heldSats: 0,
    });
  });
  it('simule Orange Money avec sa destination dédiée', async () => {
    const { store, service } = setup();
    const offered = store.offer(
      owner,
      quote({ operator: 'orange_money', recipientId: 'orange-demo-001' }),
    );
    const result = await service.create(owner, randomUUID(), offered.id);
    assert.equal(result.withdrawal.operator, 'orange_money');
    assert.equal(result.withdrawal.status, 'reussi');
    assert.equal(store.lookupProvider(result.withdrawal.id)?.recipientId, 'orange-demo-001');
  });
  it('libère les fonds fictifs une seule fois en cas de refus certain', async () => {
    const { store, service } = setup({ scenario: 'declined' });
    const q = store.offer(owner, quote()),
      key = randomUUID();
    const first = await service.create(owner, key, q.id);
    assert.equal(first.withdrawal.status, 'echoue');
    assert.equal(first.withdrawal.failure, 'PROVIDER_DECLINED');
    await service.create(owner, key, q.id);
    await service.reconcile(owner, first.withdrawal.id);
    assert.deepEqual(store.balance(owner), {
      simulation: true,
      availableSats: initialBalance,
      heldSats: 0,
    });
  });
  it('conserve la réservation si le simulateur est indisponible', async () => {
    const { store, service } = setup({ scenario: 'unavailable' });
    const q = store.offer(owner, quote());
    const first = await service.create(owner, randomUUID(), q.id);
    assert.equal(first.withdrawal.status, 'incertain');
    await service.reconcile(owner, first.withdrawal.id);
    assert.deepEqual(store.balance(owner), {
      simulation: true,
      availableSats: initialBalance - q.totalSats,
      heldSats: q.totalSats,
    });
    assert.equal(store.lookupProvider(first.withdrawal.id), null);
  });
  it('réconcilie une réponse perdue après un effet sans crédit supplémentaire', async () => {
    const path = file(),
      { store, service } = setup({ path, scenario: 'timeout_after_success' });
    const q = store.offer(owner, quote()),
      key = randomUUID();
    const first = await service.create(owner, key, q.id);
    assert.equal(first.withdrawal.status, 'incertain');
    assert.equal(store.balance(owner).heldSats, q.totalSats);
    const reconciled = await service.reconcile(owner, first.withdrawal.id);
    assert.equal(reconciled?.status, 'reussi');
    await service.reconcile(owner, first.withdrawal.id);
    await service.create(owner, key, q.id);
    const db = new DatabaseSync(path);
    try {
      assert.deepEqual(
        {
          ...db
            .prepare(
              'SELECT count(*) AS count, sum(credit_xof) AS credit FROM bridge_provider_results',
            )
            .get(),
        },
        { count: 1, credit: 2500 },
      );
    } finally {
      db.close();
    }
    assert.deepEqual(store.balance(owner), {
      simulation: true,
      availableSats: initialBalance - q.totalSats,
      heldSats: 0,
    });
  });
  it('rejoue avant expiration sans nouvelle soumission au simulateur', async () => {
    const { store, provider } = setup();
    let calls = 0;
    const service = createBridgeService({
      store,
      provider: {
        ...provider,
        async submit(w) {
          calls++;
          return provider.submit(w);
        },
      },
    });
    const q = store.offer(owner, quote()),
      key = randomUUID();
    const first = await service.create(owner, key, q.id),
      replay = await service.create(owner, key, q.id);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.withdrawal, first.withdrawal);
    assert.equal(calls, 1);
  });
  it('rejoue un résultat connu après expiration du devis', async () => {
    const { store, service, advance } = setup();
    const q = store.offer(owner, quote()),
      key = randomUUID();
    const first = await service.create(owner, key, q.id);
    advance(600_000);
    assert.deepEqual((await service.create(owner, key, q.id)).withdrawal, first.withdrawal);
  });
  it('rejoue après redémarrage sans recharger le compte fictif', async () => {
    const path = file(),
      a = setup({ path }),
      q = a.store.offer(owner, quote()),
      key = randomUUID();
    const first = await a.service.create(owner, key, q.id);
    a.store.close();
    const b = setup({ path });
    b.advance(600_000);
    const replay = await b.service.create(owner, key, q.id);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.withdrawal, first.withdrawal);
    assert.equal(b.store.balance(owner).availableSats, initialBalance - q.totalSats);
  });
  it('retrouve le journal opérateur après une réponse perdue et un redémarrage', async () => {
    const path = file(),
      a = setup({ path, scenario: 'timeout_after_success' });
    const q = a.store.offer(owner, quote());
    const first = await a.service.create(owner, randomUUID(), q.id);
    a.store.close();
    const b = setup({ path });
    b.advance(600_000);
    assert.equal((await b.service.reconcile(owner, first.withdrawal.id))?.status, 'reussi');
    assert.equal(b.store.balance(owner).heldSats, 0);
  });
  it('conserve une réservation interrompue avant soumission après redémarrage', async () => {
    const path = file();
    const a = setup({ path });
    const q = a.store.offer(owner, quote());
    const key = randomUUID();
    const reserved = a.store.reserve(owner, key, q.id);
    a.store.close();
    const b = setup({ path });
    let submissions = 0;
    const service = createBridgeService({
      store: b.store,
      provider: {
        ...b.provider,
        async submit(withdrawal) {
          submissions++;
          return b.provider.submit(withdrawal);
        },
      },
    });
    const replay = await service.create(owner, key, q.id);
    assert.equal(replay.replayed, true);
    assert.equal(replay.withdrawal.id, reserved.withdrawal.id);
    assert.equal((await service.reconcile(owner, replay.withdrawal.id))?.status, 'incertain');
    assert.equal(submissions, 0);
    assert.equal(b.store.lookupProvider(replay.withdrawal.id), null);
    assert.deepEqual(b.store.balance(owner), {
      simulation: true,
      availableSats: initialBalance - q.totalSats,
      heldSats: q.totalSats,
    });
  });
  it('refuse une autre clé pour le même devis déjà utilisé', async () => {
    const { store, service } = setup();
    const q = store.offer(owner, quote());
    await service.create(owner, randomUUID(), q.id);
    await assert.rejects(service.create(owner, randomUUID(), q.id), { code: 'QUOTE_ALREADY_USED' });
    assert.equal(store.balance(owner).availableSats, initialBalance - q.totalSats);
  });
  it('refuse une même clé pour un autre devis', async () => {
    const { store, service } = setup();
    const q1 = store.offer(owner, quote()),
      q2 = store.offer(owner, quote()),
      key = randomUUID();
    await service.create(owner, key, q1.id);
    await assert.rejects(service.create(owner, key, q2.id), { code: 'IDEMPOTENCY_CONFLICT' });
    assert.equal(store.balance(owner).availableSats, initialBalance - q1.totalSats);
  });
  it('réserve avant await et empêche une deuxième soumission concurrente', async () => {
    const { store, provider } = setup(),
      gate = deferred<void>();
    let calls = 0;
    const service = createBridgeService({
      store,
      provider: {
        ...provider,
        async submit(w) {
          calls++;
          await gate.promise;
          return provider.submit(w);
        },
      },
    });
    const q = store.offer(owner, quote()),
      key = randomUUID(),
      first = service.create(owner, key, q.id);
    const second = await service.create(owner, key, q.id);
    assert.equal(second.replayed, true);
    assert.equal(second.withdrawal.status, 'en_attente');
    assert.equal(store.balance(owner).heldSats, q.totalSats);
    assert.equal(calls, 1);
    gate.resolve();
    assert.equal((await first).withdrawal.status, 'reussi');
  });
  it('partage la barrière entre deux services et deux connexions SQLite', async () => {
    const path = file(),
      a = setup({ path }),
      b = setup({ path }),
      gate = deferred<void>();
    let calls = 0;
    const firstService = createBridgeService({
      store: a.store,
      provider: {
        ...a.provider,
        async submit(w) {
          calls++;
          await gate.promise;
          return a.provider.submit(w);
        },
      },
    });
    const secondService = createBridgeService({
      store: b.store,
      provider: {
        ...b.provider,
        async submit(w) {
          calls++;
          return b.provider.submit(w);
        },
      },
    });
    const q = a.store.offer(owner, quote()),
      key = randomUUID(),
      first = firstService.create(owner, key, q.id);
    const replay = await secondService.create(owner, key, q.id);
    assert.equal(replay.replayed, true);
    assert.equal(calls, 1);
    gate.resolve();
    await first;
    assert.equal(b.store.balance(owner).availableSats, initialBalance - q.totalSats);
  });
  it('ne dépense pas deux fois le même solde lors de deux demandes distinctes', async () => {
    const { store, provider } = setup(),
      limited = 'demo-limited',
      gate = deferred<void>();
    store.seedAccount(limited, 6000);
    const q1 = store.offer(limited, quote()),
      q2 = store.offer(limited, quote());
    const service = createBridgeService({
      store,
      provider: {
        ...provider,
        async submit(w) {
          await gate.promise;
          return provider.submit(w);
        },
      },
    });
    const first = service.create(limited, randomUUID(), q1.id);
    await assert.rejects(service.create(limited, randomUUID(), q2.id), {
      code: 'INSUFFICIENT_FUNDS',
    });
    gate.resolve();
    await first;
    assert.deepEqual(store.balance(limited), { simulation: true, availableSats: 222, heldSats: 0 });
  });
  it('refuse un devis à la borne exacte de son expiration', async () => {
    const { store, service, advance } = setup(),
      q = store.offer(owner, quote());
    advance(300_000);
    await assert.rejects(service.create(owner, randomUUID(), q.id), { code: 'QUOTE_EXPIRED' });
    assert.equal(store.balance(owner).availableSats, initialBalance);
  });
  it('isole devis, retraits et clés entre propriétaires authentifiés', async () => {
    const { store, service } = setup(),
      q = store.offer(owner, quote()),
      key = randomUUID();
    assert.equal(store.getQuote(other, q.id), null);
    await assert.rejects(service.create(other, key, q.id), { code: 'QUOTE_NOT_FOUND' });
    const first = await service.create(owner, key, q.id);
    assert.equal(service.get(other, first.withdrawal.id), null);
    assert.equal(await service.reconcile(other, first.withdrawal.id), null);
    const q2 = store.offer(other, quote());
    assert.equal((await service.create(other, key, q2.id)).replayed, false);
  });
  it('normalise la casse UUID sans ouvrir une deuxième réservation', async () => {
    const { store, service } = setup(),
      q = store.offer(owner, quote()),
      key = randomUUID();
    const first = await service.create(owner, key, q.id);
    const replay = await service.create(owner, key.toUpperCase(), q.id.toUpperCase());
    assert.equal(replay.replayed, true);
    assert.equal(replay.withdrawal.id, first.withdrawal.id);
  });
  it('ne réécrit pas un succès quand une réconciliation ancienne échoue ensuite', async () => {
    const { store, provider } = setup({ scenario: 'unavailable' }),
      gate = deferred<Awaited<ReturnType<BridgeProvider['lookup']>>>();
    const service = createBridgeService({
      store,
      provider: {
        ...provider,
        async lookup() {
          return gate.promise;
        },
      },
    });
    const q = store.offer(owner, quote()),
      first = await service.create(owner, randomUUID(), q.id);
    const reading = service.reconcile(owner, first.withdrawal.id);
    const paid = store.recordProvider(first.withdrawal, 'reussi');
    store.settle(first.withdrawal.id, 'reussi');
    gate.resolve({ ...paid, status: 'echoue', failure: 'PROVIDER_DECLINED' });
    assert.equal((await reading)?.status, 'reussi');
    assert.equal(store.balance(owner).availableSats, initialBalance - q.totalSats);
  });
  it('ne réécrit pas un refus terminal avec un succès ultérieur contradictoire', async () => {
    const { store, service } = setup({ scenario: 'declined' }),
      q = store.offer(owner, quote());
    const first = await service.create(owner, randomUUID(), q.id);
    assert.equal(store.settle(first.withdrawal.id, 'reussi').status, 'echoue');
    assert.equal(store.balance(owner).availableSats, initialBalance);
  });
  it('refuse un résultat de simulateur pour une autre opération', async () => {
    const { store, provider } = setup();
    const service = createBridgeService({
      store,
      provider: {
        ...provider,
        async submit(w) {
          return { ...(await provider.submit(w)), operationId: randomUUID() };
        },
      },
    });
    const q = store.offer(owner, quote()),
      first = await service.create(owner, randomUUID(), q.id);
    assert.equal(first.withdrawal.status, 'incertain');
    assert.equal(first.withdrawal.failure, 'PROVIDER_MISMATCH');
    assert.equal(store.balance(owner).heldSats, q.totalSats);
    assert.equal((await service.reconcile(owner, first.withdrawal.id))?.status, 'reussi');
  });
  it('ne remplace pas les données figées d’un devis déjà enregistré', () => {
    const { store } = setup(),
      q = quote();
    store.offer(owner, q);
    assert.throws(() => store.offer(owner, { ...q, source: 'kraken' }), { code: 'QUOTE_CONFLICT' });
    assert.equal(store.getQuote(owner, q.id)?.source, 'fixe');
  });
  for (const [name, changes] of [
    ['opérateur', { operator: 'real' }],
    ['destination réelle', { recipientId: 'external-account' }],
    ['destination croisée', { recipientId: 'orange-demo-001' }],
    ['montant nul', { amountXof: 0 }],
    ['plafond', { amountXof: 5_000_001 }],
    ['frais inconnus', { feeXof: 150 }],
    ['total incohérent', { totalXof: 2601 }],
    ['conversion incohérente', { amountSats: 5555 }],
    ['frais sats incohérents', { feeSats: 223 }],
    ['taux nul', { xofPerBtc: 0 }],
    ['source inconnue', { source: 'other' }],
    ['date impossible', { createdAt: '2026-02-30T12:00:00.000Z' }],
    ['validité excessive', { expiresAt: new Date(initialTime + 300_001).toISOString() }],
    ['champ supplémentaire', { phone: 'non-numeric-demo' }],
  ] as const)
    it(`refuse ${name} sans réservation ni effet opérateur`, () => {
      const { store } = setup();
      assert.throws(() => store.offer(owner, { ...quote(), ...changes } as BridgeQuoteInput), {
        code: 'INVALID_INPUT',
      });
      assert.equal(store.balance(owner).availableSats, initialBalance);
    });
  it('refuse un propriétaire ou une clé non fictifs sans écrire', async () => {
    const { store, service } = setup(),
      q = store.offer(owner, quote());
    assert.throws(() => store.seedAccount('someone', initialBalance), { code: 'INVALID_INPUT' });
    await assert.rejects(service.create(owner, 'not-a-uuid', q.id), { code: 'INVALID_INPUT' });
    assert.equal(store.balance(owner).availableSats, initialBalance);
  });
});
