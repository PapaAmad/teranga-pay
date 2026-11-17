import type { Invoice } from '@teranga-pay/contracts';

/**
 * Données que LDK Node ne garde pas et que l'application doit retrouver après
 * redémarrage. Aucune clé, aucun PIN, aucune phrase de récupération.
 */
export type JournalData = {
  version: 1;
  /** FCFA fixés au moment de chaque paiement, par identifiant ; `null` : taux inconnu. */
  xof: Record<string, number | null>;
  /** Factures créées par ce téléphone, par `paymentId`. */
  invoices: Record<string, Invoice>;
  /** Envois sans issue établie : « destination|montant » → identifiant du paiement (T21). */
  sends: Record<string, string>;
};

export type JournalStorage = {
  journalRead(): Promise<string | null>;
  journalWrite(text: string): Promise<void>;
};

export type Journal = {
  read(): Promise<JournalData>;
  /** Applique une modification puis l'enregistre ; les écritures passent l'une après l'autre. */
  update(change: (data: JournalData) => void): Promise<JournalData>;
};

const empty = (): JournalData => ({ version: 1, xof: {}, invoices: {}, sends: {} });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Relit le journal ; un fichier illisible ou d'un autre format repart vide plutôt que de bloquer le wallet. */
export function parseJournal(text: string | null): JournalData {
  if (text === null) return empty();
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed) || parsed.version !== 1) return empty();
    const data = empty();
    if (isRecord(parsed.xof)) {
      for (const [id, value] of Object.entries(parsed.xof)) {
        if (value === null || (Number.isSafeInteger(value) && (value as number) >= 0)) {
          data.xof[id] = value as number | null;
        }
      }
    }
    if (isRecord(parsed.invoices)) {
      for (const [id, value] of Object.entries(parsed.invoices)) {
        if (isRecord(value) && value.paymentId === id && typeof value.paymentRequest === 'string') {
          data.invoices[id] = value as Invoice;
        }
      }
    }
    if (isRecord(parsed.sends)) {
      for (const [key, value] of Object.entries(parsed.sends)) {
        if (typeof value === 'string' && value.length > 0) data.sends[key] = value;
      }
    }
    return data;
  } catch {
    return empty();
  }
}

function cloneJournal(data: JournalData): JournalData {
  return JSON.parse(JSON.stringify(data)) as JournalData;
}

export function createJournal(storage: JournalStorage): Journal {
  let loaded: Promise<JournalData> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const read = () => {
    if (!loaded) {
      // Un échec de lecture n'est pas gardé : le prochain appel réessaie.
      const attempt = storage.journalRead().then(parseJournal);
      loaded = attempt.catch((error: unknown) => {
        loaded = null;
        throw error;
      });
    }
    return loaded;
  };

  return {
    read,
    update(change) {
      const next = queue.then(async () => {
        // La modification porte sur une copie : si l'écriture échoue, ni la mémoire
        // ni une écriture suivante ne gardent une donnée que l'appelant croit perdue.
        const draft = cloneJournal(await read());
        change(draft);
        await storage.journalWrite(JSON.stringify(draft));
        loaded = Promise.resolve(draft);
        return draft;
      });
      // Une écriture ratée ne bloque pas les suivantes ; l'appelant reçoit l'erreur.
      queue = next.catch(() => undefined);
      return next;
    },
  };
}

const shared = new WeakMap<JournalStorage, Journal>();

/**
 * Un seul journal par module natif : deux adaptateurs ouverts en même temps (écran
 * recréé, plusieurs écrans) partagent la même copie et ne s'écrasent pas.
 */
export function journalFor(storage: JournalStorage): Journal {
  let journal = shared.get(storage);
  if (!journal) {
    journal = createJournal(storage);
    shared.set(storage, journal);
  }
  return journal;
}
