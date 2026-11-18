import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CollectPlatformPort } from '../src/collect/platform';
import type { CollectServices } from '../src/collect/ports';
import { createCollectPreviewServices } from '../src/collect/preview';
import { CollectScreen } from '../src/collect/CollectScreen';
import { createAppI18n, TranslationProvider } from '../src/translations';
import { fr } from '../src/translations/fr';
import { BrandTypographyProvider, Button } from '../src/ui';

const initialTime = Date.UTC(2026, 10, 10, 12);
const preview = (scenario: Parameters<typeof createCollectPreviewServices>[0] = 'waiting') =>
  createCollectPreviewServices(scenario, { now: () => initialTime });
const invoice = (sequence = 1) =>
  `lnbcrt1exemplecollectefictivenonpayable${sequence}`.padEnd(326, 'a');
const paymentId = (sequence = 1) => `apercu-collecte-fictive-${sequence}`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderCollect(services: CollectServices = preview()) {
  const i18n = createAppI18n();
  const effects = {
    copyPaymentRequest: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true),
    share: jest
      .fn<ReturnType<CollectPlatformPort['share']>, Parameters<CollectPlatformPort['share']>>()
      .mockResolvedValue('opened'),
  };
  const callbacks = { onBack: jest.fn(), onRequireUnlock: jest.fn(), onPreview: jest.fn() };
  const clock =
    'now' in services && typeof services.now === 'function'
      ? (services.now as () => number)
      : () => initialTime;
  const element = (active: boolean) => (
    <SafeAreaProvider>
      <TranslationProvider i18n={i18n}>
        <BrandTypographyProvider available>
          <CollectScreen
            services={services}
            platform={effects}
            clock={clock}
            active={active}
            {...callbacks}
          />
        </BrandTypographyProvider>
      </TranslationProvider>
    </SafeAreaProvider>
  );
  const view = render(element(true));
  return {
    ...view,
    ...callbacks,
    services,
    effects,
    i18n,
    setActive: (active: boolean) => view.rerender(element(active)),
  };
}

async function prepare(amount = '2500') {
  const input = await screen.findByLabelText(fr.collect.amountLabel);
  fireEvent.changeText(input, amount);
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: fr.collect.continue }));
  });
  await screen.findByRole('header', { name: fr.collect.reviewTitle });
}

async function createRequest(amount = '2500') {
  await prepare(amount);
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: fr.collect.create }));
  });
}

function capturedAction(label: string): () => void {
  const button = screen.UNSAFE_getAllByType(Button).find((entry) => entry.props.label === label);
  if (!button) throw new Error('Fixture action unavailable');
  return button.props.onPress;
}

async function waitForRequest() {
  await screen.findByRole('header', { name: fr.collect.waitingTitle });
  await waitFor(() => expect(screen.getByRole('button', { name: fr.collect.check })).toBeEnabled());
}

function expire(services: ReturnType<typeof preview>) {
  act(() => {
    services.advanceTime(300_001);
    jest.advanceTimersByTime(1000);
  });
}

describe('encaisser T22 | demande exacte et règlement confirmé', () => {
  let originalState: PropertyDescriptor | undefined;
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    originalState = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      writable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    if (originalState) Object.defineProperty(AppState, 'currentState', originalState);
  });

  it('explique le fournisseur absent sans afficher de QR ou de reçu fictif', async () => {
    const view = renderCollect({ mode: 'unavailable' });
    expect(
      await screen.findByRole('header', { name: fr.collect.unavailableTitle }),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(fr.collect.amountLabel)).toBeNull();
    expect(screen.queryByText(fr.collect.preview)).toBeNull();
    expect(screen.queryByText(fr.collect.receiptTitle)).toBeNull();
    expect(screen.queryByRole('image', { name: /Demande de paiement/ })).toBeNull();
    expect(view.effects.copyPaymentRequest).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: fr.collect.previewAction }));
    expect(view.onPreview).toHaveBeenCalledTimes(1);
  });

  it('attend une saisie volontaire sans exposer de solde ou créer de facture au montage', async () => {
    const services = preview();
    const quote = jest.spyOn(services.rates!, 'quote');
    const create = jest.spyOn(services.invoices!, 'create');
    renderCollect(services);
    expect(await screen.findByLabelText(fr.collect.amountLabel)).toHaveProp('value', '');
    expect(screen.queryByText('45\u00a0000\u00a0FCFA')).toBeNull();
    expect(screen.getByText(fr.collect.preview)).toBeOnTheScreen();
    expect(quote).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('explique zéro et le dépassement du plafond sans devis puis permet de corriger', async () => {
    const services = preview();
    const quote = jest.spyOn(services.rates!, 'quote');
    const create = jest.spyOn(services.invoices!, 'create');
    renderCollect(services);
    const input = await screen.findByLabelText(fr.collect.amountLabel);
    for (const value of ['0', '5000001']) {
      fireEvent.changeText(input, value);
      expect(screen.getByText(fr.collect.errors.AMOUNT_INVALID)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: fr.collect.continue })).toBeDisabled();
      fireEvent.press(screen.getByRole('button', { name: fr.collect.continue }));
      expect(quote).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    }
    fireEvent.changeText(input, '2500');
    expect(screen.queryByText(fr.collect.errors.AMOUNT_INVALID)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.collect.continue }));
    expect(await screen.findByRole('header', { name: fr.collect.reviewTitle })).toBeOnTheScreen();
    expect(quote).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('prépare le prix à relire avant de créer la demande', async () => {
    const services = preview();
    const quote = jest.spyOn(services.rates!, 'quote');
    const create = jest.spyOn(services.invoices!, 'create');
    renderCollect(services);
    await prepare();
    expect(screen.getByText('2\u00a0500\u00a0FCFA')).toBeOnTheScreen();
    expect(screen.getByText('5\u00a0556\u00a0sats')).toBeOnTheScreen();
    expect(quote).toHaveBeenCalledWith(2500);
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByRole('image', { name: /Demande de paiement/ })).toBeNull();
  });

  it('crée après confirmation et copie la demande correspondant exactement au QR', async () => {
    const services = preview();
    const create = jest.spyOn(services.invoices!, 'create');
    const { effects, i18n } = renderCollect(services);
    await createRequest();
    await waitForRequest();
    expect(
      screen.getByLabelText(
        i18n.t('collect.qrLabel', { amount: '2\u00a0500\u00a0FCFA', request: invoice() }),
      ),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: fr.collect.copy }));
    expect(await screen.findByText(fr.collect.copied)).toBeOnTheScreen();
    expect(effects.copyPaymentRequest).toHaveBeenCalledWith(invoice());
    expect(create).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('header', { name: fr.collect.previewPaidTitle })).toBeNull();
  });

  it('copie une facture de plus de 254 caractères sans l’adapter au format d’adresse T18', async () => {
    const services = preview('longInvoice');
    const { effects } = renderCollect(services);
    await createRequest();
    await waitForRequest();
    const raw = `lnbcrt1${'a'.repeat(2041)}`;
    expect(raw.length).toBeGreaterThan(254);
    fireEvent.press(screen.getByRole('button', { name: fr.collect.copy }));
    expect(await screen.findByText(fr.collect.copied)).toBeOnTheScreen();
    expect(effects.copyPaymentRequest).toHaveBeenCalledWith(raw);
    expect(effects.copyPaymentRequest.mock.calls[0]![0]).not.toContain('\u200b');
  });

  it('rend la demande longue entière consultable puis la masque à expiration', async () => {
    const services = preview('longInvoice');
    renderCollect(services);
    await createRequest();
    await waitForRequest();
    const raw = `lnbcrt1${'a'.repeat(2041)}`;
    expect(screen.queryByLabelText(raw)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.collect.showRequest }));
    const detail = screen.getByLabelText(raw);
    expect(detail.props.children.replaceAll('\u200b', '')).toBe(raw);
    expect(detail.props.selectable).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: fr.collect.hideRequest }));
    expect(screen.queryByLabelText(raw)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.collect.showRequest }));
    expire(services);
    expect(screen.queryByLabelText(raw)).toBeNull();
    expect(screen.queryByRole('button', { name: fr.collect.showRequest })).toBeNull();
  });

  it.each(['false', 'reject'] as const)(
    'une copie %s ne produit ni succès de copie ni confirmation de paiement',
    async (failure) => {
      const { effects } = renderCollect();
      if (failure === 'false') effects.copyPaymentRequest.mockResolvedValueOnce(false);
      else effects.copyPaymentRequest.mockRejectedValueOnce(new Error('controlled copy failure'));
      await createRequest();
      await waitForRequest();
      fireEvent.press(screen.getByRole('button', { name: fr.collect.copy }));
      expect(await screen.findByText(fr.collect.copyFailed)).toBeOnTheScreen();
      expect(screen.queryByText(fr.collect.copied)).toBeNull();
      expect(screen.getByRole('header', { name: fr.collect.waitingTitle })).toBeOnTheScreen();
    },
  );

  it('partage la même demande complète et distingue l’annulation du règlement', async () => {
    const { effects, i18n } = renderCollect();
    effects.share.mockResolvedValueOnce('dismissed');
    await createRequest();
    await waitForRequest();
    fireEvent.press(screen.getByRole('button', { name: fr.collect.share }));
    expect(await screen.findByText(fr.collect.shareDismissed)).toBeOnTheScreen();
    expect(effects.share).toHaveBeenCalledWith({
      title: fr.collect.requestShareTitle,
      message: i18n.t('collect.previewRequestShare', {
        amount: i18n.t('dashboard.money', { amount: '2\u00a0500' }),
        request: invoice(),
      }),
    });
    expect(screen.queryByText(fr.collect.previewReceiptTitle)).toBeNull();
  });

  it('garde une demande consultable si le partage est indisponible', async () => {
    const { effects } = renderCollect();
    effects.share.mockRejectedValueOnce(new Error('controlled share failure'));
    await createRequest();
    await waitForRequest();
    fireEvent.press(screen.getByRole('button', { name: fr.collect.share }));
    expect(await screen.findByText(fr.collect.shareFailed)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: fr.collect.copy })).toBeEnabled();
    expect(screen.queryByText(fr.collect.previewReceiptTitle)).toBeNull();
  });

  it('relit une demande en attente sans en créer une autre', async () => {
    const services = preview();
    const create = jest.spyOn(services.invoices!, 'create');
    const lookup = jest.spyOn(services.invoices!, 'lookup');
    renderCollect(services);
    await createRequest();
    await waitForRequest();
    const firstReads = lookup.mock.calls.length;
    fireEvent.press(screen.getByRole('button', { name: fr.collect.check }));
    await waitFor(() => expect(lookup.mock.calls.length).toBeGreaterThan(firstReads));
    expect(lookup).toHaveBeenLastCalledWith({ paymentId: paymentId(), paymentRequest: invoice() });
    expect(create).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('header', { name: fr.collect.waitingTitle })).toBeOnTheScreen();
  });

  it('ne marque pas Payé quand la réponse concerne un autre identifiant de paiement', async () => {
    renderCollect(preview('mismatch'));
    await createRequest();
    expect(await screen.findByRole('header', { name: fr.collect.unknownTitle })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: fr.collect.previewPaidTitle })).toBeNull();
    expect(screen.queryByText(fr.collect.previewReceiptTitle)).toBeNull();
    expect(screen.queryByRole('button', { name: fr.collect.newRequest })).toBeNull();
  });

  it('affiche le reçu au prix demandé seulement après règlement de la demande exacte', async () => {
    const services = preview();
    renderCollect(services);
    await createRequest();
    await waitForRequest();
    expect(screen.queryByText(fr.collect.previewReceiptTitle)).toBeNull();
    act(() => services.confirmPayment(paymentId()));
    expect(
      await screen.findByRole('header', { name: fr.collect.previewPaidTitle }),
    ).toBeOnTheScreen();
    expect(screen.getByText(fr.collect.previewPaidDescription)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: fr.collect.previewReceiptTitle })).toBeOnTheScreen();
    expect(screen.getByLabelText(paymentId())).toBeOnTheScreen();
    expect(screen.getByText('2\u00a0500\u00a0FCFA')).toBeOnTheScreen();
  });

  it('partage un reçu explicitement fictif sans réexposer une demande payable', async () => {
    const services = preview();
    const { effects } = renderCollect(services);
    await createRequest();
    await waitForRequest();
    act(() => services.confirmPayment());
    await screen.findByRole('header', { name: fr.collect.previewReceiptTitle });
    fireEvent.press(screen.getByRole('button', { name: fr.collect.receiptShare }));
    expect(await screen.findByText(fr.collect.receiptShared)).toBeOnTheScreen();
    const shared = effects.share.mock.calls[0]![0];
    expect(shared.title).toBe(fr.collect.receiptShareTitle);
    expect(shared.message).toContain('Reçu fictif | aucun paiement réel');
    expect(shared.message).toContain('2\u00a0500 FCFA');
    expect(shared.message).toContain(paymentId());
    expect(shared.message).not.toContain(invoice());
  });

  it('retire le QR expiré et refuse les anciens callbacks de copie et de partage', async () => {
    const services = preview();
    const { effects } = renderCollect(services);
    await createRequest();
    await waitForRequest();
    const copy = capturedAction(fr.collect.copy);
    const share = capturedAction(fr.collect.share);
    expire(services);
    expect(screen.getByRole('header', { name: fr.collect.expiredTitle })).toBeOnTheScreen();
    expect(screen.queryByRole('image', { name: /Demande de paiement/ })).toBeNull();
    expect(screen.queryByRole('button', { name: fr.collect.copy })).toBeNull();
    expect(screen.queryByRole('button', { name: fr.collect.share })).toBeNull();
    await act(async () => {
      copy();
      share();
    });
    expect(effects.copyPaymentRequest).not.toHaveBeenCalled();
    expect(effects.share).not.toHaveBeenCalled();
  });

  it('ne confirme pas une ancienne copie si elle se termine après expiration', async () => {
    const services = preview();
    const copied = deferred<boolean>();
    const { effects } = renderCollect(services);
    effects.copyPaymentRequest.mockReturnValueOnce(copied.promise);
    await createRequest();
    await waitForRequest();
    fireEvent.press(screen.getByRole('button', { name: fr.collect.copy }));
    expect(effects.copyPaymentRequest).toHaveBeenCalledTimes(1);
    expire(services);
    await act(async () => {
      copied.resolve(true);
    });
    expect(screen.queryByText(fr.collect.copied)).toBeNull();
    expect(screen.getByRole('header', { name: fr.collect.expiredTitle })).toBeOnTheScreen();
  });

  it('masque le QR hors focus puis reprend la même facture sans nouvelle création', async () => {
    const services = preview();
    const create = jest.spyOn(services.invoices!, 'create');
    const lookup = jest.spyOn(services.invoices!, 'lookup');
    const { effects, setActive } = renderCollect(services);
    await createRequest();
    await waitForRequest();
    const oldCopy = capturedAction(fr.collect.copy);
    setActive(false);
    expect(screen.getByRole('header', { name: fr.collect.suspendedTitle })).toBeOnTheScreen();
    expect(screen.queryByRole('image', { name: /Demande de paiement/ })).toBeNull();
    expect(screen.queryByText('2\u00a0500\u00a0FCFA')).toBeNull();
    await act(async () => {
      oldCopy();
    });
    expect(effects.copyPaymentRequest).not.toHaveBeenCalled();
    setActive(true);
    await waitForRequest();
    expect(create).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenLastCalledWith({ paymentId: paymentId(), paymentRequest: invoice() });
  });

  it('masque la demande en arrière-plan et reprend son suivi plutôt que créer une facture', async () => {
    const listeners = new Set<(next: AppStateStatus) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
    const services = preview();
    const create = jest.spyOn(services.invoices!, 'create');
    renderCollect(services);
    await createRequest();
    await waitForRequest();
    act(() => listeners.forEach((listener) => listener('background')));
    expect(screen.getByRole('header', { name: fr.collect.suspendedTitle })).toBeOnTheScreen();
    expect(screen.queryByRole('image', { name: /Demande de paiement/ })).toBeNull();
    act(() => listeners.forEach((listener) => listener('active')));
    await waitForRequest();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('signale le paiement d’une ancienne demande sans valider la vente actuellement affichée', async () => {
    const services = preview();
    const { i18n } = renderCollect(services);
    await createRequest();
    await waitForRequest();
    expire(services);
    fireEvent.press(screen.getByRole('button', { name: fr.collect.newRequest }));
    await createRequest('3000');
    await waitForRequest();
    act(() => services.confirmPayment(paymentId(1)));
    expect(await screen.findByText(fr.collect.previousPaid)).toBeOnTheScreen();
    expect(screen.getByText(fr.collect.previousHint)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: fr.collect.waitingTitle })).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        i18n.t('collect.qrLabel', { amount: '3\u00a0000\u00a0FCFA', request: invoice(2) }),
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: fr.collect.previewPaidTitle })).toBeNull();
    expect(screen.queryByRole('header', { name: fr.collect.previewReceiptTitle })).toBeNull();
  });

  it('garde une création inconnue sans QR ni commande de renouvellement', async () => {
    const services = preview('unknown');
    const create = jest.spyOn(services.invoices!, 'create');
    renderCollect(services);
    await createRequest();
    expect(await screen.findByRole('header', { name: fr.collect.unknownTitle })).toBeOnTheScreen();
    expect(screen.getByText(fr.collect.creationUnknown)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: fr.collect.newRequest })).toBeNull();
    expect(screen.queryByRole('button', { name: fr.collect.create })).toBeNull();
    expect(screen.queryByRole('image', { name: /Demande de paiement/ })).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('garde le compte à rebours consultable sans annonces automatiques de chaque seconde', async () => {
    const services = preview();
    const { i18n } = renderCollect(services);
    await createRequest();
    await waitForRequest();
    expect(screen.getByText(i18n.t('collect.remaining', { time: '5:00' }))).toHaveProp(
      'accessibilityLiveRegion',
      'none',
    );
    act(() => {
      services.advanceTime(1000);
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText(i18n.t('collect.remaining', { time: '4:59' }))).toHaveProp(
      'accessibilityLiveRegion',
      'none',
    );
    expect(screen.getByRole('header', { name: fr.collect.waitingTitle })).toHaveProp(
      'accessibilityLiveRegion',
      'polite',
    );
  });

  it('distingue une confirmation observée après le délai de la fin de validité du QR', async () => {
    const services = preview();
    renderCollect(services);
    await createRequest();
    await waitForRequest();
    expire(services);
    act(() => services.confirmPayment());
    expect(await screen.findByRole('header', { name: fr.collect.lateTitle })).toBeOnTheScreen();
    expect(screen.getByLabelText(paymentId())).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: fr.collect.previewPaidTitle })).toBeNull();
    expect(screen.queryByRole('image', { name: /Demande de paiement/ })).toBeNull();
  });

  it('date la vérification à la reprise sans présenter createdAt comme l’heure du règlement', async () => {
    const services = preview();
    const { setActive } = renderCollect(services);
    await createRequest();
    await waitForRequest();
    setActive(false);
    // Le paiement porte une date antérieure au terme, mais l'écran n'en observe
    // la preuve qu'à la reprise, cinq minutes plus tard.
    act(() => {
      services.confirmPayment();
      services.advanceTime(300_001);
    });
    setActive(true);
    expect(await screen.findByRole('header', { name: fr.collect.lateTitle })).toBeOnTheScreen();
    expect(screen.getByText(fr.collect.receiptDate)).toBeOnTheScreen();
    expect(screen.getByText('10 nov., 12:05')).toBeOnTheScreen();
    expect(screen.queryByText('10 nov., 12:00')).toBeNull();
  });
});
