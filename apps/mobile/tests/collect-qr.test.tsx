import { render, screen } from '@testing-library/react-native';
import jsQR from 'jsqr';
import { Platform, Text } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { CollectQr } from '../src/collect/CollectQr';
import { createCollectQr, type CollectQrData } from '../src/collect/qr';

// Charges non payables : le test porte sur le transport des octets, jamais sur un paiement.
const invoice = `lnbcrt${'q'.repeat(320)}`;
const longInvoice = `lnbcrt${'qpzry9x8gf2tvdw0s3jn54khce6mua7l'.repeat(32)}`;

/** Rasterise le chemin envoyé à SVG, sans consulter la matrice de génération. */
function rasterize(qr: CollectQrData) {
  const pixels = new Uint8ClampedArray(qr.size * qr.size * 4).fill(255);
  let consumed = '';
  for (const command of qr.path.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-(\d+)z/g)) {
    consumed += command[0];
    const [, xText, yText, widthText, heightText, backText] = command;
    const x = Number(xText);
    const y = Number(yText);
    const width = Number(widthText);
    const height = Number(heightText);
    expect(width).toBe(Number(backText));
    expect(width).toBe(qr.modulePixels);
    expect(height).toBe(qr.modulePixels);
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        const offset = (row * qr.size + column) * 4;
        pixels[offset] = 0;
        pixels[offset + 1] = 0;
        pixels[offset + 2] = 0;
      }
    }
  }
  expect(consumed).toBe(qr.path);
  return pixels;
}

afterEach(() => jest.restoreAllMocks());

describe('QR marchand T22 | facture brute et lisible', () => {
  it.each([invoice, longInvoice, invoice.toUpperCase()])(
    'un décodeur indépendant retrouve exactement une facture représentative',
    (value) => {
      // 320 px de viewport avec 16 px de marge de chaque côté.
      const result = createCollectQr(value, 288);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);
      const qr = result.qr;
      expect(qr.size).toBeLessThanOrEqual(288);
      expect(qr.modulePixels).toBeGreaterThanOrEqual(2);
      const decoded = jsQR(rasterize(qr), qr.size, qr.size, { inversionAttempts: 'dontInvert' });
      expect(decoded?.data).toBe(value);
      expect(decoded?.binaryData).toEqual(Array.from(value, (letter) => letter.charCodeAt(0)));
      expect(decoded?.data.startsWith('lightning:')).toBe(false);
    },
  );

  it('préserve une facture au plafond de 2048 octets lorsque le cadre suffit', () => {
    const value = `lnbcrt${'q'.repeat(2042)}`;
    const result = createCollectQr(value, 512);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const qr = result.qr;
    expect(jsQR(rasterize(qr), qr.size, qr.size)?.data).toBe(value);
  });

  it('conserve quatre modules blancs entiers tout autour du code', () => {
    const result = createCollectQr(invoice, 288);
    if (!result.ok) throw new Error(result.error);
    const qr = result.qr;
    expect(qr.quietZone).toBe(4);
    expect(qr.size).toBe((qr.moduleCount + 8) * qr.modulePixels);
    expect(qr.modules).toHaveLength(qr.moduleCount);
    const pixels = rasterize(qr);
    const margin = qr.quietZone * qr.modulePixels;
    let whiteMargin = true;
    for (let row = 0; row < qr.size; row += 1) {
      for (let column = 0; column < qr.size; column += 1) {
        if (
          row < margin ||
          row >= qr.size - margin ||
          column < margin ||
          column >= qr.size - margin
        ) {
          if (pixels[(row * qr.size + column) * 4] !== 255) whiteMargin = false;
        }
      }
    }
    expect(whiteMargin).toBe(true);
  });

  it.each([
    null,
    123,
    '',
    'lnbcrt',
    'lnbc1test',
    'lntb1test',
    `lightning:${invoice}`,
    `${invoice} `,
    `${invoice}\n`,
    `lnbcrtQ${'q'.repeat(320)}`,
    `lnbcrté${'q'.repeat(320)}`,
    `lnbcrt${'q'.repeat(2043)}`,
  ])('refuse une entrée hors contrat sans lever une exception', (value) => {
    expect(createCollectQr(value)).toEqual({ ok: false, error: 'INVALID_QR_VALUE' });
  });

  it.each([0, -1, 288.5, Number.NaN, Number.POSITIVE_INFINITY, 4097])(
    'refuse une dimension invalide %s',
    (size) => {
      expect(createCollectQr(invoice, size)).toEqual({ ok: false, error: 'INVALID_QR_SIZE' });
    },
  );

  it('refuse les modules inférieurs à deux pixels au lieu de réduire la lisibilité', () => {
    expect(createCollectQr(longInvoice, 160)).toEqual({
      ok: false,
      error: 'QR_SIZE_TOO_SMALL',
    });
  });

  it('rend seulement les carrés noirs, un fond blanc et le libellé accessible fourni', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    render(<CollectQr value={invoice} label="QR de la demande fictive" />);
    const image = screen.getByRole('image', { name: 'QR de la demande fictive' });
    const result = createCollectQr(invoice);
    if (!result.ok) throw new Error(result.error);
    expect(image).toHaveProp('width', result.qr.size);
    expect(image).toHaveProp('height', result.qr.size);
    expect(screen.UNSAFE_getAllByType(Rect)).toHaveLength(1);
    expect(screen.UNSAFE_getByType(Rect).props.fill).toBe('#FFFFFF');
    expect(screen.UNSAFE_getAllByType(Path)).toHaveLength(1);
    expect(screen.UNSAFE_getByType(Path).props.fill).toBe('#000000');
    expect(screen.UNSAFE_getByType(Path).props.d).toBe(result.qr.path);
  });

  it('expose le même libellé sur le web', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    render(<CollectQr value={invoice} label="QR fictif" />);
    expect(screen.UNSAFE_getByType(Svg).props.role).toBe('img');
    expect(screen.UNSAFE_getByType(Svg).props['aria-label']).toBe('QR fictif');
  });

  it('affiche le repli fourni et signale une erreur au lieu de faire planter l’écran', () => {
    const onError = jest.fn();
    render(
      <CollectQr
        value={longInvoice}
        label="QR fictif"
        maxSize={160}
        fallback={<Text>Copier la demande</Text>}
        onError={onError}
      />,
    );
    expect(screen.getByText('Copier la demande')).toBeVisible();
    expect(screen.UNSAFE_queryAllByType(Svg)).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith('QR_SIZE_TOO_SMALL');
  });

  it('tolère une exception du chargement du moteur à l’exécution', () => {
    jest.isolateModules(() => {
      jest.doMock('qrcode-generator', () => {
        throw new Error('module unavailable');
      });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const isolated = require('../src/collect/qr') as typeof import('../src/collect/qr');
      expect(isolated.createCollectQr(invoice)).toEqual({
        ok: false,
        error: 'QR_ENCODING_FAILED',
      });
    });
    jest.dontMock('qrcode-generator');
  });

  it('tolère une exception de l’encodeur sans exposer son message', () => {
    jest.isolateModules(() => {
      jest.doMock('qrcode-generator', () => () => ({
        addData: jest.fn(),
        make: () => {
          throw new Error(invoice);
        },
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const isolated = require('../src/collect/qr') as typeof import('../src/collect/qr');
      expect(isolated.createCollectQr(invoice)).toEqual({
        ok: false,
        error: 'QR_ENCODING_FAILED',
      });
    });
    jest.dontMock('qrcode-generator');
  });
});
