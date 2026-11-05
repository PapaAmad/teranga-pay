import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildContrastReport } from './brand-colors.mjs';
import { isMain } from './github/lib.mjs';

const brandDirectory = new URL('../assets/brand/', import.meta.url);

export function exportBrandContrast(directory = brandDirectory) {
  const tokens = JSON.parse(readFileSync(new URL('tokens.json', directory), 'utf8'));
  const report = buildContrastReport(tokens);
  writeFileSync(new URL('contrast.json', directory), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (isMain(import.meta.url)) {
  const report = exportBrandContrast();
  const failures = report.pairs.filter((pair) => !pair.passes);
  console.info(
    `${report.pairs.length} couples exportés dans ${fileURLToPath(new URL('contrast.json', brandDirectory))}`,
  );
  if (failures.length) {
    console.error(
      failures
        .map((pair) => `${pair.foreground}/${pair.background} : ${pair.ratio} < ${pair.minimum}`)
        .join('\n'),
    );
    process.exitCode = 1;
  }
}
