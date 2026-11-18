import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppState, ScrollView, StyleSheet, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { HomeResult, HomeWalletEvent } from '../src/home/ports';
import { ReceiveScreen } from '../src/receive/ReceiveScreen';
import { ReceiveQr } from '../src/receive/ReceiveQr';
import type { ReceivePlatformPort } from '../src/receive/platform';
import type { ReceiveServices } from '../src/receive/ports';
import { createReceivePreviewServices } from '../src/receive/preview';
import { createAppI18n, TranslationProvider } from '../src/translations';
import { fr } from '../src/translations/fr';
import { BrandTypographyProvider } from '../src/ui';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 })),
}));

const mockWindowDimensions = jest.requireMock(
  'react-native/Libraries/Utilities/useWindowDimensions',
).default as jest.Mock;

const address = 'exemple@teranga.example';
const qrLabel = (value = address) => fr.receive.qrLabel.replace('{{address}}', value);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function platform() {
  return {
    copy: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true),
    share: jest
      .fn<ReturnType<ReceivePlatformPort['share']>, Parameters<ReceivePlatformPort['share']>>()
      .mockResolvedValue('opened'),
  };
}

function renderReceive(services: ReceiveServices = createReceivePreviewServices()) {
  const i18n = createAppI18n();
  const effects = platform();
  const callbacks = { onBack: jest.fn(), onRequireUnlock: jest.fn(), onPreview: jest.fn() };
  const element = (active: boolean) => (
    <SafeAreaProvider>
      <TranslationProvider i18n={i18n}>
        <BrandTypographyProvider available>
          <ReceiveScreen services={services} platform={effects} active={active} {...callbacks} />
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
    effects,
    setActive: (active: boolean) => view.rerender(element(active)),
  };
}

function appStateEvents() {
  const listeners = new Set<(state: AppStateStatus) => void>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  });
  return {
    emit: (state: AppStateStatus) => act(() => listeners.forEach((listener) => listener(state))),
    listeners,
  };
}

describe('recevoir T18 | adresse publique et retours honnêtes', () => {
  let originalAppState: PropertyDescriptor | undefined;

  beforeEach(() => {
    mockWindowDimensions.mockClear();
    mockWindowDimensions.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
    // Le preset Expo expose ici une fonction ; les tests posent l'état natif attendu.
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

  it('nomme le QR avec l’adresse exacte et signale que l’aperçu ne peut pas recevoir de paiement', async () => {
    const { effects } = renderReceive();
    expect(await screen.findByLabelText(qrLabel())).toBeOnTheScreen();
    expect(screen.getByLabelText(address)).toBeOnTheScreen();
    expect(screen.getByText(fr.receive.preview)).toBeOnTheScreen();
    expect(screen.getByText(fr.receive.previewHelper)).toBeOnTheScreen();
    expect(screen.getByText(fr.receive.network)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: fr.receive.copy })).toBeEnabled();
    expect(screen.getByRole('button', { name: fr.receive.share })).toBeEnabled();
    expect(effects.copy).not.toHaveBeenCalled();
    expect(effects.share).not.toHaveBeenCalled();
  });

  it('copie l’adresse longue brute, sans les coupures invisibles de sa présentation', async () => {
    const services = createReceivePreviewServices('longAddress');
    const result = await services.address!.current();
    if (!result.ok) throw new Error('Adresse de fixture indisponible');
    const raw = result.value.address;
    const { effects } = renderReceive(services);
    await screen.findByLabelText(qrLabel(raw));
    expect(screen.getByLabelText(raw)).toHaveTextContent(/\u200b/);
    fireEvent.press(screen.getByRole('button', { name: fr.receive.copy }));
    expect(await screen.findByText(fr.receive.copied)).toBeOnTheScreen();
    expect(effects.copy).toHaveBeenCalledTimes(1);
    expect(effects.copy).toHaveBeenCalledWith(raw);
    expect(effects.copy.mock.calls[0]![0]).not.toMatch(/\u200b/);
  });

  it.each(['false', 'reject'] as const)(
    'une copie %s ne confirme jamais un succès',
    async (outcome) => {
      const { effects } = renderReceive();
      if (outcome === 'false') effects.copy.mockResolvedValueOnce(false);
      else effects.copy.mockRejectedValueOnce(new Error('COPY_FAILED'));
      await screen.findByLabelText(qrLabel());
      fireEvent.press(screen.getByRole('button', { name: fr.receive.copy }));
      expect(await screen.findByText(fr.receive.copyFailed)).toBeOnTheScreen();
      expect(screen.queryByText(fr.receive.copied)).toBeNull();
      expect(screen.getByRole('button', { name: fr.receive.copy })).toBeEnabled();
    },
  );

  it.each(['opened', 'dismissed', 'failed'] as const)(
    'un partage %s décrit seulement le résultat du partage et transmet un exemple non payable',
    async (outcome) => {
      const { effects, i18n } = renderReceive();
      if (outcome === 'failed') effects.share.mockRejectedValueOnce(new Error('SHARE_FAILED'));
      else effects.share.mockResolvedValueOnce(outcome);
      await screen.findByLabelText(qrLabel());
      fireEvent.press(screen.getByRole('button', { name: fr.receive.share }));
      const expected =
        outcome === 'opened'
          ? fr.receive.shareOpened
          : outcome === 'dismissed'
            ? fr.receive.shareDismissed
            : fr.receive.shareFailed;
      expect(await screen.findByText(expected)).toBeOnTheScreen();
      expect(effects.share).toHaveBeenCalledWith({
        title: fr.receive.shareTitle,
        message: i18n.t('receive.previewShareMessage', { address }),
      });
      expect(effects.share.mock.calls[0]![0].message).toContain('non payable');
      expect(screen.queryByText(fr.receive.copied)).toBeNull();
      for (const other of [
        fr.receive.shareOpened,
        fr.receive.shareDismissed,
        fr.receive.shareFailed,
      ]) {
        if (other !== expected) expect(screen.queryByText(other)).toBeNull();
      }
      expect(screen.getByRole('button', { name: fr.receive.share })).toBeEnabled();
    },
  );

  it('partage une adresse fournie en mode natif avec le message traduit, sans avertissement fictif', async () => {
    const { effects, i18n } = renderReceive({ ...createReceivePreviewServices(), mode: 'native' });
    await screen.findByLabelText(qrLabel());
    expect(screen.queryByText(fr.receive.preview)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.receive.share }));
    await screen.findByText(fr.receive.shareOpened);
    expect(effects.share).toHaveBeenCalledWith({
      title: fr.receive.shareTitle,
      message: i18n.t('receive.shareMessage', { address }),
    });
  });

  it('un double appui ne lance qu’une copie et bloque le partage pendant cette opération', async () => {
    const pending = deferred<boolean>();
    const { effects } = renderReceive();
    effects.copy.mockReturnValueOnce(pending.promise);
    await screen.findByLabelText(qrLabel());
    const copy = screen.getByRole('button', { name: fr.receive.copy });
    fireEvent.press(copy);
    fireEvent.press(copy);
    expect(effects.copy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: fr.receive.copying })).toBeDisabled();
    const share = screen.getByRole('button', { name: fr.receive.share });
    expect(share).toBeDisabled();
    fireEvent.press(share);
    expect(effects.share).not.toHaveBeenCalled();
    await act(async () => pending.resolve(true));
    expect(screen.getByText(fr.receive.copied)).toBeOnTheScreen();
  });

  it('un double appui sur Partager n’ouvre qu’une seule feuille', async () => {
    const pending = deferred<'opened' | 'dismissed'>();
    const { effects } = renderReceive();
    effects.share.mockReturnValueOnce(pending.promise);
    await screen.findByLabelText(qrLabel());
    const share = screen.getByRole('button', { name: fr.receive.share });
    fireEvent.press(share);
    fireEvent.press(share);
    expect(effects.share).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: fr.receive.copy })).toBeDisabled();
    await act(async () => pending.resolve('opened'));
    expect(screen.getByText(fr.receive.shareOpened)).toBeOnTheScreen();
  });

  it.each(['copy', 'share'] as const)(
    'un appui %s déjà capturé ne transmet pas l’adresse si le wallet se verrouille avant le rendu suivant',
    async (action) => {
      const services = createReceivePreviewServices();
      let emit!: (event: HomeWalletEvent) => void;
      jest.spyOn(services.wallet!, 'subscribe').mockImplementation((listener) => {
        emit = listener;
        return jest.fn();
      });
      const { effects } = renderReceive(services);
      await screen.findByLabelText(qrLabel());
      const button = screen.getByRole('button', { name: fr.receive[action] });
      expect(button).toBeEnabled();
      let handlerNode = button;
      while (typeof handlerNode.props.onPress !== 'function' && handlerNode.parent) {
        handlerNode = handlerNode.parent;
      }
      const pressBeforeLock = handlerNode.props.onPress as () => void;
      expect(pressBeforeLock).toEqual(expect.any(Function));
      act(() => {
        emit({ type: 'etat', state: 'verrouille' });
        // Même tour JS : le gestionnaire existe encore alors que le port est déjà verrouillé.
        pressBeforeLock();
      });
      expect(effects.copy).not.toHaveBeenCalled();
      expect(effects.share).not.toHaveBeenCalled();
      expect(screen.queryByLabelText(qrLabel())).toBeNull();
      expect(screen.queryByLabelText(address)).toBeNull();
      expect(screen.getByText(fr.receive.lockedDescription)).toBeOnTheScreen();
    },
  );

  it('masque le code en arrière-plan et ignore une confirmation de copie arrivée après ce départ', async () => {
    const events = appStateEvents();
    const pending = deferred<boolean>();
    const { effects } = renderReceive();
    effects.copy.mockReturnValueOnce(pending.promise);
    await screen.findByLabelText(qrLabel());
    fireEvent.press(screen.getByRole('button', { name: fr.receive.copy }));
    events.emit('background');
    expect(screen.queryByLabelText(qrLabel())).toBeNull();
    expect(screen.queryByLabelText(address)).toBeNull();
    expect(screen.queryByRole('button', { name: fr.receive.share })).toBeNull();
    await act(async () => pending.resolve(true));
    expect(screen.queryByText(fr.receive.copied)).toBeNull();
    events.emit('active');
    await screen.findByLabelText(qrLabel());
    expect(screen.queryByText(fr.receive.copied)).toBeNull();
    expect(screen.getByRole('button', { name: fr.receive.copy })).toBeEnabled();
  });

  it('un écran qui perd le focus ignore le résultat tardif du partage après son retour', async () => {
    const pending = deferred<'opened' | 'dismissed'>();
    const { effects, setActive } = renderReceive();
    effects.share.mockReturnValueOnce(pending.promise);
    await screen.findByLabelText(qrLabel());
    fireEvent.press(screen.getByRole('button', { name: fr.receive.share }));
    setActive(false);
    expect(screen.queryByLabelText(qrLabel())).toBeNull();
    expect(screen.queryByLabelText(address)).toBeNull();
    await act(async () => pending.resolve('opened'));
    setActive(true);
    await screen.findByLabelText(qrLabel());
    expect(screen.queryByText(fr.receive.shareOpened)).toBeNull();
    expect(screen.getByRole('button', { name: fr.receive.share })).toBeEnabled();
  });

  it.each(['inactive', 'background'] as const)(
    'un partage qui passe en %s masque l’adresse et exige une nouvelle lecture au retour',
    async (next) => {
      const events = appStateEvents();
      const pending = deferred<'opened' | 'dismissed'>();
      const services = createReceivePreviewServices();
      const read = jest.spyOn(services.address!, 'current');
      const { effects } = renderReceive(services);
      effects.share.mockReturnValueOnce(pending.promise);
      await screen.findByLabelText(qrLabel());
      fireEvent.press(screen.getByRole('button', { name: fr.receive.share }));
      events.emit(next);
      expect(screen.queryByLabelText(qrLabel())).toBeNull();
      expect(screen.queryByLabelText(address)).toBeNull();
      await act(async () => pending.resolve('opened'));
      expect(screen.queryByText(fr.receive.shareOpened)).toBeNull();
      events.emit('active');
      await screen.findByLabelText(qrLabel());
      expect(read).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(fr.receive.shareOpened)).toBeNull();
      expect(screen.getByRole('button', { name: fr.receive.share })).toBeEnabled();
    },
  );

  it('se désabonne au démontage même lorsqu’une copie n’a pas encore répondu', async () => {
    const events = appStateEvents();
    const pending = deferred<boolean>();
    const services = createReceivePreviewServices();
    const release = jest.fn();
    jest.spyOn(services.wallet!, 'subscribe').mockReturnValue(release);
    const { effects, unmount } = renderReceive(services);
    effects.copy.mockReturnValueOnce(pending.promise);
    await screen.findByLabelText(qrLabel());
    fireEvent.press(screen.getByRole('button', { name: fr.receive.copy }));
    unmount();
    await act(async () => pending.resolve(true));
    expect(release).toHaveBeenCalledTimes(1);
    expect(events.listeners.size).toBe(0);
  });

  it('ne lit aucune adresse si le montage a lieu en arrière-plan', async () => {
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'background',
    });
    const events = appStateEvents();
    const services = createReceivePreviewServices();
    const read = jest.spyOn(services.address!, 'current');
    const walletState = jest.spyOn(services.wallet!, 'state');
    renderReceive(services);
    await act(async () => undefined);
    expect(read).not.toHaveBeenCalled();
    expect(walletState).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(qrLabel())).toBeNull();
    events.emit('active');
    expect(await screen.findByLabelText(qrLabel())).toBeOnTheScreen();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it.each(['unavailable', 'absent', 'verrouille'] as const)(
    'un portefeuille %s n’expose ni adresse, ni QR, ni action de copie ou partage',
    async (state) => {
      const services: ReceiveServices =
        state === 'unavailable'
          ? { mode: 'unavailable' }
          : { ...createReceivePreviewServices(), mode: 'native' };
      if (services.wallet && state !== 'unavailable') {
        jest.spyOn(services.wallet, 'state').mockResolvedValue(state);
      }
      const { effects, onRequireUnlock, onPreview } = renderReceive(services);
      const explanation =
        state === 'unavailable'
          ? fr.receive.unavailableDescription
          : state === 'absent'
            ? fr.receive.absentDescription
            : fr.receive.lockedDescription;
      expect(await screen.findByText(explanation)).toBeOnTheScreen();
      expect(screen.queryByLabelText(qrLabel())).toBeNull();
      expect(screen.queryByLabelText(address)).toBeNull();
      expect(screen.queryByRole('button', { name: fr.receive.copy })).toBeNull();
      expect(screen.queryByRole('button', { name: fr.receive.share })).toBeNull();
      if (state === 'unavailable') {
        fireEvent.press(screen.getByRole('button', { name: fr.receive.previewAction }));
        expect(onPreview).toHaveBeenCalledTimes(1);
      } else {
        fireEvent.press(
          screen.getByRole('button', {
            name: state === 'absent' ? fr.receive.create : fr.receive.unlock,
          }),
        );
        expect(onRequireUnlock).toHaveBeenCalledTimes(1);
      }
      expect(effects.copy).not.toHaveBeenCalled();
      expect(effects.share).not.toHaveBeenCalled();
    },
  );

  it('une lecture initiale en attente montre un état de chargement, jamais un QR de substitution', async () => {
    const services = createReceivePreviewServices('loading');
    renderReceive(services);
    expect(await screen.findByText(fr.receive.loading)).toBeOnTheScreen();
    expect(screen.queryByLabelText(qrLabel())).toBeNull();
    expect(screen.queryByLabelText(address)).toBeNull();
    expect(screen.queryByRole('button', { name: fr.receive.copy })).toBeNull();
    expect(screen.queryByRole('button', { name: fr.receive.share })).toBeNull();
    await act(async () => services.setScenario('ready'));
    expect(await screen.findByLabelText(qrLabel())).toBeOnTheScreen();
  });

  it('une adresse réellement fournie reste copiable et partageable hors ligne avec son avertissement', async () => {
    const { effects } = renderReceive({
      ...createReceivePreviewServices('offline'),
      mode: 'native',
    });
    await screen.findByLabelText(qrLabel());
    expect(screen.getByText(fr.receive.offline)).toBeOnTheScreen();
    expect(screen.getByText(fr.receive.offlineDescription)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.receive.copy }));
    await screen.findByText(fr.receive.copied);
    fireEvent.press(screen.getByRole('button', { name: fr.receive.share }));
    await screen.findByText(fr.receive.shareOpened);
    expect(effects.copy).toHaveBeenCalledWith(address);
    expect(effects.share).toHaveBeenCalledTimes(1);
  });

  it('une première lecture hors ligne échouée ne prétend pas qu’une adresse peut être partagée', async () => {
    const services = { ...createReceivePreviewServices('offline'), mode: 'native' as const };
    jest.spyOn(services.address!, 'current').mockResolvedValue({
      ok: false,
      error: { code: 'NETWORK_OFFLINE' },
    });
    const { effects } = renderReceive(services);
    expect(await screen.findByText(fr.receive.errorDescription)).toBeOnTheScreen();
    expect(screen.queryByText(fr.receive.offlineDescription)).toBeNull();
    expect(screen.queryByLabelText(qrLabel())).toBeNull();
    expect(screen.queryByRole('button', { name: fr.receive.copy })).toBeNull();
    expect(screen.queryByRole('button', { name: fr.receive.share })).toBeNull();
    expect(effects.copy).not.toHaveBeenCalled();
    expect(effects.share).not.toHaveBeenCalled();
  });

  it('une adresse externe invalide ne devient jamais un QR ou une destination copiable', async () => {
    const services = createReceivePreviewServices();
    jest.spyOn(services.address!, 'current').mockResolvedValue({
      ok: true,
      value: { address: 'https://teranga.example/secret' },
    });
    const { effects } = renderReceive(services);
    expect(await screen.findByText(fr.receive.errorDescription)).toBeOnTheScreen();
    expect(screen.queryByLabelText(qrLabel('https://teranga.example/secret'))).toBeNull();
    expect(screen.queryByText('https://teranga.example/secret')).toBeNull();
    expect(screen.queryByRole('button', { name: fr.receive.copy })).toBeNull();
    expect(screen.queryByRole('button', { name: fr.receive.share })).toBeNull();
    expect(effects.copy).not.toHaveBeenCalled();
  });

  it('une relecture échouée masque l’ancien QR et bloque la copie et le partage de l’adresse précédente', async () => {
    const services = { ...createReceivePreviewServices(), mode: 'native' as const };
    const pending = deferred<HomeResult<{ address: string }>>();
    const read = jest.spyOn(services.address!, 'current');
    const { effects } = renderReceive(services);
    await screen.findByLabelText(qrLabel());
    read.mockReturnValueOnce(pending.promise);
    fireEvent.press(screen.getByRole('button', { name: fr.receive.refresh }));
    await screen.findByText(fr.receive.refreshing);
    expect(screen.getByRole('button', { name: fr.receive.copy })).toBeDisabled();
    expect(screen.getByRole('button', { name: fr.receive.share })).toBeDisabled();
    await act(async () => pending.resolve({ ok: false, error: { code: 'READ_FAILED' } }));
    expect(await screen.findByText(fr.receive.previous)).toBeOnTheScreen();
    expect(screen.queryByLabelText(qrLabel())).toBeNull();
    expect(screen.getByText(fr.receive.errorTitle)).toBeOnTheScreen();
    expect(screen.getByText(fr.receive.errorDescription)).toBeOnTheScreen();
    expect(screen.getByLabelText(address)).toBeOnTheScreen();
    for (const name of [fr.receive.copy, fr.receive.share]) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      fireEvent.press(button);
    }
    expect(effects.copy).not.toHaveBeenCalled();
    expect(effects.share).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: fr.receive.retry }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: fr.receive.copy })).toBeEnabled(),
    );
    expect(screen.queryByText(fr.receive.previous)).toBeNull();
  });

  it('une relecture hors ligne échouée masque le QR sans présenter l’adresse précédente comme partageable', async () => {
    const services = { ...createReceivePreviewServices(), mode: 'native' as const };
    const read = jest.spyOn(services.address!, 'current');
    renderReceive(services);
    await screen.findByLabelText(qrLabel());
    read.mockResolvedValueOnce({ ok: false, error: { code: 'NETWORK_OFFLINE' } });
    fireEvent.press(screen.getByRole('button', { name: fr.receive.refresh }));
    expect(await screen.findByText(fr.receive.previous)).toBeOnTheScreen();
    expect(screen.queryByLabelText(qrLabel())).toBeNull();
    expect(screen.queryByText(fr.receive.offlineDescription)).toBeNull();
    expect(screen.getByText(fr.receive.errorTitle)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: fr.receive.copy })).toBeDisabled();
    expect(screen.getByRole('button', { name: fr.receive.share })).toBeDisabled();
  });

  it('efface une ancienne confirmation de copie dès la relecture, même si celle-ci échoue', async () => {
    const services = { ...createReceivePreviewServices(), mode: 'native' as const };
    const pending = deferred<HomeResult<{ address: string }>>();
    const read = jest.spyOn(services.address!, 'current');
    renderReceive(services);
    await screen.findByLabelText(qrLabel());
    fireEvent.press(screen.getByRole('button', { name: fr.receive.copy }));
    expect(await screen.findByText(fr.receive.copied)).toBeOnTheScreen();
    read.mockReturnValueOnce(pending.promise);
    fireEvent.press(screen.getByRole('button', { name: fr.receive.refresh }));
    await screen.findByText(fr.receive.refreshing);
    expect(screen.queryByText(fr.receive.copied)).toBeNull();
    expect(screen.getByRole('button', { name: fr.receive.copy })).toBeDisabled();
    await act(async () => pending.resolve({ ok: false, error: { code: 'READ_FAILED' } }));
    expect(await screen.findByText(fr.receive.previous)).toBeOnTheScreen();
    expect(screen.queryByText(fr.receive.copied)).toBeNull();
    expect(screen.getByRole('button', { name: fr.receive.copy })).toBeDisabled();
  });

  it('ignore une copie qui se termine pendant une nouvelle lecture de l’adresse', async () => {
    const services = { ...createReceivePreviewServices(), mode: 'native' as const };
    const pendingCopy = deferred<boolean>();
    const pendingRead = deferred<HomeResult<{ address: string }>>();
    const read = jest.spyOn(services.address!, 'current');
    const { effects } = renderReceive(services);
    effects.copy.mockReturnValueOnce(pendingCopy.promise);
    await screen.findByLabelText(qrLabel());
    fireEvent.press(screen.getByRole('button', { name: fr.receive.copy }));
    read.mockReturnValueOnce(pendingRead.promise);
    fireEvent.press(screen.getByRole('button', { name: fr.receive.refresh }));
    await screen.findByText(fr.receive.refreshing);
    await act(async () => pendingCopy.resolve(true));
    expect(screen.queryByText(fr.receive.copied)).toBeNull();
    expect(screen.getByRole('button', { name: fr.receive.copy })).toBeDisabled();
    await act(async () => pendingRead.resolve({ ok: true, value: { address } }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: fr.receive.copy })).toBeEnabled(),
    );
    expect(screen.queryByText(fr.receive.copied)).toBeNull();
  });

  it('conserve des commandes nommées dans la zone défilable avec texte doublé à 320 px', async () => {
    mockWindowDimensions.mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 2,
    });
    const { effects, onBack } = renderReceive();
    await screen.findByLabelText(qrLabel());
    expect(mockWindowDimensions).toHaveBeenCalled();
    expect(screen.UNSAFE_getByType(ReceiveQr).props.maxSize).toBe(232);
    expect(StyleSheet.flatten(screen.getByText(fr.receive.title).props.style).fontSize).toBe(28);
    const content = within(screen.UNSAFE_getByType(ScrollView));
    expect(content.getByRole('button', { name: fr.receive.copy })).toBeEnabled();
    expect(content.getByRole('button', { name: fr.receive.share })).toBeEnabled();
    expect(content.getByLabelText(address)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.receive.help }));
    expect(content.getByText(fr.receive.helpDescription)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.receive.back }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(effects.copy).not.toHaveBeenCalled();
    expect(effects.share).not.toHaveBeenCalled();
  });

  it.each([
    [320.7, 232],
    [184.3, 96],
    [80.5, 96],
  ])('borne le QR à un nombre entier sur une largeur de %s dp', async (width, expected) => {
    mockWindowDimensions.mockReturnValue({ width, height: 640, scale: 2.75, fontScale: 1 });
    const services = createReceivePreviewServices('longAddress');
    const result = await services.address!.current();
    if (!result.ok) throw new Error('Adresse de fixture indisponible');
    renderReceive(services);
    expect(await screen.findByLabelText(qrLabel(result.value.address))).toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(ReceiveQr).props.maxSize).toBe(expected);
  });
});
