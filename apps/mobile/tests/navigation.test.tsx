import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import App from '../App';
import { fr } from '../src/translations/fr';

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
});
