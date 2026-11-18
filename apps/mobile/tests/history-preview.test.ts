import { createHistoryPreviewServices } from '../src/history/preview';

const initialTime = Date.UTC(2026, 10, 11, 12);
describe('atelier T24 | données et actions explicitement fictives', () => {
  it('garde les deux sources vides sans inventer d’opération après confirmation', async () => {
    const services = createHistoryPreviewServices('empty', { now: () => initialTime });
    const event = jest.fn();
    services.wallet!.subscribe(event);
    services.confirmPending();
    expect(await services.wallet!.history()).toEqual({ ok: true, value: [] });
    expect(await services.withdrawals!.history()).toEqual({
      ok: true,
      value: { simulation: true, items: [], nextCursor: null },
    });
    expect(event).not.toHaveBeenCalled();
  });
  it('pagine avec le dernier identifiant de la page sans doublon et refuse un curseur inconnu', async () => {
    const services = createHistoryPreviewServices('partial', { now: () => initialTime });
    const ids: string[] = [];
    let before: string | undefined;
    for (const length of [20, 20, 5]) {
      const result = await services.wallet!.history({ limit: 20, ...(before ? { before } : {}) });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Fixture de pagination invalide');
      expect(result.value).toHaveLength(length);
      ids.push(...result.value.map((payment) => payment.id));
      before = result.value.at(-1)!.id;
    }
    expect(new Set(ids).size).toBe(45);
    expect(await services.wallet!.history({ before })).toEqual({ ok: true, value: [] });
    expect(await services.wallet!.history({ before: 'unknown-demo-id' })).toEqual({
      ok: false,
      error: { code: 'INVALID_PAGINATION' },
    });
  });
  it('attend une commande explicite plutôt que le temps pour confirmer le paiement fictif', async () => {
    let now = initialTime;
    const services = createHistoryPreviewServices('ready', { now: () => now });
    const event = jest.fn();
    services.wallet!.subscribe(event);
    now += 86_400_000;
    const before = await services.wallet!.history();
    if (!before.ok) throw new Error('Fixture illisible');
    const pending = before.value.find((payment) => payment.status === 'en_attente')!;
    expect(pending).toBeDefined();
    expect(event).not.toHaveBeenCalled();
    services.confirmPending();
    const after = await services.wallet!.history();
    if (!after.ok) throw new Error('Fixture illisible');
    expect(after.value.find((payment) => payment.id === pending.id)).toEqual({
      ...pending,
      status: 'reussi',
      failure: null,
    });
    expect(after.value).toHaveLength(before.value.length);
    expect(event).toHaveBeenCalledTimes(1);
    services.confirmPending();
    expect(event).toHaveBeenCalledTimes(1);
  });
  it('simule une seule panne de page puis permet de relire exactement le même curseur', async () => {
    const services = createHistoryPreviewServices('pagingError', { now: () => initialTime });
    const first = await services.wallet!.history({ limit: 20 });
    if (!first.ok) throw new Error('Fixture illisible');
    const before = first.value.at(-1)!.id;
    expect(await services.wallet!.history({ limit: 20, before })).toEqual({
      ok: false,
      error: { code: 'READ_FAILED' },
    });
    const retried = await services.wallet!.history({ limit: 20, before });
    if (!retried.ok) throw new Error('Reprise fictive impossible');
    expect(retried.value).toHaveLength(20);
    expect(retried.value.some((payment) => first.value.some((old) => old.id === payment.id))).toBe(
      false,
    );
  });
});
