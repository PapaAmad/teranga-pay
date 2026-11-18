import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatHomeDate, formatHomeNumber } from '../home/format';
import { FormFrame } from '../send/FormFrame';
import { parseSendAmount } from '../send/controller';
import { useTranslation } from '../translations';
import { RecoveryNotice } from '../reliability/RecoveryNotice';
import { BrandIcon, BrandMark, Button, tokens, useBrandFonts } from '../ui';
import { createCollectController } from './controller';
import { CollectQr } from './CollectQr';
import { collectPlatform, type CollectPlatformPort } from './platform';
import type { CollectServices } from './ports';

type Props = {
  services: CollectServices;
  onBack: () => void;
  onRequireUnlock: () => void;
  onPreview?: () => void;
  active?: boolean;
  platform?: CollectPlatformPort;
  previewControls?: ReactNode;
  onExitPreview?: () => void;
  clock?: () => number;
};
type Feedback =
  | 'copied'
  | 'copyFailed'
  | 'shareOpened'
  | 'shareDismissed'
  | 'shareFailed'
  | 'receiptShared'
  | 'receiptShareFailed';

/** Le montant et la facture sont figés ensemble ; seul leur règlement exact produit le reçu. */
export function CollectScreen({
  services,
  onBack,
  onRequireUnlock,
  onPreview,
  active = true,
  platform = collectPlatform,
  previewControls,
  onExitPreview,
  clock,
}: Props) {
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [controller] = useState(() => createCollectController(services, { now: clock }));
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [foreground, setForeground] = useState(
    AppState.currentState == null || AppState.currentState === 'active',
  );
  const [amount, setAmount] = useState('');
  const [requestExpanded, setRequestExpanded] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [action, setAction] = useState<'copy' | 'share' | 'receipt' | null>(null);
  const guard = useRef({ active: active && foreground, revision: 0, busy: false });
  const interrupted = !active || !foreground;
  const phase = interrupted ? 'suspended' : state.phase;
  const preview = services.mode === 'preview';
  const money = (value: number) => t('dashboard.money', { amount: formatHomeNumber(value) });
  const sats = (value: number) => t('dashboard.sats', { amount: formatHomeNumber(value) });
  const body = [styles.body, { fontFamily: fonts.body }];
  const label = [styles.label, { fontFamily: fonts.label }];
  const [title, description] =
    phase === 'paid' && preview
      ? (['collect.previewPaidTitle', 'collect.previewPaidDescription'] as const)
      : phaseCopy[phase];
  const request = interrupted ? null : state.request;
  const receipt = interrupted ? null : state.receipt;
  const showQr = phase === 'waiting' && request !== null && state.remainingSeconds > 0;
  const amountInvalid = amount.length > 0 && parseSendAmount(amount) === null;
  const errorKey = errorNames.find((name) => name === state.error?.code);

  function clearInteraction() {
    guard.current.revision += 1;
    guard.current.busy = false;
    setFeedback(null);
    setAction(null);
    setRequestExpanded(false);
  }
  useEffect(() => {
    void controller.start();
    return () => {
      guard.current.active = false;
      guard.current.revision += 1;
      controller.dispose();
    };
  }, [controller]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => {
      const visible = next === 'active';
      guard.current.active = visible && active;
      setForeground(visible);
      if (!visible) {
        clearInteraction();
        setAmount('');
        controller.suspend();
        Keyboard.dismiss();
      }
    });
    return () => listener.remove();
  }, [active, controller]);
  useEffect(() => {
    guard.current.active = active && foreground;
    if (active && foreground) void controller.resume();
    else {
      clearInteraction();
      setAmount('');
      controller.suspend();
    }
  }, [active, foreground, controller]);
  useEffect(() => {
    clearInteraction();
  }, [state.request?.paymentId, phase]);
  useEffect(() => {
    if (interrupted) return;
    const timer = setInterval(() => controller.tick(), 1000);
    return () => clearInterval(timer);
  }, [interrupted, controller]);

  function nextRequest() {
    if (!guard.current.active) return;
    const previous = state.quote?.amountXof;
    clearInteraction();
    controller.newRequest();
    if (previous !== undefined) setAmount(String(previous));
  }
  async function perform(kind: 'copy' | 'share' | 'receipt') {
    if (!guard.current.active || guard.current.busy) return;
    controller.tick();
    const latest = controller.getSnapshot();
    const sale = kind === 'receipt' ? latest.receipt : null;
    const payable =
      kind !== 'receipt' && latest.phase === 'waiting' && latest.remainingSeconds > 0
        ? latest.request
        : null;
    if (kind === 'receipt' ? !sale || !['paid', 'late'].includes(latest.phase) : !payable) return;
    const paymentId = sale?.paymentId ?? payable!.paymentId;
    guard.current.busy = true;
    const token = ++guard.current.revision;
    setAction(kind);
    setFeedback(null);
    const valid = () => {
      controller.tick();
      const current = controller.getSnapshot();
      return (
        guard.current.active &&
        guard.current.revision === token &&
        (kind === 'receipt'
          ? current.receipt?.paymentId === paymentId && ['paid', 'late'].includes(current.phase)
          : current.request?.paymentId === paymentId &&
            current.phase === 'waiting' &&
            current.remainingSeconds > 0)
      );
    };
    try {
      if (!valid()) return;
      if (kind === 'copy') {
        const copied = await platform.copyPaymentRequest(payable!.invoice.paymentRequest);
        if (valid()) setFeedback(copied ? 'copied' : 'copyFailed');
      } else {
        const message =
          kind === 'receipt'
            ? t(preview ? 'collect.previewReceiptMessage' : 'collect.receiptMessage', {
                amount: money(sale!.amountXof),
                sats: sats(sale!.amountSats),
                date: formatHomeDate(sale!.confirmedAt, { time: true }),
                id: sale!.paymentId,
              })
            : t(preview ? 'collect.previewRequestShare' : 'collect.requestShare', {
                amount: money(latest.quote!.amountXof),
                time: formatHomeDate(latest.validUntil!, { time: true }),
                request: payable!.invoice.paymentRequest,
              });
        const result = await platform.share({
          title: t(kind === 'receipt' ? 'collect.receiptShareTitle' : 'collect.requestShareTitle'),
          message,
        });
        if (valid())
          setFeedback(
            result === 'dismissed'
              ? 'shareDismissed'
              : kind === 'receipt'
                ? 'receiptShared'
                : 'shareOpened',
          );
      }
    } catch {
      if (valid())
        setFeedback(
          kind === 'copy'
            ? 'copyFailed'
            : kind === 'receipt'
              ? 'receiptShareFailed'
              : 'shareFailed',
        );
    } finally {
      if (guard.current.revision === token) {
        guard.current.busy = false;
        setAction(null);
      }
    }
  }

  let footer: ReactNode;
  if (phase === 'amount' || phase === 'quoting')
    footer = (
      <Button
        label={t('collect.continue')}
        loading={state.busy}
        disabled={parseSendAmount(amount) === null}
        onPress={() => {
          Keyboard.dismiss();
          void controller.prepare(amount);
        }}
      />
    );
  else if (phase === 'review')
    footer = (
      <View style={styles.gap}>
        <Button
          label={t('collect.create')}
          icon="collect"
          loading={state.busy}
          onPress={() => {
            Keyboard.dismiss();
            void controller.create();
          }}
        />
        <Button
          label={t('collect.edit')}
          variant="secondary"
          disabled={state.busy}
          onPress={() => controller.edit()}
        />
      </View>
    );
  else if (phase === 'unavailable' && onPreview)
    footer = <Button label={t('collect.previewAction')} variant="accent" onPress={onPreview} />;
  else if (phase === 'locked' || phase === 'absent')
    footer = (
      <Button
        label={t(phase === 'locked' ? 'collect.unlock' : 'collect.createWallet')}
        onPress={onRequireUnlock}
      />
    );
  else if (phase === 'paid' || phase === 'late')
    footer = (
      <Button
        label={t('collect.newRequest')}
        icon="collect"
        onPress={nextRequest}
        disabled={!state.canNewRequest || state.busy}
      />
    );
  else if (state.canRefresh && !interrupted)
    footer = (
      <View style={styles.gap}>
        <Button
          label={t(state.busy ? 'collect.checking' : 'collect.check')}
          loading={state.busy}
          onPress={() => {
            void controller.refresh();
          }}
        />
        {state.canNewRequest && (
          <Button
            label={t('collect.newRequest')}
            variant="secondary"
            disabled={state.busy}
            onPress={nextRequest}
          />
        )}
      </View>
    );
  else if (phase === 'error' || phase === 'offline')
    footer = (
      <Button
        label={t('collect.retry')}
        onPress={() => {
          void controller.refresh();
        }}
      />
    );
  else
    footer = (
      <Button
        label={t('collect.home')}
        variant="secondary"
        disabled={state.busy}
        onPress={onBack}
      />
    );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <FormFrame
        bottomInset={insets.bottom}
        footer={footer}
        header={
          <>
            <View style={styles.toolbar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('collect.back')}
                onPress={onBack}
                style={styles.iconButton}
              >
                <BrandIcon name="back" />
              </Pressable>
              <Text style={[...label, styles.navigation]}>{t('collect.navigation')}</Text>
              <View style={styles.iconButton}>
                <BrandMark size={22} />
              </View>
            </View>
            {preview && (
              <View style={styles.preview}>
                <Text style={[...label, styles.previewText]}>{t('collect.preview')}</Text>
              </View>
            )}
          </>
        }
      >
        {['paid', 'late'].includes(phase) && (
          <View style={styles.statusIcon}>
            <BrandIcon
              name={phase === 'paid' ? 'check' : 'info'}
              size={34}
              color={phase === 'paid' ? tokens.colors.success : tokens.colors.primary}
            />
          </View>
        )}
        <View style={styles.gap}>
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={[styles.title, showQr && styles.waitingTitle, { fontFamily: fonts.title }]}
          >
            {t(title)}
          </Text>
          <Text accessibilityLiveRegion="polite" style={[...body, styles.muted]}>
            {t(description)}
          </Text>
        </View>
        {['idle', 'loading', 'quoting', 'creating'].includes(phase) && (
          <ActivityIndicator accessible={false} color={tokens.colors.primary} />
        )}

        {(phase === 'amount' || phase === 'quoting') && (
          <View style={styles.amountField}>
            <Text style={label}>{t('collect.amountLabel')}</Text>
            <View style={styles.amountLine}>
              <TextInput
                accessibilityLabel={t('collect.amountLabel')}
                testID="collect-amount"
                accessibilityHint={amountInvalid ? t('collect.errors.AMOUNT_INVALID') : undefined}
                value={amount}
                onChangeText={setAmount}
                placeholder={t('collect.amountPlaceholder')}
                placeholderTextColor={tokens.colors.muted}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={7}
                editable={!state.busy}
                style={[styles.input, { fontFamily: fonts.title }]}
              />
              <Text style={[...label, styles.currency]}>{t('dashboard.currency')}</Text>
            </View>
            {amountInvalid && (
              <Text accessibilityRole="alert" style={[...body, styles.warning]}>
                {t('collect.errors.AMOUNT_INVALID')}
              </Text>
            )}
          </View>
        )}
        {!interrupted &&
          state.quote &&
          !showQr &&
          !receipt &&
          !['amount', 'quoting'].includes(phase) && (
            <View style={styles.amountCard}>
              <View style={styles.row}>
                <Text style={[...label, styles.onPrimary, styles.flex]}>{t('collect.amount')}</Text>
                <BrandIcon name="collect" color={tokens.colors.accent} />
              </View>
              <Text style={[styles.price, { fontFamily: fonts.title }]}>
                {money(state.quote.amountXof)}
              </Text>
              <Text style={[...body, styles.onPrimary]}>{sats(state.quote.amountSats)}</Text>
            </View>
          )}

        {phase === 'review' && state.validUntil && (
          <View style={styles.notice}>
            <BrandIcon name="info" />
            <View style={styles.flex}>
              <Text style={label}>
                {t('collect.fixedUntil', {
                  time: formatHomeDate(state.validUntil, { time: true }),
                })}
              </Text>
              <Text style={body}>{t('collect.rateHint')}</Text>
            </View>
          </View>
        )}
        {showQr && request && state.quote && (
          <>
            <View style={styles.qrCard}>
              <View style={styles.qrPriceGroup}>
                <Text style={[...body, styles.muted, styles.small]}>{t('collect.amount')}</Text>
                <Text style={[styles.qrPrice, { fontFamily: fonts.title }]}>
                  {money(state.quote.amountXof)}
                </Text>
                <Text style={[...body, styles.muted, styles.small]}>
                  {sats(state.quote.amountSats)}
                </Text>
              </View>
              <CollectQr
                value={request.invoice.paymentRequest}
                maxSize={Math.min(width - 88, 248)}
                label={t('collect.qrLabel', {
                  amount: money(state.quote.amountXof),
                  request: request.invoice.paymentRequest,
                })}
                fallback={
                  <Text accessibilityRole="alert" style={body}>
                    {t('collect.qrUnavailable')}
                  </Text>
                }
              />
              <View style={styles.timer}>
                <Text accessibilityLiveRegion="none" style={[...label, styles.small]}>
                  {t('collect.remaining', {
                    time: `${Math.floor(state.remainingSeconds / 60)}:${String(state.remainingSeconds % 60).padStart(2, '0')}`,
                  })}
                </Text>
                {state.validUntil && (
                  <Text style={[...body, styles.muted, styles.small]}>
                    {t('collect.fixedUntil', {
                      time: formatHomeDate(state.validUntil, { time: true }),
                    })}
                  </Text>
                )}
              </View>
            </View>
            <View style={[styles.actions, fontScale >= 1.4 && styles.stack]}>
              <View style={styles.flex}>
                <Button
                  label={t(action === 'copy' ? 'collect.copying' : 'collect.copy')}
                  icon="copy"
                  variant="secondary"
                  style={styles.compact}
                  loading={action === 'copy'}
                  disabled={action !== null}
                  onPress={() => {
                    void perform('copy');
                  }}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label={t(action === 'share' ? 'collect.sharing' : 'collect.share')}
                  variant="secondary"
                  style={styles.compact}
                  loading={action === 'share'}
                  disabled={action !== null}
                  onPress={() => {
                    void perform('share');
                  }}
                />
              </View>
            </View>
            <Text style={[...body, styles.muted, styles.center]}>{t('collect.waitingHint')}</Text>
            <Button
              label={t(requestExpanded ? 'collect.hideRequest' : 'collect.showRequest')}
              variant="secondary"
              onPress={() => setRequestExpanded((expanded) => !expanded)}
            />
            {requestExpanded && (
              <Text
                selectable
                accessibilityLabel={request.invoice.paymentRequest}
                style={[...body, styles.small]}
              >
                {request.invoice.paymentRequest.replace(/(.{18})/g, '$1\u200b')}
              </Text>
            )}
          </>
        )}
        {phase === 'expired' && (
          <View style={styles.notice}>
            <BrandIcon name="info" />
            <Text style={[...body, styles.flex]}>{t('collect.renewalHint')}</Text>
          </View>
        )}
        {phase === 'expired' && !state.canNewRequest && (
          <Text accessibilityRole="alert" style={[...body, styles.warning]}>
            {t('collect.pendingLimit')}
          </Text>
        )}
        {phase === 'unknown' && !request && (
          <Text style={body}>{t('collect.creationUnknown')}</Text>
        )}
        {receipt && ['paid', 'late'].includes(phase) && (
          <View style={styles.receipt}>
            <View style={styles.row}>
              <BrandMark size={22} />
              <Text accessibilityRole="header" style={label}>
                {t(preview ? 'collect.previewReceiptTitle' : 'collect.receiptTitle')}
              </Text>
            </View>
            <Text style={[...body, styles.muted]}>{t('collect.receiptAmount')}</Text>
            <Text style={[styles.receiptPrice, { fontFamily: fonts.title }]}>
              {money(receipt.amountXof)}
            </Text>
            <Text style={body}>{sats(receipt.amountSats)}</Text>
            <View style={styles.receiptRule} />
            <Text style={[...body, styles.muted]}>{t('collect.receiptDate')}</Text>
            <Text style={label}>{formatHomeDate(receipt.confirmedAt, { time: true })}</Text>
            <Text style={[...body, styles.muted]}>{t('collect.receiptReference')}</Text>
            <Text selectable accessibilityLabel={receipt.paymentId} style={label}>
              {receipt.paymentId.replace(/(.{20})/g, '$1\u200b')}
            </Text>
            <Text style={[...body, styles.muted, styles.small]}>{t('collect.receiptHint')}</Text>
            <Button
              label={t('collect.receiptShare')}
              variant="secondary"
              loading={action === 'receipt'}
              onPress={() => {
                void perform('receipt');
              }}
            />
          </View>
        )}
        {!interrupted &&
          state.previousReceipts.map((previous) => (
            <View key={previous.paymentId} style={styles.notice}>
              <BrandIcon name="info" />
              <View style={styles.flex}>
                <Text style={label}>{t('collect.previousPaid')}</Text>
                <Text style={body}>
                  {t('collect.previousSummary', {
                    amount: money(previous.amountXof),
                    date: formatHomeDate(previous.confirmedAt, { time: true }),
                  })}
                </Text>
                <Text style={body}>{t('collect.previousHint')}</Text>
                <Text style={[...body, styles.small]}>{t('collect.receiptReference')}</Text>
                <Text selectable accessibilityLabel={previous.paymentId} style={body}>
                  {previous.paymentId.replace(/(.{20})/g, '$1\u200b')}
                </Text>
              </View>
            </View>
          ))}
        {feedback && !interrupted && (
          <Text role="status" accessibilityLiveRegion="polite" style={body}>
            {t(`collect.${feedback}`)}
          </Text>
        )}
        {!interrupted && (
          <RecoveryNotice
            code={state.error?.code}
            committed={state.phase === 'unknown' || state.phase === 'waiting'}
          />
        )}
        {state.error && state.error.code !== 'READ_TIMEOUT' && !interrupted && (
          <Text accessibilityRole="alert" style={[...body, styles.warning]}>
            {t(errorKey ? `collect.errors.${errorKey}` : 'collect.errors.fallback')}
          </Text>
        )}
        <View style={styles.row}>
          <BrandIcon name="info" size={18} />
          <Text style={[...body, styles.muted, styles.small, styles.flex]}>
            {t('collect.network')}
          </Text>
        </View>
        {previewControls && !interrupted && <View style={styles.workshop}>{previewControls}</View>}
        {onExitPreview && (
          <Button label={t('collect.previewExit')} variant="secondary" onPress={onExitPreview} />
        )}
      </FormFrame>
    </SafeAreaView>
  );
}
const phaseCopy = {
  idle: ['collect.loadingTitle', 'collect.loadingDescription'],
  loading: ['collect.loadingTitle', 'collect.loadingDescription'],
  amount: ['collect.title', 'collect.description'],
  quoting: ['collect.quotingTitle', 'collect.quotingDescription'],
  review: ['collect.reviewTitle', 'collect.reviewDescription'],
  creating: ['collect.creatingTitle', 'collect.creatingDescription'],
  waiting: ['collect.waitingTitle', 'collect.waitingDescription'],
  paid: ['collect.paidTitle', 'collect.paidDescription'],
  late: ['collect.lateTitle', 'collect.lateDescription'],
  expired: ['collect.expiredTitle', 'collect.expiredDescription'],
  unknown: ['collect.unknownTitle', 'collect.unknownDescription'],
  offline: ['collect.offlineTitle', 'collect.offlineDescription'],
  locked: ['collect.lockedTitle', 'collect.lockedDescription'],
  absent: ['collect.absentTitle', 'collect.absentDescription'],
  unavailable: ['collect.unavailableTitle', 'collect.unavailableDescription'],
  error: ['collect.errorTitle', 'collect.errorDescription'],
  suspended: ['collect.suspendedTitle', 'collect.suspendedDescription'],
} as const;
const errorNames = [
  'AMOUNT_INVALID',
  'QUOTE_EXPIRED',
  'RATE_UNAVAILABLE',
  'INVALID_DATA',
  'PAYMENT_MISMATCH',
  'READ_FAILED',
] as const;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.colors.canvas },
  toolbar: {
    minHeight: 64,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 648,
    alignSelf: 'center',
  },
  navigation: { flex: 1, textAlign: 'center', fontSize: 18 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  preview: { backgroundColor: tokens.colors.accent, paddingHorizontal: 20, paddingVertical: 7 },
  previewText: { color: tokens.colors.onAccent, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  body: { ...tokens.typography.body, color: tokens.colors.ink },
  label: { ...tokens.typography.label, color: tokens.colors.ink },
  title: { fontSize: 32, lineHeight: 39, letterSpacing: -0.9, color: tokens.colors.ink },
  waitingTitle: { fontSize: 22, lineHeight: 29, letterSpacing: -0.4 },
  qrPriceGroup: { alignItems: 'center', gap: 2 },
  qrPrice: { fontSize: 32, lineHeight: 40, color: tokens.colors.ink, letterSpacing: -0.6 },
  muted: { color: tokens.colors.muted },
  warning: { color: tokens.colors.warning },
  small: { fontSize: 13, lineHeight: 20 },
  gap: { gap: 10 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  center: { textAlign: 'center' },
  amountField: { gap: 14, paddingVertical: 24 },
  amountLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 80,
    fontSize: 46,
    lineHeight: 62,
    color: tokens.colors.ink,
    borderBottomWidth: 2,
    borderBottomColor: tokens.colors.primary,
  },
  currency: { fontSize: 20 },
  amountCard: { padding: 22, borderRadius: 26, backgroundColor: tokens.colors.primary, gap: 8 },
  onPrimary: { color: tokens.colors.onPrimary },
  price: { fontSize: 36, lineHeight: 46, letterSpacing: -1, color: tokens.colors.onPrimary },
  qrCard: {
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 24,
    backgroundColor: tokens.colors.surface,
  },
  timer: { alignItems: 'center', gap: 4 },
  notice: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: tokens.colors.warningSurface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  actions: { flexDirection: 'row', gap: 10 },
  stack: { flexDirection: 'column' },
  compact: { paddingHorizontal: 12 },
  receipt: { padding: 20, borderRadius: 24, backgroundColor: tokens.colors.surface, gap: 10 },
  receiptPrice: { fontSize: 30, lineHeight: 40, color: tokens.colors.ink },
  receiptRule: { borderTopWidth: 1, borderTopColor: tokens.colors.line, marginVertical: 8 },
  statusIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workshop: { borderTopWidth: 1, borderTopColor: tokens.colors.line, paddingTop: 20 },
});
