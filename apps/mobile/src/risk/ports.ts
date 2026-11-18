/** Contrat numérique T26, sans adresse, identifiant, facture, mémo ou PIN. */
export type RiskCheck = Readonly<{
  amountSats: number;
  newRecipient: boolean;
  recentPayments: readonly Readonly<{ amountSats: number; ageSeconds: number }>[];
  usualAmountsSats: readonly number[];
  localHour?: number;
  balanceSats?: number;
}>;

export type RiskReasonCode =
  | 'NOUVEAU_DESTINATAIRE'
  | 'MONTANT_INHABITUEL'
  | 'MONTANT_TRES_INHABITUEL'
  | 'GROS_MONTANT'
  | 'RYTHME_ANORMAL'
  | 'PRESQUE_TOUT_LE_SOLDE'
  | 'HEURE_INHABITUELLE';

/** Réponse brute T26 : le serveur décide si une confirmation est nécessaire. */
export type RiskAssessment = Readonly<{
  score: number;
  level: 'faible' | 'moyen' | 'eleve';
  confirmationRequired: boolean;
  reasons: readonly Readonly<{ code: RiskReasonCode; points: number }>[];
}>;

export interface RiskPort {
  check(input: RiskCheck): Promise<unknown>;
}
