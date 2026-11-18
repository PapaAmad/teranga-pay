import type { ReactNode } from 'react';
import {
  act,
  cleanup,
  fireEventAsync,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createAppI18n, TranslationProvider } from '../src/translations';
import { fr } from '../src/translations/fr';
import { BrandTypographyProvider } from '../src/ui';
import { RecoveryNotice } from '../src/reliability/RecoveryNotice';
import { SendScreen } from '../src/send/SendScreen';
import { createSendPreviewServices } from '../src/send/preview';
import { WithdrawScreen } from '../src/withdraw/WithdrawScreen';
import { createWithdrawPreviewServices } from '../src/withdraw/preview';
import { HistoryScreen } from '../src/history/HistoryScreen';
import { createHistoryPreviewServices } from '../src/history/preview';

const back = jest.fn();
function mount(element: ReactNode) {
  return render(
    <SafeAreaProvider>
      <TranslationProvider i18n={createAppI18n()}>
        <BrandTypographyProvider available>{element}</BrandTypographyProvider>
      </TranslationProvider>
    </SafeAreaProvider>,
  );
}
async function press(name: string) {
  await fireEventAsync.press(screen.getByRole('button', { name }));
}
async function expire() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10_000);
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  back.mockClear();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
});
afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('T28 | messages et reprises dans les vrais écrans', () => {
  it('ne déclare pas le téléphone hors ligne sur un délai dépassé', () => {
    mount(<RecoveryNotice code="READ_TIMEOUT" />);
    expect(screen.getByText(fr.reliability.readTitle)).toBeOnTheScreen();
    expect(screen.getByText(fr.reliability.readDescription)).toBeOnTheScreen();
    expect(screen.queryByText(fr.send.offlineTitle)).toBeNull();
  });
  it('ne présente pas une mutation lente comme un échec ni une lecture à rejouer', () => {
    mount(<RecoveryNotice code="OPERATION_SLOW" committed />);
    expect(screen.getByText(fr.reliability.operationTitle)).toBeOnTheScreen();
    expect(screen.queryByText(fr.reliability.readDescription)).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
  it('ne remet pas en doute le résultat financier connu quand seul le journal reste en attente', () => {
    mount(<RecoveryNotice code="JOURNAL_SLOW" committed />);
    expect(screen.getByText(fr.reliability.journalTitle)).toBeOnTheScreen();
    expect(screen.getByText(fr.reliability.journalDescription)).toBeOnTheScreen();
    expect(screen.queryByText(fr.reliability.operationTitle)).toBeNull();
  });
  it('sort de la lecture de demande muette, conserve la saisie et permet de la vérifier à nouveau', async () => {
    const services = createSendPreviewServices('slowRead');
    const send = jest.spyOn(services.wallet!, 'send');
    const read = jest.spyOn(services.wallet!, 'preview');
    mount(
      <SendScreen
        services={services}
        onBack={back}
        onRequireUnlock={back}
        previewDestination="lnbcrt1exemplefictifnonpayable"
      />,
    );
    await screen.findByLabelText(fr.send.destination);
    await press(fr.send.previewFill);
    await expire();
    expect(screen.getByText(fr.reliability.readTitle)).toBeOnTheScreen();
    expect(screen.getByLabelText(fr.send.destination)).toHaveProp(
      'value',
      'lnbcrt1exemplefictifnonpayable',
    );
    expect(screen.getByRole('button', { name: fr.send.continue })).toBeEnabled();
    expect(send).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
    await act(async () => {
      services.setScenario('success');
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: fr.send.continue })).toBeEnabled(),
    );
    await press(fr.send.continue);
    expect(await screen.findByRole('header', { name: fr.send.reviewTitle })).toBeOnTheScreen();
    expect(send).not.toHaveBeenCalled();
  });
  it('permet de quitter un retrait sans réponse, puis intègre la réponse originale sans deuxième retrait', async () => {
    const services = createWithdrawPreviewServices('slowConfirm');
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    mount(<WithdrawScreen services={services} onBack={back} clock={services.now} />);
    await screen.findByRole('header', { name: fr.withdraw.chooseTitle });
    await press('Choisir Wave');
    await fireEventAsync.changeText(screen.getByLabelText(fr.withdraw.amountLabel), '2500');
    await press(fr.withdraw.prepare);
    await screen.findByRole('header', { name: fr.withdraw.reviewTitle });
    await press(fr.withdraw.confirm);
    await expire();
    expect(screen.getByRole('header', { name: fr.withdraw.unknownTitle })).toBeOnTheScreen();
    expect(screen.getByText(fr.reliability.operationDescription)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: fr.withdraw.retry })).toBeNull();
    expect(screen.queryByRole('button', { name: fr.withdraw.newRequest })).toBeNull();
    expect(screen.getByRole('button', { name: fr.withdraw.done })).toBeEnabled();
    expect(confirm).toHaveBeenCalledTimes(1);
    await act(async () => services.completeSlowConfirm());
    expect(await screen.findByRole('header', { name: fr.withdraw.successTitle })).toBeOnTheScreen();
    expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
    expect(confirm).toHaveBeenCalledTimes(1);
  });
  it('le bouton de reprise d’une page expirée reprend son curseur sans recharger la première page', async () => {
    const services = createHistoryPreviewServices('partial');
    const history = jest.spyOn(services.wallet!, 'history');
    mount(
      <HistoryScreen
        services={services}
        onBack={back}
        onRequireUnlock={back}
        clock={services.now}
      />,
    );
    await screen.findByRole('button', { name: fr.history.moreWallet });
    history.mockImplementationOnce(() => new Promise<never>(() => {}));
    await press(fr.history.moreWallet);
    await expire();
    expect(screen.getByText(fr.reliability.readTitle)).toBeOnTheScreen();
    const previous = history.mock.calls.at(-1)![0];
    expect(previous?.before).toBeTruthy();
    await press(fr.history.retryWallet);
    await waitFor(() => expect(history).toHaveBeenCalledTimes(3));
    expect(history.mock.calls.at(-1)![0]).toEqual(previous);
  });
});
