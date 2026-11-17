import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkMobileTranslations, inspectTranslationSource } from './check-mobile-translations.mjs';

test('le texte JSX en dur est signalé avec son emplacement', () => {
  const source = '\nconst Screen = () => <Text>Bienvenue ici</Text>;';
  const issues = inspectTranslationSource(source, 'screen.tsx');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].file, 'screen.tsx');
  assert.equal(issues[0].line, 2);
  assert.equal(issues[0].column, source.split('\n')[1].indexOf('Bienvenue') + 1);
  assert.equal(issues[0].kind, 'literal');
});

test('les libellés, aides, erreurs et titres de navigation littéraux sont refusés', () => {
  for (const prop of [
    'label',
    'title',
    'placeholder',
    'helperText',
    'error',
    'statusLabel',
    'hint',
    'accessibilityLabel',
    'accessibilityHint',
    'headerBackTitle',
    'headerTitle',
    'tabBarLabel',
    'aria-label',
    'children',
  ]) {
    const issues = inspectTranslationSource(`<Control ${prop}="Une instruction" />`);
    assert.equal(issues.length, 1, prop);
    assert.equal(issues[0].kind, 'literal');
  }
  const options = inspectTranslationSource(
    '<Stack.Screen name="Home" options={{title: "Accueil"}} />',
  );
  assert.equal(options.length, 1);
  const callback = inspectTranslationSource(
    'navigation.setOptions({headerBackTitle: "Retour"});',
    'navigation.ts',
  );
  assert.equal(callback.length, 1);
});

test('les titres d’onglet sont contrôlés dans toutes les options de navigation', () => {
  for (const source of [
    '<Tabs.Screen name="Home" options={{tabBarLabel: "Accueil"}} />',
    '<Tabs.Navigator screenOptions={{tabBarLabel: "Accueil"}} />',
    '<Tabs.Navigator screenOptions={() => ({tabBarLabel: "Accueil"})} />',
    'navigation.setOptions({tabBarLabel: "Accueil"});',
  ]) {
    const issues = inspectTranslationSource(source);
    assert.equal(issues.length, 1, source);
    assert.equal(issues[0].kind, 'literal');
  }
});

test('seul le texte de la valeur accessible est traduit, y compris ses branches', () => {
  for (const source of [
    '<Progress accessibilityValue={{min:0, max:100, now:20, text:"En cours"}} />',
    '<Progress accessibilityValue={ready ? {text:t("ready")} : {text:"En cours"}} />',
    '<Progress accessibilityValue={{...{text:"En cours"}}} />',
    '<Progress accessibilityValue={{"text": active && "En cours"}} />',
  ]) {
    const issues = inspectTranslationSource(source);
    assert.equal(issues.length, 1, source);
    assert.equal(issues[0].kind, 'literal');
  }
  assert.deepEqual(
    inspectTranslationSource(
      '<Progress accessibilityValue={{min:0, max:100, now:20, text:t("progress")}} accessibilityRole="progressbar" aria-label={t("progress")} testID="progress" />',
    ),
    [],
  );
});

test('les alertes natives contrôlent titre, message et boutons, sans suivre leurs callbacks', () => {
  const issues = inspectTranslationSource(
    [
      'import {Alert} from "react-native";',
      'Alert.alert("Erreur", "Réessayer plus tard", [',
      '  {text:"Annuler", style:"cancel", onPress:() => log("cancel")},',
      '  {text:t("confirm"), onPress:() => log("confirm")},',
      '], {cancelable:true, onDismiss:() => log("dismiss")});',
    ].join('\n'),
  );
  assert.equal(issues.length, 3);
  assert.ok(issues.every((issue) => issue.kind === 'literal'));
  assert.deepEqual(
    inspectTranslationSource(
      [
        'import {Alert} from "react-native";',
        'Alert.alert(t("error.title"), t("error.message"), [',
        '  {text:t("cancel"), style:"cancel", onPress:() => log("cancel")},',
        '], {cancelable:true});',
      ].join('\n'),
    ),
    [],
  );
});

test('les variantes de ToastAndroid ne contrôlent que le message affiché', () => {
  for (const method of ['show', 'showWithGravity', 'showWithGravityAndOffset']) {
    const source =
      'import {ToastAndroid} from "react-native"; ToastAndroid.' +
      method +
      '("Un message", ToastAndroid.SHORT, ToastAndroid.CENTER, 1, 2);';
    const issues = inspectTranslationSource(source);
    assert.equal(issues.length, 1, method);
    assert.equal(issues[0].kind, 'literal');
  }
  assert.deepEqual(
    inspectTranslationSource(
      [
        'import {ToastAndroid} from "react-native";',
        'ToastAndroid.showWithGravityAndOffset(t("saved"), ToastAndroid.SHORT, ToastAndroid.CENTER, 1, 2);',
        'ToastAndroid.show(t("saved"), "technical-duration");',
      ].join('\n'),
    ),
    [],
  );
});

test('les alias d’import et imports d’espace de noms natifs sont reconnus', () => {
  for (const source of [
    'import {Alert as NativeAlert} from "react-native"; NativeAlert.alert("Erreur");',
    'import {ToastAndroid as Toast} from "react-native"; Toast.show("Message", Toast.SHORT);',
    'import * as RN from "react-native"; RN.Alert.alert("Erreur");',
    'import ReactNative from "react-native"; ReactNative.ToastAndroid.show("Message", 0);',
    'import {Alert} from "react-native"; Alert["alert"]("Erreur");',
  ]) {
    const issues = inspectTranslationSource(source, 'notifications.ts');
    assert.equal(issues.length, 1, source);
    assert.equal(issues[0].kind, 'literal');
  }
});

test('les homonymes et noms masqués ne sont pas confondus avec les imports natifs', () => {
  for (const source of [
    'const Alert = service; Alert.alert("Un code interne");',
    'import {Alert} from "./logging"; Alert.alert("Un code interne");',
    'import {Alert} from "react-native"; function send(Alert) { Alert.alert("Un code interne"); }',
    'import {Alert} from "react-native"; function send() { if (ready) { var Alert = logger; } Alert.alert("Un code interne"); }',
    'import {Alert} from "react-native"; { const {Alert} = logger; Alert.alert("Un code interne"); }',
    'import {ToastAndroid} from "react-native"; const send = (ToastAndroid) => ToastAndroid.show("Un code interne", 0);',
    'import * as RN from "react-native"; try {} catch(RN) { RN.Alert.alert("Un code interne"); }',
    'import type {Alert} from "react-native"; Alert.alert("Un code interne");',
    'import {Alert} from "react-native"; Alert.custom("Un code interne");',
  ])
    assert.deepEqual(inspectTranslationSource(source, 'service.ts'), [], source);
  const issues = inspectTranslationSource(
    [
      'import {Alert} from "react-native";',
      'function log(Alert) { Alert.alert("Un code interne"); }',
      'Alert.alert("Erreur visible");',
    ].join('\n'),
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].line, 3);
});

test('les boutons natifs et messages conditionnels gardent leurs textes affichés contrôlés', () => {
  const issues = inspectTranslationSource(
    [
      'import {Alert, ToastAndroid} from "react-native";',
      'Alert.alert(t("error"), null, active ? [{text:label ?? "Annuler"}] : []);',
      'Alert.alert(t("error"), null, [...[{text:"Fermer", style:"cancel"}]]);',
      'ToastAndroid.show(ready ? t("ready") : "Réessayer", ToastAndroid.SHORT);',
    ].join('\n'),
  );
  assert.equal(issues.length, 3);
  assert.ok(issues.every((issue) => issue.kind === 'literal'));
});

test('parenthèses, assertions, concaténations et gabarits ne cachent pas un texte affiché', () => {
  for (const expression of [
    '("Bienvenue")',
    '("Bienvenue" as string)',
    '"Bonjour " + name',
    '`Bonjour ${name}`',
    'ready ? label : "Indisponible"',
    'ready && "Disponible"',
    'label ?? "Indisponible"',
    '[label, "Suite"]',
  ]) {
    const issues = inspectTranslationSource(`<Text>{${expression}}</Text>`);
    assert.equal(issues.length, 1, expression);
    assert.equal(issues[0].kind, 'literal');
    assert.equal(
      inspectTranslationSource(`<Button label={${expression}} />`).length,
      1,
      expression,
    );
  }
});

test('conditions, styles, identifiants techniques et clés de traduction restent autorisés', () => {
  const source = `
    import {useTranslation} from '../translations';
    const Page = () => <View style={{backgroundColor:'#ffffff'}}>
      <Text accessibilityRole="header">{t('home.title')}</Text>
      <Text>{status === 'success' ? t('state.success') : t('state.pending')}</Text>
      <Text>{tokens.colors.primary}</Text>
      <Text>{amount}</Text>
      <Button label={label} accessibilityLabel={t('button.label')} icon="send" disabled />
      <Stack.Screen name="Home" options={{ title: t('home.title') }} />
    </View>;
  `;
  assert.deepEqual(inspectTranslationSource(source), []);
  assert.deepEqual(inspectTranslationSource('<Text>{" "}</Text>'), []);
  assert.deepEqual(inspectTranslationSource('<Control label />'), []);
});

test('les catalogues ne sont pas importés directement pour contourner la langue active', () => {
  for (const source of [
    "import {fr} from '../translations/fr';",
    "import catalogue from '../translations/fr.ts';",
    "const catalogue = require('../translations/wo');",
    "const catalogue = await import('../translations/fr');",
    "import {fr as texts} from '../translations';",
    "export {fr} from '../translations/fr';",
    "export {fr as texts} from '../translations/index.js';",
    "import {wo as texts} from '../translations/index.mjs';",
  ]) {
    const issues = inspectTranslationSource(source, 'screen.ts');
    assert.equal(issues.length, 1, source);
    assert.equal(issues[0].kind, 'catalog');
  }
  assert.deepEqual(
    inspectTranslationSource(
      "import type {TranslationCatalog} from '../translations';",
      'screen.ts',
    ),
    [],
  );
  assert.deepEqual(
    inspectTranslationSource(
      "import {useTranslation, type AppI18n} from '../translations';",
      'screen.ts',
    ),
    [],
  );
  assert.deepEqual(
    inspectTranslationSource(
      "import {type TranslationCatalog} from '../translations/fr.js'; export {type TranslationCatalog} from '../translations/fr.js';",
      'screen.ts',
    ),
    [],
  );
});

test('les extensions JavaScript et TypeScript ne contournent aucun import de catalogue', () => {
  for (const extension of ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts']) {
    for (const source of [
      'import {fr} from "../translations/fr.' + extension + '";',
      'export {wo} from "../translations/wo.' + extension + '";',
      'const texts = await import("../translations/fr.' + extension + '");',
      'const texts = require("../translations/wo.' + extension + '");',
    ]) {
      const issues = inspectTranslationSource(source, 'screen.ts');
      assert.equal(issues.length, 1, source);
      assert.equal(issues[0].kind, 'catalog');
    }
  }
  assert.deepEqual(
    inspectTranslationSource(
      "import {useTranslation} from '../translations/index.js'; import {frame} from '../translations/frame.js';",
      'screen.ts',
    ),
    [],
  );
});

test('les sources JSX et JavaScript utilisent le parseur adapté', () => {
  for (const filename of ['screen.js', 'screen.jsx', 'screen.mjs', 'screen.cjs']) {
    const issues = inspectTranslationSource('<Text aria-label="Titre" />', filename);
    assert.equal(issues.length, 1, filename);
    assert.equal(issues[0].kind, 'literal');
  }
});

test('une source invalide ne donne pas un faux succès du contrôle', () => {
  const issues = inspectTranslationSource('<Text>{t("home.title")</Text>');
  assert.ok(issues.some((issue) => issue.kind === 'syntax'));
});

async function fixture(t, files) {
  const directory = await mkdtemp(path.join(tmpdir(), 'teranga-mobile-translations-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  });
  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  return directory;
}

test('le parcours contrôle App et les sources, en excluant ressources et tests', async (t) => {
  const root = await fixture(t, {
    'apps/mobile/App.tsx': '<Text>{t("home.title")}</Text>',
    'apps/mobile/src/screens/Home.tsx': '<Button label="Un texte oublié" />',
    'apps/mobile/src/navigation/options.ts': 'navigation.setOptions({title:"Titre oublié"});',
    'apps/mobile/src/translations/fr.ts': 'export const fr = {title:"Français"};',
    'apps/mobile/src/tests/fixture.tsx': '<Text>Texte témoin</Text>',
    'apps/mobile/src/screens/Home.test.tsx': '<Text>Texte témoin</Text>',
    'apps/mobile/src/ui/type.d.ts': 'export type Label = "Type technique";',
  });
  const result = await checkMobileTranslations(root);
  assert.equal(result.files, 3);
  assert.deepEqual(
    result.diagnostics.map((item) => item.file),
    ['apps/mobile/src/navigation/options.ts', 'apps/mobile/src/screens/Home.tsx'],
  );
});

test('seuls les vrais dossiers de ressources et de fixtures sont exclus du parcours', async (t) => {
  const root = await fixture(t, {
    'apps/mobile/App.tsx': '<Text>{t("home.title")}</Text>',
    'apps/mobile/src/translations/fr.js': 'export const fr = {title:"Ressource"};',
    'apps/mobile/src/translations/nested/fixture.tsx': '<Text>Ressource</Text>',
    'apps/mobile/src/tests/nested/fixture.tsx': '<Text>Fixture</Text>',
    'apps/mobile/src/screens/__tests__/fixture.tsx': '<Text>Fixture</Text>',
    'apps/mobile/src/screens/test.spec.mjs': '<Text>Fixture</Text>',
    'apps/mobile/src/screens/test.test.cjs': '<Text>Fixture</Text>',
    'apps/mobile/src/screens/type.d.mts': 'export type Label = "Type";',
    'apps/mobile/src/screens/type.d.cts': 'export type Label = "Type";',
    'apps/mobile/src/screens/tests/Live.tsx': '<Text>Texte oublié</Text>',
    'apps/mobile/src/screens/translations/Live.tsx': '<Text>Autre texte oublié</Text>',
    'apps/mobile/src/screens/Legacy.js': '<Text>Texte JS oublié</Text>',
    'apps/mobile/src/screens/Legacy.jsx': '<Text>Texte JSX oublié</Text>',
    'apps/mobile/src/screens/legacy.mjs': '<Text>Texte MJS oublié</Text>',
    'apps/mobile/src/screens/legacy.cjs': '<Text>Texte CJS oublié</Text>',
  });
  const result = await checkMobileTranslations(root);
  assert.equal(result.files, 7);
  assert.equal(result.diagnostics.length, 6);
  assert.ok(result.diagnostics.every((issue) => issue.kind === 'literal'));
  assert.deepEqual(
    result.diagnostics.map((issue) => issue.file),
    [
      'apps/mobile/src/screens/Legacy.js',
      'apps/mobile/src/screens/Legacy.jsx',
      'apps/mobile/src/screens/legacy.cjs',
      'apps/mobile/src/screens/legacy.mjs',
      'apps/mobile/src/screens/tests/Live.tsx',
      'apps/mobile/src/screens/translations/Live.tsx',
    ],
  );
});

test('une racine absente ou incomplète est refusée', async (t) => {
  const root = await fixture(t, { 'README.md': 'Fixture sans application' });
  await assert.rejects(checkMobileTranslations(root), { code: 'ENOENT' });
});

test('importer le garde ne lance pas le contrôle', () => {
  const address = new URL('./check-mobile-translations.mjs', import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(address)})`],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});
