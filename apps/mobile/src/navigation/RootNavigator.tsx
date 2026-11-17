import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AboutScreen } from '../screens/AboutScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { DesignSystemScreen } from '../screens/DesignSystemScreen';
import { WalletLabScreen } from '../screens/WalletLabScreen';
import { useTranslation } from '../translations';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** L'atelier wallet s'ouvre par `terangapay://labo-wallet`, en développement seulement. */
const linking: LinkingOptions<RootStackParamList> | undefined = __DEV__
  ? { prefixes: ['terangapay://'], config: { screens: { WalletLab: 'labo-wallet' } } }
  : undefined;

export function RootNavigator() {
  const { t } = useTranslation();

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerBackTitle: t('navigation.back') }}
      >
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
  );
}
