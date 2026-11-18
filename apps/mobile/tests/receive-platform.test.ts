import { setStringAsync } from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import { receivePlatform } from '../src/receive/platform';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

const address = 'exemple@teranga.example';
const payload = {
  title: 'Recevoir | Teranga Pay',
  message: `Démonstration uniquement | Aucun paiement réel.\n${address}`,
};
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const clipboard = jest.mocked(setStringAsync);

function webNavigator(value: unknown) {
  jest.replaceProperty(Platform, 'OS', 'web');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  clipboard.mockReset();
  clipboard.mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
});

describe('copie T18', () => {
  it('copie uniquement les octets exacts de l’adresse native et attend la confirmation du module', async () => {
    await expect(receivePlatform.copy(address)).resolves.toBe(true);
    expect(clipboard).toHaveBeenCalledWith(address);
    expect(clipboard).toHaveBeenCalledTimes(1);
  });

  it('ne confirme pas la copie lorsque le module renvoie false', async () => {
    clipboard.mockResolvedValue(false);
    await expect(receivePlatform.copy(address)).resolves.toBe(false);
  });

  it('remonte un refus natif sans afficher ni journaliser le contenu', async () => {
    clipboard.mockRejectedValue(new Error('permission'));
    await expect(receivePlatform.copy(address)).rejects.toMatchObject({ code: 'COPY_FAILED' });
  });

  it('tolère un module natif incomplet sans confirmer une copie', async () => {
    const module = jest.requireMock<typeof import('expo-clipboard')>('expo-clipboard');
    const descriptor = Object.getOwnPropertyDescriptor(module, 'setStringAsync');
    Object.defineProperty(module, 'setStringAsync', { configurable: true, value: undefined });
    try {
      await expect(receivePlatform.copy(address)).rejects.toMatchObject({
        code: 'COPY_UNAVAILABLE',
      });
    } finally {
      if (descriptor) Object.defineProperty(module, 'setStringAsync', descriptor);
    }
  });

  it.each(['', 'a\n@b.example', 'é@teranga.example', 'a'.repeat(255)])(
    'refuse une charge invalide avant le module',
    async (value) => {
      await expect(receivePlatform.copy(value)).rejects.toMatchObject({ code: 'INVALID_PAYLOAD' });
      expect(clipboard).not.toHaveBeenCalled();
    },
  );

  it('utilise directement navigator.clipboard sur le web sans charger le chemin natif', async () => {
    const writeText = jest.fn(async () => {});
    webNavigator({ clipboard: { writeText } });
    await expect(receivePlatform.copy(address)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(address);
    expect(clipboard).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { clipboard: {} }])(
    'signale une API web indisponible sans copie de repli',
    async (navigatorValue) => {
      webNavigator(navigatorValue);
      await expect(receivePlatform.copy(address)).rejects.toMatchObject({
        code: 'COPY_UNAVAILABLE',
      });
      expect(clipboard).not.toHaveBeenCalled();
    },
  );

  it('signale un presse-papiers web refusé', async () => {
    webNavigator({
      clipboard: {
        writeText: jest.fn(async () => {
          throw new Error('denied');
        }),
      },
    });
    await expect(receivePlatform.copy(address)).rejects.toMatchObject({ code: 'COPY_FAILED' });
  });
});

describe('partage T18', () => {
  it('conserve le message traduit et interprète sharedAction comme ouverture seulement', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    await expect(receivePlatform.share(payload)).resolves.toBe('opened');
    expect(share).toHaveBeenCalledWith(payload);
    expect(clipboard).not.toHaveBeenCalled();
  });

  it('distingue une fermeture native', async () => {
    jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });
    await expect(receivePlatform.share(payload)).resolves.toBe('dismissed');
  });

  it('signale un échec natif sans remplacer le partage par une copie', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('native unavailable'));
    await expect(receivePlatform.share(payload)).rejects.toMatchObject({ code: 'SHARE_FAILED' });
    expect(clipboard).not.toHaveBeenCalled();
  });

  it('refuse une réponse native inconnue plutôt que prétendre une ouverture', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'unknown', activityType: undefined });
    await expect(receivePlatform.share(payload)).rejects.toMatchObject({ code: 'SHARE_FAILED' });
  });

  it('appelle Web Share directement avec title et text', async () => {
    const share = jest.fn(async () => {});
    webNavigator({ share });
    await expect(receivePlatform.share(payload)).resolves.toBe('opened');
    expect(share).toHaveBeenCalledWith({ title: payload.title, text: payload.message });
    expect(clipboard).not.toHaveBeenCalled();
  });

  it('distingue le refus de la feuille web de son annulation par l’utilisateur', async () => {
    const cancel = new Error('cancel');
    cancel.name = 'AbortError';
    webNavigator({
      share: jest.fn(async () => {
        throw cancel;
      }),
    });
    await expect(receivePlatform.share(payload)).resolves.toBe('dismissed');
  });

  it('signale une erreur Web Share', async () => {
    webNavigator({
      share: jest.fn(async () => {
        throw new Error('denied');
      }),
    });
    await expect(receivePlatform.share(payload)).rejects.toMatchObject({ code: 'SHARE_FAILED' });
  });

  it.each([undefined, {}])(
    'signale un partage web indisponible sans repli silencieux',
    async (navigatorValue) => {
      webNavigator(navigatorValue);
      await expect(receivePlatform.share(payload)).rejects.toMatchObject({
        code: 'SHARE_UNAVAILABLE',
      });
      expect(clipboard).not.toHaveBeenCalled();
    },
  );

  it.each([
    { title: '', message: 'test' },
    { title: 'test', message: '' },
    { title: 'test\n', message: 'test' },
    { title: 'test', message: 'a\u0000b' },
    { title: 'a'.repeat(121), message: 'test' },
    { title: 'test', message: 'a'.repeat(4097) },
  ])('refuse un message de partage invalide avant une sortie externe', async (invalid) => {
    const share = jest.spyOn(Share, 'share');
    await expect(receivePlatform.share(invalid)).rejects.toMatchObject({ code: 'INVALID_PAYLOAD' });
    expect(share).not.toHaveBeenCalled();
  });
});
