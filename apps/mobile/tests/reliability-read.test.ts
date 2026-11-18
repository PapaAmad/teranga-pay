import { READ_TIMEOUT_MS, readFailure, readWithDeadline } from '../src/reliability/read';

describe('T28 | attente bornée d’une lecture', () => {
  afterEach(() => jest.useRealTimers());
  it('renvoie une lecture et enlève son minuteur', async () => {
    jest.useFakeTimers();
    expect(await readWithDeadline(async () => 42)).toBe(42);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('borne une lecture muette sans rejouer le fournisseur ni accepter son résultat tardif', async () => {
    jest.useFakeTimers();
    let resolve!: (value: number) => void;
    const work = jest.fn(
      () =>
        new Promise<number>((done) => {
          resolve = done;
        }),
    );
    const pending = readWithDeadline(work).catch(readFailure);
    await jest.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    expect(await pending).toBe('READ_TIMEOUT');
    resolve(42);
    await Promise.resolve();
    expect(await pending).toBe('READ_TIMEOUT');
    expect(work).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('nettoie le minuteur si le fournisseur lève synchroniquement', async () => {
    jest.useFakeTimers();
    expect(
      await readWithDeadline(() => {
        throw new Error('details-interdits');
      }).catch(readFailure),
    ).toBe('READ_FAILED');
    expect(jest.getTimerCount()).toBe(0);
  });
  it('nettoie le minuteur après rejet sans présenter une panne comme un hors ligne avéré', async () => {
    jest.useFakeTimers();
    expect(
      await readWithDeadline(async () => {
        throw new Error('NETWORK_OFFLINE');
      }).catch(readFailure),
    ).toBe('READ_FAILED');
    expect(jest.getTimerCount()).toBe(0);
  });
});
