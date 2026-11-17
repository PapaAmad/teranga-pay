import { act, fireEvent, render, screen } from '@testing-library/react-native';

import App from '../App';
import { WalletLabScreen } from '../src/screens/WalletLabScreen';
import {
  createAppI18n,
  resolveLanguage,
  setAppLanguage,
  TranslationProvider,
} from '../src/translations';
import { fr } from '../src/translations/fr';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));

const homeTitle = 'Bienvenue sur Teranga Pay';

function leaves(catalog: object, prefix = ''): [string, string][] {
  return Object.entries(catalog).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[path, value]] : leaves(value, path);
  });
}

describe('ressources T09', () => {
  it('fournit immédiatement toutes les clés françaises non vides hors connexion', () => {
    const instance = createAppI18n();
    expect(instance.isInitialized).toBe(true);
    expect(instance.language).toBe('fr');
    for (const [key, value] of leaves(fr)) {
      expect(value.trim()).not.toBe('');
      expect(instance.getResource('fr', 'translation', key)).toBe(value);
    }
    expect(instance.t('home.title', { appName: instance.t('appName') })).toBe(homeTitle);
  });

  it.each(['wo', 'wo-SN', 'wo_SN'])(
    'prépare %s avec repli français sans fausse traduction',
    (code) => {
      const instance = createAppI18n(code);
      expect(instance.language).toBe('wo');
      expect(instance.getResourceBundle('wo', 'translation')).toEqual({});
      expect(instance.t('home.title', { appName: instance.t('appName') })).toBe(homeTitle);
    },
  );

  it.each([undefined, null, 42, {}, '', 'en-US', 'fr-SN'])(
    'une préférence %j utilise le français',
    (code) => {
      expect(resolveLanguage(code)).toBe('fr');
      const instance = createAppI18n(code);
      expect(instance.t('home.title', { appName: instance.t('appName') })).toBe(homeTitle);
    },
  );

  it.each(['', null])(
    'revient aussi au français si une traduction ajoutée vaut %j',
    async (value) => {
      const instance = createAppI18n('wo');
      instance.addResourceBundle('wo', 'translation', { home: { title: value } }, true, true);
      await setAppLanguage(instance, 'wo-SN');
      expect(instance.t('home.title', { appName: instance.t('appName') })).toBe(homeTitle);
    },
  );

  it('garde les ressources et la langue propres à chaque instance', async () => {
    const first = createAppI18n();
    const second = createAppI18n();
    first.addResourceBundle(
      'fr',
      'translation',
      { home: { title: 'Titre témoin isolé' } },
      true,
      true,
    );
    await setAppLanguage(first, 'wo');
    expect(first.t('home.title', { appName: first.t('appName') })).toBe('Titre témoin isolé');
    expect(second.language).toBe('fr');
    expect(second.t('home.title', { appName: second.t('appName') })).toBe(homeTitle);
    expect(fr.home.title).toBe('Bienvenue sur {{appName}}');
  });

  it.each([
    ['fonts.loading', 'Préparation de Nom & exemple…'],
    ['home.title', 'Bienvenue sur Nom & exemple'],
    [
      'about.description',
      'Nom & exemple est un projet open source porté par Salam et PAN pour faciliter les paiements Bitcoin et Lightning au Sénégal.',
    ],
  ] as const)('interpole le nom sans échappement HTML dans %s', (key, expected) => {
    const instance = createAppI18n();
    expect(instance.t(key, { appName: 'Nom & exemple' })).toBe(expected);
  });
});

describe('changement de langue dans le parcours existant', () => {
  it('actualise aussi l’atelier wallet quand le module natif est absent', async () => {
    const instance = createAppI18n();
    instance.addResourceBundle('wo', 'translation', {
      walletLab: { title: 'Atelier témoin', unavailable: 'Module témoin absent' },
    });
    render(
      <TranslationProvider i18n={instance}>
        <WalletLabScreen />
      </TranslationProvider>,
    );
    expect(screen.getByRole('header', { name: fr.walletLab.title })).toBeOnTheScreen();
    expect(screen.getByText(fr.walletLab.unavailable)).toBeOnTheScreen();

    await act(async () => {
      await setAppLanguage(instance, 'wo');
    });

    expect(screen.getByRole('header', { name: 'Atelier témoin' })).toBeOnTheScreen();
    expect(screen.getByText('Module témoin absent')).toBeOnTheScreen();
  });

  it('actualise écran, navigation et accessibilité sans perdre la saisie', async () => {
    const instance = createAppI18n();
    // Textes témoins français uniquement : cette fixture ne constitue pas une
    // traduction wolof et n'appartient pas au catalogue livré.
    instance.addResourceBundle('wo', 'translation', {
      appName: 'Nom témoin',
      navigation: { designSystem: 'Navigation témoin' },
      design: {
        title: 'Titre témoin du test',
        fields: { label: 'Champ témoin' },
        backAction: 'Retour témoin',
      },
    });
    render(<App i18n={instance} />);
    await screen.findByRole('header', { name: homeTitle });
    fireEvent.press(screen.getByRole('button', { name: fr.home.designAction }));
    fireEvent.changeText(screen.getByLabelText(fr.design.fields.label), 'Saisie conservée');

    await act(async () => {
      await setAppLanguage(instance, 'wo-SN');
    });

    expect(screen.getByRole('header', { name: 'Titre témoin du test' })).toBeOnTheScreen();
    // Le titre natif est une prop du mock de react-native-screens, pas un Text.
    expect(screen.UNSAFE_getAllByProps({ title: 'Navigation témoin' }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Champ témoin')).toHaveProp('value', 'Saisie conservée');
    expect(screen.getByText(fr.design.fields.helper)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Retour témoin' }));
    expect(screen.getByRole('header', { name: 'Bienvenue sur Nom témoin' })).toBeOnTheScreen();
  });
});
