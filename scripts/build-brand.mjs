import { exportBrandContrast } from './export-brand-contrast.mjs';
import { exportBrandIcons } from './export-brand-icons.mjs';
import { isMain } from './github/lib.mjs';

if (isMain(import.meta.url)) {
  const icons = exportBrandIcons();
  const report = exportBrandContrast();
  const failures = report.pairs.filter((pair) => !pair.passes);
  if (failures.length) {
    console.error(`${failures.length} couples de couleurs doivent être corrigés.`);
    process.exitCode = 1;
  } else {
    console.info(`${icons} icônes et ${report.pairs.length} couples de contraste régénérés.`);
  }
}
