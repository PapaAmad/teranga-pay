const textPairs = [
  ['ink', 'canvas'],
  ['ink', 'surface'],
  ['muted', 'surface'],
  ['muted', 'canvas'],
  ['ink', 'selectionSurface'],
  ['onPrimary', 'primary'],
  ['onPrimary', 'primaryPressed'],
  ['onAccent', 'accent'],
  ['success', 'successSurface'],
  ['warning', 'warningSurface'],
  ['error', 'errorSurface'],
  ['disabledInk', 'disabledSurface'],
];

const graphicPairs = ['outline', 'focus', 'error'].flatMap((foreground) =>
  ['surface', 'canvas'].map((background) => [foreground, background]),
);

export const contrastPairs = Object.freeze(
  [
    ...textPairs.map(([foreground, background]) => ({
      kind: 'text',
      foreground,
      background,
      minimum: 4.5,
    })),
    ...graphicPairs.map(([foreground, background]) => ({
      kind: 'graphic',
      foreground,
      background,
      minimum: 3,
    })),
  ].map(Object.freeze),
);

export function relativeLuminance(hex) {
  if (typeof hex !== 'string' || !/^#[\da-f]{6}$/iu.test(hex)) {
    throw new TypeError('Une couleur sRGB opaque au format #RRGGBB est nécessaire.');
  }
  const [r, g, b] = hex
    .slice(1)
    .match(/../gu)
    .map((channel) => parseInt(channel, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function buildContrastReport(tokens) {
  if (
    typeof tokens?.version !== 'string' ||
    typeof tokens.direction !== 'string' ||
    !tokens.colors ||
    typeof tokens.colors !== 'object'
  ) {
    throw new TypeError('Les tokens doivent préciser version, direction et couleurs.');
  }
  return {
    method: 'WCAG 2.2 | luminance relative sRGB | aplats opaques | ratios non arrondis',
    source: 'assets/brand/tokens.json',
    tokensVersion: tokens.version,
    direction: tokens.direction,
    pairs: contrastPairs.map(({ kind, foreground, background, minimum }) => {
      const foregroundColor = tokens.colors[foreground];
      const backgroundColor = tokens.colors[background];
      const ratio = contrastRatio(foregroundColor, backgroundColor);
      return {
        kind,
        foreground,
        background,
        foregroundColor,
        backgroundColor,
        ratio,
        minimum,
        passes: ratio >= minimum,
      };
    }),
  };
}
