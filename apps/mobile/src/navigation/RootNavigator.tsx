import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AboutScreen } from '../screens/AboutScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { DesignSystemScreen } from '../screens/DesignSystemScreen';
import { useTranslation } from '../translations';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { t } = useTranslation();

  return (
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
