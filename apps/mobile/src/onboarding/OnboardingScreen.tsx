import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslation } from '../translations';
import { BrandIcon, BrandMark, Button, tokens, useBrandFonts } from '../ui';
import {
  createOnboardingController,
  type OnboardingController,
  type OnboardingStep,
} from './controller';
import { OnboardingArtwork } from './OnboardingArtwork';
import type { OnboardingServices } from './ports';

type Props = {
  services: OnboardingServices;
  onDiscover: () => void;
  onFinished: () => void;
  onPreview?: () => void;
  onExitPreview?: () => void;
};

const numberOfPhases = 4;

export function OnboardingScreen({ services, ...props }: Props) {
  const [session, setSession] = useState<{
    services: OnboardingServices;
    controller: OnboardingController;
  } | null>(null);
  useEffect(() => {
    const controller = createOnboardingController(services);
    setSession({ services, controller });
    return () => controller.dispose();
  }, [services]);
  if (!session || session.services !== services) return null;
  return <OnboardingContent controller={session.controller} {...props} />;
}

function OnboardingContent({
  controller,
  onDiscover,
  onFinished,
  onPreview,
  onExitPreview,
}: Omit<Props, 'services'> & { controller: OnboardingController }) {
  const { t } = useTranslation();
  const fonts = useBrandFonts();
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [pin, setPin] = useState('');
  const [pinVisible, setPinVisible] = useState(false);
  const [answers, setAnswers] = useState<readonly string[]>([]);
  const [inForeground, setInForeground] = useState(
    AppState.currentState === 'active' || AppState.currentState == null,
  );
  const [reduceMotion, setReduceMotion] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollViewInstance>(null);
  const { width, fontScale } = useWindowDimensions();
  const preview = state.mode === 'preview';
  const isPin = ['pin', 'pinConfirm', 'unlock'].includes(state.step);
  const phase = phaseFor(state.step);
  const phaseNames = [
    t('onboarding.phases.language'),
    t('onboarding.phases.code'),
    t('onboarding.phases.backup'),
    t('onboarding.phases.check'),
  ];
  const phaseName = phaseNames[phase - 1] ?? t('onboarding.phases.language');

  useEffect(() => {
    void controller.start();
    const appState = AppState.addEventListener('change', (next) => {
      const foreground = next === 'active';
      setInForeground(foreground);
      if (!foreground) {
        setPin('');
        setPinVisible(false);
        setAnswers([]);
        setHelpOpen(false);
        controller.suspend();
      } else void controller.resume();
    });
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      appState.remove();
      motion.remove();
    };
  }, [controller]);

  useEffect(() => {
    setPin('');
    setPinVisible(false);
    setAnswers([]);
    setHelpOpen(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
    opacity.stopAnimation();
    // Les secrets apparaissent sans effet ; aucune attente artificielle n’est ajoutée.
    if (!reduceMotion && ['language', 'prepare', 'complete'].includes(state.step)) {
      opacity.setValue(0.35);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    } else opacity.setValue(1);
  }, [state.step, opacity, reduceMotion]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (['words', 'creating', 'finishing'].includes(state.step)) {
        Alert.alert(t('onboarding.leave.title'), t('onboarding.leave.description'), [
          { text: t('onboarding.leave.stay'), style: 'cancel' },
          {
            text: t('onboarding.leave.confirm'),
            style: 'destructive',
            onPress: () => {
              setPin('');
              setPinVisible(false);
              setAnswers([]);
              controller.suspend();
              void controller.resume();
            },
          },
        ]);
        return true;
      }
      if (state.busy) return true;
      if (['language', 'prepare', 'pin', 'pinConfirm', 'verify'].includes(state.step)) {
        controller.back();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [controller, state.step, state.busy, t]);

  const errors: Record<string, string> = {
    PIN_FORMAT: t('onboarding.errors.pinFormat'),
    PIN_MISMATCH: t('onboarding.errors.pinMismatch'),
    PIN_INVALID: t('onboarding.errors.pinInvalid'),
    PIN_LOCKED: state.error?.retryAfterSeconds
      ? t('onboarding.errors.pinLockedDelay', { seconds: state.error.retryAfterSeconds })
      : t('onboarding.errors.pinLocked'),
    LANGUAGE_UNAVAILABLE: t('onboarding.errors.language'),
    STORAGE_UNAVAILABLE: t('onboarding.errors.storage'),
    PROTECTION_UNAVAILABLE: t('onboarding.errors.protection'),
    BACKUP_ANSWERS: t('onboarding.errors.backup'),
    SETUP_INTERRUPTED: t('onboarding.errors.interrupted'),
    SESSION_INTERRUPTED: t('onboarding.errors.interrupted'),
    SETUP_INCOMPLETE: t('onboarding.errors.recovery'),
    RECOVERY_UNAVAILABLE: t('onboarding.errors.recovery'),
    NETWORK_OFFLINE: t('onboarding.errors.offline'),
    WALLET_EXISTS: t('onboarding.errors.exists'),
    WALLET_ABSENT: t('onboarding.errors.absent'),
    WALLET_UNAVAILABLE: t('onboarding.errors.unavailable'),
    SERVICE_UNAVAILABLE: t('onboarding.errors.unavailable'),
  };
  const error = state.error
    ? (errors[state.error.code] ?? t('onboarding.errors.generic'))
    : undefined;
  const titleStyle = [styles.title, { fontFamily: fonts.title }];
  const bodyStyle = [styles.body, { fontFamily: fonts.body }];
  const labelStyle = [styles.label, { fontFamily: fonts.label }];
  const goBack = () => {
    setPin('');
    setPinVisible(false);
    controller.back();
  };
  const submitPin = () => {
    const value = pin;
    setPin('');
    setPinVisible(false);
    if (state.step === 'pin') controller.submitPin(value);
    else if (state.step === 'pinConfirm') void controller.confirmPin(value);
    else void controller.unlock(value);
  };
  const link = (label: string, onPress: () => void, expanded?: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
    >
      <Text style={labelStyle}>{label}</Text>
    </Pressable>
  );
  const primary = (label: string, action: () => void, disabled = false) => (
    <Button
      label={label}
      onPress={action}
      variant="accent"
      disabled={disabled || state.busy}
      loading={state.busy}
      style={styles.pill}
    />
  );

  let content;
  let footer;
  if (!inForeground) {
    content = (
      <View style={styles.privacyScreen}>
        <BrandMark size={86} />
        <Text style={bodyStyle}>{t('onboarding.errors.interrupted')}</Text>
      </View>
    );
  } else if (state.step === 'welcome') {
    content = (
      <>
        <Text style={[styles.eyebrow, { fontFamily: fonts.label }]}>
          {t('onboarding.welcome.eyebrow')}
        </Text>
        <Text
          accessibilityRole="header"
          style={[
            styles.welcomeTitle,
            { fontFamily: fonts.title },
            width < 360 && styles.narrowTitle,
          ]}
        >
          {t('onboarding.welcome.title')}
        </Text>
        {fontScale < 1.5 && (
          <View style={styles.art}>
            <OnboardingArtwork />
          </View>
        )}
        <Text style={[...bodyStyle, styles.welcomeDescription]}>
          {t('onboarding.welcome.description')}
        </Text>
      </>
    );
    footer = (
      <>
        {primary(t('onboarding.welcome.start'), controller.showLanguage)}
        {link(t('onboarding.welcome.discover'), onDiscover)}
        {!preview && onPreview && link(t('onboarding.preview.launch'), onPreview)}
        <Text style={[...bodyStyle, styles.footnote]}>{t('onboarding.welcome.note')}</Text>
      </>
    );
  } else if (state.step === 'language') {
    content = (
      <>
        <Text accessibilityRole="header" style={titleStyle}>
          {t('onboarding.language.title')}
        </Text>
        <Text style={bodyStyle}>{t('onboarding.language.description')}</Text>
        <View style={styles.choices} accessibilityRole="radiogroup">
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel={t('onboarding.language.french')}
            accessibilityState={{ checked: true }}
            style={styles.languageSelected}
            onPress={() => {}}
          >
            <View style={styles.flex}>
              <Text style={[styles.optionTitle, { fontFamily: fonts.title }]}>
                {t('onboarding.language.french')}
              </Text>
              <Text style={bodyStyle}>{t('onboarding.language.frenchDetail')}</Text>
            </View>
            <View style={styles.check}>
              <BrandIcon name="check" size={22} color={tokens.colors.onAccent} />
            </View>
          </Pressable>
          <View
            accessible
            accessibilityRole="radio"
            accessibilityLabel={t('onboarding.language.wolof')}
            accessibilityHint={t('onboarding.language.wolofDetail')}
            accessibilityState={{ disabled: true, checked: false }}
            style={styles.languageDisabled}
          >
            <Text style={[styles.optionTitle, { fontFamily: fonts.title }]}>
              {t('onboarding.language.wolof')}
            </Text>
            <Text style={bodyStyle}>{t('onboarding.language.wolofDetail')}</Text>
          </View>
        </View>
        <Text style={bodyStyle}>{t('onboarding.language.note')}</Text>
      </>
    );
    footer = primary(t('onboarding.actions.continue'), () => {
      void controller.selectLanguage('fr');
    });
  } else if (state.step === 'prepare') {
    const rows = [
      ['shield', t('onboarding.prepare.codeTitle'), t('onboarding.prepare.codeDetail')],
      ['copy', t('onboarding.prepare.wordsTitle'), t('onboarding.prepare.wordsDetail')],
      ['info', t('onboarding.prepare.privacyTitle'), t('onboarding.prepare.privacyDetail')],
    ] as const;
    content = (
      <>
        <Text accessibilityRole="header" style={titleStyle}>
          {t('onboarding.prepare.title')}
        </Text>
        <Text style={bodyStyle}>{t('onboarding.prepare.description')}</Text>
        <View style={styles.instructions}>
          {rows.map(([icon, title, description]) => (
            <View key={icon} style={styles.instruction}>
              <View style={styles.instructionIcon}>
                <BrandIcon name={icon} size={23} />
              </View>
              <View style={styles.flex}>
                <Text style={labelStyle}>{title}</Text>
                <Text style={[...bodyStyle, styles.muted]}>{description}</Text>
              </View>
            </View>
          ))}
        </View>
      </>
    );
    footer = primary(t('onboarding.prepare.ready'), controller.prepareWallet);
  } else if (isPin) {
    content = (
      <>
        <View style={styles.smallArtwork}>
          <BrandIcon name="shield" size={42} />
        </View>
        <Text accessibilityRole="header" style={titleStyle}>
          {t(
            state.step === 'pinConfirm'
              ? 'onboarding.pin.confirmTitle'
              : state.step === 'unlock'
                ? 'onboarding.unlock.title'
                : 'onboarding.pin.title',
          )}
        </Text>
        <Text style={bodyStyle}>
          {t(
            state.step === 'pinConfirm'
              ? 'onboarding.pin.confirmDescription'
              : state.step === 'unlock'
                ? 'onboarding.unlock.description'
                : 'onboarding.pin.description',
          )}
        </Text>
        <View style={styles.pinGroup}>
          <Text style={labelStyle}>
            {t(
              state.step === 'pinConfirm' ? 'onboarding.pin.confirmLabel' : 'onboarding.pin.label',
            )}
          </Text>
          <TextInput
            accessibilityLabel={t(
              state.step === 'pinConfirm' ? 'onboarding.pin.confirmLabel' : 'onboarding.pin.label',
            )}
            accessibilityHint={preview ? t('onboarding.preview.pinHint') : t('onboarding.pin.hint')}
            accessibilityState={{ disabled: state.busy }}
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
            secureTextEntry={!pinVisible}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={6}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            editable={!state.busy}
            onSubmitEditing={submitPin}
            style={[styles.pinInput, { fontFamily: fonts.title }, error && styles.inputError]}
            selectionColor={tokens.colors.selectionSurface}
          />
          {link(t(pinVisible ? 'onboarding.actions.hide' : 'onboarding.actions.show'), () =>
            setPinVisible((v) => !v),
          )}
          <Text style={bodyStyle}>
            {preview ? t('onboarding.preview.pinHint') : t('onboarding.pin.hint')}
          </Text>
        </View>
      </>
    );
    footer = primary(
      t(
        state.step === 'pinConfirm'
          ? 'onboarding.pin.create'
          : state.step === 'unlock'
            ? 'onboarding.actions.unlock'
            : 'onboarding.actions.continue',
      ),
      submitPin,
      pin.length !== 6,
    );
  } else if (state.step === 'words') {
    content = (
      <>
        <Text accessibilityRole="header" style={titleStyle}>
          {t('onboarding.words.title')}
        </Text>
        <Text style={bodyStyle}>{t('onboarding.words.description')}</Text>
        <View style={styles.wordGrid}>
          {state.recoveryWords.map((word, index) => (
            <View
              key={index}
              accessible
              accessibilityLabel={t('onboarding.words.wordLabel', { position: index + 1, word })}
              style={styles.word}
            >
              <Text accessible={false} style={[styles.wordNumber, { fontFamily: fonts.body }]}>
                {index + 1}
              </Text>
              <Text accessible={false} style={[styles.wordText, { fontFamily: fonts.label }]}>
                {word}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.notice}>
          <BrandIcon name="shield" />
          <Text style={[...bodyStyle, styles.flex]}>{t('onboarding.words.privacy')}</Text>
        </View>
        {link(t('onboarding.words.help'), () => setHelpOpen((v) => !v), helpOpen)}
        {helpOpen && <Text style={bodyStyle}>{t('onboarding.words.lightning')}</Text>}
      </>
    );
    footer = primary(t('onboarding.words.noted'), controller.showVerification);
  } else if (state.step === 'verify') {
    content = (
      <>
        <Text accessibilityRole="header" style={titleStyle}>
          {t('onboarding.verify.title')}
        </Text>
        <Text style={bodyStyle}>{t('onboarding.verify.description')}</Text>
        <View style={styles.questions}>
          {state.verification.map((question, index) => (
            <View key={question.position} style={styles.question}>
              <Text style={labelStyle}>
                {t('onboarding.verify.question', { position: question.position })}
              </Text>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={t('onboarding.verify.question', {
                  position: question.position,
                })}
                style={[styles.answerRow, width < 360 && styles.answerColumn]}
              >
                {question.choices.map((word) => (
                  <Pressable
                    key={word}
                    accessibilityRole="radio"
                    accessibilityLabel={t('onboarding.verify.choice', {
                      position: question.position,
                      word,
                    })}
                    accessibilityState={{ checked: answers[index] === word }}
                    onPress={() =>
                      setAnswers((current) =>
                        state.verification.map((_, i) => (i === index ? word : (current[i] ?? ''))),
                      )
                    }
                    style={({ pressed }) => [
                      styles.answer,
                      answers[index] === word && styles.answerSelected,
                      pressed && styles.linkPressed,
                    ]}
                  >
                    <Text style={labelStyle}>{word}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
        <Text style={bodyStyle}>{t('onboarding.verify.note')}</Text>
      </>
    );
    footer = (
      <>
        {primary(
          t('onboarding.actions.finish'),
          () => {
            void controller.verifyBackup(answers);
          },
          answers.length !== 3 || answers.some((answer) => !answer),
        )}
        {link(t('onboarding.actions.review'), controller.back)}
      </>
    );
  } else if (state.step === 'complete') {
    content = (
      <View style={styles.complete}>
        <View style={styles.successMark}>
          <BrandIcon name="check" size={48} />
        </View>
        <Text accessibilityRole="header" style={titleStyle}>
          {t(preview ? 'onboarding.complete.previewTitle' : 'onboarding.complete.title')}
        </Text>
        <Text style={bodyStyle}>
          {t(
            preview ? 'onboarding.complete.previewDescription' : 'onboarding.complete.description',
          )}
        </Text>
        <View style={styles.summary}>
          <Text style={labelStyle}>
            {t(preview ? 'onboarding.complete.previewSummary' : 'onboarding.complete.summary')}
          </Text>
        </View>
      </View>
    );
    footer = primary(
      t(preview ? 'onboarding.preview.exit' : 'onboarding.actions.enter'),
      preview ? (onExitPreview ?? onFinished) : onFinished,
    );
  } else if (state.step === 'creating' || state.step === 'finishing') {
    content = (
      <View style={styles.complete}>
        <BrandMark size={80} />
        <ActivityIndicator size="large" color={tokens.colors.primary} />
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={titleStyle}>
          {t(
            state.step === 'creating'
              ? 'onboarding.actions.creating'
              : 'onboarding.actions.finishing',
          )}
        </Text>
      </View>
    );
  } else {
    const kind =
      state.step === 'unavailable' ? 'unavailable' : state.step === 'blocked' ? 'blocked' : 'error';
    content = (
      <>
        <View style={styles.smallArtwork}>
          <BrandIcon name={kind === 'unavailable' ? 'pending' : 'shield'} size={42} />
        </View>
        <Text accessibilityRole="header" style={titleStyle}>
          {t(
            kind === 'unavailable'
              ? 'onboarding.unavailable.title'
              : kind === 'blocked'
                ? 'onboarding.blocked.title'
                : 'onboarding.error.title',
          )}
        </Text>
        <Text style={bodyStyle}>
          {t(
            kind === 'unavailable'
              ? 'onboarding.unavailable.description'
              : kind === 'blocked'
                ? 'onboarding.blocked.description'
                : 'onboarding.error.description',
          )}
        </Text>
      </>
    );
    footer = (
      <>
        {!preview && onPreview && primary(t('onboarding.preview.launch'), onPreview)}
        {link(t('onboarding.actions.retry'), () => {
          void controller.retry();
        })}
        {link(t('onboarding.welcome.discover'), onDiscover)}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.toolbar}>
          {phase > 0 &&
          !['words', 'complete', 'creating', 'finishing', 'unlock'].includes(state.step) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.actions.back')}
              disabled={state.busy}
              onPress={goBack}
              style={styles.back}
            >
              <BrandIcon name="back" />
            </Pressable>
          ) : (
            <BrandMark size={30} />
          )}
          <Text style={[styles.brand, { fontFamily: fonts.title }]}>{t('appName')}</Text>
          <View
            style={styles.networkDot}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
        {preview && (
          <View style={styles.preview}>
            <Text style={[styles.previewText, { fontFamily: fonts.label }]}>
              {t('onboarding.preview.notice')}
            </Text>
          </View>
        )}
        {phase > 0 && (
          <View style={styles.progress}>
            <View
              style={styles.segments}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t('onboarding.progress', {
                current: phase,
                total: numberOfPhases,
                phase: phaseName,
              })}
              accessibilityValue={{ min: 1, max: numberOfPhases, now: phase }}
            >
              {[1, 2, 3, 4].map((segment) => (
                <View
                  key={segment}
                  style={[styles.segment, segment <= phase && styles.segmentDone]}
                />
              ))}
            </View>
            <Text style={[styles.phaseLabel, { fontFamily: fonts.label }]}>
              {t('onboarding.progress', {
                current: phase,
                total: numberOfPhases,
                phase: phaseName,
              })}
            </Text>
          </View>
        )}
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <Animated.View style={[styles.content, { opacity }]}>
            {content}
            {inForeground && error && (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[styles.error, { fontFamily: fonts.body }]}
              >
                {error}
              </Text>
            )}
          </Animated.View>
          {inForeground && footer && <View style={styles.footer}>{footer}</View>}
          {preview &&
            state.step !== 'complete' &&
            inForeground &&
            onExitPreview &&
            link(t('onboarding.preview.exit'), onExitPreview)}
        </ScrollView>
        {state.step === 'welcome' && (
          <View style={styles.network}>
            <Text style={[styles.networkLabel, { fontFamily: fonts.body }]}>
              {t('onboarding.welcome.network')}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function phaseFor(step: OnboardingStep) {
  if (step === 'language') return 1;
  if (['prepare', 'pin', 'pinConfirm'].includes(step)) return 2;
  if (['creating', 'words'].includes(step)) return 3;
  if (['verify', 'finishing', 'complete'].includes(step)) return 4;
  return 0;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.colors.canvas },
  flex: { flex: 1 },
  toolbar: {
    width: '100%',
    maxWidth: 568,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 70,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  brand: { fontSize: 21, lineHeight: 28, color: tokens.colors.ink, flex: 1 },
  networkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colors.primary },
  back: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  scroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 568,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  content: { paddingTop: 18, gap: 18 },
  title: { fontSize: 36, lineHeight: 44, letterSpacing: -1.1, color: tokens.colors.ink },
  welcomeTitle: { fontSize: 43, lineHeight: 49, letterSpacing: -1.5, color: tokens.colors.ink },
  narrowTitle: { fontSize: 38, lineHeight: 44 },
  eyebrow: { fontSize: 14, lineHeight: 20, color: tokens.colors.muted },
  body: { ...tokens.typography.body, color: tokens.colors.ink },
  label: { ...tokens.typography.label, color: tokens.colors.ink },
  welcomeDescription: { marginTop: -8, fontSize: 18, lineHeight: 27 },
  art: { marginHorizontal: -16, marginTop: -10, marginBottom: -2 },
  footer: { marginTop: 'auto', gap: 4, paddingTop: 28, paddingBottom: 4 },
  pill: { borderRadius: 32, minHeight: 60 },
  link: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkPressed: { opacity: 0.65 },
  footnote: {
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  network: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 6 },
  networkLabel: { fontSize: 12, lineHeight: 18, color: tokens.colors.muted },
  preview: {
    backgroundColor: tokens.colors.warningSurface,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  previewText: { fontSize: 14, lineHeight: 20, color: tokens.colors.warning, textAlign: 'center' },
  progress: {
    width: '100%',
    maxWidth: 568,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 6,
    gap: 10,
  },
  segments: { flexDirection: 'row', gap: 5 },
  segment: { height: 3, borderRadius: 2, backgroundColor: tokens.colors.line, flex: 1 },
  segmentDone: { backgroundColor: tokens.colors.primary },
  phaseLabel: { fontSize: 13, lineHeight: 20, color: tokens.colors.muted },
  choices: { gap: 12, marginVertical: 20 },
  languageSelected: {
    minHeight: 112,
    padding: 20,
    borderRadius: 24,
    backgroundColor: tokens.colors.surface,
    borderWidth: 2,
    borderColor: tokens.colors.primary,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  languageDisabled: {
    minHeight: 112,
    padding: 20,
    borderRadius: 24,
    backgroundColor: tokens.colors.disabledSurface,
    gap: 6,
  },
  optionTitle: { fontSize: 24, lineHeight: 32, color: tokens.colors.ink },
  check: {
    backgroundColor: tokens.colors.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructions: { gap: 24, marginVertical: 14 },
  instruction: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  instructionIcon: { padding: 12, backgroundColor: tokens.colors.surface, borderRadius: 18 },
  muted: { color: tokens.colors.muted, marginTop: 5 },
  smallArtwork: {
    width: 76,
    height: 76,
    borderRadius: 25,
    backgroundColor: tokens.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pinGroup: { marginTop: 18, gap: 12 },
  pinInput: {
    minHeight: 78,
    borderWidth: 2,
    borderColor: tokens.colors.outline,
    borderRadius: 18,
    backgroundColor: tokens.colors.surface,
    color: tokens.colors.ink,
    fontSize: 28,
    lineHeight: 38,
    letterSpacing: 12,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  inputError: { borderColor: tokens.colors.error },
  wordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  word: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '46%',
    flexGrow: 1,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.line,
    gap: 10,
  },
  wordNumber: { fontSize: 13, lineHeight: 20, color: tokens.colors.muted },
  wordText: { fontSize: 16, lineHeight: 24, color: tokens.colors.ink, flexShrink: 1 },
  notice: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: tokens.colors.warningSurface,
  },
  questions: { gap: 24, paddingVertical: 18 },
  question: { gap: 12 },
  answerRow: { flexDirection: 'row', gap: 8 },
  answerColumn: { flexDirection: 'column' },
  answer: {
    minHeight: 52,
    flexGrow: 1,
    flexBasis: 0,
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: tokens.colors.line,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
  },
  answerSelected: { borderColor: tokens.colors.primary, backgroundColor: tokens.colors.accent },
  error: {
    ...tokens.typography.body,
    color: tokens.colors.error,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.error,
    paddingLeft: 12,
    marginTop: 8,
  },
  complete: { gap: 24, paddingTop: 36, alignItems: 'flex-start' },
  successMark: {
    width: 108,
    height: 108,
    backgroundColor: tokens.colors.accent,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summary: { padding: 18, borderRadius: 20, backgroundColor: tokens.colors.surface },
  privacyScreen: { gap: 28, paddingTop: 100, alignItems: 'center' },
});
