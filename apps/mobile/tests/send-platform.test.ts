import { getStringAsync } from 'expo-clipboard';
import { Platform } from 'react-native';

import { readClipboard, sendPlatform } from '../src/send/platform';

jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }));

const clipboard = jest.mocked(getStringAsync);
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function webNavigator(value: unknown) {
  jest.replaceProperty(Platform, 'OS', 'web');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  clipboard.mockReset();
  clipboard.mockResolvedValue('exemple@teranga.example');
});

afterEach(() => {
  jest.restoreAllMocks();
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
});

describe('presse-papiers T20 | lecture à la demande', () => {
  it('ne lit rien au chargement du module, puis conserve le texte exact sans le décoder', async () => {
    const content = '  lightning:DEMANDE_FICTIVE\n';
    clipboard.mockResolvedValue(content);
    expect(clipboard).not.toHaveBeenCalled();
    await expect(sendPlatform.readClipboard()).resolves.toBe(content);
    expect(clipboard).toHaveBeenCalledTimes(1);
    expect(clipboard).toHaveBeenCalledWith();
  });

  it('restitue le presse-papiers vide pour que le contrôleur explique une saisie absente', async () => {
    clipboard.mockResolvedValue('');
    await expect(readClipboard()).resolves.toBe('');
  });

  it('masque le contenu et le message natif lors d’un refus de lecture', async () => {
    const content = 'contenu-fictif-a-ne-pas-journaliser';
    clipboard.mockRejectedValue(new Error(content));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(readClipboard()).rejects.toMatchObject({
      name: 'SendPlatformError',
      code: 'READ_FAILED',
      message: 'READ_FAILED',
    });
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('signale un module natif incomplet par un code stable', async () => {
    const module = jest.requireMock<typeof import('expo-clipboard')>('expo-clipboard');
    const descriptor = Object.getOwnPropertyDescriptor(module, 'getStringAsync');
    Object.defineProperty(module, 'getStringAsync', { configurable: true, value: undefined });
    try {
      await expect(readClipboard()).rejects.toMatchObject({ code: 'READ_UNAVAILABLE' });
    } finally {
      if (descriptor) Object.defineProperty(module, 'getStringAsync', descriptor);
    }
  });

  it.each([undefined, null, 12, { value: 'fictif' }])(
    'refuse une réponse native de type incorrect sans la convertir en demande',
    async (content) => {
      clipboard.mockResolvedValue(content as unknown as string);
      await expect(readClipboard()).rejects.toMatchObject({ code: 'INVALID_CLIPBOARD' });
    },
  );

  it('utilise directement l’API navigateur sur action explicite sans appel natif', async () => {
    const readText = jest.fn(async () => 'exemple@teranga.example');
    webNavigator({ clipboard: { readText } });
    expect(readText).not.toHaveBeenCalled();
    await expect(readClipboard()).resolves.toBe('exemple@teranga.example');
    expect(readText).toHaveBeenCalledTimes(1);
    expect(clipboard).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { clipboard: {} }])(
    'signale une API web absente sans lecture native de repli',
    async (value) => {
      webNavigator(value);
      await expect(readClipboard()).rejects.toMatchObject({ code: 'READ_UNAVAILABLE' });
      expect(clipboard).not.toHaveBeenCalled();
    },
  );

  it('remplace le détail sensible d’un refus web par READ_FAILED', async () => {
    webNavigator({
      clipboard: {
        readText: jest.fn(async () => {
          throw new Error('contenu-fictif-refuse');
        }),
      },
    });
    await expect(readClipboard()).rejects.toMatchObject({
      code: 'READ_FAILED',
      message: 'READ_FAILED',
    });
    expect(clipboard).not.toHaveBeenCalled();
  });

  it('valide également le type du résultat web', async () => {
    webNavigator({ clipboard: { readText: jest.fn(async () => null) } });
    await expect(readClipboard()).rejects.toMatchObject({ code: 'INVALID_CLIPBOARD' });
  });
});
