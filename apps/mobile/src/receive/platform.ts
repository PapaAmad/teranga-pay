import { Platform, Share } from 'react-native';

import { assertReceiveQrValue } from './qr';

export type ReceivePlatformErrorCode =
  'INVALID_PAYLOAD' | 'COPY_UNAVAILABLE' | 'COPY_FAILED' | 'SHARE_UNAVAILABLE' | 'SHARE_FAILED';

export class ReceivePlatformError extends Error {
  constructor(readonly code: ReceivePlatformErrorCode) {
    super(code);
    this.name = 'ReceivePlatformError';
  }
}

export type ReceiveSharePayload = { message: string; title: string };
export interface ReceivePlatformPort {
  copy(text: string): Promise<boolean>;
  share(payload: ReceiveSharePayload): Promise<'opened' | 'dismissed'>;
}

type WebNavigator = {
  clipboard?: { writeText?: (text: string) => Promise<void> };
  share?: (data: { title: string; text: string }) => Promise<void>;
};

function browserNavigator(): WebNavigator | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator as WebNavigator);
}

function hasControl(value: string, allowLineFeed = false) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code === 127 || (code < 32 && !(allowLineFeed && code === 10));
  });
}

function assertSharePayload(payload: ReceiveSharePayload) {
  if (
    !payload ||
    typeof payload.title !== 'string' ||
    payload.title.trim().length === 0 ||
    payload.title.length > 120 ||
    hasControl(payload.title) ||
    typeof payload.message !== 'string' ||
    payload.message.trim().length === 0 ||
    payload.message.length > 4096 ||
    hasControl(payload.message, true)
  ) {
    throw new ReceivePlatformError('INVALID_PAYLOAD');
  }
}

export const receivePlatform: ReceivePlatformPort = {
  async copy(text) {
    try {
      assertReceiveQrValue(text);
    } catch {
      throw new ReceivePlatformError('INVALID_PAYLOAD');
    }
    if (Platform.OS === 'web') {
      const web = browserNavigator();
      if (typeof web?.clipboard?.writeText !== 'function') {
        throw new ReceivePlatformError('COPY_UNAVAILABLE');
      }
      try {
        await web.clipboard.writeText(text);
        return true;
      } catch {
        throw new ReceivePlatformError('COPY_FAILED');
      }
    }

    // Le module natif n'est chargé qu'à l'action, afin de tolérer une intégration absente.
    let clipboard: typeof import('expo-clipboard');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      if (typeof clipboard.setStringAsync !== 'function') {
        throw new ReceivePlatformError('COPY_UNAVAILABLE');
      }
    } catch {
      throw new ReceivePlatformError('COPY_UNAVAILABLE');
    }
    try {
      return (await clipboard.setStringAsync(text)) === true;
    } catch {
      throw new ReceivePlatformError('COPY_FAILED');
    }
  },

  async share(payload) {
    assertSharePayload(payload);
    if (Platform.OS === 'web') {
      const web = browserNavigator();
      if (typeof web?.share !== 'function') {
        throw new ReceivePlatformError('SHARE_UNAVAILABLE');
      }
      try {
        await web.share({ title: payload.title, text: payload.message });
        return 'opened';
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return 'dismissed';
        throw new ReceivePlatformError('SHARE_FAILED');
      }
    }

    try {
      const result = await Share.share({ title: payload.title, message: payload.message });
      if (result.action === Share.dismissedAction) return 'dismissed';
      // Android confirme seulement que la feuille est ouverte, jamais un envoi effectif.
      if (result.action === Share.sharedAction) return 'opened';
      throw new ReceivePlatformError('SHARE_FAILED');
    } catch {
      throw new ReceivePlatformError('SHARE_FAILED');
    }
  },
};
