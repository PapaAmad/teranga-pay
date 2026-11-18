import { NavigationContainer, type LinkingOptions, useIsFocused } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OnboardingScreen } from '../onboarding/OnboardingScreen';
import { createPlatformServices } from '../onboarding/platform';
import type { OnboardingServices } from '../onboarding/ports';
import { createPreviewServices } from '../onboarding/preview';
import { HomeScreen } from '../home/HomeScreen';
import type { HomeServices } from '../home/ports';
import { createHomePreviewServices, type HomePreviewScenario } from '../home/preview';
import { ReceiveScreen } from '../receive/ReceiveScreen';
import type { ReceiveServices } from '../receive/ports';
import { createReceivePreviewServices, type ReceivePreviewScenario } from '../receive/preview';
import { receivePlatform, type ReceivePlatformPort } from '../receive/platform';
import { SendScreen } from '../send/SendScreen';
import { CollectScreen } from '../collect/CollectScreen';
import type { CollectServices } from '../collect/ports';
import { createCollectPreviewServices, type CollectPreviewScenario } from '../collect/preview';
import { collectPlatform, type CollectPlatformPort } from '../collect/platform';
import type { SendServices } from '../send/ports';
import {
  createSendPreviewServices,
  sendPreviewAddress,
  sendPreviewInvoice,
  type SendPreviewScenario,
} from '../send/preview';
import { Button, tokens, useBrandFonts } from '../ui';
import { HistoryScreen } from '../history/HistoryScreen';
import type { HistoryServices } from '../history/ports';
import { createHistoryPreviewServices, type HistoryPreviewScenario } from '../history/preview';
import { WithdrawScreen } from '../withdraw/WithdrawScreen';
import type { WithdrawServices } from '../withdraw/ports';
import { createWithdrawPreviewServices, type WithdrawPreviewScenario } from '../withdraw/preview';

import { WalletLabScreen } from '../screens/WalletLabScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { DesignSystemScreen } from '../screens/DesignSystemScreen';
import { useTranslation } from '../translations';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Services = createContext<OnboardingServices | null>(null);
const HomeContext = createContext<HomeServices>({ mode: 'unavailable' });
const ReceiveContext = createContext<ReceiveServices>({ mode: 'unavailable' });
const SendContext = createContext<SendServices>({ mode: 'unavailable' });
const CollectContext = createContext<CollectServices>({ mode: 'unavailable' });
const HistoryContext = createContext<HistoryServices | null>(null);
const WithdrawContext = createContext<WithdrawServices>({ mode: 'unavailable' });

function HomeRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const services = useContext(HomeContext);
  return (
    <HomeScreen
      services={services}
      onAbout={() => navigation.navigate('About')}
      onDesign={() => navigation.navigate('DesignSystem')}
      onRequireUnlock={() => navigation.replace('Onboarding')}
      onReceive={() => navigation.navigate('Receive')}
      onSend={() => navigation.navigate('Send')}
      onCollect={() => navigation.navigate('Collect')}
      onHistory={() => navigation.navigate('History')}
      onWithdraw={() => navigation.navigate('Withdraw')}
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
      onReceive={() => navigation.navigate('ReceivePreview')}
      onSend={() => navigation.navigate('SendPreview')}
      onCollect={() => navigation.navigate('CollectPreview')}
      onHistory={() => navigation.navigate('HistoryPreview')}
      onWithdraw={() => navigation.navigate('WithdrawPreview')}
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

function ReceiveRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Receive'>) {
  const services = useContext(ReceiveContext);
  const active = useIsFocused();
  return (
    <ReceiveScreen
      services={services}
      active={active}
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
      onRequireUnlock={() => navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })}
      onPreview={__DEV__ ? () => navigation.navigate('ReceivePreview') : undefined}
    />
  );
}

type ReceiveWorkshopScenario =
  | ReceivePreviewScenario
  | 'copyFailure'
  | 'shareDismissed'
  | 'shareFailure'
  | 'unavailable'
  | 'locked';

function ReceivePreviewRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'ReceivePreview'>) {
  const [services] = useState(createReceivePreviewServices);
  const [scenario, setScenario] = useState<ReceiveWorkshopScenario>('ready');
  const scenarioRef = useRef<ReceiveWorkshopScenario>('ready');
  const active = useIsFocused();
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const [platform] = useState<ReceivePlatformPort>(() => ({
    copy: (value) =>
      scenarioRef.current === 'copyFailure' ? Promise.resolve(false) : receivePlatform.copy(value),
    share: (value) => {
      if (scenarioRef.current === 'shareDismissed') return Promise.resolve('dismissed');
      if (scenarioRef.current === 'shareFailure')
        return Promise.reject(new Error('SHARE_UNAVAILABLE'));
      return receivePlatform.share(value);
    },
  }));
  const names = [
    ['ready', t('receive.scenarios.ready')],
    ['offline', t('receive.scenarios.offline')],
    ['loading', t('receive.scenarios.loading')],
    ['error', t('receive.scenarios.error')],
    ['longAddress', t('receive.scenarios.longAddress')],
    ['copyFailure', t('receive.scenarios.copyFailure')],
    ['shareDismissed', t('receive.scenarios.shareDismissed')],
    ['shareFailure', t('receive.scenarios.shareFailure')],
    ['unavailable', t('receive.scenarios.unavailable')],
    ['locked', t('receive.scenarios.locked')],
  ] as const;
  return (
    <ReceiveScreen
      key={scenario}
      services={
        scenario === 'unavailable'
          ? { mode: 'preview' }
          : scenario === 'locked'
            ? { ...services, wallet: { ...services.wallet!, state: async () => 'verrouille' } }
            : services
      }
      active={active}
      platform={platform}
      onBack={() => navigation.goBack()}
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
            {t('receive.scenarios.title')}
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('receive.scenarios.title')}
            style={previewStyles.choices}
          >
            {names.map(([key, name]) => (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={name}
                accessibilityState={{ checked: scenario === key }}
                aria-checked={scenario === key}
                onPress={() => {
                  scenarioRef.current = key;
                  setScenario(key);
                  services.setScenario(
                    key === 'ready' ||
                      key === 'offline' ||
                      key === 'loading' ||
                      key === 'error' ||
                      key === 'longAddress'
                      ? key
                      : 'ready',
                  );
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

function SendRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Send'>) {
  const services = useContext(SendContext);
  const active = useIsFocused();
  return (
    <SendScreen
      services={services}
      active={active}
      onBack={() => navigation.goBack()}
      onRequireUnlock={() => navigation.navigate('Onboarding')}
      onPreview={__DEV__ ? () => navigation.navigate('SendPreview') : undefined}
    />
  );
}

function SendPreviewRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'SendPreview'>) {
  const [scenario, setScenario] = useState<SendPreviewScenario>('success');
  const services = useMemo(() => createSendPreviewServices(scenario), [scenario]);
  const active = useIsFocused();
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const names: SendPreviewScenario[] = [
    'success',
    'pending',
    'unknown',
    'failed',
    'PIN_INVALID',
    'expired',
    'insufficient',
    'offline',
    'error',
    'feesUnavailable',
    'amountRequested',
    'invalid',
  ];
  return (
    <SendScreen
      key={scenario}
      services={services}
      active={active}
      onBack={() => navigation.goBack()}
      onRequireUnlock={() => navigation.navigate('Onboarding')}
      onExitPreview={() => navigation.goBack()}
      previewDestination={sendPreviewInvoice}
      previewAddress={sendPreviewAddress}
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
            {t('send.scenarios.title')}
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('send.scenarios.title')}
            style={previewStyles.choices}
          >
            {names.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={t(`send.scenarios.${key}`)}
                accessibilityState={{ checked: scenario === key }}
                aria-checked={scenario === key}
                onPress={() => setScenario(key)}
                style={[previewStyles.choice, scenario === key && previewStyles.selected]}
              >
                <Text
                  style={{
                    ...tokens.typography.label,
                    fontFamily: fonts.label,
                    color: scenario === key ? tokens.colors.onPrimary : tokens.colors.ink,
                  }}
                >
                  {t(`send.scenarios.${key}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
    />
  );
}

function CollectRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Collect'>) {
  const services = useContext(CollectContext);
  const active = useIsFocused();
  return (
    <CollectScreen
      services={services}
      active={active}
      onBack={() => navigation.goBack()}
      onRequireUnlock={() => navigation.navigate('Onboarding')}
      onPreview={__DEV__ ? () => navigation.navigate('CollectPreview') : undefined}
    />
  );
}
type CollectWorkshopScenario =
  CollectPreviewScenario | 'unavailable' | 'copyFailed' | 'shareDismissed' | 'shareUnavailable';
function CollectPreviewRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'CollectPreview'>) {
  const [scenario, setScenario] = useState<CollectWorkshopScenario>('waiting');
  const services = useMemo(
    () =>
      createCollectPreviewServices(
        scenario === 'unavailable' ||
          scenario === 'copyFailed' ||
          scenario === 'shareDismissed' ||
          scenario === 'shareUnavailable'
          ? 'waiting'
          : scenario,
      ),
    [scenario],
  );
  const unavailable = useMemo<CollectServices>(() => ({ mode: 'preview' }), []);
  const platform = useMemo<CollectPlatformPort>(
    () => ({
      copyPaymentRequest:
        scenario === 'copyFailed' ? async () => false : collectPlatform.copyPaymentRequest,
      share:
        scenario === 'shareDismissed'
          ? async () => 'dismissed'
          : scenario === 'shareUnavailable'
            ? async () => {
                throw new Error('SHARE_UNAVAILABLE');
              }
            : collectPlatform.share,
    }),
    [scenario],
  );
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const active = useIsFocused();
  const names: CollectWorkshopScenario[] = [
    'waiting',
    'paid',
    'late',
    'expired',
    'unknown',
    'offline',
    'locked',
    'error',
    'mismatch',
    'longInvoice',
    'unavailable',
    'copyFailed',
    'shareDismissed',
    'shareUnavailable',
  ];
  return (
    <CollectScreen
      key={scenario}
      services={scenario === 'unavailable' ? unavailable : services}
      clock={services.now}
      active={active}
      platform={platform}
      onBack={() => navigation.goBack()}
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
            {t('collect.scenarios.title')}
          </Text>
          <Button
            label={t('collect.scenarios.confirm')}
            variant="secondary"
            onPress={() => services.confirmPayment()}
          />
          <Button
            label={t('collect.scenarios.expire')}
            variant="secondary"
            onPress={() => services.advanceTime(301000)}
          />
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('collect.scenarios.title')}
            style={previewStyles.choices}
          >
            {names.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={t(`collect.scenarios.${key}`)}
                accessibilityState={{ checked: scenario === key }}
                aria-checked={scenario === key}
                onPress={() => setScenario(key)}
                style={[previewStyles.choice, scenario === key && previewStyles.selected]}
              >
                <Text
                  style={{
                    ...tokens.typography.label,
                    fontFamily: fonts.label,
                    color: scenario === key ? tokens.colors.onPrimary : tokens.colors.ink,
                  }}
                >
                  {t(`collect.scenarios.${key}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
    />
  );
}

function HistoryRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'History'>) {
  const explicit = useContext(HistoryContext);
  const home = useContext(HomeContext);
  const services = useMemo<HistoryServices>(
    () => explicit ?? { mode: home.mode, wallet: home.wallet },
    [explicit, home],
  );
  const active = useIsFocused();
  return (
    <HistoryScreen
      services={services}
      active={active}
      onBack={() => navigation.goBack()}
      onRequireUnlock={() => navigation.navigate('Onboarding')}
      onPreview={__DEV__ ? () => navigation.navigate('HistoryPreview') : undefined}
    />
  );
}
type HistoryWorkshopScenario = HistoryPreviewScenario | 'shareDismissed' | 'shareUnavailable';
function HistoryPreviewRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'HistoryPreview'>) {
  const [scenario, setScenario] = useState<HistoryWorkshopScenario>('ready');
  const services = useMemo(
    () =>
      createHistoryPreviewServices(
        scenario === 'shareDismissed' || scenario === 'shareUnavailable' ? 'ready' : scenario,
      ),
    [scenario],
  );
  const platform = useMemo<Pick<ReceivePlatformPort, 'share'>>(
    () => ({
      share:
        scenario === 'shareDismissed'
          ? async () => 'dismissed'
          : scenario === 'shareUnavailable'
            ? async () => {
                throw new Error('SHARE_UNAVAILABLE');
              }
            : receivePlatform.share,
    }),
    [scenario],
  );
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const active = useIsFocused();
  const names: HistoryWorkshopScenario[] = [
    'ready',
    'empty',
    'partial',
    'offline',
    'walletError',
    'withdrawalError',
    'unknownAmounts',
    'largeAmount',
    'locked',
    'pagingError',
    'shareDismissed',
    'shareUnavailable',
  ];
  return (
    <HistoryScreen
      key={scenario}
      services={services}
      active={active}
      clock={services.now}
      platform={platform}
      onBack={() => navigation.goBack()}
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
            {t('history.scenarios.title')}
          </Text>
          <Button
            label={t('history.scenarios.confirm')}
            variant="secondary"
            onPress={() => services.confirmPending()}
          />
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('history.scenarios.title')}
            style={previewStyles.choices}
          >
            {names.map((name) => (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityLabel={t(`history.scenarios.${name}`)}
                accessibilityState={{ checked: scenario === name }}
                aria-checked={scenario === name}
                onPress={() => setScenario(name)}
                style={[previewStyles.choice, scenario === name && previewStyles.selected]}
              >
                <Text
                  style={{
                    ...tokens.typography.label,
                    color: scenario === name ? tokens.colors.onPrimary : tokens.colors.ink,
                    fontFamily: fonts.label,
                  }}
                >
                  {t(`history.scenarios.${name}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
    />
  );
}

function WithdrawRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Withdraw'>) {
  const services = useContext(WithdrawContext);
  const active = useIsFocused();
  return (
    <WithdrawScreen
      services={services}
      active={active}
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
      onPreview={__DEV__ ? () => navigation.navigate('WithdrawPreview') : undefined}
    />
  );
}

function WithdrawPreviewRoute({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'WithdrawPreview'>) {
  const [scenario, setScenario] = useState<WithdrawPreviewScenario>('ready');
  const services = useMemo(() => createWithdrawPreviewServices(scenario), [scenario]);
  const active = useIsFocused();
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const scenarios = [
    'ready',
    'pending',
    'lostResponse',
    'providerUnavailable',
    'declined',
    'emptyBalance',
    'quoteFailure',
    'offline',
    'journalFailure',
  ] as const;
  return (
    <WithdrawScreen
      key={scenario}
      services={services}
      active={active}
      clock={services.now}
      onBack={() => navigation.goBack()}
      onExitPreview={() => navigation.goBack()}
      previewControls={
        <>
          <Text
            accessibilityRole="header"
            style={{
              ...tokens.typography.label,
              color: tokens.colors.ink,
              fontFamily: fonts.title,
            }}
          >
            {t('withdraw.scenarios.title')}
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('withdraw.scenarios.title')}
            style={previewStyles.choices}
          >
            {scenarios.map((name) => (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityLabel={t(`withdraw.scenarios.${name}`)}
                accessibilityState={{ checked: scenario === name }}
                aria-checked={scenario === name}
                onPress={() => setScenario(name)}
                style={({ pressed }) => [
                  previewStyles.choice,
                  scenario === name && previewStyles.selected,
                  pressed && previewStyles.pressed,
                ]}
              >
                <Text
                  style={{
                    ...tokens.typography.label,
                    fontFamily: fonts.label,
                    color: scenario === name ? tokens.colors.onPrimary : tokens.colors.ink,
                  }}
                >
                  {t(`withdraw.scenarios.${name}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            label={t('withdraw.scenarios.expire')}
            variant="secondary"
            onPress={services.expireQuote}
          />
          <Button
            label={t('withdraw.scenarios.complete')}
            variant="secondary"
            onPress={services.completePending}
          />
          <Button
            label={t('withdraw.scenarios.restore')}
            variant="secondary"
            onPress={services.restoreProvider}
          />
        </>
      }
    />
  );
}

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
  receiveServices,
  sendServices,
  collectServices,
  historyServices,
  withdrawServices,
}: {
  initialRoute?: keyof RootStackParamList;
  onboardingServices?: OnboardingServices;
  homeServices?: HomeServices;
  receiveServices?: ReceiveServices;
  sendServices?: SendServices;
  collectServices?: CollectServices;
  historyServices?: HistoryServices;
  withdrawServices?: WithdrawServices;
}) {
  const { t } = useTranslation();
  const [services] = useState(() => onboardingServices ?? createPlatformServices());
  const [dashboard] = useState<HomeServices>(() => homeServices ?? { mode: 'unavailable' });
  const [receiving] = useState<ReceiveServices>(() => receiveServices ?? { mode: 'unavailable' });
  const [sending] = useState<SendServices>(() => sendServices ?? { mode: 'unavailable' });
  const [collecting] = useState<CollectServices>(() => collectServices ?? { mode: 'unavailable' });
  const [history] = useState<HistoryServices | null>(() => historyServices ?? null);
  const [withdrawal] = useState<WithdrawServices>(
    () => withdrawServices ?? { mode: 'unavailable' },
  );

  return (
    <Services.Provider value={services}>
      <HomeContext.Provider value={dashboard}>
        <ReceiveContext.Provider value={receiving}>
          <SendContext.Provider value={sending}>
            <CollectContext.Provider value={collecting}>
              <HistoryContext.Provider value={history}>
                <NavigationContainer linking={linking}>
                  <WithdrawContext.Provider value={withdrawal}>
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
                      <Stack.Screen
                        name="History"
                        component={HistoryRoute}
                        options={{ headerShown: false, title: t('history.navigation') }}
                      />
                      <Stack.Screen
                        name="Withdraw"
                        component={WithdrawRoute}
                        options={{ headerShown: false, title: t('withdraw.navigation') }}
                      />
                      {__DEV__ && (
                        <Stack.Screen
                          name="WithdrawPreview"
                          component={WithdrawPreviewRoute}
                          options={{ headerShown: false, title: t('withdraw.navigation') }}
                        />
                      )}
                      {__DEV__ && (
                        <Stack.Screen
                          name="HistoryPreview"
                          component={HistoryPreviewRoute}
                          options={{ headerShown: false, title: t('history.navigation') }}
                        />
                      )}
                      {__DEV__ && (
                        <Stack.Screen
                          name="HomePreview"
                          component={HomePreviewRoute}
                          options={{ headerShown: false, title: t('appName') }}
                        />
                      )}
                      <Stack.Screen
                        name="Receive"
                        component={ReceiveRoute}
                        options={{ headerShown: false, title: t('receive.navigation') }}
                      />
                      {__DEV__ && (
                        <Stack.Screen
                          name="ReceivePreview"
                          component={ReceivePreviewRoute}
                          options={{ headerShown: false, title: t('receive.navigation') }}
                        />
                      )}
                      <Stack.Screen
                        name="About"
                        component={AboutScreen}
                        options={{ title: t('navigation.about') }}
                      />
                      <Stack.Screen
                        name="Send"
                        component={SendRoute}
                        options={{ headerShown: false, title: t('send.navigation') }}
                      />
                      {__DEV__ && (
                        <Stack.Screen
                          name="SendPreview"
                          component={SendPreviewRoute}
                          options={{ headerShown: false, title: t('send.navigation') }}
                        />
                      )}
                      <Stack.Screen
                        name="DesignSystem"
                        component={DesignSystemScreen}
                        options={{ title: t('navigation.designSystem') }}
                      />
                      <Stack.Screen
                        name="Collect"
                        component={CollectRoute}
                        options={{ headerShown: false, title: t('collect.navigation') }}
                      />
                      {__DEV__ && (
                        <Stack.Screen
                          name="CollectPreview"
                          component={CollectPreviewRoute}
                          options={{ headerShown: false, title: t('collect.navigation') }}
                        />
                      )}
                      {__DEV__ ? (
                        <Stack.Screen
                          name="WalletLab"
                          component={WalletLabScreen}
                          options={{ title: t('walletLab.title') }}
                        />
                      ) : null}
                    </Stack.Navigator>
                  </WithdrawContext.Provider>
                </NavigationContainer>
              </HistoryContext.Provider>
            </CollectContext.Provider>
          </SendContext.Provider>
        </ReceiveContext.Provider>
      </HomeContext.Provider>
    </Services.Provider>
  );
}
