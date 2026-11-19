import {
  act,
  fireEvent,
  fireEventAsync,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AppState } from 'react-native';

import App from '../App';
import { createAppI18n } from '../src/translations';
import { fr } from '../src/translations/fr';
import { createHomePreviewServices } from '../src/home/preview';
import { createReceivePreviewServices } from '../src/receive/preview';
import { createSendPreviewServices, sendPreviewInvoice } from '../src/send/preview';
import { createCollectPreviewServices } from '../src/collect/preview';
import { createHistoryPreviewServices } from '../src/history/preview';
import { createWithdrawPreviewServices } from '../src/withdraw/preview';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('../src/send/QrScanner', () => ({ QrScanner: () => null }));

describe('navigation Retirer T25', () => {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (original) Object.defineProperty(AppState, 'currentState', original);
  });
  async function prepare() {
    await fireEventAsync.press(await screen.findByRole('button', { name: 'Choisir Wave' }));
    await screen.findByRole('header', { name: fr.withdraw.amountTitle });
    await fireEventAsync.changeText(screen.getByLabelText(fr.withdraw.amountLabel), '2500');
    await waitFor(() => {
      expect(screen.getByLabelText(fr.withdraw.amountLabel)).toHaveProp('value', '2500');
      expect(screen.getByRole('button', { name: fr.withdraw.prepare })).toBeEnabled();
    });
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.prepare }));
    await screen.findByRole('header', { name: fr.withdraw.reviewTitle });
  }
  it('relie l’entrée séparée de l’accueil au service de simulation injecté', async () => {
    const fixture = createWithdrawPreviewServices(),
      confirm = jest.spyOn(fixture.bridge!, 'confirm');
    render(
      <App
        initialRoute="Home"
        homeServices={{ ...createHomePreviewServices(), mode: 'native' }}
        withdrawServices={{ ...fixture, mode: 'simulation' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.open }));
    await prepare();
    expect(confirm).not.toHaveBeenCalled();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.confirm }));
    expect(await screen.findByRole('header', { name: fr.withdraw.successTitle })).toBeOnTheScreen();
    expect(confirm).toHaveBeenCalledTimes(1);
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.done }));
    expect(await screen.findByRole('header', { name: fr.dashboard.recent })).toBeOnTheScreen();
  });
  it('garde l’atelier du retrait séparé des fournisseurs du contexte normal', async () => {
    const fixture = createWithdrawPreviewServices(),
      options = jest.spyOn(fixture.bridge!, 'options'),
      confirm = jest.spyOn(fixture.bridge!, 'confirm');
    render(
      <App
        initialRoute="HomePreview"
        withdrawServices={{ ...fixture, mode: 'simulation' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.open }));
    await prepare();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.confirm }));
    await screen.findByRole('header', { name: fr.withdraw.successTitle });
    expect(options).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByText(fr.withdraw.simulationNotice)).toBeOnTheScreen();
  });
  it('explique le fournisseur absent sans inventer d’opérateur disponible ou de solde', async () => {
    const fixture = createWithdrawPreviewServices(),
      read = jest.spyOn(fixture.bridge!, 'options');
    render(
      <App
        initialRoute="Withdraw"
        withdrawServices={{ ...fixture, mode: 'unavailable' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    expect(
      await screen.findByRole('header', { name: fr.withdraw.unavailableTitle }),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(fr.withdraw.amountLabel)).toBeNull();
    expect(screen.queryByRole('button', { name: fr.withdraw.confirm })).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
  it('retrouve la même demande incertaine après retour à l’accueil et réouverture', async () => {
    const fixture = createWithdrawPreviewServices('lostResponse'),
      confirm = jest.spyOn(fixture.bridge!, 'confirm');
    render(
      <App
        initialRoute="Home"
        homeServices={{ ...createHomePreviewServices(), mode: 'native' }}
        withdrawServices={{ ...fixture, mode: 'simulation' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.open }));
    await prepare();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.confirm }));
    await screen.findByRole('header', { name: fr.withdraw.unknownTitle });
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.back }));
    await screen.findByRole('header', { name: fr.dashboard.recent });
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.open }));
    await screen.findByRole('header', { name: fr.withdraw.unknownTitle });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText(fr.withdraw.amountLabel)).toBeNull();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.withdraw.recover }));
    await screen.findByRole('header', { name: fr.withdraw.successTitle });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm.mock.calls[1]).toEqual(confirm.mock.calls[0]);
    expect(fixture.inspect()).toEqual({ reservations: 1, effects: 1 });
  });
});

describe('navigation Historique T24', () => {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (original) Object.defineProperty(AppState, 'currentState', original);
  });

  it('ouvre depuis l’accueil le journal injecté et ses retraits sans lui substituer le wallet d’accueil', async () => {
    const home = createHomePreviewServices();
    const homeRead = jest.spyOn(home.wallet!, 'history');
    const history = createHistoryPreviewServices();
    const walletRead = jest.spyOn(history.wallet!, 'history');
    const withdrawalRead = jest.spyOn(history.withdrawals!, 'history');
    render(
      <App
        initialRoute="Home"
        homeServices={{ ...home, mode: 'native' }}
        historyServices={{ ...history, mode: 'native' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    await fireEventAsync.press(screen.getByRole('button', { name: fr.history.open }));
    expect(await screen.findByRole('header', { name: fr.history.title })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: /^Retrait Wave \|/ })).toBeOnTheScreen();
    expect(walletRead).toHaveBeenCalledWith({ limit: 20 });
    expect(withdrawalRead).toHaveBeenCalledWith({ limit: 20 });
    expect(homeRead).not.toHaveBeenCalledWith({ limit: 20 });
    expect(screen.queryByText(fr.history.preview)).toBeNull();
    expect(screen.queryByText(fr.history.scenarios.title)).toBeNull();
  });

  it('réutilise le wallet d’accueil sans service Historique explicite et ne fabrique pas de retraits', async () => {
    const home = createHomePreviewServices();
    const history = jest.spyOn(home.wallet!, 'history');
    const balance = jest.spyOn(home.wallet!, 'balance');
    render(
      <App
        initialRoute="History"
        homeServices={{ ...home, mode: 'native' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    expect(await screen.findByRole('header', { name: fr.history.title })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: /^Argent reçu \| \+25/ })).toBeOnTheScreen();
    expect(history).toHaveBeenCalledWith({ limit: 20 });
    expect(balance).not.toHaveBeenCalled();
    expect(screen.queryByText(fr.history.preview)).toBeNull();
    await fireEventAsync.press(screen.getByRole('radio', { name: fr.history.filters.simulated }));
    expect(screen.getAllByText(fr.history.withdrawalsUnavailable).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Retrait / })).toBeNull();
  });

  it('garde l’historique de l’aperçu isolé des lectures du contexte normal', async () => {
    const normal = createHistoryPreviewServices();
    const state = jest.spyOn(normal.wallet!, 'state');
    const history = jest.spyOn(normal.wallet!, 'history');
    const withdrawals = jest.spyOn(normal.withdrawals!, 'history');
    render(
      <App
        initialRoute="HomePreview"
        historyServices={{ ...normal, mode: 'native' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    await fireEventAsync.press(screen.getByRole('button', { name: fr.history.open }));
    expect(await screen.findByRole('header', { name: fr.history.title })).toBeOnTheScreen();
    expect(screen.getByText(fr.history.preview)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: fr.history.scenarios.title })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: /^Argent reçu \| \+12/ })).toBeOnTheScreen();
    expect(state).not.toHaveBeenCalled();
    expect(history).not.toHaveBeenCalled();
    expect(withdrawals).not.toHaveBeenCalled();
  });

  it('revient du reçu à la liste filtrée puis à l’accueil sans perdre une étape', async () => {
    const history = createHistoryPreviewServices();
    render(
      <App
        initialRoute="Home"
        homeServices={{ ...createHomePreviewServices(), mode: 'native' }}
        historyServices={{ ...history, mode: 'native' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    await fireEventAsync.press(screen.getByRole('button', { name: fr.history.open }));
    await screen.findByRole('header', { name: fr.history.title });
    await fireEventAsync.press(screen.getByRole('radio', { name: fr.history.filters.sent }));
    await fireEventAsync.press(
      await screen.findByRole('button', { name: /^Paiement envoyé \| −2/ }),
    );
    expect(await screen.findByRole('header', { name: fr.history.receiptTitle })).toBeOnTheScreen();
    expect(screen.getByLabelText('demo-envoi-1')).toBeOnTheScreen();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.history.back }));
    expect(await screen.findByRole('header', { name: fr.history.title })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: fr.history.filters.sent })).toHaveProp(
      'accessibilityState',
      { checked: true },
    );
    expect(screen.queryByRole('button', { name: /^Argent reçu \|/ })).toBeNull();
    expect(screen.queryByRole('header', { name: fr.history.receiptTitle })).toBeNull();
    await fireEventAsync.press(screen.getByRole('button', { name: fr.history.back }));
    expect(await screen.findByRole('header', { name: fr.dashboard.recent })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: fr.history.open })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: fr.history.title })).toBeNull();
  });
});

describe('navigation Encaisser T22', () => {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (original) Object.defineProperty(AppState, 'currentState', original);
  });

  async function createMerchantRequest() {
    const input = await screen.findByLabelText(fr.collect.amountLabel);
    await fireEventAsync.changeText(input, '2500');
    await waitFor(() => {
      expect(screen.getByLabelText(fr.collect.amountLabel)).toHaveProp('value', '2500');
      expect(screen.getByRole('button', { name: fr.collect.continue })).toBeEnabled();
    });
    await fireEventAsync.press(screen.getByRole('button', { name: fr.collect.continue }));
    await screen.findByRole('header', { name: fr.collect.reviewTitle });
    await fireEventAsync.press(screen.getByRole('button', { name: fr.collect.create }));
    await screen.findByRole('header', { name: fr.collect.waitingTitle });
  }

  it('relie Encaisser au fournisseur injecté et confirme seulement son règlement', async () => {
    const fixture = createCollectPreviewServices();
    const create = jest.spyOn(fixture.invoices!, 'create');
    render(
      <App
        initialRoute="Home"
        homeServices={{ ...createHomePreviewServices(), mode: 'native' }}
        collectServices={{ ...fixture, mode: 'native' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.collect }));
    expect(await screen.findByRole('header', { name: fr.collect.title })).toBeOnTheScreen();
    expect(screen.queryByText(fr.collect.preview)).toBeNull();
    expect(screen.queryByText(fr.dashboard.actionUnavailable)).toBeNull();
    await createMerchantRequest();
    expect(create).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('header', { name: fr.collect.paidTitle })).toBeNull();
    act(() => fixture.confirmPayment());
    expect(await screen.findByRole('header', { name: fr.collect.paidTitle })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: fr.collect.receiptTitle })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.collect.back }));
    expect(await screen.findByRole('header', { name: fr.dashboard.recent })).toBeOnTheScreen();
  });

  it('garde Encaisser fictif isolé du fournisseur du contexte normal', async () => {
    const normal = createCollectPreviewServices();
    const create = jest.spyOn(normal.invoices!, 'create');
    const lookup = jest.spyOn(normal.invoices!, 'lookup');
    render(
      <App
        initialRoute="HomePreview"
        collectServices={{ ...normal, mode: 'native' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.collect }));
    expect(await screen.findByRole('header', { name: fr.collect.title })).toBeOnTheScreen();
    expect(screen.getByText(fr.collect.preview)).toBeOnTheScreen();
    await createMerchantRequest();
    expect(create).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: fr.collect.back }));
    expect(await screen.findByRole('header', { name: fr.dashboard.recent })).toBeOnTheScreen();
  });

  it('ne remplace pas le service marchand absent par une demande de démonstration', async () => {
    render(<App initialRoute="Collect" i18n={createAppI18n()} />);
    await act(async () => {});
    expect(
      await screen.findByRole('header', { name: fr.collect.unavailableTitle }),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(fr.collect.amountLabel)).toBeNull();
    expect(screen.queryByText(fr.collect.preview)).toBeNull();
    expect(screen.queryByRole('image', { name: /Demande de paiement/ })).toBeNull();
  });

  it('reprend la demande existante après retour à l’accueil sans en créer une deuxième', async () => {
    const fixture = createCollectPreviewServices();
    const create = jest.spyOn(fixture.invoices!, 'create');
    const lookup = jest.spyOn(fixture.invoices!, 'lookup');
    render(
      <App
        initialRoute="Home"
        homeServices={{ ...createHomePreviewServices(), mode: 'native' }}
        collectServices={{ ...fixture, mode: 'native' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.collect }));
    await createMerchantRequest();
    const reads = lookup.mock.calls.length;
    fireEvent.press(screen.getByRole('button', { name: fr.collect.back }));
    await screen.findByRole('header', { name: fr.dashboard.recent });
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.collect }));
    expect(await screen.findByRole('header', { name: fr.collect.waitingTitle })).toBeOnTheScreen();
    await waitFor(() => expect(lookup.mock.calls.length).toBeGreaterThan(reads));
    expect(create).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenLastCalledWith({
      paymentId: 'apercu-collecte-fictive-1',
      paymentRequest: 'lnbcrt1exemplecollectefictivenonpayable1'.padEnd(326, 'a'),
    });
    expect(screen.queryByLabelText(fr.collect.amountLabel)).toBeNull();
  });
});

describe('navigation du socle mobile', () => {
  it('ouvre les informations du projet puis revient à l’accueil', async () => {
    const i18n = createAppI18n();
    render(<App initialRoute="Home" i18n={i18n} />);
    await act(async () => {});

    expect(await screen.findByRole('header', { name: fr.appName })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: fr.home.aboutAction }));

    await waitFor(() => {
      expect(screen.getByRole('header', { name: fr.about.title })).toBeOnTheScreen();
    });
    expect(
      screen.getByText(i18n.t('about.description', { appName: i18n.t('appName') })),
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: fr.about.backAction }));

    await waitFor(() => {
      expect(screen.getByRole('header', { name: fr.appName })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: fr.about.title })).toBeNull();
    });
  });

  it('ouvre la galerie, utilise les exemples locaux puis revient à l’accueil', async () => {
    render(<App initialRoute="Home" i18n={createAppI18n()} />);
    await act(async () => {});
    await screen.findByRole('header', { name: fr.appName });
    fireEvent.press(screen.getByRole('button', { name: fr.home.designAction }));

    await waitFor(() => {
      expect(screen.getByRole('header', { name: fr.design.title })).toBeOnTheScreen();
    });
    expect(screen.getByText(fr.design.notice)).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: fr.design.buttons.normal }));
    expect(screen.getByText(fr.design.buttons.activeFeedback)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.design.buttons.secondary }));
    expect(screen.getByText(fr.design.buttons.idleFeedback)).toBeOnTheScreen();

    expect(screen.getByRole('alert', { name: fr.design.fields.error })).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText(fr.design.fields.errorLabel), 'Exemple');
    expect(screen.queryByText(fr.design.fields.error)).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: fr.design.backAction }));
    await waitFor(() => {
      expect(screen.getByRole('header', { name: fr.appName })).toBeOnTheScreen();
    });
  });
});

describe('navigation Envoyer T20', () => {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (original) Object.defineProperty(AppState, 'currentState', original);
  });

  async function reviewAndConfirm(i18n: ReturnType<typeof createAppI18n>) {
    await screen.findByLabelText(fr.send.destination);
    fireEvent.changeText(screen.getByLabelText(fr.send.destination), sendPreviewInvoice);
    fireEvent.press(screen.getByRole('button', { name: fr.send.continue }));
    await screen.findByRole('header', { name: fr.send.reviewTitle });
    fireEvent.press(screen.getByRole('button', { name: fr.send.confirm }));
    fireEvent.changeText(await screen.findByLabelText(fr.send.pinLabel), '000000');
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', {
          name: i18n.t('send.pay', { amount: '4\u00a0500\u00a0FCFA' }),
        }),
      );
    });
  }

  it('relie Envoyer au fournisseur injecté et revient à l’accueil après confirmation', async () => {
    const reviewAt = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(reviewAt);
    const fixture = createSendPreviewServices();
    const send = jest.spyOn(fixture.wallet!, 'send');
    const i18n = createAppI18n();
    render(
      <App
        initialRoute="Home"
        homeServices={{ ...createHomePreviewServices(), mode: 'native' }}
        sendServices={{ ...fixture, mode: 'native' }}
        i18n={i18n}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.send }));
    expect(await screen.findByRole('header', { name: fr.send.title })).toBeOnTheScreen();
    expect(screen.queryByText(fr.send.preview)).toBeNull();
    expect(screen.queryByText(fr.dashboard.actionUnavailable)).toBeNull();
    await reviewAndConfirm(i18n);
    expect(await screen.findByRole('header', { name: fr.send.successTitle })).toBeOnTheScreen();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      destination: sendPreviewInvoice,
      amountSats: 10_000,
      maxFeeSats: 100,
      amountXof: 4500,
      xofPerBtc: 45_000_000,
      expiresAt: new Date(reviewAt + 300_000).toISOString(),
      pin: '000000',
    });
    fireEvent.press(screen.getByRole('button', { name: fr.send.home }));
    expect(await screen.findByRole('header', { name: fr.dashboard.recent })).toBeOnTheScreen();
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
  });

  it('ouvre un atelier séparé sans solliciter le wallet du contexte normal', async () => {
    const normal = createSendPreviewServices();
    const preview = jest.spyOn(normal.wallet!, 'preview');
    const send = jest.spyOn(normal.wallet!, 'send');
    render(
      <App
        initialRoute="HomePreview"
        sendServices={{ ...normal, mode: 'native' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.send }));
    expect(await screen.findByRole('header', { name: fr.send.title })).toBeOnTheScreen();
    expect(screen.getByText(fr.send.preview)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.send.previewFill }));
    expect(await screen.findByRole('header', { name: fr.send.reviewTitle })).toBeOnTheScreen();
    expect(preview).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: fr.send.back }));
    expect(await screen.findByRole('header', { name: fr.dashboard.recent })).toBeOnTheScreen();
  });

  it('ne remplace pas le fournisseur absent par des données fictives', async () => {
    render(<App initialRoute="Send" i18n={createAppI18n()} />);
    await act(async () => {});
    expect(await screen.findByRole('header', { name: fr.send.unavailableTitle })).toBeOnTheScreen();
    expect(screen.queryByText(sendPreviewInvoice)).toBeNull();
    expect(screen.queryByText(fr.send.preview)).toBeNull();
    expect(screen.queryByLabelText(fr.send.destination)).toBeNull();
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
  });

  it('conserve l’incertitude après retour à l’accueil puis réouverture', async () => {
    const fixture = createSendPreviewServices('unknown');
    const send = jest.spyOn(fixture.wallet!, 'send');
    const i18n = createAppI18n();
    render(
      <App
        initialRoute="Home"
        homeServices={{ ...createHomePreviewServices(), mode: 'native' }}
        sendServices={{ ...fixture, mode: 'native' }}
        i18n={i18n}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.send }));
    await reviewAndConfirm(i18n);
    expect(await screen.findByRole('header', { name: fr.send.unknownTitle })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.send.home }));
    await screen.findByRole('header', { name: fr.dashboard.recent });
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.send }));
    expect(await screen.findByRole('header', { name: fr.send.unknownTitle })).toBeOnTheScreen();
    expect(screen.queryByLabelText(fr.send.destination)).toBeNull();
    expect(screen.queryByLabelText(fr.send.pinLabel)).toBeNull();
    expect(screen.queryByRole('button', { name: fr.send.checkPayment })).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('navigation Recevoir T18', () => {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    if (original) Object.defineProperty(AppState, 'currentState', original);
  });

  it('relie Recevoir à son écran puis revient à l’accueil sans ouvrir de modale', async () => {
    const receiving = createReceivePreviewServices();
    const read = jest.spyOn(receiving.address!, 'current');
    render(
      <App
        initialRoute="Home"
        homeServices={{ ...createHomePreviewServices(), mode: 'native' }}
        receiveServices={{ ...receiving, mode: 'native' }}
        i18n={createAppI18n()}
      />,
    );
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.receive }));
    expect(
      await screen.findByLabelText('Code QR de réception pour exemple@teranga.example'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(fr.receive.preview)).toBeNull();
    expect(screen.queryByText(fr.dashboard.actionUnavailable)).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: fr.receive.back }));
    expect(await screen.findByRole('header', { name: fr.dashboard.recent })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Code QR de réception pour exemple@teranga.example')).toBeNull();
  });

  it('garde la réception fictive séparée du contexte normal', async () => {
    render(<App initialRoute="HomePreview" i18n={createAppI18n()} />);
    await act(async () => {});
    await screen.findByLabelText('45\u00a0000 FCFA');
    fireEvent.press(screen.getByRole('button', { name: fr.dashboard.actions.receive }));
    expect(await screen.findByText('exemple@teranga.example')).toBeOnTheScreen();
    expect(screen.getByText(fr.receive.preview)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.receive.back }));
    expect(await screen.findByText(fr.dashboard.preview)).toBeOnTheScreen();
    expect(screen.queryByText(fr.receive.preview)).toBeNull();
  });

  it('ne remplace pas le fournisseur absent par une adresse fictive', async () => {
    render(<App initialRoute="Receive" i18n={createAppI18n()} />);
    await act(async () => {});
    expect(await screen.findByText(fr.receive.unavailableDescription)).toBeOnTheScreen();
    expect(screen.queryByText('exemple@teranga.example')).toBeNull();
    expect(screen.queryByRole('button', { name: fr.receive.copy })).toBeNull();
    expect(screen.queryByText(fr.receive.preview)).toBeNull();
  });
});
