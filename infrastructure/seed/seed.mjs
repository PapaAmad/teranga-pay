import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { bitcoinClient, lndClient } from './clients.mjs';

/** Montants en sats ; aucun ne représente de l'argent réel (regtest). */
export const amounts = {
  minerBlocks: 101,
  confirmations: 6,
  nodeFundingSats: 100_000_000,
  nodeMinimumSats: 50_000_000,
  channelSats: 5_000_000,
  pushSats: 1_000_000,
  verificationSats: 1_000,
};

const retryableFailures = new Set([
  'FAILURE_REASON_INSUFFICIENT_BALANCE',
  'FAILURE_REASON_NO_ROUTE',
]);

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(label, check, { sleep, attempts }) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await check()) return;
    await sleep(1_000);
  }
  throw new Error(`Délai dépassé : ${label}`);
}

/**
 * Prépare le réseau regtest : fonds de test, connexion et canal diaspora → teranga.
 * Peut être relancé : chaque étape vérifie d'abord l'état existant.
 */
export async function runSeed({
  bitcoin,
  teranga,
  diaspora,
  log = console.info,
  verifyPayment = true,
  sleep = defaultSleep,
  attempts = 120,
  paymentAttempts = 15,
}) {
  const wait = (label, check) => waitFor(label, check, { sleep, attempts });
  const summary = { minedBlocks: 0, fundedNodes: [], channelOpened: false, payment: 'ignoré' };
  const nodes = [teranga, diaspora];

  const mine = async (blocks) => {
    await bitcoin.mine(blocks, await bitcoin.newAddress());
    summary.minedBlocks += blocks;
    const height = await bitcoin.height();
    await wait('synchronisation des nœuds', async () => {
      const infos = await Promise.all(nodes.map((node) => node.info()));
      return infos.every((info) => info.synced && info.height >= height);
    });
  };

  log(`Portefeuille de minage : ${await bitcoin.ensureWallet()}`);
  if ((await bitcoin.spendableSats()) < 2 * amounts.nodeFundingSats) {
    log(`Création de ${amounts.minerBlocks} blocs pour obtenir des bitcoins de test`);
    await mine(amounts.minerBlocks);
  }

  let awaitingConfirmation = false;
  for (const node of nodes) {
    const { confirmed, unconfirmed } = await node.walletSats();
    if (confirmed + unconfirmed < amounts.nodeMinimumSats) {
      await bitcoin.sendSats(await node.newAddress(), amounts.nodeFundingSats);
      summary.fundedNodes.push(node.name);
      awaitingConfirmation = true;
      log(`${node.name} : ${amounts.nodeFundingSats} sats de test envoyés`);
    } else if (unconfirmed > 0) {
      // Virement déjà diffusé lors d'une exécution interrompue : on le confirme
      // sans l'envoyer une seconde fois, car LND n'ouvre un canal qu'avec des fonds confirmés.
      awaitingConfirmation = true;
      log(`${node.name} : virement précédent en attente de confirmation`);
    }
  }
  if (awaitingConfirmation) await mine(amounts.confirmations);

  const terangaKey = (await teranga.info()).pubkey;
  if (!(await diaspora.peers()).includes(terangaKey)) {
    await diaspora.connect(terangaKey, 'lnd-teranga:9735');
    log('diaspora connecté à teranga');
  }

  const hasChannel = (await diaspora.channels()).some((c) => c.remotePubkey === terangaKey);
  const isPending = (await diaspora.pendingChannels()).includes(terangaKey);
  if (!hasChannel && !isPending) {
    await diaspora.openChannel(terangaKey, amounts.channelSats, amounts.pushSats);
    summary.channelOpened = true;
    log(`Canal ouvert : ${amounts.channelSats} sats, dont ${amounts.pushSats} côté teranga`);
  }
  if (summary.channelOpened || isPending) await mine(amounts.confirmations);
  await wait('activation du canal', async () =>
    (await diaspora.channels()).some((c) => c.remotePubkey === terangaKey && c.active),
  );
  log('Canal diaspora → teranga actif');

  if (verifyPayment) {
    // Juste après l'activation, le nœud peut encore annoncer un solde insuffisant ou
    // aucune route le temps d'enregistrer le canal : ces deux cas sont réessayés.
    let result = { status: 'NON_TENTÉ' };
    for (let attempt = 0; attempt < paymentAttempts; attempt += 1) {
      const invoice = await teranga.addInvoice(amounts.verificationSats, 'Vérification du seed');
      result = await diaspora.pay(invoice);
      if (result.status === 'SUCCEEDED' || !retryableFailures.has(result.reason)) break;
      await sleep(1_000);
    }
    if (result.status !== 'SUCCEEDED') {
      throw new Error(`Paiement de vérification refusé : ${result.reason ?? result.status}`);
    }
    summary.payment = 'réussi';
    log(`Paiement de vérification de ${amounts.verificationSats} sats réussi`);
  }
  return summary;
}

async function main() {
  const personas = JSON.parse(
    await readFile(new URL('./demo-data.json', import.meta.url), 'utf8'),
  ).personas;
  const bitcoin = bitcoinClient({
    host: 'bitcoind',
    cookieFile: '/bitcoin/regtest/.cookie',
    wallet: 'teranga-seed',
  });
  const teranga = await lndClient({ name: 'teranga', host: 'lnd-teranga', dir: '/lnd-teranga' });
  const diaspora = await lndClient({
    name: 'diaspora',
    host: 'lnd-diaspora',
    dir: '/lnd-diaspora',
  });
  const summary = await runSeed({
    bitcoin,
    teranga,
    diaspora,
    verifyPayment: process.env.SEED_VERIFY_PAYMENT !== '0',
  });
  console.info(`Personnages fictifs disponibles : ${personas.map((p) => p.prenom).join(', ')}`);
  console.info(`Seed terminé : ${JSON.stringify(summary)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Seed en échec : ${error.message}`);
    process.exit(1);
  });
}
