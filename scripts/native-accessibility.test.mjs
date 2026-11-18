import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const mobileRequire = createRequire(path.join(root, 'apps/mobile/package.json'));
const native = await readFile(
  path.join(
    path.dirname(mobileRequire.resolve('react-native/package.json')),
    'ReactAndroid/src/main/java/com/facebook/react/uimanager/ReactAccessibilityDelegate.kt',
  ),
  'utf8',
);
function enumValues(name) {
  const body = native.match(
    new RegExp(`enum class ${name}\\s*\\{([\\s\\S]*?)public companion object`),
  )?.[1];
  assert.ok(body, `Enum Android ${name} introuvable dans React Native installé`);
  const values = new Set(
    [...body.matchAll(/^\s*([A-Z][A-Z0-9_]+)[,;]?\s*$/gm)].map((match) => match[1].toLowerCase()),
  );
  assert.ok(values.size > 20, `Enum Android ${name} vide ou incomplet`);
  return values;
}
const supported = { accessibilityRole: enumValues('AccessibilityRole'), role: enumValues('Role') };

async function sources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? sources(path.join(directory, entry.name))
          : /\.tsx$/.test(entry.name)
            ? [path.join(directory, entry.name)]
            : [],
      ),
    )
  ).flat();
}
function literals(node) {
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (
    ts.isJsxExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
  )
    return literals(node.expression);
  if (ts.isConditionalExpression(node))
    return [...literals(node.whenTrue), ...literals(node.whenFalse)];
  return [];
}
const rows = [];
for (const file of [
  path.join(root, 'apps/mobile/App.tsx'),
  ...(await sources(path.join(root, 'apps/mobile/src'))),
]) {
  const ast = ts.createSourceFile(
    file,
    await readFile(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const nativeNames = new Set();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'react-native')
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      for (const entry of bindings.elements) nativeNames.add(entry.name.text);
    if (bindings && ts.isNamespaceImport(bindings)) nativeNames.add(bindings.name.text);
  }
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      let tag = node.tagName;
      while (ts.isPropertyAccessExpression(tag)) tag = tag.expression;
      if (ts.isIdentifier(tag) && nativeNames.has(tag.text)) {
        const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
        for (const attribute of attributes)
          if (Object.hasOwn(supported, attribute.name.text)) {
            for (const value of literals(attribute.initializer))
              rows.push({
                prop: attribute.name.text,
                value,
                live: literals(
                  attributes.find((item) => item.name.text === 'accessibilityLiveRegion')
                    ?.initializer,
                ),
                location: `${path.relative(root, file)}:${ast.getLineAndCharacterOfPosition(attribute.getStart(ast)).line + 1}`,
              });
          }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

test('les deux propriétés de rôle gardent leur contrat Android distinct', () => {
  assert.ok(supported.role.has('status'));
  assert.equal(supported.accessibilityRole.has('status'), false);
});
test('les valeurs statiques des rôles JSX natifs sont acceptées par le SDK Android installé', () => {
  assert.ok(rows.length > 40, 'Aucun parcours significatif des composants natifs');
  const invalid = rows.filter((row) => !supported[row.prop].has(row.value));
  assert.deepEqual(invalid, [], 'Rôle rejeté par le gestionnaire natif Android');
});
test('les statuts utilisent role et gardent une annonce polie', () => {
  const statuses = rows.filter((row) => row.value === 'status');
  assert.ok(statuses.length > 0, 'Aucun statut contrôlé');
  for (const row of statuses) {
    assert.equal(row.prop, 'role', row.location);
    assert.deepEqual(row.live, ['polite'], row.location);
  }
});
