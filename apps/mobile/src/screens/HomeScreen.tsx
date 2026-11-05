import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { fr } from '../translations/fr';
import { Button as BrandButton } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.status}>{fr.home.status}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {fr.home.title}
      </Text>
      <Text style={styles.description}>{fr.home.description}</Text>
      <Text style={styles.notice}>{fr.home.notice}</Text>
      <Button title={fr.home.aboutAction} onPress={() => navigation.navigate('About')} />
      <BrandButton
        variant="secondary"
        label={fr.home.designAction}
        onPress={() => navigation.navigate('DesignSystem')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 20,
    backgroundColor: '#ffffff',
  },
  status: { fontSize: 14, color: '#555555' },
  title: { fontSize: 28, fontWeight: '700', color: '#161616' },
  description: { fontSize: 18, lineHeight: 28, color: '#262626' },
  notice: { fontSize: 16, lineHeight: 24, color: '#555555' },
});
