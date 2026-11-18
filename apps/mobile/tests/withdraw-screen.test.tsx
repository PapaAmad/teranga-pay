import {
  act,
  fireEventAsync,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import {
  AppState,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  type AppStateStatus,
} from 'react-native';
import * as ReactNative from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { formatHomeNumber } from '../src/home/format';
import { createAppI18n, TranslationProvider } from '../src/translations';
import { fr } from '../src/translations/fr';
import { BrandTypographyProvider, Button } from '../src/ui';
import type { WithdrawOperator, WithdrawServices } from '../src/withdraw/ports';
import { createWithdrawPreviewServices } from '../src/withdraw/preview';
import { WithdrawScreen } from '../src/withdraw/WithdrawScreen';

const initialTime = Date.UTC(2026, 10, 11, 12);
const preview = (scenario: Parameters<typeof createWithdrawPreviewServices>[0] = 'ready') =>
  createWithdrawPreviewServices(scenario, { now: () => initialTime });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function renderWithdraw(services: WithdrawServices = preview()) {
  const i18n = createAppI18n();
  const callbacks = { onBack: jest.fn(), onPreview: jest.fn() };
  const clock =
    'now' in services && typeof services.now === 'function'
      ? (services.now as () => number)
      : () => initialTime;
  const element = (active: boolean) => (
    <SafeAreaProvider>
      <TranslationProvider i18n={i18n}>
        <BrandTypographyProvider available>
          <WithdrawScreen services={services} active={active} clock={clock} {...callbacks} />
        </BrandTypographyProvider>
      </TranslationProvider>
    </SafeAreaProvider>
  );
  const view = render(element(true));
  return {
    ...view,
    ...callbacks,
    i18n,
    services,
    money: (amount: number) => i18n.t('dashboard.money', { amount: formatHomeNumber(amount) }),
    setActive: (active: boolean) => view.rerender(element(active)),
  };
}
async function press(name: string) {
  await waitFor(() => expect(screen.getByRole('button', { name })).toBeEnabled());
  await fireEventAsync.press(screen.getByRole('button', { name }));
}
async function choose(operator: WithdrawOperator = 'wave') {
  await screen.findByRole('header', { name: fr.withdraw.chooseTitle });
  await press(`Choisir ${operator === 'wave' ? fr.withdraw.wave : fr.withdraw.orange}`);
  await screen.findByLabelText(fr.withdraw.amountLabel);
}
async function amount(value = '2500') {
  await fireEventAsync.changeText(screen.getByLabelText(fr.withdraw.amountLabel), value);
  await waitFor(() =>
    expect(screen.getByLabelText(fr.withdraw.amountLabel)).toHaveProp('value', value),
  );
}
async function review(operator: WithdrawOperator = 'wave', value = '2500') {
  await choose(operator);
  await amount(value);
  await press(fr.withdraw.prepare);
  await screen.findByRole('header', { name: fr.withdraw.reviewTitle });
}
function capturedAction(name: string): () => void {
  const button = screen.UNSAFE_getAllByType(Button).find((node) => node.props.label === name);
  if (!button) throw new Error('Action fictive absente');
  return button.props.onPress;
}
function reference() {
  const node = screen.getByLabelText(/^00000000-0000-4000-8000-/);
  return node.props.accessibilityLabel as string;
}

describe('écran T25 | consentement et reprise d’un retrait simulé', () => {
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

  it('explique le fournisseur absent sans fabriquer de solde et ouvre l’aperçu seulement sur demande', async () => {
    const view = renderWithdraw({ mode: 'unavailable' });
    expect(
      await screen.findByRole('header', { name: fr.withdraw.unavailableTitle }),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(fr.withdraw.amountLabel)).toBeNull();
    expect(screen.queryByText(/Disponible pour la démonstration/)).toBeNull();
    expect(screen.getByText(fr.withdraw.simulationNotice)).toBeOnTheScreen();
    await press(fr.withdraw.previewAction);
    expect(view.onPreview).toHaveBeenCalledTimes(1);
  });

  it.each(['wave', 'orange_money'] as const)(
    'la préparation %s affiche les frais et le total sans confirmer ni demander un PIN',
    async (operator) => {
      const services = preview();
      const quote = jest.spyOn(services.bridge!, 'quote');
      const confirm = jest.spyOn(services.bridge!, 'confirm');
      const view = renderWithdraw(services);
      await review(operator);
      expect(quote).toHaveBeenCalledWith({
        operator,
        recipientId: operator === 'wave' ? 'wave-demo-001' : 'orange-demo-001',
        amountXof: 2500,
      });
      expect(confirm).not.toHaveBeenCalled();
      expect(screen.getByText(fr.withdraw.fees)).toBeOnTheScreen();
      expect(screen.getByLabelText(view.money(100))).toBeOnTheScreen();
      expect(screen.getByText(fr.withdraw.total)).toBeOnTheScreen();
      expect(screen.getByLabelText(view.money(2600))).toBeOnTheScreen();
      expect(screen.getByText(fr.withdraw.simulationHint)).toBeOnTheScreen();
      expect(screen.queryByLabelText(/PIN/i)).toBeNull();
      expect(services.inspect()).toEqual({ reservations: 0, effects: 0 });
      await press(fr.withdraw.confirm);
      expect(
        await screen.findByRole('header', { name: fr.withdraw.successTitle }),
      ).toBeOnTheScreen();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
      expect(screen.getByText(fr.withdraw.succeeded)).toBeOnTheScreen();
    },
  );

  it('ne prépare rien avec un montant vide puis explique une saisie invalide corrigible', async () => {
    const services = preview();
    const quote = jest.spyOn(services.bridge!, 'quote');
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    renderWithdraw(services);
    await choose();
    expect(screen.getByRole('button', { name: fr.withdraw.prepare })).toBeDisabled();
    await amount('0');
    await press(fr.withdraw.prepare);
    expect(await screen.findByText(fr.withdraw.errors.amount)).toBeOnTheScreen();
    expect(quote).not.toHaveBeenCalled();
    await amount('2500');
    await press(fr.withdraw.prepare);
    expect(await screen.findByRole('header', { name: fr.withdraw.reviewTitle })).toBeOnTheScreen();
    expect(screen.queryByText(fr.withdraw.errors.amount)).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('une réponse perdue ne devient pas un échec certain et retrouve le même couple confirmé', async () => {
    const services = preview('lostResponse');
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    renderWithdraw(services);
    await review();
    await press(fr.withdraw.confirm);
    expect(await screen.findByRole('header', { name: fr.withdraw.unknownTitle })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: fr.withdraw.successTitle })).toBeNull();
    expect(screen.queryByRole('header', { name: fr.withdraw.failedTitle })).toBeNull();
    expect(screen.queryByRole('button', { name: fr.withdraw.newRequest })).toBeNull();
    expect(screen.getByText(fr.withdraw.leaveHint)).toBeOnTheScreen();
    expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
    await press(fr.withdraw.recover);
    expect(await screen.findByRole('header', { name: fr.withdraw.successTitle })).toBeOnTheScreen();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[1]).toEqual(confirm.mock.calls[0]);
    expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
  });

  it('reprend un simulateur indisponible avec la même référence après rétablissement', async () => {
    const services = preview('providerUnavailable');
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    const retry = jest.spyOn(services.bridge!, 'retry');
    renderWithdraw(services);
    await review('orange_money');
    await press(fr.withdraw.confirm);
    await screen.findByRole('header', { name: fr.withdraw.unknownTitle });
    const id = reference();
    expect(screen.getByText(fr.withdraw.retryHint)).toBeOnTheScreen();
    expect(services.inspect()).toEqual({ reservations: 1, effects: 0 });
    services.restoreProvider();
    await press(fr.withdraw.retry);
    expect(await screen.findByRole('header', { name: fr.withdraw.successTitle })).toBeOnTheScreen();
    expect(retry).toHaveBeenCalledWith(id);
    expect(reference()).toBe(id);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
  });

  it('une attente ne réussit qu’après vérification du résultat de cette même demande', async () => {
    const services = preview('pending');
    const reconcile = jest.spyOn(services.bridge!, 'reconcile');
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    renderWithdraw(services);
    await review();
    await press(fr.withdraw.confirm);
    expect(await screen.findByRole('header', { name: fr.withdraw.pendingTitle })).toBeOnTheScreen();
    const id = reference();
    expect(screen.queryByRole('button', { name: fr.withdraw.newRequest })).toBeNull();
    services.completePending();
    expect(screen.queryByRole('header', { name: fr.withdraw.successTitle })).toBeNull();
    await press(fr.withdraw.refresh);
    expect(await screen.findByRole('header', { name: fr.withdraw.successTitle })).toBeOnTheScreen();
    expect(reconcile).toHaveBeenCalledWith(id);
    expect(reference()).toBe(id);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('un refus confirmé conserve son détail et exige une nouvelle préparation volontaire', async () => {
    const services = preview('declined');
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    renderWithdraw(services);
    await review();
    await press(fr.withdraw.confirm);
    expect(await screen.findByRole('header', { name: fr.withdraw.failedTitle })).toBeOnTheScreen();
    expect(screen.getByText(fr.withdraw.failedDescription)).toBeOnTheScreen();
    expect(screen.getByText(fr.withdraw.failed)).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: fr.withdraw.successTitle })).toBeNull();
    expect(screen.queryByRole('button', { name: fr.withdraw.retry })).toBeNull();
    await press(fr.withdraw.newRequest);
    expect(await screen.findByRole('header', { name: fr.withdraw.chooseTitle })).toBeOnTheScreen();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(services.inspect()).toEqual({ reservations: 1, effects: 0 });
  });

  it('n’envoie aucun POST de confirmation si l’enregistrement de reprise échoue', async () => {
    const services = preview('journalFailure');
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    renderWithdraw(services);
    await review();
    await press(fr.withdraw.confirm);
    expect(await screen.findByText(fr.withdraw.errors.journal)).toBeOnTheScreen();
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('header', { name: fr.withdraw.successTitle })).toBeNull();
    expect(services.inspect()).toEqual({ reservations: 0, effects: 0 });
  });

  it('une panne du prix revient à la saisie sans réserver ni confirmer', async () => {
    const services = preview('quoteFailure');
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    renderWithdraw(services);
    await choose();
    await amount();
    await press(fr.withdraw.prepare);
    expect(await screen.findByText(fr.withdraw.errors.rate)).toBeOnTheScreen();
    expect(screen.getByLabelText(fr.withdraw.amountLabel)).toHaveProp('value', '2500');
    expect(confirm).not.toHaveBeenCalled();
    expect(services.inspect()).toEqual({ reservations: 0, effects: 0 });
  });

  it('un solde fictif insuffisant ne propose pas la confirmation', async () => {
    const services = preview('emptyBalance');
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    renderWithdraw(services);
    await choose();
    await amount();
    await press(fr.withdraw.prepare);
    expect(await screen.findByText(fr.withdraw.errors.insufficient)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: fr.withdraw.confirm })).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('réessaie vraiment la lecture initiale après une panne réseau corrigée', async () => {
    const services = preview();
    const original = services.bridge!.options;
    const options = jest
      .spyOn(services.bridge!, 'options')
      .mockResolvedValueOnce({ ok: false, error: { code: 'NETWORK_OFFLINE' } })
      .mockImplementation(original);
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    renderWithdraw(services);
    expect(await screen.findByText(fr.withdraw.errors.offline)).toBeOnTheScreen();
    await press(fr.withdraw.retryRead);
    expect(await screen.findByRole('header', { name: fr.withdraw.chooseTitle })).toBeOnTheScreen();
    expect(options).toHaveBeenCalledTimes(2);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('un ancien bouton de confirmation ne confirme pas un devis modifié ensuite', async () => {
    const services = preview();
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    renderWithdraw(services);
    await review();
    const oldConfirm = capturedAction(fr.withdraw.confirm);
    await press(fr.withdraw.edit);
    await amount('10000');
    await press(fr.withdraw.prepare);
    await screen.findByRole('header', { name: fr.withdraw.reviewTitle });
    await act(async () => oldConfirm());
    expect(confirm).not.toHaveBeenCalled();
    await press(fr.withdraw.confirm);
    await screen.findByRole('header', { name: fr.withdraw.successTitle });
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('protège la confirmation contre deux appels avant la prochaine mise à jour React', async () => {
    const services = preview();
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    renderWithdraw(services);
    await review();
    const action = capturedAction(fr.withdraw.confirm);
    await act(async () => {
      action();
      action();
    });
    expect(await screen.findByRole('header', { name: fr.withdraw.successTitle })).toBeOnTheScreen();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
  });

  it('un prix expiré se renouvelle sans confirmer l’ancien et demande une nouvelle lecture', async () => {
    const services = preview();
    const quote = jest.spyOn(services.bridge!, 'quote');
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    renderWithdraw(services);
    await review();
    const stale = capturedAction(fr.withdraw.confirm);
    act(() => {
      services.expireQuote();
      jest.advanceTimersByTime(1000);
    });
    expect(await screen.findByText(fr.withdraw.expiry)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: fr.withdraw.confirm })).toBeNull();
    await press(fr.withdraw.renew);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: fr.withdraw.confirm })).toBeEnabled(),
    );
    await act(async () => stale());
    expect(confirm).not.toHaveBeenCalled();
    expect(quote).toHaveBeenCalledTimes(2);
  });

  it('masque prix et saisie hors focus puis refuse l’ancien callback', async () => {
    const services = preview();
    const confirm = jest.spyOn(services.bridge!, 'confirm');
    const view = renderWithdraw(services);
    await review();
    const stale = capturedAction(fr.withdraw.confirm);
    view.setActive(false);
    expect(screen.getByRole('header', { name: fr.withdraw.suspendedTitle })).toBeOnTheScreen();
    expect(screen.queryByText(fr.withdraw.total)).toBeNull();
    expect(screen.queryByLabelText(fr.withdraw.amountLabel)).toBeNull();
    await act(async () => stale());
    expect(confirm).not.toHaveBeenCalled();
    view.setActive(true);
    await screen.findByRole('header', { name: fr.withdraw.chooseTitle });
    expect(screen.queryByRole('button', { name: fr.withdraw.confirm })).toBeNull();
  });

  it('ignore un devis retardé après perte de focus sans faire réapparaître son prix', async () => {
    const services = preview();
    const original = services.bridge!.quote;
    const entered = deferred<void>();
    const released = deferred<void>();
    jest.spyOn(services.bridge!, 'quote').mockImplementation(async (input) => {
      const result = await original(input);
      entered.resolve();
      await released.promise;
      return result;
    });
    const view = renderWithdraw(services);
    await choose();
    await amount();
    await press(fr.withdraw.prepare);
    await entered.promise;
    view.setActive(false);
    await act(async () => released.resolve());
    expect(screen.getByRole('header', { name: fr.withdraw.suspendedTitle })).toBeOnTheScreen();
    view.setActive(true);
    await screen.findByRole('header', { name: fr.withdraw.chooseTitle });
    expect(screen.queryByText(fr.withdraw.total)).toBeNull();
  });

  it('une confirmation terminée en arrière-plan reste masquée et se retrouve sans second retrait', async () => {
    const listeners = new Set<(value: AppStateStatus) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
    const services = preview();
    const original = services.bridge!.confirm;
    const entered = deferred<void>();
    const released = deferred<void>();
    const confirm = jest.spyOn(services.bridge!, 'confirm').mockImplementation(async (input) => {
      const result = await original(input);
      entered.resolve();
      await released.promise;
      return result;
    });
    renderWithdraw(services);
    await review();
    await press(fr.withdraw.confirm);
    await entered.promise;
    act(() => listeners.forEach((listener) => listener('background')));
    await act(async () => released.resolve());
    expect(screen.getByRole('header', { name: fr.withdraw.suspendedTitle })).toBeOnTheScreen();
    expect(screen.queryByText(fr.withdraw.total)).toBeNull();
    expect(screen.queryByRole('header', { name: fr.withdraw.successTitle })).toBeNull();
    act(() => listeners.forEach((listener) => listener('active')));
    expect(await screen.findByRole('header', { name: fr.withdraw.successTitle })).toBeOnTheScreen();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(services.inspect()).toEqual({ reservations: 1, effects: 1 });
  });

  it('le retour Android retrouve la saisie puis le choix d’opérateur avant de quitter', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    let back: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, listener) => {
      back = listener;
      return { remove: jest.fn() };
    });
    const view = renderWithdraw();
    await review();
    const event = { type: 'hardwareBackPress', timeStamp: initialTime };
    act(() => expect(back!(event)).toBe(true));
    expect(screen.getByLabelText(fr.withdraw.amountLabel)).toHaveProp('value', '2500');
    act(() => expect(back!(event)).toBe(true));
    expect(screen.getByRole('header', { name: fr.withdraw.chooseTitle })).toBeOnTheScreen();
    expect(view.onBack).not.toHaveBeenCalled();
  });

  it('garde montant entier, choix et action fixe lisibles à 320 pixels avec texte agrandi', async () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 2,
    });
    const services = preview();
    jest.spyOn(services.bridge!, 'balance').mockResolvedValue({
      ok: true,
      value: { simulation: true, availableSats: 20_000_000, heldSats: 0 },
    });
    const view = renderWithdraw(services);
    await screen.findByRole('header', { name: fr.withdraw.chooseTitle });
    for (const name of [`Choisir ${fr.withdraw.wave}`, `Choisir ${fr.withdraw.orange}`]) {
      const style = StyleSheet.flatten(screen.getByRole('button', { name }).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
    await review('wave', '5000000');
    for (const node of screen.getAllByLabelText(view.money(5_000_000))) {
      expect(node.props.children.replaceAll('\u200b', '')).toBe(view.money(5_000_000));
      expect(node.props.numberOfLines).toBeUndefined();
    }
    expect(screen.getByRole('button', { name: fr.withdraw.confirm })).toBeEnabled();
    const scroll = screen.UNSAFE_getByType(ScrollView);
    expect(within(scroll).queryByRole('button', { name: fr.withdraw.confirm })).toBeNull();
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  });
});
