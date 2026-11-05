import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { Writable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseMotionArgs, writeEncoderFrame } from './render-brand-motion.mjs';

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
