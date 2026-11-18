import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { lndClient } from './clients.mjs';

/** Montants du test d'intégration T29, en sats de test (regtest). */
export const checks = {
  inboundSats: 2_500,
  outboundSats: 1_200,
  // Plus que la capacité du canal de 5 000 000 sats : ce paiement doit toujours échouer.
  impossibleSats: 6_000_000,
};

const retryableFailures = new Set([
  'FAILURE_REASON_INSUFFICIENT_BALANCE',
  'FAILURE_REASON_NO_ROUTE',
]);

/** Refus attendus d'un paiement plus gros que le canal (liste distincte des réessais). */
const capacityRefusals = new Set([
  'FAILURE_REASON_INSUFFICIENT_BALANCE',
  'FAILURE_REASON_NO_ROUTE',
]);

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Vérifie qu'un paiement a été refusé pour de bon : `FAILED`, avec une raison
 * attendue. `IN_FLIGHT` (encore en cours) ou une coupure du nœud (exception
 * propagée par le client) ne prouvent pas un refus et font échouer le test.
 */
function expectRefusal(result, reasons, label, acceptedMessage = `${label} : paiement accepté`) {
  if (result.status === 'SUCCEEDED') throw new Error(acceptedMessage);
  if (result.status !== 'FAILED' || !reasons.has(result.reason)) {
    throw new Error(
      `${label} : refus non terminal ou inattendu (${result.status}, ${result.reason ?? 'sans raison'})`,
    );
  }
}

async function payAndConfirm({ payer, payee, sats, memo, sleep, attempts, log }) {
  const payeeBefore = await payee.channelSats();
  const payerBefore = await payer.channelSats();
  const invoice = await payee.createInvoice(sats, memo);

  let result = { status: 'NON_TENTÉ' };
  for (let index = 0; index < attempts; index += 1) {
    result = await payer.pay(invoice.paymentRequest);
    if (result.status === 'SUCCEEDED' || !retryableFailures.has(result.reason)) break;
    await sleep(1_000);
  }
  if (result.status !== 'SUCCEEDED') {
    throw new Error(
      `${payer.name} → ${payee.name} : paiement refusé (${result.reason ?? result.status})`,
    );
  }

  const settled = await payee.lookupInvoice(invoice.hash);
  if (settled.state !== 'SETTLED' || settled.paidSats !== sats) {
    throw new Error(
      `${payee.name} : facture non réglée (${settled.state}, ${settled.paidSats}/${sats} sats)`,
    );
  }
  // Le payeur voit SUCCEEDED dès qu'il reçoit la preuve de paiement ; les deux nœuds
  // échangent encore leurs signatures quelques instants avant de mettre à jour les soldes.
  // Canal direct : aucun frais de routage, chacun doit bouger exactement du montant.
  const expected = { [payee.name]: payeeBefore + sats, [payer.name]: payerBefore - sats };
  let balances = {};
  for (let index = 0; index < attempts; index += 1) {
    balances = { [payee.name]: await payee.channelSats(), [payer.name]: await payer.channelSats() };
    if (
      balances[payee.name] === expected[payee.name] &&
      balances[payer.name] === expected[payer.name]
    )
      break;
    await sleep(1_000);
  }
  const received = balances[payee.name] - payeeBefore;
  if (received !== sats) {
    throw new Error(`${payee.name} : solde du canal +${received} sats au lieu de +${sats}`);
  }
  const spent = payerBefore - balances[payer.name];
  if (spent !== sats) {
    throw new Error(`${payer.name} : solde du canal -${spent} sats au lieu de -${sats}`);
  }
  log(`${payer.name} → ${payee.name} : ${sats} sats reçus et vérifiés`);
  return invoice;
}

/**
 * Paiements réels sur le réseau regtest déjà préparé par le seed.
 * Lève une erreur au premier écart : le processus sort alors en échec et la CI aussi.
 */
export async function runIntegration({
  teranga,
  diaspora,
  log = console.info,
  sleep = defaultSleep,
  attempts = 15,
}) {
  const options = { sleep, attempts, log };

  // 1. Ousmane (diaspora) paie Mame Diarra (teranga).
  const inbound = await payAndConfirm({
    payer: diaspora,
    payee: teranga,
    sats: checks.inboundSats,
    memo: 'T29 : envoi diaspora',
    ...options,
  });

  // 2. Payer deux fois la même facture doit être refusé sans débiter une seconde fois.
  const balanceBefore = await diaspora.channelSats();
  const replay = await diaspora.pay(inbound.paymentRequest);
  expectRefusal(
    replay,
    new Set(['ALREADY_PAID']),
    'Double paiement',
    'Double paiement accepté pour une même facture',
  );
  if ((await diaspora.channelSats()) !== balanceBefore) {
    throw new Error('Double paiement refusé, mais le solde du payeur a changé');
  }
  log('Double paiement de la même facture refusé, solde inchangé');

  // 3. Le paiement dans l'autre sens fonctionne aussi.
  await payAndConfirm({
    payer: teranga,
    payee: diaspora,
    sats: checks.outboundSats,
    memo: 'T29 : paiement depuis teranga',
    ...options,
  });

  // 4. Un paiement impossible échoue proprement et ne touche pas aux soldes.
  const before = await Promise.all([teranga.channelSats(), diaspora.channelSats()]);
  const impossible = await diaspora.createInvoice(checks.impossibleSats, 'T29 : trop gros');
  const refused = await teranga.pay(impossible.paymentRequest);
  expectRefusal(
    refused,
    capacityRefusals,
    'Paiement impossible',
    'Paiement plus gros que le canal accepté',
  );
  const after = await Promise.all([teranga.channelSats(), diaspora.channelSats()]);
  if (after[0] !== before[0] || after[1] !== before[1]) {
    throw new Error('Paiement impossible refusé, mais un solde a changé');
  }
  const status = await diaspora.lookupInvoice(impossible.hash);
  if (status.state === 'SETTLED') throw new Error('Facture impossible marquée réglée');
  log(`Paiement impossible refusé proprement (${refused.reason})`);

  return { inbound: checks.inboundSats, outbound: checks.outboundSats, replay: 'refusé' };
}

async function main() {
  const teranga = await lndClient({ name: 'teranga', host: 'lnd-teranga', dir: '/lnd-teranga' });
  const diaspora = await lndClient({
    name: 'diaspora',
    host: 'lnd-diaspora',
    dir: '/lnd-diaspora',
  });
  const summary = await runIntegration({ teranga, diaspora });
  console.info(`Test d'intégration réussi : ${JSON.stringify(summary)}`);
}

function isMain() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  main().catch((error) => {
    console.error(`Test d'intégration en échec : ${error.message}`);
    process.exit(1);
  });
}
