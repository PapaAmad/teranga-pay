import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { useTranslation } from '../translations';
import {
  BrandIcon,
  BrandMark,
  brandIconNames,
  Button,
  Card,
  Field,
  tokens,
  useBrandFonts,
} from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'DesignSystem'>;

const palette = ['primary', 'canvas', 'accent', 'ink'] as const;

export function DesignSystemScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [buttonTested, setButtonTested] = useState(false);
  const [fieldValue, setFieldValue] = useState('');
  const [requiredValue, setRequiredValue] = useState('');
  const fonts = useBrandFonts();
  const styles = useMemo(() => createStyles(fonts), [fonts]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.section}>
        <BrandMark label={t('appName')} />
        <Text style={styles.eyebrow}>{t('design.proposal')}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {t('design.title')}
        </Text>
        <Text style={styles.body}>{t('design.introduction')}</Text>
        <Text style={styles.notice}>{t('design.notice')}</Text>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('design.paletteTitle')}
        </Text>
        <View style={styles.palette}>
          {palette.map((name) => (
            <View key={name} style={styles.swatchCard}>
              <View style={[styles.swatch, { backgroundColor: tokens.colors[name] }]} />
              <Text style={styles.label}>{t(`design.palette.${name}`)}</Text>
              <Text style={styles.body}>{tokens.colors[name]}</Text>
            </View>
          ))}
        </View>
      </View>

      <Card title={t('design.typographyTitle')}>
        <Text style={styles.amount}>{t('design.amount')}</Text>
        <Text style={styles.body}>{t('design.amountCaption')}</Text>
        <Text style={styles.body}>{t('design.typographyBody')}</Text>
      </Card>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('design.buttonsTitle')}
        </Text>
        <Text style={styles.body}>{t('design.buttons.pressedHint')}</Text>
        <Button
          label={t('design.buttons.normal')}
          icon="check"
          onPress={() => setButtonTested(true)}
        />
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {buttonTested ? t('design.buttons.activeFeedback') : t('design.buttons.idleFeedback')}
        </Text>
        <Button
          variant="secondary"
          label={t('design.buttons.secondary')}
          onPress={() => setButtonTested(false)}
        />
        <Button
          label={t('design.buttons.disabled')}
          disabled
          onPress={() => setButtonTested(true)}
        />
        <Button label={t('design.buttons.loading')} loading onPress={() => setButtonTested(true)} />
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('design.fieldsTitle')}
        </Text>
        <Field
          label={t('design.fields.label')}
          value={fieldValue}
          onChangeText={setFieldValue}
          placeholder={t('design.fields.placeholder')}
          helperText={t('design.fields.helper')}
        />
        <Field
          label={t('design.fields.errorLabel')}
          value={requiredValue}
          onChangeText={setRequiredValue}
          error={requiredValue.trim() ? undefined : t('design.fields.error')}
        />
        <Field
          label={t('design.fields.disabledLabel')}
          value={t('design.fields.disabledValue')}
          disabled
          onChangeText={() => {}}
        />
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('design.cardsTitle')}
        </Text>
        <Card title={t('design.cards.neutralTitle')}>
          <Text style={styles.body}>{t('design.cards.neutralDescription')}</Text>
        </Card>
        <Card
          title={t('design.cards.pendingTitle')}
          tone="pending"
          statusLabel={t('design.cards.pendingLabel')}
        >
          <Text style={styles.body}>{t('design.cards.pendingDescription')}</Text>
        </Card>
        <Card
          title={t('design.cards.successTitle')}
          tone="success"
          statusLabel={t('design.cards.successLabel')}
        >
          <Text style={styles.body}>{t('design.cards.successDescription')}</Text>
        </Card>
        <Card
          title={t('design.cards.errorTitle')}
          tone="error"
          statusLabel={t('design.cards.errorLabel')}
        >
          <Text style={styles.body}>{t('design.cards.errorDescription')}</Text>
        </Card>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('design.iconsTitle')}
        </Text>
        <View style={styles.iconGrid}>
          {brandIconNames.map((name) => (
            <View key={name} style={styles.iconTile}>
              <BrandIcon name={name} />
              <Text style={styles.iconLabel}>{t(`design.icons.${name}`)}</Text>
            </View>
          ))}
        </View>
      </View>

      <Button
        variant="secondary"
        label={t('design.backAction')}
        icon="back"
        onPress={() => navigation.goBack()}
      />
    </ScrollView>
  );
}

function createStyles(fonts: ReturnType<typeof useBrandFonts>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: tokens.colors.canvas },
    content: { padding: tokens.spacing.xl, gap: tokens.spacing.xxl },
    section: { gap: tokens.spacing.lg },
    title: {
      ...tokens.typography.title,
      fontFamily: fonts.title,
      color: tokens.colors.ink,
    },
    sectionTitle: {
      ...tokens.typography.body,
      fontSize: 22,
      lineHeight: 30,
      fontFamily: fonts.title,
      color: tokens.colors.ink,
    },
    eyebrow: {
      ...tokens.typography.label,
      fontFamily: fonts.label,
      color: tokens.colors.primary,
    },
    body: {
      ...tokens.typography.body,
      fontFamily: fonts.body,
      color: tokens.colors.ink,
    },
    notice: {
      ...tokens.typography.body,
      fontFamily: fonts.body,
      color: tokens.colors.muted,
    },
    label: {
      ...tokens.typography.label,
      fontFamily: fonts.label,
      color: tokens.colors.ink,
    },
    amount: {
      ...tokens.typography.amount,
      fontFamily: fonts.title,
      color: tokens.colors.ink,
      fontVariant: ['tabular-nums'],
    },
    palette: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md },
    swatchCard: {
      flexBasis: 140,
      flexGrow: 1,
      backgroundColor: tokens.colors.surface,
      padding: tokens.spacing.md,
      borderRadius: tokens.radius.control,
      gap: tokens.spacing.sm,
    },
    swatch: {
      minHeight: tokens.minimumTouchTarget,
      borderRadius: tokens.radius.small,
      borderColor: tokens.colors.outline,
      borderWidth: 1,
    },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.md },
    iconTile: {
      flexBasis: 88,
      flexGrow: 1,
      alignItems: 'center',
      padding: tokens.spacing.md,
      backgroundColor: tokens.colors.surface,
      borderRadius: tokens.radius.control,
      gap: tokens.spacing.sm,
    },
    iconLabel: {
      ...tokens.typography.body,
      fontFamily: fonts.body,
      color: tokens.colors.ink,
      textAlign: 'center',
    },
  });
}
