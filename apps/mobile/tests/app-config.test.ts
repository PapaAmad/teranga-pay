import type { ConfigContext } from 'expo/config';

import configure from '../app.config';
import nativeText from '../src/translations/native.json';

const previousE2E = process.env.TERANGA_E2E_BUILD;
const context: ConfigContext = {
  projectRoot: '/projet-fictif',
  staticConfigPath: null,
  packageJsonPath: null,
  config: {
    name: 'Teranga Pay',
    slug: 'teranga-pay',
    android: { package: 'pay.teranga.demo', allowBackup: true, versionCode: 3 },
    plugins: ['expo-font'],
  },
};

afterEach(() => {
  if (previousE2E === undefined) delete process.env.TERANGA_E2E_BUILD;
  else process.env.TERANGA_E2E_BUILD = previousE2E;
});

describe('identité Android isolée T30', () => {
  it.each([undefined, '0', 'true'])(
    'conserve le paquet normal sans activation exacte du build e2e (%s)',
    (value) => {
      if (value === undefined) delete process.env.TERANGA_E2E_BUILD;
      else process.env.TERANGA_E2E_BUILD = value;
      expect(configure(context).android).toEqual(context.config.android);
    },
  );

  it('isole le build de test et désactive sa sauvegarde sans écraser les autres réglages', () => {
    process.env.TERANGA_E2E_BUILD = '1';
    const result = configure(context);
    expect(result.android).toEqual({
      package: 'pay.teranga.demo.e2e',
      allowBackup: false,
      versionCode: 3,
    });
    expect(context.config.android?.package).toBe('pay.teranga.demo');
    expect(context.config.android?.allowBackup).toBe(true);
  });

  it('garde les permissions caméra traduites et les plugins existants dans le build de test', () => {
    process.env.TERANGA_E2E_BUILD = '1';
    expect(configure(context).plugins).toEqual([
      'expo-font',
      [
        'expo-camera',
        {
          cameraPermission: nativeText.cameraPermission,
          microphonePermission: false,
          recordAudioAndroid: false,
          barcodeScannerEnabled: true,
        },
      ],
      './plugins/with-windows-native.cjs',
    ]);
  });
});
