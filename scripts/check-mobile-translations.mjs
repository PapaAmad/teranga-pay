import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

import { isMain, root as defaultRoot } from './github/lib.mjs';

const visibleProps = new Set([
  'title',
  'label',
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
]);
const optionProps = new Set(['options', 'screenOptions']);
const catalogPath = /(?:^|\/)translations\/(?:fr|wo)(?:\.[cm]?[jt]sx?)?$/u;
const translationsPath = /(?:^|\/)translations(?:\/index(?:\.[cm]?[jt]sx?)?)?$/u;
const toastMethods = new Set(['show', 'showWithGravity', 'showWithGravityAndOffset']);

function propertyName(node) {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined;
}

function unwrapped(node) {
  while (
    node &&
    (ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node))
  )
    node = node.expression;
  return node;
}

/** Find only literal content in an expression's displayed branches, not call arguments or conditions. */
function displayedLiterals(node) {
  node = unwrapped(node);
  if (!node) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text.trim() ? [node] : [];
  }
  if (ts.isConditionalExpression(node)) {
    return [...displayedLiterals(node.whenTrue), ...displayedLiterals(node.whenFalse)];
  }
  if (ts.isTemplateExpression(node)) {
    return [
      node.head,
      ...node.templateSpans.flatMap((span) => [
        ...displayedLiterals(span.expression),
        span.literal,
      ]),
    ].filter((literal) => literal.text.trim());
  }
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) return displayedLiterals(node.right);
    if (
      [
        ts.SyntaxKind.PlusToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(operator)
    ) {
      return [...displayedLiterals(node.left), ...displayedLiterals(node.right)];
    }
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(displayedLiterals);
  return [];
}

/** Follow inline object/array branches, without inspecting callbacks or technical fields. */
function objectFieldValues(node, field) {
  node = unwrapped(node);
  if (!node) return [];
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.flatMap((property) => {
      if (ts.isSpreadAssignment(property)) return objectFieldValues(property.expression, field);
      return ts.isPropertyAssignment(property) && propertyName(property.name) === field
        ? [property.initializer]
        : [];
    });
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.flatMap((element) =>
      objectFieldValues(ts.isSpreadElement(element) ? element.expression : element, field),
    );
  }
  if (ts.isConditionalExpression(node)) {
    return [node.whenTrue, node.whenFalse].flatMap((branch) => objectFieldValues(branch, field));
  }
  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
      return objectFieldValues(node.right, field);
    if (
      [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        node.operatorToken.kind,
      )
    )
      return [node.left, node.right].flatMap((branch) => objectFieldValues(branch, field));
  }
  return [];
}

/** Resolve imported React Native names locally; value aliases/data flow remain a review concern. */
function nativeBindings(file) {
  const scopes = new Map();
  const parents = new Map();
  const scopeFor = new Map();
  const opensScope = (node) =>
    ts.isSourceFile(node) ||
    ts.isBlock(node) ||
    ts.isFunctionLike(node) ||
    ts.isCatchClause(node) ||
    ts.isCaseBlock(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node);
  const bind = (scope, name, value = null) => {
    if (ts.isIdentifier(name)) scopes.get(scope).set(name.text, value);
    else if (ts.isBindingPattern(name)) {
      for (const element of name.elements)
        if (ts.isBindingElement(element)) bind(scope, element.name);
    }
  };
  function walk(node, outer) {
    let scope = outer;
    if (opensScope(node)) {
      scope = node;
      scopes.set(scope, new Map());
      parents.set(scope, outer);
    }
    scopeFor.set(node, scope);
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name)
      bind(outer, node.name);
    if (ts.isFunctionExpression(node) && node.name) bind(scope, node.name);
    if (ts.isParameter(node)) bind(scope, node.name);
    if (ts.isVariableDeclaration(node)) {
      let target = scope;
      if (
        ts.isVariableDeclarationList(node.parent) &&
        !(node.parent.flags & ts.NodeFlags.BlockScoped)
      ) {
        while (!ts.isSourceFile(target) && !ts.isFunctionLike(target)) target = parents.get(target);
      }
      bind(target, node.name);
    }
    if (ts.isImportDeclaration(node) && node.importClause && !node.importClause.isTypeOnly) {
      const clause = node.importClause;
      const native =
        ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === 'react-native';
      if (clause.name) bind(scope, clause.name, native ? 'namespace' : null);
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings))
          bind(scope, clause.namedBindings.name, native ? 'namespace' : null);
        else
          for (const element of clause.namedBindings.elements) {
            const name = (element.propertyName ?? element.name).text;
            bind(
              scope,
              element.name,
              native && !element.isTypeOnly && ['Alert', 'ToastAndroid'].includes(name)
                ? name
                : null,
            );
          }
      }
    }
    ts.forEachChild(node, (child) => walk(child, scope));
  }
  walk(file, undefined);
  return (identifier) => {
    for (let scope = scopeFor.get(identifier); scope; scope = parents.get(scope)) {
      if (scopes.get(scope).has(identifier.text)) return scopes.get(scope).get(identifier.text);
    }
    return null;
  };
}

function memberAccess(node) {
  node = unwrapped(node);
  if (node && ts.isPropertyAccessExpression(node))
    return { owner: unwrapped(node.expression), name: node.name.text };
  if (node && ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression))
    return { owner: unwrapped(node.expression), name: node.argumentExpression.text };
  return undefined;
}

function inNavigationOptions(node) {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (ts.isJsxAttribute(ancestor)) return optionProps.has(ancestor.name.getText());
    if (ts.isCallExpression(ancestor) && ts.isPropertyAccessExpression(ancestor.expression)) {
      if (ancestor.expression.name.text === 'setOptions') return true;
    }
  }
  return false;
}

export function inspectTranslationSource(source, filename = 'screen.tsx') {
  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    /\.[jt]sx$/u.test(filename)
      ? ts.ScriptKind.TSX
      : /\.[cm]?js$/u.test(filename)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS,
  );
  const nativeBinding = nativeBindings(file);
  const diagnostics = [];
  const reported = new Set();
  const report = (node, kind, message) => {
    const position = node.getStart(file);
    const key = `${position}:${kind}`;
    if (reported.has(key)) return;
    reported.add(key);
    const { line, character } = file.getLineAndCharacterOfPosition(position);
    diagnostics.push({ file: filename, line: line + 1, column: character + 1, kind, message });
  };
  const visible = (node) =>
    displayedLiterals(node).forEach((literal) =>
      report(literal, 'literal', 'Texte visible en dur : utiliser une clé de traduction.'),
    );
  const checkImport = (specifier, clause) => {
    if (clause?.isTypeOnly || !ts.isStringLiteral(specifier)) return;
    const value = specifier.text.replaceAll('\\', '/');
    const named = clause?.namedBindings ?? clause;
    if (
      named &&
      (ts.isNamedImports(named) || ts.isNamedExports(named)) &&
      named.elements.length &&
      named.elements.every((element) => element.isTypeOnly) &&
      !clause?.name
    )
      return;
    const catalogFromBarrel =
      translationsPath.test(value) &&
      named &&
      (ts.isNamedImports(named) || ts.isNamedExports(named)) &&
      named.elements.some(
        (element) =>
          !element.isTypeOnly && ['fr', 'wo'].includes((element.propertyName ?? element.name).text),
      );
    if (catalogPath.test(value) || catalogFromBarrel) {
      report(
        specifier,
        'catalog',
        'Catalogue importé directement : utiliser le hook de traduction.',
      );
    }
  };
  const checkNativeMessage = (node) => {
    const method = memberAccess(node.expression);
    if (!method) return;
    let service = ts.isIdentifier(method.owner) ? nativeBinding(method.owner) : null;
    const owner = memberAccess(method.owner);
    if (owner && ts.isIdentifier(owner.owner) && nativeBinding(owner.owner) === 'namespace')
      service = owner.name;
    if (service === 'Alert' && method.name === 'alert') {
      visible(node.arguments[0]);
      visible(node.arguments[1]);
      objectFieldValues(node.arguments[2], 'text').forEach(visible);
    }
    if (service === 'ToastAndroid' && toastMethods.has(method.name)) visible(node.arguments[0]);
  };
  function visit(node) {
    if (ts.isJsxText(node) && node.text.trim())
      report(node, 'literal', 'Texte JSX en dur : utiliser une clé de traduction.');
    if (ts.isJsxAttribute(node) && node.initializer && visibleProps.has(node.name.getText())) {
      visible(
        ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer,
      );
    }
    if (ts.isJsxAttribute(node) && node.initializer && node.name.getText() === 'accessibilityValue')
      objectFieldValues(
        ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer,
        'text',
      ).forEach(visible);
    if (ts.isJsxExpression(node) && node.parent && !ts.isJsxAttribute(node.parent))
      visible(node.expression);
    if (
      ts.isPropertyAssignment(node) &&
      visibleProps.has(propertyName(node.name)) &&
      inNavigationOptions(node)
    )
      visible(node.initializer);
    if (ts.isImportDeclaration(node)) checkImport(node.moduleSpecifier, node.importClause);
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier)
      checkImport(node.moduleSpecifier, node.exportClause);
    if (ts.isCallExpression(node)) checkNativeMessage(node);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments[0]
    )
      checkImport(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (file.parseDiagnostics.length) {
    const position = file.parseDiagnostics[0].start ?? 0;
    const { line, character } = file.getLineAndCharacterOfPosition(position);
    diagnostics.push({
      file: filename,
      line: line + 1,
      column: character + 1,
      kind: 'syntax',
      message: 'Syntaxe TypeScript/JSX invalide : contrôle incomplet.',
    });
  }
  return diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
}

export async function checkMobileTranslations(root = defaultRoot) {
  const mobile = path.join(root, 'apps/mobile');
  const sourceRoot = path.join(mobile, 'src');
  const excluded = new Set([path.join(sourceRoot, 'translations'), path.join(sourceRoot, 'tests')]);
  const files = [path.join(mobile, 'App.tsx')];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.name === '__tests__' || excluded.has(target)) continue;
      if (entry.isDirectory()) await collect(target);
      else if (
        entry.isFile() &&
        /\.[cm]?[jt]sx?$/u.test(entry.name) &&
        !/\.(?:d\.[cm]?ts|(?:test|spec)\.[cm]?[jt]sx?)$/u.test(entry.name)
      )
        files.push(target);
    }
  }
  await collect(sourceRoot);
  const diagnostics = [];
  for (const file of files.sort()) {
    diagnostics.push(
      ...inspectTranslationSource(
        await readFile(file, 'utf8'),
        path.relative(root, file).split(path.sep).join('/'),
      ),
    );
  }
  return { files: files.length, diagnostics };
}

if (isMain(import.meta.url)) {
  try {
    const { files, diagnostics } = await checkMobileTranslations();
    for (const item of diagnostics)
      console.error(`${item.file}:${item.line}:${item.column} | ${item.message}`);
    if (diagnostics.length) process.exitCode = 1;
    else
      console.info(
        `Traductions mobiles vérifiées : ${files} fichiers sans texte littéral détecté.`,
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
