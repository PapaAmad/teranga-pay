import { readdir, mkdir, mkdtemp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}
const java = option('--java');
const cacheArgument = option('--gradle-cache');
if (!java || !cacheArgument) {
  throw new Error('Fournir --java <exécutable Java> et --gradle-cache <dossier Gradle existant>.');
}
const cache = path.resolve(cacheArgument);

// Dépendances épinglées du compilateur déjà utilisé par le build Android.
// Aucun téléchargement, aucune installation et aucune dépendance mobile ajoutée.
const artifacts = [
  'org.jetbrains.kotlin/kotlin-compiler-embeddable/2.2.21',
  'org.jetbrains.kotlin/kotlin-stdlib/2.2.21',
  'org.jetbrains.kotlin/kotlin-script-runtime/2.2.21',
  'org.jetbrains.kotlin/kotlin-reflect/1.6.10',
  'org.jetbrains.kotlin/kotlin-daemon-embeddable/2.2.21',
  'org.jetbrains.kotlinx/kotlinx-coroutines-core-jvm/1.8.0',
  'org.jetbrains/annotations/23.0.0',
];
async function artifactJar(artifact) {
  const directory = path.join(cache, 'caches/modules-2/files-2.1', artifact);
  for (const digest of await readdir(directory)) {
    for (const file of await readdir(path.join(directory, digest))) {
      if (file.endsWith('.jar')) return path.join(directory, digest, file);
    }
  }
  throw new Error('Compilateur Kotlin incomplet dans le cache existant.');
}
const jars = await Promise.all(artifacts.map(artifactJar));
const temporaryRoot = path.join(root, '.tmp/native-integration-tests');
await mkdir(temporaryRoot, { recursive: true });
const output = await mkdtemp(path.join(temporaryRoot, 'run-'));
function run(parameters) {
  const result = spawnSync(java, parameters, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw new Error('Exécutable Java indisponible.');
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run([
  '-cp',
  jars.join(path.delimiter),
  'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
  '-no-stdlib',
  '-no-reflect',
  '-classpath',
  jars[1],
  '-d',
  output,
  'apps/mobile/modules/teranga-wallet/android/src/main/java/expo/modules/terangawallet/IntegrationCipher.kt',
  'apps/mobile/modules/teranga-wallet/tests/IntegrationCipherTest.kt',
]);
run([
  '-cp',
  [output, jars[1]].join(path.delimiter),
  'expo.modules.terangawallet.IntegrationCipherTestKt',
]);
