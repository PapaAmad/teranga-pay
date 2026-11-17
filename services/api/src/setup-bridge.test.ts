import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, it } from 'node:test';

const directories: string[] = [];
const script = fileURLToPath(new URL('./setup-bridge.ts', import.meta.url));
function directory() {
  const result = mkdtempSync(join(tmpdir(), 'teranga-bridge-setup-'));
  directories.push(result);
  return result;
}
function run(cwd: string) {
  return spawnSync(process.execPath, [script], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10_000,
  });
}
afterEach(() => {
  const allowed = resolve(tmpdir()) + sep;
  for (const item of directories.splice(0)) {
    const path = resolve(item);
    assert(
      path.startsWith(allowed) && path.slice(allowed.length).startsWith('teranga-bridge-setup-'),
    );
    rmSync(path, { recursive: true, force: true });
  }
});

it('bridge:setup crée une configuration de simulation sans imprimer son jeton', () => {
  const cwd = directory();
  const result = run(cwd);
  assert.equal(result.status, 0);
  const configuration = readFileSync(join(cwd, '.env.bridge-sim'), 'utf8');
  const token = /BRIDGE_SIM_TOKEN=([^\r\n]+)/.exec(configuration)?.[1];
  assert(token && /^[A-Za-z0-9_-]{43}$/.test(token));
  assert(configuration.includes('BRIDGE_SIM_ENABLED=true'));
  assert(!result.stdout.includes(token) && !result.stderr.includes(token));
});

it('bridge:setup existant reste un succès et préserve chaque octet sans imprimer le jeton', () => {
  const cwd = directory();
  const token = randomBytes(32).toString('base64url');
  const original = `BRIDGE_SIM_ENABLED=true\nBRIDGE_SIM_TOKEN=${token}\nBRIDGE_SIM_SCENARIO=unavailable\n`;
  const file = join(cwd, '.env.bridge-sim');
  writeFileSync(file, original, { mode: 0o600 });
  const result = run(cwd);
  assert.equal(result.status, 0);
  assert(
    readFileSync(file, 'utf8') === original,
    'Une configuration existante doit rester inchangée.',
  );
  assert(result.stdout.includes('conservé'));
  assert(!result.stdout.includes(token) && !result.stderr.includes(token));
});
