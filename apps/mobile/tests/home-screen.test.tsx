import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppState, ScrollView, StyleSheet, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import App from '../App';
import { HomeScreen } from '../src/home/HomeScreen';
import type { HomeBalance, HomeResult, HomeServices } from '../src/home/ports';
import { createHomePreviewServices } from '../src/home/preview';
import { createAppI18n, TranslationProvider } from '../src/translations';
import { fr } from '../src/translations/fr';
import { BrandTypographyProvider } from '../src/ui';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 })),
}));

const mockWindowDimensions = jest.requireMock(
  'react-native/Libraries/Utilities/useWindowDimensions',
).default as jest.Mock;

const date = '2026-11-09T12:00:00.000Z';
const exampleAmount = '45\u00a0000';
const exampleSats = '100\u00a0000 sats';
const exampleMoney = `${exampleAmount} FCFA`;

function preview() {
  return createHomePreviewServices('ready', { now: () => new Date(date) });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderHome(services: HomeServices = preview()) {
  const i18n = createAppI18n();
  const callbacks = {
    onAbout: jest.fn(),
    onDesign: jest.fn(),
    onRequireUnlock: jest.fn(),
    onExitPreview: jest.fn(),
  };
  render(
    <SafeAreaProvider>
      <TranslationProvider i18n={i18n}>
        <BrandTypographyProvider available>
          <HomeScreen services={services} {...callbacks} />
        </BrandTypographyProvider>
      </TranslationProvider>
    </SafeAreaProvider>,
  );
  return { services, i18n, ...callbacks };
}

describe('accueil T16 | montants et actions', () => {
  let originalAppState: PropertyDescriptor | undefined;

  beforeEach(() => {
    mockWindowDimensions.mockClear();
    mockWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
    // Expo remplace cet attribut natif par une fonction dans son preset.
    originalAppState = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalAppState) Object.defineProperty(AppState, 'currentState', originalAppState);
  });

  it('distingue le montant en attente du solde disponible et le masque avec les autres montants', async () => {
    const services = preview();
    const original = await services.wallet!.balance();
    if (!original.ok) throw new Error('Fixture de solde indisponible');
    jest.spyOn(services.wallet!, 'balance').mockResolvedValue({
      ok: true,
      value: { ...original.value, spendableSats: 0, spendableXof: 0, pendingSats: 10_000 },
    });
    renderHome(services);
    expect(await screen.findByLabelText('0 FCFA')).toBeOnTheScreen();
    const pending = 'En attente | 4\u00a0500 FCFA';
    expect(screen.getByText(pending)).toBeOnTheScreen();
    expect(screen.getByText('10\u00a0000 sats')).toBeOnTheScreen();
    expect(screen.getByText(fr.dashboard.pendingDescription)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.hide }));
    expect(screen.queryByText(pending)).toBeNull();
    expect(screen.queryByText('10\u00a0000 sats')).toBeNull();
    expect(screen.queryByText(fr.dashboard.pendingDescription)).toBeNull();
  });

  it('ne fabrique pas une conversion des montants en attente sans taux', async () => {
    const services = preview();
    const original = await services.wallet!.balance();
    if (!original.ok) throw new Error('Fixture de solde indisponible');
    jest.spyOn(services.wallet!, 'balance').mockResolvedValue({
      ok: true,
      value: { ...original.value, rate: null, spendableXof: null, pendingSats: 10_000 },
    });
    renderHome(services);
    expect(await screen.findByText('En attente | Non disponible')).toBeOnTheScreen();
    expect(screen.getByText('10\u00a0000 sats')).toBeOnTheScreen();
    expect(screen.queryByText('En attente | 0 FCFA')).toBeNull();
  });

  it('une lecture de l’état échouée quitte aussi le libellé de chargement', async () => {
    const services = preview();
    jest.spyOn(services.wallet!, 'state').mockRejectedValue(new Error('échec fictif'));
    renderHome(services);
    await screen.findByText(fr.dashboard.failedTitle);
    expect(screen.getByText(fr.dashboard.wallet.unavailable)).toBeOnTheScreen();
    expect(screen.queryByText(fr.dashboard.loading)).toBeNull();
  });

  it('un historique disponible peut être révélé même si le solde échoue au retour', async () => {
    const listeners = new Set<(state: AppStateStatus) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listeners.add(handler);
      return { remove: () => listeners.delete(handler) };
    });
    const services = preview();
    renderHome(services);
    await screen.findByLabelText(exampleMoney);
    act(() => listeners.forEach((listener) => listener('background')));
    jest.spyOn(services.wallet!, 'balance').mockResolvedValue({
      ok: false,
      error: { code: 'READ_FAILED' },
    });
    await act(async () => listeners.forEach((listener) => listener('active')));
    const show = screen.getByRole('button', { name: fr.dashboard.show });
    await waitFor(() => expect(show).toBeEnabled());
    expect(screen.queryByText('+25\u00a0000 FCFA')).toBeNull();
    fireEvent.press(show);
    expect(screen.getByText('+25\u00a0000 FCFA')).toBeOnTheScreen();
    expect(screen.queryByLabelText(exampleMoney)).toBeNull();
  });

  it('présente le solde FCFA estimatif, les sats et les trois opérations fictives avec leur état', async () => {
    renderHome();
    expect(await screen.findByLabelText(exampleMoney)).toBeOnTheScreen();
    expect(screen.getByText(fr.dashboard.balanceLabel)).toBeOnTheScreen();
    expect(screen.getByText(exampleSats)).toBeOnTheScreen();
    expect(screen.getByText(fr.dashboard.preview)).toBeOnTheScreen();
    expect(screen.getByText('+25\u00a0000 FCFA')).toBeOnTheScreen();
    expect(screen.getByText('2\u00a0500 FCFA')).toBeOnTheScreen();
    expect(screen.getByText('5\u00a0000 FCFA')).toBeOnTheScreen();
    for (const status of [
      fr.dashboard.payment.succeeded,
      fr.dashboard.payment.pending,
      fr.dashboard.payment.failed,
    ]) {
      expect(screen.getByText(new RegExp(`\\|\\s${status}$`))).toBeOnTheScreen();
    }
    expect(screen.getAllByText(fr.dashboard.payment.sent)).toHaveLength(2);
    expect(screen.getByRole('header', { name: fr.dashboard.recent })).toBeOnTheScreen();
  });

  it('explique la provenance du taux sans promettre de prix de paiement ou retrait', async () => {
    renderHome();
    await screen.findByLabelText(exampleMoney);
    const explain = screen.getByRole('button', { name: fr.dashboard.rateExplain });
    expect(explain).toHaveProp('accessibilityState', { expanded: false });
    fireEvent.press(explain);
    expect(screen.getByRole('button', { name: fr.dashboard.rateExplain })).toHaveProp(
      'accessibilityState',
      { expanded: true },
    );
    expect(screen.getByText(fr.dashboard.rateDescription)).toBeOnTheScreen();
    expect(screen.getByText(fr.dashboard.rateFixed)).toBeOnTheScreen();
    expect(screen.getByText('1 BTC = 45\u00a0000\u00a0000 FCFA')).toBeOnTheScreen();
  });

  it('masque aussi les montants des opérations et leurs libellés accessibles', async () => {
    renderHome();
    await screen.findByLabelText(exampleMoney);
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.hide }));
    expect(screen.getByLabelText(fr.dashboard.hidden)).toBeOnTheScreen();
    for (const amount of [
      exampleAmount,
      exampleSats,
      '+25\u00a0000 FCFA',
      '2\u00a0500 FCFA',
      '5\u00a0000 FCFA',
    ]) {
      expect(screen.queryByText(amount)).toBeNull();
    }
    expect(screen.queryByLabelText(exampleMoney)).toBeNull();
    expect(screen.getAllByText(fr.dashboard.hiddenValue)).toHaveLength(4);
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.show }));
    expect(screen.getByLabelText(exampleMoney)).toBeOnTheScreen();
    expect(screen.getByText('+25\u00a0000 FCFA')).toBeOnTheScreen();
  });

  it.each(['unavailable', 'absent', 'verrouille'] as const)(
    'un portefeuille %s ne produit pas un faux zéro et désactive les paiements',
    async (state) => {
      const services: HomeServices =
        state === 'unavailable' ? { mode: 'unavailable' } : { ...preview(), mode: 'native' };
      if (services.wallet && state !== 'unavailable') {
        jest.spyOn(services.wallet, 'state').mockResolvedValue(state);
      }
      const { onRequireUnlock } = renderHome(services);
      const message =
        state === 'unavailable'
          ? fr.dashboard.unavailableDescription
          : state === 'absent'
            ? fr.dashboard.absentDescription
            : fr.dashboard.lockedDescription;
      expect(await screen.findByText(message)).toBeOnTheScreen();
      expect(screen.queryByLabelText('0 FCFA')).toBeNull();
      expect(screen.queryByText('0')).toBeNull();
      expect(screen.queryByText(exampleSats)).toBeNull();
      for (const name of Object.values(fr.dashboard.actions)) {
        const action = screen.getByRole('button', { name });
        expect(action).toBeDisabled();
        fireEvent.press(action);
        expect(screen.queryByText(fr.dashboard.actionPreview)).toBeNull();
      }
      if (state !== 'unavailable') {
        fireEvent.press(
          screen.getByRole('button', {
            name: state === 'absent' ? fr.dashboard.create : fr.dashboard.unlock,
          }),
        );
        expect(onRequireUnlock).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('affiche un vrai zéro et un historique vide lorsque le wallet les confirme', async () => {
    renderHome(createHomePreviewServices('empty', { now: () => new Date(date) }));
    expect(await screen.findByLabelText('0 FCFA')).toBeOnTheScreen();
    expect(screen.getByText('0 sats')).toBeOnTheScreen();
    expect(screen.getByText(fr.dashboard.emptyTitle)).toBeOnTheScreen();
    expect(screen.getByText(fr.dashboard.emptyDescription)).toBeOnTheScreen();
    expect(screen.queryByText(fr.dashboard.historyError)).toBeNull();
    expect(screen.queryByText(fr.dashboard.payment.received)).toBeNull();
  });

  it('conserve les sats quand la contre-valeur FCFA est inconnue', async () => {
    renderHome(createHomePreviewServices('rateUnavailable', { now: () => new Date(date) }));
    expect(await screen.findByText(fr.dashboard.rateMissing)).toBeOnTheScreen();
    expect(screen.getByText(exampleSats)).toBeOnTheScreen();
    expect(screen.queryByLabelText(exampleMoney)).toBeNull();
    expect(screen.queryByLabelText('0 FCFA')).toBeNull();
    // Les contre-valeurs historiques connues restent les montants de leurs opérations.
    expect(screen.getByText('+25\u00a0000 FCFA')).toBeOnTheScreen();
  });

  it('ne transforme pas une petite quantité positive de sats en zéro FCFA', async () => {
    const services = preview();
    const read = await services.wallet!.balance();
    if (!read.ok) throw new Error('Fixture de solde indisponible');
    jest.spyOn(services.wallet!, 'balance').mockResolvedValue({
      ok: true,
      value: { ...read.value, spendableSats: 1, spendableXof: 0 },
    });
    renderHome(services);
    expect(await screen.findByText(fr.dashboard.lessThanOne)).toBeOnTheScreen();
    expect(screen.getByText('1 sats')).toBeOnTheScreen();
    expect(screen.queryByLabelText('0 FCFA')).toBeNull();
  });

  it('garde le solde pendant le rafraîchissement et ne le marque ancien qu’après l’échec', async () => {
    const services = preview();
    renderHome(services);
    await screen.findByLabelText(exampleMoney);
    const reading = deferred<HomeResult<HomeBalance>>();
    const balance = jest.spyOn(services.wallet!, 'balance').mockReturnValueOnce(reading.promise);
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.refresh }));
    await waitFor(() => expect(balance).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText(exampleMoney)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: fr.dashboard.refresh })).toBeDisabled();
    expect(screen.queryByText(fr.dashboard.oldBalance)).toBeNull();
    expect(screen.getByText(fr.dashboard.refreshing)).toBeOnTheScreen();
    await act(async () => {
      reading.resolve({ ok: false, error: { code: 'NETWORK_OFFLINE' } });
      await reading.promise;
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: fr.dashboard.refresh })).toBeEnabled(),
    );
    expect(screen.getByLabelText(exampleMoney)).toBeOnTheScreen();
    expect(screen.getByRole('status', { name: fr.dashboard.oldBalance })).toBeOnTheScreen();
    expect(screen.getByText('+25\u00a0000 FCFA')).toBeOnTheScreen();
  });

  it('affiche un échec initial corrigeable sans solde ni liste fabriqués', async () => {
    renderHome(createHomePreviewServices('error'));
    expect(await screen.findByText(fr.dashboard.failedDescription)).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: fr.dashboard.retry }).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('0 FCFA')).toBeNull();
    expect(screen.queryByText(fr.dashboard.emptyTitle)).toBeNull();
    expect(screen.getByText(fr.dashboard.historyError)).toBeOnTheScreen();
  });

  it('permet de relire le solde après son premier échec même si les opérations sont disponibles', async () => {
    const services = preview();
    const balance = jest.spyOn(services.wallet!, 'balance').mockResolvedValueOnce({
      ok: false,
      error: { code: 'NETWORK_OFFLINE' },
    });
    const history = jest.spyOn(services.wallet!, 'history');
    renderHome(services);
    expect(await screen.findByText('+25\u00a0000 FCFA')).toBeOnTheScreen();
    expect(screen.queryByLabelText(exampleMoney)).toBeNull();
    expect(screen.queryByLabelText('0 FCFA')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.retryBalance }));
    expect(await screen.findByLabelText(exampleMoney)).toBeOnTheScreen();
    expect(balance).toHaveBeenCalledTimes(2);
    expect(history).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: fr.dashboard.retryBalance })).toBeNull();
    expect(screen.getByText('+25\u00a0000 FCFA')).toBeOnTheScreen();
  });

  it.each(Object.values(fr.dashboard.actions))(
    'l’action %s ouvre une explication honnête de l’aperçu',
    async (name) => {
      renderHome();
      await screen.findByLabelText(exampleMoney);
      fireEvent.press(screen.getByRole('button', { name }));
      expect(screen.getByRole('header', { name })).toBeOnTheScreen();
      expect(screen.getByText(fr.dashboard.actionPreview)).toBeOnTheScreen();
      fireEvent.press(screen.getByRole('button', { name: fr.dashboard.close }));
      expect(screen.queryByRole('header', { name })).toBeNull();
      expect(screen.queryByText(fr.dashboard.actionPreview)).toBeNull();
    },
  );

  it('une lecture native ne fait pas passer les futures actions pour des paiements intégrés', async () => {
    renderHome({ ...preview(), mode: 'native' });
    await screen.findByLabelText(exampleMoney);
    expect(screen.queryByText(fr.dashboard.preview)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.send }));
    expect(screen.getByText(fr.dashboard.actionUnavailable)).toBeOnTheScreen();
    expect(screen.queryByText(fr.dashboard.actionPreview)).toBeNull();
  });

  it('masque immédiatement les données au passage en arrière-plan et les garde masquées au retour', async () => {
    const listeners = new Set<(state: AppStateStatus) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listeners.add(handler);
      return { remove: () => listeners.delete(handler) };
    });
    renderHome();
    await screen.findByLabelText(exampleMoney);
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.rateExplain }));
    expect(screen.getByText('1 BTC = 45\u00a0000\u00a0000 FCFA')).toBeOnTheScreen();
    act(() => listeners.forEach((listener) => listener('background')));
    expect(screen.queryByLabelText(exampleMoney)).toBeNull();
    expect(screen.queryByText(exampleSats)).toBeNull();
    expect(screen.queryByText('+25\u00a0000 FCFA')).toBeNull();
    expect(screen.queryByText('1 BTC = 45\u00a0000\u00a0000 FCFA')).toBeNull();
    expect(screen.getByRole('button', { name: fr.dashboard.show })).toBeDisabled();
    await act(async () => listeners.forEach((listener) => listener('active')));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: fr.dashboard.show })).toBeEnabled(),
    );
    expect(screen.queryByLabelText(exampleMoney)).toBeNull();
    expect(screen.getByLabelText(fr.dashboard.hidden)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.show }));
    expect(screen.getByLabelText(exampleMoney)).toBeOnTheScreen();
  });

  it('un montage en arrière-plan attend le premier plan puis demande un affichage explicite des montants', async () => {
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'background',
    });
    const listeners = new Set<(state: AppStateStatus) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listeners.add(handler);
      return { remove: () => listeners.delete(handler) };
    });
    const services = preview();
    const state = jest.spyOn(services.wallet!, 'state');
    const balance = jest.spyOn(services.wallet!, 'balance');
    const history = jest.spyOn(services.wallet!, 'history');
    const subscribe = jest.spyOn(services.wallet!, 'subscribe');
    renderHome(services);
    await act(async () => undefined);
    expect(state).not.toHaveBeenCalled();
    expect(balance).not.toHaveBeenCalled();
    expect(history).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(exampleMoney)).toBeNull();
    await act(async () => listeners.forEach((listener) => listener('active')));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: fr.dashboard.show })).toBeEnabled(),
    );
    expect(state).toHaveBeenCalledTimes(1);
    expect(balance).toHaveBeenCalledTimes(1);
    expect(history).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText(exampleMoney)).toBeNull();
    expect(screen.queryByText(exampleSats)).toBeNull();
    expect(screen.queryByText('+25\u00a0000 FCFA')).toBeNull();
    expect(screen.getByLabelText(fr.dashboard.hidden)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.show }));
    expect(screen.getByLabelText(exampleMoney)).toBeOnTheScreen();
    expect(screen.getByText(exampleSats)).toBeOnTheScreen();
    expect(screen.getByText('+25\u00a0000 FCFA')).toBeOnTheScreen();
  });

  it('les commandes restent nommées, défilables et atteignables avec grand texte', async () => {
    mockWindowDimensions.mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 2,
    });
    renderHome();
    await screen.findByLabelText(exampleMoney);
    expect(mockWindowDimensions).toHaveBeenCalled();
    const scroll = screen.UNSAFE_getByType(ScrollView);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({ flexGrow: 1 });
    for (const name of Object.values(fr.dashboard.actions)) {
      const action = within(scroll).getByRole('button', { name });
      expect(action).toBeEnabled();
      const style = StyleSheet.flatten(action.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.height).toBeUndefined();
      expect(style.flexDirection).toBe('row');
    }
    expect(within(scroll).getByRole('header', { name: fr.dashboard.recent })).toBeOnTheScreen();
    expect(within(scroll).getByRole('button', { name: fr.home.aboutAction })).toBeOnTheScreen();
  });

  it('la présentation ouvre l’accueil fictif puis revient sans créer de portefeuille', async () => {
    render(<App initialRoute="About" i18n={createAppI18n()} />);
    await act(async () => {});
    fireEvent.press(await screen.findByRole('button', { name: fr.about.previewAction }));
    expect(await screen.findByLabelText(exampleMoney)).toBeOnTheScreen();
    expect(screen.getByText(fr.dashboard.preview)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.previewExit }));
    expect(await screen.findByRole('header', { name: fr.about.title })).toBeOnTheScreen();
    expect(screen.queryByLabelText(exampleMoney)).toBeNull();
  });
});
