import { act, fireEventAsync, render, screen } from '@testing-library/react-native';

import { AppState } from 'react-native';

import App from '../App';
import { createAppI18n } from '../src/translations';
import { fr } from '../src/translations/fr';

let mockPreviews = false;
jest.mock('../src/navigation/previews', () => ({
  get previewsEnabled() {
    return mockPreviews;
  },
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('../src/send/QrScanner', () => ({ QrScanner: () => null }));

const { arePreviewsEnabled } = jest.requireActual<typeof import('../src/navigation/previews')>(
  '../src/navigation/previews',
);

describe('APK de démonstration pour les jurys T35', () => {
  const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
  const flag = process.env.EXPO_PUBLIC_DEMO_BUILD;
  let appState: PropertyDescriptor | undefined;
  beforeEach(() => {
    appState = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    if (appState) Object.defineProperty(AppState, 'currentState', appState);
    (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
    if (flag === undefined) delete process.env.EXPO_PUBLIC_DEMO_BUILD;
    else process.env.EXPO_PUBLIC_DEMO_BUILD = flag;
  });

  it('n’ouvre les aperçus en release que si le build démo est demandé', () => {
    expect(arePreviewsEnabled(true, undefined)).toBe(true);
    expect(arePreviewsEnabled(false, undefined)).toBe(false);
    expect(arePreviewsEnabled(false, '0')).toBe(false);
    expect(arePreviewsEnabled(false, 'true')).toBe(false);
    expect(arePreviewsEnabled(false, '1')).toBe(true);
  });

  it('lit EXPO_PUBLIC_DEMO_BUILD au chargement du module', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const load = () => {
      let value: boolean | undefined;
      jest.isolateModules(() => {
        value = jest.requireActual<typeof import('../src/navigation/previews')>(
          '../src/navigation/previews',
        ).previewsEnabled;
      });
      return value;
    };
    delete process.env.EXPO_PUBLIC_DEMO_BUILD;
    expect(load()).toBe(false);
    process.env.EXPO_PUBLIC_DEMO_BUILD = '1';
    expect(load()).toBe(true);
  });

  it('masque le parcours fictif dans une release ordinaire', async () => {
    mockPreviews = false;
    render(<App i18n={createAppI18n()} />);
    await act(async () => {});
    expect(screen.queryByText(fr.onboarding.preview.launch)).toBeNull();
  });

  it('propose le parcours fictif, signalé comme tel, dans l’APK démo', async () => {
    mockPreviews = true;
    render(<App i18n={createAppI18n()} />);
    await act(async () => {});
    await fireEventAsync.press(await screen.findByText(fr.onboarding.preview.launch));
    expect(await screen.findByText(fr.onboarding.preview.notice)).toBeOnTheScreen();
  });
});
