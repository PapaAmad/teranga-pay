import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';
import * as ReactNative from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { HomePayment, HomeResult } from '../src/home/ports';
import type { SendPlatformPort } from '../src/send/platform';
import type { SendServices } from '../src/send/ports';
import {
  createSendPreviewServices,
  sendPreviewAddress,
  sendPreviewInvoice,
} from '../src/send/preview';
import { SendScreen } from '../src/send/SendScreen';
import { createAppI18n, TranslationProvider } from '../src/translations';
import { fr } from '../src/translations/fr';
import { BrandTypographyProvider } from '../src/ui';

// La caméra et les permissions possèdent leur propre suite. Ici on livre un résultat
// de scan à l'écran, puis on vérifie la vraie préparation et la vraie confirmation.
jest.mock('../src/send/QrScanner', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    QrScanner: ({
      active,
      onScanned,
      onClose,
      labels,
    }: {
      active: boolean;
      onScanned: (raw: string) => void;
      onClose: () => void;
      labels: { title: string; close: string };
    }) =>
      active
        ? React.createElement(
            View,
            null,
            React.createElement(Text, { accessibilityRole: 'header' }, labels.title),
            React.createElement(Pressable, {
              testID: 'deliver-fixture-qr',
              onPress: () => onScanned('lnbcrt1exemplefictifnonpayable'),
            }),
            React.createElement(Pressable, {
              accessibilityRole: 'button',
              accessibilityLabel: labels.close,
              onPress: onClose,
            }),
          )
        : null,
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderSend(services: SendServices = createSendPreviewServices()) {
  const i18n = createAppI18n();
  const effects: SendPlatformPort & { readClipboard: jest.Mock<Promise<string>, []> } = {
    readClipboard: jest.fn<Promise<string>, []>().mockResolvedValue(sendPreviewInvoice),
  };
  const callbacks = { onBack: jest.fn(), onRequireUnlock: jest.fn(), onPreview: jest.fn() };
  const element = (active: boolean) => (
    <SafeAreaProvider>
      <TranslationProvider i18n={i18n}>
        <BrandTypographyProvider available>
          <SendScreen services={services} platform={effects} active={active} {...callbacks} />
        </BrandTypographyProvider>
      </TranslationProvider>
    </SafeAreaProvider>
  );
  const view = render(element(true));
  return {
    ...view,
    ...callbacks,
    services,
    effects,
    i18n,
    setActive: (active: boolean) => view.rerender(element(active)),
  };
}

async function inspectInvoice() {
  await screen.findByLabelText(fr.send.destination);
  fireEvent.changeText(screen.getByLabelText(fr.send.destination), sendPreviewInvoice);
  fireEvent.press(screen.getByRole('button', { name: fr.send.continue }));
  await screen.findByRole('header', { name: fr.send.reviewTitle });
}

async function enterPin() {
  await inspectInvoice();
  fireEvent.press(screen.getByRole('button', { name: fr.send.confirm }));
  await screen.findByLabelText(fr.send.pinLabel);
}

const payment: HomePayment = {
  id: 'fixture-envoi-ui',
  direction: 'envoye',
  status: 'reussi',
  amountSats: 10_000,
  feeSats: 12,
  amountXof: 4_500,
  memo: null,
  createdAt: '2026-11-10T12:00:00.000Z',
  failure: null,
};

describe('envoyer T20 | saisie et consentement explicites', () => {
  let originalState: PropertyDescriptor | undefined;
  beforeEach(() => {
    originalState = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalState) Object.defineProperty(AppState, 'currentState', originalState);
  });

  it('explique le fournisseur absent sans injecter de facture ou d’opération fictive', async () => {
    const view = renderSend({ mode: 'unavailable' });
    expect(await screen.findByRole('header', { name: fr.send.unavailableTitle })).toBeOnTheScreen();
    expect(screen.queryByLabelText(fr.send.destination)).toBeNull();
    expect(screen.queryByText(sendPreviewInvoice)).toBeNull();
    expect(screen.queryByText(fr.send.preview)).toBeNull();
    expect(view.effects.readClipboard).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: fr.send.previewAction }));
    expect(view.onPreview).toHaveBeenCalledTimes(1);
  });

  it('ne lit ni le presse-papiers ni la destination au montage de l’atelier', async () => {
    const services = createSendPreviewServices();
    const preview = jest.spyOn(services.wallet!, 'preview');
    const send = jest.spyOn(services.wallet!, 'send');
    const { effects } = renderSend(services);
    await screen.findByLabelText(fr.send.destination);
    expect(screen.getByText(fr.send.preview)).toBeOnTheScreen();
    expect(effects.readClipboard).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('colle sur demande puis affiche le plafond et le total sans payer', async () => {
    const services = createSendPreviewServices();
    const preview = jest.spyOn(services.wallet!, 'preview');
    const send = jest.spyOn(services.wallet!, 'send');
    const { effects } = renderSend(services);
    await screen.findByLabelText(fr.send.destination);
    fireEvent.press(screen.getByRole('button', { name: fr.send.paste }));
    expect(await screen.findByRole('header', { name: fr.send.reviewTitle })).toBeOnTheScreen();
    expect(effects.readClipboard).toHaveBeenCalledTimes(1);
    expect(preview).toHaveBeenCalledWith(sendPreviewInvoice);
    expect(screen.getByText(fr.send.fee)).toBeOnTheScreen();
    expect(screen.getByText('45\u00a0FCFA')).toBeOnTheScreen();
    expect(screen.getByText(fr.send.total)).toBeOnTheScreen();
    expect(screen.getByText('4\u00a0545\u00a0FCFA')).toBeOnTheScreen();
    expect(send).not.toHaveBeenCalled();
  });

  it('garde une saisie manuelle utilisable quand le collage est refusé', async () => {
    const { effects } = renderSend();
    effects.readClipboard.mockRejectedValueOnce(new Error('controlled clipboard denial'));
    await screen.findByLabelText(fr.send.destination);
    fireEvent.press(screen.getByRole('button', { name: fr.send.paste }));
    expect(await screen.findByText(fr.send.pasteFailed)).toBeOnTheScreen();
    await inspectInvoice();
    expect(screen.queryByText(fr.send.pasteFailed)).toBeNull();
  });

  it('ignore le collage tardif après une modification volontaire du champ', async () => {
    const read = deferred<string>();
    const services = createSendPreviewServices();
    const preview = jest.spyOn(services.wallet!, 'preview');
    const { effects } = renderSend(services);
    effects.readClipboard.mockReturnValueOnce(read.promise);
    await screen.findByLabelText(fr.send.destination);
    fireEvent.press(screen.getByRole('button', { name: fr.send.paste }));
    fireEvent.changeText(screen.getByLabelText(fr.send.destination), sendPreviewAddress);
    await act(async () => {
      read.resolve(sendPreviewInvoice);
    });
    expect(screen.getByLabelText(fr.send.destination)).toHaveProp('value', sendPreviewAddress);
    expect(preview).not.toHaveBeenCalled();
  });

  it('ignore une lecture du presse-papiers terminée après perte de focus', async () => {
    const read = deferred<string>();
    const services = createSendPreviewServices();
    const preview = jest.spyOn(services.wallet!, 'preview');
    const { effects, setActive } = renderSend(services);
    effects.readClipboard.mockReturnValueOnce(read.promise);
    await screen.findByLabelText(fr.send.destination);
    fireEvent.press(screen.getByRole('button', { name: fr.send.paste }));
    setActive(false);
    await act(async () => {
      read.resolve(sendPreviewInvoice);
    });
    expect(screen.getByRole('header', { name: fr.send.suspendedTitle })).toBeOnTheScreen();
    expect(preview).not.toHaveBeenCalled();
    setActive(true);
    expect(await screen.findByLabelText(fr.send.destination)).toHaveProp('value', '');
    expect(screen.queryByText(fr.send.pasteFailed)).toBeNull();
  });

  it('ignore le résultat de collage après destruction de l’écran', async () => {
    const read = deferred<string>();
    const services = createSendPreviewServices();
    const preview = jest.spyOn(services.wallet!, 'preview');
    const { effects, unmount } = renderSend(services);
    effects.readClipboard.mockReturnValueOnce(read.promise);
    await screen.findByLabelText(fr.send.destination);
    fireEvent.press(screen.getByRole('button', { name: fr.send.paste }));
    unmount();
    await act(async () => {
      read.resolve(sendPreviewInvoice);
    });
    expect(preview).not.toHaveBeenCalled();
  });

  it('explique une destination non reconnue sans appeler le décodeur ni payer', async () => {
    const services = createSendPreviewServices();
    const preview = jest.spyOn(services.wallet!, 'preview');
    const send = jest.spyOn(services.wallet!, 'send');
    renderSend(services);
    await screen.findByLabelText(fr.send.destination);
    fireEvent.changeText(screen.getByLabelText(fr.send.destination), 'https://exemple.invalid/');
    fireEvent.press(screen.getByRole('button', { name: fr.send.continue }));
    expect(await screen.findByText(fr.send.errors.DESTINATION_INVALID)).toBeOnTheScreen();
    expect(preview).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('demande le montant d’une adresse et vérifie son devis FCFA avant le PIN', async () => {
    const services = createSendPreviewServices();
    const quote = jest.spyOn(services.rates!, 'quote');
    const preview = jest.spyOn(services.wallet!, 'preview');
    const send = jest.spyOn(services.wallet!, 'send');
    renderSend(services);
    await screen.findByLabelText(fr.send.destination);
    fireEvent.changeText(screen.getByLabelText(fr.send.destination), sendPreviewAddress);
    fireEvent.press(screen.getByRole('button', { name: fr.send.continue }));
    expect(await screen.findByLabelText(fr.send.amountLabel)).toHaveProp('value', '');
    expect(screen.getByRole('button', { name: fr.send.continue })).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText(fr.send.amountLabel), '2500');
    fireEvent.press(screen.getByRole('button', { name: fr.send.continue }));
    expect(await screen.findByRole('header', { name: fr.send.reviewTitle })).toBeOnTheScreen();
    expect(quote).toHaveBeenCalledWith(2500);
    expect(preview).toHaveBeenCalledWith(sendPreviewAddress, 5556);
    expect(screen.getByText('2\u00a0500\u00a0FCFA')).toBeOnTheScreen();
    expect(screen.getByText('26\u00a0FCFA')).toBeOnTheScreen();
    expect(screen.getByText('2\u00a0526\u00a0FCFA')).toBeOnTheScreen();
    expect(send).not.toHaveBeenCalled();
  });

  it('explique les montants non valides sans demander de devis puis retire l’erreur après correction', async () => {
    const services = createSendPreviewServices();
    const quote = jest.spyOn(services.rates!, 'quote');
    const send = jest.spyOn(services.wallet!, 'send');
    renderSend(services);
    await screen.findByLabelText(fr.send.destination);
    fireEvent.changeText(screen.getByLabelText(fr.send.destination), sendPreviewAddress);
    fireEvent.press(screen.getByRole('button', { name: fr.send.continue }));
    const field = await screen.findByLabelText(fr.send.amountLabel);

    for (const value of ['0', '5000001', '1e3']) {
      fireEvent.changeText(field, value);
      expect(screen.getByText(fr.send.errors.AMOUNT_INVALID)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: fr.send.continue })).toBeDisabled();
      fireEvent.press(screen.getByRole('button', { name: fr.send.continue }));
      expect(quote).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    }

    fireEvent.changeText(field, '2500');
    expect(screen.queryByText(fr.send.errors.AMOUNT_INVALID)).toBeNull();
    expect(screen.getByRole('button', { name: fr.send.continue })).toBeEnabled();
    fireEvent.press(screen.getByRole('button', { name: fr.send.continue }));
    expect(await screen.findByRole('header', { name: fr.send.reviewTitle })).toBeOnTheScreen();
    expect(quote).toHaveBeenCalledTimes(1);
    expect(quote).toHaveBeenCalledWith(2500);
    expect(send).not.toHaveBeenCalled();
  });

  it('garde Scanner et Coller complets et utilisables à un agrandissement de texte de 2', async () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 2,
    });
    const { effects } = renderSend();
    await screen.findByLabelText(fr.send.destination);
    const scan = screen.getByRole('button', { name: fr.send.scan });
    const paste = screen.getByRole('button', { name: fr.send.paste });
    expect(screen.getByText(fr.send.scan)).toHaveTextContent(fr.send.scan);
    expect(screen.getByText(fr.send.paste)).toHaveTextContent(fr.send.paste);
    expect(scan).toHaveProp('accessibilityHint', fr.send.scanHint);
    for (const button of [scan, paste]) {
      expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(48);
      expect(button).toBeEnabled();
    }

    fireEvent.press(scan);
    expect(screen.getByRole('header', { name: fr.send.scanner.title })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.send.scanner.close }));
    fireEvent.press(screen.getByRole('button', { name: fr.send.paste }));
    expect(await screen.findByRole('header', { name: fr.send.reviewTitle })).toBeOnTheScreen();
    expect(effects.readClipboard).toHaveBeenCalledTimes(1);
  });

  it('exige un appui explicite après six chiffres et transmet le plafond relu', async () => {
    const reviewAt = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(reviewAt);
    const services = createSendPreviewServices();
    const send = jest.spyOn(services.wallet!, 'send');
    const { i18n } = renderSend(services);
    await enterPin();
    fireEvent.changeText(screen.getByLabelText(fr.send.pinLabel), '000000');
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByLabelText(fr.send.pinLabel)).toHaveProp('secureTextEntry', true);
    fireEvent.press(
      screen.getByRole('button', {
        name: i18n.t('send.previewPay', { amount: '4\u00a0500\u00a0FCFA' }),
      }),
    );
    expect(
      await screen.findByRole('header', { name: fr.send.previewSuccessTitle }),
    ).toBeOnTheScreen();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      destination: sendPreviewInvoice,
      amountSats: 10_000,
      maxFeeSats: 100,
      amountXof: 4500,
      xofPerBtc: 45_000_000,
      expiresAt: new Date(reviewAt + 300_000).toISOString(),
      pin: '000000',
    });
    expect(screen.getByText(fr.send.previewSuccessDescription)).toBeOnTheScreen();
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
  });

  it('ne rend pas le PIN disponible tant que les frais FCFA sont inconnus', async () => {
    const services = createSendPreviewServices('feesUnavailable');
    const send = jest.spyOn(services.wallet!, 'send');
    renderSend(services);
    await inspectInvoice();
    fireEvent.press(screen.getByRole('button', { name: fr.send.confirm }));
    expect(await screen.findByText(fr.send.errors.RATE_UNAVAILABLE)).toBeOnTheScreen();
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('efface le code après refus du service et exige une nouvelle saisie', async () => {
    const services = createSendPreviewServices('PIN_INVALID');
    const send = jest.spyOn(services.wallet!, 'send');
    const { i18n } = renderSend(services);
    await enterPin();
    fireEvent.changeText(screen.getByLabelText(fr.send.pinLabel), '000000');
    const action = i18n.t('send.previewPay', { amount: '4\u00a0500\u00a0FCFA' });
    fireEvent.press(screen.getByRole('button', { name: action }));
    expect(await screen.findByText(fr.send.errors.PIN_INVALID)).toBeOnTheScreen();
    expect(screen.getByLabelText(fr.send.pinLabel)).toHaveProp('value', '');
    expect(screen.getByRole('button', { name: action })).toBeDisabled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('revient à la destination sans conserver le PIN quand on modifie la demande', async () => {
    const services = createSendPreviewServices();
    const send = jest.spyOn(services.wallet!, 'send');
    renderSend(services);
    await enterPin();
    fireEvent.changeText(screen.getByLabelText(fr.send.pinLabel), '000000');
    fireEvent.press(screen.getByRole('button', { name: fr.send.edit }));
    expect(await screen.findByLabelText(fr.send.destination)).toHaveProp(
      'value',
      sendPreviewInvoice,
    );
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.send.continue }));
    await screen.findByRole('header', { name: fr.send.reviewTitle });
    fireEvent.press(screen.getByRole('button', { name: fr.send.confirm }));
    expect(await screen.findByLabelText(fr.send.pinLabel)).toHaveProp('value', '');
    expect(send).not.toHaveBeenCalled();
  });

  it('retire la saisie et le code lors de la perte de focus puis reprend sans autorisation', async () => {
    const services = createSendPreviewServices();
    const send = jest.spyOn(services.wallet!, 'send');
    const { setActive } = renderSend(services);
    await enterPin();
    fireEvent.changeText(screen.getByLabelText(fr.send.pinLabel), '000000');
    setActive(false);
    expect(screen.getByRole('header', { name: fr.send.suspendedTitle })).toBeOnTheScreen();
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
    setActive(true);
    expect(await screen.findByLabelText(fr.send.destination)).toHaveProp('value', '');
    await enterPin();
    expect(screen.getByLabelText(fr.send.pinLabel)).toHaveProp('value', '');
    expect(send).not.toHaveBeenCalled();
  });

  it('purge le code lors du passage en arrière-plan et ne paie pas à la reprise', async () => {
    const listeners = new Set<(next: AppStateStatus) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
    const services = createSendPreviewServices();
    const send = jest.spyOn(services.wallet!, 'send');
    renderSend(services);
    await enterPin();
    fireEvent.changeText(screen.getByLabelText(fr.send.pinLabel), '000000');
    act(() => listeners.forEach((listener) => listener('background')));
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
    expect(screen.getByRole('header', { name: fr.send.suspendedTitle })).toBeOnTheScreen();
    act(() => listeners.forEach((listener) => listener('active')));
    expect(await screen.findByLabelText(fr.send.destination)).toHaveProp('value', '');
    await enterPin();
    expect(screen.getByLabelText(fr.send.pinLabel)).toHaveProp('value', '');
    expect(send).not.toHaveBeenCalled();
  });

  it('ne soumet qu’une fois pendant un résultat natif retardé', async () => {
    const submitted = deferred<HomeResult<HomePayment>>();
    const services = createSendPreviewServices();
    const send = jest.spyOn(services.wallet!, 'send').mockReturnValueOnce(submitted.promise);
    const { i18n } = renderSend(services);
    await enterPin();
    fireEvent.changeText(screen.getByLabelText(fr.send.pinLabel), '000000');
    const button = screen.getByRole('button', {
      name: i18n.t('send.previewPay', { amount: '4\u00a0500\u00a0FCFA' }),
    });
    fireEvent.press(button);
    fireEvent.press(button);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('header', { name: fr.send.sendingTitle })).toBeOnTheScreen();
    await act(async () => {
      submitted.resolve({ ok: true, value: payment });
    });
    expect(screen.getByRole('header', { name: fr.send.previewSuccessTitle })).toBeOnTheScreen();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('vérifie une attente identifiée sans renvoyer le paiement', async () => {
    const services = createSendPreviewServices('pending');
    const send = jest.spyOn(services.wallet!, 'send');
    const history = jest.spyOn(services.wallet!, 'history');
    const { i18n } = renderSend(services);
    await enterPin();
    history.mockClear();
    fireEvent.changeText(screen.getByLabelText(fr.send.pinLabel), '000000');
    fireEvent.press(
      screen.getByRole('button', {
        name: i18n.t('send.previewPay', { amount: '4\u00a0500\u00a0FCFA' }),
      }),
    );
    expect(await screen.findByRole('header', { name: fr.send.pendingTitle })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: fr.send.previewSuccessTitle })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.send.checkPayment }));
    await waitFor(() => expect(history).toHaveBeenCalledWith({ limit: 50 }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('header', { name: fr.send.pendingTitle })).toBeOnTheScreen();
  });

  it('n’invente ni référence, ni vérification, ni nouvel envoi après timeout sans identifiant', async () => {
    const services = createSendPreviewServices('unknown');
    const send = jest.spyOn(services.wallet!, 'send');
    const history = jest.spyOn(services.wallet!, 'history');
    const { i18n, onBack } = renderSend(services);
    await enterPin();
    history.mockClear();
    fireEvent.changeText(screen.getByLabelText(fr.send.pinLabel), '000000');
    fireEvent.press(
      screen.getByRole('button', {
        name: i18n.t('send.previewPay', { amount: '4\u00a0500\u00a0FCFA' }),
      }),
    );
    expect(await screen.findByRole('header', { name: fr.send.unknownTitle })).toBeOnTheScreen();
    expect(screen.getByText(fr.send.unknownWithoutId)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: fr.send.checkPayment })).toBeNull();
    expect(screen.queryByLabelText(fr.send.destination)).toBeNull();
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
    expect(screen.queryByText(fr.send.receiptReference)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.send.home }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(history).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('décode le résultat du scanner sans que le scan autorise le paiement', async () => {
    const services = createSendPreviewServices();
    const preview = jest.spyOn(services.wallet!, 'preview');
    const send = jest.spyOn(services.wallet!, 'send');
    renderSend(services);
    await screen.findByLabelText(fr.send.destination);
    fireEvent.press(screen.getByRole('button', { name: fr.send.scan }));
    expect(screen.getByRole('header', { name: fr.send.scanner.title })).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('deliver-fixture-qr'));
    expect(await screen.findByRole('header', { name: fr.send.reviewTitle })).toBeOnTheScreen();
    expect(preview).toHaveBeenCalledWith(sendPreviewInvoice);
    expect(screen.queryByRole('header', { name: fr.send.scanner.title })).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});
