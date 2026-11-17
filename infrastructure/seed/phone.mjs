import { fileURLToPath } from 'node:url';
import { bitcoinClient, lndClient } from './clients.mjs';

export const phoneChannelSats = 2_000_000;
const pubkeyPattern = /^0[23][0-9a-f]{64}$/;

/**
 * Ouvre un canal privé de `lnd-teranga` vers le wallet du téléphone, qui peut
 * ensuite recevoir. Le téléphone doit d'abord s'être connecté à teranga
 * (ouverture de l'application). Relançable : un canal existant n'est pas dupliqué.
 */
export async function openPhoneChannel({
  bitcoin,
  teranga,
  pubkey,
  sats = phoneChannelSats,
  log = console.info,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  attempts = 60,
}) {
  if (!pubkeyPattern.test(pubkey)) throw new Error('Clé publique du téléphone invalide');
  const channels = await teranga.channels();
  if (channels.some((c) => c.remotePubkey === pubkey && c.active)) {
    log('Canal vers le téléphone déjà actif');
    return { opened: false };
  }
  const pending = await teranga.pendingChannels();
  if (!channels.some((c) => c.remotePubkey === pubkey) && !pending.includes(pubkey)) {
    if (!(await teranga.peers()).includes(pubkey)) {
      throw new Error(
        "Le téléphone n'est pas connecté à teranga : ouvrir l'application puis relancer",
      );
    }
    await teranga.openChannel(pubkey, sats, 0, { private: true });
    log(`Canal privé de ${sats} sats ouvert vers le téléphone`);
  }
  await bitcoin.mine(6, await bitcoin.newAddress());
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if ((await teranga.channels()).some((c) => c.remotePubkey === pubkey && c.active)) {
      log('Canal vers le téléphone actif : il peut recevoir');
      return { opened: true };
    }
    await sleep(1_000);
  }
  throw new Error('Délai dépassé : activation du canal vers le téléphone');
}

/** Ousmane (lnd-diaspora) paie une facture affichée par le téléphone. */
export async function payFromDiaspora({ diaspora, invoice, log = console.info }) {
  if (!/^lnbcrt[0-9a-z]+$/i.test(invoice)) throw new Error('Facture regtest attendue (lnbcrt…)');
  const result = await diaspora.pay(invoice);
  if (result.status !== 'SUCCEEDED') {
    throw new Error(`Paiement refusé : ${result.reason ?? result.status}`);
  }
  log('Paiement envoyé par diaspora : réussi');
  return result;
}

async function main([command, value]) {
  const bitcoin = bitcoinClient({
    host: 'bitcoind',
    cookieFile: '/bitcoin/regtest/.cookie',
    wallet: 'teranga-seed',
  });
  if (command === 'canal') {
    const teranga = await lndClient({ name: 'teranga', host: 'lnd-teranga', dir: '/lnd-teranga' });
    await openPhoneChannel({ bitcoin, teranga, pubkey: String(value ?? '').toLowerCase() });
  } else if (command === 'payer') {
    const diaspora = await lndClient({
      name: 'diaspora',
      host: 'lnd-diaspora',
      dir: '/lnd-diaspora',
    });
    await payFromDiaspora({ diaspora, invoice: String(value ?? '').trim() });
  } else if (command === 'info') {
    const teranga = await lndClient({ name: 'teranga', host: 'lnd-teranga', dir: '/lnd-teranga' });
    console.info(`Pair teranga : ${(await teranga.info()).pubkey}@10.0.2.2:9735 (émulateur)`);
  } else {
    throw new Error('Usage : node phone.mjs info | canal <clé du téléphone> | payer <facture>');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Échec : ${error.message}`);
    process.exit(1);
  });
}
