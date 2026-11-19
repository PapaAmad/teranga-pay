import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const plugin = require('../apps/mobile/plugins/with-windows-native.cjs');
const { applyWindowsNativeGradle } = plugin;
const original = `buildscript {
  dependencies { classpath('com.android.tools.build:gradle') }
}
subprojects {
  plugins.withId('com.android.library') {
    android.defaultConfig.externalNativeBuild.cmake.arguments('-DKEEP=ON', '-DCMAKE_CXX_FLAGS=-fexceptions -DKEEP_CPP=1')
  }
}
apply plugin: 'expo-root-project'
`;

test('Windows ajoute les trois remèdes sans remplacer les réglages Gradle et arguments existants', () => {
  const result = applyWindowsNativeGradle(original, 'win32');
  assert.ok(result.startsWith(original.slice(0, original.indexOf('apply plugin:'))));
  assert.ok(
    result.indexOf('// @generated begin') < result.indexOf("apply plugin: 'expo-root-project'"),
  );
  assert.ok(
    result.includes("arguments('-DKEEP=ON', '-DCMAKE_CXX_FLAGS=-fexceptions -DKEEP_CPP=1')"),
  );
  assert.ok(result.includes("['com.android.application', 'com.android.library']"));
  assert.ok(result.includes('finalizeDsl { android ->'));
  assert.ok(result.includes("'-DCMAKE_OBJECT_PATH_MAX=240'"));
  assert.ok(result.includes("'--driver-mode=g++'"));
  assert.ok(result.includes("'.tmp/cxx/' + stageName"));
  assert.ok(result.includes("System.getProperty('os.name')"));
});

test('un second prebuild est identique et une ancienne version du bloc est remplacée sans toucher le reste', () => {
  const first = applyWindowsNativeGradle(original, 'win32');
  assert.equal(applyWindowsNativeGradle(first, 'win32'), first);
  const previous =
    original +
    '// @generated begin teranga-windows-native\noldGeneratedSettings()\n// @generated end teranga-windows-native\n// custom after\n';
  const updated = applyWindowsNativeGradle(previous, 'win32');
  assert.ok(updated.startsWith(original.slice(0, original.indexOf('apply plugin:'))));
  assert.ok(
    updated.indexOf('// @generated begin') < updated.indexOf("apply plugin: 'expo-root-project'"),
  );
  assert.ok(updated.endsWith('// custom after\n'));
  assert.ok(!updated.includes('oldGeneratedSettings()'));
  assert.equal(updated.split('// @generated begin teranga-windows-native').length, 2);
  assert.equal(applyWindowsNativeGradle(updated, 'win32'), updated);
});

test('les fins de ligne Windows et un fichier sans saut final restent compatibles et idempotents', () => {
  const crlf = original.replaceAll('\n', '\r\n');
  const result = applyWindowsNativeGradle(crlf, 'win32');
  assert.equal(
    result.replace(
      /\/\/ @generated begin teranga-windows-native[\s\S]*?\/\/ @generated end teranga-windows-native\r\n/,
      '',
    ),
    crlf,
  );
  assert.equal(result.replaceAll('\r\n', '').includes('\n'), false);
  assert.equal(applyWindowsNativeGradle(result, 'win32'), result);
  const withoutFinalNewline = applyWindowsNativeGradle(original.trimEnd(), 'win32');
  assert.equal(applyWindowsNativeGradle(withoutFinalNewline, 'win32'), withoutFinalNewline);
});

for (const platform of ['linux', 'darwin']) {
  test(`hors Windows la transformation ne change aucun octet | ${platform}`, () => {
    assert.equal(applyWindowsNativeGradle(original, platform), original);
    const windowsFile = applyWindowsNativeGradle(original, 'win32');
    assert.equal(applyWindowsNativeGradle(windowsFile, platform), windowsFile);
  });
}

test('un bloc tronqué ou dupliqué est refusé au lieu de réécrire des réglages voisins', () => {
  for (const contents of [
    original + '// @generated begin teranga-windows-native\ncustom()',
    original + '// @generated end teranga-windows-native\n',
    applyWindowsNativeGradle(original, 'win32') + '// @generated begin teranga-windows-native\n',
  ])
    assert.throws(() => applyWindowsNativeGradle(contents, 'win32'), {
      message: 'WINDOWS_NATIVE_GRADLE_INVALID',
    });
});

async function onPlatform(platform, run) {
  const previous = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { configurable: true, value: platform });
  try {
    return await run();
  } finally {
    Object.defineProperty(process, 'platform', previous);
  }
}

test('le vrai mod Expo SDK 58 est enregistré puis exécuté en mémoire sans prebuild ni accès aux fichiers natifs', async () => {
  await onPlatform('win32', async () => {
    const config = plugin({ name: 'Teranga Pay', slug: 'teranga-pay' });
    assert.equal(typeof config.mods.android.projectBuildGradle, 'function');
    const result = await config.mods.android.projectBuildGradle({
      ...config,
      modResults: { language: 'groovy', contents: original },
      modRequest: {
        platform: 'android',
        modName: 'projectBuildGradle',
        projectRoot: '/workspace/apps/mobile',
        platformProjectRoot: '/workspace/apps/mobile/android',
      },
    });
    assert.equal(result.modResults.contents, applyWindowsNativeGradle(original, 'win32'));
    await assert.rejects(
      () =>
        config.mods.android.projectBuildGradle({
          ...config,
          modResults: { language: 'kotlin', contents: original },
          modRequest: { platform: 'android', modName: 'projectBuildGradle' },
        }),
      { message: 'WINDOWS_NATIVE_GRADLE_UNSUPPORTED' },
    );
  });
});

test('le plugin laisse la configuration intacte hors Windows', async () => {
  for (const platform of ['linux', 'darwin'])
    await onPlatform(platform, () => {
      const config = { name: 'Teranga Pay', slug: 'teranga-pay', plugins: ['expo-font'] };
      assert.equal(plugin(config), config);
      assert.ok(!Object.hasOwn(config, 'mods'));
    });
});

test('app.config conserve la caméra et déclare le plugin local sans nouvelle dépendance', async () => {
  const config = await readFile(new URL('../apps/mobile/app.config.ts', import.meta.url), 'utf8');
  assert.ok(config.includes("'expo-camera'"));
  assert.ok(config.includes("'./plugins/with-windows-native.cjs'"));
  const packageJson = JSON.parse(
    await readFile(new URL('../apps/mobile/package.json', import.meta.url), 'utf8'),
  );
  assert.equal(packageJson.dependencies.expo, '58.0.23');
  assert.ok(!Object.hasOwn(packageJson.dependencies, '@expo/config-plugins'));
});
