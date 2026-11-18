import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../translations';
import { BrandIcon, tokens, useBrandFonts } from '../ui';

/** Information d'état uniquement ; aucune requête ni relance n'est effectuée ici. */
export function RecoveryNotice({
  code,
  committed = false,
}: {
  code?: string;
  committed?: boolean;
}) {
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  if (code !== 'READ_TIMEOUT' && code !== 'OPERATION_SLOW' && code !== 'JOURNAL_SLOW') return null;
  const journal = code === 'JOURNAL_SLOW';
  const operation = committed || code === 'OPERATION_SLOW';
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite" role="status">
      <BrandIcon name={operation ? 'pending' : 'network'} color={tokens.colors.warning} />
      <View style={styles.content}>
        <Text style={[styles.label, { fontFamily: fonts.label }]}>
          {t(
            journal
              ? 'reliability.journalTitle'
              : operation
                ? 'reliability.operationTitle'
                : 'reliability.readTitle',
          )}
        </Text>
        <Text style={[styles.body, { fontFamily: fonts.body }]}>
          {t(
            journal
              ? 'reliability.journalDescription'
              : operation
                ? 'reliability.operationDescription'
                : 'reliability.readDescription',
          )}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  notice: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: tokens.colors.warningSurface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  content: { flex: 1, minWidth: 0, gap: 6 },
  label: { ...tokens.typography.label, color: tokens.colors.ink },
  body: { ...tokens.typography.body, color: tokens.colors.ink },
});
