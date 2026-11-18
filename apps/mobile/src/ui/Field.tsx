import { useId, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { BrandIcon } from './BrandIcon';
import { tokens } from './tokens';
import { useBrandFonts } from './typography';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
} & Pick<TextInputProps, 'inputMode' | 'keyboardType' | 'autoCapitalize' | 'testID'>;

export function Field({
  testID,
  label,
  value,
  onChangeText,
  placeholder,
  helperText,
  error,
  disabled = false,
  inputMode,
  keyboardType,
  autoCapitalize,
}: Props) {
  const fonts = useBrandFonts();
  const labelId = useId();
  const [focused, setFocused] = useState(false);
  const hint = [error, helperText].filter(Boolean).join(' ') || undefined;

  return (
    <View style={styles.group}>
      <Text nativeID={labelId} style={[styles.label, { fontFamily: fonts.label }]}>
        {label}
      </Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        accessibilityLabelledBy={labelId}
        accessibilityHint={hint}
        accessibilityState={{ disabled }}
        value={value}
        onChangeText={(text) => {
          if (!disabled) onChangeText(text);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.muted}
        selectionColor={
          Platform.OS === 'android' ? tokens.colors.selectionSurface : tokens.colors.focus
        }
        cursorColor={Platform.OS === 'android' ? tokens.colors.focus : undefined}
        selectionHandleColor={Platform.OS === 'android' ? tokens.colors.focus : undefined}
        inputMode={inputMode}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[
          styles.input,
          { fontFamily: fonts.body },
          focused && !disabled && styles.focused,
          Boolean(error) && styles.invalid,
          disabled && styles.disabled,
        ]}
      />
      {helperText && <Text style={[styles.help, { fontFamily: fonts.body }]}>{helperText}</Text>}
      {error && (
        <View style={styles.errorRow}>
          <BrandIcon name="warning" color={tokens.colors.error} />
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.error, { fontFamily: fonts.label }]}
          >
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: tokens.spacing.sm },
  label: {
    ...tokens.typography.label,
    color: tokens.colors.ink,
  },
  input: {
    ...tokens.typography.body,
    color: tokens.colors.ink,
    minHeight: tokens.minimumTouchTarget,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.control,
    borderWidth: 2,
    borderColor: tokens.colors.outline,
    backgroundColor: tokens.colors.surface,
  },
  focused: { borderColor: tokens.colors.focus, borderWidth: 3 },
  invalid: { borderColor: tokens.colors.error },
  disabled: {
    color: tokens.colors.disabledInk,
    backgroundColor: tokens.colors.disabledSurface,
  },
  help: {
    ...tokens.typography.body,
    color: tokens.colors.muted,
  },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing.sm },
  error: {
    ...tokens.typography.body,
    color: tokens.colors.error,
    flexShrink: 1,
  },
});
