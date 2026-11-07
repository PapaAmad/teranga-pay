/* global document, window, Image, XMLSerializer */
// Les fonctions passées à page.evaluate s’exécutent dans Chromium.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMain } from './github/lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceFolder = path.join(root, 'assets/brand/motion');
const usage =
  'node scripts/render-brand-motion.mjs --browser chemin --puppeteer-module chemin --ffmpeg chemin [--format landscape|portrait] [--output dossier]';

export function parseMotionArgs(args) {
  if (args.length === 1 && args[0] === '--help') return null;
  const allowed = new Set(['browser', 'puppeteer-module', 'ffmpeg', 'format', 'output']);
  const values = new Map();
  for (let index = 0; index < args.length; index++) {
    const match = args[index].match(/^--([^=]+)(?:=(.*))?$/u);
    if (!match || !allowed.has(match[1])) throw new Error(`Option inconnue : ${args[index]}`);
    const [, name, inline] = match;
    const value = inline ?? args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Valeur manquante : --${name}`);
    if (values.has(name)) throw new Error(`Option répétée : --${name}`);
    values.set(name, value);
  }
  const format = values.get('format') ?? 'landscape';
  if (!['landscape', 'portrait'].includes(format))
    throw new Error('Le format doit être landscape ou portrait.');
  for (const name of ['browser', 'puppeteer-module', 'ffmpeg']) {
    if (!values.has(name)) throw new Error(`Chemin requis : --${name}`);
  }
  return {
    browser: path.resolve(values.get('browser')),
    puppeteerModule: path.resolve(values.get('puppeteer-module')),
    ffmpeg: path.resolve(values.get('ffmpeg')),
    format,
    output: path.resolve(values.get('output') ?? sourceFolder),
  };
}

function assertEncoderWritable(encoder) {
  const input = encoder.stdin;
  if (
    encoder.exitCode !== null ||
    encoder.signalCode !== null ||
    input.destroyed ||
    input.closed ||
    input.writableEnded ||
    input.writableFinished ||
    !input.writable
  ) {
    throw new Error('Le flux de l’encodeur est fermé avant la fin des images.');
  }
}

export async function writeEncoderFrame(encoder, encoded, buffer) {
  // La capture est asynchrone : le processus peut s’être fermé depuis
  // la vérification faite au début de la boucle de rendu.
  assertEncoderWritable(encoder);
  const input = encoder.stdin;
  const abort = new AbortController();
  const signal = abort.signal;
  const drained = once(input, 'drain', { signal });
  const closed = once(input, 'close', { signal }).then(() => {
    throw new Error('Le flux de l’encodeur s’est fermé avant la fin des images.');
  });
  const finished = once(input, 'finish', { signal }).then(() => {
    throw new Error('Le flux de l’encodeur s’est terminé avant la fin des images.');
  });
  const terminated = encoded.then(() => {
    throw new Error('L’encodeur s’est terminé avant la fin des images.');
  });
  const waiting = [drained, closed, finished, terminated];
  // Une écriture sans backpressure n’attend pas ces promesses ; leur
  // annulation dans finally reste prise en charge sans rejet orphelin.
  for (const pending of waiting) pending.catch(() => {});
  try {
    if (!input.write(buffer)) {
      assertEncoderWritable(encoder);
      await Promise.race(waiting);
      assertEncoderWritable(encoder);
    }
  } finally {
    abort.abort();
  }
}

export async function verifyMotionFonts(page) {
  return page.evaluate(async () => {
    const expected = [
      { family: 'Manrope', weight: '700' },
      { family: 'Noto Sans', weight: '400' },
    ];
    await document.fonts.ready;
    await Promise.allSettled(
      expected.map(({ family, weight }) =>
        document.fonts.load(`${weight} 16px "${family}"`, 'Teranga Pay À Ñ Ŋ ñ ŋ'),
      ),
    );
    const faces = [...document.fonts].map((face) => ({
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
}

async function compareMark(page, source) {
  return page.evaluate(async ({ viewBox, path: sourcePath }) => {
    const symbol = document.querySelector('.symbol').cloneNode(true);
    symbol.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    symbol.setAttribute('width', '640');
    symbol.setAttribute('height', '640');
    symbol.removeAttribute('class');
    const original = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="640" height="640"><path fill="#E5EE73" d="${sourcePath}"/></svg>`;
    async function pixels(svg) {
      const image = new Image();
      image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 640;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, 640, 640).data;
    }
    const [expected, actual] = await Promise.all([
      pixels(original),
      pixels(new XMLSerializer().serializeToString(symbol)),
    ]);
    let differingChannels = 0;
    for (let index = 0; index < expected.length; index++) {
      if (expected[index] !== actual[index]) differingChannels++;
    }
    return differingChannels;
  }, source);
}

export async function renderBrandMotion(options) {
  for (const [name, file] of [
    ['Chromium', options.browser],
    ['Puppeteer', options.puppeteerModule],
    ['FFmpeg', options.ffmpeg],
  ]) {
    if (!fs.statSync(file).isFile()) throw new Error(`${name} doit désigner un fichier.`);
  }
  const imported = await import(pathToFileURL(options.puppeteerModule).href);
  const puppeteer = imported.default ?? imported;
  if (typeof puppeteer.launch !== 'function')
    throw new Error('Le module fourni ne permet pas de lancer Puppeteer.');
  const portrait = options.format === 'portrait';
  const width = portrait ? 1080 : 1920;
  const height = portrait ? 1920 : 1080;
  const videoName = portrait ? 'intro-teranga-pay-vertical.mp4' : 'intro-teranga-pay.mp4';
  const posterName = portrait ? 'poster-vertical.png' : 'poster.png';
  const video = path.join(options.output, videoName);
  fs.mkdirSync(options.output, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: options.browser,
    headless: true,
    args: ['--disable-gpu'],
  });
  let encoder;
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) =>
      errors.push(`Ressource indisponible : ${request.resourceType()}.`),
    );
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const address = new URL(pathToFileURL(path.join(sourceFolder, 'motion.html')));
    address.searchParams.set('format', options.format);
    const renderAddress = new URL(address);
    renderAddress.searchParams.set('render', '1');
    await page.goto(renderAddress.href, { waitUntil: 'networkidle0' });
    const fonts = await verifyMotionFonts(page);
    if (errors.length) throw new Error(errors.join(' | '));
    const setup = await page.evaluate(() => ({
      width: window.brandMotion.width,
      height: window.brandMotion.height,
      duration: window.brandMotion.duration,
    }));
    if (setup.width !== width || setup.height !== height || setup.duration !== 6.5) {
      throw new Error('Dimensions ou durée du document inattendues.');
    }
    await page.evaluate(() => window.brandMotion.seek(4.5));
    const differingChannels = await compareMark(
      page,
      JSON.parse(fs.readFileSync(path.join(sourceFolder, '../logos/mark.json'), 'utf8')),
    );
    if (differingChannels)
      throw new Error(`Le tracé final diffère du symbole source : ${differingChannels} canaux.`);
    const margins = await page.evaluate(() => {
      const stage = document.getElementById('stage').getBoundingClientRect();
      const boxes = ['name', 'signature'].map((id) => {
        const range = document.createRange();
        range.selectNodeContents(document.getElementById(id));
        return range.getBoundingClientRect();
      });
      boxes.push(document.querySelector('.symbol').getBoundingClientRect());
      return boxes.map((box) => ({
        left: box.left - stage.left,
        right: stage.right - box.right,
        top: box.top - stage.top,
        bottom: stage.bottom - box.bottom,
      }));
    });
    const minimum = portrait ? 96 : 48;
    if (margins.some((box) => Object.values(box).some((value) => value < minimum)))
      throw new Error('Le symbole ou un texte dépasse les marges sûres.');
    await page.screenshot({
      path: path.join(options.output, posterName),
      type: 'png',
      captureBeyondViewport: false,
    });

    encoder = spawn(
      options.ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'warning',
        '-f',
        'image2pipe',
        '-framerate',
        '30',
        '-i',
        'pipe:0',
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-map_metadata',
        '-1',
        '-an',
        '-r',
        '30',
        '-t',
        '6.5',
        '-y',
        video,
      ],
      { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] },
    );
    let encoderLog = '';
    encoder.stderr.setEncoding('utf8').on('data', (chunk) => {
      encoderLog += chunk;
    });
    encoder.stdin.on('error', () => {});
    const encoded = new Promise((resolve, reject) => {
      encoder.once('error', reject);
      encoder.once('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Encodage refusé : ${code} ${encoderLog.slice(-1000)}`)),
      );
    });
    encoded.catch(() => {});
    for (let frame = 0; frame < 195; frame++) {
      if (encoder.exitCode !== null)
        throw new Error('L’encodeur s’est arrêté avant la fin des images.');
      await page.evaluate((time) => window.brandMotion.seek(time), frame / 30);
      const buffer = await page.screenshot({ type: 'png', captureBeyondViewport: false });
      await writeEncoderFrame(encoder, encoded, buffer);
      if (frame % 30 === 0) console.info(`Rendu ${options.format} : image ${frame + 1}/195`);
    }
    encoder.stdin.end();
    await encoded;
    const decoded = spawnSync(
      options.ffmpeg,
      ['-hide_banner', '-i', video, '-map', '0:v:0', '-f', 'null', '-'],
      { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    );
    const metadata = decoded.stderr ?? '';
    if (
      decoded.status !== 0 ||
      !/Duration: 00:00:06\.50/u.test(metadata) ||
      !/Video: h264/u.test(metadata) ||
      !/yuv420p/u.test(metadata) ||
      !metadata.includes(`${width}x${height}`) ||
      !/30 fps/u.test(metadata) ||
      /Audio:/u.test(metadata) ||
      !/frame=\s*195\b/u.test(metadata)
    ) {
      throw new Error('Le décodage ne confirme pas les 195 images H.264 yuv420p attendues.');
    }

    await page.goto(address.href, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await page.click('#play-pause');
    const paused = await page.$eval('#timeline', (element) => element.value);
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (paused !== (await page.$eval('#timeline', (element) => element.value)))
      throw new Error('La pause ne fige pas le temps.');
    await page.click('#replay');
    if ((await page.$eval('#play-pause', (element) => element.textContent)) !== 'Mettre en pause')
      throw new Error('Rejouer ne reprend pas la lecture.');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.reload({ waitUntil: 'networkidle0' });
    const reduced = await page.evaluate(() => ({
      time: document.getElementById('timeline').value,
      disabled: document.getElementById('play-pause').disabled,
    }));
    if (reduced.time !== '6.5' || !reduced.disabled)
      throw new Error('La préférence de mouvement réduit n’est pas respectée.');
    if (errors.length) throw new Error(errors.join(' | '));
    const proof = {
      format: options.format,
      width,
      height,
      fps: 30,
      frames: 195,
      duration: 6.5,
      codec: 'H.264',
      pixelFormat: 'yuv420p',
      audio: false,
      differingChannels,
      fonts,
      margins,
      reduced,
      errors,
      videoBytes: fs.statSync(video).size,
    };
    const proofFolder = path.join(root, '.tmp');
    fs.mkdirSync(proofFolder, { recursive: true });
    fs.writeFileSync(
      path.join(proofFolder, `t08-motion-proof-${options.format}.json`),
      JSON.stringify(proof, null, 2) + '\n',
    );
    console.info(JSON.stringify(proof, null, 2));
    return proof;
  } finally {
    if (encoder && encoder.exitCode === null) encoder.kill();
    await browser.close();
  }
}

if (isMain(import.meta.url)) {
  try {
    const options = parseMotionArgs(process.argv.slice(2));
    if (options) await renderBrandMotion(options);
    else console.info(usage);
  } catch (error) {
    console.error(error.message);
    console.error(usage);
    process.exitCode = 1;
  }
}
