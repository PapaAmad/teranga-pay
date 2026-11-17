import {
  BridgeError,
  type BridgeProvider,
  type BridgeProviderResult,
  type BridgeService,
  type BridgeStore,
  type Scenario,
  type Withdrawal,
} from './types.ts';

function matches(result: BridgeProviderResult, withdrawal: Withdrawal): boolean {
  return Boolean(
    result &&
    typeof result === 'object' &&
    result.simulation === true &&
    result.operationId === withdrawal.id &&
    result.operator === withdrawal.operator &&
    result.recipientId === withdrawal.recipientId &&
    result.amountXof === withdrawal.amountXof &&
    ((result.status === 'reussi' && result.failure === null) ||
      (result.status === 'echoue' && result.failure === 'PROVIDER_DECLINED')),
  );
}

/** Le simulateur écrit un effet fictif durable avant de renvoyer sa réponse. */
export function createSimulatedProvider(
  store: BridgeStore,
  { scenario = 'success' }: { scenario?: Scenario } = {},
): BridgeProvider {
  if (!['success', 'declined', 'timeout_after_success', 'unavailable'].includes(scenario))
    throw new BridgeError('INVALID_INPUT');
  return {
    async submit(withdrawal) {
      if (scenario === 'unavailable') throw new BridgeError('PROVIDER_UNAVAILABLE');
      const result = store.recordProvider(
        withdrawal,
        scenario === 'declined' ? 'echoue' : 'reussi',
      );
      if (scenario === 'timeout_after_success') throw new BridgeError('PROVIDER_UNAVAILABLE');
      return result;
    },
    async lookup(id) {
      return store.lookupProvider(id);
    },
  };
}

export function createBridgeService({
  store,
  provider,
}: {
  store: BridgeStore;
  provider: BridgeProvider;
}): BridgeService {
  function apply(withdrawal: Withdrawal, result: BridgeProviderResult | null): Withdrawal {
    if (!result) return store.settle(withdrawal.id, 'incertain', 'PROVIDER_UNAVAILABLE');
    if (!matches(result, withdrawal))
      return store.settle(withdrawal.id, 'incertain', 'PROVIDER_MISMATCH');
    return store.settle(withdrawal.id, result.status, result.failure);
  }
  return {
    async create(owner, key, quoteId) {
      const reservation = store.reserve(owner, key, quoteId);
      if (reservation.replayed) return reservation;
      let result: BridgeProviderResult;
      try {
        result = await provider.submit(reservation.withdrawal);
      } catch {
        return {
          withdrawal: store.settle(reservation.withdrawal.id, 'incertain', 'PROVIDER_UNAVAILABLE'),
          replayed: false,
        };
      }
      return { withdrawal: apply(reservation.withdrawal, result), replayed: false };
    },
    get(owner, id) {
      return store.find(owner, id);
    },
    history(owner, options) {
      return store.history(owner, options);
    },
    async reconcile(owner, id) {
      const withdrawal = store.find(owner, id);
      if (!withdrawal || withdrawal.status === 'reussi' || withdrawal.status === 'echoue')
        return withdrawal;
      let result: BridgeProviderResult | null;
      try {
        result = await provider.lookup(withdrawal.id);
      } catch {
        return store.settle(withdrawal.id, 'incertain', 'PROVIDER_UNAVAILABLE');
      }
      return apply(withdrawal, result);
    },
    async retry(owner, id) {
      const withdrawal = store.find(owner, id);
      if (!withdrawal || withdrawal.status === 'reussi' || withdrawal.status === 'echoue')
        return withdrawal;
      let observed: BridgeProviderResult | null;
      try {
        observed = await provider.lookup(withdrawal.id);
      } catch {
        // Une lecture incertaine n’autorise pas une soumission supplémentaire.
        return store.settle(withdrawal.id, 'incertain', 'PROVIDER_UNAVAILABLE');
      }
      // Seul null est une absence confirmée. Une réponse malformée du port
      // ne donne jamais l’autorisation de soumettre l’opération.
      if (observed !== null) return apply(withdrawal, observed);
      let result: BridgeProviderResult;
      try {
        // Le simulateur déduplique durablement cet identifiant ; ni nouveau devis
        // ni nouvelle réservation, même si le prix initial a expiré entre-temps.
        result = await provider.submit(withdrawal);
      } catch {
        return store.settle(withdrawal.id, 'incertain', 'PROVIDER_UNAVAILABLE');
      }
      return apply(withdrawal, result);
    },
  };
}
