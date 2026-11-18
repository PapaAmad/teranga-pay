import { useEffect, useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { createCollectQr, type CollectQrErrorCode } from './qr';

type Props = {
  value: string;
  label: string;
  maxSize?: number;
  fallback?: ReactNode;
  onError?: (error: CollectQrErrorCode) => void;
};

export function CollectQr({ value, label, maxSize = 288, fallback = null, onError }: Props) {
  const result = useMemo(() => createCollectQr(value, maxSize), [value, maxSize]);
  useEffect(() => {
    if (!result.ok) onError?.(result.error);
  }, [result, onError]);
  if (!result.ok) return fallback;

  const { qr } = result;
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
