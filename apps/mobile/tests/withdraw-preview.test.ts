import { createWithdrawController } from '../src/withdraw/controller';
import { createWithdrawPreviewServices } from '../src/withdraw/preview';

const time = Date.UTC(2026, 10, 11, 12);
async function quote(services: ReturnType<typeof createWithdrawPreviewServices>) {
  const result = await services.bridge!.quote({
    operator: 'wave',
    recipientId: 'wave-demo-001',
    amountXof: 2500,
  });
  if (!result.ok) throw Error('Prix fictif indisponible');
  return result.value;
}
const key = '90000000-0000-4000-8000-000000000001';
describe('atelier Retirer | fidélité des situations de démonstration', () => {
  it('conserve cinq minutes exactes même si l’horloge avance entre ses lectures', async () => {
    let movingTime = time;
    const services = createWithdrawPreviewServices('ready', { now: () => movingTime++ });
    const price = await quote(services);
    expect(Date.parse(price.expiresAt) - Date.parse(price.createdAt)).toBe(300_000);
  });
  it('ne réserve rien pendant la préparation et ne règle qu’une fois le même couple', async () => {
    const services = createWithdrawPreviewServices('ready', { now: () => time }),
      price = await quote(services);
    expect(services.inspect()).toEqual({ reservations: 0, effects: 0 });
    const request = { quoteId: price.id, key };
    const first = await services.bridge!.confirm(request);
    services.expireQuote();
    expect(await services.bridge!.confirm(request)).toEqual(first);
    expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
  });
  it('une réponse perdue garde un effet unique, retrouvé après expiration', async () => {
    const services = createWithdrawPreviewServices('lostResponse', { now: () => time }),
      price = await quote(services);
    await expect(services.bridge!.confirm({ quoteId: price.id, key })).rejects.toThrow();
    services.expireQuote();
    const replay = await services.bridge!.confirm({ quoteId: price.id, key });
    expect(replay.ok && replay.value.status).toBe('reussi');
    expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
  });
  it('le temps seul ne confirme pas une demande en attente', async () => {
    const services = createWithdrawPreviewServices('pending', { now: () => time }),
      price = await quote(services);
    const result = await services.bridge!.confirm({ quoteId: price.id, key });
    if (!result.ok) throw Error('Démo invalide');
    services.expireQuote();
    expect(await services.bridge!.reconcile(result.value.id)).toEqual(result);
    services.completePending();
    const known = await services.bridge!.reconcile(result.value.id);
    expect(known.ok && known.value.status).toBe('reussi');
    services.completePending();
    expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
  });
  it('la panne réserve une fois puis une reprise explicite règle la même référence', async () => {
    const services = createWithdrawPreviewServices('providerUnavailable', { now: () => time }),
      price = await quote(services);
    const result = await services.bridge!.confirm({ quoteId: price.id, key });
    if (!result.ok) throw Error('Démo invalide');
    expect(result.value.status).toBe('incertain');
    services.restoreProvider();
    expect(await services.bridge!.reconcile(result.value.id)).toEqual(result);
    const retried = await services.bridge!.retry(result.value.id);
    expect(retried.ok && retried.value).toMatchObject({ id: result.value.id, status: 'reussi' });
    await services.bridge!.retry(result.value.id);
    expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
  });
  it('un refus terminal libère le solde fictif une fois sans crédit de démonstration', async () => {
    const services = createWithdrawPreviewServices('declined', { now: () => time }),
      before = await services.bridge!.balance(),
      price = await quote(services);
    const result = await services.bridge!.confirm({ quoteId: price.id, key });
    if (!result.ok) throw Error('Démo invalide');
    expect(result.value.status).toBe('echoue');
    await services.bridge!.retry(result.value.id);
    expect(await services.bridge!.balance()).toEqual(before);
    expect(services.inspect().effects).toBe(0);
  });
  it('un journal indisponible empêche le modèle de soumettre la moindre demande', async () => {
    const services = createWithdrawPreviewServices('journalFailure', { now: () => time }),
      controller = createWithdrawController(services, { now: services.now });
    await controller.start();
    controller.selectOperator('wave');
    controller.setAmount('2500');
    await controller.prepare();
    await controller.confirm();
    expect(services.inspect()).toEqual({ reservations: 0, effects: 0 });
    controller.dispose();
  });
  it('refuse un premier retrait expiré et un devis déjà utilisé sous une autre clé', async () => {
    const services = createWithdrawPreviewServices('ready', { now: () => time }),
      expired = await quote(services);
    services.expireQuote();
    expect(await services.bridge!.confirm({ quoteId: expired.id, key })).toEqual({
      ok: false,
      error: { code: 'QUOTE_EXPIRED' },
    });
    const price = await quote(services);
    await services.bridge!.confirm({ quoteId: price.id, key });
    expect(
      await services.bridge!.confirm({
        quoteId: price.id,
        key: '90000000-0000-4000-8000-000000000002',
      }),
    ).toMatchObject({ ok: false, error: { code: 'QUOTE_ALREADY_USED' } });
    expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
  });
});
