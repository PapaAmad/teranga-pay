import { Platform } from 'react-native';

export type SendPlatformErrorCode = 'READ_UNAVAILABLE' | 'READ_FAILED' | 'INVALID_CLIPBOARD';

export class SendPlatformError extends Error {
  constructor(readonly code: SendPlatformErrorCode) {
    super(code);
    this.name = 'SendPlatformError';
  }
}

export interface SendPlatformPort {
  readClipboard(): Promise<string>;
}

type WebNavigator = { clipboard?: { readText?: () => Promise<string> } };

/** À appeler uniquement depuis l'action explicite « Coller ». Aucune lecture au montage. */
export async function readClipboard(): Promise<string> {
  let content: unknown;

  if (Platform.OS === 'web') {
    const web = typeof navigator === 'undefined' ? undefined : (navigator as WebNavigator);
    if (typeof web?.clipboard?.readText !== 'function') {
      throw new SendPlatformError('READ_UNAVAILABLE');
    }
    try {
      content = await web.clipboard.readText();
    } catch {
      throw new SendPlatformError('READ_FAILED');
    }
  } else {
    // Chargement à l'action : une intégration native absente reste une erreur récupérable.
    let clipboard: typeof import('expo-clipboard');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      if (typeof clipboard.getStringAsync !== 'function') {
        throw new SendPlatformError('READ_UNAVAILABLE');
      }
    } catch {
      throw new SendPlatformError('READ_UNAVAILABLE');
    }
    try {
      content = await clipboard.getStringAsync();
    } catch {
      throw new SendPlatformError('READ_FAILED');
    }
  }

  if (typeof content !== 'string') throw new SendPlatformError('INVALID_CLIPBOARD');
  // La validation de la demande appartient au contrôleur ; garder les octets copiés intacts.
  return content;
}

export const sendPlatform: SendPlatformPort = { readClipboard };
