import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { Writable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { parseMotionArgs, verifyMotionFonts, writeEncoderFrame } from './render-brand-motion.mjs';

const tools = [
  '--browser',
  'outil navigateur',
  '--puppeteer-module',
  'outil module.js',
  '--ffmpeg',
  'outil encodeur',
];

test('les outils de rendu conservent les espaces et le format vertical explicite', () => {
  const options = parseMotionArgs([...tools, '--format=portrait', '--output', 'dossier de sortie']);
  assert.equal(options.browser, path.resolve('outil navigateur'));
  assert.equal(options.puppeteerModule, path.resolve('outil module.js'));
  assert.equal(options.ffmpeg, path.resolve('outil encodeur'));
  assert.equal(options.output, path.resolve('dossier de sortie'));
  assert.equal(options.format, 'portrait');
});

test('les options ambiguës ou incomplètes échouent avant de charger les outils', () => {
  for (const args of [
    [],
    [...tools, '--format', 'carré'],
    [...tools, '--format'],
    [...tools, '--output='],
    [...tools, '--format', 'portrait', '--format', 'landscape'],
    [...tools, '--inconnu', 'valeur'],
  ]) {
    assert.throws(() => parseMotionArgs(args));
  }
});

test('l’aide est disponible sans Puppeteer, Chromium ni FFmpeg', () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./render-brand-motion.mjs', import.meta.url)), '--help'],
    { encoding: 'utf8', windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--format landscape\|portrait/u);
  assert.equal(result.stderr, '');
});

function fontPage(faces, load = async () => []) {
  const fonts = Object.assign(faces, { ready: Promise.resolve(), load, check: () => true });
  return {
    evaluate(callback) {
      return runInNewContext(`(${callback.toString()})()`, { document: { fonts } });
    },
  };
}

test('le repli disponible ne remplace pas une police de marque absente', async () => {
  // FontFaceSet.check peut accepter le repli alors qu’aucune face déclarée
  // ne correspond à la famille ; ce cas ne doit pas autoriser l’export.
  await assert.rejects(
    verifyMotionFonts(fontPage([{ family: 'Manrope', weight: '700', status: 'loaded' }])),
    /Polices de marque non chargées.*Noto Sans/u,
  );
});

test('une face en erreur ou un autre poids ne valide pas la police attendue', async () => {
  for (const body of [
    { family: 'Noto Sans', weight: '400', status: 'error' },
    { family: 'Noto Sans', weight: '600', status: 'loaded' },
  ]) {
    await assert.rejects(
      verifyMotionFonts(fontPage([{ family: 'Manrope', weight: '700', status: 'loaded' }, body])),
      /Polices de marque non chargées/u,
    );
  }
});

test('le contrôle attend le chargement effectif des deux familles utilisées par le motion', async () => {
  const faces = [
    { family: '"Manrope"', weight: '700', status: 'unloaded' },
    { family: "'Noto Sans'", weight: 'normal', status: 'unloaded' },
  ];
  const loaded = [];
  const fonts = await verifyMotionFonts(
    fontPage(faces, async (request, characters) => {
      await new Promise((resolve) => setImmediate(resolve));
      assert.match(characters, /À Ñ Ŋ ñ ŋ/u);
      const index = request.startsWith('700') ? 0 : 1;
      faces[index].status = 'loaded';
      loaded.push(request);
      return [faces[index]];
    }),
  );
  assert.deepEqual(loaded.sort(), ['400 16px "Noto Sans"', '700 16px "Manrope"']);
  assert.equal(fonts.length, 2);
  assert.ok(fonts.every((font) => font.status === 'loaded'));
});

test('le rejet d’un téléchargement reste un échec même si les autres polices sont prêtes', async () => {
  await assert.rejects(
    verifyMotionFonts(
      fontPage(
        [
          { family: 'Manrope', weight: '700', status: 'loaded' },
          { family: 'Noto Sans', weight: '400', status: 'unloaded' },
        ],
        async () => {
          throw new Error('Téléchargement refusé.');
        },
      ),
    ),
    /Polices de marque non chargées/u,
  );
});

async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Attente de drain bloquée plus d’une seconde.')),
          1000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function blockedInput(t) {
  const input = new Writable({
    highWaterMark: 1,
    // Sans callback, ce vrai Writable reste saturé et n’émet aucun drain.
    write() {},
  });
  input.on('error', () => {});
  t.after(() => input.destroy());
  return input;
}

const encoderFor = (stdin) => ({ stdin, exitCode: null, signalCode: null });
const listenerCounts = (input) =>
  ['drain', 'close', 'finish', 'error'].map((name) => input.listenerCount(name));

test('un flux fermé pendant la capture échoue au lieu d’attendre un drain impossible', async (t) => {
  const input = blockedInput(t);
  input.destroy();
  await once(input, 'close');
  const listeners = listenerCounts(input);
  await assert.rejects(
    bounded(writeEncoderFrame(encoderFor(input), Promise.resolve(), Buffer.from('image'))),
    /fermé avant la fin des images/u,
  );
  assert.deepEqual(listenerCounts(input), listeners);
});

test('la fermeture sans drain interrompt l’attente même si le processus ne termine pas', async (t) => {
  const input = blockedInput(t);
  const listeners = listenerCounts(input);
  const writing = writeEncoderFrame(encoderFor(input), new Promise(() => {}), Buffer.from('image'));
  setImmediate(() => input.destroy());
  await assert.rejects(bounded(writing), /fermé avant la fin des images/u);
  assert.deepEqual(listenerCounts(input), listeners);
});

test('le rejet de l’encodeur interrompt la backpressure et nettoie ses écouteurs', async (t) => {
  const input = blockedInput(t);
  const listeners = listenerCounts(input);
  let fail;
  const encoded = new Promise((_, reject) => {
    fail = reject;
  });
  const writing = writeEncoderFrame(encoderFor(input), encoded, Buffer.from('image'));
  setImmediate(() => fail(new Error('Encodeur arrêté pendant l’écriture.')));
  await assert.rejects(bounded(writing), /Encodeur arrêté pendant l’écriture/u);
  assert.deepEqual(listenerCounts(input), listeners);
});

test('une fin réussie prématurée de l’encodeur reste une erreur de rendu', async (t) => {
  const input = blockedInput(t);
  const listeners = listenerCounts(input);
  let complete;
  const encoded = new Promise((resolve) => {
    complete = resolve;
  });
  const writing = writeEncoderFrame(encoderFor(input), encoded, Buffer.from('image'));
  setImmediate(() => complete());
  await assert.rejects(bounded(writing), /terminé avant la fin des images/u);
  assert.deepEqual(listenerCounts(input), listeners);
});

test('un vrai drain laisse continuer l’écriture sans conserver les écouteurs temporaires', async (t) => {
  let completeWrite;
  const input = new Writable({
    highWaterMark: 1,
    write(_chunk, _encoding, callback) {
      completeWrite = callback;
    },
  });
  t.after(() => input.destroy());
  const listeners = listenerCounts(input);
  const writing = writeEncoderFrame(encoderFor(input), new Promise(() => {}), Buffer.from('image'));
  setImmediate(() => completeWrite());
  await bounded(writing);
  assert.deepEqual(listenerCounts(input), listeners);
});
