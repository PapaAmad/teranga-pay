import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createBridgeService, createBridgeStore, createSimulatedProvider } from './index.ts';

const time = Date.UTC(2026, 10, 11, 12);
const owner = 'demo-client-a';
type WorkerResult = { id: string; replayed: boolean };

// Le worker exécute seulement l'appel concurrent, sans enregistrer de nouveaux tests.
if (!isMainThread) {
  const data = workerData as { path: string; quoteId: string; key: string };
  const store = createBridgeStore({ path: data.path, now: () => time });
  const service = createBridgeService({ store, provider: createSimulatedProvider(store) });
  parentPort!.once('message', async () => {
    try {
      const result = await service.create(owner, data.key, data.quoteId);
      parentPort!.postMessage({ id: result.withdrawal.id, replayed: result.replayed });
    } catch {
      parentPort!.postMessage({ error: true });
    } finally {
      store.close();
      parentPort!.close();
    }
  });
  parentPort!.postMessage('ready');
} else {
  test(
    'T23 | quatre workers SQLite concurrents gardent un seul retrait et un seul crédit fictif',
    { timeout: 15_000 },
    async () => {
      const directory = mkdtempSync(join(tmpdir(), 'teranga-bridge-workers-'));
      const path = join(directory, 'demo.sqlite');
      const workers: Worker[] = [];
      try {
        const store = createBridgeStore({ path, now: () => time });
        store.seedAccount(owner, 100_000);
        const quote = store.offer(owner, {
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
          createdAt: new Date(time).toISOString(),
          expiresAt: new Date(time + 300_000).toISOString(),
        });
        store.close();
        const key = randomUUID();
        const pending = Array.from({ length: 4 }, () => {
          const worker = new Worker(new URL(import.meta.url), {
            workerData: { path, quoteId: quote.id, key },
          });
          workers.push(worker);
          let ready!: () => void;
          let result!: (value: WorkerResult) => void;
          let failure!: (error: Error) => void;
          let exit!: () => void;
          const available = new Promise<void>((resolve) => {
            ready = resolve;
          });
          const completed = new Promise<WorkerResult>((resolve, reject) => {
            result = resolve;
            failure = reject;
          });
          const exited = new Promise<void>((resolve) => {
            exit = resolve;
          });
          worker.on('message', (value) => {
            if (value === 'ready') ready();
            else if (value.error) failure(new Error('Worker fictif en échec'));
            else result(value);
          });
          worker.on('error', (error) => {
            ready();
            failure(error);
          });
          worker.on('exit', (code) => {
            if (code !== 0) failure(new Error('Worker fictif interrompu'));
            exit();
          });
          return { available, completed, exited, worker };
        });
        await Promise.all(pending.map((item) => item.available));
        pending.forEach((item) => item.worker.postMessage('start'));
        const results = await Promise.all(pending.map((item) => item.completed));
        await Promise.all(pending.map((item) => item.exited));
        assert.equal(new Set(results.map((result) => result.id)).size, 1);
        assert.equal(results.filter((result) => !result.replayed).length, 1);
        const restored = createBridgeStore({ path, now: () => time });
        try {
          assert.equal(restored.find(owner, results[0]!.id)?.status, 'reussi');
          assert.deepEqual(restored.balance(owner), {
            simulation: true,
            availableSats: 94_222,
            heldSats: 0,
          });
        } finally {
          restored.close();
        }
        const database = new DatabaseSync(path, { readOnly: true });
        try {
          assert.equal(
            database.prepare('SELECT count(*) AS count FROM bridge_withdrawals').get()!.count,
            1,
          );
          assert.equal(
            database
              .prepare(
                'SELECT count(*) AS count, sum(credit_xof) AS credit FROM bridge_provider_results',
              )
              .get()!.count,
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
      } finally {
        await Promise.all(workers.map((worker) => worker.terminate()));
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
}
