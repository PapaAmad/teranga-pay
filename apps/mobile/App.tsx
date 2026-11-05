import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import ManropeBold from '../../assets/brand/fonts/Manrope-Bold.ttf';
import NotoSansRegular from '../../assets/brand/fonts/NotoSans-Regular.ttf';
import NotoSansSemiBold from '../../assets/brand/fonts/NotoSans-SemiBold.ttf';
import { RootNavigator } from './src/navigation/RootNavigator';
import { fr } from './src/translations/fr';
import { BrandTypographyProvider, tokens } from './src/ui';

export default function App() {
  const [loaded, fontError] = useFonts({ NotoSansRegular, NotoSansSemiBold, ManropeBold });
  const [systemFonts, setSystemFonts] = useState(false);
  const waiting = !loaded && !fontError && !systemFonts;
  const fallback = Boolean(fontError) || systemFonts;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {waiting ? (
        <SafeAreaView style={styles.loading}>
          <ActivityIndicator accessible={false} color={tokens.colors.primary} />
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {fr.fonts.loading}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fr.fonts.continueAction}
            onPress={() => setSystemFonts(true)}
            style={styles.continueAction}
          >
            <Text style={styles.continueLabel}>{fr.fonts.continueAction}</Text>
          </Pressable>
        </SafeAreaView>
      ) : (
        <BrandTypographyProvider available={loaded && !fallback}>
          <View style={styles.app}>
            {fallback && (
              <SafeAreaView edges={['top']} style={styles.fallback}>
                <Text accessibilityRole={fontError ? 'alert' : undefined} style={styles.body}>
                  {fontError ? fr.fonts.error : fr.fonts.fallback}
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
