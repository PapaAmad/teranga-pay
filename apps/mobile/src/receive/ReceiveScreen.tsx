import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../translations';
import { BrandIcon, BrandMark, Button, tokens, useBrandFonts } from '../ui';
import { createReceiveController } from './controller';
import { receivePlatform, type ReceivePlatformPort } from './platform';
import type { ReceiveServices } from './ports';
import { ReceiveQr } from './ReceiveQr';

type Feedback = 'copied' | 'copyFailed' | 'shareOpened' | 'shareDismissed' | 'shareFailed';
type Props = {
  services: ReceiveServices;
  onBack: () => void;
  onRequireUnlock: () => void;
  onPreview?: () => void;
  platform?: ReceivePlatformPort;
  active?: boolean;
  previewControls?: ReactNode;
  onExitPreview?: () => void;
};

/** Lecture et partage d’une adresse publique ; aucun paiement ou compte n’est créé. */
export function ReceiveScreen({
  services,
  onBack,
  onRequireUnlock,
  onPreview,
  platform = receivePlatform,
  active = true,
  previewControls,
  onExitPreview,
}: Props) {
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [controller] = useState(() => createReceiveController(services));
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active' || AppState.currentState == null,
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<'copy' | 'share' | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const current = useRef({ active: active && foreground, revision: 0, busy: false });
  const preview = state.mode === 'preview';
  const address = active && foreground ? state.address : null;
  const usable = Boolean(address) && active && foreground && !state.refreshing && !state.error;
  const body = [styles.body, { fontFamily: fonts.body }];
  const label = [styles.label, { fontFamily: fonts.label }];
  const interrupted = !active || !foreground;
  const qrSize = Math.max(96, Math.min(Math.floor(width - 88), 240));
  const loading = !address && ['idle', 'loading'].includes(state.status);
  const blocked = state.status === 'locked' || state.status === 'absent';
  const titleKey = interrupted
    ? 'receive.interruptedTitle'
    : state.error
      ? 'receive.errorTitle'
      : address
        ? 'receive.title'
        : loading
          ? 'receive.loadingTitle'
          : state.status === 'locked'
            ? 'receive.lockedTitle'
            : state.status === 'absent'
              ? 'receive.absentTitle'
              : state.status === 'error' || state.status === 'offline'
                ? 'receive.errorTitle'
                : 'receive.unavailableTitle';

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const visible = next === 'active';
      current.current.active = visible && active;
      current.current.revision += 1;
      current.current.busy = false;
      setForeground(visible);
      setFeedback(null);
      setBusy(null);
      if (!visible) {
        setHelpOpen(false);
        controller.suspend();
      }
    });
    return () => subscription.remove();
  }, [active, controller]);

  useEffect(() => {
    current.current.active = active && foreground;
    current.current.revision += 1;
    current.current.busy = false;
    setFeedback(null);
    setBusy(null);
    if (active && foreground) void controller.resume();
    else {
      setHelpOpen(false);
      controller.suspend();
    }
  }, [active, foreground, controller]);

  useEffect(() => {
    current.current.revision += 1;
    current.current.busy = false;
    setFeedback(null);
    setBusy(null);
  }, [address, state.refreshing, state.error]);

  useEffect(
    () => () => {
      current.current.active = false;
      current.current.revision += 1;
      controller.dispose();
    },
    [controller],
  );

  async function perform(kind: 'copy' | 'share') {
    if (!usable || !address || current.current.busy || !current.current.active) return;
    const destinationAvailable = () => {
      const latest = controller.getSnapshot();
      return (
        latest.address === address &&
        !latest.error &&
        !latest.refreshing &&
        ['ready', 'offline', 'synchronising'].includes(latest.status)
      );
    };
    // Un événement de verrouillage peut précéder le nouveau rendu du bouton.
    if (!destinationAvailable()) return;
    current.current.busy = true;
    const revision = ++current.current.revision;
    setBusy(kind);
    setFeedback(null);
    const valid = () =>
      current.current.active && current.current.revision === revision && destinationAvailable();
    try {
      if (kind === 'copy') {
        const copied = await platform.copy(address);
        if (valid()) setFeedback(copied ? 'copied' : 'copyFailed');
      } else {
        const result = await platform.share({
          title: t('receive.shareTitle'),
          message: t(preview ? 'receive.previewShareMessage' : 'receive.shareMessage', { address }),
        });
        if (valid()) setFeedback(result === 'dismissed' ? 'shareDismissed' : 'shareOpened');
      }
    } catch {
      if (valid()) setFeedback(kind === 'copy' ? 'copyFailed' : 'shareFailed');
    } finally {
      if (current.current.revision === revision) {
        current.current.busy = false;
        setBusy(null);
      }
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('receive.back')}
          onPress={onBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <BrandIcon name="back" />
        </Pressable>
        <Text style={[...label, styles.navigation]}>{t('receive.navigation')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('receive.help')}
          accessibilityState={{ expanded: helpOpen }}
          aria-expanded={helpOpen}
          onPress={() => setHelpOpen((value) => !value)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <BrandIcon name="info" />
        </Pressable>
      </View>
      {preview && (
        <View style={styles.preview}>
          <Text style={[...label, styles.previewText]}>{t('receive.preview')}</Text>
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.intro}>
          <Text
            accessibilityRole="header"
            style={[
              styles.title,
              { fontFamily: fonts.title, fontSize: fontScale >= 1.6 ? 28 : 34 },
            ]}
          >
            {t(titleKey)}
          </Text>
          <Text style={[...body, styles.subtitle]}>
            {t(
              interrupted
                ? 'receive.interrupted'
                : state.error
                  ? 'receive.errorDescription'
                  : address
                    ? 'receive.description'
                    : loading
                      ? 'receive.loadingDescription'
                      : blocked
                        ? state.status === 'locked'
                          ? 'receive.lockedDescription'
                          : 'receive.absentDescription'
                        : state.status === 'error' || state.status === 'offline'
                          ? 'receive.errorDescription'
                          : 'receive.unavailableDescription',
            )}
          </Text>
        </View>

        <View style={styles.codeCard}>
          <View style={styles.cardHeading}>
            <Text style={[...label, styles.onPrimary]}>{t('receive.qrCaption')}</Text>
            <BrandIcon name="receive" size={23} color={tokens.colors.accent} />
          </View>
          {address && !state.error ? (
            <ReceiveQr value={address} maxSize={qrSize} label={t('receive.qrLabel', { address })} />
          ) : (
            <View style={styles.placeholder}>
              {loading && !interrupted ? (
                <ActivityIndicator color={tokens.colors.primary} accessible={false} />
              ) : (
                <BrandIcon name={blocked ? 'shield' : 'wallet'} size={42} />
              )}
              <Text
                role="status"
                accessibilityLiveRegion="polite"
                style={[...label, styles.center]}
              >
                {t(
                  interrupted
                    ? 'receive.interrupted'
                    : loading
                      ? 'receive.loading'
                      : 'receive.unavailableQr',
                )}
              </Text>
            </View>
          )}
          <View style={styles.signature}>
            <BrandMark size={18} color={tokens.colors.accent} />
            <Text style={[styles.signatureText, { fontFamily: fonts.label }]}>
              {t('receive.signature', { appName: t('appName') })}
            </Text>
          </View>
        </View>

        {address && (
          <View style={styles.addressSection}>
            <Text style={[...body, styles.muted]}>{t('receive.addressLabel')}</Text>
            <Text
              accessibilityLabel={address}
              style={[styles.address, { fontFamily: fonts.title }]}
            >
              {address.length > 30 ? address.replace(/(.{16})/g, '$1\u200b') : address}
            </Text>
          </View>
        )}

        {state.status === 'offline' && !interrupted && address && !state.error && (
          <View style={styles.notice}>
            <BrandIcon name="network" size={23} />
            <View style={styles.flex}>
              <Text style={label}>{t('receive.offline')}</Text>
              <Text style={body}>{t('receive.offlineDescription')}</Text>
            </View>
          </View>
        )}
        {state.status === 'synchronising' && address && (
          <View style={styles.notice}>
            <Text style={body}>{t('receive.syncDescription')}</Text>
          </View>
        )}
        {state.stale && state.error && address && (
          <Text accessibilityRole="alert" style={[...body, styles.warning]}>
            {t('receive.previous')}
          </Text>
        )}
        {state.refreshing && address && (
          <Text role="status" accessibilityLiveRegion="polite" style={body}>
            {t('receive.refreshing')}
          </Text>
        )}

        {address && (
          <View style={styles.actions}>
            <Button
              variant="accent"
              icon={feedback === 'copied' ? 'check' : 'copy'}
              label={t(busy === 'copy' ? 'receive.copying' : 'receive.copy')}
              disabled={!usable || busy !== null}
              loading={busy === 'copy'}
              onPress={() => {
                void perform('copy');
              }}
            />
            <Button
              variant="secondary"
              label={t(busy === 'share' ? 'receive.sharing' : 'receive.share')}
              disabled={!usable || busy !== null}
              loading={busy === 'share'}
              onPress={() => {
                void perform('share');
              }}
            />
          </View>
        )}

        {feedback && !interrupted && (
          <View
            style={[
              styles.feedback,
              (feedback === 'copyFailed' || feedback === 'shareFailed') && styles.feedbackWarning,
            ]}
          >
            <BrandIcon
              name={
                feedback === 'copied'
                  ? 'check'
                  : feedback === 'copyFailed' || feedback === 'shareFailed'
                    ? 'warning'
                    : 'info'
              }
              size={22}
            />
            <Text role="status" accessibilityLiveRegion="polite" style={[...body, styles.flex]}>
              {t(`receive.${feedback}`)}
            </Text>
          </View>
        )}

        {!interrupted &&
          (state.error || (!address && !loading)) &&
          (blocked ? (
            <Button
              label={t(state.status === 'locked' ? 'receive.unlock' : 'receive.create')}
              onPress={onRequireUnlock}
            />
          ) : state.status === 'unavailable' ? (
            onPreview && (
              <Button variant="accent" label={t('receive.previewAction')} onPress={onPreview} />
            )
          ) : (
            <Button
              label={t('receive.retry')}
              loading={state.refreshing}
              onPress={() => {
                void controller.refresh();
              }}
            />
          ))}
        {address && !preview && !state.error && (
          <Button
            variant="secondary"
            label={t('receive.refresh')}
            loading={state.refreshing}
            onPress={() => {
              void controller.refresh();
            }}
          />
        )}

        {address && (
          <Text style={[...body, styles.muted]}>
            {t(preview ? 'receive.previewHelper' : 'receive.helper')}
          </Text>
        )}
        {helpOpen && !interrupted && (
          <View style={styles.help}>
            <Text accessibilityRole="header" style={label}>
              {t('receive.help')}
            </Text>
            <Text style={body}>{t('receive.helpDescription')}</Text>
          </View>
        )}
        <View style={styles.network}>
          <BrandIcon name="info" size={18} />
          <Text style={[...body, styles.networkText]}>{t('receive.network')}</Text>
        </View>
        {address && <Text style={[...body, styles.scanHint]}>{t('receive.qrHint')}</Text>}
        {previewControls && <View style={styles.workshop}>{previewControls}</View>}
        {onExitPreview && (
          <Button variant="secondary" label={t('receive.previewExit')} onPress={onExitPreview} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.colors.canvas },
  scroll: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 68,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  navigation: { flex: 1, textAlign: 'center', fontSize: 18 },
  preview: { backgroundColor: tokens.colors.accent, paddingHorizontal: 20, paddingVertical: 8 },
  previewText: { textAlign: 'center', color: tokens.colors.onAccent, fontSize: 14, lineHeight: 20 },
  content: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 18,
  },
  intro: { gap: 10 },
  title: { color: tokens.colors.ink, lineHeight: 40, letterSpacing: -1 },
  subtitle: { color: tokens.colors.muted },
  body: { ...tokens.typography.body, color: tokens.colors.ink },
  label: { ...tokens.typography.label, color: tokens.colors.ink },
  codeCard: {
    padding: 18,
    borderRadius: 28,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    gap: 14,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  onPrimary: { color: tokens.colors.onPrimary },
  signature: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signatureText: { color: tokens.colors.onPrimary, fontSize: 13, lineHeight: 20, flexShrink: 1 },
  placeholder: {
    minHeight: 210,
    width: '100%',
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  center: { textAlign: 'center' },
  addressSection: { alignItems: 'center', gap: 9 },
  address: {
    fontSize: 22,
    lineHeight: 31,
    color: tokens.colors.ink,
    textAlign: 'center',
    width: '100%',
    letterSpacing: -0.4,
  },
  muted: { color: tokens.colors.muted, textAlign: 'center' },
  actions: { gap: 10 },
  feedback: {
    backgroundColor: tokens.colors.successSurface,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feedbackWarning: { backgroundColor: tokens.colors.warningSurface },
  notice: {
    backgroundColor: tokens.colors.warningSurface,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
  },
  warning: { color: tokens.colors.warning },
  flex: { flex: 1 },
  help: { padding: 18, borderRadius: 18, gap: 12, backgroundColor: tokens.colors.surface },
  network: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  networkText: { fontSize: 14, color: tokens.colors.muted, flexShrink: 1 },
  scanHint: { color: tokens.colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 21 },
  workshop: { borderTopWidth: 1, borderTopColor: tokens.colors.line, paddingTop: 20 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
