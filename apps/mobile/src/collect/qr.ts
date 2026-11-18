const QUIET_ZONE = 4;
const MIN_MODULE_PIXELS = 2;
const MAX_PAYMENT_REQUEST_LENGTH = 2048;

export type CollectQrErrorCode =
  'INVALID_QR_VALUE' | 'INVALID_QR_SIZE' | 'QR_SIZE_TOO_SMALL' | 'QR_ENCODING_FAILED';

export type CollectQrData = {
  moduleCount: number;
  modulePixels: number;
  size: number;
  quietZone: 4;
  modules: readonly (readonly boolean[])[];
  path: string;
};

export type CollectQrResult =
  { ok: true; qr: CollectQrData } | { ok: false; error: CollectQrErrorCode };

/** Filtre de transport seulement ; le wallet reste responsable du décodage BOLT11. */
export function isCollectPaymentRequest(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_PAYMENT_REQUEST_LENGTH &&
    (/^lnbcrt[0-9a-z]+$/.test(value) || /^LNBCRT[0-9A-Z]+$/.test(value))
  );
}

/** Encode les octets exacts, avec quatre modules blancs et au moins deux pixels par module. */
export function createCollectQr(value: unknown, maxSize = 288): CollectQrResult {
  if (!isCollectPaymentRequest(value)) return { ok: false, error: 'INVALID_QR_VALUE' };
  if (!Number.isInteger(maxSize) || maxSize < 1 || maxSize > 4096) {
    return { ok: false, error: 'INVALID_QR_SIZE' };
  }

  try {
    // Le chargement tardif permet de rendre le repli si le moteur échoue à l'exécution.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const qrcode = require('qrcode-generator') as typeof import('qrcode-generator');
    const code = qrcode(0, 'M');
    code.addData(value, 'Byte');
    code.make();
    const moduleCount = code.getModuleCount();
    const modulePixels = Math.floor(maxSize / (moduleCount + 2 * QUIET_ZONE));
    if (modulePixels < MIN_MODULE_PIXELS) return { ok: false, error: 'QR_SIZE_TOO_SMALL' };

    const size = (moduleCount + 2 * QUIET_ZONE) * modulePixels;
    const modules: boolean[][] = [];
    const parts: string[] = [];
    for (let row = 0; row < moduleCount; row += 1) {
      const cells: boolean[] = [];
      for (let column = 0; column < moduleCount; column += 1) {
        const dark = code.isDark(row, column);
        cells.push(dark);
        if (dark) {
          const x = (column + QUIET_ZONE) * modulePixels;
          const y = (row + QUIET_ZONE) * modulePixels;
          parts.push(`M${x} ${y}h${modulePixels}v${modulePixels}h-${modulePixels}z`);
        }
      }
      modules.push(cells);
    }
    return {
      ok: true,
      qr: { moduleCount, modulePixels, size, quietZone: QUIET_ZONE, modules, path: parts.join('') },
    };
  } catch {
    return { ok: false, error: 'QR_ENCODING_FAILED' };
  }
}
