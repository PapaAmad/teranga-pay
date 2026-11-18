import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTranslation } from '../translations';
import { BrandIcon, BrandMark, Button, tokens, useBrandFonts, type BrandIconName } from '../ui';
import { createHomeController } from './controller';
import {
  estimatePendingHomeXof,
  formatHomeDate,
  formatHomeNumber,
  formatHomeSignedNumber,
} from './format';
import type { HomePayment, HomeServices } from './ports';

export type HomeAction = 'receive' | 'send' | 'collect';

type Props = {
  services: HomeServices;
  onAbout: () => void;
  onDesign: () => void;
  onRequireUnlock: () => void;
  onReceive?: () => void;
  onSend?: () => void;
  onCollect?: () => void;
  onHistory?: () => void;
  onPreview?: () => void;
  onExitPreview?: () => void;
  previewControls?: ReactNode;
};

/** L’écran lit le port T11 ; il ne crée pas de devis et ne déclenche aucun paiement. */
export function HomeScreen({
  services,
  onAbout,
  onDesign,
  onRequireUnlock,
  onReceive,
  onSend,
  onCollect,
  onHistory,
  onPreview,
  onExitPreview,
  previewControls,
}: Props) {
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [controller] = useState(() => createHomeController(services));
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active' || AppState.currentState == null,
  );
  const [hidden, setHidden] = useState(!foreground);
  const [rateOpen, setRateOpen] = useState(false);
  const [action, setAction] = useState<HomeAction | null>(null);
  const preview = state.mode === 'preview';
  const balance = foreground ? state.balance.data : null;
  const history = foreground ? state.history.data : null;
  const blocked = !foreground || !['ready'].includes(state.status) || state.walletState !== 'pret';
  const body = [styles.body, { fontFamily: fonts.body }];
  const label = [styles.label, { fontFamily: fonts.label }];
  const masked = hidden || !foreground;
  const canRevealAmounts = foreground && (balance !== null || (history?.length ?? 0) > 0);
  const pendingXof = balance ? estimatePendingHomeXof(balance) : null;

  useEffect(() => {
    if (AppState.currentState === 'active' || AppState.currentState == null) {
      void controller.start();
    } else {
      controller.suspend();
    }
    const subscription = AppState.addEventListener('change', (next) => {
      const active = next === 'active';
      setForeground(active);
      if (active) void controller.resume();
      else {
        setHidden(true);
        setRateOpen(false);
        setAction(null);
        controller.suspend();
      }
    });
    return () => {
      subscription.remove();
      controller.dispose();
    };
  }, [controller]);

  const actionLabel = (value: HomeAction) =>
    t(
      value === 'receive'
        ? 'dashboard.actions.receive'
        : value === 'send'
          ? 'dashboard.actions.send'
          : 'dashboard.actions.collect',
    );
  const walletLabel =
    state.status === 'unavailable'
      ? t('dashboard.wallet.unavailable')
      : state.status === 'locked'
        ? t('dashboard.wallet.locked')
        : state.status === 'absent'
          ? t('dashboard.wallet.absent')
          : state.status === 'error'
            ? t('dashboard.wallet.unavailable')
            : state.walletState === 'hors_ligne'
              ? t('dashboard.wallet.offline')
              : state.walletState === 'synchronisation'
                ? t('dashboard.wallet.syncing')
                : state.walletState === 'pret'
                  ? t('dashboard.wallet.open')
                  : t('dashboard.loading');
  const amount = !balance
    ? t(
        state.status === 'loading' || state.status === 'idle'
          ? 'dashboard.loadingShort'
          : 'dashboard.unknown',
      )
    : balance.spendableXof === null
      ? t('dashboard.unknown')
      : balance.spendableXof === 0 && balance.spendableSats > 0
        ? t('dashboard.lessThanOne')
        : formatHomeNumber(balance.spendableXof);
  const numericAmount =
    balance?.spendableXof != null && !(balance.spendableXof === 0 && balance.spendableSats > 0);
  const valueFontSize = !numericAmount
    ? 30
    : fontScale >= 1.6
      ? 30
      : amount.length > 12
        ? 32
        : amount.length > 9
          ? 40
          : width < 360
            ? 46
            : 56;
  // Les très grands montants restent complets : une coupure est permise uniquement
  // entre groupes de milliers ; la lecture assistée garde la valeur canonique.
  const visibleAmount =
    numericAmount && (amount.length > 12 || fontScale >= 1.6)
      ? amount.replace(/\u00a0/g, '\u00a0\u200b')
      : amount;
  const title = [styles.title, { fontFamily: fonts.title }];

  function paymentRow(payment: HomePayment) {
    const succeeded = payment.status === 'reussi';
    const incoming = payment.direction === 'recu';
    const status = t(
      succeeded
        ? 'dashboard.payment.succeeded'
        : payment.status === 'en_attente'
          ? 'dashboard.payment.pending'
          : 'dashboard.payment.failed',
    );
    const name = t(incoming ? 'dashboard.payment.received' : 'dashboard.payment.sent');
    const date = formatHomeDate(payment.createdAt, { time: true });
    const xof =
      payment.amountXof === null
        ? t('dashboard.payment.amountUnavailable')
        : t('dashboard.money', {
            amount: succeeded
              ? formatHomeSignedNumber(payment.amountXof, payment.direction)
              : formatHomeNumber(payment.amountXof),
          });
    return (
      <View key={payment.id} style={styles.payment}>
        <View style={[styles.paymentIcon, succeeded && incoming && styles.incomingIcon]}>
          <BrandIcon
            name={
              payment.status === 'echoue'
                ? 'warning'
                : payment.status === 'en_attente'
                  ? 'pending'
                  : incoming
                    ? 'receive'
                    : 'send'
            }
            size={23}
            color={payment.status === 'echoue' ? tokens.colors.error : tokens.colors.ink}
          />
        </View>
        <View style={styles.paymentContent}>
          <View style={[styles.paymentHeading, (width < 360 || fontScale >= 1.4) && styles.stack]}>
            <Text style={[...label, styles.flex]}>{name}</Text>
            <Text
              style={[...label, styles.paymentAmount, succeeded && incoming && styles.positive]}
            >
              {masked ? t('dashboard.hiddenValue') : xof}
            </Text>
          </View>
          <Text
            style={[...body, styles.paymentStatus, payment.status === 'echoue' && styles.failure]}
          >
            {t('dashboard.payment.dateAndStatus', { date, status })}
          </Text>
          {!masked && payment.amountXof === null && (
            <Text style={[...body, styles.meta]}>
              {t('dashboard.sats', { amount: formatHomeNumber(payment.amountSats) })}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.toolbar}>
        <BrandMark size={29} />
        <Text accessibilityRole="header" style={[styles.brand, { fontFamily: fonts.title }]}>
          {t('appName')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.help')}
          onPress={onAbout}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <BrandIcon name="info" />
        </Pressable>
      </View>
      {preview && (
        <View style={styles.preview}>
          <Text style={[...label, styles.previewText]}>{t('dashboard.preview')}</Text>
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="home-ink" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={tokens.colors.primary} />
                  <Stop offset="1" stopColor={tokens.colors.primaryPressed} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#home-ink)" />
            </Svg>
          </View>
          <View style={styles.heroHeader}>
            <Text style={[...body, styles.onPrimary]}>{t('dashboard.heading')}</Text>
            <Pressable
              disabled={!canRevealAmounts}
              accessibilityRole="button"
              accessibilityLabel={t(hidden ? 'dashboard.show' : 'dashboard.hide')}
              accessibilityState={{ disabled: !canRevealAmounts }}
              onPress={() => setHidden((v) => !v)}
              style={({ pressed }) => [styles.privacy, pressed && styles.pressed]}
            >
              <Text style={[...label, styles.onPrimary]}>
                {t(hidden ? 'dashboard.showShort' : 'dashboard.hideShort')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.balance}>
            <Text style={[...body, styles.balanceLabel]}>{t('dashboard.balanceLabel')}</Text>
            <Text
              style={[
                styles.amount,
                {
                  fontFamily: fonts.title,
                  fontSize: masked ? 48 : valueFontSize,
                  lineHeight: masked ? 60 : valueFontSize + 12,
                },
              ]}
              accessibilityLabel={
                masked
                  ? t('dashboard.hidden')
                  : numericAmount
                    ? t('dashboard.money', { amount })
                    : amount
              }
            >
              {masked ? t('dashboard.hiddenValue') : visibleAmount}
            </Text>
            {!masked && numericAmount && (
              <Text accessible={false} style={[...label, styles.currency]}>
                {t('dashboard.currency')}
              </Text>
            )}
            {!masked && balance && (
              <Text style={[...body, styles.sats]}>
                {t('dashboard.sats', { amount: formatHomeNumber(balance.spendableSats) })}
              </Text>
            )}
            {!masked && balance && balance.pendingSats > 0 && (
              <View style={{ gap: tokens.spacing.xs }}>
                <Text style={[...label, styles.onPrimary]}>
                  {t('dashboard.pendingAmount', {
                    amount:
                      pendingXof === null
                        ? t('dashboard.unknown')
                        : pendingXof === 0
                          ? t('dashboard.lessThanOne')
                          : t('dashboard.money', { amount: formatHomeNumber(pendingXof) }),
                  })}
                </Text>
                <Text style={[...body, styles.onPrimary]}>
                  {t('dashboard.sats', { amount: formatHomeNumber(balance.pendingSats) })}
                </Text>
                <Text style={[...body, styles.onPrimary]}>{t('dashboard.pendingDescription')}</Text>
              </View>
            )}
            <View style={styles.walletStatus}>
              <BrandIcon
                name={state.walletState === 'hors_ligne' ? 'network' : 'wallet'}
                size={17}
                color={tokens.colors.accent}
              />
              <Text style={[styles.statusText, { fontFamily: fonts.body }]}>
                {foreground ? walletLabel : t('dashboard.interrupted')}
              </Text>
            </View>
            {(state.status === 'loading' || state.refreshing) && (
              <View style={styles.loadingStatus}>
                <ActivityIndicator color={tokens.colors.accent} accessible={false} />
                <Text
                  role="status"
                  accessibilityLiveRegion="polite"
                  style={[styles.statusText, { fontFamily: fonts.body }]}
                >
                  {t(state.refreshing && balance ? 'dashboard.refreshing' : 'dashboard.loading')}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.actions, fontScale >= 1.6 && styles.stack]}>
            {(['receive', 'send', 'collect'] as const).map((kind, index) => (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={actionLabel(kind)}
                accessibilityHint={
                  blocked
                    ? t('dashboard.actionsBlocked')
                    : kind === 'receive' && onReceive
                      ? t('receive.description')
                      : kind === 'send' && onSend
                        ? t('send.description')
                        : kind === 'collect' && onCollect
                          ? t('collect.description')
                          : t('dashboard.actionUnavailable')
                }
                accessibilityState={{ disabled: blocked }}
                disabled={blocked}
                onPress={() =>
                  kind === 'receive' && onReceive
                    ? onReceive()
                    : kind === 'send' && onSend
                      ? onSend()
                      : kind === 'collect' && onCollect
                        ? onCollect()
                        : setAction(kind)
                }
                style={({ pressed }) => [
                  styles.action,
                  fontScale >= 1.6 && styles.actionHorizontal,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.actionCircle,
                    index === 0 && styles.actionAccent,
                    blocked && styles.actionDisabled,
                  ]}
                >
                  <BrandIcon
                    name={
                      (kind === 'receive'
                        ? 'receive'
                        : kind === 'send'
                          ? 'send'
                          : 'collect') as BrandIconName
                    }
                    size={29}
                    color={
                      index === 0 && !blocked ? tokens.colors.onAccent : tokens.colors.onPrimary
                    }
                  />
                </View>
                <Text style={[...label, styles.actionText]}>{actionLabel(kind)}</Text>
              </Pressable>
            ))}
          </View>
          {blocked && state.walletState === 'hors_ligne' && (
            <Text style={[...body, styles.onPrimary]}>{t('dashboard.offlineActions')}</Text>
          )}
        </View>

        <View style={styles.content}>
          {balance && foreground && !masked && (
            <>
              {state.balance.stale && (
                <Text
                  role="status"
                  accessibilityLiveRegion="polite"
                  style={[...body, styles.warning]}
                >
                  {t('dashboard.oldBalance')}
                </Text>
              )}
              <View style={styles.observationRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.rateExplain')}
                  accessibilityState={{ expanded: rateOpen }}
                  aria-expanded={rateOpen}
                  onPress={() => setRateOpen((v) => !v)}
                  style={({ pressed }) => [
                    styles.flex,
                    styles.rateToggle,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[...body, styles.meta]}>
                    {t('dashboard.observation', {
                      date: formatHomeDate(balance.updatedAt, { time: true }),
                    })}
                  </Text>
                  <Text style={[...label, styles.meta]}>{t('dashboard.rateExplain')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('dashboard.refresh')}
                  accessibilityState={{ busy: state.refreshing, disabled: state.refreshing }}
                  aria-busy={state.refreshing}
                  disabled={state.refreshing}
                  onPress={() => {
                    void controller.refresh();
                  }}
                  style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}
                >
                  <BrandIcon name="history" size={22} />
                </Pressable>
              </View>
              {balance.spendableXof === null && (
                <Text style={[...body, styles.warning]}>{t('dashboard.rateMissing')}</Text>
              )}
              {rateOpen && (
                <View style={styles.ratePanel}>
                  <Text style={body}>{t('dashboard.rateDescription')}</Text>
                  {balance.rate && (
                    <>
                      <Text style={label}>
                        {t(
                          balance.rate.source === 'fixe'
                            ? 'dashboard.rateFixed'
                            : 'dashboard.rateKraken',
                        )}
                      </Text>
                      <Text style={body}>
                        {t('dashboard.rateValue', {
                          amount: formatHomeNumber(balance.rate.xofPerBtc),
                        })}
                      </Text>
                      <Text style={body}>
                        {t('dashboard.rateDate', {
                          date: formatHomeDate(balance.rate.fetchedAt, { time: true }),
                        })}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </>
          )}
          {state.status === 'ready' &&
            !balance &&
            state.balance.status === 'error' &&
            foreground && (
              <View style={styles.notice}>
                <Text accessibilityRole="alert" style={body}>
                  {t('dashboard.failedDescription')}
                </Text>
                <Button
                  variant="secondary"
                  label={t('dashboard.retryBalance')}
                  disabled={state.refreshing}
                  onPress={() => {
                    void controller.refresh();
                  }}
                />
              </View>
            )}
          {['unavailable', 'locked', 'absent', 'error'].includes(state.status) && foreground && (
            <View style={styles.notice}>
              <Text accessibilityRole="header" style={title}>
                {t(
                  state.status === 'unavailable'
                    ? 'dashboard.unavailableTitle'
                    : state.status === 'error'
                      ? 'dashboard.failedTitle'
                      : state.status === 'locked'
                        ? 'dashboard.wallet.locked'
                        : 'dashboard.wallet.absent',
                )}
              </Text>
              <Text style={body}>
                {t(
                  state.status === 'unavailable'
                    ? 'dashboard.unavailableDescription'
                    : state.status === 'error'
                      ? 'dashboard.failedDescription'
                      : state.status === 'locked'
                        ? 'dashboard.lockedDescription'
                        : 'dashboard.absentDescription',
                )}
              </Text>
              {state.status === 'locked' || state.status === 'absent' ? (
                <Button
                  label={t(state.status === 'locked' ? 'dashboard.unlock' : 'dashboard.create')}
                  onPress={onRequireUnlock}
                />
              ) : state.status === 'error' ? (
                <Button
                  label={t('dashboard.retry')}
                  onPress={() => {
                    void controller.refresh();
                  }}
                />
              ) : (
                onPreview && (
                  <Button
                    label={t('dashboard.previewAction')}
                    onPress={onPreview}
                    variant="accent"
                  />
                )
              )}
            </View>
          )}
          <View style={styles.sectionHeading}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={title}>
                {t('dashboard.recent')}
              </Text>
              <Text style={[...body, styles.meta]}>{t('dashboard.recentLimit')}</Text>
            </View>
            {onHistory && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('history.open')}
                onPress={onHistory}
                style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }}
              >
                <Text style={label}>{t('history.openShort')}</Text>
              </Pressable>
            )}
          </View>
          {state.history.stale && foreground && (
            <Text role="status" accessibilityLiveRegion="polite" style={[...body, styles.warning]}>
              {t('dashboard.oldHistory')}
            </Text>
          )}
          {history && history.length > 0 ? (
            <View style={styles.payments}>{history.map(paymentRow)}</View>
          ) : state.status === 'idle' ||
            state.status === 'loading' ||
            state.history.status === 'loading' ? (
            <View style={styles.empty}>
              <ActivityIndicator color={tokens.colors.primary} />
              <Text style={body}>{t('dashboard.loading')}</Text>
            </View>
          ) : state.history.status === 'ready' && history?.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <BrandIcon name="receive" size={30} />
              </View>
              <Text style={label}>{t('dashboard.emptyTitle')}</Text>
              <Text style={[...body, styles.center]}>{t('dashboard.emptyDescription')}</Text>
            </View>
          ) : (
            <Text style={[...body, styles.meta]}>
              {foreground
                ? t(
                    ['unavailable', 'locked', 'absent'].includes(state.status)
                      ? 'dashboard.historyUnavailable'
                      : 'dashboard.historyError',
                  )
                : t('dashboard.interrupted')}
            </Text>
          )}
          {state.status === 'ready' && state.history.status === 'error' && foreground && (
            <Button
              variant="secondary"
              label={t('dashboard.retryHistory')}
              onPress={() => {
                void controller.refresh();
              }}
              disabled={state.refreshing}
            />
          )}
          <View style={styles.footer}>
            {preview && previewControls}
            <Button variant="secondary" label={t('home.aboutAction')} onPress={onAbout} />
            {__DEV__ && (
              <Button variant="secondary" label={t('home.designAction')} onPress={onDesign} />
            )}
            {preview && onExitPreview && (
              <Button
                variant="secondary"
                label={t('dashboard.previewExit')}
                onPress={onExitPreview}
              />
            )}
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={Boolean(action)}
        transparent
        animationType="none"
        onRequestClose={() => setAction(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            accessibilityViewIsModal
            style={[styles.modal, { paddingBottom: insets.bottom + 24 }]}
          >
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.emptyIcon}>
                <BrandIcon
                  name={action === 'send' ? 'send' : action === 'collect' ? 'collect' : 'receive'}
                  size={36}
                />
              </View>
              <Text accessibilityRole="header" style={title}>
                {action ? actionLabel(action) : t('dashboard.heading')}
              </Text>
              {preview && <Text style={[...label, styles.warning]}>{t('dashboard.preview')}</Text>}
              <Text style={body}>
                {t(preview ? 'dashboard.actionPreview' : 'dashboard.actionUnavailable')}
              </Text>
              <Button label={t('dashboard.close')} onPress={() => setAction(null)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.colors.canvas },
  flex: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    minHeight: 72,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  brand: { flex: 1, color: tokens.colors.ink, fontSize: 21, lineHeight: 28 },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  preview: { backgroundColor: tokens.colors.accent, paddingHorizontal: 20, paddingVertical: 8 },
  previewText: { color: tokens.colors.onAccent, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, maxWidth: 600, width: '100%', alignSelf: 'center' },
  hero: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  onPrimary: { color: tokens.colors.onPrimary },
  privacy: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' },
  balance: { alignItems: 'center', paddingTop: 12, paddingBottom: 20, gap: 4 },
  balanceLabel: { color: tokens.colors.onPrimary, opacity: 0.8 },
  amount: {
    color: tokens.colors.onPrimary,
    letterSpacing: -1.7,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    width: '100%',
  },
  currency: { color: tokens.colors.accent, letterSpacing: 2, marginTop: -2 },
  sats: { color: tokens.colors.onPrimary, opacity: 0.85, marginTop: 4 },
  walletStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tokens.colors.primary,
  },
  statusText: { color: tokens.colors.onPrimary, fontSize: 13, lineHeight: 20, flexShrink: 1 },
  loadingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, alignItems: 'center', gap: 8, minHeight: 88, paddingVertical: 4 },
  actionCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderColor: tokens.colors.outline,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionAccent: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  actionDisabled: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.outline },
  actionText: { color: tokens.colors.onPrimary, textAlign: 'center' },
  actionHorizontal: { flex: 0, width: '100%', flexDirection: 'row', justifyContent: 'flex-start' },
  content: { paddingHorizontal: 24, paddingTop: 16, gap: 16 },
  body: { ...tokens.typography.body, color: tokens.colors.ink },
  label: { ...tokens.typography.label, color: tokens.colors.ink },
  title: { fontSize: 23, lineHeight: 32, letterSpacing: -0.5, color: tokens.colors.ink },
  meta: { color: tokens.colors.muted, fontSize: 14, lineHeight: 21 },
  observationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  refresh: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  rateToggle: { minHeight: 48, justifyContent: 'center' },
  ratePanel: { gap: 14, padding: 18, backgroundColor: tokens.colors.surface, borderRadius: 18 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  payments: { backgroundColor: tokens.colors.surface, borderRadius: 22, paddingHorizontal: 16 },
  payment: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.line,
  },
  paymentIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.canvas,
    borderRadius: 15,
  },
  incomingIcon: { backgroundColor: tokens.colors.successSurface },
  paymentContent: { flex: 1, gap: 5 },
  paymentHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  paymentAmount: { fontVariant: ['tabular-nums'], flexShrink: 1 },
  positive: { color: tokens.colors.success },
  paymentStatus: { fontSize: 13, lineHeight: 20 },
  failure: { color: tokens.colors.error },
  warning: { color: tokens.colors.warning },
  empty: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 22,
    alignItems: 'center',
    padding: 26,
    gap: 16,
  },
  emptyIcon: {
    backgroundColor: tokens.colors.accent,
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  notice: { gap: 16, paddingVertical: 12 },
  footer: {
    marginTop: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.line,
    paddingTop: 24,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  stack: { flexDirection: 'column' },
  modalBackdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: tokens.colors.canvas,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
  },
  modalContent: { padding: 24, gap: 24 },
});
