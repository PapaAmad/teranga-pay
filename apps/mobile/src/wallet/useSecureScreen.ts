import { useEffect } from 'react';
import type { NativeWallet } from '../../modules/teranga-wallet/src';

type ScreenGuard = Pick<NativeWallet, 'setScreenSecure'> | null;

/**
 * Bloque les captures d'écran tant que `active` est vrai (phrase secrète visible),
 * puis les rétablit en quittant l'écran. Sans module natif (tests, iOS), ne fait rien.
 * À réutiliser dans l'onboarding (T14) partout où la phrase secrète s'affiche.
 */
export function useSecureScreen(guard: ScreenGuard, active: boolean): void {
  useEffect(() => {
    if (!guard || !active) return undefined;
    void guard.setScreenSecure(true).catch(() => undefined);
    return () => {
      void guard.setScreenSecure(false).catch(() => undefined);
    };
  }, [guard, active]);
}
