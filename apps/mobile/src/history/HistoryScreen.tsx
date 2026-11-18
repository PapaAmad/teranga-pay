import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatHomeNumber } from '../home/format';
import { receivePlatform, type ReceivePlatformPort } from '../receive/platform';
import { FormFrame } from '../send/FormFrame';
import { useTranslation } from '../translations';
import { RecoveryNotice } from '../reliability/RecoveryNotice';
import { BrandIcon, BrandMark, Button, tokens, useBrandFonts } from '../ui';
import { createHistoryController } from './controller';
import {
  historyAmountValue,
  historyDate,
  historyDayLabel,
  historyEntryDate,
  historyEntryId,
  historyEntryStatus,
  historyHour,
  historySections,
  historySignedNumber,
  historySatsValue,
} from './format';
import type { HistoryEntry, HistoryServices } from './ports';
import { historyDayKey, type HistoryDailyBucket, type HistoryCoverage } from './summary';

type TitleTranslate = {
  (key: 'history.received' | 'history.sent' | 'history.wave' | 'history.orange'): string;
  (key: 'history.withdrawal', options: { operator: string }): string;
};
export type HistoryFilter = 'all' | 'received' | 'sent' | 'simulated';
type Props = {
  services: HistoryServices;
  onBack: () => void;
  onRequireUnlock: () => void;
  active?: boolean;
  clock?: () => number;
  onPreview?: () => void;
  previewControls?: ReactNode;
  onExitPreview?: () => void;
  platform?: Pick<ReceivePlatformPort, 'share'>;
};
function entryTitle(entry: HistoryEntry, t: TitleTranslate) {
  return entry.source === 'wallet'
    ? t(entry.payment.direction === 'recu' ? 'history.received' : 'history.sent')
    : t('history.withdrawal', {
        operator: t(entry.withdrawal.operator === 'wave' ? 'history.wave' : 'history.orange'),
      });
}
const statusKeys = {
  reussi: 'history.succeeded',
  en_attente: 'history.pending',
  echoue: 'history.failed',
  incertain: 'history.uncertain',
} as const;
const filterKeys = {
  all: 'history.filters.all',
  received: 'history.filters.received',
  sent: 'history.filters.sent',
  simulated: 'history.filters.simulated',
} as const;
const filterNames: HistoryFilter[] = ['all', 'received', 'sent', 'simulated'];
const visibleAmount = (value: string) => value.replace(/\u00a0/g, '\u00a0\u200b');

/** Lecture seule : les reçus et cumuls ne créent aucune opération financière. */
export function HistoryScreen({
  services,
  onBack,
  onRequireUnlock,
  active = true,
  clock,
  onPreview,
  previewControls,
  onExitPreview,
  platform = receivePlatform,
}: Props) {
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [controller] = useState(() => createHistoryController(services, { now: clock }));
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [foreground, setForeground] = useState(
    AppState.currentState == null || AppState.currentState === 'active',
  );
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<'shareOpened' | 'shareDismissed' | 'shareFailed' | null>(
    null,
  );
  const guard = useRef({
    active: active && foreground,
    selection: null as string | null,
    revision: 0,
    busy: false,
  });
  const interrupted = !active || !foreground || state.status === 'suspended';
  const preview = services.mode === 'preview';
  const body = [styles.body, { fontFamily: fonts.body }];
  const label = [styles.label, { fontFamily: fonts.label }];
  const heading = [styles.title, { fontFamily: fonts.title }];
  const money = (value: number) => t('dashboard.money', { amount: formatHomeNumber(value) });
  const sats = (value: number) => t('dashboard.sats', { amount: formatHomeNumber(value) });
  const entry =
    selected && !interrupted ? state.entries.find((item) => item.key === selected) : undefined;
  const hidden =
    interrupted ||
    ['unavailable', 'locked', 'absent', 'error', 'idle', 'loading'].includes(state.status);
  const filtered = state.entries.filter(
    (item) =>
      filter === 'all' ||
      (filter === 'simulated'
        ? item.source === 'bridge_sim'
        : item.source === 'wallet' &&
          item.payment.direction === (filter === 'received' ? 'recu' : 'envoye')),
  );
  const sections = historySections(filtered);
  function clearShare() {
    guard.current.revision += 1;
    guard.current.busy = false;
    setSharing(false);
    setFeedback(null);
  }
  function select(key: string | null) {
    clearShare();
    guard.current.selection = key;
    setSelected(key);
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
      guard.current.active = active && visible;
      setForeground(visible);
      if (!visible) {
        select(null);
        controller.suspend();
      }
    });
    return () => listener.remove();
  }, [active, controller]);
  useEffect(() => {
    guard.current.active = active && foreground;
    if (active && foreground) void controller.resume();
    else {
      select(null);
      controller.suspend();
    }
  }, [active, foreground, controller]);
  useEffect(() => {
    if (state.status === 'locked' || state.status === 'absent' || state.status === 'unavailable')
      select(null);
  }, [state.status]);
  useEffect(() => {
    if (interrupted) return;
    const timer = setInterval(() => controller.tick(), 30_000);
    return () => clearInterval(timer);
  }, [controller, interrupted]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!guard.current.active || guard.current.selection === null) return false;
      select(null);
      return true;
    });
    return () => listener.remove();
  }, []);
  async function share(expectedKey: string) {
    const selection = guard.current.selection;
    const current = controller.getSnapshot();
    const target = current.entries.find((item) => item.key === selection);
    if (
      !guard.current.active ||
      guard.current.busy ||
      selection !== expectedKey ||
      current.status !== 'ready' ||
      !target
    )
      return;
    guard.current.busy = true;
    const token = ++guard.current.revision;
    setSharing(true);
    setFeedback(null);
    const status = historyEntryStatus(target),
      success = status === 'reussi';
    const value = historyAmountValue(target);
    const feeSats = target.source === 'wallet' ? target.payment.feeSats : target.withdrawal.feeSats;
    const valid = () =>
      guard.current.active &&
      guard.current.revision === token &&
      guard.current.selection === selection &&
      controller.getSnapshot().status === 'ready' &&
      controller
        .getSnapshot()
        .entries.some((item) => item.key === selection && historyEntryStatus(item) === status);
    try {
      const result = await platform.share({
        title: t('history.shareTitle'),
        message: t('history.shareMessage', {
          sourceContext: t(
            target.source === 'bridge_sim'
              ? 'history.shareSimulationContext'
              : preview
                ? 'history.sharePreviewContext'
                : 'history.shareNativeContext',
          ),
          type: entryTitle(target, t),
          status: t(statusKeys[status]),
          amount: value === null ? t('history.unknownAmount') : money(value),
          sats: sats(historySatsValue(target)),
          fees: target.source === 'wallet' ? sats(feeSats) : money(target.withdrawal.feeXof),
          date: historyDate(historyEntryDate(target)),
          id: historyEntryId(target),
          notice: [
            !success ? t('history.sharePendingNotice') : '',
            t(
              target.source === 'bridge_sim' || preview
                ? 'history.shareSimulationNotice'
                : success
                  ? 'history.shareSuccessNotice'
                  : 'history.sharePendingNotice',
            ),
          ]
            .filter(Boolean)
            .join('\n'),
        }),
      });
      if (valid()) setFeedback(result === 'dismissed' ? 'shareDismissed' : 'shareOpened');
    } catch {
      if (valid()) setFeedback('shareFailed');
    } finally {
      if (guard.current.revision === token) {
        guard.current.busy = false;
        setSharing(false);
      }
    }
  }
  const toolbar = (
    <>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('history.back')}
          style={styles.iconButton}
          onPress={() => (selected ? select(null) : onBack())}
        >
          <BrandIcon name="back" />
        </Pressable>
        <Text style={[...label, styles.navigation]}>{t('history.navigation')}</Text>
        {selected ? (
          <View style={styles.iconButton}>
            <BrandMark size={22} />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('history.refresh')}
            accessibilityState={{ disabled: state.refreshing || hidden }}
            disabled={state.refreshing || hidden}
            onPress={() => {
              void controller.refresh();
            }}
            style={styles.iconButton}
          >
            <BrandIcon name="history" size={23} />
          </Pressable>
        )}
      </View>
      {preview && (
        <View style={styles.preview}>
          <Text style={[...label, styles.previewText]}>{t('history.preview')}</Text>
        </View>
      )}
    </>
  );
  function amountText(
    bucket: HistoryDailyBucket,
    primary = false,
    coverage: HistoryCoverage = state.daily.walletCoverage,
  ) {
    const value =
      bucket.overflow || (coverage !== 'complete' && bucket.count === 0)
        ? t('history.unknownAmount')
        : bucket.xof !== null
          ? money(bucket.xof)
          : bucket.knownXof !== null && bucket.knownXof > 0
            ? t('history.knownAmount', { amount: money(bucket.knownXof) })
            : t('history.unknownAmount');
    return (
      <View style={styles.tight}>
        <Text
          accessibilityLabel={value}
          style={[
            primary ? styles.dayAmount : styles.secondaryAmount,
            { fontFamily: fonts.title },
            primary && styles.onPrimary,
          ]}
        >
          {visibleAmount(value)}
        </Text>
        {bucket.unknownXofCount > 0 && (
          <Text style={[...body, styles.small, primary && styles.onPrimary]}>
            {t('history.unknownCount', { count: bucket.unknownXofCount })}
          </Text>
        )}
        {bucket.overflow && (
          <Text style={[...body, styles.small, primary && styles.onPrimary]}>
            {t('history.overflow')}
          </Text>
        )}
      </View>
    );
  }
  const notices = (
    <>
      {state.walletState === 'hors_ligne' && (
        <Text accessibilityRole="status" style={[...body, styles.warning]}>
          {t('history.offline')}
        </Text>
      )}
      {state.walletState === 'synchronisation' && (
        <Text accessibilityRole="status" style={[...body, styles.warning]}>
          {t('history.syncing')}
        </Text>
      )}
      {state.payments.error && (
        <View style={styles.notice}>
          {state.payments.error?.code === 'READ_TIMEOUT' ? (
            <RecoveryNotice code="READ_TIMEOUT" />
          ) : (
            <Text accessibilityRole="alert" style={body}>
              {t('history.walletError')}
            </Text>
          )}
          <Button
            variant="secondary"
            label={t('history.retryWallet')}
            onPress={() => {
              if (
                state.payments.items.length &&
                state.payments.hasMore &&
                ['READ_FAILED', 'READ_TIMEOUT'].includes(state.payments.error?.code ?? '')
              )
                void controller.loadMore('wallet');
              else void controller.refresh();
            }}
          />
        </View>
      )}
      {state.withdrawals.error && state.walletState !== 'hors_ligne' && (
        <View style={styles.notice}>
          {state.withdrawals.error?.code === 'READ_TIMEOUT' ? (
            <RecoveryNotice code="READ_TIMEOUT" />
          ) : (
            <Text accessibilityRole="alert" style={body}>
              {t('history.withdrawalError')}
            </Text>
          )}
          <Button
            variant="secondary"
            label={t('history.retryWithdrawals')}
            onPress={() => {
              if (
                state.withdrawals.items.length &&
                state.withdrawals.hasMore &&
                ['READ_FAILED', 'READ_TIMEOUT'].includes(state.withdrawals.error?.code ?? '')
              )
                void controller.loadMore('bridge_sim');
              else void controller.refresh();
            }}
          />
        </View>
      )}
    </>
  );
  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.tight}>
        <Text accessibilityRole="header" style={[heading, styles.listTitle]}>
          {t('history.title')}
        </Text>
      </View>
      <View style={styles.dayCard}>
        <Text style={[...label, styles.onPrimary, styles.small]}>
          {t('history.dayHeading', { date: historyDayLabel(state.daily.dayKey) })}
        </Text>
        <View style={styles.dayPrice}>
          <Text style={[...label, styles.onPrimary]}>{t('history.receivedTotal')}</Text>
          {state.daily.walletCoverage === 'unavailable' ? (
            <Text style={[styles.dayAmount, styles.onPrimary, { fontFamily: fonts.title }]}>
              {t('history.unknownAmount')}
            </Text>
          ) : (
            amountText(state.daily.received, true)
          )}
        </View>
        <View style={[styles.dayBottom, fontScale >= 1.4 && styles.stack]}>
          <Text style={[...body, styles.onPrimary, styles.small]}>{t('history.sentTotal')}</Text>
          <Text style={[...label, styles.onPrimary]}>
            {state.daily.walletCoverage === 'unavailable' ||
            state.daily.sent.xof === null ||
            (state.daily.walletCoverage !== 'complete' && state.daily.sent.count === 0)
              ? t('history.unknownAmount')
              : money(state.daily.sent.xof)}
          </Text>
        </View>
        <Text accessibilityRole="status" style={[...label, styles.onPrimary, styles.small]}>
          {t(
            state.daily.walletStale
              ? 'history.old'
              : state.daily.walletCoverage === 'complete'
                ? 'history.complete'
                : 'history.partial',
          )}
        </Text>
      </View>
      <Text style={[...body, styles.muted, styles.small]}>
        {t(state.daily.walletCoverage === 'partial' ? 'history.partialBasis' : 'history.dayBasis')}
      </Text>
      {notices}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('history.filters.label')}
        style={[styles.filters, fontScale >= 1.4 && styles.filterStack]}
      >
        {filterNames.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityLabel={t(filterKeys[name])}
            accessibilityState={{ checked: filter === name }}
            aria-checked={filter === name}
            onPress={() => setFilter(name)}
            style={[styles.filter, filter === name && styles.filterSelected]}
          >
            <Text style={[...label, styles.small, filter === name && styles.onPrimary]}>
              {t(name === 'simulated' ? 'history.shortSimulationFilter' : filterKeys[name])}
            </Text>
          </Pressable>
        ))}
      </View>
      {filter === 'simulated' && (
        <View style={styles.simulationCard}>
          <Text style={label}>{t('history.simulatedTotal')}</Text>
          {state.daily.withdrawalCoverage !== 'unavailable' ? (
            amountText(state.daily.simulatedWithdrawals, false, state.daily.withdrawalCoverage)
          ) : (
            <Text style={body}>{t('history.withdrawalsUnavailable')}</Text>
          )}
          <Text style={[...body, styles.muted, styles.small]}>{t('history.simulationHint')}</Text>
        </View>
      )}
    </View>
  );
  const footer = (
    <View style={styles.listFooter}>
      {state.payments.hasMore && (
        <Button
          label={t(state.payments.loadingMore ? 'history.moreLoading' : 'history.moreWallet')}
          variant="secondary"
          loading={state.payments.loadingMore}
          onPress={() => {
            void controller.loadMore('wallet');
          }}
        />
      )}
      {state.withdrawals.hasMore && (
        <Button
          label={t(
            state.withdrawals.loadingMore ? 'history.moreLoading' : 'history.moreWithdrawals',
          )}
          variant="secondary"
          loading={state.withdrawals.loadingMore}
          onPress={() => {
            void controller.loadMore('bridge_sim');
          }}
        />
      )}
      {previewControls && <View style={styles.workshop}>{previewControls}</View>}
      {onExitPreview && (
        <Button label={t('history.previewExit')} variant="secondary" onPress={onExitPreview} />
      )}
    </View>
  );
  function renderRow(item: HistoryEntry) {
    const status = historyEntryStatus(item),
      value = historyAmountValue(item);
    const title = entryTitle(item, t),
      statusText = t(statusKeys[status]);
    const amount =
      value === null
        ? t('history.unknownAmount')
        : t('dashboard.money', { amount: historySignedNumber(item, value) });
    const incoming = item.source === 'wallet' && item.payment.direction === 'recu';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('history.rowLabel', {
          type: title + (item.source === 'bridge_sim' ? ` | ${t('history.simulated')}` : ''),
          amount,
          date: historyDate(historyEntryDate(item)),
          status: statusText,
        })}
        onPress={() => select(item.key)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.rowIcon}>
          <BrandIcon
            name={item.source === 'bridge_sim' ? 'withdraw' : incoming ? 'receive' : 'send'}
            size={24}
          />
        </View>
        <View style={styles.flex}>
          <View style={[styles.rowHeading, (width < 360 || fontScale >= 1.4) && styles.stack]}>
            <Text style={[...label, styles.flex]}>{title}</Text>
            <Text
              accessibilityLabel={amount}
              style={[
                ...label,
                styles.rowAmount,
                status === 'reussi' && incoming && styles.positive,
              ]}
            >
              {visibleAmount(amount)}
            </Text>
          </View>
          <View style={styles.rowMeta}>
            <Text style={[...body, styles.small, styles.muted]}>
              {historyHour(historyEntryDate(item))}
            </Text>
            <Text style={[...label, styles.small, status === 'echoue' && styles.warning]}>
              {statusText}
            </Text>
            {item.source === 'bridge_sim' && (
              <Text style={[...label, styles.small, styles.warning]}>{t('history.simulated')}</Text>
            )}
          </View>
          {value === null && (
            <Text style={[...body, styles.small, styles.muted]}>
              {sats(historySatsValue(item))}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }
  function receiptContent() {
    if (!entry)
      return (
        <View style={styles.listHeader}>
          <Text accessibilityRole="header" style={heading}>
            {t('history.missingTitle')}
          </Text>
          <Text style={body}>{t('history.missingHint')}</Text>
        </View>
      );
    const status = historyEntryStatus(entry),
      success = status === 'reussi',
      value = historyAmountValue(entry);
    const feeSats = entry.source === 'wallet' ? entry.payment.feeSats : entry.withdrawal.feeSats;
    return (
      <>
        <View style={styles.receiptIcon}>
          <BrandIcon
            name={success ? 'check' : 'info'}
            size={32}
            color={success ? tokens.colors.success : tokens.colors.primary}
          />
        </View>
        <View style={styles.tight}>
          <Text accessibilityRole="header" style={heading}>
            {t(
              !success
                ? 'history.detailTitle'
                : entry.source === 'bridge_sim'
                  ? 'history.withdrawalReceiptTitle'
                  : preview
                    ? 'history.previewReceiptTitle'
                    : 'history.receiptTitle',
            )}
          </Text>
          <Text style={[...body, styles.muted]}>{entryTitle(entry, t)}</Text>
        </View>
        <View style={styles.receiptCard}>
          <Text style={[...body, styles.muted]}>{t('history.amountLabel')}</Text>
          <Text
            accessibilityLabel={value === null ? t('history.unknownAmount') : money(value)}
            style={[styles.receiptAmount, { fontFamily: fonts.title }]}
          >
            {visibleAmount(value === null ? t('history.unknownAmount') : money(value))}
          </Text>
          <Text style={body}>{sats(historySatsValue(entry))}</Text>
          <View style={styles.receiptRule} />
          <Text style={[...body, styles.muted]}>{t('history.status')}</Text>
          <Text style={label}>{t(statusKeys[status])}</Text>
          <Text style={[...body, styles.muted]}>{t('history.feesLabel')}</Text>
          <Text style={label}>
            {entry.source === 'wallet' ? sats(feeSats) : money(entry.withdrawal.feeXof)}
          </Text>
          {entry.source === 'wallet' && feeSats > 0 && (
            <Text style={[...body, styles.muted, styles.small]}>{t('history.walletFeeHint')}</Text>
          )}
          {entry.source === 'bridge_sim' && (
            <>
              <Text style={[...body, styles.muted]}>{t('history.totalLabel')}</Text>
              <Text style={label}>{money(entry.withdrawal.totalXof)}</Text>
            </>
          )}
          <Text style={[...body, styles.muted]}>{t('history.operationDate')}</Text>
          <Text style={label}>{historyDate(historyEntryDate(entry))}</Text>
          <Text style={[...body, styles.muted, styles.small]}>{t('history.dateHint')}</Text>
          {entry.source === 'bridge_sim' && (
            <>
              <Text style={[...body, styles.muted]}>{t('history.checkedDate')}</Text>
              <Text style={label}>{historyDate(entry.withdrawal.updatedAt)}</Text>
            </>
          )}
          <Text style={[...body, styles.muted]}>{t('history.reference')}</Text>
          <Text selectable accessibilityLabel={historyEntryId(entry)} style={label}>
            {historyEntryId(entry).replace(/(.{20})/g, '$1\u200b')}
          </Text>
          {entry.source === 'wallet' && entry.payment.memo && (
            <>
              <Text style={[...body, styles.muted]}>{t('history.memo')}</Text>
              <Text style={body}>{entry.payment.memo}</Text>
            </>
          )}
        </View>
        <Text accessibilityRole="status" style={[...body, status !== 'reussi' && styles.warning]}>
          {t(
            status === 'en_attente'
              ? 'history.pendingHint'
              : status === 'echoue'
                ? 'history.failedHint'
                : status === 'incertain'
                  ? 'history.uncertainHint'
                  : entry.source === 'bridge_sim'
                    ? 'history.withdrawalSuccessHint'
                    : preview
                      ? 'history.previewSuccessHint'
                      : 'history.successHint',
          )}
        </Text>
        <View style={styles.rowMeta}>
          <BrandIcon name="info" size={18} />
          <Text style={[...body, styles.small, styles.muted, styles.flex]}>
            {t(entry.source === 'bridge_sim' ? 'history.sourceSimulation' : 'history.sourceWallet')}
          </Text>
        </View>
        {feedback && (
          <Text accessibilityRole="status" accessibilityLiveRegion="polite" style={body}>
            {t(`history.${feedback}`)}
          </Text>
        )}
      </>
    );
  }
  if (hidden) {
    const title = interrupted
      ? 'history.suspended'
      : state.status === 'locked'
        ? 'history.lockedTitle'
        : state.status === 'absent'
          ? 'history.absentTitle'
          : state.status === 'unavailable'
            ? 'history.unavailableTitle'
            : state.status === 'error'
              ? 'history.errorTitle'
              : 'history.loading';
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        {toolbar}
        <View style={styles.gate}>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={heading}>
            {t(title)}
          </Text>
          {!interrupted && <RecoveryNotice code={state.error?.code} />}
          {['idle', 'loading'].includes(state.status) && (
            <ActivityIndicator accessible={false} color={tokens.colors.primary} />
          )}
          {!interrupted && !['idle', 'loading'].includes(state.status) && (
            <>
              <Text style={body}>
                {t(
                  state.status === 'locked'
                    ? 'history.lockedDescription'
                    : state.status === 'absent'
                      ? 'history.absentDescription'
                      : state.status === 'unavailable'
                        ? 'history.unavailableDescription'
                        : 'history.errorDescription',
                )}
              </Text>
              {state.status === 'locked' || state.status === 'absent' ? (
                <Button label={t('history.unlock')} onPress={onRequireUnlock} />
              ) : state.status === 'unavailable' && onPreview ? (
                <Button label={t('history.previewAction')} variant="accent" onPress={onPreview} />
              ) : state.status === 'error' ? (
                <Button
                  label={t('history.retry')}
                  onPress={() => {
                    void controller.refresh();
                  }}
                />
              ) : null}
            </>
          )}
          {previewControls && !interrupted && previewControls}
          {onExitPreview && (
            <Button label={t('history.previewExit')} variant="secondary" onPress={onExitPreview} />
          )}
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View
        style={[styles.flex, selected !== null && styles.underlay]}
        pointerEvents={selected ? 'none' : 'auto'}
        accessibilityElementsHidden={selected !== null}
        importantForAccessibility={selected ? 'no-hide-descendants' : 'auto'}
        aria-hidden={selected !== null}
      >
        {toolbar}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => renderRow(item)}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={label}>
                {section.key === state.daily.dayKey
                  ? t('history.today')
                  : section.key === historyDayKey((clock ?? Date.now)() - 86_400_000)
                    ? t('history.yesterday')
                    : historyDayLabel(section.key)}
              </Text>
            </View>
          )}
          ListHeaderComponent={listHeader}
          ListFooterComponent={footer}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text
                accessibilityRole="header"
                style={[styles.emptyTitle, { fontFamily: fonts.title }]}
              >
                {t(
                  state.entries.length
                    ? 'history.emptyFilter'
                    : state.payments.status === 'error'
                      ? 'history.errorTitle'
                      : 'history.emptyTitle',
                )}
              </Text>
              <Text style={[...body, styles.muted]}>
                {t(
                  filter === 'simulated' && state.withdrawals.status === 'unavailable'
                    ? 'history.withdrawalsUnavailable'
                    : 'history.emptyDescription',
                )}
              </Text>
            </View>
          }
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          stickySectionHeadersEnabled
          refreshing={state.refreshing}
          onRefresh={() => {
            void controller.refresh();
          }}
          keyboardShouldPersistTaps="handled"
        />
      </View>
      {selected !== null && (
        <View style={[styles.detailLayer, { top: insets.top }]}>
          <FormFrame
            header={toolbar}
            bottomInset={insets.bottom}
            footer={
              entry ? (
                <Button
                  label={t(
                    sharing
                      ? 'history.sharing'
                      : historyEntryStatus(entry) === 'reussi'
                        ? 'history.shareReceipt'
                        : 'history.shareDetail',
                  )}
                  loading={sharing}
                  onPress={() => {
                    void share(entry.key);
                  }}
                />
              ) : (
                <Button label={t('history.returnToList')} onPress={() => select(null)} />
              )
            }
          >
            {receiptContent()}
          </FormFrame>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.colors.canvas },
  flex: { flex: 1 },
  body: { ...tokens.typography.body, color: tokens.colors.ink },
  label: { ...tokens.typography.label, color: tokens.colors.ink },
  title: { color: tokens.colors.ink, fontSize: 34, lineHeight: 41, letterSpacing: -1 },
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
  muted: { color: tokens.colors.muted },
  warning: { color: tokens.colors.warning },
  positive: { color: tokens.colors.success },
  onPrimary: { color: tokens.colors.onPrimary },
  small: { fontSize: 13, lineHeight: 20 },
  tight: { gap: 8 },
  listTitle: { fontSize: 26, lineHeight: 34, letterSpacing: -0.5 },
  listHeader: { paddingHorizontal: 24, paddingTop: 20, gap: 16 },
  listFooter: { padding: 24, gap: 12 },
  gate: { padding: 24, gap: 20 },
  dayCard: { backgroundColor: tokens.colors.primary, padding: 20, borderRadius: 26, gap: 8 },
  dayPrice: { gap: 5, paddingVertical: 4 },
  dayAmount: { fontSize: 36, lineHeight: 46, color: tokens.colors.ink, letterSpacing: -1 },
  secondaryAmount: { fontSize: 28, lineHeight: 36, color: tokens.colors.ink },
  dayBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.muted,
    paddingTop: 10,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterStack: { flexDirection: 'column' },
  filter: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 12,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.colors.line,
  },
  filterSelected: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  simulationCard: { backgroundColor: tokens.colors.surface, padding: 18, borderRadius: 20, gap: 8 },
  notice: { backgroundColor: tokens.colors.warningSurface, padding: 16, borderRadius: 18, gap: 12 },
  sectionHeader: {
    backgroundColor: tokens.colors.canvas,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 88,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.line,
    backgroundColor: tokens.colors.surface,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    backgroundColor: tokens.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowHeading: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stack: { flexDirection: 'column', gap: 4 },
  rowAmount: { textAlign: 'right', flexShrink: 1, fontVariant: ['tabular-nums'] },
  rowMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 6 },
  pressed: { opacity: 0.72 },
  empty: { padding: 24, gap: 12 },
  emptyTitle: { color: tokens.colors.ink, fontSize: 24, lineHeight: 32 },
  receiptIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCard: { padding: 22, backgroundColor: tokens.colors.surface, borderRadius: 24, gap: 10 },
  receiptAmount: { color: tokens.colors.ink, fontSize: 32, lineHeight: 42, letterSpacing: -0.6 },
  receiptRule: { borderTopWidth: 1, borderTopColor: tokens.colors.line, marginVertical: 8 },
  workshop: { borderTopWidth: 1, borderTopColor: tokens.colors.line, paddingTop: 20, gap: 12 },
  underlay: { opacity: 0 },
  detailLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.colors.canvas,
  },
});
