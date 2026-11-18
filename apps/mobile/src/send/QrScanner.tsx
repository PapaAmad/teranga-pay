import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
  type PermissionResponse,
} from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandIcon, Button, tokens, useBrandFonts } from '../ui';

export type QrScannerLabels = {
  title: string;
  close: string;
  instructions: string;
  loading: string;
  permissionExplanation: string;
  requestPermission: string;
  permissionDenied: string;
  openSettings: string;
  permissionError: string;
  unavailable: string;
  retry: string;
};

type Props = {
  active: boolean;
  onScanned: (raw: string) => void;
  onClose: () => void;
  labels: QrScannerLabels;
  openSettings?: () => Promise<void>;
};

function isForeground() {
  return AppState.currentState == null || AppState.currentState === 'active';
}

export function QrScanner({ active, onScanned, onClose, labels, openSettings }: Props) {
  const fonts = useBrandFonts();
  // L'autoget Expo ne gère pas les rejets ; garder une erreur traduite et réessayable.
  const [, requestPermission, getPermission] = useCameraPermissions({
    get: false,
    request: false,
  });
  // Une ancienne promesse du hook peut terminer après une lecture plus récente.
  // Seule la génération encore active décide du droit de monter la caméra.
  const [permission, setPermission] = useState<PermissionResponse | null>(null);
  const [foreground, setForeground] = useState(isForeground);
  const foregroundRef = useRef(foreground);
  const activeRef = useRef(active);
  activeRef.current = active;
  const mounted = useRef(true);
  const permissionGeneration = useRef(0);
  const permissionBusy = useRef(false);
  const scanned = useRef(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const readPermission = useCallback(async () => {
    if (!mounted.current || !activeRef.current || !foregroundRef.current) return;
    const generation = ++permissionGeneration.current;
    setLoading(true);
    setPermissionError(false);
    try {
      const response = await getPermission();
      if (
        mounted.current &&
        generation === permissionGeneration.current &&
        activeRef.current &&
        foregroundRef.current
      ) {
        setPermission(response);
      }
    } catch {
      if (mounted.current && generation === permissionGeneration.current) setPermissionError(true);
    } finally {
      if (mounted.current && generation === permissionGeneration.current) setLoading(false);
    }
  }, [getPermission]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (next) => {
      const nextForeground = next === 'active';
      foregroundRef.current = nextForeground;
      if (!nextForeground) ++permissionGeneration.current;
      setForeground(nextForeground);
    });
    return () => {
      mounted.current = false;
      ++permissionGeneration.current;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (active) {
      scanned.current = false;
      setPaused(false);
    }
  }, [active]);

  useEffect(() => {
    if (active && foreground) void readPermission();
  }, [active, foreground, readPermission]);

  async function askPermission() {
    if (!mounted.current || permissionBusy.current || !activeRef.current || !foregroundRef.current)
      return;
    permissionBusy.current = true;
    const generation = ++permissionGeneration.current;
    setLoading(true);
    setPermissionError(false);
    try {
      const response = await requestPermission();
      if (
        mounted.current &&
        generation === permissionGeneration.current &&
        activeRef.current &&
        foregroundRef.current
      ) {
        setPermission(response);
      }
    } catch {
      if (mounted.current && generation === permissionGeneration.current) setPermissionError(true);
    } finally {
      permissionBusy.current = false;
      if (mounted.current && generation === permissionGeneration.current) setLoading(false);
    }
  }

  async function showSettings() {
    if (!mounted.current || permissionBusy.current || !activeRef.current || !foregroundRef.current)
      return;
    permissionBusy.current = true;
    try {
      await (openSettings ? openSettings() : Linking.openSettings());
    } catch {
      if (mounted.current) setPermissionError(true);
    } finally {
      permissionBusy.current = false;
    }
  }

  function onBarcodeScanned(result: BarcodeScanningResult) {
    if (
      !mounted.current ||
      !activeRef.current ||
      !foregroundRef.current ||
      scanned.current ||
      !permission?.granted ||
      result.type !== 'qr' ||
      typeof result.data !== 'string' ||
      result.data.length === 0
    )
      return;
    // Le verrou synchrone bloque les doublons avant même le prochain rendu React.
    scanned.current = true;
    setPaused(true);
    onScanned(result.data);
  }

  if (!active || !foreground) return null;

  const canUseCamera =
    permission?.granted && !loading && !permissionError && !cameraError && !paused;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { fontFamily: fonts.title }]}>
          {labels.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={labels.close}
          onPress={onClose}
          style={styles.close}
        >
          <BrandIcon name="close" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          {canUseCamera ? (
            <>
              <View style={styles.viewfinder}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  mute
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={onBarcodeScanned}
                  onMountError={() => {
                    if (mounted.current && activeRef.current && foregroundRef.current) {
                      setCameraError(true);
                    }
                  }}
                />
                <View pointerEvents="none" style={styles.target} />
              </View>
              <Text style={[styles.body, { fontFamily: fonts.body }]}>{labels.instructions}</Text>
            </>
          ) : loading ? (
            <View accessibilityLiveRegion="polite" style={styles.message}>
              <ActivityIndicator color={tokens.colors.primary} accessible={false} />
              <Text style={[styles.body, { fontFamily: fonts.body }]}>{labels.loading}</Text>
            </View>
          ) : permissionError || cameraError ? (
            <>
              <Text accessibilityRole="alert" style={[styles.body, { fontFamily: fonts.body }]}>
                {permissionError ? labels.permissionError : labels.unavailable}
              </Text>
              <Button
                label={labels.retry}
                onPress={() => {
                  setCameraError(false);
                  void readPermission();
                }}
              />
            </>
          ) : !permission?.granted ? (
            <>
              <Text style={[styles.body, { fontFamily: fonts.body }]}>
                {permission?.status === 'denied'
                  ? labels.permissionDenied
                  : labels.permissionExplanation}
              </Text>
              {permission?.canAskAgain === false ? (
                <Button label={labels.openSettings} onPress={() => void showSettings()} />
              ) : (
                <Button label={labels.requestPermission} onPress={() => void askPermission()} />
              )}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.canvas },
  header: {
    padding: tokens.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  title: { ...tokens.typography.title, color: tokens.colors.ink, flex: 1 },
  close: {
    minWidth: tokens.minimumTouchTarget,
    minHeight: tokens.minimumTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: tokens.radius.control,
  },
  content: { padding: tokens.spacing.xl, paddingTop: 0, flexGrow: 1 },
  column: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: tokens.spacing.xl },
  body: { ...tokens.typography.body, color: tokens.colors.ink },
  message: { gap: tokens.spacing.md, alignItems: 'center' },
  viewfinder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: tokens.radius.card,
    overflow: 'hidden',
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  target: {
    width: '72%',
    aspectRatio: 1,
    borderRadius: tokens.radius.control,
    borderWidth: 3,
    borderColor: tokens.colors.accent,
  },
});
