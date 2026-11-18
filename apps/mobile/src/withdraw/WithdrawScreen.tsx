import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { historyDate } from '../history/format';
import { formatHomeNumber } from '../home/format';
import { FormFrame } from '../send/FormFrame';
import { useTranslation } from '../translations';
import {
  BrandIcon,
  BrandMark,
  Button,
  Field,
  tokens,
  useBrandFonts,
  type BrandIconName,
} from '../ui';
import { createWithdrawController } from './controller';
import { OperatorLogo } from './OperatorLogo';
import type { WithdrawError, WithdrawOperator, WithdrawServices } from './ports';

type Props = {
  services: WithdrawServices;
  active?: boolean;
  onBack(): void;
  onPreview?(): void;
  onExitPreview?(): void;
  previewControls?: ReactNode;
  clock?: () => number;
};
const visualAmount = (value: string) => value.replace(/\u00a0/g, '\u00a0\u200b');
const operatorKey = (operator: WithdrawOperator) =>
  operator === 'wave' ? 'withdraw.wave' : 'withdraw.orange';
function errorKey(error: WithdrawError) {
  if (error.code.startsWith('JOURNAL_')) return 'withdraw.errors.journal';
  switch (error.code) {
    case 'INVALID_AMOUNT':
    case 'AMOUNT_INVALID':
    case 'AMOUNT_TOO_HIGH':
    case 'INVALID_INPUT':
      return 'withdraw.errors.amount';
    case 'QUOTE_EXPIRED':
      return 'withdraw.expiry';
    case 'INSUFFICIENT_FUNDS':
      return 'withdraw.errors.insufficient';
    case 'NETWORK_OFFLINE':
      return 'withdraw.errors.offline';
    case 'RATE_UNAVAILABLE':
      return 'withdraw.errors.rate';
    case 'INVALID_DATA':
    case 'INVALID_RESPONSE':
    case 'INVALID_QUOTE':
      return 'withdraw.errors.invalid';
    case 'QUOTE_ALREADY_USED':
    case 'IDEMPOTENCY_CONFLICT':
      return 'withdraw.errors.conflict';
    case 'UNAUTHORIZED':
      return 'withdraw.errors.unauthorized';
    case 'WITHDRAWAL_NOT_FOUND':
      return 'withdraw.errors.missing';
    case 'PROVIDER_UNAVAILABLE':
      return 'withdraw.errors.provider';
    case 'PROVIDER_DECLINED':
      return 'withdraw.errors.declined';
    default:
      return 'withdraw.errors.generic';
  }
}

/** Solde et transferts exclusivement fictifs ; le PIN du wallet n’est jamais demandé. */
export function WithdrawScreen({
  services,
  active = true,
  onBack,
  onPreview,
  onExitPreview,
  previewControls,
  clock,
}: Props) {
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [controller] = useState(() => createWithdrawController(services, { now: clock }));
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [foreground, setForeground] = useState(
    AppState.currentState == null || AppState.currentState === 'active',
  );
  const [choosingOperator, setChoosingOperator] = useState(false);
  const guard = useRef({ active: active && foreground });
  const visible = active && foreground && state.phase !== 'suspended';
  const showOperators =
    state.phase === 'operator' || (choosingOperator && state.phase === 'amount');
  const operator = state.operator ?? state.quote?.operator ?? state.operation?.operator ?? null;
  const money = (amount: number) => t('dashboard.money', { amount: formatHomeNumber(amount) });
  const sats = (amount: number) => t('dashboard.sats', { amount: formatHomeNumber(amount) });
  const body = [styles.body, { fontFamily: fonts.body }];
  const label = [styles.label, { fontFamily: fonts.label }];
  const title = [styles.title, { fontFamily: fonts.title }];
  const privateReady = !['idle', 'loading', 'unavailable', 'suspended', 'error'].includes(
    state.phase,
  );
  const amount = state.operation?.amountXof ?? state.quote?.amountXof;
  const quote = state.quote;
  const operation = state.operation;
  const current = useRef(state);
  current.current = state;
  function goBack() {
    if (state.phase === 'review' && !state.committed) {
      controller.edit();
      return;
    }
    if (state.phase === 'amount' && !choosingOperator && !state.committed) {
      setChoosingOperator(true);
      return;
    }
    onBack();
  }
  const backAction = useRef(goBack);
  backAction.current = goBack;
  useEffect(() => {
    void controller.start();
    return () => {
      guard.current.active = false;
      controller.dispose();
    };
  }, [controller]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const shown = next === 'active';
      guard.current.active = active && shown;
      setForeground(shown);
      if (!shown) controller.suspend();
    });
    return () => subscription.remove();
  }, [active, controller]);
  useEffect(() => {
    guard.current.active = active && foreground;
    if (active && foreground) void controller.resume();
    else controller.suspend();
  }, [active, foreground, controller]);
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => controller.tick(), 1000);
    return () => clearInterval(timer);
  }, [controller, visible]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!guard.current.active || current.current.committed) return false;
      if (current.current.phase !== 'review' && current.current.phase !== 'amount') return false;
      backAction.current();
      return true;
    });
    return () => subscription.remove();
  }, []);
  function execute(action: () => void | Promise<void>) {
    if (guard.current.active) void action();
  }
  function select(operator: WithdrawOperator) {
    if (!guard.current.active) return;
    setChoosingOperator(false);
    controller.selectOperator(operator);
  }
  const header = (
    <>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('withdraw.back')}
          style={styles.iconButton}
          onPress={goBack}
        >
          <BrandIcon name="back" />
        </Pressable>
        <Text style={[...label, styles.navigation]}>{t('withdraw.navigation')}</Text>
        <View style={styles.iconButton}>
          <BrandMark size={22} />
        </View>
      </View>
      <View style={styles.simulation}>
        <Text style={[...label, styles.simulationText]}>{t('withdraw.simulationNotice')}</Text>
      </View>
    </>
  );
  function largeAmount(value: number, onPrimary = false) {
    const canonical = money(value);
    return (
      <Text
        accessibilityLabel={canonical}
        style={[styles.price, { fontFamily: fonts.title }, onPrimary && styles.onPrimary]}
      >
        {visualAmount(canonical)}
      </Text>
    );
  }
  function detail(name: string, value: string, strong = false) {
    return (
      <View style={[styles.detail, (width < 360 || fontScale >= 1.4) && styles.stacked]}>
        <Text style={[...body, styles.muted, styles.flex]}>{name}</Text>
        <Text
          accessibilityLabel={value}
          style={[...label, styles.detailValue, strong && styles.total]}
        >
          {visualAmount(value)}
        </Text>
      </View>
    );
  }
  function priceBreakdown() {
    const price = operation ?? quote;
    if (!price) return null;
    return (
      <View style={styles.receipt}>
        {detail(t('withdraw.operator'), t(operatorKey(price.operator)))}
        {detail(t('withdraw.destinationAmount'), money(price.amountXof))}
        {detail(t('withdraw.fees'), money(price.feeXof))}
        <View style={styles.rule} />
        {detail(t('withdraw.total'), money(price.totalXof), true)}
        <Text style={[...body, styles.small, styles.muted]}>{sats(price.totalSats)}</Text>
      </View>
    );
  }
  function renderContent() {
    if (!visible)
      return (
        <>
          <BrandIcon name="shield" size={48} />
          <Text accessibilityRole="header" style={title}>
            {t('withdraw.suspendedTitle')}
          </Text>
          <Text style={body}>{t('withdraw.suspendedDescription')}</Text>
        </>
      );
    if (state.phase === 'idle' || state.phase === 'loading')
      return (
        <View style={styles.gap}>
          <ActivityIndicator color={tokens.colors.primary} />
          <Text accessibilityRole="status" style={body}>
            {t('withdraw.loading')}
          </Text>
        </View>
      );
    if (state.phase === 'unavailable')
      return (
        <>
          <View style={styles.heroIcon}>
            <BrandIcon name="withdraw" size={34} />
          </View>
          <Text accessibilityRole="header" style={title}>
            {t('withdraw.unavailableTitle')}
          </Text>
          <Text style={body}>{t('withdraw.unavailableDescription')}</Text>
          <Text style={[...body, styles.muted]}>{t('withdraw.simulationHint')}</Text>
        </>
      );
    if (state.phase === 'error' && !state.committed)
      return (
        <>
          <View style={styles.heroIcon}>
            <BrandIcon name="network" size={34} />
          </View>
          <Text accessibilityRole="header" style={title}>
            {t('withdraw.errorTitle')}
          </Text>
          <Text accessibilityRole="alert" style={body}>
            {t(errorKey(state.error ?? { code: 'READ_FAILED' }))}
          </Text>
        </>
      );
    if (showOperators)
      return (
        <>
          <Text style={[...label, styles.muted]}>{t('withdraw.step', { current: 1 })}</Text>
          <Text accessibilityRole="header" style={title}>
            {t('withdraw.chooseTitle')}
          </Text>
          <Text style={[...body, styles.muted]}>{t('withdraw.chooseDescription')}</Text>
          <View style={styles.gap}>
            {(['wave', 'orange_money'] as const).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={t('withdraw.chooseOperator', {
                  operator: t(operatorKey(item)),
                })}
                onPress={() => select(item)}
                style={({ pressed }) => [styles.operator, pressed && styles.pressed]}
              >
                <View style={styles.operatorIcon}>
                  <OperatorLogo operator={item} size={52} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.operatorTitle, { fontFamily: fonts.title }]}>
                    {t(operatorKey(item))}
                  </Text>
                  <Text style={[...body, styles.muted]}>{t('withdraw.demoAccount')}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          <Text style={[...body, styles.muted]}>{t('withdraw.simulationHint')}</Text>
        </>
      );
    if (state.phase === 'amount' || state.phase === 'quoting')
      return (
        <>
          <Text style={[...label, styles.muted]}>{t('withdraw.step', { current: 2 })}</Text>
          <Text accessibilityRole="header" style={title}>
            {t('withdraw.amountTitle')}
          </Text>
          <View style={styles.selectedOperator}>
            {operator && <OperatorLogo operator={operator} size={32} />}
            <Text style={[...label, styles.flex]}>
              {operator ? t(operatorKey(operator)) : t('withdraw.operator')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('withdraw.changeOperator')}
              disabled={state.busy}
              onPress={() => setChoosingOperator(true)}
              style={styles.changeButton}
            >
              <Text style={label}>{t('withdraw.changeOperator')}</Text>
            </Pressable>
          </View>
          <Field
            label={t('withdraw.amountLabel')}
            value={state.amountInput}
            onChangeText={(value) => execute(() => controller.setAmount(value))}
            placeholder={t('withdraw.amountPlaceholder')}
            helperText={t('withdraw.amountHint')}
            error={state.amountError ? t(errorKey(state.amountError)) : undefined}
            disabled={state.busy}
            inputMode="numeric"
            keyboardType="number-pad"
          />
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('withdraw.shortcuts')}
            style={styles.shortcuts}
          >
            {[2500, 10000, 20000].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={t('withdraw.shortcut', { amount: money(value) })}
                accessibilityState={{
                  checked: state.amountInput.replace(/\s/g, '') === String(value),
                  disabled: state.busy,
                }}
                disabled={state.busy}
                onPress={() => execute(() => controller.setAmount(String(value)))}
                style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
              >
                <Text style={label}>{money(value)}</Text>
              </Pressable>
            ))}
          </View>
          {state.options && (
            <Text style={label}>
              {t('withdraw.indicativeFee', { amount: money(state.options.feeXof) })}
            </Text>
          )}
          {state.error && !state.amountError && (
            <View style={styles.notice}>
              <Text accessibilityRole="alert" style={body}>
                {t(errorKey(state.error))}
              </Text>
            </View>
          )}
          {state.balance && (
            <View style={styles.subtle}>
              <Text style={[...body, styles.muted]}>
                {t('withdraw.balance', { amount: sats(state.balance.availableSats) })}
              </Text>
              {state.balance.heldSats > 0 && (
                <Text style={body}>
                  {t('withdraw.held', { amount: sats(state.balance.heldSats) })}
                </Text>
              )}
            </View>
          )}
          <Text style={[...body, styles.muted]}>{t('withdraw.simulationHint')}</Text>
        </>
      );
    if (state.phase === 'review' && quote) {
      const seconds = Math.max(0, state.remainingSeconds),
        duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      return (
        <>
          <Text style={[...label, styles.muted]}>{t('withdraw.step', { current: 3 })}</Text>
          <Text accessibilityRole="header" style={title}>
            {t('withdraw.reviewTitle')}
          </Text>
          <View style={styles.amountCard}>
            <Text style={[...label, styles.onPrimary]}>{t('withdraw.destinationAmount')}</Text>
            {largeAmount(quote.amountXof, true)}
            <Text style={[...body, styles.onPrimary]}>{t(operatorKey(quote.operator))}</Text>
          </View>
          {priceBreakdown()}
          <Text style={[...body, styles.muted]}>
            {seconds > 0 ? t('withdraw.validity', { duration }) : t('withdraw.expiry')}
          </Text>
          <Button
            label={t('withdraw.edit')}
            variant="secondary"
            onPress={() => execute(() => controller.edit())}
          />
          <Text style={[...body, styles.muted]}>{t('withdraw.simulationHint')}</Text>
        </>
      );
    }
    const succeeded = state.phase === 'success',
      failed = state.phase === 'failed',
      submitting = state.phase === 'submitting';
    const icon: BrandIconName = succeeded
      ? 'check'
      : failed
        ? 'close'
        : submitting
          ? 'pending'
          : 'info';
    return (
      <>
        <View style={styles.heroIcon}>
          {state.busy ? (
            <ActivityIndicator color={tokens.colors.primary} />
          ) : (
            <BrandIcon
              name={icon}
              size={34}
              color={succeeded ? tokens.colors.success : tokens.colors.ink}
            />
          )}
        </View>
        <Text accessibilityRole="header" style={title}>
          {t(
            succeeded
              ? 'withdraw.successTitle'
              : failed
                ? 'withdraw.failedTitle'
                : submitting
                  ? 'withdraw.submittingTitle'
                  : state.phase === 'pending'
                    ? 'withdraw.pendingTitle'
                    : 'withdraw.unknownTitle',
          )}
        </Text>
        <Text accessibilityRole="status" style={body}>
          {t(
            succeeded
              ? 'withdraw.successDescription'
              : failed
                ? 'withdraw.failedDescription'
                : submitting
                  ? 'withdraw.submittingDescription'
                  : state.phase === 'pending'
                    ? 'withdraw.pendingDescription'
                    : 'withdraw.unknownDescription',
            {
              operator: operator ? t(operatorKey(operator)) : '',
              amount: amount === undefined ? '' : money(amount),
            },
          )}
        </Text>
        {amount !== undefined && largeAmount(amount)}
        {priceBreakdown()}
        {operation && (
          <View style={styles.receipt}>
            {detail(
              t('withdraw.status'),
              t(
                operation.status === 'reussi'
                  ? 'withdraw.succeeded'
                  : operation.status === 'echoue'
                    ? 'withdraw.failed'
                    : operation.status === 'en_attente'
                      ? 'withdraw.pending'
                      : 'withdraw.uncertain',
              ),
            )}
            {detail(t('withdraw.date'), historyDate(operation.createdAt))}
            <Text style={[...body, styles.muted]}>{t('withdraw.reference')}</Text>
            <Text selectable accessibilityLabel={operation.id} style={label}>
              {operation.id}
            </Text>
          </View>
        )}
        {state.error && (
          <View style={styles.notice}>
            <Text accessibilityRole="alert" style={body}>
              {t(errorKey(state.error))}
            </Text>
          </View>
        )}
        {!succeeded && !failed && (
          <Text style={[...body, styles.muted]}>{t('withdraw.leaveHint')}</Text>
        )}
        {state.canRetry && (
          <>
            <Text style={[...body, styles.muted]}>{t('withdraw.retryHint')}</Text>
            <Button
              label={t('withdraw.retry')}
              variant="secondary"
              disabled={state.busy}
              onPress={() => operation && execute(() => controller.retry(operation.id))}
            />
          </>
        )}
        {state.canNewRequest && (
          <Button
            label={t('withdraw.newRequest')}
            variant="secondary"
            disabled={state.busy}
            onPress={() => execute(() => controller.newRequest())}
          />
        )}
      </>
    );
  }
  function renderFooter() {
    if (!visible) return <Button label={t('withdraw.done')} variant="secondary" onPress={onBack} />;
    if (state.phase === 'unavailable' && onPreview)
      return <Button label={t('withdraw.previewAction')} variant="accent" onPress={onPreview} />;
    if (state.phase === 'error' && !state.committed)
      return (
        <Button
          label={t('withdraw.retryRead')}
          loading={state.busy}
          onPress={() => execute(() => controller.refresh())}
        />
      );
    if ((state.phase === 'amount' || state.phase === 'quoting') && !showOperators)
      return (
        <Button
          label={t(state.busy ? 'withdraw.preparing' : 'withdraw.prepare')}
          disabled={state.busy || !state.amountInput.trim()}
          loading={state.busy}
          onPress={() => execute(() => controller.prepare())}
        />
      );
    if (state.phase === 'review' && quote)
      return (
        <Button
          label={t(state.remainingSeconds > 0 ? 'withdraw.confirm' : 'withdraw.renew')}
          loading={state.busy}
          onPress={() =>
            execute(() =>
              state.remainingSeconds > 0 ? controller.confirm(quote.id) : controller.prepare(),
            )
          }
        />
      );
    if (state.phase === 'submitting')
      return <Button label={t('withdraw.confirming')} loading disabled onPress={() => undefined} />;
    if (state.canRefresh)
      return (
        <Button
          label={t(
            state.busy
              ? 'withdraw.refreshing'
              : operation
                ? 'withdraw.refresh'
                : 'withdraw.recover',
          )}
          loading={state.busy}
          disabled={state.busy}
          onPress={() => execute(() => controller.refresh())}
        />
      );
    return (
      <Button
        label={t('withdraw.done')}
        variant={privateReady ? 'primary' : 'secondary'}
        onPress={onBack}
      />
    );
  }
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <FormFrame header={header} bottomInset={insets.bottom} footer={renderFooter()}>
        {renderContent()}
        {previewControls && visible && <View style={styles.workshop}>{previewControls}</View>}
        {onExitPreview && (
          <Button label={t('withdraw.previewExit')} variant="secondary" onPress={onExitPreview} />
        )}
      </FormFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.colors.canvas },
  body: { ...tokens.typography.body, color: tokens.colors.ink },
  label: { ...tokens.typography.label, color: tokens.colors.ink },
  title: { fontSize: 34, lineHeight: 41, letterSpacing: -1, color: tokens.colors.ink },
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
  iconButton: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  simulation: { backgroundColor: tokens.colors.accent, paddingHorizontal: 20, paddingVertical: 7 },
  simulationText: {
    color: tokens.colors.onAccent,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
  muted: { color: tokens.colors.muted },
  onPrimary: { color: tokens.colors.onPrimary },
  small: { fontSize: 13, lineHeight: 20 },
  gap: { gap: 16 },
  flex: { flex: 1 },
  operator: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.colors.line,
    borderRadius: 24,
    backgroundColor: tokens.colors.surface,
  },
  operatorIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surface,
  },
  operatorTitle: { fontSize: 24, lineHeight: 32, color: tokens.colors.ink },
  selectedOperator: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  changeButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8, flexShrink: 1 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shortcut: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.line,
    backgroundColor: tokens.colors.surface,
  },
  subtle: { gap: 6 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  price: {
    fontSize: 36,
    lineHeight: 46,
    letterSpacing: -1,
    color: tokens.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  amountCard: { padding: 22, gap: 8, borderRadius: 26, backgroundColor: tokens.colors.primary },
  receipt: { padding: 20, gap: 14, borderRadius: 24, backgroundColor: tokens.colors.surface },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stacked: { flexDirection: 'column', gap: 4 },
  detailValue: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  total: { fontSize: 20, lineHeight: 28 },
  rule: { borderTopWidth: 1, borderTopColor: tokens.colors.line },
  notice: { padding: 16, borderRadius: 18, backgroundColor: tokens.colors.warningSurface, gap: 12 },
  pressed: { opacity: 0.72 },
  workshop: { borderTopWidth: 1, borderTopColor: tokens.colors.line, paddingTop: 20, gap: 12 },
});
