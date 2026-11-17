import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Payment, Result, WalletErrorCode, WalletState } from '@teranga-pay/contracts';

import { nativeWallet } from '../../modules/teranga-wallet/src';
import { useTranslation } from '../translations';
import {
  registerAddress,
  startAddressInbox,
  type AddressRegistration,
} from '../wallet/addressInbox';
import { createLdkWallet } from '../wallet/ldkWallet';
import { demoLightningAddressSettings, demoNodeSettings } from '../wallet/settings';
import { useSecureScreen } from '../wallet/useSecureScreen';

function LabButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.buttonDimmed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** Écran de test du wallet LDK Node (T15), réservé aux builds de développement. */
export function WalletLabScreen() {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [peerId, setPeerId] = useState(demoNodeSettings.peerId);
  const [invoiceToPay, setInvoiceToPay] = useState('');
  const [state, setState] = useState<WalletState>('absent');
  const [nodeId, setNodeId] = useState('');
  const [balanceSats, setBalanceSats] = useState<number | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [invoice, setInvoice] = useState('');
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<WalletErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [amountToPay, setAmountToPay] = useState('');
  const [username, setUsername] = useState('');
  // Jeton gardé en mémoire seulement dans cet écran de test ; l'onboarding (T14)
  // devra le ranger dans le stockage sécurisé du téléphone.
  const [addressToken, setAddressToken] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState<
    Exclude<AddressRegistration, { ok: true }>['code'] | 'UNAUTHORIZED' | null
  >(null);
  useSecureScreen(nativeWallet, words.length > 0);

  const wallet = useMemo(
    () => (nativeWallet ? createLdkWallet(nativeWallet, { ...demoNodeSettings, peerId }) : null),
    [peerId],
  );

  const refresh = useCallback(async () => {
    if (!wallet || !nativeWallet) return;
    const current = await wallet.state();
    setState(current);
    if (current === 'pret') {
      setNodeId(await nativeWallet.nodeId());
      const balance = await wallet.balance();
      if (balance.ok) setBalanceSats(balance.value.spendableSats);
    }
  }, [wallet]);

  useEffect(() => {
    void refresh();
    if (!wallet) return undefined;
    return wallet.subscribe((event) => {
      if (event.type === 'paiement') setLastPayment(event.payment);
      if (event.type === 'solde') setBalanceSats(event.balance.spendableSats);
    });
  }, [wallet, refresh]);

  useEffect(() => {
    if (!addressToken || !nativeWallet || state !== 'pret') return undefined;
    const inbox = startAddressInbox({
      apiUrl: demoLightningAddressSettings.apiUrl,
      token: addressToken,
      fetch: (url, init) => fetch(url, init),
      native: nativeWallet,
      onEvent: (event) => {
        if (event.type === 'erreur' && event.code === 'UNAUTHORIZED') {
          setAddressError('UNAUTHORIZED');
          setAddressToken(null);
        }
      },
    });
    return inbox.stop;
  }, [addressToken, state]);

  async function activateAddress() {
    setBusy(true);
    setAddressError(null);
    const result = await registerAddress(
      demoLightningAddressSettings.apiUrl,
      username,
      (url, init) => fetch(url, init),
    );
    if (result.ok) {
      setAddress(result.address);
      setAddressToken(result.token);
    } else {
      setAddressError(result.code);
    }
    setBusy(false);
  }

  async function run<T>(action: () => Promise<Result<T>>, onSuccess?: (value: T) => void) {
    setBusy(true);
    setError(null);
    const result = await action();
    if (result.ok) onSuccess?.(result.value);
    else setError(result.error.code);
    await refresh();
    setBusy(false);
  }

  if (!wallet) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('walletLab.title')}
        </Text>
        <Text style={styles.text}>{t('walletLab.unavailable')}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {t('walletLab.title')}
      </Text>
      <Text style={styles.notice}>{t('walletLab.notice')}</Text>
      <Text style={styles.text} testID="etat">
        {t('walletLab.state', { state: t(`walletLab.states.${state}`) })}
      </Text>
      {nodeId ? (
        <Text selectable style={styles.mono} testID="cle-noeud">
          {t('walletLab.nodeId', { nodeId })}
        </Text>
      ) : null}
      {balanceSats !== null ? (
        <Text style={styles.text} testID="solde">
          {t('walletLab.balance', { amountSats: balanceSats })}
        </Text>
      ) : null}

      <Text style={styles.label}>{t('walletLab.peerLabel')}</Text>
      <TextInput
        accessibilityLabel={t('walletLab.peerLabel')}
        autoCapitalize="none"
        onChangeText={setPeerId}
        style={styles.input}
        value={peerId}
      />
      <Text style={styles.label}>{t('walletLab.pinLabel')}</Text>
      <TextInput
        accessibilityLabel={t('walletLab.pinLabel')}
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={setPin}
        secureTextEntry
        style={styles.input}
        value={pin}
      />

      {state === 'absent' ? (
        <LabButton
          disabled={busy}
          label={t('walletLab.create')}
          onPress={() =>
            run(
              () => wallet.create(pin),
              (value) => setWords(value.recoveryWords),
            )
          }
        />
      ) : null}
      {state === 'verrouille' ? (
        <LabButton
          disabled={busy}
          label={t('walletLab.unlock')}
          onPress={() => run(() => wallet.unlock(pin))}
        />
      ) : null}
      {state === 'pret' ? (
        <>
          <LabButton
            disabled={busy}
            label={t('walletLab.receive')}
            onPress={() =>
              run(
                () => wallet.receive({ amountSats: 10_000, memo: t('walletLab.receiveMemo') }),
                (value) => setInvoice(value.paymentRequest),
              )
            }
          />
          <Text style={styles.label}>{t('walletLab.usernameLabel')}</Text>
          <TextInput
            accessibilityLabel={t('walletLab.usernameLabel')}
            autoCapitalize="none"
            onChangeText={setUsername}
            style={styles.input}
            value={username}
          />
          <LabButton
            disabled={busy}
            label={t('walletLab.activateAddress')}
            onPress={() => void activateAddress()}
          />
          {address ? (
            <Text selectable style={styles.mono} testID="adresse">
              {t('walletLab.address', { address })}
            </Text>
          ) : null}
          {addressError ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {t(`walletLab.addressErrors.${addressError}`)}
            </Text>
          ) : null}
          <Text style={styles.label}>{t('walletLab.invoiceLabel')}</Text>
          <TextInput
            accessibilityLabel={t('walletLab.invoiceLabel')}
            autoCapitalize="none"
            onChangeText={setInvoiceToPay}
            style={styles.input}
            value={invoiceToPay}
          />
          <Text style={styles.label}>{t('walletLab.amountLabel')}</Text>
          <TextInput
            accessibilityLabel={t('walletLab.amountLabel')}
            keyboardType="number-pad"
            onChangeText={setAmountToPay}
            style={styles.input}
            value={amountToPay}
          />
          <LabButton
            disabled={busy}
            label={t('walletLab.pay')}
            onPress={() =>
              run(
                () =>
                  wallet.send({
                    destination: invoiceToPay,
                    pin,
                    ...(amountToPay ? { amountSats: Number(amountToPay) } : {}),
                  }),
                (payment) => setLastPayment(payment),
              )
            }
          />
          <LabButton
            disabled={busy}
            label={t('walletLab.refresh')}
            onPress={() => void refresh()}
          />
          <LabButton
            disabled={busy}
            label={t('walletLab.lock')}
            onPress={() => void wallet.lock().then(refresh)}
          />
        </>
      ) : null}

      {busy ? <Text style={styles.text}>{t('walletLab.busy')}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error} testID="erreur">
          {t(`walletErrors.${error}`)}
        </Text>
      ) : null}
      {words.length > 0 ? (
        <Text selectable style={styles.mono}>
          {t('walletLab.recoveryWords', { words: words.join(' ') })}
        </Text>
      ) : null}
      {invoice ? (
        <Text selectable style={styles.mono} testID="facture">
          {t('walletLab.invoice', { invoice })}
        </Text>
      ) : null}
      {lastPayment ? (
        <Text style={styles.text} testID="dernier-paiement">
          {t('walletLab.lastPayment', {
            direction: t(
              lastPayment.direction === 'recu' ? 'walletLab.received' : 'walletLab.sent',
            ),
            amountSats: lastPayment.amountSats,
          })}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 12, backgroundColor: '#ffffff', flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '700' },
  notice: { color: '#7a4b00' },
  text: { fontSize: 16 },
  label: { fontSize: 14, fontWeight: '600' },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#555555',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b2545',
    paddingHorizontal: 16,
  },
  buttonDimmed: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  error: { color: '#b00020', fontSize: 16 },
});
