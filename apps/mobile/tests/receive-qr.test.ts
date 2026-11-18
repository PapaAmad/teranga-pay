import { render, screen } from '@testing-library/react-native';
import jsQR from 'jsqr';
import { createElement } from 'react';
import { Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { ReceiveQr } from '../src/receive/ReceiveQr';
import { createReceiveQr, type ReceiveQrData } from '../src/receive/qr';

/** Rasterise les carrés du chemin réellement transmis à SVG, indépendamment de la matrice. */
function rasterize(qr: ReceiveQrData) {
  const pixels = new Uint8ClampedArray(qr.size * qr.size * 4).fill(255);
  const commands = qr.path.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-(\d+)z/g);
  let consumed = '';
  for (const command of commands) {
    consumed += command[0];
    const [, xText, yText, widthText, heightText, backText] = command;
    const x = Number(xText);
    const y = Number(yText);
    const width = Number(widthText);
    const height = Number(heightText);
    expect(width).toBe(Number(backText));
    expect(width).toBe(qr.modulePixels);
    expect(height).toBe(qr.modulePixels);
    expect(x).toBeGreaterThanOrEqual(qr.quietZone * width);
    expect(y).toBeGreaterThanOrEqual(qr.quietZone * height);
    expect(x + width).toBeLessThanOrEqual(qr.size - qr.quietZone * width);
    expect(y + height).toBeLessThanOrEqual(qr.size - qr.quietZone * height);
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

describe('QR de réception T18', () => {
  it.each([
    'exemple@teranga.example',
    'EXEMPLE@TERANGA.EXAMPLE',
    `${'a'.repeat(238)}@teranga.example`,
  ])('un décodeur indépendant retrouve exactement les octets de %s', (address) => {
    const qr = createReceiveQr(address, 512);
    expect(qr.modulePixels).toBeGreaterThanOrEqual(4);
    const decoded = jsQR(rasterize(qr), qr.size, qr.size, { inversionAttempts: 'dontInvert' });
    expect(decoded?.data).toBe(address);
    expect(decoded?.binaryData).toEqual(Array.from(address, (letter) => letter.charCodeAt(0)));
    expect(decoded?.data.startsWith('lightning:')).toBe(false);
  });

  it.each([239, 240, 320, 511])(
    'les carrés et la taille restent entiers dans %i pixels',
    (maxSize) => {
      const qr = createReceiveQr('exemple@teranga.example', maxSize);
      expect(qr.moduleCount % 4).toBe(1);
      expect(qr.quietZone).toBe(4);
      expect(Number.isInteger(qr.modulePixels)).toBe(true);
      expect(qr.size).toBe((qr.moduleCount + 8) * qr.modulePixels);
      expect(qr.size).toBeLessThanOrEqual(maxSize);
      expect(qr.modules).toHaveLength(qr.moduleCount);
      for (const row of qr.modules) expect(row).toHaveLength(qr.moduleCount);
      const pixels = rasterize(qr);
      const margin = 4 * qr.modulePixels;
      let marginIsWhite = true;
      for (let row = 0; row < qr.size; row += 1) {
        for (let column = 0; column < qr.size; column += 1) {
          if (
            row < margin ||
            row >= qr.size - margin ||
            column < margin ||
            column >= qr.size - margin
          ) {
            if (pixels[(row * qr.size + column) * 4] !== 255) marginIsWhite = false;
          }
        }
      }
      expect(marginIsWhite).toBe(true);
    },
  );

  it.each([
    '',
    ' ',
    'exemple @teranga.example',
    'é@teranga.example',
    'a\n@b.example',
    'a\u007f@b.example',
    'a'.repeat(255),
  ])('refuse une entrée hors du contrat ASCII borné', (value) =>
    expect(() => createReceiveQr(value)).toThrow('INVALID_QR_VALUE'),
  );

  it('refuse aussi une donnée externe non textuelle', () => {
    expect(() => createReceiveQr(null as unknown as string)).toThrow('INVALID_QR_VALUE');
  });

  it.each([0, -1, 240.5, Number.NaN, Number.POSITIVE_INFINITY, 4097])(
    'refuse la dimension %s',
    (size) => {
      expect(() => createReceiveQr('exemple@teranga.example', size)).toThrow('INVALID_QR_SIZE');
    },
  );

  it('refuse un cadre trop petit plutôt que produire des modules fractionnaires ou vides', () => {
    expect(() => createReceiveQr('exemple@teranga.example', 20)).toThrow('QR_SIZE_TOO_SMALL');
  });

  it('rend seulement un fond blanc et les modules noirs, avec le libellé accessible fourni', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const label = 'Adresse de réception de démonstration';
    render(createElement(ReceiveQr, { value: 'exemple@teranga.example', label }));
    const image = screen.getByRole('image', { name: label });
    const qr = createReceiveQr('exemple@teranga.example');
    expect(image).toHaveProp('width', qr.size);
    expect(image).toHaveProp('height', qr.size);
    expect(screen.UNSAFE_getAllByType(Rect)).toHaveLength(1);
    expect(screen.UNSAFE_getByType(Rect).props.fill).toBe('#FFFFFF');
    expect(screen.UNSAFE_getAllByType(Path)).toHaveLength(1);
    expect(screen.UNSAFE_getByType(Path).props.fill).toBe('#000000');
    expect(screen.UNSAFE_getByType(Path).props.d).toBe(qr.path);
  });

  it('expose la même image et son libellé sur le web', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    render(
      createElement(ReceiveQr, { value: 'exemple@teranga.example', label: 'Adresse de test' }),
    );
    expect(screen.UNSAFE_getByType(Svg).props.role).toBe('img');
    expect(screen.UNSAFE_getByType(Svg).props['aria-label']).toBe('Adresse de test');
  });
});
