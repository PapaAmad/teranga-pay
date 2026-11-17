import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.ts';

/** Parcours HTTP local reproductible, sans imprimer le jeton ni la clé de rejeu. */
try {
  const config = loadConfig();
  if (!config.bridge) throw new Error('SIMULATION_DISABLED');
  const hostname = config.host === '::1' ? '[::1]' : config.host;
  const base = `http://${hostname}:${config.port}`;
  async function request(path: string, body?: object, key?: string) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${config.bridge!.token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('DEMO_HTTP_FAILED');
    const value = (await response.json()) as Record<string, unknown>;
    if (value.simulation !== true) throw new Error('SIMULATION_REQUIRED');
    return value;
  }
  for (const [operator, recipientId] of [
    ['wave', 'wave-demo-001'],
    ['orange_money', 'orange-demo-001'],
  ]) {
    const quote = await request('/v1/withdrawal-quotes', {
      operator,
      recipientId,
      amountXof: 2500,
    });
    const key = randomUUID();
    const first = await request('/v1/withdrawals', { quoteId: quote.id }, key);
    const replay = await request('/v1/withdrawals', { quoteId: quote.id }, key);
    if (typeof first.id !== 'string' || first.id !== replay.id) throw new Error('REPLAY_MISMATCH');
    const reconciled = await request(`/v1/withdrawals/${first.id}/reconcile`, {});
    console.info(
      JSON.stringify({
        simulation: true,
        operator,
        amountXof: quote.amountXof,
        feeXof: quote.feeXof,
        totalXof: quote.totalXof,
        status: reconciled.status,
        sameWithdrawalOnRetry: true,
      }),
    );
  }
} catch {
  console.error(
    'Démonstration locale impossible. Vérifier la configuration et le serveur de simulation.',
  );
  process.exitCode = 1;
}
