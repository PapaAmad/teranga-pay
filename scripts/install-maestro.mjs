import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, lstat, mkdir, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const MAESTRO_VERSION = '2.12.1';
export const MAESTRO_SHA256 = '54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7';
export const MAESTRO_URL =
  'https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.12.1/maestro.zip';
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failure = (code) => Object.assign(new Error(code), { code });

export function validateInstallPath(root, target) {
  if (typeof root !== 'string' || !root || typeof target !== 'string' || !target)
    throw failure('MAESTRO_PATH_UNSAFE');
  const resolved = path.resolve(target);
  const relative = path.relative(path.resolve(root), resolved);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw failure('MAESTRO_PATH_UNSAFE');
  return resolved;
}

export function maestroExecutable(root = workspaceRoot, platform = process.platform) {
  return validateInstallPath(
    root,
    path.resolve(
      root,
      '.tmp/tooling/maestro',
      MAESTRO_VERSION,
      'maestro/bin',
      platform === 'win32' ? 'maestro.bat' : 'maestro',
    ),
  );
}

function locations(root) {
  const directory = validateInstallPath(
    root,
    path.resolve(root, '.tmp/tooling/maestro', MAESTRO_VERSION),
  );
  return { directory, archive: validateInstallPath(root, path.join(directory, 'maestro.zip')) };
}

/** Refuser aussi les liens/jonctions qui feraient sortir une écriture du workspace. */
async function safePath(root, target) {
  const destination = validateInstallPath(root, target);
  const canonicalRoot = await realpath(root);
  let current = path.resolve(root);
  for (const component of path.relative(current, destination).split(path.sep)) {
    current = path.join(current, component);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw failure('MAESTRO_PATH_UNSAFE');
    }
    if (info.isSymbolicLink()) throw failure('MAESTRO_PATH_UNSAFE');
    validateInstallPath(canonicalRoot, await realpath(current));
  }
  return destination;
}

async function digestFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

/** expectedSha256 est injectable pour les petits fixtures ; le CLI garde toujours le verrou officiel. */
export async function downloadVerifiedArchive({
  root = workspaceRoot,
  fetchImpl = globalThis.fetch,
  expectedSha256 = MAESTRO_SHA256,
  timeoutMs = 600_000,
  maxBytes = 512 * 1024 * 1024,
} = {}) {
  if (
    !/^[a-f0-9]{64}$/.test(expectedSha256) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1
  )
    throw failure('MAESTRO_INVALID_ARGUMENT');
  const { directory, archive } = locations(root);
  await safePath(root, archive);
  await mkdir(directory, { recursive: true });
  try {
    if ((await digestFile(archive)) === expectedSha256)
      return { archive, directory, sha256: expectedSha256, reused: true };
  } catch (error) {
    if (error.code !== 'ENOENT') throw failure('MAESTRO_CACHE_UNREADABLE');
  }
  const temporary = validateInstallPath(root, path.join(directory, `maestro-${randomUUID()}.part`));
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(MAESTRO_URL, { redirect: 'follow', signal });
    } catch {
      throw failure('MAESTRO_DOWNLOAD_FAILED');
    }
    if (!response.ok || !response.body) throw failure('MAESTRO_DOWNLOAD_FAILED');
    const declared = response.headers?.get('content-length');
    if (declared && Number(declared) > maxBytes) throw failure('MAESTRO_ARCHIVE_TOO_LARGE');
    const hash = createHash('sha256');
    let bytes = 0;
    const hashing = new Transform({
      transform(chunk, _encoding, done) {
        bytes += chunk.length;
        if (bytes > maxBytes) return done(failure('MAESTRO_ARCHIVE_TOO_LARGE'));
        hash.update(chunk);
        done(null, chunk);
      },
    });
    try {
      await pipeline(
        Readable.fromWeb(response.body),
        hashing,
        createWriteStream(temporary, { flags: 'wx' }),
        { signal },
      );
    } catch (error) {
      if (error.code === 'MAESTRO_ARCHIVE_TOO_LARGE') throw error;
      throw failure('MAESTRO_DOWNLOAD_FAILED');
    }
    const sha256 = hash.digest('hex');
    if (sha256 !== expectedSha256) throw failure('MAESTRO_INTEGRITY_MISMATCH');
    await safePath(root, archive);
    await rename(temporary, archive);
    return { archive, directory, sha256, reused: false };
  } finally {
    // Uniquement notre fichier temporaire aléatoire, jamais un dossier récursif.
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: 'ignore' });
    child.once('error', () => reject(failure('MAESTRO_EXTRACT_FAILED')));
    child.once('close', (code) =>
      code === 0 ? resolve() : reject(failure('MAESTRO_EXTRACT_FAILED')),
    );
  });
}

async function extractArchive({ archive, directory, platform }) {
  if (platform === 'win32') {
    const literal = (value) => `'${value.replaceAll("'", "''")}'`;
    await run('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath ${literal(archive)} -DestinationPath ${literal(directory)} -Force`,
    ]);
  } else {
    await run('unzip', ['-o', archive, '-d', directory]);
  }
}

export async function installMaestro({
  root = workspaceRoot,
  platform = process.platform,
  extractImpl = extractArchive,
  ...downloadOptions
} = {}) {
  const result = await downloadVerifiedArchive({ ...downloadOptions, root });
  const executable = maestroExecutable(root, platform);
  await safePath(root, executable);
  try {
    await extractImpl({ ...result, platform });
  } catch {
    throw failure('MAESTRO_EXTRACT_FAILED');
  }
  await safePath(root, executable);
  let info;
  try {
    info = await lstat(executable);
  } catch {
    throw failure('MAESTRO_EXECUTABLE_MISSING');
  }
  if (!info.isFile()) throw failure('MAESTRO_EXECUTABLE_MISSING');
  if (platform !== 'win32') await chmod(executable, 0o755);
  return { ...result, executable, version: MAESTRO_VERSION };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) {
    console.info(
      'Usage : npm run e2e:install | archive Maestro verrouillée, outils dans .tmp/tooling.',
    );
    if (!process.argv.slice(2).every((arg) => arg === '--help')) process.exitCode = 1;
  } else {
    installMaestro()
      .then((result) => {
        console.info(
          `Maestro ${result.version} extrait | SHA256 de l’archive vérifié | ${path.relative(workspaceRoot, result.executable)}`,
        );
      })
      .catch((error) => {
        console.error(error.code ?? 'MAESTRO_INSTALL_FAILED');
        process.exitCode = 1;
      });
  }
}
