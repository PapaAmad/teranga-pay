import { act, fireEventAsync, render, screen, waitFor } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { AppState } from 'react-native';
import type { NavigationContainerRef, ParamListBase } from '@react-navigation/native';

import App from '../App';
import type { HomeWalletEvent, HomeWalletPort, HomeWalletState } from '../src/home/ports';
import { createHomePreviewServices } from '../src/home/preview';
import { createPreviewServices } from '../src/onboarding/preview';
import { createWithdrawPreviewServices } from '../src/withdraw/preview';
import { createAppI18n } from '../src/translations';
import { fr } from '../src/translations/fr';

const mockNavigationChange = jest.fn();
jest.setTimeout(30_000);

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('../src/send/QrScanner', () => ({ QrScanner: () => null }));
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual<typeof import('@react-navigation/native')>(
    '@react-navigation/native',
  );
  const react = jest.requireActual<typeof import('react')>('react');
  const Container = actual.NavigationContainer<ParamListBase>;
  return {
    ...actual,
    NavigationContainer: react.forwardRef<
      NavigationContainerRef<ParamListBase>,
      ComponentProps<typeof Container>
    >((props, ref) =>
      react.createElement(Container, {
        ...props,
        ref,
        onStateChange(state) {
          props.onStateChange?.(state);
          mockNavigationChange(state);
        },
      }),
    ),
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function session(initial: HomeWalletState = 'pret') {
  let value = initial;
  const listeners = new Set<(event: HomeWalletEvent) => void>();
  const wallet: jest.Mocked<Pick<HomeWalletPort, 'state' | 'subscribe'>> = {
    state: jest.fn(async () => value),
    subscribe: jest.fn((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
  };
  return {
    wallet,
    emit(state: HomeWalletState) {
      value = state;
      for (const listener of listeners) listener({ type: 'etat', state });
    },
  };
}

function setup({
  initialRoute = 'About',
  session: current = session(),
}: {
  initialRoute?: 'About' | 'HomePreview';
  session?: ReturnType<typeof session>;
} = {}) {
  const home = createHomePreviewServices();
  const withdraw = createWithdrawPreviewServices();
  const onboarding = createPreviewServices({ integer: () => 0 });
  const homeBalance = jest.spyOn(home.wallet!, 'balance');
  const homeHistory = jest.spyOn(home.wallet!, 'history');
  const bridgeOptions = jest.spyOn(withdraw.bridge!, 'options');
  const bridgeConfirm = jest.spyOn(withdraw.bridge!, 'confirm');
  const view = render(
    <App
      initialRoute={initialRoute}
      i18n={createAppI18n()}
      sessionWallet={current.wallet}
      onboardingServices={{
        ...onboarding,
        wallet: { ...onboarding.wallet!, state: current.wallet.state },
        storage: {
          ...onboarding.storage,
          read: async () => ({ language: 'fr', completed: true, pendingBackup: false }),
        },
      }}
      homeServices={{ ...home, mode: 'native', wallet: { ...home.wallet!, ...current.wallet } }}
      withdrawServices={{ ...withdraw, mode: 'simulation' }}
    />,
  );
  return { ...view, current, homeBalance, homeHistory, bridgeOptions, bridgeConfirm };
}

function routes(): string[] | undefined {
  const state = mockNavigationChange.mock.lastCall?.[0] as
    { routes: { name: string }[] } | undefined;
  return state?.routes.map((route) => route.name);
}

describe('T11 | navigation de la session native et ateliers explicites', () => {
  let previousState: PropertyDescriptor | undefined;
  beforeEach(() => {
    mockNavigationChange.mockClear();
    previousState = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (previousState) Object.defineProperty(AppState, 'currentState', previousState);
  });

  it.each(['Home', 'Withdraw'] as const)(
    'un verrouillage depuis %s efface les routes privées et affiche l’ouverture du portefeuille',
    async (route) => {
      const h = setup();
      await act(async () => {});
      await fireEventAsync.press(
        await screen.findByRole('button', { name: fr.about.walletAction }),
      );
      await screen.findByRole('header', { name: fr.dashboard.recent });
      if (route === 'Withdraw') {
        await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.open }));
        await screen.findByRole('header', { name: fr.withdraw.chooseTitle });
        expect(h.bridgeOptions).toHaveBeenCalledTimes(1);
      }
      await act(async () => {
        h.current.emit('verrouille');
      });
      await screen.findByRole('header', { name: fr.onboarding.unlock.title });
      await waitFor(() => expect(routes()).toEqual(['Onboarding']));
      expect(screen.queryByRole('header', { name: fr.dashboard.recent })).toBeNull();
      expect(screen.queryByRole('header', { name: fr.withdraw.chooseTitle })).toBeNull();
      expect(h.bridgeConfirm).not.toHaveBeenCalled();
      h.unmount();
    },
  );

  it('ignore la lecture initiale prête arrivée après un événement verrouillé plus récent', async () => {
    const pending = deferred<HomeWalletState>();
    const current = session();
    current.wallet.state.mockReturnValueOnce(pending.promise);
    const h = setup({ session: current });
    await screen.findByRole('button', { name: fr.about.walletAction });
    await act(async () => {
      current.emit('verrouille');
    });
    await act(async () => {
      pending.resolve('pret');
    });
    await fireEventAsync.press(screen.getByRole('button', { name: fr.about.walletAction }));
    await screen.findByRole('header', { name: fr.onboarding.unlock.title });
    await waitFor(() => expect(routes()).toEqual(['Onboarding']));
    expect(screen.queryByRole('header', { name: fr.dashboard.recent })).toBeNull();
    expect(h.bridgeConfirm).not.toHaveBeenCalled();
    h.unmount();
  });

  it('les ateliers restent accessibles et ne consultent aucun fournisseur du contexte normal verrouillé', async () => {
    const h = setup({ initialRoute: 'HomePreview', session: session('verrouille') });
    await screen.findByLabelText('45\u00a0000 FCFA');
    await act(async () => {
      h.current.emit('verrouille');
    });
    expect(screen.getByText(fr.dashboard.preview)).toBeOnTheScreen();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.open }));
    await screen.findByRole('header', { name: fr.withdraw.chooseTitle });
    expect(screen.getByText(fr.withdraw.simulationNotice)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: fr.withdraw.scenarios.title })).toBeOnTheScreen();
    await waitFor(() => expect(routes()).toEqual(['HomePreview', 'WithdrawPreview']));
    expect(h.homeBalance).not.toHaveBeenCalled();
    expect(h.homeHistory).not.toHaveBeenCalled();
    expect(h.bridgeOptions).not.toHaveBeenCalled();
    expect(h.bridgeConfirm).not.toHaveBeenCalled();
    h.unmount();
  });
});
