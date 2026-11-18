import AsyncStorage from '@react-native-async-storage/async-storage';

import { createWithdrawJournal, type WithdrawJournalStorage } from '../src/withdraw/journal';
import type { WithdrawIntent, WithdrawQuote } from '../src/withdraw/ports';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

const keyA = '10000000-0000-4000-8000-000000000001';
const keyB = '10000000-0000-4000-8000-000000000002';
const operationA = '30000000-0000-4000-8000-000000000001';
const operationB = '30000000-0000-4000-8000-000000000002';
const quote: WithdrawQuote = {
  id: '20000000-0000-4000-8000-000000000001',
  simulation: true,
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
  createdAt: '2026-01-01T12:00:00.000Z',
  expiresAt: '2026-01-01T12:05:00.000Z',
};
const intent = (key = keyA): WithdrawIntent => ({ version: 1, key, quote: { ...quote } });
function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: jest.fn(async (key: string): Promise<string | null> => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string): Promise<void> => {
      values.set(key, value);
    }),
    removeItem: jest.fn(async (key: string): Promise<void> => {
      values.delete(key);
    }),
  };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const failed = (code: string) => ({ ok: false, error: { code } });

describe('T25 | journal durable de la même intention de retrait', () => {
  it('une absence reste vide, sans créer de demande ou de fichier implicite', async () => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-compte-a', storage);
    await expect(journal.load()).resolves.toEqual({ ok: true, value: null });
    expect(storage.getItem).toHaveBeenCalledWith('@teranga-pay/withdraw/v1/demo-compte-a');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('ne confirme la sauvegarde qu’après acquittement du stockage et bloque la lecture concurrente', async () => {
    const storage = memoryStorage();
    const entered = deferred();
    const release = deferred();
    storage.setItem.mockImplementationOnce(async (key, raw) => {
      entered.resolve();
      await release.promise;
      storage.values.set(key, raw);
    });
    const first = createWithdrawJournal('demo-acquittement', storage);
    const second = createWithdrawJournal('demo-acquittement', storage);
    let acknowledged = false;
    const saving = first.save(intent()).then((result) => {
      acknowledged = true;
      return result;
    });
    const loading = second.load();
    await entered.promise;
    expect(acknowledged).toBe(false);
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(storage.values.size).toBe(0);
    release.resolve();
    await expect(saving).resolves.toEqual({ ok: true, value: undefined });
    await expect(loading).resolves.toEqual({ ok: true, value: intent() });
    expect(storage.getItem).toHaveBeenCalledTimes(2);
  });

  it('deux instances concurrentes ne peuvent pas remplacer l’intention gagnante', async () => {
    const storage = memoryStorage();
    const a = createWithdrawJournal('demo-course', storage);
    const b = createWithdrawJournal('demo-course', storage);
    const results = await Promise.all([a.save(intent()), b.save(intent(keyB))]);
    expect(results).toEqual([{ ok: true, value: undefined }, failed('JOURNAL_CONFLICT')]);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    await expect(b.load()).resolves.toEqual({ ok: true, value: intent() });
  });

  it('conserve l’intention et sa référence enrichie entre nouvelles instances', async () => {
    const storage = memoryStorage();
    await createWithdrawJournal('demo-redemarrage', storage).save(intent());
    await createWithdrawJournal('demo-redemarrage', storage).save({
      ...intent(),
      withdrawalId: operationA,
    });
    await expect(createWithdrawJournal('demo-redemarrage', storage).load()).resolves.toEqual({
      ok: true,
      value: { ...intent(), withdrawalId: operationA },
    });
  });

  it('accepte un devis ancien expiré parce que son couple doit rester rejouable', async () => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-expire', storage);
    await expect(journal.save(intent())).resolves.toEqual({ ok: true, value: undefined });
    await expect(createWithdrawJournal('demo-expire', storage).load()).resolves.toEqual({
      ok: true,
      value: intent(),
    });
  });

  it('isole deux comptes et ne bloque pas leur stockage derrière la file d’un autre compte', async () => {
    const storage = memoryStorage();
    const entered = deferred();
    const release = deferred();
    storage.setItem.mockImplementationOnce(async (key, raw) => {
      entered.resolve();
      await release.promise;
      storage.values.set(key, raw);
    });
    const first = createWithdrawJournal('demo-separe-a', storage);
    const second = createWithdrawJournal('demo-separe-b', storage);
    const saving = first.save(intent());
    await entered.promise;
    await expect(second.load()).resolves.toEqual({ ok: true, value: null });
    await expect(second.save(intent(keyB))).resolves.toEqual({ ok: true, value: undefined });
    release.resolve();
    await saving;
    await first.clear(keyA);
    await expect(second.load()).resolves.toEqual({ ok: true, value: intent(keyB) });
  });

  it('copie les entrées avant la file et rend une copie validée immuable', async () => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-copie', storage);
    const mutable = { version: 1 as const, key: keyA, quote: { ...quote } };
    const saved = journal.save(mutable);
    mutable.key = keyB;
    mutable.quote.amountXof = 9000;
    await saved;
    const loaded = await journal.load();
    expect(loaded).toEqual({ ok: true, value: intent() });
    if (loaded.ok && loaded.value) {
      expect(Object.isFrozen(loaded.value)).toBe(true);
      expect(Object.isFrozen(loaded.value.quote)).toBe(true);
    }
  });

  it('normalise la casse des UUID sans produire une deuxième intention', async () => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-uuid', storage);
    const mixed: WithdrawIntent = {
      ...intent(),
      key: 'abcdef00-0000-4000-a000-000000000001'.toUpperCase(),
      quote: { ...quote, id: 'abcdef00-0000-4000-a000-000000000002'.toUpperCase() },
      withdrawalId: 'abcdef00-0000-4000-a000-000000000003'.toUpperCase(),
    };
    await journal.save(mixed);
    await expect(journal.load()).resolves.toEqual({
      ok: true,
      value: {
        ...mixed,
        key: mixed.key.toLowerCase(),
        quote: { ...mixed.quote, id: mixed.quote.id.toLowerCase() },
        withdrawalId: mixed.withdrawalId!.toLowerCase(),
      },
    });
    await expect(journal.clear(mixed.key)).resolves.toEqual({ ok: true, value: undefined });
  });

  it('refuse un autre prix sous la même clé, même si son calcul reste valide', async () => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-prix', storage);
    await journal.save(intent());
    const changed = {
      ...intent(),
      quote: { ...quote, amountXof: 1000, totalXof: 1100, amountSats: 2223, totalSats: 2445 },
    };
    await expect(journal.save(changed)).resolves.toEqual(failed('JOURNAL_CONFLICT'));
    await expect(journal.load()).resolves.toEqual({ ok: true, value: intent() });
  });

  it('une sauvegarde ancienne sans référence ne retire pas la référence déjà connue', async () => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-enrichi', storage);
    await journal.save({ ...intent(), withdrawalId: operationA });
    await journal.save(intent());
    await expect(journal.load()).resolves.toEqual({
      ok: true,
      value: { ...intent(), withdrawalId: operationA },
    });
  });

  it('refuse de remplacer une référence de retrait déjà connue', async () => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-reference', storage);
    await journal.save({ ...intent(), withdrawalId: operationA });
    await expect(journal.save({ ...intent(), withdrawalId: operationB })).resolves.toEqual(
      failed('JOURNAL_CONFLICT'),
    );
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('un ancien effacement ne retire pas une intention suivante', async () => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-effacement', storage);
    await journal.save(intent());
    await expect(journal.clear(keyA)).resolves.toEqual({ ok: true, value: undefined });
    await journal.save(intent(keyB));
    await expect(journal.clear(keyA)).resolves.toEqual(failed('JOURNAL_CONFLICT'));
    await expect(journal.load()).resolves.toEqual({ ok: true, value: intent(keyB) });
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
  });

  it('un effacement d’un journal absent est sans effet et ne crée aucune donnée', async () => {
    const storage = memoryStorage();
    await expect(createWithdrawJournal('demo-vide', storage).clear(keyA)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it.each(['', 'demo/compte', 'demo.compte', 'a'.repeat(65), 'compte@example.invalid', 'clé'])(
    'refuse un scope invalide sans lire ni écrire : %s',
    async (scope) => {
      const storage = memoryStorage();
      const journal = createWithdrawJournal(scope, storage);
      await expect(journal.load()).resolves.toEqual(failed('JOURNAL_SCOPE_INVALID'));
      await expect(journal.save(intent())).resolves.toEqual(failed('JOURNAL_SCOPE_INVALID'));
      await expect(journal.clear(keyA)).resolves.toEqual(failed('JOURNAL_SCOPE_INVALID'));
      expect(storage.getItem).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.removeItem).not.toHaveBeenCalled();
    },
  );

  it.each([
    '',
    '{',
    'null',
    '[]',
    'false',
    '7',
    '{}',
    JSON.stringify({ ...intent(), token: 'exemple-fictif' }),
    JSON.stringify({ ...intent(), version: 2 }),
    'x'.repeat(4097),
  ])('refuse un contenu corrompu sans l’effacer ni le remplacer : %s', async (raw) => {
    const storage = memoryStorage();
    storage.values.set('@teranga-pay/withdraw/v1/demo-corrompu', raw);
    const journal = createWithdrawJournal('demo-corrompu', storage);
    await expect(journal.load()).resolves.toEqual(failed('JOURNAL_INVALID'));
    await expect(journal.save(intent())).resolves.toEqual(failed('JOURNAL_INVALID'));
    await expect(journal.clear(keyA)).resolves.toEqual(failed('JOURNAL_INVALID'));
    expect(storage.values.values().next().value).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  const invalidQuotes: [string, Record<string, unknown>][] = [
    ['simulation absente', { simulation: false }],
    ['opérateur inconnu', { operator: 'autre' }],
    ['destination croisée', { recipientId: 'orange-demo-001' }],
    ['montant nul', { amountXof: 0 }],
    ['montant fractionnaire', { amountXof: 2500.5 }],
    ['plafond dépassé', { amountXof: 5_000_001 }],
    ['frais commerciaux inventés', { feeXof: 150 }],
    ['total FCFA faux', { totalXof: 2599 }],
    ['conversion sous-estimée', { amountSats: 5555 }],
    ['frais sats faux', { feeSats: 223 }],
    ['total sats faux', { totalSats: 5779 }],
    ['taux nul', { xofPerBtc: 0 }],
    ['source inconnue', { source: 'autre' }],
    ['UUID nul', { id: '00000000-0000-0000-0000-000000000000' }],
    ['date impossible', { createdAt: '2026-02-30T12:00:00.000Z' }],
    ['date non canonique', { expiresAt: '2026-01-01T12:05:00Z' }],
    ['durée nulle', { expiresAt: quote.createdAt }],
    ['durée excessive', { expiresAt: '2026-01-01T12:05:00.001Z' }],
    ['date antérieure', { expiresAt: '2026-01-01T11:59:59.999Z' }],
    ['champ supplémentaire', { note: 'exemple-fictif' }],
  ];
  it.each(invalidQuotes)('ne sauvegarde aucun devis invalide : %s', async (_name, change) => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-devis-invalide', storage);
    await expect(
      journal.save({ ...intent(), quote: { ...quote, ...change } } as WithdrawIntent),
    ).resolves.toEqual(failed('JOURNAL_INVALID'));
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    { ...intent(), key: 'cle-invalide' },
    { ...intent(), withdrawalId: 'reference-invalide' },
    { ...intent(), withdrawalId: undefined },
    { ...intent(), version: '1' },
    { ...intent(), extra: 'exemple-fictif' },
    { version: 1, key: keyA },
  ])('refuse les intentions ou références malformées sans toucher au stockage', async (raw) => {
    const storage = memoryStorage();
    await expect(
      createWithdrawJournal('demo-invalide', storage).save(raw as WithdrawIntent),
    ).resolves.toEqual(failed('JOURNAL_INVALID'));
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('refuse les accesseurs et champs cachés plutôt que de persister une copie incomplète', async () => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-descripteurs', storage);
    const hidden = { ...intent() };
    Object.defineProperty(hidden, 'quote', { enumerable: false, value: quote });
    const getter = jest.fn(() => quote);
    const accessor = { ...intent() };
    Object.defineProperty(accessor, 'quote', { enumerable: true, get: getter });
    const symbol = { ...intent(), [Symbol('exemple')]: true };
    for (const invalid of [hidden, accessor, symbol])
      await expect(journal.save(invalid)).resolves.toEqual(failed('JOURNAL_INVALID'));
    expect(getter).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('ne laisse pas une erreur de lecture bloquer les opérations suivantes de la file', async () => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-panne-lecture', storage);
    storage.getItem.mockRejectedValueOnce(new Error('détail privé fictif'));
    await expect(journal.save(intent())).resolves.toEqual(failed('JOURNAL_READ_FAILED'));
    await expect(journal.save(intent())).resolves.toEqual({ ok: true, value: undefined });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('une écriture refusée ne donne pas un acquittement de persistance', async () => {
    const storage = memoryStorage();
    storage.setItem.mockRejectedValueOnce(new Error('détail privé fictif'));
    const journal = createWithdrawJournal('demo-panne-ecriture', storage);
    await expect(journal.save(intent())).resolves.toEqual(failed('JOURNAL_WRITE_FAILED'));
    await expect(journal.load()).resolves.toEqual({ ok: true, value: null });
  });

  it('une suppression refusée conserve la demande et ne donne pas un faux succès', async () => {
    const storage = memoryStorage();
    const journal = createWithdrawJournal('demo-panne-suppression', storage);
    await journal.save(intent());
    storage.removeItem.mockRejectedValueOnce(new Error('détail privé fictif'));
    await expect(journal.clear(keyA)).resolves.toEqual(failed('JOURNAL_CLEAR_FAILED'));
    await expect(journal.load()).resolves.toEqual({ ok: true, value: intent() });
  });

  it('un ancien callback avec une clé invalide ne lit ni ne supprime quoi que ce soit', async () => {
    const storage = memoryStorage();
    await expect(
      createWithdrawJournal('demo-cle-invalide', storage).clear('invalide'),
    ).resolves.toEqual(failed('JOURNAL_INVALID'));
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('charge paresseusement le stockage par défaut et traduit son erreur en résultat sans détail', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('détail privé fictif'));
    const journal = createWithdrawJournal('demo-natif');
    await expect(journal.load()).resolves.toEqual(failed('JOURNAL_READ_FAILED'));
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('@teranga-pay/withdraw/v1/demo-natif');
  });

  it('sauvegarde et efface avec les trois méthodes du stockage par défaut', async () => {
    const values = new Map<string, string>();
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => values.get(key) ?? null);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, raw) => {
      values.set(key, raw);
    });
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
      values.delete(key);
    });
    const journal = createWithdrawJournal('demo-natif-complet');
    await expect(journal.save(intent())).resolves.toEqual({ ok: true, value: undefined });
    await expect(createWithdrawJournal('demo-natif-complet').load()).resolves.toEqual({
      ok: true,
      value: intent(),
    });
    await expect(journal.clear(keyA)).resolves.toEqual({ ok: true, value: undefined });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      '@teranga-pay/withdraw/v1/demo-natif-complet',
    );
    await expect(journal.load()).resolves.toEqual({ ok: true, value: null });
  });

  it('le stockage injecté n’appelle pas le stockage natif par défaut', async () => {
    const before = jest.mocked(AsyncStorage.getItem).mock.calls.length;
    const storage: WithdrawJournalStorage = memoryStorage();
    await createWithdrawJournal('demo-injection', storage).save(intent());
    expect(jest.mocked(AsyncStorage.getItem).mock.calls.length).toBe(before);
  });
});
