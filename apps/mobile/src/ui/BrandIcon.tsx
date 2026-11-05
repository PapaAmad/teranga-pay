import Svg, { Path } from 'react-native-svg';

import iconPaths from '../../../../assets/brand/icons/paths.json';
import { tokens } from './tokens';

export type BrandIconName = keyof typeof iconPaths.icons;
export const brandIconNames = Object.keys(iconPaths.icons) as BrandIconName[];

type Props = {
  name: BrandIconName;
  size?: number;
  color?: string;
  label?: string;
};

export function BrandIcon({ name, size = 24, color = tokens.colors.ink, label }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={iconPaths.viewBox}
      fill="none"
      stroke={color}
      strokeWidth={iconPaths.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'auto' : 'no-hide-descendants'}
    >
      {iconPaths.icons[name].map((d, index) => (
        <Path key={index} d={d} />
      ))}
    </Svg>
  );
}
