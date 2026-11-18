import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../translations';
import { BrandIcon, tokens, useBrandFonts } from '../ui';
import type { RiskAssessment } from './ports';

/** L'avertissement exprime des faits à vérifier, jamais une probabilité de fraude. */
export function RiskNotice({ assessment }: { assessment: RiskAssessment | null }) {
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const body = [styles.body, { fontFamily: fonts.body }];
  const label = [styles.label, { fontFamily: fonts.label }];
  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <BrandIcon name={assessment ? 'warning' : 'network'} color={tokens.colors.warning} />
        <Text accessibilityRole="header" style={[...label, styles.flex]}>
          {t(assessment ? 'risk.reasonsTitle' : 'risk.unavailableTitle')}
        </Text>
      </View>
      {assessment ? (
        <>
          {assessment.reasons.map((reason) => (
            <View key={reason.code} style={styles.reason}>
              <View style={styles.dot} />
              <Text style={[...body, styles.flex]}>{t(`risk.reasons.${reason.code}`)}</Text>
            </View>
          ))}
          <Text style={body}>{t('risk.explanation')}</Text>
        </>
      ) : (
        <Text style={body}>{t('risk.unavailableAdvice')}</Text>
      )}
      <View style={styles.advice}>
        <Text style={label}>{t('risk.adviceTitle')}</Text>
        <Text style={body}>{t('risk.advice')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 18, borderRadius: 22, backgroundColor: tokens.colors.warningSurface, gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  body: { ...tokens.typography.body, color: tokens.colors.ink },
  label: { ...tokens.typography.label, color: tokens.colors.ink },
  flex: { flex: 1, minWidth: 0 },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 9,
    backgroundColor: tokens.colors.warning,
  },
  advice: { borderTopWidth: 1, borderTopColor: tokens.colors.warning, paddingTop: 14, gap: 6 },
});
