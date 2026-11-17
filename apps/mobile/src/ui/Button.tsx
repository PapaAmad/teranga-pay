import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { BrandIcon, type BrandIconName } from './BrandIcon';
import { tokens } from './tokens';
import { useBrandFonts } from './typography';

type Props = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  icon?: BrandIconName;
  hint?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  hint,
  style,
}: Props) {
  const fonts = useBrandFonts();
  const blocked = disabled || loading;
  const foreground = disabled
    ? tokens.colors.disabledInk
    : variant === 'primary'
      ? tokens.colors.onPrimary
      : tokens.colors.primary;

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={(event) => {
        if (!blocked) onPress(event);
      }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && !blocked && styles.pressed,
        pressed && !blocked && variant === 'primary' && styles.primaryPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} accessible={false} />
      ) : icon ? (
        <BrandIcon name={icon} color={foreground} />
      ) : null}
      <Text style={[styles.label, { color: foreground, fontFamily: fonts.label }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: tokens.minimumTouchTarget,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.lg,
    borderRadius: tokens.radius.control,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
  },
  primary: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  secondary: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.primary,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  primaryPressed: {
    backgroundColor: tokens.colors.primaryPressed,
    borderColor: tokens.colors.primaryPressed,
  },
  disabled: {
    backgroundColor: tokens.colors.disabledSurface,
    borderColor: tokens.colors.outline,
  },
  label: {
    ...tokens.typography.label,
    flexShrink: 1,
    textAlign: 'center',
  },
});
