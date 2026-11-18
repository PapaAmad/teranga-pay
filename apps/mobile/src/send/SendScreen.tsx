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
import { useTranslation } from '../translations';
import { RecoveryNotice } from '../reliability/RecoveryNotice';
import { BrandIcon, Button, tokens, useBrandFonts } from '../ui';
import { createSendController, parseSendAmount } from './controller';
import { FormFrame } from './FormFrame';
import { sendPlatform, type SendPlatformPort } from './platform';
import type { SendServices } from './ports';
import { QrScanner } from './QrScanner';
import { RiskNotice } from '../risk/RiskNotice';

type Props = {
  services: SendServices;
  onBack: () => void;
  onRequireUnlock: () => void;
  onPreview?: () => void;
  active?: boolean;
  platform?: SendPlatformPort;
  previewControls?: ReactNode;
  previewDestination?: string;
  previewAddress?: string;
  onExitPreview?: () => void;
};

/** T20 orchestre les ports T11/T17/T21 ; aucun SDK ni transfert simulé caché. */
export function SendScreen({
  services,
  onBack,
  onRequireUnlock,
  onPreview,
  active = true,
  platform = sendPlatform,
  previewControls,
  previewDestination,
  previewAddress,
  onExitPreview,
}: Props) {
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [controller] = useState(() => createSendController(services));
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [foreground, setForeground] = useState(
    AppState.currentState == null || AppState.currentState === 'active',
  );
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [scanning, setScanning] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [pasteState, setPasteState] = useState<'busy' | 'error' | null>(null);
  const interaction = useRef({ active: active && foreground, revision: 0, pasting: false });
  const preview = services.mode === 'preview';
  const amountInvalid = amount.length > 0 && parseSendAmount(amount) === null;
  const interrupted = !active || !foreground;
  const phase = interrupted ? 'suspended' : state.phase;
  const result = ['sending', 'success', 'pending', 'unknown', 'failed'].includes(phase);
  const isRisk = ['riskChecking', 'riskWarning', 'riskUnavailable'].includes(phase);
  const isForm = ['destination', 'amount', 'quoting', 'review', 'pin'].includes(phase) || isRisk;
  const body = [styles.body, { fontFamily: fonts.body }];
  const label = [styles.label, { fontFamily: fonts.label }];
  const money = (value: number | null | undefined) =>
    value == null
      ? t('send.unknownValue')
      : t('dashboard.money', { amount: formatHomeNumber(value) });
  const sats = (value: number | null | undefined) =>
    value == null
      ? t('send.unknownValue')
      : t('dashboard.sats', { amount: formatHomeNumber(value) });
  const [title, description] =
    phase === 'success' && preview
      ? (['send.previewSuccessTitle', 'send.previewSuccessDescription'] as const)
      : phaseCopy[phase];
  const errorKey = errorNames.find((name) => name === state.error?.code);

  function clearPrivateInput() {
    interaction.current.revision += 1;
    interaction.current.pasting = false;
    setPin('');
    setAmount('');
    setScanning(false);
    setInvoiceOpen(false);
    setPasteState(null);
  }
  useEffect(() => {
    void controller.start();
    return () => {
      interaction.current.active = false;
      interaction.current.revision += 1;
      controller.dispose();
    };
  }, [controller]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const visible = next === 'active';
      interaction.current.active = visible && active;
      setForeground(visible);
      if (!visible) {
        clearPrivateInput();
        controller.suspend();
        Keyboard.dismiss();
      }
    });
    return () => subscription.remove();
  }, [active, controller]);
  useEffect(() => {
    interaction.current.active = active && foreground;
    if (active && foreground) void controller.resume();
    else {
      clearPrivateInput();
      controller.suspend();
    }
  }, [active, foreground, controller]);
  useEffect(() => {
    if (phase !== 'pin') setPin('');
    if (phase !== 'destination') {
      setScanning(false);
      setPasteState(null);
    }
  }, [phase]);

  async function paste() {
    if (
      !interaction.current.active ||
      interaction.current.pasting ||
      controller.getSnapshot().phase !== 'destination'
    )
      return;
    interaction.current.pasting = true;
    const token = ++interaction.current.revision;
    setPasteState('busy');
    try {
      const raw = await platform.readClipboard();
      if (
        interaction.current.active &&
        interaction.current.revision === token &&
        controller.getSnapshot().phase === 'destination'
      ) {
        controller.setDestination(raw);
        await controller.inspect();
        setPasteState(null);
      }
    } catch {
      if (
        interaction.current.active &&
        interaction.current.revision === token &&
        controller.getSnapshot().phase === 'destination'
      )
        setPasteState('error');
    } finally {
      if (interaction.current.revision === token) interaction.current.pasting = false;
    }
  }
  function inspect(raw: string) {
    if (!interaction.current.active || controller.getSnapshot().phase !== 'destination') return;
    interaction.current.revision += 1;
    interaction.current.pasting = false;
    setPasteState(null);
    setScanning(false);
    Keyboard.dismiss();
    controller.setDestination(raw);
    void controller.inspect();
  }
  function confirm() {
    if (!interaction.current.active) return;
    const entered = pin;
    setPin('');
    Keyboard.dismiss();
    void controller.confirm(entered);
  }
  function edit() {
    setPin('');
    setAmount('');
    Keyboard.dismiss();
    controller.edit();
  }

  let footer: ReactNode;
  if (phase === 'destination')
    footer = (
      <Button
        label={t('send.continue')}
        disabled={!state.destination.trim() || pasteState === 'busy' || state.busy}
        onPress={() => inspect(state.destination)}
      />
    );
  else if (phase === 'amount' || phase === 'quoting')
    footer = (
      <Button
        label={t('send.continue')}
        loading={state.busy}
        disabled={parseSendAmount(amount) === null}
        onPress={() => {
          Keyboard.dismiss();
          void controller.quoteAmount(amount);
        }}
      />
    );
  else if (phase === 'review')
    footer = (
      <Button
        label={t('send.confirm')}
        icon="shield"
        onPress={() => {
          void controller.requestPin();
        }}
      />
    );
  else if (isRisk)
    footer = (
      <View style={styles.gap}>
        <Button
          label={t('risk.cancel')}
          onPress={() => {
            controller.cancelRisk();
            onBack();
          }}
        />
        {phase !== 'riskChecking' && (
          <Button
            label={t(phase === 'riskUnavailable' ? 'risk.continueUnavailable' : 'risk.continue')}
            variant="secondary"
            onPress={() => controller.acknowledgeRisk()}
          />
        )}
      </View>
    );
  else if (phase === 'pin')
    footer = (
      <Button
        label={t(preview ? 'send.previewPay' : 'send.pay', {
          amount: money(state.preview?.amountXof),
        })}
        icon="send"
        loading={state.busy}
        disabled={!/^\d{6}$/.test(pin)}
        onPress={confirm}
      />
    );
  else if (phase === 'unavailable' && onPreview)
    footer = <Button label={t('send.previewAction')} variant="accent" onPress={onPreview} />;
  else if (phase === 'locked' || phase === 'absent')
    footer = (
      <Button
        label={t(phase === 'locked' ? 'send.unlock' : 'send.create')}
        onPress={onRequireUnlock}
      />
    );
  else if (phase === 'error' || phase === 'offline')
    footer = (
      <Button
        label={t('send.retry')}
        onPress={() => {
          void controller.refresh();
        }}
      />
    );
  else if (state.canRefreshPayment && !interrupted)
    footer = (
      <View style={styles.gap}>
        <Button
          label={t('send.checkPayment')}
          loading={state.busy}
          onPress={() => {
            void controller.refreshPayment();
          }}
        />
        <Button label={t('send.home')} variant="secondary" onPress={onBack} />
      </View>
    );
  else
    footer = (
      <Button
        label={t('send.home')}
        variant="secondary"
        disabled={phase === 'loading' || phase === 'idle' || phase === 'sending'}
        onPress={onBack}
      />
    );

  const scannerLabels = {
    title: t('send.scanner.title'),
    close: t('send.scanner.close'),
    instructions: t('send.scanner.instructions'),
    loading: t('send.scanner.loading'),
    permissionExplanation: t('send.scanner.permissionExplanation'),
    requestPermission: t('send.scanner.requestPermission'),
    permissionDenied: t('send.scanner.permissionDenied'),
    openSettings: t('send.scanner.openSettings'),
    permissionError: t('send.scanner.permissionError'),
    unavailable: t('send.scanner.unavailable'),
    retry: t('send.scanner.retry'),
  };
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {scanning && !interrupted ? (
        <QrScanner
          active={active && foreground}
          labels={scannerLabels}
          onClose={() => setScanning(false)}
          onScanned={inspect}
        />
      ) : (
        <FormFrame
          bottomInset={insets.bottom}
          footer={footer}
          header={
            <>
              <View style={styles.toolbar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('send.back')}
                  onPress={onBack}
                  style={styles.iconButton}
                >
                  <BrandIcon name="back" />
                </Pressable>
                <Text style={[...label, styles.navigation]}>{t('send.navigation')}</Text>
                <View style={styles.iconButton}>
                  <BrandIcon name="shield" size={22} />
                </View>
              </View>
              {preview && (
                <View style={styles.preview}>
                  <Text style={[...label, styles.previewText]}>{t('send.preview')}</Text>
                </View>
              )}
            </>
          }
        >
          {isForm && (
            <Text style={[...label, styles.step]}>
              {t('send.step', { current: phase === 'destination' ? 1 : phase === 'pin' ? 3 : 2 })}
            </Text>
          )}
          {result && (
            <View style={styles.statusMark}>
              <BrandIcon
                name={
                  phase === 'success'
                    ? 'check'
                    : phase === 'failed'
                      ? 'warning'
                      : phase === 'sending'
                        ? 'send'
                        : 'pending'
                }
                size={34}
                color={phase === 'success' ? tokens.colors.success : tokens.colors.primary}
              />
            </View>
          )}
          <View style={styles.gap}>
            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              style={[styles.title, { fontFamily: fonts.title }]}
            >
              {t(title)}
            </Text>
            <Text style={[...body, styles.muted]}>{t(description)}</Text>
          </View>
          {(phase === 'idle' ||
            phase === 'loading' ||
            phase === 'sending' ||
            phase === 'riskChecking') && (
            <ActivityIndicator color={tokens.colors.primary} accessibilityLabel={t(title)} />
          )}
          {(phase === 'riskWarning' || phase === 'riskUnavailable') && (
            <RiskNotice assessment={state.risk} />
          )}

          {!interrupted && <RecoveryNotice code={state.error?.code} committed={state.committed} />}
          {phase === 'destination' && (
            <>
              <View style={styles.gap}>
                <Text style={label}>{t('send.destination')}</Text>
                <TextInput
                  accessibilityLabel={t('send.destination')}
                  value={state.destination}
                  onChangeText={(value) => {
                    interaction.current.revision += 1;
                    interaction.current.pasting = false;
                    setPasteState(null);
                    controller.setDestination(value);
                  }}
                  placeholder={t('send.placeholder')}
                  placeholderTextColor={tokens.colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={8192}
                  multiline
                  style={[styles.input, ...body]}
                />
                <View style={[styles.actions, fontScale >= 1.4 && styles.stackActions]}>
                  <View style={styles.flex}>
                    <Button
                      label={t('send.scan')}
                      hint={t('send.scanHint')}
                      style={styles.compactAction}
                      icon="scan"
                      variant="primary"
                      disabled={pasteState === 'busy'}
                      onPress={() => {
                        interaction.current.revision += 1;
                        setPasteState(null);
                        setScanning(true);
                        Keyboard.dismiss();
                      }}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Button
                      label={t(pasteState === 'busy' ? 'send.pasting' : 'send.paste')}
                      style={styles.compactAction}
                      icon="copy"
                      variant="secondary"
                      loading={pasteState === 'busy'}
                      onPress={() => {
                        void paste();
                      }}
                    />
                  </View>
                </View>
              </View>
              {pasteState === 'error' && (
                <Text accessibilityRole="alert" style={[...body, styles.warning]}>
                  {t('send.pasteFailed')}
                </Text>
              )}
              <View style={styles.notice}>
                <BrandIcon name="info" size={23} />
                <Text style={[...body, styles.flex]}>{t('send.destinationHint')}</Text>
              </View>
              {preview && previewDestination && (
                <Button
                  variant="secondary"
                  label={t('send.previewFill')}
                  onPress={() => inspect(previewDestination)}
                />
              )}
              {preview && previewAddress && (
                <Button
                  variant="secondary"
                  label={t('send.previewAddress')}
                  onPress={() => inspect(previewAddress)}
                />
              )}
            </>
          )}

          {(phase === 'amount' || phase === 'quoting') && (
            <>
              <View style={styles.recipient}>
                <Text style={[...body, styles.muted]}>{t('send.to')}</Text>
                <Text selectable style={label}>
                  {state.destination.includes('@') ? state.destination : t('send.invoice')}
                </Text>
              </View>
              <View style={styles.amountField}>
                <Text style={label}>{t('send.amountLabel')}</Text>
                <View style={styles.amountLine}>
                  <TextInput
                    accessibilityLabel={t('send.amountLabel')}
                    accessibilityHint={amountInvalid ? t('send.errors.AMOUNT_INVALID') : undefined}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={7}
                    placeholder={t('send.amountPlaceholder')}
                    placeholderTextColor={tokens.colors.muted}
                    editable={!state.busy}
                    style={[styles.amountInput, { fontFamily: fonts.title }]}
                  />
                  <Text style={[...label, styles.currency]}>{t('dashboard.currency')}</Text>
                </View>
              </View>
              {amountInvalid && (
                <Text accessibilityRole="alert" style={[...body, styles.warning]}>
                  {t('send.errors.AMOUNT_INVALID')}
                </Text>
              )}
              <Text style={[...body, styles.muted]}>
                {t('send.available', { amount: money(state.balance?.spendableXof) })}
              </Text>
            </>
          )}

          {(['review', 'pin'].includes(phase) || isRisk || (result && state.preview)) && (
            <>
              <View style={styles.amountCard}>
                <View style={styles.cardTop}>
                  <Text style={[...label, styles.onPrimary]}>{t('send.amount')}</Text>
                  <BrandIcon name="send" size={25} color={tokens.colors.accent} />
                </View>
                <Text style={[styles.amountValue, { fontFamily: fonts.title }]}>
                  {money(state.preview?.amountXof)}
                </Text>
                <Text style={[...body, styles.onPrimary]}>{sats(state.preview?.amountSats)}</Text>
                <View style={styles.cardRecipient}>
                  <Text style={[...body, styles.onPrimary]}>{t('send.to')}</Text>
                  <Text selectable style={[...label, styles.onPrimary]}>
                    {state.destination.includes('@') ? state.destination : t('send.invoice')}
                  </Text>
                </View>
              </View>
              <View style={styles.details}>
                <View style={styles.detailRow}>
                  <Text style={[...body, styles.flex]}>{t('send.fee')}</Text>
                  <View style={styles.detailValue}>
                    <Text style={label}>{money(state.preview?.maxFeeXof)}</Text>
                    <Text style={[...body, styles.muted]}>{sats(state.preview?.maxFeeSats)}</Text>
                  </View>
                </View>
                <View style={[styles.detailRow, styles.total]}>
                  <Text style={[...label, styles.flex]}>{t('send.total')}</Text>
                  <View style={styles.detailValue}>
                    <Text style={label}>{money(state.totalMaxXof)}</Text>
                    <Text style={[...body, styles.muted]}>{sats(state.totalMaxSats)}</Text>
                  </View>
                </View>
                <Text style={[...body, styles.muted, styles.small]}>{t('send.feeHint')}</Text>
              </View>
              {state.preview?.memo && (
                <View style={styles.recipient}>
                  <Text style={label}>{t('send.memo')}</Text>
                  <Text style={body}>{state.preview.memo}</Text>
                </View>
              )}
              {phase === 'review' && (
                <>
                  {state.preview?.newRecipient && (
                    <View style={styles.notice}>
                      <BrandIcon name="info" size={23} />
                      <View style={styles.flex}>
                        <Text style={label}>{t('send.newRecipient')}</Text>
                        <Text style={body}>{t('send.newRecipientDescription')}</Text>
                      </View>
                    </View>
                  )}
                  {state.validUntil && (
                    <Text style={[...body, styles.muted, styles.small]}>
                      {t('send.expiry', { time: formatHomeDate(state.validUntil, { time: true }) })}
                    </Text>
                  )}
                  <Button label={t('send.edit')} variant="secondary" onPress={edit} />
                </>
              )}
            </>
          )}

          {(phase === 'review' || phase === 'pin' || isRisk) &&
            !state.destination.includes('@') && (
              <View style={styles.recipient}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(invoiceOpen ? 'send.invoiceHide' : 'send.invoiceDetails')}
                  accessibilityState={{ expanded: invoiceOpen }}
                  aria-expanded={invoiceOpen}
                  onPress={() => setInvoiceOpen((value) => !value)}
                  style={styles.disclosure}
                >
                  <Text style={[...label, styles.flex]}>
                    {t(invoiceOpen ? 'send.invoiceHide' : 'send.invoiceDetails')}
                  </Text>
                  <BrandIcon name="info" size={20} />
                </Pressable>
                {invoiceOpen && (
                  <Text
                    selectable
                    accessibilityLabel={state.destination}
                    style={[...body, styles.invoice]}
                  >
                    {state.destination.replace(/(.{24})/g, '$1\u200b')}
                  </Text>
                )}
              </View>
            )}
          {phase === 'pin' && (
            <View style={styles.gap}>
              {(state.risk === null || state.risk.confirmationRequired) && (
                <Text style={[...body, styles.warning]}>
                  {t(state.risk ? 'risk.pinNotice' : 'risk.pinUnavailableNotice')}
                </Text>
              )}
              <Text style={label}>{t('send.pinLabel')}</Text>
              <TextInput
                accessibilityLabel={t('send.pinLabel')}
                value={pin}
                onChangeText={(value) => setPin(value.replace(/[^0-9]/g, '').slice(0, 6))}
                secureTextEntry
                keyboardType="number-pad"
                inputMode="numeric"
                autoComplete="off"
                textContentType="none"
                maxLength={6}
                editable={!state.busy}
                style={[styles.input, styles.pin, { fontFamily: fonts.title }]}
              />
              {preview && (
                <Text style={[...body, styles.muted, styles.small]}>{t('send.pinPreview')}</Text>
              )}
              <Button
                label={t('send.edit')}
                variant="secondary"
                disabled={state.busy}
                onPress={edit}
              />
            </View>
          )}
          {isRisk && state.validUntil && (
            <Text style={[...body, styles.muted, styles.small]}>
              {t('send.expiry', { time: formatHomeDate(state.validUntil, { time: true }) })}
            </Text>
          )}
          {phase === 'riskUnavailable' && (
            <Button
              label={t('risk.retry')}
              variant="secondary"
              onPress={() => {
                void controller.requestPin();
              }}
            />
          )}
          {isRisk && <Text style={[...body, styles.muted, styles.small]}>{t('risk.privacy')}</Text>}
          {phase === 'unknown' && !state.canRefreshPayment && (
            <View style={styles.notice}>
              <BrandIcon name="info" size={23} />
              <Text style={[...body, styles.flex]}>{t('send.unknownWithoutId')}</Text>
            </View>
          )}
          {result && state.payment && (
            <View style={styles.recipient}>
              <Text style={[...body, styles.muted]}>{t('send.receiptReference')}</Text>
              <Text selectable style={label}>
                {state.payment.id}
              </Text>
              {state.payment.status !== 'en_attente' && (
                <Text style={body}>
                  {t('send.receiptFee', { sats: sats(state.payment.feeSats) })}
                </Text>
              )}
            </View>
          )}
          {state.error && state.error.code !== 'READ_TIMEOUT' && !result && !interrupted && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[...body, styles.warning]}
            >
              {t(errorKey ? `send.errors.${errorKey}` : 'send.errors.fallback')}
            </Text>
          )}
          <View style={styles.network}>
            <BrandIcon name="info" size={18} />
            <Text style={[...body, styles.muted, styles.small, styles.flex]}>
              {t('send.network')}
            </Text>
          </View>
          {previewControls && !interrupted && (
            <View style={styles.workshop}>{previewControls}</View>
          )}
          {onExitPreview && (
            <Button variant="secondary" label={t('send.previewExit')} onPress={onExitPreview} />
          )}
        </FormFrame>
      )}
    </SafeAreaView>
  );
}

const phaseCopy = {
  idle: ['send.loadingTitle', 'send.loadingDescription'],
  loading: ['send.loadingTitle', 'send.loadingDescription'],
  destination: ['send.title', 'send.description'],
  amount: ['send.amountTitle', 'send.amountDescription'],
  quoting: ['send.amountTitle', 'send.amountDescription'],
  review: ['send.reviewTitle', 'send.reviewDescription'],
  riskChecking: ['risk.checkingTitle', 'risk.checkingDescription'],
  riskWarning: ['risk.warningTitle', 'risk.warningDescription'],
  riskUnavailable: ['risk.unavailableTitle', 'risk.unavailableDescription'],
  pin: ['send.pinTitle', 'send.pinDescription'],
  sending: ['send.sendingTitle', 'send.sendingDescription'],
  success: ['send.successTitle', 'send.successDescription'],
  pending: ['send.pendingTitle', 'send.pendingDescription'],
  failed: ['send.failedTitle', 'send.failedDescription'],
  unknown: ['send.unknownTitle', 'send.unknownDescription'],
  locked: ['send.lockedTitle', 'send.lockedDescription'],
  absent: ['send.absentTitle', 'send.absentDescription'],
  offline: ['send.offlineTitle', 'send.offlineDescription'],
  unavailable: ['send.unavailableTitle', 'send.unavailableDescription'],
  error: ['send.errorTitle', 'send.errorDescription'],
  suspended: ['send.suspendedTitle', 'send.suspendedDescription'],
} as const;
const errorNames = [
  'DESTINATION_INVALID',
  'DESTINATION_WRONG_NETWORK',
  'AMOUNT_INVALID',
  'INSUFFICIENT_FUNDS',
  'INVOICE_EXPIRED',
  'QUOTE_EXPIRED',
  'RATE_UNAVAILABLE',
  'PIN_FORMAT',
  'PIN_INVALID',
  'PIN_LOCKED',
  'FEE_TOO_HIGH',
  'NETWORK_OFFLINE',
  'INVALID_DATA',
  'READ_FAILED',
] as const;

const styles = StyleSheet.create({
  compactAction: { paddingHorizontal: 12 },
  stackActions: { flexDirection: 'column' },
  disclosure: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  safe: { flex: 1, backgroundColor: tokens.colors.canvas },
  toolbar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    maxWidth: 648,
    width: '100%',
    alignSelf: 'center',
  },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  navigation: { flex: 1, textAlign: 'center', fontSize: 18 },
  preview: { backgroundColor: tokens.colors.accent, paddingHorizontal: 20, paddingVertical: 7 },
  previewText: { color: tokens.colors.onAccent, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  body: { ...tokens.typography.body, color: tokens.colors.ink },
  label: { ...tokens.typography.label, color: tokens.colors.ink },
  title: { fontSize: 32, lineHeight: 39, letterSpacing: -0.9, color: tokens.colors.ink },
  step: { fontSize: 13, lineHeight: 20, color: tokens.colors.muted },
  muted: { color: tokens.colors.muted },
  small: { fontSize: 13, lineHeight: 20 },
  gap: { gap: 10 },
  flex: { flex: 1 },
  input: {
    minHeight: 64,
    borderWidth: 1.5,
    borderColor: tokens.colors.outline,
    borderRadius: 16,
    backgroundColor: tokens.colors.surface,
    padding: 16,
    textAlignVertical: 'center',
  },
  pin: { fontSize: 28, letterSpacing: 12 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  notice: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: tokens.colors.warningSurface,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  warning: { color: tokens.colors.warning },
  recipient: { padding: 16, borderRadius: 16, backgroundColor: tokens.colors.surface, gap: 5 },
  amountField: { gap: 12, paddingVertical: 16 },
  amountLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amountInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    fontSize: 46,
    lineHeight: 62,
    color: tokens.colors.ink,
    borderBottomWidth: 2,
    borderBottomColor: tokens.colors.primary,
  },
  currency: { fontSize: 20 },
  amountCard: { padding: 22, borderRadius: 26, backgroundColor: tokens.colors.primary, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  onPrimary: { color: tokens.colors.onPrimary },
  amountValue: { color: tokens.colors.onPrimary, fontSize: 36, lineHeight: 46, letterSpacing: -1 },
  cardRecipient: {
    borderTopWidth: 1,
    borderTopColor: '#435667',
    marginTop: 10,
    paddingTop: 14,
    gap: 4,
  },
  details: { padding: 18, borderRadius: 18, backgroundColor: tokens.colors.surface, gap: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailValue: { flexShrink: 1, alignItems: 'flex-end' },
  total: { borderTopWidth: 1, borderTopColor: tokens.colors.line, paddingTop: 14 },
  network: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 4 },
  invoice: { fontSize: 13, lineHeight: 22 },
  workshop: { borderTopWidth: 1, borderTopColor: tokens.colors.line, paddingTop: 20 },
  statusMark: {
    width: 68,
    height: 68,
    backgroundColor: tokens.colors.surface,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
