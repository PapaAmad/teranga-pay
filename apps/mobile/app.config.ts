import type { ConfigContext, ExpoConfig } from 'expo/config';
import nativeText from './src/translations/native.json';

/** Textes système au build issus des mêmes ressources françaises que T09. */
export default function configure({ config }: ConfigContext): ExpoConfig {
  return {
    ...config,
    name: config.name ?? 'Teranga Pay',
    slug: config.slug ?? 'teranga-pay',
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
    ],
  };
}
