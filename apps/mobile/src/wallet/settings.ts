import type { NodeSettings } from '../../modules/teranga-wallet/src';

/**
 * Réglages du réseau regtest de démonstration (T12). L'émulateur Android joint
 * l'ordinateur à l'adresse 10.0.2.2. La clé du pair change à chaque remise à zéro
 * du réseau : la récupérer avec `npm run regtest:phone -- info` et la placer dans
 * `apps/mobile/.env` (fichier ignoré par Git).
 */
export const demoNodeSettings: NodeSettings = {
  electrumUrl: process.env.EXPO_PUBLIC_ELECTRUM_URL ?? 'tcp://10.0.2.2:50001',
  peerId: process.env.EXPO_PUBLIC_TERANGA_PEER_ID ?? '',
  peerAddress: process.env.EXPO_PUBLIC_TERANGA_PEER_ADDRESS ?? '10.0.2.2:9735',
};

/**
 * Adresses Lightning (T19, T21). Le domaine de démonstration n'existe pas sur
 * Internet : ses requêtes LNURL partent vers l'API locale. Toute autre adresse
 * est jointe en HTTPS sur son propre domaine.
 */
export const demoLightningAddressSettings = {
  domain: process.env.EXPO_PUBLIC_LNADDRESS_DOMAIN ?? 'teranga.example',
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000',
};
