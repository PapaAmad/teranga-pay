import { useMemo } from 'react';
import { Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { createReceiveQr } from './qr';

type Props = { value: string; label: string; maxSize?: number };

export function ReceiveQr({ value, label, maxSize = 240 }: Props) {
  const qr = useMemo(() => createReceiveQr(value, maxSize), [value, maxSize]);
  return (
    <Svg
      width={qr.size}
      height={qr.size}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      {...(Platform.OS === 'web'
        ? { 'aria-label': label, role: 'img' }
        : { accessible: true, accessibilityLabel: label, accessibilityRole: 'image' })}
    >
      <Rect x={0} y={0} width={qr.size} height={qr.size} fill="#FFFFFF" />
      <Path d={qr.path} fill="#000000" />
    </Svg>
  );
}
