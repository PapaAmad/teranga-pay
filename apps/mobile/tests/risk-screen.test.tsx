import { act, fireEventAsync, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, ScrollView, StyleSheet, Text, type AppStateStatus } from 'react-native';
import * as ReactNative from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RiskAssessment, RiskCheck, RiskReasonCode } from '../src/risk/ports';
import { SendScreen } from '../src/send/SendScreen';
import type { SendServices } from '../src/send/ports';
import { createSendPreviewServices, sendPreviewInvoice } from '../src/send/preview';
import { createAppI18n, TranslationProvider } from '../src/translations';
import { fr } from '../src/translations/fr';
import { BrandTypographyProvider } from '../src/ui';

jest.mock('../src/send/QrScanner', () => ({ QrScanner: () => null }));

const warning: RiskAssessment = {
  score: 60,
  level: 'eleve',
  confirmationRequired: true,
  reasons: [
    { code: 'NOUVEAU_DESTINATAIRE', points: 30 },
    { code: 'MONTANT_INHABITUEL', points: 30 },
  ],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(response: unknown = warning) {
  const base = createSendPreviewServices();
  const check = jest.fn<Promise<unknown>, [RiskCheck]>(async () => response);
  const services: SendServices = { ...base, risk: { check } };
  const send = jest.spyOn(services.wallet!, 'send');
  return { services, send, check };
}
function renderSend(services: SendServices) {
  const i18n = createAppI18n();
  const onBack = jest.fn();
  const element = (active: boolean) => (
    <SafeAreaProvider>
      <TranslationProvider i18n={i18n}>
        <BrandTypographyProvider available>
          <SendScreen
            services={services}
            onBack={onBack}
            onRequireUnlock={jest.fn()}
            active={active}
          />
        </BrandTypographyProvider>
      </TranslationProvider>
    </SafeAreaProvider>
  );
  const view = render(element(true));
  return { ...view, i18n, onBack, setActive: (active: boolean) => view.rerender(element(active)) };
}
async function analyse() {
  await screen.findByLabelText(fr.send.destination);
  await fireEventAsync.changeText(screen.getByLabelText(fr.send.destination), sendPreviewInvoice);
  await fireEventAsync.press(screen.getByRole('button', { name: fr.send.continue }));
  await screen.findByRole('header', { name: fr.send.reviewTitle });
  await fireEventAsync.press(screen.getByRole('button', { name: fr.send.confirm }));
}
async function warningScreen() {
  await analyse();
  await screen.findByRole('header', { name: fr.risk.warningTitle });
}

describe('T27 | décisions visibles avant l’envoi', () => {
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

  it('relie les motifs traduits à la demande et garde annulation et continuation accessibles', async () => {
    const test = fixture();
    renderSend(test.services);
    await warningScreen();
    expect(screen.getByText(fr.risk.reasons.NOUVEAU_DESTINATAIRE)).toBeOnTheScreen();
    expect(screen.getByText(fr.risk.reasons.MONTANT_INHABITUEL)).toBeOnTheScreen();
    expect(screen.getByText(fr.risk.explanation)).toBeOnTheScreen();
    expect(screen.getByText(fr.risk.advice)).toBeOnTheScreen();
    expect(screen.getByText(fr.risk.privacy)).toBeOnTheScreen();
    expect(screen.getByText('4\u00a0500\u00a0FCFA')).toBeOnTheScreen();
    expect(screen.getByText('4\u00a0545\u00a0FCFA')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: fr.risk.cancel })).toBeEnabled();
    expect(screen.getByRole('button', { name: fr.risk.continue })).toBeEnabled();
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
    expect(test.send).not.toHaveBeenCalled();
  });

  it('affiche les sept motifs connus en français sans insérer de texte distant', async () => {
    const codes = Object.keys(fr.risk.reasons) as RiskReasonCode[];
    const test = fixture({
      ...warning,
      score: 100,
      reasons: codes.map((code) => ({ code, points: 10 })),
      message: 'texte-distant-interdit',
    });
    renderSend(test.services);
    await warningScreen();
    for (const code of codes) expect(screen.getByText(fr.risk.reasons[code])).toBeOnTheScreen();
    expect(screen.queryByText('texte-distant-interdit')).toBeNull();
    expect(screen.queryByText('100')).toBeNull();
    expect(test.send).not.toHaveBeenCalled();
  });

  it('demande un nouveau code et un appui final après la décision de continuer', async () => {
    const test = fixture();
    const view = renderSend(test.services);
    await warningScreen();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.risk.continue }));
    expect(await screen.findByLabelText(fr.send.pinLabel)).toHaveProp('value', '');
    expect(screen.getByText(fr.risk.pinNotice)).toBeOnTheScreen();
    const payName = view.i18n.t('send.previewPay', { amount: '4\u00a0500\u00a0FCFA' });
    expect(screen.getByRole('button', { name: payName })).toBeDisabled();
    await fireEventAsync.changeText(screen.getByLabelText(fr.send.pinLabel), '000');
    expect(screen.getByRole('button', { name: payName })).toBeDisabled();
    await fireEventAsync.changeText(screen.getByLabelText(fr.send.pinLabel), '000000');
    expect(screen.getByRole('button', { name: payName })).toBeEnabled();
    expect(test.send).not.toHaveBeenCalled();
    await fireEventAsync.press(screen.getByRole('button', { name: payName }));
    expect(
      await screen.findByRole('header', { name: fr.send.previewSuccessTitle }),
    ).toBeOnTheScreen();
    expect(test.send).toHaveBeenCalledTimes(1);
  });

  it('annule et revient sans payer ni garder une demande autorisée', async () => {
    const test = fixture();
    const view = renderSend(test.services);
    await warningScreen();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.risk.cancel }));
    expect(view.onBack).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText(fr.send.destination)).toHaveProp('value', '');
    expect(screen.queryByText(fr.risk.reasons.NOUVEAU_DESTINATAIRE)).toBeNull();
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
    expect(test.send).not.toHaveBeenCalled();
  });

  it('la vérification en cours reste annulable, sans continuation anticipée', async () => {
    const response = deferred<unknown>();
    const test = fixture();
    test.check.mockReturnValue(response.promise);
    const view = renderSend(test.services);
    await analyse();
    expect(await screen.findByRole('header', { name: fr.risk.checkingTitle })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: fr.risk.cancel })).toBeEnabled();
    expect(screen.queryByRole('button', { name: fr.risk.continue })).toBeNull();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.risk.cancel }));
    await act(async () => response.resolve(warning));
    expect(view.onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('header', { name: fr.risk.warningTitle })).toBeNull();
    expect(test.send).not.toHaveBeenCalled();
  });

  it('une analyse indisponible reste distincte d’un résultat favorable et offre un réessai', async () => {
    const test = fixture();
    test.check.mockRejectedValueOnce(new Error('detail-technique-a-masquer'));
    renderSend(test.services);
    await analyse();
    expect(
      (await screen.findAllByRole('header', { name: fr.risk.unavailableTitle }))[0],
    ).toBeOnTheScreen();
    expect(screen.getByText(fr.risk.unavailableDescription)).toBeOnTheScreen();
    expect(screen.getByText(fr.risk.unavailableAdvice)).toBeOnTheScreen();
    expect(screen.queryByText('detail-technique-a-masquer')).toBeNull();
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
    expect(screen.getByRole('button', { name: fr.risk.continueUnavailable })).toBeEnabled();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.risk.retry }));
    expect(await screen.findByRole('header', { name: fr.risk.warningTitle })).toBeOnTheScreen();
    expect(test.check).toHaveBeenCalledTimes(2);
    expect(test.send).not.toHaveBeenCalled();
  });

  it('continuer sans analyse n’effectue aucun paiement avant le code et l’accord final', async () => {
    const test = fixture();
    delete test.services.risk;
    const view = renderSend(test.services);
    await analyse();
    await screen.findAllByRole('header', { name: fr.risk.unavailableTitle });
    await fireEventAsync.press(screen.getByRole('button', { name: fr.risk.continueUnavailable }));
    expect(await screen.findByLabelText(fr.send.pinLabel)).toHaveProp('value', '');
    expect(screen.getByText(fr.risk.pinUnavailableNotice)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: view.i18n.t('send.previewPay', { amount: '4\u00a0500\u00a0FCFA' }),
      }),
    ).toBeDisabled();
    expect(test.check).not.toHaveBeenCalled();
    expect(test.send).not.toHaveBeenCalled();
  });

  it('retire motifs et code après perte de focus, puis exige une nouvelle analyse', async () => {
    const test = fixture();
    const view = renderSend(test.services);
    await warningScreen();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.risk.continue }));
    await fireEventAsync.changeText(screen.getByLabelText(fr.send.pinLabel), '000000');
    view.setActive(false);
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
    expect(screen.queryByText(fr.risk.reasons.NOUVEAU_DESTINATAIRE)).toBeNull();
    expect(screen.queryByText('4\u00a0500\u00a0FCFA')).toBeNull();
    view.setActive(true);
    expect(await screen.findByLabelText(fr.send.destination)).toHaveProp('value', '');
    await warningScreen();
    expect(test.check).toHaveBeenCalledTimes(2);
    expect(test.send).not.toHaveBeenCalled();
  });

  it('ignore la réponse d’alerte si l’application est passée en arrière-plan', async () => {
    const listeners = new Set<(state: AppStateStatus) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      listeners.add(callback);
      return { remove: () => listeners.delete(callback) };
    });
    const test = fixture();
    const response = deferred<unknown>();
    test.check.mockReturnValue(response.promise);
    renderSend(test.services);
    await analyse();
    act(() => listeners.forEach((callback) => callback('background')));
    await act(async () => response.resolve(warning));
    expect(screen.getByRole('header', { name: fr.send.suspendedTitle })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: fr.risk.warningTitle })).toBeNull();
    expect(screen.queryByRole('button', { name: fr.risk.continue })).toBeNull();
    expect(test.send).not.toHaveBeenCalled();
  });

  it('garde les choix hors du défilement et les textes sans limite à grande police', async () => {
    jest
      .spyOn(ReactNative, 'useWindowDimensions')
      .mockReturnValue({ width: 360, height: 640, scale: 1, fontScale: 2 });
    const test = fixture();
    renderSend(test.services);
    await warningScreen();
    const scroller = screen.UNSAFE_getByType(ScrollView);
    for (const title of [fr.risk.cancel, fr.risk.continue]) {
      const button = screen.getByRole('button', { name: title });
      let ancestor = button.parent;
      while (ancestor && ancestor !== scroller) ancestor = ancestor.parent;
      expect(ancestor).toBeNull();
      const style = StyleSheet.flatten(button.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
    for (const node of screen.UNSAFE_getAllByType(Text)) {
      if (
        typeof node.props.children === 'string' &&
        Object.values(fr.risk.reasons).includes(node.props.children)
      ) {
        expect(node.props.numberOfLines).toBeUndefined();
        expect(node.props.allowFontScaling).not.toBe(false);
      }
    }
    expect(test.send).not.toHaveBeenCalled();
  });

  it('garde le repli français tant que le catalogue wolof reste vide', async () => {
    const test = fixture();
    const view = renderSend(test.services);
    await act(async () => {
      await view.i18n.changeLanguage('wo');
    });
    await warningScreen();
    expect(screen.getByText(fr.risk.reasons.MONTANT_INHABITUEL)).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: fr.risk.cancel })).toBeEnabled());
    expect(screen.queryByText('risk.warningTitle')).toBeNull();
  });
});
