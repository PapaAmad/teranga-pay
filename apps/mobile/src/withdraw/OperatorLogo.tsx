import { Image, Platform, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import wave from '../../../../assets/operators/wave.png';
import artwork from '../../../../assets/operators/artwork.json';
import type { WithdrawOperator } from './ports';

/** Ressources originales des opérateurs ; le nom traduit est fourni par la carte. */
export function OperatorLogo({
  operator,
  size = 48,
}: {
  operator: WithdrawOperator;
  size?: number;
}) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {operator === 'wave' ? (
        <Image
          source={wave}
          resizeMode="contain"
          style={{ width: size, height: size }}
          {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false })}
        />
      ) : (
        <SvgXml
          xml={artwork.orangeMoneySvg}
          viewBox="0 0 221 115"
          style={{ overflow: 'hidden' }}
          width={size}
          height={size}
          {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false })}
        />
      )}
    </View>
  );
}
