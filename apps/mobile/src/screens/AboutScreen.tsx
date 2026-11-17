import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { useTranslation } from '../translations';
import { Button, tokens, useBrandFonts } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export function AboutScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const fonts = useBrandFonts();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { fontFamily: fonts.title }]}>
        {t('about.title')}
      </Text>
      <Text style={[styles.description, { fontFamily: fonts.body }]}>
        {t('about.description', { appName: t('appName') })}
      </Text>
      <Text style={[styles.description, { fontFamily: fonts.body }]}>{t('about.development')}</Text>
      <Button label={t('about.backAction')} onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.canvas },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: tokens.spacing.xl,
    gap: tokens.spacing.lg,
  },
  title: { ...tokens.typography.title, color: tokens.colors.ink },
  description: { ...tokens.typography.body, color: tokens.colors.ink },
});
