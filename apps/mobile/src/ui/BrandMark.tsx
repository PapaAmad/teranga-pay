import Svg, { Path } from 'react-native-svg';

import mark from '../../../../assets/brand/logos/mark.json';
import { tokens } from './tokens';

type Props = { size?: number; color?: string; label?: string };

export function BrandMark({ size = 64, color = tokens.colors.primary, label }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={mark.viewBox}
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'auto' : 'no-hide-descendants'}
    >
      <Path d={mark.path} fill={color} />
    </Svg>
  );
}
