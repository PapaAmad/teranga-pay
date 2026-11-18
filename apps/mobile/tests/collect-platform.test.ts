import { setStringAsync } from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import { collectPlatform } from '../src/collect/platform';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

// Chaîne fictive non payable, volontairement plus longue qu’une adresse T18.
const invoice = `lnbcrt${'q'.repeat(500)}`;
const receipt = {
  title: 'Reçu fictif | Teranga Pay',
  message: 'Démonstration uniquement | Aucun paiement réel.\n2 500 FCFA\nRéférence : exemple-001',
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

describe('copie T22 | facture regtest exacte', () => {
  it.each([invoice, invoice.toUpperCase(), `lnbcrt${'q'.repeat(2042)}`])(
    'copie une facture longue sans troncature, schéma ou changement de casse',
    async (value) => {
      await expect(collectPlatform.copyPaymentRequest(value)).resolves.toBe(true);
      expect(clipboard).toHaveBeenCalledTimes(1);
      expect(clipboard).toHaveBeenCalledWith(value);
    },
  );

  it('ne confirme pas une copie native refusée', async () => {
    clipboard.mockResolvedValue(false);
    await expect(collectPlatform.copyPaymentRequest(invoice)).resolves.toBe(false);
  });

  it('remonte une erreur native sans exposer le texte envoyé', async () => {
    clipboard.mockRejectedValue(new Error(invoice));
    await expect(collectPlatform.copyPaymentRequest(invoice)).rejects.toMatchObject({
      code: 'COPY_FAILED',
      message: 'COPY_FAILED',
    });
  });

  it('tolère un module natif incomplet sans annoncer de copie', async () => {
    const module = jest.requireMock<typeof import('expo-clipboard')>('expo-clipboard');
    const descriptor = Object.getOwnPropertyDescriptor(module, 'setStringAsync');
    Object.defineProperty(module, 'setStringAsync', { configurable: true, value: undefined });
    try {
      await expect(collectPlatform.copyPaymentRequest(invoice)).rejects.toMatchObject({
        code: 'COPY_UNAVAILABLE',
      });
    } finally {
      if (descriptor) Object.defineProperty(module, 'setStringAsync', descriptor);
    }
  });

  it.each([
    '',
    'lnbcrt',
    `lightning:${invoice}`,
    `${invoice}\n`,
    `${invoice} `,
    'exemple@teranga.example',
    `lnbc${'q'.repeat(300)}`,
    `lnbcrtQ${'q'.repeat(300)}`,
    `lnbcrt${'q'.repeat(2043)}`,
  ])('refuse un contenu hors contrat avant toute sortie', async (value) => {
    await expect(collectPlatform.copyPaymentRequest(value)).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
    });
    expect(clipboard).not.toHaveBeenCalled();
  });

  it('utilise le presse-papiers web directement et attend son résultat', async () => {
    const writeText = jest.fn(async () => {});
    webNavigator({ clipboard: { writeText } });
    await expect(collectPlatform.copyPaymentRequest(invoice)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(invoice);
    expect(clipboard).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { clipboard: {} }])(
    'signale une API web indisponible sans repli natif',
    async (value) => {
      webNavigator(value);
      await expect(collectPlatform.copyPaymentRequest(invoice)).rejects.toMatchObject({
        code: 'COPY_UNAVAILABLE',
      });
      expect(clipboard).not.toHaveBeenCalled();
    },
  );

  it('remonte un refus du presse-papiers web sans fausse confirmation', async () => {
    webNavigator({ clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
    await expect(collectPlatform.copyPaymentRequest(invoice)).rejects.toMatchObject({
      code: 'COPY_FAILED',
    });
  });
});

describe('partage T22 | ouverture distincte d’un envoi ou d’un paiement', () => {
  it('partage le reçu traduit exact sans retirer son avertissement fictif', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    await expect(collectPlatform.share(receipt)).resolves.toBe('opened');
    expect(share).toHaveBeenCalledWith(receipt);
    expect(clipboard).not.toHaveBeenCalled();
  });

  it('distingue l’annulation native', async () => {
    jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });
    await expect(collectPlatform.share(receipt)).resolves.toBe('dismissed');
  });

  it('remonte une erreur native comme échec de partage', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error(receipt.message));
    await expect(collectPlatform.share(receipt)).rejects.toMatchObject({
      code: 'SHARE_FAILED',
      message: 'SHARE_FAILED',
    });
  });

  it('utilise Web Share avec le titre et le texte exacts', async () => {
    const share = jest.fn(async () => {});
    webNavigator({ share });
    await expect(collectPlatform.share(receipt)).resolves.toBe('opened');
    expect(share).toHaveBeenCalledWith({ title: receipt.title, text: receipt.message });
    expect(clipboard).not.toHaveBeenCalled();
  });

  it('distingue l’annulation du partage web', async () => {
    const error = new Error('cancel');
    error.name = 'AbortError';
    webNavigator({ share: jest.fn().mockRejectedValue(error) });
    await expect(collectPlatform.share(receipt)).resolves.toBe('dismissed');
  });

  it('annonce une API web indisponible sans copie implicite', async () => {
    webNavigator({});
    await expect(collectPlatform.share(receipt)).rejects.toMatchObject({
      code: 'SHARE_UNAVAILABLE',
    });
    expect(clipboard).not.toHaveBeenCalled();
  });

  it.each([
    { title: '', message: 'test' },
    { title: 'test', message: '' },
    { title: 'test\n', message: 'test' },
    { title: 'test', message: 'a\u0000b' },
    { title: 'a'.repeat(121), message: 'test' },
    { title: 'test', message: 'a'.repeat(4097) },
  ])('refuse un reçu malformé avant de le partager', async (value) => {
    const share = jest.spyOn(Share, 'share');
    await expect(collectPlatform.share(value)).rejects.toMatchObject({ code: 'INVALID_PAYLOAD' });
    expect(share).not.toHaveBeenCalled();
  });
});
