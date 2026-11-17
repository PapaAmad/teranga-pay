/**
 * Alerte fraude (T26) : règles simples et explicables, sans donnée personnelle.
 *
 * Le téléphone envoie seulement des nombres : montant, nouveau destinataire ou non,
 * montants et âges de ses derniers envois, heure locale et solde. Aucun nom, numéro,
 * adresse ni facture. Le score avertit et peut demander une confirmation ; il ne
 * bloque jamais un paiement (« l'IA avertit mais ne bloque pas seule »).
 */

export type PaymentCheck = {
  amountSats: number;
  newRecipient: boolean;
  /** Envois des dernières 24 h, du plus récent au plus ancien. */
  recentPayments: { amountSats: number; ageSeconds: number }[];
  /** Montants des envois habituels (historique local), pour repérer un montant inhabituel. */
  usualAmountsSats: number[];
  /** Heure locale du téléphone, de 0 à 23. */
  localHour?: number;
  /** Solde disponible avant l'envoi. */
  balanceSats?: number;
};

export type ReasonCode =
  | 'NOUVEAU_DESTINATAIRE'
  | 'MONTANT_INHABITUEL'
  | 'MONTANT_TRES_INHABITUEL'
  | 'GROS_MONTANT'
  | 'RYTHME_ANORMAL'
  | 'PRESQUE_TOUT_LE_SOLDE'
  | 'HEURE_INHABITUELLE';

export type Assessment = {
  /** De 0 (aucun signal) à 100. */
  score: number;
  level: 'faible' | 'moyen' | 'eleve';
  /** Vrai si l'application doit afficher l'alerte et redemander le PIN (T27). */
  confirmationRequired: boolean;
  /** Raisons dans l'ordre de leur poids ; l'application traduit chaque code. */
  reasons: { code: ReasonCode; points: number }[];
};

export type FraudConfig = {
  /** Montant considéré comme gros quel que soit l'historique. */
  largeAmountSats: number;
  /** Score à partir duquel une confirmation est demandée. */
  confirmationThreshold: number;
};

export const defaultFraudConfig: FraudConfig = {
  // Environ 90 000 FCFA au taux de démonstration (45 000 000 FCFA/BTC).
  largeAmountSats: 200_000,
  confirmationThreshold: 50,
};

/** Poids de chaque règle : documentés et testés pour rester explicables. */
export const rulePoints: Record<ReasonCode, number> = {
  NOUVEAU_DESTINATAIRE: 30,
  MONTANT_TRES_INHABITUEL: 45,
  MONTANT_INHABITUEL: 30,
  GROS_MONTANT: 20,
  RYTHME_ANORMAL: 25,
  PRESQUE_TOUT_LE_SOLDE: 20,
  HEURE_INHABITUELLE: 10,
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function assessPayment(
  check: PaymentCheck,
  config: FraudConfig = defaultFraudConfig,
): Assessment {
  const reasons: Assessment['reasons'] = [];
  const add = (code: ReasonCode) => reasons.push({ code, points: rulePoints[code] });

  if (check.newRecipient) add('NOUVEAU_DESTINATAIRE');

  // Montant inhabituel : seulement avec au moins 3 envois connus, pour ne pas alerter un débutant.
  if (check.usualAmountsSats.length >= 3) {
    const usual = median(check.usualAmountsSats);
    if (usual > 0 && check.amountSats >= usual * 10) add('MONTANT_TRES_INHABITUEL');
    else if (usual > 0 && check.amountSats >= usual * 3) add('MONTANT_INHABITUEL');
  }

  if (check.amountSats >= config.largeAmountSats) add('GROS_MONTANT');

  // Rythme : un faux agent pousse souvent à enchaîner les envois. 4 envois ou plus en 10 minutes.
  const lastTenMinutes = check.recentPayments.filter((p) => p.ageSeconds <= 600).length;
  if (lastTenMinutes >= 4) add('RYTHME_ANORMAL');

  if (check.balanceSats !== undefined && check.balanceSats > 0) {
    if (check.amountSats >= check.balanceSats * 0.9) add('PRESQUE_TOUT_LE_SOLDE');
  }

  if (check.localHour !== undefined && check.localHour >= 0 && check.localHour < 5) {
    add('HEURE_INHABITUELLE');
  }

  reasons.sort((a, b) => b.points - a.points);
  const score = Math.min(
    100,
    reasons.reduce((sum, reason) => sum + reason.points, 0),
  );
  return {
    score,
    level: score >= 60 ? 'eleve' : score >= 30 ? 'moyen' : 'faible',
    confirmationRequired: score >= config.confirmationThreshold,
    reasons,
  };
}
