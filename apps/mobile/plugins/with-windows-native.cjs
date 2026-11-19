const { withProjectBuildGradle } = require('expo/config-plugins');

const begin = '// @generated begin teranga-windows-native';
const end = '// @generated end teranga-windows-native';
const gradle = `${begin}
// Windows | chemins CMake courts et pilote C++ explicite pour le NDK.
if (System.getProperty('os.name').toLowerCase(java.util.Locale.ROOT).contains('windows')) {
  subprojects { nativeProject ->
    ['com.android.application', 'com.android.library'].each { androidPlugin ->
      nativeProject.plugins.withId(androidPlugin) {
        nativeProject.extensions.getByName('androidComponents').finalizeDsl { android ->
          def cmake = android.defaultConfig.externalNativeBuild.cmake
          def arguments = new ArrayList(cmake.arguments)
          arguments.removeAll { argument ->
            argument.toString().startsWith('-DCMAKE_OBJECT_PATH_MAX=') ||
              argument.toString().startsWith('-DCMAKE_OBJECT_PATH_MAX:')
          }
          arguments.add('-DCMAKE_OBJECT_PATH_MAX=240')
          def driver = '--driver-mode=g++'
          def cxxIndex = arguments.findLastIndexOf { argument ->
            argument.toString() ==~ /^-DCMAKE_CXX_FLAGS(?::[A-Za-z_]+)?=.*/
          }
          if (cxxIndex < 0) {
            arguments.add('-DCMAKE_CXX_FLAGS=' + driver)
          } else {
            def previous = arguments[cxxIndex].toString()
            def flags = previous.substring(previous.indexOf('=') + 1)
            if (!flags.tokenize().contains(driver)) {
              arguments[cxxIndex] = previous + ' ' + driver
            }
          }
          cmake.arguments.clear()
          cmake.arguments.addAll(arguments)
          def workspace = nativeProject.rootProject.rootDir.toPath().resolve('../../..').normalize().toFile()
          def stageName = nativeProject.path.replace(':', '_').replaceAll('[^A-Za-z0-9_]', '_')
          android.externalNativeBuild.cmake.buildStagingDirectory = new File(workspace, '.tmp/cxx/' + stageName)
        }
      }
    }
  }
}
${end}`;

/** Ne remplace que le bloc appartenant au plugin ; les réglages existants restent intacts. */
function applyWindowsNativeGradle(contents, platform = process.platform) {
  if (platform !== 'win32') return contents;
  if (typeof contents !== 'string') throw new Error('WINDOWS_NATIVE_GRADLE_INVALID');
  const start = contents.indexOf(begin);
  const stop = contents.indexOf(end);
  const newline = contents.includes('\r\n') ? '\r\n' : '\n';
  const block = gradle.replaceAll('\n', newline);
  if (
    (start >= 0 || stop >= 0) &&
    (start < 0 ||
      stop < start ||
      contents.lastIndexOf(begin) !== start ||
      contents.lastIndexOf(end) !== stop ||
      (start !== 0 && contents[start - 1] !== '\n') ||
      (stop !== 0 && contents[stop - 1] !== '\n'))
  )
    throw new Error('WINDOWS_NATIVE_GRADLE_INVALID');
  let base = contents;
  if (start >= 0) {
    let after = stop + end.length;
    if (contents.slice(after, after + newline.length) === newline) after += newline.length;
    base = contents.slice(0, start) + contents.slice(after);
  }
  // Les plugins racine configurent les sous-projets immédiatement : inscrire
  // finalizeDsl avant leur application, sinon Android a déjà finalisé sa DSL.
  const anchor = base.search(
    /^apply\s+plugin\s*:\s*["'](?:expo-root-project|com\.facebook\.react\.rootproject)["']/m,
  );
  if (anchor >= 0) return base.slice(0, anchor) + block + newline + base.slice(anchor);
  return `${base}${base.endsWith('\n') ? '' : newline}${block}${newline}`;
}

/** Mod Expo SDK 58 : aucune E/S et aucun changement natif à l'import du plugin. */
function withWindowsNative(config) {
  if (process.platform !== 'win32') return config;
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('WINDOWS_NATIVE_GRADLE_UNSUPPORTED');
    mod.modResults.contents = applyWindowsNativeGradle(mod.modResults.contents);
    return mod;
  });
}

module.exports = withWindowsNative;
module.exports.applyWindowsNativeGradle = applyWindowsNativeGradle;
