import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import ManropeBold from '../../assets/brand/fonts/Manrope-Bold.ttf';
import NotoSansRegular from '../../assets/brand/fonts/NotoSans-Regular.ttf';
import NotoSansSemiBold from '../../assets/brand/fonts/NotoSans-SemiBold.ttf';
import { RootNavigator } from './src/navigation/RootNavigator';
import { appI18n, type AppI18n, TranslationProvider, useTranslation } from './src/translations';
import { BrandTypographyProvider, tokens } from './src/ui';

const fontAssets = {
  [tokens.fonts.body]: NotoSansRegular,
  [tokens.fonts.label]: NotoSansSemiBold,
  [tokens.fonts.title]: ManropeBold,
};

export default function App({ i18n = appI18n }: { i18n?: AppI18n } = {}) {
  return (
    <TranslationProvider i18n={i18n}>
      <AppContent />
    </TranslationProvider>
  );
}

function AppContent() {
  const { t } = useTranslation();
  const [loaded, fontError] = useFonts(fontAssets);
  const [continueWithoutFonts, setContinueWithoutFonts] = useState(false);
  const waiting = !loaded && !fontError && !continueWithoutFonts;
  const fallback = !loaded;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {waiting ? (
        <SafeAreaView style={styles.loading}>
          <ActivityIndicator accessible={false} color={tokens.colors.primary} />
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {t('fonts.loading', { appName: t('appName') })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('fonts.continueAction')}
            onPress={() => setContinueWithoutFonts(true)}
            style={styles.continueAction}
          >
            <Text style={styles.continueLabel}>{t('fonts.continueAction')}</Text>
          </Pressable>
        </SafeAreaView>
      ) : (
        <BrandTypographyProvider available={loaded}>
          <View style={styles.app}>
            {fallback && (
              <SafeAreaView edges={['top']} style={styles.fallback}>
                <Text accessibilityRole={fontError ? 'alert' : undefined} style={styles.body}>
                  {t(fontError ? 'fonts.error' : 'fonts.fallback')}
                </Text>
              </SafeAreaView>
            )}
            <RootNavigator />
          </View>
        </BrandTypographyProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    padding: tokens.spacing.xl,
    gap: tokens.spacing.xl,
    backgroundColor: tokens.colors.canvas,
  },
  body: { ...tokens.typography.body, color: tokens.colors.ink },
  continueAction: {
    minHeight: tokens.minimumTouchTarget,
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.control,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
  },
  continueLabel: {
    ...tokens.typography.label,
    color: tokens.colors.onPrimary,
    textAlign: 'center',
  },
  fallback: { backgroundColor: tokens.colors.warningSurface, padding: tokens.spacing.lg },
});
