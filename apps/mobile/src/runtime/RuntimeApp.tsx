import { getRandomBytes, randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import App from '../../App';
import { nativeWallet } from '../../modules/teranga-wallet/src';
import { demoLightningAddressSettings, demoNodeSettings } from '../wallet/settings';
import { createAppRuntime } from './composition';
import { encodeRegistrationToken } from './random';

/** Entrée Android normale ; le runner Maestro conserve son entrée et ses fixtures explicites. */
export function RuntimeApp() {
  const [runtime, setRuntime] = useState<ReturnType<typeof createAppRuntime> | null>(null);
  useEffect(() => {
    const runtime = createAppRuntime({
      native:
        /^(02|03)[0-9a-f]{64}$/i.test(demoNodeSettings.peerId) &&
        demoNodeSettings.peerId.length === 66
          ? nativeWallet
          : null,
      settings: demoNodeSettings,
      apiUrl: demoLightningAddressSettings.apiUrl,
      domain: demoLightningAddressSettings.domain,
      createKey: randomUUID,
      createAddressToken: () => encodeRegistrationToken(getRandomBytes(32)),
    });
    setRuntime(runtime);
    const change = (value: string) => {
      void runtime.setActive(value === 'active').catch(() => undefined);
    };
    change(AppState.currentState ?? 'active');
    const listener = AppState.addEventListener('change', change);
    return () => {
      listener.remove();
      runtime.dispose();
    };
  }, []);
  return runtime ? <App {...runtime.props} /> : null;
}
