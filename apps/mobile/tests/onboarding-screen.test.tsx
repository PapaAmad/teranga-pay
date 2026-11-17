import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StrictMode } from 'react';
import { AccessibilityInfo, Alert, AppState, BackHandler, type AppStateStatus } from 'react-native';
import * as ReactNative from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import App from '../App';
import { OnboardingScreen } from '../src/onboarding/OnboardingScreen';
import type { OnboardingResult, OnboardingServices } from '../src/onboarding/ports';
import { createPreviewServices as createIsolatedPreviewServices } from '../src/onboarding/preview';
import { createAppI18n, TranslationProvider } from '../src/translations';
import { fr } from '../src/translations/fr';
import { BrandTypographyProvider } from '../src/ui';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
}));
jest.mock('expo-screen-capture', () => ({
  isAvailableAsync: jest.fn(async () => true),
  preventScreenCaptureAsync: jest.fn(async () => undefined),
  allowScreenCaptureAsync: jest.fn(async () => undefined),
}));

// Code et jetons entièrement fictifs : pas de phrase Bitcoin ni de coffre réel.
const examplePin = '112233';
const word = (position: number) => `exemple${String(position).padStart(2, '0')}`;
const positions = [2, 6, 10] as const;
const createPreviewServices = () =>
  createIsolatedPreviewServices({
    integer: (upperExclusive) => upperExclusive - 1,
  });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderOnboarding(services = createPreviewServices()) {
  const i18n = createAppI18n();
  const callbacks = { onDiscover: jest.fn(), onFinished: jest.fn(), onExitPreview: jest.fn() };
  render(
    <SafeAreaProvider>
      <TranslationProvider i18n={i18n}>
        <BrandTypographyProvider available>
          <OnboardingScreen services={services} {...callbacks} />
        </BrandTypographyProvider>
      </TranslationProvider>
    </SafeAreaProvider>,
  );
  return { services, i18n, ...callbacks };
}

async function startJourney() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: fr.onboarding.welcome.start })).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole('button', { name: fr.onboarding.welcome.start }));
  expect(screen.getByRole('header', { name: fr.onboarding.language.title })).toBeOnTheScreen();
}

async function reachPin() {
  await startJourney();
  fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.continue }));
  const prepared = await screen.findByRole('button', { name: fr.onboarding.prepare.ready });
  fireEvent.press(prepared);
  return screen.findByLabelText(fr.onboarding.pin.label);
}

async function reachConfirmation() {
  const input = await reachPin();
  fireEvent.changeText(input, examplePin);
  fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.continue }));
  return screen.findByLabelText(fr.onboarding.pin.confirmLabel);
}

async function reachWords() {
  const confirm = await reachConfirmation();
  fireEvent.changeText(confirm, examplePin);
  fireEvent.press(screen.getByRole('button', { name: fr.onboarding.pin.create }));
  return screen.findByLabelText(`Mot 1 : ${word(1)}`);
}

function chooseAnswers(correct: boolean) {
  positions.forEach((position) => {
    fireEvent.press(
      screen.getByRole('radio', { name: `Mot ${position}, choix ${word(correct ? position : 1)}` }),
    );
  });
}

describe('onboarding | écrans et parcours', () => {
  let originalAppState: PropertyDescriptor | undefined;

  beforeEach(() => {
    // Le preset Expo remplace cet attribut natif par une fonction simulée.
    // Le parcours testé représente une application réellement au premier plan.
    originalAppState = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalAppState) Object.defineProperty(AppState, 'currentState', originalAppState);
  });

  it('redémarre avec un contrôleur vivant après le cycle des effets de StrictMode', async () => {
    render(
      <StrictMode>
        <SafeAreaProvider>
          <TranslationProvider i18n={createAppI18n()}>
            <BrandTypographyProvider available>
              <OnboardingScreen
                services={createPreviewServices()}
                onDiscover={jest.fn()}
                onFinished={jest.fn()}
              />
            </BrandTypographyProvider>
          </TranslationProvider>
        </SafeAreaProvider>
      </StrictMode>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: fr.onboarding.welcome.start })).toBeEnabled(),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('l’application démarre sur le nouvel accueil sans créer un wallet par défaut', async () => {
    render(<App i18n={createAppI18n()} />);
    await act(async () => {});
    await waitFor(() =>
      expect(screen.getByRole('button', { name: fr.onboarding.welcome.start })).toBeEnabled(),
    );
    expect(screen.getByRole('header', { name: /L’argent bouge/ })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Bienvenue sur Teranga Pay' })).toBeNull();
    expect(screen.queryByLabelText(fr.onboarding.pin.label)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.welcome.discover }));
    expect(await screen.findByRole('header', { name: fr.about.title })).toBeOnTheScreen();
  });

  it('l’entrée Home sans wallet expose son absence et ne fabrique aucun solde', async () => {
    render(<App initialRoute="Home" i18n={createAppI18n()} />);
    await act(async () => {});
    expect(await screen.findByRole('header', { name: fr.appName })).toBeOnTheScreen();
    expect(await screen.findByText(fr.dashboard.unavailableDescription)).toBeOnTheScreen();
    expect(screen.queryByLabelText('0 FCFA')).toBeNull();
    expect(screen.getByRole('button', { name: fr.dashboard.actions.send })).toBeDisabled();
    expect(screen.queryByLabelText(fr.onboarding.pin.label)).toBeNull();
  });

  it('montre le français sélectionné et explique pourquoi le wolof est indisponible', async () => {
    const { services } = renderOnboarding();
    const writeLanguage = jest.spyOn(services.storage, 'writeLanguage');
    await startJourney();
    expect(screen.getByRole('radio', { name: fr.onboarding.language.french })).toHaveProp(
      'accessibilityState',
      { checked: true },
    );
    const wolof = screen.getByRole('radio', { name: fr.onboarding.language.wolof });
    expect(wolof).toBeDisabled();
    expect(wolof).toHaveProp('accessibilityHint', fr.onboarding.language.wolofDetail);
    fireEvent.press(wolof);
    expect(writeLanguage).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.continue }));
    await screen.findByRole('button', { name: fr.onboarding.prepare.ready });
    expect(writeLanguage).toHaveBeenCalledWith('fr');
  });

  it('arrête la version sans SDK avant le PIN et ne simule pas une création', async () => {
    const services: OnboardingServices = {
      ...createPreviewServices(),
      mode: 'unavailable',
      wallet: undefined,
    };
    const protect = jest.spyOn(services.protection, 'protect');
    renderOnboarding(services);
    await startJourney();
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.continue }));
    fireEvent.press(await screen.findByRole('button', { name: fr.onboarding.prepare.ready }));
    expect(screen.getByRole('header', { name: /Le portefeuille/ })).toBeOnTheScreen();
    expect(screen.getByRole('alert', { name: fr.onboarding.errors.unavailable })).toBeOnTheScreen();
    expect(screen.queryByLabelText(fr.onboarding.pin.label)).toBeNull();
    expect(screen.queryByLabelText(`Mot 1 : ${word(1)}`)).toBeNull();
    expect(protect).not.toHaveBeenCalled();
  });

  it('garde le PIN masqué, filtre sa saisie et vide le champ entre les étapes', async () => {
    renderOnboarding();
    const input = await reachPin();
    expect(input).toHaveProp('secureTextEntry', true);
    expect(input).toHaveProp('autoComplete', 'off');
    expect(input).toHaveProp('importantForAutofill', 'no');
    expect(input).toHaveProp('accessibilityHint', fr.onboarding.preview.pinHint);
    expect(screen.getByRole('button', { name: fr.onboarding.actions.continue })).toBeDisabled();
    fireEvent.changeText(input, '11a22-33z7');
    expect(input).toHaveProp('value', examplePin);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.show }));
    expect(input).toHaveProp('secureTextEntry', false);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.hide }));
    expect(input).toHaveProp('secureTextEntry', true);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.continue }));
    const confirmation = screen.getByLabelText(fr.onboarding.pin.confirmLabel);
    expect(confirmation).toHaveProp('value', '');
    expect(confirmation).toHaveProp('secureTextEntry', true);
  });

  it('explique une confirmation différente sans créer ou exposer des mots', async () => {
    const { services } = renderOnboarding();
    const create = jest.spyOn(services.wallet!, 'create');
    const confirmation = await reachConfirmation();
    fireEvent.changeText(confirmation, '334455');
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.pin.create }));
    expect(
      await screen.findByRole('alert', { name: fr.onboarding.errors.pinMismatch }),
    ).toBeOnTheScreen();
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByLabelText(fr.onboarding.pin.confirmLabel)).toHaveProp('value', '');
    expect(screen.queryByLabelText(`Mot 1 : ${word(1)}`)).toBeNull();
  });

  it('termine le parcours fictif après un test correct et quitte sans ouvrir un portefeuille', async () => {
    const { services, onFinished, onExitPreview } = renderOnboarding();
    const create = jest.spyOn(services.wallet!, 'create');
    await reachWords();
    expect(screen.getByText(fr.onboarding.preview.notice)).toBeOnTheScreen();
    for (let position = 1; position <= 12; position += 1) {
      expect(screen.getByLabelText(`Mot ${position} : ${word(position)}`)).toBeOnTheScreen();
    }
    expect(screen.queryByLabelText(fr.onboarding.pin.confirmLabel)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.words.noted }));
    expect(screen.getByRole('button', { name: fr.onboarding.actions.finish })).toBeDisabled();
    chooseAnswers(true);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.finish }));
    expect(await screen.findByText(fr.onboarding.complete.previewDescription)).toBeOnTheScreen();
    expect(create).toHaveBeenCalledTimes(1);
    expect(await services.storage.read()).toEqual({
      language: 'fr',
      completed: true,
      pendingBackup: false,
    });
    expect(screen.queryByLabelText(`Mot 1 : ${word(1)}`)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.preview.exit }));
    expect(onExitPreview).toHaveBeenCalledTimes(1);
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('annonce une copie incorrecte et permet de revoir les mêmes mots sans nouvelle création', async () => {
    const { services } = renderOnboarding();
    const create = jest.spyOn(services.wallet!, 'create');
    await reachWords();
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.words.noted }));
    chooseAnswers(false);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.finish }));
    expect(
      await screen.findByRole('alert', { name: fr.onboarding.errors.backup }),
    ).toBeOnTheScreen();
    expect((await services.storage.read()).completed).toBe(false);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.review }));
    expect(screen.getByLabelText(`Mot 1 : ${word(1)}`)).toBeOnTheScreen();
    expect(create).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.words.noted }));
    expect(screen.getByRole('button', { name: fr.onboarding.actions.finish })).toBeDisabled();
  });

  it('explique un refus de protection sans afficher de mots ni créer de coffre', async () => {
    const services = createPreviewServices();
    jest.spyOn(services.protection, 'protect').mockResolvedValue(false);
    const create = jest.spyOn(services.wallet!, 'create');
    renderOnboarding(services);
    const confirmation = await reachConfirmation();
    fireEvent.changeText(confirmation, examplePin);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.pin.create }));
    expect(
      await screen.findByRole('alert', { name: fr.onboarding.errors.protection }),
    ).toBeOnTheScreen();
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(`Mot 1 : ${word(1)}`)).toBeNull();
  });

  it('un double appui pendant la création n’appelle le wallet qu’une fois', async () => {
    const services = createPreviewServices();
    const creation = deferred<OnboardingResult<{ recoveryWords: string[] }>>();
    const create = jest.spyOn(services.wallet!, 'create').mockReturnValueOnce(creation.promise);
    renderOnboarding(services);
    const confirmation = await reachConfirmation();
    fireEvent.changeText(confirmation, examplePin);
    const button = screen.getByRole('button', { name: fr.onboarding.pin.create });
    act(() => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('header', { name: fr.onboarding.actions.creating })).toBeOnTheScreen();
    await act(async () => {
      creation.resolve({
        ok: true,
        value: { recoveryWords: Array.from({ length: 12 }, (_, index) => word(index + 1)) },
      });
      await creation.promise;
    });
    expect(await screen.findByLabelText(`Mot 1 : ${word(1)}`)).toBeOnTheScreen();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('masque la phrase à la suspension et présente une reprise bloquée au retour', async () => {
    const listeners = new Set<(state: AppStateStatus) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listeners.add(handler);
      return { remove: () => listeners.delete(handler) };
    });
    const { services } = renderOnboarding();
    const lock = jest.spyOn(services.wallet!, 'lock');
    await reachWords();
    act(() => listeners.forEach((listener) => listener('background')));
    expect(screen.queryByLabelText(`Mot 1 : ${word(1)}`)).toBeNull();
    expect(screen.getByText(fr.onboarding.errors.interrupted)).toBeOnTheScreen();
    await act(async () => listeners.forEach((listener) => listener('active')));
    expect(await screen.findByRole('header', { name: /Votre sauvegarde/ })).toBeOnTheScreen();
    expect(screen.queryByLabelText(`Mot 1 : ${word(1)}`)).toBeNull();
    expect(lock).toHaveBeenCalled();
  });

  it('demande confirmation avant de quitter les mots avec le bouton Retour Android', async () => {
    const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_type, handler) => {
      handlers.add(handler);
      return { remove: () => handlers.delete(handler) };
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderOnboarding();
    await reachWords();
    act(() =>
      handlers.forEach((handler) =>
        expect(handler({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true),
      ),
    );
    expect(alert).toHaveBeenCalledWith(
      fr.onboarding.leave.title,
      fr.onboarding.leave.description,
      expect.any(Array),
    );
    expect(screen.getByLabelText(`Mot 1 : ${word(1)}`)).toBeOnTheScreen();
    const buttons = alert.mock.calls.at(-1)?.[2];
    expect(buttons?.find((button) => button.text === fr.onboarding.leave.stay)).toMatchObject({
      style: 'cancel',
    });
    await act(async () => {
      buttons?.find((button) => button.text === fr.onboarding.leave.confirm)?.onPress?.();
    });
    expect(await screen.findByRole('header', { name: /Votre sauvegarde/ })).toBeOnTheScreen();
    expect(screen.queryByLabelText(`Mot 1 : ${word(1)}`)).toBeNull();
  });

  it('utilise le catalogue de traduction pour les textes et les libellés du parcours', async () => {
    const i18n = createAppI18n();
    i18n.addResourceBundle(
      'fr',
      'translation',
      {
        onboarding: { welcome: { title: 'Titre témoin du parcours', start: 'Action témoin' } },
      },
      true,
      true,
    );
    render(<App i18n={i18n} onboardingServices={createPreviewServices()} />);
    expect(
      await screen.findByRole('header', { name: 'Titre témoin du parcours' }),
    ).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Action témoin' })).toBeEnabled(),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Action témoin' }));
    expect(screen.getByRole('header', { name: fr.onboarding.language.title })).toBeOnTheScreen();
  });

  it('laisse parcourir les consignes et terminer avec texte agrandi sur un écran étroit', async () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 2,
    });
    const { onExitPreview } = renderOnboarding();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: fr.onboarding.welcome.start })).toBeEnabled(),
    );
    // L'illustration facultative cède sa place au texte ; le parcours reste réel.
    expect(screen.UNSAFE_queryAllByType(ReactNative.Image)).toHaveLength(0);
    await startJourney();
    expect(screen.getByRole('radio', { name: fr.onboarding.language.french })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.continue }));
    await screen.findByRole('button', { name: fr.onboarding.prepare.ready });
    for (const instruction of [
      fr.onboarding.prepare.description,
      fr.onboarding.prepare.codeDetail,
      fr.onboarding.prepare.wordsDetail,
      fr.onboarding.prepare.privacyDetail,
    ]) {
      expect(screen.getByText(instruction)).toBeOnTheScreen();
    }
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.prepare.ready }));
    fireEvent.changeText(screen.getByLabelText(fr.onboarding.pin.label), examplePin);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.continue }));
    fireEvent.changeText(screen.getByLabelText(fr.onboarding.pin.confirmLabel), examplePin);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.pin.create }));
    await screen.findByLabelText(`Mot 1 : ${word(1)}`);
    expect(screen.getByText(fr.onboarding.words.privacy)).toBeOnTheScreen();
    for (let position = 1; position <= 12; position += 1) {
      expect(screen.getByLabelText(`Mot ${position} : ${word(position)}`)).toBeOnTheScreen();
    }
    const help = screen.getByRole('button', { name: fr.onboarding.words.help });
    expect(help).toHaveProp('accessibilityState', { expanded: false });
    fireEvent.press(help);
    expect(screen.getByRole('button', { name: fr.onboarding.words.help })).toHaveProp(
      'accessibilityState',
      { expanded: true },
    );
    expect(screen.getByText(fr.onboarding.words.lightning)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.words.noted }));
    for (const position of positions) {
      expect(screen.getByText(`Quel est le mot n° ${position} ?`)).toBeOnTheScreen();
    }
    expect(screen.getByText(fr.onboarding.verify.note)).toBeOnTheScreen();
    chooseAnswers(true);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.actions.finish }));
    await screen.findByText(fr.onboarding.complete.previewDescription);
    fireEvent.press(screen.getByRole('button', { name: fr.onboarding.preview.exit }));
    expect(onExitPreview).toHaveBeenCalledTimes(1);
  });
});
