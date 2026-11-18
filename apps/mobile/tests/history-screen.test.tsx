import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  AppState,
  BackHandler,
  Platform,
  SectionList,
  StyleSheet,
  type AppStateStatus,
} from 'react-native';
import * as ReactNative from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HistoryScreen } from '../src/history/HistoryScreen';
import { createHistoryPreviewServices } from '../src/history/preview';
import type { HistoryServices } from '../src/history/ports';
import type { HomeWalletEvent } from '../src/home/ports';
import type { ReceivePlatformPort } from '../src/receive/platform';
import { formatHomeNumber } from '../src/home/format';
import { createAppI18n, TranslationProvider } from '../src/translations';
import { fr } from '../src/translations/fr';
import { BrandTypographyProvider, Button } from '../src/ui';

const initialTime = Date.UTC(2026, 10, 11, 12);
const preview = (scenario: Parameters<typeof createHistoryPreviewServices>[0] = 'ready') =>
  createHistoryPreviewServices(scenario, { now: () => initialTime });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function renderHistory(services: HistoryServices = preview()) {
  const i18n = createAppI18n();
  const callbacks = { onBack: jest.fn(), onRequireUnlock: jest.fn(), onPreview: jest.fn() };
  const effects = {
    share: jest
      .fn<ReturnType<ReceivePlatformPort['share']>, Parameters<ReceivePlatformPort['share']>>()
      .mockResolvedValue('opened'),
  };
  const clock =
    'now' in services && typeof services.now === 'function'
      ? (services.now as () => number)
      : () => initialTime;
  const element = (active: boolean) => (
    <SafeAreaProvider>
      <TranslationProvider i18n={i18n}>
        <BrandTypographyProvider available>
          <HistoryScreen
            services={services}
            active={active}
            clock={clock}
            platform={effects}
            {...callbacks}
          />
        </BrandTypographyProvider>
      </TranslationProvider>
    </SafeAreaProvider>
  );
  const view = render(element(true));
  return {
    ...view,
    ...callbacks,
    effects,
    i18n,
    money: (amount: number) => i18n.t('dashboard.money', { amount: formatHomeNumber(amount) }),
    setActive: (active: boolean) => view.rerender(element(active)),
  };
}
async function ready() {
  await screen.findByRole('header', { name: fr.history.title });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: fr.history.refresh })).toBeEnabled(),
  );
}
async function openIncome() {
  await ready();
  fireEvent.press(screen.getByRole('button', { name: /^Argent reçu \| \+12/ }));
  await screen.findByRole('header', { name: fr.history.previewReceiptTitle });
}
function capturedAction(name: string): () => void {
  const component = screen
    .UNSAFE_getAllByType(Button)
    .find((button) => button.props.label === name);
  if (!component) throw new Error('Action fictive absente');
  return component.props.onPress;
}
async function filter(name: string) {
  fireEvent.press(screen.getByRole('radio', { name }));
  await waitFor(() =>
    expect(screen.getByRole('radio', { name })).toHaveProp('accessibilityState', { checked: true }),
  );
}
function fullAmount(value: string) {
  const text = screen.getByLabelText(value);
  expect(text).toBeOnTheScreen();
  expect(text.props.children.replaceAll('\u200b', '')).toBe(value);
  expect(text.props.numberOfLines).toBeUndefined();
  return text;
}

describe('écran T24 | journal et reçus sans opération financière', () => {
  let originalState: PropertyDescriptor | undefined;
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    originalState = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    if (originalState) Object.defineProperty(AppState, 'currentState', originalState);
  });

  it('explique le service absent sans fabriquer de journal ou de totaux', async () => {
    const view = renderHistory({ mode: 'unavailable' });
    expect(
      await screen.findByRole('header', { name: fr.history.unavailableTitle }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(fr.history.receivedTotal)).toBeNull();
    expect(screen.queryByText(fr.history.preview)).toBeNull();
    expect(view.effects.share).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: fr.history.previewAction }));
    expect(view.onPreview).toHaveBeenCalledTimes(1);
  });
  it('affiche les FCFA reçus du jour et garde les retraits fictifs séparés', async () => {
    const view = renderHistory();
    await ready();
    fullAmount(view.money(20_000));
    expect(screen.getByText(fr.history.dayBasis)).toBeOnTheScreen();
    expect(screen.getByText(fr.history.complete)).toBeOnTheScreen();
    expect(screen.getByText(fr.history.preview)).toBeOnTheScreen();
    await filter(fr.history.filters.simulated);
    expect(screen.getByText(fr.history.simulatedTotal)).toBeOnTheScreen();
    fullAmount(view.money(10_000));
    expect(screen.getByText(fr.history.simulationHint)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Argent reçu \|/ })).toBeNull();
    fullAmount(view.money(20_000));
  });
  it('ouvre un reçu seulement pour une opération réussie et revient à la liste', async () => {
    const view = renderHistory();
    await openIncome();
    expect(screen.getByLabelText('demo-reception-1')).toBeOnTheScreen();
    expect(screen.getByText(fr.history.dateHint)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: fr.history.shareReceipt })).toBeEnabled();
    expect(screen.queryByRole('radio', { name: fr.history.filters.all })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.history.back }));
    await ready();
    expect(view.onBack).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('demo-reception-1')).toBeNull();
  });
  it.each([
    [/^Argent reçu \| \+4/, 'pendingHint' as const],
    [/^Paiement envoyé \| −1/, 'failedHint' as const],
  ])('présente le détail sans reçu de règlement pour %s', async (label, hint) => {
    renderHistory();
    await ready();
    fireEvent.press(screen.getByRole('button', { name: label }));
    expect(await screen.findByRole('header', { name: fr.history.detailTitle })).toBeOnTheScreen();
    expect(screen.getByText(fr.history[hint])).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: fr.history.previewReceiptTitle })).toBeNull();
    expect(screen.getByRole('button', { name: fr.history.shareDetail })).toBeEnabled();
  });
  it('affiche le reçu de retrait comme simulation avec frais et total fictifs', async () => {
    const view = renderHistory();
    await ready();
    await filter(fr.history.filters.simulated);
    fireEvent.press(screen.getByRole('button', { name: /^Retrait Wave \|/ }));
    expect(
      await screen.findByRole('header', { name: fr.history.withdrawalReceiptTitle }),
    ).toBeOnTheScreen();
    expect(screen.getByText(fr.history.withdrawalSuccessHint)).toBeOnTheScreen();
    expect(screen.getByText(view.money(100))).toBeOnTheScreen();
    expect(screen.getByText(view.money(10_100))).toBeOnTheScreen();
    expect(screen.getByText(fr.history.sourceSimulation)).toBeOnTheScreen();
  });
  it('partage uniquement le détail explicite et garde la note privée hors du message', async () => {
    const services = preview();
    const history = services.wallet!.history;
    jest.spyOn(services.wallet!, 'history').mockImplementation(async (options) => {
      const result = await history(options);
      return result.ok
        ? {
            ok: true,
            value: result.value.map((item) => ({
              ...item,
              memo: item.id === 'demo-reception-1' ? 'note-fictive-a-ne-pas-partager' : null,
            })),
          }
        : result;
    });
    const view = renderHistory(services);
    await openIncome();
    expect(screen.getByText('note-fictive-a-ne-pas-partager')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.history.shareReceipt }));
    expect(await screen.findByText(fr.history.shareOpened)).toBeOnTheScreen();
    const message = view.effects.share.mock.calls[0]![0].message;
    expect(message).toContain(fr.history.sharePreviewContext);
    expect(message).toContain(fr.history.succeeded);
    expect(message).toContain('demo-reception-1');
    expect(message).not.toContain('note-fictive-a-ne-pas-partager');
    expect(message).not.toMatch(/lnbcrt|lightning:|pin/i);
  });
  it('un partage de détail en attente rappelle à la fois la simulation et l’absence de règlement', async () => {
    const view = renderHistory();
    await ready();
    fireEvent.press(screen.getByRole('button', { name: /^Argent reçu \| \+4/ }));
    await screen.findByRole('header', { name: fr.history.detailTitle });
    fireEvent.press(screen.getByRole('button', { name: fr.history.shareDetail }));
    await waitFor(() => expect(view.effects.share).toHaveBeenCalledTimes(1));
    expect(view.effects.share.mock.calls[0]![0].message).toContain(fr.history.sharePendingNotice);
    expect(view.effects.share.mock.calls[0]![0].message).toContain(
      fr.history.shareSimulationNotice,
    );
  });
  it.each(['dismissed', 'failed'] as const)(
    'distingue un partage %s du succès du règlement',
    async (result) => {
      const view = renderHistory();
      if (result === 'dismissed') view.effects.share.mockResolvedValueOnce('dismissed');
      else view.effects.share.mockRejectedValueOnce(new Error('partage fictif indisponible'));
      await openIncome();
      fireEvent.press(screen.getByRole('button', { name: fr.history.shareReceipt }));
      expect(
        await screen.findByText(
          result === 'dismissed' ? fr.history.shareDismissed : fr.history.shareFailed,
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('header', { name: fr.history.previewReceiptTitle }),
      ).toBeOnTheScreen();
      expect(screen.queryByText(fr.history.shareOpened)).toBeNull();
    },
  );
  it('protège le partage contre deux appels avant la prochaine mise à jour React', async () => {
    const view = renderHistory();
    const pending = deferred<'opened' | 'dismissed'>();
    view.effects.share.mockReturnValueOnce(pending.promise);
    await openIncome();
    const share = capturedAction(fr.history.shareReceipt);
    await act(async () => {
      share();
      share();
    });
    expect(view.effects.share).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve('opened');
    });
  });
  it('ignore un résultat de partage terminé après le retour à l’historique', async () => {
    const view = renderHistory();
    const pending = deferred<'opened' | 'dismissed'>();
    view.effects.share.mockReturnValueOnce(pending.promise);
    await openIncome();
    fireEvent.press(screen.getByRole('button', { name: fr.history.shareReceipt }));
    fireEvent.press(screen.getByRole('button', { name: fr.history.back }));
    await act(async () => {
      pending.resolve('opened');
    });
    expect(screen.queryByText(fr.history.shareOpened)).toBeNull();
    expect(screen.getByRole('header', { name: fr.history.title })).toBeOnTheScreen();
  });
  it('un ancien bouton ne partage pas une autre opération sélectionnée ensuite', async () => {
    const view = renderHistory();
    await openIncome();
    const staleShare = capturedAction(fr.history.shareReceipt);
    fireEvent.press(screen.getByRole('button', { name: fr.history.back }));
    fireEvent.press(screen.getByRole('button', { name: /^Argent reçu \| \+4/ }));
    await screen.findByRole('header', { name: fr.history.detailTitle });
    await act(async () => staleShare());
    expect(view.effects.share).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: fr.history.shareDetail }));
    await waitFor(() => expect(view.effects.share).toHaveBeenCalledTimes(1));
    expect(view.effects.share.mock.calls[0]![0].message).toContain('demo-attente-1');
  });
  it('le retour Android ferme le détail avant de quitter le journal', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    let hardwareBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, listener) => {
      hardwareBack = listener;
      return { remove: jest.fn() };
    });
    const view = renderHistory();
    await openIncome();
    const event = { type: 'hardwareBackPress', timeStamp: initialTime };
    act(() => expect(hardwareBack!(event)).toBe(true));
    await ready();
    expect(view.onBack).not.toHaveBeenCalled();
    expect(hardwareBack!(event)).toBe(false);
  });
  it('masque le détail hors focus et refuse un ancien callback de partage', async () => {
    const view = renderHistory();
    await openIncome();
    const share = capturedAction(fr.history.shareReceipt);
    view.setActive(false);
    expect(screen.getByRole('header', { name: fr.history.suspended })).toBeOnTheScreen();
    expect(screen.queryByLabelText('demo-reception-1')).toBeNull();
    await act(async () => {
      share();
    });
    expect(view.effects.share).not.toHaveBeenCalled();
    view.setActive(true);
    await ready();
    expect(screen.queryByRole('header', { name: fr.history.previewReceiptTitle })).toBeNull();
  });
  it('masque les informations en arrière-plan et ignore la réponse tardive du partage', async () => {
    const listeners = new Set<(next: AppStateStatus) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
    const view = renderHistory();
    const pending = deferred<'opened' | 'dismissed'>();
    view.effects.share.mockReturnValueOnce(pending.promise);
    await openIncome();
    fireEvent.press(screen.getByRole('button', { name: fr.history.shareReceipt }));
    act(() => listeners.forEach((listener) => listener('background')));
    expect(screen.getByRole('header', { name: fr.history.suspended })).toBeOnTheScreen();
    await act(async () => {
      pending.resolve('opened');
    });
    expect(screen.queryByText(fr.history.shareOpened)).toBeNull();
    act(() => listeners.forEach((listener) => listener('active')));
    await ready();
  });
  it('retire liste et reçu dès le verrouillage sans relancer une lecture sensible', async () => {
    const services = preview();
    let subscriber: ((event: HomeWalletEvent) => void) | undefined;
    const history = jest.spyOn(services.wallet!, 'history');
    jest.spyOn(services.wallet!, 'subscribe').mockImplementation((listener) => {
      subscriber = listener;
      return () => undefined;
    });
    const view = renderHistory(services);
    await openIncome();
    const reads = history.mock.calls.length;
    act(() => subscriber!({ type: 'etat', state: 'verrouille' }));
    expect(screen.getByRole('header', { name: fr.history.lockedTitle })).toBeOnTheScreen();
    expect(screen.queryByLabelText('demo-reception-1')).toBeNull();
    expect(history).toHaveBeenCalledTimes(reads);
    fireEvent.press(screen.getByRole('button', { name: fr.history.unlock }));
    expect(view.onRequireUnlock).toHaveBeenCalledTimes(1);
  });
  it('annonce un total partiel puis la lecture complète après pagination', async () => {
    renderHistory(preview('partial'));
    await ready();
    expect(screen.getByText(fr.history.partial)).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: fr.history.moreWallet }));
    });
    expect(screen.getByText(fr.history.partial)).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: fr.history.moreWallet }));
    });
    expect(await screen.findByText(fr.history.complete)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: fr.history.moreWallet })).toBeNull();
  });
  it('réessaie la page indisponible puis achève la lecture sans perdre les premières opérations', async () => {
    renderHistory(preview('pagingError'));
    await ready();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: fr.history.moreWallet }));
    });
    expect(await screen.findByText(fr.history.walletError)).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: fr.history.retryWallet }));
    });
    await waitFor(() => expect(screen.queryByText(fr.history.walletError)).toBeNull());
    expect(screen.getByRole('button', { name: /^Argent reçu \| \+12/ })).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: fr.history.moreWallet }));
    });
    expect(await screen.findByText(fr.history.complete)).toBeOnTheScreen();
  });
  it('conserve les FCFA inconnus comme inconnus dans le total et le détail', async () => {
    const view = renderHistory(preview('unknownAmounts'));
    await ready();
    fullAmount(view.i18n.t('history.knownAmount', { amount: view.money(5000) }));
    expect(screen.getByText(view.i18n.t('history.unknownCount', { count: 2 }))).toBeOnTheScreen();
    fireEvent.press(screen.getAllByRole('button', { name: /^Argent reçu \| FCFA non connus/ })[0]!);
    await screen.findByRole('header', { name: fr.history.previewReceiptTitle });
    expect(screen.getByText(fr.history.unknownAmount)).toBeOnTheScreen();
    expect(screen.queryByText(view.money(0))).toBeNull();
  });
  it('ne remplace pas le journal des retraits absent par zéro', async () => {
    const services = preview();
    const view = renderHistory({ mode: 'preview', wallet: services.wallet });
    await ready();
    await filter(fr.history.filters.simulated);
    expect(screen.getAllByText(fr.history.withdrawalsUnavailable).length).toBeGreaterThan(0);
    expect(screen.queryByText(view.money(0))).toBeNull();
  });
  it('ne présente pas une source en échec comme un total nul connu', async () => {
    const view = renderHistory(preview('walletError'));
    await ready();
    expect(screen.getByText(fr.history.walletError)).toBeOnTheScreen();
    expect(screen.queryByText(view.money(0))).toBeNull();
    expect(screen.getAllByText(fr.history.unknownAmount).length).toBeGreaterThan(0);
  });
  it('garde les montants complets et les filtres utilisables avec grand texte sur écran étroit', async () => {
    jest
      .spyOn(ReactNative, 'useWindowDimensions')
      .mockReturnValue({ width: 320, height: 640, scale: 1, fontScale: 2 });
    renderHistory(preview('largeAmount'));
    await ready();
    const amount = `+${formatHomeNumber(Number.MAX_SAFE_INTEGER - 3)} FCFA`;
    fullAmount(amount);
    expect(screen.getByText(fr.history.overflow)).toBeOnTheScreen();
    const list = screen.UNSAFE_getByType(SectionList);
    expect(list.props.stickySectionHeadersEnabled).toBe(true);
    for (const name of Object.values(fr.history.filters).filter(
      (value) => value !== fr.history.filters.label,
    )) {
      const target = screen.getByRole('radio', { name });
      const style = StyleSheet.flatten(target.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.height).toBeUndefined();
    }
  });
});
