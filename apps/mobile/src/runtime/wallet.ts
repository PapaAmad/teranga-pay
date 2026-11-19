import {
  fail,
  ok,
  xofToSats,
  type RateInfo,
  type Result,
  type Wallet,
  type WalletEvent,
} from '@teranga-pay/contracts';

import type { NativeWallet, NodeSettings } from '../../modules/teranga-wallet/src';
import type { CollectInvoicePort, CollectRequest, CollectServices } from '../collect/ports';
import type { HistoryServices } from '../history/ports';
import type { HomeResult, HomeServices } from '../home/ports';
import { createPlatformServices as createOnboardingPlatformServices } from '../onboarding/platform';
import type { OnboardingServices } from '../onboarding/ports';
import type { RiskPort } from '../risk/ports';
import type { SendQuote, SendRatePort, SendServices } from '../send/ports';
import { createLdkWallet } from '../wallet/ldkWallet';

export interface WalletRates extends SendRatePort {
  current(): RateInfo | null;
  refresh(): Promise<HomeResult<RateInfo>>;
}

export type WalletServices = {
  wallet: Wallet | null;
  onboarding: OnboardingServices;
  home: HomeServices;
  send: SendServices;
  history: HistoryServices;
  collect: CollectServices;
};

export type WalletDependencies = {
  native: NativeWallet | null;
  settings: NodeSettings;
  rates: WalletRates;
  risk: RiskPort;
  now?: () => number;
};

/** Une composition par application : tous les écrans partagent le même coffre et les mêmes événements. */
export function createWalletServices({
  native,
  settings,
  rates,
  risk,
  now = Date.now,
}: WalletDependencies): WalletServices {
  if (!native) {
    return {
      wallet: null,
      onboarding: createOnboardingPlatformServices(),
      home: { mode: 'unavailable' },
      send: { mode: 'unavailable' },
      history: { mode: 'unavailable' },
      collect: { mode: 'unavailable' },
    };
  }

  let currentRate: RateInfo | null = null;
  let generation = 0;
  // Un chargement JavaScript ne constitue jamais une authentification.
  let locked = true;
  const ldk = createLdkWallet(native, settings, {
    now,
    rate: () => currentRate,
    session: () => (locked ? null : generation),
  });
  const listeners = new Set<(event: WalletEvent) => void>();
  let unsubscribe: (() => void) | null = null;
  const emit = (event: WalletEvent) => listeners.forEach((listener) => listener(event));

  async function refreshRate(): Promise<void> {
    const token = generation;
    try {
      const response = await rates.refresh();
      if (token === generation && !locked) currentRate = response.ok ? response.value : null;
    } catch {
      if (token === generation) currentRate = null;
    }
  }

  async function read<T>(run: () => Promise<Result<T>>, refresh = false): Promise<Result<T>> {
    const token = generation;
    if (locked) return fail((await ldk.state()) === 'absent' ? 'WALLET_ABSENT' : 'WALLET_LOCKED');
    if (refresh) await refreshRate();
    if (locked || token !== generation) return fail('WALLET_LOCKED');
    const result = await run();
    return locked || token !== generation ? fail('WALLET_LOCKED') : result;
  }

  async function authenticate<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
    const token = generation;
    const result = await run();
    const state = result.ok ? await ldk.state() : null;
    if (token !== generation) {
      await ldk.lock();
      return fail('WALLET_LOCKED');
    }
    if (result.ok && state !== null) {
      locked = state !== 'pret' && state !== 'hors_ligne';
      emit({ type: 'etat', state: locked ? 'verrouille' : state });
    }
    return result;
  }

  const wallet: Wallet = {
    async state() {
      const state = await ldk.state();
      return state === 'absent' ? state : locked ? 'verrouille' : state;
    },
    create: (pin) => authenticate(() => ldk.create(pin)),
    restore: (words, pin) => authenticate(() => ldk.restore(words, pin)),
    unlock: (pin) => authenticate(() => ldk.unlock(pin)),
    async lock() {
      locked = true;
      generation += 1;
      currentRate = null;
      emit({ type: 'etat', state: 'verrouille' });
      await ldk.lock();
    },
    balance: () => read(() => ldk.balance(), true),
    history: (options) => read(() => ldk.history(options), true),
    preview: (destination, amountSats) => read(() => ldk.preview(destination, amountSats), true),
    receive: (request) => read(() => ldk.receive(request)),
    lookupInvoice: (paymentId) => read(() => ldk.lookupInvoice(paymentId)),
    async send(request) {
      const token = generation;
      if (locked) return fail('WALLET_LOCKED');
      await refreshRate();
      if (locked || token !== generation) return fail('WALLET_LOCKED');
      // Une fois soumis, conserver le résultat et son identifiant même si l'écran se ferme.
      return ldk.send(request);
    },
    subscribe(listener) {
      listeners.add(listener);
      if (!unsubscribe) {
        unsubscribe = ldk.subscribe((event) => {
          if (!locked) emit(event);
        });
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribe?.();
          unsubscribe = null;
        }
      };
    },
  };

  const creations = new Map<
    string,
    { fingerprint: string; pending: Promise<HomeResult<CollectRequest>> }
  >();
  const invoices: CollectInvoicePort = {
    create({ quote }) {
      const fingerprint = JSON.stringify(quote);
      const previous = creations.get(quote.id);
      if (previous) {
        return previous.fingerprint === fingerprint
          ? previous.pending
          : Promise.resolve({ ok: false, error: { code: 'INVALID_DATA' } });
      }
      const pending = createInvoice(quote);
      creations.set(quote.id, { fingerprint, pending });
      return pending;
    },
    async lookup({ paymentId, paymentRequest }) {
      const result = await wallet.lookupInvoice(paymentId);
      if (!result.ok) return result;
      const found = result.value;
      if (
        !found ||
        found.invoice.paymentId !== paymentId ||
        found.invoice.paymentRequest !== paymentRequest ||
        (found.payment !== null &&
          (found.payment.id !== paymentId || found.payment.direction !== 'recu'))
      ) {
        return { ok: false, error: { code: 'PAYMENT_MISMATCH' } };
      }
      return ok({ paymentRequest, payment: found.payment });
    },
  };

  async function createInvoice(quote: SendQuote): Promise<HomeResult<CollectRequest>> {
    if (
      !Number.isSafeInteger(quote.amountXof) ||
      quote.amountXof <= 0 ||
      !Number.isSafeInteger(quote.amountSats) ||
      quote.amountSats <= 0 ||
      !Number.isSafeInteger(quote.xofPerBtc) ||
      quote.xofPerBtc <= 0 ||
      xofToSats(quote.amountXof, quote.xofPerBtc) !== quote.amountSats
    ) {
      return { ok: false, error: { code: 'INVALID_DATA' } };
    }
    // Une seconde de marge empêche le début de l'appel natif de prolonger le devis.
    const expiresInSecs = Math.floor((Date.parse(quote.expiresAt) - now()) / 1000) - 1;
    if (!Number.isSafeInteger(expiresInSecs) || expiresInSecs < 60 || expiresInSecs > 300) {
      return { ok: false, error: { code: 'QUOTE_EXPIRED' } };
    }
    const result = await wallet.receive({
      amountSats: quote.amountSats,
      amountXof: quote.amountXof,
      expiresInSecs,
    });
    return result.ok ? ok({ invoice: result.value, paymentId: result.value.paymentId }) : result;
  }

  return {
    wallet,
    onboarding: createOnboardingPlatformServices(wallet),
    home: { mode: 'native', wallet },
    send: { mode: 'native', wallet, rates, risk },
    history: { mode: 'native', wallet },
    collect: { mode: 'native', wallet, rates, invoices },
  };
}
