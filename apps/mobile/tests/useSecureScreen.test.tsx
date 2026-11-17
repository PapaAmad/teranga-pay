import { renderHook } from '@testing-library/react-native';

import { useSecureScreen } from '../src/wallet/useSecureScreen';

function guard() {
  const calls: boolean[] = [];
  return {
    calls,
    setScreenSecure: jest.fn(async (secure: boolean) => {
      calls.push(secure);
      return true;
    }),
  };
}

describe('useSecureScreen', () => {
  it('bloque les captures pendant l’affichage puis les rétablit en quittant', () => {
    const native = guard();
    const { unmount } = renderHook(() => useSecureScreen(native, true));
    expect(native.calls).toEqual([true]);
    unmount();
    expect(native.calls).toEqual([true, false]);
  });

  it('rétablit les captures quand la phrase est masquée', () => {
    const native = guard();
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useSecureScreen(native, active),
      {
        initialProps: { active: true },
      },
    );
    rerender({ active: false });
    expect(native.calls).toEqual([true, false]);
  });

  it('ne fait rien tant que rien de sensible n’est affiché', () => {
    const native = guard();
    renderHook(() => useSecureScreen(native, false));
    expect(native.calls).toEqual([]);
  });

  it('ne plante pas sans module natif', () => {
    expect(() => renderHook(() => useSecureScreen(null, true))).not.toThrow();
  });

  it('ignore un refus du module natif', async () => {
    const native = {
      setScreenSecure: jest.fn(async () => Promise.reject(new Error('activité absente'))),
    };
    renderHook(() => useSecureScreen(native, true));
    await Promise.resolve();
    expect(native.setScreenSecure).toHaveBeenCalledWith(true);
  });
});
