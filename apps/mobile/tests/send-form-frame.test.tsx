import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useCameraPermissions, type PermissionResponse } from 'expo-camera';
import {
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type AppStateStatus,
} from 'react-native';

import { FormFrame } from '../src/send/FormFrame';
import { QrScanner, type QrScannerLabels } from '../src/send/QrScanner';
import { Button, tokens } from '../src/ui';

const mockGetPermission = jest.fn<Promise<PermissionResponse>, []>();
const mockRequestPermission = jest.fn<Promise<PermissionResponse>, []>();

jest.mock('expo-camera', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View: NativeView } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CameraView: (props: Record<string, unknown>) =>
      React.createElement(NativeView, { ...props, testID: 'camera-preview' }),
    useCameraPermissions: jest.fn(() => {
      const [permission, setPermission] = React.useState<PermissionResponse | null>(null);
      const read = React.useCallback(async () => {
        const value = await mockGetPermission();
        setPermission(value);
        return value;
      }, []);
      const request = React.useCallback(async () => {
        const value = await mockRequestPermission();
        setPermission(value);
        return value;
      }, []);
      return [permission, request, read];
    }),
  };
});

const granted = {
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
} as PermissionResponse;
const undetermined = {
  status: 'undetermined',
  granted: false,
  canAskAgain: true,
  expires: 'never',
} as PermissionResponse;
const denied = {
  status: 'denied',
  granted: false,
  canAskAgain: true,
  expires: 'never',
} as PermissionResponse;
const permanentlyDenied = { ...denied, canAskAgain: false };

const labels: QrScannerLabels = {
  title: 'Scanner une demande',
  close: 'Fermer le scanner',
  instructions: 'Placez le QR dans le cadre.',
  loading: 'Vérification de la caméra…',
  permissionExplanation: 'La caméra permet de lire le QR.',
  requestPermission: 'Autoriser la caméra',
  permissionDenied: 'La caméra est désactivée.',
  openSettings: 'Ouvrir les réglages',
  permissionError: 'Impossible de vérifier l’autorisation.',
  unavailable: 'La caméra ne fonctionne pas.',
  retry: 'Réessayer',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('cadre T20 | clavier et action principale', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  });

  afterEach(() => jest.restoreAllMocks());

  it('laisse les champs défiler et garde le bouton hors du défilement dans le même KAV', () => {
    render(
      <FormFrame header={<Text>En-tête</Text>} footer={<Text>Continuer</Text>}>
        <TextInput accessibilityLabel="Demande fictive" />
        <Text>Texte long du formulaire</Text>
      </FormFrame>,
    );
    const scroll = screen.UNSAFE_getByType(ScrollView);
    const keyboardFrame = screen.UNSAFE_getByType(KeyboardAvoidingView);
    expect(within(scroll).getByLabelText('Demande fictive')).toBeOnTheScreen();
    expect(within(scroll).getByText('Texte long du formulaire')).toBeOnTheScreen();
    expect(within(scroll).queryByText('Continuer')).toBeNull();
    expect(within(scroll).queryByText('En-tête')).toBeNull();
    expect(within(keyboardFrame).getByText('Continuer')).toBeOnTheScreen();
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(false);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).flexGrow).toBe(1);
  });

  it.each(['android', 'ios'] as const)(
    'configure l’évitement du clavier edge-to-edge sur %s sans hauteur fixe',
    (platform) => {
      jest.replaceProperty(Platform, 'OS', platform);
      render(
        <FormFrame footer={<Text>Continuer</Text>}>
          <Text>Formulaire</Text>
        </FormFrame>,
      );
      const frame = screen.UNSAFE_getByType(KeyboardAvoidingView);
      expect(frame.props.behavior).toBe('padding');
      expect(screen.UNSAFE_getByType(ScrollView).props.keyboardDismissMode).toBe('on-drag');
      expect(StyleSheet.flatten(frame.props.style)).toEqual(expect.objectContaining({ flex: 1 }));
      expect(StyleSheet.flatten(frame.props.style).height).toBeUndefined();
    },
  );

  it('ne simule aucun déplacement natif sur le navigateur', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    render(
      <FormFrame footer={<Text>Continuer</Text>}>
        <Text>Formulaire</Text>
      </FormFrame>,
    );
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBeUndefined();
    expect(screen.UNSAFE_getByType(ScrollView).props.keyboardDismissMode).toBe('none');
  });

  it.each([24, -12, Number.NaN, Number.POSITIVE_INFINITY])(
    'transmet seulement un décalage haut fini et positif au calcul du clavier',
    (keyboardVerticalOffset) => {
      render(
        <FormFrame keyboardVerticalOffset={keyboardVerticalOffset} footer={<Text>Continuer</Text>}>
          <Text>Formulaire</Text>
        </FormFrame>,
      );
      expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(
        Number.isFinite(keyboardVerticalOffset) ? Math.max(0, keyboardVerticalOffset) : 0,
      );
    },
  );

  it('retire l’inset de navigation sous le CTA pendant le clavier puis le rétablit', () => {
    const listeners = new Map<string, () => void>();
    const subscriptions: jest.Mock[] = [];
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
      listeners.set(name, listener as () => void);
      const removed = jest.fn();
      subscriptions.push(removed);
      return { remove: removed };
    });
    const view = render(
      <FormFrame bottomInset={34} footer={<Text testID="form-cta">Continuer</Text>}>
        <Text>Formulaire</Text>
      </FormFrame>,
    );
    function footerPadding() {
      const footer = screen
        .UNSAFE_getAllByType(View)
        .find((node) => StyleSheet.flatten(node.props.style)?.borderTopWidth === 1);
      return StyleSheet.flatten(footer?.props.style).paddingBottom;
    }
    expect(footerPadding()).toBe(34);
    act(() => listeners.get('keyboardDidShow')?.());
    expect(footerPadding()).toBe(tokens.spacing.lg);
    act(() => listeners.get('keyboardDidHide')?.());
    expect(footerPadding()).toBe(34);
    view.unmount();
    for (const removed of subscriptions) expect(removed).toHaveBeenCalledTimes(1);
  });
});

describe('scanner T20 | permission et cycle de vie', () => {
  let originalAppState: PropertyDescriptor | undefined;
  let stateListener: (state: AppStateStatus) => void;
  let removeListener: jest.Mock;

  beforeEach(() => {
    originalAppState = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    mockGetPermission.mockReset();
    mockRequestPermission.mockReset();
    mockGetPermission.mockResolvedValue(granted);
    mockRequestPermission.mockResolvedValue(granted);
    removeListener = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      stateListener = listener;
      return { remove: removeListener };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalAppState) Object.defineProperty(AppState, 'currentState', originalAppState);
  });

  function renderScanner(active = true, openSettings?: () => Promise<void>) {
    const onScanned = jest.fn();
    const onClose = jest.fn();
    const props = { active, onScanned, onClose, labels, openSettings };
    return { ...render(<QrScanner {...props} />), props, onScanned, onClose };
  }

  it('lit seulement le statut et attend un appui explicite pour demander l’accès', async () => {
    mockGetPermission.mockResolvedValue(undetermined);
    renderScanner();
    expect(await screen.findByText(labels.permissionExplanation)).toBeOnTheScreen();
    expect(useCameraPermissions).toHaveBeenCalledWith({ get: false, request: false });
    expect(mockGetPermission).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(screen.queryByTestId('camera-preview')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: labels.requestPermission }));
    expect(await screen.findByTestId('camera-preview')).toBeOnTheScreen();
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('reste refermé et sans lecture de permission lorsque son écran est inactif', () => {
    renderScanner(false);
    expect(screen.queryByTestId('camera-preview')).toBeNull();
    expect(screen.queryByRole('header')).toBeNull();
    expect(mockGetPermission).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('n’ouvre rien si l’application est déjà en arrière-plan au montage', () => {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });
    renderScanner();
    expect(screen.queryByTestId('camera-preview')).toBeNull();
    expect(mockGetPermission).not.toHaveBeenCalled();
  });

  it('configure exclusivement le QR, la caméra arrière et aucun son', async () => {
    renderScanner();
    const camera = await screen.findByTestId('camera-preview');
    expect(camera).toHaveProp('barcodeScannerSettings', { barcodeTypes: ['qr'] });
    expect(camera).toHaveProp('facing', 'back');
    expect(camera).toHaveProp('mute', true);
    expect(screen.getByText(labels.instructions)).toBeOnTheScreen();
  });

  it('livre le QR exact une fois puis démonte la caméra même pour deux événements synchrones', async () => {
    const { onScanned } = renderScanner();
    const camera = await screen.findByTestId('camera-preview');
    const callback = camera.props.onBarcodeScanned;
    act(() => {
      callback({ type: 'qr', data: 'LIGHTNING:EXEMPLE_FICTIF' });
      callback({ type: 'qr', data: 'AUTRE_QR_FICTIF' });
    });
    expect(onScanned).toHaveBeenCalledTimes(1);
    expect(onScanned).toHaveBeenCalledWith('LIGHTNING:EXEMPLE_FICTIF');
    expect(screen.queryByTestId('camera-preview')).toBeNull();
  });

  it('ignore les données vides et les autres formats sans consommer le prochain QR', async () => {
    const { onScanned } = renderScanner();
    const camera = await screen.findByTestId('camera-preview');
    fireEvent(camera, 'barcodeScanned', { type: 'ean13', data: '0000000000000' });
    fireEvent(camera, 'barcodeScanned', { type: 'qr', data: '' });
    expect(onScanned).not.toHaveBeenCalled();
    fireEvent(camera, 'barcodeScanned', { type: 'qr', data: 'exemple@teranga.example' });
    expect(onScanned).toHaveBeenCalledTimes(1);
  });

  it('démonte au passage en arrière-plan et rejette un événement caméra déjà en vol', async () => {
    const { onScanned } = renderScanner();
    const camera = await screen.findByTestId('camera-preview');
    const callback = camera.props.onBarcodeScanned;
    act(() => {
      stateListener('background');
      callback({ type: 'qr', data: 'exemple@teranga.example' });
    });
    expect(screen.queryByTestId('camera-preview')).toBeNull();
    expect(onScanned).not.toHaveBeenCalled();
    act(() => stateListener('active'));
    expect(await screen.findByTestId('camera-preview')).toBeOnTheScreen();
    expect(mockGetPermission).toHaveBeenCalledTimes(2);
  });

  it('ne remonte pas la caméra lorsqu’une ancienne lecture accordée finit après un refus récent', async () => {
    const oldPermission = deferred<PermissionResponse>();
    mockGetPermission.mockReturnValueOnce(oldPermission.promise).mockResolvedValue(denied);
    renderScanner();
    expect(screen.getByText(labels.loading)).toBeOnTheScreen();
    act(() => stateListener('background'));
    act(() => stateListener('active'));
    expect(await screen.findByText(labels.permissionDenied)).toBeOnTheScreen();
    await act(async () => oldPermission.resolve(granted));
    expect(screen.getByText(labels.permissionDenied)).toBeOnTheScreen();
    expect(screen.queryByTestId('camera-preview')).toBeNull();
  });

  it('ne remonte pas la caméra si une ancienne demande se termine après un refus relu au retour', async () => {
    const oldRequest = deferred<PermissionResponse>();
    mockGetPermission.mockResolvedValueOnce(undetermined).mockResolvedValue(denied);
    mockRequestPermission.mockReturnValue(oldRequest.promise);
    renderScanner();
    fireEvent.press(await screen.findByRole('button', { name: labels.requestPermission }));
    act(() => stateListener('inactive'));
    act(() => stateListener('active'));
    expect(await screen.findByText(labels.permissionDenied)).toBeOnTheScreen();
    await act(async () => oldRequest.resolve(granted));
    expect(screen.getByText(labels.permissionDenied)).toBeOnTheScreen();
    expect(screen.queryByTestId('camera-preview')).toBeNull();
  });

  it('démonte et ignore l’ancien callback si le parent revient à la saisie', async () => {
    const { rerender, props, onScanned } = renderScanner();
    const camera = await screen.findByTestId('camera-preview');
    const callback = camera.props.onBarcodeScanned;
    rerender(<QrScanner {...props} active={false} />);
    act(() => callback({ type: 'qr', data: 'exemple@teranga.example' }));
    expect(screen.queryByTestId('camera-preview')).toBeNull();
    expect(onScanned).not.toHaveBeenCalled();
  });

  it('ignore un événement déjà en vol après le démontage complet du scanner', async () => {
    const { unmount, onScanned } = renderScanner();
    const camera = await screen.findByTestId('camera-preview');
    const callback = camera.props.onBarcodeScanned;
    unmount();
    act(() => callback({ type: 'qr', data: 'exemple@teranga.example' }));
    expect(onScanned).not.toHaveBeenCalled();
  });

  it('explique un refus réessayable sans redemander automatiquement la permission', async () => {
    mockGetPermission.mockResolvedValue(denied);
    renderScanner();
    expect(await screen.findByText(labels.permissionDenied)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: labels.requestPermission })).toBeOnTheScreen();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('propose les réglages après un refus permanent puis relit la permission au retour', async () => {
    mockGetPermission.mockResolvedValueOnce(permanentlyDenied).mockResolvedValue(granted);
    const openSettings = jest.fn(async () => {});
    renderScanner(true, openSettings);
    fireEvent.press(await screen.findByRole('button', { name: labels.openSettings }));
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    act(() => stateListener('inactive'));
    act(() => stateListener('active'));
    expect(await screen.findByTestId('camera-preview')).toBeOnTheScreen();
    expect(mockGetPermission).toHaveBeenCalledTimes(2);
  });

  it('utilise les réglages natifs par défaut sans en inventer le résultat', async () => {
    mockGetPermission.mockResolvedValue(permanentlyDenied);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    renderScanner();
    fireEvent.press(await screen.findByRole('button', { name: labels.openSettings }));
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('camera-preview')).toBeNull();
  });

  it('rend une erreur de vérification récupérable sans divulguer son détail natif', async () => {
    mockGetPermission.mockRejectedValueOnce(new Error('detail-fictif-a-masquer'));
    renderScanner();
    expect(await screen.findByRole('alert')).toHaveTextContent(labels.permissionError);
    expect(screen.queryByText('detail-fictif-a-masquer')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: labels.retry }));
    expect(await screen.findByTestId('camera-preview')).toBeOnTheScreen();
  });

  it('rend un refus de demande de permission récupérable', async () => {
    mockGetPermission.mockResolvedValue(undetermined);
    mockRequestPermission.mockRejectedValueOnce(new Error('erreur-native'));
    renderScanner();
    fireEvent.press(await screen.findByRole('button', { name: labels.requestPermission }));
    expect(await screen.findByRole('alert')).toHaveTextContent(labels.permissionError);
    expect(screen.queryByTestId('camera-preview')).toBeNull();
  });

  it('n’envoie qu’une demande système pendant un double appui', async () => {
    mockGetPermission.mockResolvedValue(undetermined);
    const permission = deferred<PermissionResponse>();
    mockRequestPermission.mockReturnValue(permission.promise);
    renderScanner();
    await screen.findByRole('button', { name: labels.requestPermission });
    const onPress = screen.UNSAFE_getByType(Button).props.onPress;
    act(() => {
      onPress();
      onPress();
    });
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    await act(async () => permission.resolve(granted));
    expect(await screen.findByTestId('camera-preview')).toBeOnTheScreen();
  });

  it('remplace une panne caméra par le message traduit et permet un nouvel essai', async () => {
    renderScanner();
    const camera = await screen.findByTestId('camera-preview');
    fireEvent(camera, 'mountError', { message: 'detail-technique-fictif' });
    expect(await screen.findByRole('alert')).toHaveTextContent(labels.unavailable);
    expect(screen.queryByTestId('camera-preview')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: labels.retry }));
    expect(await screen.findByTestId('camera-preview')).toBeOnTheScreen();
  });

  it('permet de fermer pendant la vérification puis retire son listener au démontage', async () => {
    const pending = deferred<PermissionResponse>();
    mockGetPermission.mockReturnValue(pending.promise);
    const { onClose, unmount } = renderScanner();
    expect(screen.getByText(labels.loading)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: labels.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(granted));
    await waitFor(() => expect(screen.getByTestId('camera-preview')).toBeOnTheScreen());
    unmount();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});
