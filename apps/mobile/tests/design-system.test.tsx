import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import Svg from 'react-native-svg';

import App from '../App';
import { createAppI18n } from '../src/translations';
import { fr } from '../src/translations/fr';
import {
  BrandIcon,
  BrandMark,
  BrandTypographyProvider,
  Button,
  Card,
  Field,
  tokens,
} from '../src/ui';

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

  it.each([{}, { loading: true }, { disabled: true }, { variant: 'secondary' as const }])(
    'le bouton conserve une cible de 48 dp au minimum (%j)',
    (props) => {
      render(<Button label={fr.design.buttons.normal} onPress={() => {}} {...props} />);
      const style = StyleSheet.flatten(
        screen.getByRole('button', { name: fr.design.buttons.normal }).props.style,
      );
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      // Une hauteur fixe empêcherait le contrôle de grandir avec le texte.
      expect(style.height).toBeUndefined();
    },
  );

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

  it.each([false, true])('le champ garde sa hauteur minimale, désactivé : %s', (disabled) => {
    render(
      <Field label={fr.design.fields.label} value="" onChangeText={() => {}} disabled={disabled} />,
    );
    const input = screen.getByLabelText(fr.design.fields.label);
    fireEvent(input, 'focus');
    const style = StyleSheet.flatten(input.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style.height).toBeUndefined();
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

  it.each(['icon', 'mark'] as const)(
    'le graphique %s expose son nom sur le Web et reste silencieux sans libellé',
    (kind) => {
      jest.replaceProperty(Platform, 'OS', 'web');
      const labeled =
        kind === 'icon' ? (
          <BrandIcon name="info" label={fr.design.icons.info} />
        ) : (
          <BrandMark label={fr.appName} />
        );
      const { rerender } = render(labeled);
      const svg = screen.UNSAFE_getByType(Svg);
      expect(svg.props).toMatchObject({
        'aria-label': kind === 'icon' ? fr.design.icons.info : fr.appName,
        'aria-hidden': false,
        role: 'img',
      });
      expect(svg.props.importantForAccessibility).toBeUndefined();

      rerender(kind === 'icon' ? <BrandIcon name="info" /> : <BrandMark />);
      const decorative = screen.UNSAFE_getByType(Svg);
      expect(decorative.props['aria-hidden']).toBe(true);
      expect(decorative.props['aria-label']).toBeUndefined();
      expect(decorative.props.role).toBeUndefined();
    },
  );

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

  it('le montant de démonstration ne contient aucun espace autorisant une coupure', () => {
    expect(fr.design.amount).toMatch(/^\d{1,3}(?:[\u202f\u00a0]\d{3})*[\u202f\u00a0]FCFA$/);
    expect(fr.design.amount).not.toMatch(/[ \t\r\n]/);
  });
});

describe('démarrage des polices', () => {
  beforeEach(() => {
    jest.mocked(useFonts).mockClear();
    jest.mocked(useFonts).mockReturnValue([true, null]);
  });

  it('enregistre les familles des tokens et les applique quand les polices sont prêtes', async () => {
    render(<App initialRoute="Home" i18n={createAppI18n()} />);
    const registered = jest.mocked(useFonts).mock.calls[0]?.[0] ?? {};
    expect(Object.keys(registered).sort()).toEqual(Object.values(tokens.fonts).sort());
    expect(await screen.findByRole('header', { name: 'Bienvenue sur Teranga Pay' })).toHaveStyle({
      fontFamily: tokens.fonts.title,
    });
    expect(screen.getByText(fr.home.aboutAction)).toHaveStyle({ fontFamily: tokens.fonts.label });
    fireEvent.press(screen.getByRole('button', { name: fr.home.designAction }));
    expect(screen.getByLabelText(fr.design.fields.label)).toHaveStyle({
      fontFamily: tokens.fonts.body,
    });
  });

  it('place les deux actions de l’accueil dans un contenu défilable qui peut grandir', async () => {
    render(<App initialRoute="Home" i18n={createAppI18n()} />);
    await screen.findByRole('header', { name: 'Bienvenue sur Teranga Pay' });
    const scroll = screen.UNSAFE_getByType(ScrollView);
    const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(contentStyle.flexGrow).toBe(1);
    expect(contentStyle.flex).toBeUndefined();
    expect(within(scroll).getByRole('button', { name: fr.home.aboutAction })).toBeOnTheScreen();
    expect(within(scroll).getByRole('button', { name: fr.home.designAction })).toBeOnTheScreen();
  });

  it('permet de continuer avec la police du téléphone pendant le chargement', async () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);
    render(<App initialRoute="Home" i18n={createAppI18n()} />);
    expect(screen.getByText('Préparation de Teranga Pay…')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.fonts.continueAction }));
    expect(await screen.findByRole('header', { name: 'Bienvenue sur Teranga Pay' })).toHaveStyle({
      fontWeight: '700',
    });
    expect(screen.getByText(fr.fonts.fallback)).toBeOnTheScreen();
  });

  it('réutilise le nom du catalogue dans le chargement, l’accueil et la présentation', async () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);
    const i18n = createAppI18n();
    i18n.addResourceBundle('fr', 'translation', { appName: 'Nom témoin' }, true, true);
    render(<App initialRoute="Home" i18n={i18n} />);
    expect(screen.getByText('Préparation de Nom témoin…')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: fr.fonts.continueAction }));
    expect(
      await screen.findByRole('header', { name: 'Bienvenue sur Nom témoin' }),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.home.aboutAction }));
    expect(
      screen.getByText(
        'Nom témoin est un projet open source porté par Salam et PAN pour faciliter les paiements Bitcoin et Lightning au Sénégal.',
      ),
    ).toBeOnTheScreen();
  });

  it('revient aux polices de marque après avoir continué sans attendre, sans perdre le parcours', async () => {
    jest.mocked(useFonts).mockReturnValue([false, null]);
    const i18n = createAppI18n();
    const { rerender } = render(<App initialRoute="Home" i18n={i18n} />);
    fireEvent.press(screen.getByRole('button', { name: fr.fonts.continueAction }));
    await screen.findByRole('header', { name: 'Bienvenue sur Teranga Pay' });
    fireEvent.press(screen.getByRole('button', { name: fr.home.designAction }));
    expect(screen.getByRole('header', { name: fr.design.title })).toHaveStyle({
      fontFamily: undefined,
    });
    fireEvent.changeText(screen.getByLabelText(fr.design.fields.label), 'Exemple conservé');

    jest.mocked(useFonts).mockReturnValue([true, null]);
    rerender(<App initialRoute="Home" i18n={i18n} />);

    expect(screen.queryByText(fr.fonts.fallback)).toBeNull();
    expect(screen.queryByText('Préparation de Teranga Pay…')).toBeNull();
    expect(screen.getByRole('header', { name: fr.design.title })).toHaveStyle({
      fontFamily: tokens.fonts.title,
    });
    expect(screen.getByLabelText(fr.design.fields.label)).toHaveProp('value', 'Exemple conservé');
    expect(screen.getByLabelText(fr.design.fields.label)).toHaveStyle({
      fontFamily: tokens.fonts.body,
    });
  });

  it('une erreur de police affiche une explication et conserve la navigation', async () => {
    jest.mocked(useFonts).mockReturnValue([false, new Error('Exemple de police indisponible')]);
    render(<App initialRoute="Home" i18n={createAppI18n()} />);
    expect(screen.getByRole('alert', { name: fr.fonts.error })).toBeOnTheScreen();
    expect(
      await screen.findByRole('header', { name: 'Bienvenue sur Teranga Pay' }),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.home.designAction }));
    expect(screen.getByRole('header', { name: fr.design.title })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: fr.design.title })).toHaveStyle({
      fontFamily: undefined,
    });
  });
});
