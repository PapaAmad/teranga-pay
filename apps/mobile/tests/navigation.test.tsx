import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import App from '../App';
import { createAppI18n } from '../src/translations';
import { fr } from '../src/translations/fr';
import { createHomePreviewServices } from '../src/home/preview';
import { createReceivePreviewServices } from '../src/receive/preview';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

describe('navigation du socle mobile', () => {
  it('ouvre les informations du projet puis revient à l’accueil', async () => {
    const i18n = createAppI18n();
    render(<App initialRoute="Home" i18n={i18n} />);
    await act(async () => {});

    expect(await screen.findByRole('header', { name: fr.appName })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: fr.home.aboutAction }));

    await waitFor(() => {
      expect(screen.getByRole('header', { name: fr.about.title })).toBeOnTheScreen();
    });
    expect(
      screen.getByText(i18n.t('about.description', { appName: i18n.t('appName') })),
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: fr.about.backAction }));

    await waitFor(() => {
      expect(screen.getByRole('header', { name: fr.appName })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: fr.about.title })).toBeNull();
    });
  });

  it('ouvre la galerie, utilise les exemples locaux puis revient à l’accueil', async () => {
    render(<App initialRoute="Home" i18n={createAppI18n()} />);
    await act(async () => {});
    await screen.findByRole('header', { name: fr.appName });
    fireEvent.press(screen.getByRole('button', { name: fr.home.designAction }));

    await waitFor(() => {
      expect(screen.getByRole('header', { name: fr.design.title })).toBeOnTheScreen();
    });
    expect(screen.getByText(fr.design.notice)).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: fr.design.buttons.normal }));
    expect(screen.getByText(fr.design.buttons.activeFeedback)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.design.buttons.secondary }));
    expect(screen.getByText(fr.design.buttons.idleFeedback)).toBeOnTheScreen();

    expect(screen.getByRole('alert', { name: fr.design.fields.error })).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText(fr.design.fields.errorLabel), 'Exemple');
    expect(screen.queryByText(fr.design.fields.error)).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: fr.design.backAction }));
    await waitFor(() => {
      expect(screen.getByRole('header', { name: fr.appName })).toBeOnTheScreen();
    });
  });
});

describe('navigation Recevoir T18', () => {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    if (original) Object.defineProperty(AppState, 'currentState', original);
  });

  it('relie Recevoir à son écran puis revient à l’accueil sans ouvrir de modale', async () => {
    const receiving = createReceivePreviewServices();
    const read = jest.spyOn(receiving.address!, 'current');
    render(
      <App
        initialRoute="Home"
        homeServices={{ ...createHomePreviewServices(), mode: 'native' }}
        receiveServices={{ ...receiving, mode: 'native' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.receive }));
    expect(
      await screen.findByLabelText('Code QR de réception pour exemple@teranga.example'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(fr.receive.preview)).toBeNull();
    expect(screen.queryByText(fr.dashboard.actionUnavailable)).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: fr.receive.back }));
    expect(await screen.findByRole('header', { name: fr.dashboard.recent })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Code QR de réception pour exemple@teranga.example')).toBeNull();
  });

  it('garde la réception fictive séparée du contexte normal', async () => {
    render(<App initialRoute="HomePreview" i18n={createAppI18n()} />);
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.receive }));
    expect(await screen.findByText('exemple@teranga.example')).toBeOnTheScreen();
    expect(screen.getByText(fr.receive.preview)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.receive.back }));
    expect(await screen.findByText(fr.dashboard.preview)).toBeOnTheScreen();
    expect(screen.queryByText(fr.receive.preview)).toBeNull();
  });

  it('ne remplace pas le fournisseur absent par une adresse fictive', async () => {
    render(<App initialRoute="Receive" i18n={createAppI18n()} />);
    await act(async () => {});
    expect(await screen.findByText(fr.receive.unavailableDescription)).toBeOnTheScreen();
    expect(screen.queryByText('exemple@teranga.example')).toBeNull();
    expect(screen.queryByRole('button', { name: fr.receive.copy })).toBeNull();
    expect(screen.queryByText(fr.receive.preview)).toBeNull();
  });
});
