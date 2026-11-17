import { readFileSync } from 'node:fs';

/**
 * Estimation d'économies (T34). Formule unique, affichée telle quelle :
 *   économie = frais estimés d'un envoi classique − frais réellement payés.
 * Les frais classiques sont une fourchette tirée d'hypothèses publiques : le
 * résultat est une estimation, jamais une promesse. Il peut être négatif.
 */

/** Une façon « classique » d'envoyer de l'argent, décrite par une fourchette de frais. */
export type Corridor = {
  id: string;
  /** Frais en points de base : 100 = 1 %. */
  minBasisPoints: number;
  maxBasisPoints: number;
  /** Ajoute la taxe TTA sur les opérations de mobile money. */
  addsTta: boolean;
  /** Origine de l'hypothèse, à afficher avec le résultat. */
  source: string;
};

export type SavingsAssumptions = {
  /** Date de relevé des hypothèses (AAAA-MM-JJ). */
  version: string;
  ttaBasisPoints: number;
  ttaCapXof: number;
  corridors: Corridor[];
};

const designDoc = 'Document de conception v1.0, section 2.2 (ordres de grandeur indicatifs)';

/** Hypothèses par défaut, reprises du document de conception. Les tarifs changent souvent. */
export const defaultSavingsAssumptions: SavingsAssumptions = {
  version: '2026-11-01',
  ttaBasisPoints: 50,
  ttaCapXof: 2_000,
  corridors: [
    {
      id: 'france_senegal',
      minBasisPoints: 250,
      maxBasisPoints: 380,
      addsTta: false,
      source: `${designDoc} : coût moyen d'un envoi France → Sénégal en 2021`,
    },
    {
      id: 'hors_zone_cfa',
      minBasisPoints: 1_000,
      maxBasisPoints: 1_500,
      addsTta: false,
      source: `${designDoc} : envois depuis des pays hors zone CFA`,
    },
    {
      id: 'wave_local',
      minBasisPoints: 100,
      maxBasisPoints: 100,
      addsTta: true,
      source: `${designDoc} : envoi local Wave, plus taxe TTA`,
    },
    {
      id: 'orange_money_local',
      minBasisPoints: 80,
      maxBasisPoints: 80,
      addsTta: true,
      source: `${designDoc} : envoi local Orange Money, plus taxe TTA`,
    },
  ],
};

function fail(message: string): never {
  throw new Error(`Hypothèses d'économies invalides : ${message}.`);
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

/** Vérifie un jeu d'hypothèses venu d'un fichier ; refuse tout champ inconnu ou incohérent. */
export function validateSavingsAssumptions(input: unknown): SavingsAssumptions {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) fail('objet attendu');
  const raw = input as Record<string, unknown>;
  const allowed = new Set(['version', 'ttaBasisPoints', 'ttaCapXof', 'corridors']);
  for (const key of Object.keys(raw)) if (!allowed.has(key)) fail(`champ inconnu « ${key} »`);
  if (typeof raw.version !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(raw.version)) {
    fail('version au format AAAA-MM-JJ attendue');
  }
  if (!isInteger(raw.ttaBasisPoints, 0, 1_000)) fail('ttaBasisPoints entre 0 et 1000');
  if (!isInteger(raw.ttaCapXof, 0, 1_000_000)) fail('ttaCapXof entre 0 et 1 000 000');
  if (!Array.isArray(raw.corridors) || raw.corridors.length < 1 || raw.corridors.length > 20) {
    fail('corridors : 1 à 20 éléments');
  }
  const ids = new Set<string>();
  const corridors = raw.corridors.map((item: unknown, index): Corridor => {
    const where = `corridors[${index}]`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) fail(`${where} objet`);
    const corridor = item as Record<string, unknown>;
    const keys = new Set(['id', 'minBasisPoints', 'maxBasisPoints', 'addsTta', 'source']);
    for (const key of Object.keys(corridor)) {
      if (!keys.has(key)) fail(`${where} : champ inconnu « ${key} »`);
    }
    if (typeof corridor.id !== 'string' || !/^[a-z0-9_]{2,40}$/u.test(corridor.id)) {
      fail(`${where}.id : minuscules, chiffres et _ (2 à 40)`);
    }
    if (ids.has(corridor.id)) fail(`${where}.id « ${corridor.id} » en double`);
    ids.add(corridor.id);
    if (!isInteger(corridor.minBasisPoints, 0, 5_000)) fail(`${where}.minBasisPoints 0 à 5000`);
    if (!isInteger(corridor.maxBasisPoints, 0, 5_000)) fail(`${where}.maxBasisPoints 0 à 5000`);
    if (corridor.minBasisPoints > corridor.maxBasisPoints) {
      fail(`${where} : minBasisPoints dépasse maxBasisPoints`);
    }
    if (typeof corridor.addsTta !== 'boolean') fail(`${where}.addsTta booléen`);
    if (typeof corridor.source !== 'string' || corridor.source.trim().length < 3) {
      fail(`${where}.source obligatoire`);
    }
    if (corridor.source.length > 300) fail(`${where}.source : 300 caractères au plus`);
    return {
      id: corridor.id,
      minBasisPoints: corridor.minBasisPoints,
      maxBasisPoints: corridor.maxBasisPoints,
      addsTta: corridor.addsTta,
      source: corridor.source,
    };
  });
  return {
    version: raw.version,
    ttaBasisPoints: raw.ttaBasisPoints,
    ttaCapXof: raw.ttaCapXof,
    corridors,
  };
}

/** Lit `SAVINGS_ASSUMPTIONS_FILE` s'il est défini, sinon garde les hypothèses par défaut. */
export function loadSavingsAssumptions(
  env: NodeJS.ProcessEnv = process.env,
  readFile: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): SavingsAssumptions {
  const path = env.SAVINGS_ASSUMPTIONS_FILE;
  if (!path) return defaultSavingsAssumptions;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFile(path));
  } catch {
    // Le chemin n'est pas recopié : il peut contenir un nom d'utilisateur.
    fail('SAVINGS_ASSUMPTIONS_FILE illisible ou JSON incorrect');
  }
  return validateSavingsAssumptions(parsed);
}

export type Transfer = { amountXof: number; corridor: string; actualFeesXof: number };

export type Range = { min: number; max: number };

/** `economie` si même l'hypothèse basse fait gagner ; `surcout` si même la haute fait perdre. */
export type Outcome = 'economie' | 'comparable' | 'surcout';

export type TransferEstimate = Transfer & {
  classicFeesXof: Range;
  savingsXof: Range;
  outcome: Outcome;
};

export type SavingsEstimate = {
  estimate: true;
  formula: 'classicFeesXof - actualFeesXof';
  assumptionsVersion: string;
  transfers: TransferEstimate[];
  total: {
    amountXof: number;
    actualFeesXof: number;
    classicFeesXof: Range;
    savingsXof: Range;
    outcome: Outcome;
  };
};

function outcomeOf(savings: Range): Outcome {
  if (savings.min > 0) return 'economie';
  if (savings.max < 0) return 'surcout';
  return 'comparable';
}

/**
 * Frais classiques en FCFA entiers. La borne basse est arrondie vers le bas et la
 * haute vers le haut : l'arrondi ne grossit jamais l'économie annoncée en bas de fourchette.
 */
export function classicFees(
  amountXof: number,
  corridor: Corridor,
  assumptions: SavingsAssumptions,
): Range {
  const tta = corridor.addsTta
    ? Math.min(assumptions.ttaCapXof, Math.round((amountXof * assumptions.ttaBasisPoints) / 10_000))
    : 0;
  return {
    min: Math.floor((amountXof * corridor.minBasisPoints) / 10_000) + tta,
    max: Math.ceil((amountXof * corridor.maxBasisPoints) / 10_000) + tta,
  };
}

export function estimateSavings(
  transfers: Transfer[],
  assumptions: SavingsAssumptions,
): SavingsEstimate {
  const byId = new Map(assumptions.corridors.map((corridor) => [corridor.id, corridor]));
  const items = transfers.map((transfer): TransferEstimate => {
    const corridor = byId.get(transfer.corridor);
    if (!corridor) throw new Error(`corridor inconnu : ${transfer.corridor}`);
    const classic = classicFees(transfer.amountXof, corridor, assumptions);
    const savings = {
      min: classic.min - transfer.actualFeesXof,
      max: classic.max - transfer.actualFeesXof,
    };
    return {
      ...transfer,
      classicFeesXof: classic,
      savingsXof: savings,
      outcome: outcomeOf(savings),
    };
  });
  const sum = (pick: (item: TransferEstimate) => number) =>
    items.reduce((total, item) => total + pick(item), 0);
  const totalSavings = {
    min: sum((item) => item.savingsXof.min),
    max: sum((item) => item.savingsXof.max),
  };
  return {
    estimate: true,
    formula: 'classicFeesXof - actualFeesXof',
    assumptionsVersion: assumptions.version,
    transfers: items,
    total: {
      amountXof: sum((item) => item.amountXof),
      actualFeesXof: sum((item) => item.actualFeesXof),
      classicFeesXof: {
        min: sum((item) => item.classicFeesXof.min),
        max: sum((item) => item.classicFeesXof.max),
      },
      savingsXof: totalSavings,
      outcome: outcomeOf(totalSavings),
    },
  };
}
