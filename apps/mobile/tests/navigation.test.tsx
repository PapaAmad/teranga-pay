import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import App from '../App';
import { fr } from '../src/translations/fr';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

describe('navigation du socle mobile', () => {
  it('ouvre les informations du projet puis revient à l’accueil', async () => {
    render(<App />);

    expect(screen.getByRole('header', { name: fr.home.title })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: fr.home.aboutAction }));

    await waitFor(() => {
      expect(screen.getByRole('header', { name: fr.about.title })).toBeOnTheScreen();
    });

    fireEvent.press(screen.getByRole('button', { name: fr.about.backAction }));

    await waitFor(() => {
      expect(screen.getByRole('header', { name: fr.home.title })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: fr.about.title })).toBeNull();
    });
  });

  it('ouvre la galerie, utilise les exemples locaux puis revient à l’accueil', async () => {
    render(<App />);
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
      expect(screen.getByRole('header', { name: fr.home.title })).toBeOnTheScreen();
    });
  });
});
