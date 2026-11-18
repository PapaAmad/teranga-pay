import { useEffect, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { tokens } from '../ui';

type Props = {
  children: ReactNode;
  footer: ReactNode;
  header?: ReactNode;
  bottomInset?: number;
  keyboardVerticalOffset?: number;
};

/** Le contenu défile ; le CTA reste dans le cadre déplacé au-dessus du clavier. */
export function FormFrame({
  children,
  footer,
  header,
  bottomInset = 0,
  keyboardVerticalOffset = 0,
}: Props) {
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const safeBottom = Number.isFinite(bottomInset) ? Math.max(0, bottomInset) : 0;
  const safeOffset = Number.isFinite(keyboardVerticalOffset)
    ? Math.max(0, keyboardVerticalOffset)
    : 0;

  return (
    <KeyboardAvoidingView
      style={styles.frame}
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
      keyboardVerticalOffset={safeOffset}
    >
      {header}
      {/* Sur le Web, on-drag ferme aussi la saisie lors du défilement automatique au focus. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={false}
      >
        <View style={styles.column}>{children}</View>
      </ScrollView>
      <View
        style={[
          styles.footer,
          {
            paddingBottom: keyboardVisible
              ? tokens.spacing.lg
              : Math.max(tokens.spacing.lg, safeBottom),
          },
        ]}
      >
        <View style={styles.column}>{footer}</View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: tokens.colors.canvas },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: tokens.spacing.xl },
  column: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: tokens.spacing.lg },
  footer: {
    flexShrink: 0,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.lg,
    backgroundColor: tokens.colors.canvas,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.line,
  },
});
