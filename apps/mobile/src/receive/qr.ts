import qrcode from 'qrcode-generator';

const QUIET_ZONE = 4;

export type ReceiveQrData = {
  moduleCount: number;
  modulePixels: number;
  size: number;
  quietZone: 4;
  modules: readonly (readonly boolean[])[];
  path: string;
};

/** L'adresse est encodée telle quelle, sans schéma ou normalisation implicite. */
export function assertReceiveQrValue(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,254}$/.test(value)) {
    throw new Error('INVALID_QR_VALUE');
  }
}

export function createReceiveQr(value: string, maxSize = 240): ReceiveQrData {
  assertReceiveQrValue(value);
  if (!Number.isInteger(maxSize) || maxSize < 1 || maxSize > 4096) {
    throw new Error('INVALID_QR_SIZE');
  }

  const code = qrcode(0, 'M');
  code.addData(value, 'Byte');
  code.make();
  const moduleCount = code.getModuleCount();
  const modulePixels = Math.floor(maxSize / (moduleCount + 2 * QUIET_ZONE));
  if (modulePixels < 1) throw new Error('QR_SIZE_TOO_SMALL');
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
  return { moduleCount, modulePixels, size, quietZone: QUIET_ZONE, modules, path: parts.join('') };
}
