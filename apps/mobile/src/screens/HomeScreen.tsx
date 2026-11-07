import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { fr } from '../translations/fr';
import { Button, tokens, useBrandFonts } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const fonts = useBrandFonts();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[styles.status, { fontFamily: fonts.label }]}>{fr.home.status}</Text>
      <Text accessibilityRole="header" style={[styles.title, { fontFamily: fonts.title }]}>
        {fr.home.title}
      </Text>
      <Text style={[styles.description, { fontFamily: fonts.body }]}>{fr.home.description}</Text>
      <Text style={[styles.notice, { fontFamily: fonts.body }]}>{fr.home.notice}</Text>
      <Button label={fr.home.aboutAction} onPress={() => navigation.navigate('About')} />
      <Button
        variant="secondary"
        label={fr.home.designAction}
        onPress={() => navigation.navigate('DesignSystem')}
      />
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
  status: { ...tokens.typography.label, color: tokens.colors.muted },
  title: { ...tokens.typography.title, color: tokens.colors.ink },
  description: { ...tokens.typography.body, color: tokens.colors.ink },
  notice: { ...tokens.typography.body, color: tokens.colors.muted },
});
