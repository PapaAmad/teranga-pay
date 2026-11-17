import { Image, StyleSheet } from 'react-native';

import walletArtwork from '../../../../assets/brand/illustrations/wallet-current.png';

/** Illustration décorative originale ; aucun mot, montant ou logo n’est dans l’image. */
export function OnboardingArtwork() {
  return (
    <Image
      source={walletArtwork}
      style={styles.image}
      resizeMode="contain"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      fadeDuration={0}
    />
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 254 },
});
