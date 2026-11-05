import { fireEvent, render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { Platform } from 'react-native';

import App from '../App';
import { fr } from '../src/translations/fr';
import { BrandIcon, BrandTypographyProvider, Button, Card, Field, tokens } from '../src/ui';

jest.mock('expo-font', () => ({ useFonts: jest.fn(() => [true, null]) }));

describe('composants T08', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('un bouton occupé ou désactivé ne relance pas son action', () => {
    const onPress = jest.fn();
    const { rerender } = render(<Button label={fr.design.buttons.normal} onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: fr.design.buttons.normal }));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(<Button label={fr.design.buttons.normal} loading onPress={onPress} />);
    const busy = screen.getByRole('button', { name: fr.design.buttons.normal });
    expect(busy).toBeDisabled();
    expect(busy).toHaveProp('accessibilityState', { busy: true, disabled: true });
    fireEvent.press(busy);
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(<Button label={fr.design.buttons.normal} disabled onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: fr.design.buttons.normal }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('le champ reste étiqueté, accepte la saisie et rend son focus visible', () => {
    const onChangeText = jest.fn();
    render(
      <Field
        label={fr.design.fields.label}
        value=""
        helperText={fr.design.fields.helper}
        onChangeText={onChangeText}
      />,
    );
    const input = screen.getByLabelText(fr.design.fields.label);
    expect(input).toHaveProp('accessibilityHint', fr.design.fields.helper);
    fireEvent.changeText(input, 'Exemple');
    expect(onChangeText).toHaveBeenCalledWith('Exemple');

    fireEvent(input, 'focus');
    expect(input).toHaveStyle({ borderColor: tokens.colors.focus });
    fireEvent(input, 'blur');
    expect(input).toHaveStyle({ borderColor: tokens.colors.outline });
  });

  it('une erreur de champ comporte un message accessible, un champ désactivé reste en lecture seule', () => {
    const onChangeText = jest.fn();
    render(
      <Field
        label={fr.design.fields.errorLabel}
        value=""
        onChangeText={onChangeText}
        error={fr.design.fields.error}
        disabled
      />,
    );
    expect(screen.getByRole('alert', { name: fr.design.fields.error })).toBeOnTheScreen();
    const input = screen.getByLabelText(fr.design.fields.errorLabel);
    expect(input).toHaveProp('accessibilityHint', fr.design.fields.error);
    expect(input).toHaveProp('editable', false);
    fireEvent.changeText(input, 'Exemple');
    expect(onChangeText).not.toHaveBeenCalled();
  });

  it('le texte sélectionné Android conserve un fond clair et des poignées distinctes', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    render(<Field label={fr.design.fields.label} value="Exemple" onChangeText={() => {}} />);
    const input = screen.getByLabelText(fr.design.fields.label);
    // Le test des tokens vérifie le contraste encre/fond de sélection ; ici,
    // on vérifie que le TextInput Android reçoit bien cette surface dédiée.
    expect(input).toHaveProp('selectionColor', tokens.colors.selectionSurface);
    expect(input).toHaveProp('cursorColor', tokens.colors.focus);
    expect(input).toHaveProp('selectionHandleColor', tokens.colors.focus);
  });

  it('iOS conserve sa teinte de sélection sans les réglages de poignées Android', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    render(<Field label={fr.design.fields.label} value="Exemple" onChangeText={() => {}} />);
    const input = screen.getByLabelText(fr.design.fields.label);
    expect(input).toHaveProp('selectionColor', tokens.colors.focus);
    expect(input).not.toHaveProp('cursorColor');
    expect(input).not.toHaveProp('selectionHandleColor');
  });

  it.each([
    ['pending', fr.design.cards.pendingLabel],
    ['success', fr.design.cards.successLabel],
    ['error', fr.design.cards.errorLabel],
  ] as const)('la carte %s décrit son état avec des mots', (tone, statusLabel) => {
    render(<Card title={fr.design.cards.neutralTitle} tone={tone} statusLabel={statusLabel} />);
    expect(screen.getByText(statusLabel)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: fr.design.cards.neutralTitle })).toBeOnTheScreen();
  });

  it('une icône seule peut avoir un libellé, les icônes décoratives restent silencieuses', () => {
    const { rerender } = render(<BrandIcon name="info" label={fr.design.icons.info} />);
    expect(screen.getByRole('image', { name: fr.design.icons.info })).toBeOnTheScreen();
    rerender(<BrandIcon name="info" />);
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('le repli typographique retire les familles de marque des composants', () => {
    render(
      <BrandTypographyProvider available={false}>
        <Button label={fr.design.buttons.normal} onPress={() => {}} />
        <Field label={fr.design.fields.label} value="" onChangeText={() => {}} />
      </BrandTypographyProvider>,
    );
    expect(screen.getByText(fr.design.buttons.normal)).toHaveStyle({ fontFamily: undefined });
    expect(screen.getByLabelText(fr.design.fields.label)).toHaveStyle({ fontFamily: undefined });
  });
});

describe('démarrage des polices', () => {
  beforeEach(() => {
    jest.mocked(useFonts).mockReturnValue([true, null]);
  });

  it('permet de continuer avec la police du téléphone pendant le chargement', () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);
    render(<App />);
    expect(screen.getByText(fr.fonts.loading)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.fonts.continueAction }));
    expect(screen.getByRole('header', { name: fr.home.title })).toBeOnTheScreen();
    expect(screen.getByText(fr.fonts.fallback)).toBeOnTheScreen();
  });

  it('une erreur de police affiche une explication et conserve la navigation', () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error('Exemple de police indisponible')]);
    render(<App />);
    expect(screen.getByRole('alert', { name: fr.fonts.error })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: fr.home.title })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.home.designAction }));
    expect(screen.getByRole('header', { name: fr.design.title })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: fr.design.title })).toHaveStyle({
      fontFamily: undefined,
    });
  });
});
