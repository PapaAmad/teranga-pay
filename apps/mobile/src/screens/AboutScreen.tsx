import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { fr } from '../translations/fr';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export function AboutScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {fr.about.title}
      </Text>
      <Text style={styles.description}>{fr.about.description}</Text>
      <Text style={styles.description}>{fr.about.development}</Text>
      <Button title={fr.about.backAction} onPress={() => navigation.goBack()} />
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
  title: { fontSize: 28, fontWeight: '700', color: '#161616' },
  description: { fontSize: 18, lineHeight: 28, color: '#262626' },
});
