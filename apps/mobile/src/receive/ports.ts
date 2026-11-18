import type { HomeResult, HomeWalletEvent, HomeWalletState } from '../home/ports';

/** Sous-ensemble structurel du contrat T11 ; aucun SDK, clé ou PIN dans T18. */
export interface ReceiveWalletPort {
  state(): Promise<HomeWalletState>;
  subscribe(listener: (event: HomeWalletEvent) => void): () => void;
}

/** T19 fournit uniquement l'adresse publique ; aucun jeton d'enregistrement ne traverse ce port. */
export interface ReceiveAddressPort {
  current(): Promise<HomeResult<{ address: string }>>;
}

export type ReceiveServices = {
  mode: 'unavailable' | 'preview' | 'native';
  wallet?: ReceiveWalletPort;
  address?: ReceiveAddressPort;
};
