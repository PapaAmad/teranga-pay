import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { createContext, useContext, useState } from 'react';

import { OnboardingScreen } from '../onboarding/OnboardingScreen';
import { createPlatformServices } from '../onboarding/platform';
import type { OnboardingServices } from '../onboarding/ports';
import { createPreviewServices } from '../onboarding/preview';

import { WalletLabScreen } from '../screens/WalletLabScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { DesignSystemScreen } from '../screens/DesignSystemScreen';
import { useTranslation } from '../translations';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Services = createContext<OnboardingServices | null>(null);

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
}: {
  initialRoute?: keyof RootStackParamList;
  onboardingServices?: OnboardingServices;
}) {
  const { t } = useTranslation();
  const [services] = useState(() => onboardingServices ?? createPlatformServices());

  return (
    <Services.Provider value={services}>
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
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: t('appName') }} />
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
    </Services.Provider>
  );
}
