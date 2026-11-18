import { Platform } from 'react-native';

import { receivePlatform } from '../receive/platform';

import { isCollectPaymentRequest } from './qr';

export type CollectPlatformErrorCode =
  'INVALID_PAYLOAD' | 'COPY_UNAVAILABLE' | 'COPY_FAILED' | 'SHARE_UNAVAILABLE' | 'SHARE_FAILED';

export class CollectPlatformError extends Error {
  constructor(readonly code: CollectPlatformErrorCode) {
    super(code);
    this.name = 'CollectPlatformError';
  }
}

export type CollectSharePayload = { title: string; message: string };
export interface CollectPlatformPort {
  copyPaymentRequest(text: string): Promise<boolean>;
  share(payload: CollectSharePayload): Promise<'opened' | 'dismissed'>;
}

type WebNavigator = { clipboard?: { writeText?: (text: string) => Promise<void> } };

export const collectPlatform: CollectPlatformPort = {
  async copyPaymentRequest(text) {
    if (!isCollectPaymentRequest(text)) throw new CollectPlatformError('INVALID_PAYLOAD');

    // Le chemin T18 borne les adresses à 254 octets ; une facture ne l'utilise pas.
    if (Platform.OS === 'web') {
      const web = typeof navigator === 'undefined' ? undefined : (navigator as WebNavigator);
      if (typeof web?.clipboard?.writeText !== 'function') {
        throw new CollectPlatformError('COPY_UNAVAILABLE');
      }
      try {
        await web.clipboard.writeText(text);
        return true;
      } catch {
        throw new CollectPlatformError('COPY_FAILED');
      }
    }

    let clipboard: typeof import('expo-clipboard');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      if (typeof clipboard.setStringAsync !== 'function') {
        throw new CollectPlatformError('COPY_UNAVAILABLE');
      }
    } catch {
      throw new CollectPlatformError('COPY_UNAVAILABLE');
    }
    try {
      return (await clipboard.setStringAsync(text)) === true;
    } catch {
      throw new CollectPlatformError('COPY_FAILED');
    }
  },

  // T18 valide déjà le message traduit et distingue ouverture, annulation et erreur.
  // L'ouverture de la feuille ne constitue jamais une preuve de paiement ou d'envoi.
  async share(payload) {
    try {
      return await receivePlatform.share(payload);
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? error.code : undefined;
      if (code === 'INVALID_PAYLOAD' || code === 'SHARE_UNAVAILABLE' || code === 'SHARE_FAILED') {
        throw new CollectPlatformError(code);
      }
      throw new CollectPlatformError('SHARE_FAILED');
    }
  },
};
