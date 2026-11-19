import type { ConfigContext, ExpoConfig } from 'expo/config';
import nativeText from './src/translations/native.json';

/** Textes système au build issus des mêmes ressources françaises que T09. */
export default function configure({ config }: ConfigContext): ExpoConfig {
  const e2e = process.env.TERANGA_E2E_BUILD === '1';
  return {
    ...config,
    name: config.name ?? 'Teranga Pay',
    slug: config.slug ?? 'teranga-pay',
    ...(e2e
      ? { android: { ...config.android, package: 'pay.teranga.demo.e2e', allowBackup: false } }
      : {}),
    plugins: [
      ...(config.plugins ?? []),
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
    ],
  };
}
