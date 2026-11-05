import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandIcon, type BrandIconName } from './BrandIcon';
import { tokens } from './tokens';
import { useBrandFonts } from './typography';

type CardTone = 'neutral' | 'pending' | 'success' | 'error';
type Props = {
  title: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
} & (
  | { tone?: 'neutral'; statusLabel?: never }
  | { tone: Exclude<CardTone, 'neutral'>; statusLabel: string }
);

const states = {
  pending: {
    color: tokens.colors.warning,
    surface: tokens.colors.warningSurface,
    icon: 'pending',
  },
  success: {
    color: tokens.colors.success,
    surface: tokens.colors.successSurface,
    icon: 'check',
  },
  error: {
    color: tokens.colors.error,
    surface: tokens.colors.errorSurface,
    icon: 'warning',
  },
} satisfies Record<
  Exclude<CardTone, 'neutral'>,
  { color: string; surface: string; icon: BrandIconName }
>;

export function Card({ title, tone = 'neutral', statusLabel, children, style }: Props) {
  const fonts = useBrandFonts();
  const state = tone === 'neutral' ? undefined : states[tone];
  return (
    <View
      style={[
        styles.card,
        state && { backgroundColor: state.surface, borderColor: state.color },
        style,
      ]}
    >
      <Text accessibilityRole="header" style={[styles.title, { fontFamily: fonts.label }]}>
        {title}
      </Text>
      {state && (
        <View style={styles.status}>
          <BrandIcon name={state.icon} color={state.color} />
          <Text style={[styles.statusLabel, { color: state.color, fontFamily: fonts.label }]}>
            {statusLabel}
          </Text>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: tokens.spacing.xl,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.colors.line,
    backgroundColor: tokens.colors.surface,
    gap: tokens.spacing.md,
  },
  title: {
    ...tokens.typography.body,
    color: tokens.colors.ink,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  statusLabel: {
    ...tokens.typography.label,
    flexShrink: 1,
  },
});
