import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import App from '../App';
import { createHomePreviewServices } from '../src/home/preview';
import { createReceivePreviewServices } from '../src/receive/preview';
import { createAppI18n } from '../src/translations';
import { fr } from '../src/translations/fr';

const mockNavigationChange = jest.fn();

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const react = jest.requireActual('react');
  return {
    ...actual,
    NavigationContainer: (props: Record<string, unknown>) =>
      react.createElement(actual.NavigationContainer, {
        ...props,
        onStateChange: mockNavigationChange,
      }),
  };
});
jest.mock('../src/onboarding/OnboardingScreen', () => ({
  OnboardingScreen: ({ onFinished }: { onFinished: () => void }) => {
    const react = jest.requireActual('react');
    const { Pressable, Text } = jest.requireActual('react-native');
    return react.createElement(
      Pressable,
      { accessibilityRole: 'button', onPress: onFinished },
      react.createElement(Text, null, 'Terminer l’ouverture fictive'),
    );
  },
}));

describe('navigation Recevoir | ouverture du portefeuille sans accueil dupliqué', () => {
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    mockNavigationChange.mockClear();
    original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (original) Object.defineProperty(AppState, 'currentState', original);
  });

  it.each(['verrouille', 'absent'] as const)(
    'revient à un seul accueil après ouverture depuis un wallet %s',
    async (state) => {
      const services = { ...createReceivePreviewServices(), mode: 'native' as const };
      jest.spyOn(services.wallet!, 'state').mockResolvedValue(state);
      render(
        <App
          initialRoute="Home"
          homeServices={{ ...createHomePreviewServices(), mode: 'native' }}
          receiveServices={services}
          i18n={createAppI18n()}
        />,
      );
      await act(async () => {});
      await screen.findByLabelText('45\u00a0000 FCFA');
      fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.receive }));
      fireEvent.press(
        await screen.findByRole('button', {
          name: state === 'verrouille' ? fr.receive.unlock : fr.receive.create,
        }),
      );
      fireEvent.press(await screen.findByRole('button', { name: 'Terminer l’ouverture fictive' }));
      await screen.findByRole('header', { name: fr.dashboard.recent });
      await waitFor(() => {
        const navigationState = mockNavigationChange.mock.lastCall?.[0] as
          { routes: { name: string }[] } | undefined;
        expect(navigationState?.routes.map((route) => route.name)).toEqual(['Home']);
      });
    },
  );
});
