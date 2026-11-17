import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isMain } from './github/lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

function options(args) {
  const values = { output: path.join(root, 'assets/brand/exports') };
  if (args.length === 1 && args[0] === '--help') return null;
  const names = new Map([
    ['--browser', 'browser'],
    ['--puppeteer-module', 'puppeteer'],
    ['--output', 'output'],
    ['--source', 'source'],
  ]);
  for (let index = 0; index < args.length; index += 2) {
    const name = names.get(args[index]);
    const value = args[index + 1];
    if (!name || !value || value.startsWith('--')) {
      throw new Error(`Option inconnue ou valeur manquante : ${args[index]}.`);
    }
    values[name] = path.resolve(value);
  }
  if (!values.browser || !values.puppeteer) {
    throw new Error('Fournir --browser et --puppeteer-module. Voir --help.');
  }
  return values;
}

export async function renderBrandDocument(settings) {
  const puppeteer = (await import(pathToFileURL(settings.puppeteer).href)).default;
  const source = settings.source ?? path.join(root, 'assets/brand/exploration.html');
  await mkdir(settings.output, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: settings.browser,
    headless: true,
    args: ['--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) =>
      errors.push(`Ressource indisponible : ${request.resourceType()}.`),
    );
    await page.setViewport({ width: 1500, height: 1100, deviceScaleFactor: 1.5 });
    await page.goto(pathToFileURL(source).href, { waitUntil: 'networkidle0' });
    await page.evaluate(() => globalThis.document.fonts.ready);
    const fonts = await page.evaluate(async () => {
      const expected = [
        { family: 'Noto', weight: '400' },
        { family: 'Noto', weight: '600' },
        { family: 'Manrope', weight: '700' },
      ];
      await Promise.allSettled(
        expected.map(({ family, weight }) =>
          globalThis.document.fonts.load(`${weight} 16px "${family}"`, 'Teranga Pay À Ñ Ŋ ñ ŋ'),
        ),
      );
      const faces = [...globalThis.document.fonts].map((face) => ({
        family: face.family.replaceAll('"', '').replaceAll("'", ''),
        weight: face.weight === 'normal' ? '400' : face.weight,
        status: face.status,
      }));
      const missing = expected.filter(
        ({ family, weight }) =>
          !faces.some(
            (face) => face.family === family && face.weight === weight && face.status === 'loaded',
          ),
      );
      if (missing.length) {
        throw new Error(`Polices de marque non chargées : ${JSON.stringify(missing)}`);
      }
      return faces;
    });
    if (errors.length) throw new Error(errors.join(' | '));
    await page.addStyleTag({ content: '.toolbar{display:none !important}' });
    for (const [id, name] of [
      ['cover', 'couverture.png'],
      ['directions', 'planche.png'],
      ['icons', 'icones.png'],
      ['components', 'composants.png'],
    ]) {
      const section = await page.$(`#${id}`);
      if (!section) throw new Error(`Section manquante : ${id}.`);
      await section.screenshot({ path: path.join(settings.output, name) });
    }
    await page.click('#demo-button');
    const feedback = await page.$eval('#demo-result', (element) => element.textContent);
    if (!feedback.includes('Aucun paiement n’a été lancé')) {
      throw new Error('Le bouton documentaire ne donne pas le retour attendu.');
    }
    await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 1 });
    await page.emulateMediaType('print');
    const pages = await page.evaluate(() =>
      [...globalThis.document.querySelectorAll('.spread')].map((section) => ({
        id: section.id,
        overflow: [...section.children]
          .filter((element) => element.tagName !== 'FOOTER')
          .some(
            (element) =>
              element.getBoundingClientRect().bottom > section.getBoundingClientRect().bottom - 48,
          ),
      })),
    );
    if (!pages.length || pages.some((section) => section.overflow)) {
      throw new Error(`Vérifier la composition imprimée : ${JSON.stringify(pages)}`);
    }
    await page.pdf({
      path: path.join(settings.output, 'charte.pdf'),
      landscape: true,
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      tagged: true,
    });
    await page.emulateMediaType('screen');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    const narrow = await page.evaluate(() => ({
      width: globalThis.innerWidth,
      contentWidth: globalThis.document.documentElement.scrollWidth,
    }));
    if (narrow.contentWidth > narrow.width) throw new Error('Débordement documentaire à 390 px.');
    if (errors.length) throw new Error(errors.join(' | '));
    const report = {
      documentSha256: createHash('sha256')
        .update(await readFile(source))
        .digest('hex'),
      fonts,
      pages,
      narrow,
      feedback,
      browserErrors: errors,
      scope: 'Rendu documentaire uniquement, sans essai Android ni validation utilisateur.',
    };
    await writeFile(
      path.join(settings.output, 'validation.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    return report;
  } finally {
    await browser.close();
  }
}

if (isMain(import.meta.url)) {
  try {
    const settings = options(process.argv.slice(2));
    if (!settings) {
      console.info(
        'node scripts/render-brand-document.mjs --browser chemin/Chromium --puppeteer-module chemin/puppeteer.js [--output dossier] [--source document.html]',
      );
      console.info('Outils externes de développement ; aucune dépendance mobile ajoutée.');
    } else {
      const report = await renderBrandDocument(settings);
      console.info(
        `${report.pages.length} pages rendues ; contrôle étroit ${report.narrow.width} px réussi.`,
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
