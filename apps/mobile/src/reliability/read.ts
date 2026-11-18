/** Délai d'interface par lecture ; il ne prétend pas annuler le transport natif. */
export const READ_TIMEOUT_MS = 10_000;

class ReadTimeout extends Error {
  constructor() {
    super('READ_TIMEOUT');
    this.name = 'ReadTimeout';
  }
}

/** Lectures uniquement. Ne jamais envelopper send, create, confirm ou une écriture locale. */
export async function readWithDeadline<T>(work: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ReadTimeout()), READ_TIMEOUT_MS);
      }),
      work(),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Aucun détail d'exception externe n'est repris dans l'interface ou les journaux. */
export const readFailure = (error: unknown): 'READ_TIMEOUT' | 'READ_FAILED' =>
  error instanceof ReadTimeout ? 'READ_TIMEOUT' : 'READ_FAILED';

/** Notification seule : la mutation originale reste suivie, sans rejet ni nouvel appel. */
export function startPendingWatch(onSlow: () => void): () => void {
  const timer = setTimeout(onSlow, READ_TIMEOUT_MS);
  return () => clearTimeout(timer);
}
