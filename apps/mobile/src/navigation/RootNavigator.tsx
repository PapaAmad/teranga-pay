import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { createContext, useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OnboardingScreen } from '../onboarding/OnboardingScreen';
import { createPlatformServices } from '../onboarding/platform';
import type { OnboardingServices } from '../onboarding/ports';
import { createPreviewServices } from '../onboarding/preview';
import { HomeScreen } from '../home/HomeScreen';
import type { HomeServices } from '../home/ports';
import { createHomePreviewServices, type HomePreviewScenario } from '../home/preview';
import { tokens, useBrandFonts } from '../ui';

import { WalletLabScreen } from '../screens/WalletLabScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { DesignSystemScreen } from '../screens/DesignSystemScreen';
import { useTranslation } from '../translations';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Services = createContext<OnboardingServices | null>(null);
const HomeContext = createContext<HomeServices>({ mode: 'unavailable' });

function HomeRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const services = useContext(HomeContext);
  return (
    <HomeScreen
      services={services}
      onAbout={() => navigation.navigate('About')}
      onDesign={() => navigation.navigate('DesignSystem')}
      onRequireUnlock={() => navigation.replace('Onboarding')}
      onPreview={__DEV__ ? () => navigation.navigate('HomePreview') : undefined}
    />
  );
}

function HomePreviewRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'HomePreview'>) {
  const [services] = useState(createHomePreviewServices);
  const [scenario, setScenario] = useState<HomePreviewScenario>('ready');
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const scenarioNames = [
    ['ready', t('dashboard.scenarios.ready')],
    ['empty', t('dashboard.scenarios.empty')],
    ['offline', t('dashboard.scenarios.offline')],
    ['rateUnavailable', t('dashboard.scenarios.rateUnavailable')],
    ['loading', t('dashboard.scenarios.loading')],
    ['largeAmount', t('dashboard.scenarios.largeAmount')],
    ['error', t('dashboard.scenarios.error')],
  ] as const;
  return (
    <HomeScreen
      services={services}
      onAbout={() => navigation.navigate('About')}
      onDesign={() => navigation.navigate('DesignSystem')}
      onRequireUnlock={() => navigation.navigate('Onboarding')}
      onExitPreview={() => navigation.goBack()}
      previewControls={
        <View style={previewStyles.panel}>
          <Text
            accessibilityRole="header"
            style={{
              ...tokens.typography.label,
              color: tokens.colors.ink,
              fontFamily: fonts.title,
            }}
          >
            {t('dashboard.scenarios.title')}
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('dashboard.scenarios.title')}
            style={previewStyles.choices}
          >
            {scenarioNames.map(([key, name]) => (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={name}
                accessibilityState={{ checked: scenario === key }}
                aria-checked={scenario === key}
                onPress={() => {
                  setScenario(key);
                  services.setScenario(key);
                }}
                style={({ pressed }) => [
                  previewStyles.choice,
                  scenario === key && previewStyles.selected,
                  pressed && previewStyles.pressed,
                ]}
              >
                <Text
                  style={{
                    ...tokens.typography.label,
                    fontFamily: fonts.label,
                    color: scenario === key ? tokens.colors.onPrimary : tokens.colors.ink,
                  }}
                >
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
    />
  );
}

const previewStyles = StyleSheet.create({
  panel: { gap: 12, paddingVertical: 12 },
  choices: { gap: 8 },
  choice: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    minHeight: 48,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.line,
  },
  selected: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  pressed: { opacity: 0.7 },
});

function OnboardingRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Onboarding'>) {
  const services = useContext(Services);
  if (!services) throw new Error('Onboarding services unavailable');
  return (
    <OnboardingScreen
      services={services}
      onDiscover={() => navigation.navigate('About')}
      onFinished={() => navigation.replace('Home')}
      onPreview={__DEV__ ? () => navigation.navigate('OnboardingPreview') : undefined}
    />
  );
}

function PreviewRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'OnboardingPreview'>) {
  const [services] = useState(createPreviewServices);
  return (
    <OnboardingScreen
      services={services}
      onDiscover={() => navigation.navigate('About')}
      onFinished={() => navigation.goBack()}
      onExitPreview={() => navigation.goBack()}
    />
  );
}

/** L'atelier wallet s'ouvre par `terangapay://labo-wallet`, en développement seulement. */
const linking: LinkingOptions<RootStackParamList> | undefined = __DEV__
  ? { prefixes: ['terangapay://'], config: { screens: { WalletLab: 'labo-wallet' } } }
  : undefined;

export function RootNavigator({
  initialRoute = 'Onboarding',
  onboardingServices,
  homeServices,
}: {
  initialRoute?: keyof RootStackParamList;
  onboardingServices?: OnboardingServices;
  homeServices?: HomeServices;
}) {
  const { t } = useTranslation();
  const [services] = useState(() => onboardingServices ?? createPlatformServices());
  const [dashboard] = useState<HomeServices>(() => homeServices ?? { mode: 'unavailable' });

  return (
    <Services.Provider value={services}>
      <HomeContext.Provider value={dashboard}>
        <NavigationContainer linking={linking}>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{ headerBackTitle: t('navigation.back') }}
          >
            <Stack.Screen
              name="Onboarding"
              component={OnboardingRoute}
              options={{ headerShown: false, title: t('appName') }}
            />
            {__DEV__ && (
              <Stack.Screen
                name="OnboardingPreview"
                component={PreviewRoute}
                options={{ headerShown: false, title: t('appName') }}
              />
            )}
            <Stack.Screen
              name="Home"
              component={HomeRoute}
              options={{ headerShown: false, title: t('appName') }}
            />
            {__DEV__ && (
              <Stack.Screen
                name="HomePreview"
                component={HomePreviewRoute}
                options={{ headerShown: false, title: t('appName') }}
              />
            )}
            <Stack.Screen
              name="About"
              component={AboutScreen}
              options={{ title: t('navigation.about') }}
            />
            <Stack.Screen
              name="DesignSystem"
              component={DesignSystemScreen}
              options={{ title: t('navigation.designSystem') }}
            />
            {__DEV__ ? (
              <Stack.Screen
                name="WalletLab"
                component={WalletLabScreen}
                options={{ title: t('walletLab.title') }}
              />
            ) : null}
          </Stack.Navigator>
        </NavigationContainer>
      </HomeContext.Provider>
    </Services.Provider>
  );
}
