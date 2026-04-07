import assert from "node:assert/strict";
import path from "node:path";
import ts from "typescript";
import { test } from "vitest";

const rootDir = path.resolve(process.cwd(), "src");
const strictFiles = new Set([
  "client/index.ts",
  "client/sandbox.ts",
  "config/index.ts",
  "core/transport.ts",
  "core/utils.ts",
]);

function rel(fileName: string): string {
  return path.relative(rootDir, fileName).split(path.sep).join(path.posix.sep);
}

function jsDocText(node: ts.Node, sourceFile: ts.SourceFile): string {
  const ranges = ts.getJSDocCommentsAndTags(node);
  return ranges.map((range) => range.getText(sourceFile)).join("\n");
}

function isPublicMethod(node: ts.ClassElement): node is ts.MethodDeclaration {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  const isPrivate = modifiers?.some(
    (modifier) =>
      modifier.kind === ts.SyntaxKind.PrivateKeyword ||
      modifier.kind === ts.SyntaxKind.ProtectedKeyword,
  );
  return (
    ts.isMethodDeclaration(node) &&
    !isPrivate &&
    !!node.name &&
    ts.isIdentifier(node.name) &&
    !node.name.text.startsWith("_")
  );
}

function iterFailures(): string[] {
  const failures: string[] = [];
  const files = [
    "client/index.ts",
    "client/sandbox.ts",
    "config/index.ts",
    "core/transport.ts",
    "core/utils.ts",
  ].map((file) => path.join(rootDir, file));

  for (const file of files) {
    const sourceText = ts.sys.readFile(file);
    if (!sourceText) continue;
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
    const relative = rel(file);

    for (const node of sourceFile.statements) {
      if (
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.name &&
        ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export
      ) {
        const doc = jsDocText(node, sourceFile);
        if (!doc) {
          failures.push(`${relative}:${node.name.text} missing docstring`);
          continue;
        }
        if (strictFiles.has(relative)) {
          const params = ts.isFunctionDeclaration(node) ? node.parameters.length : 0;
          if (params > 0 && !doc.includes("@param"))
            failures.push(`${relative}:${node.name.text} missing Args`);
          if (
            ts.isFunctionDeclaration(node) &&
            node.type &&
            node.type.kind !== ts.SyntaxKind.VoidKeyword &&
            !doc.includes("@returns")
          ) {
            failures.push(`${relative}:${node.name.text} missing Returns`);
          }
        }

        if (ts.isClassDeclaration(node)) {
          for (const member of node.members) {
            if (!isPublicMethod(member)) continue;
            const methodName = ts.isIdentifier(member.name)
              ? member.name.text
              : member.name.getText(sourceFile);
            const memberDoc = jsDocText(member, sourceFile);
            if (!memberDoc) {
              failures.push(`${relative}:${node.name.text}.${methodName} missing docstring`);
              continue;
            }
            const paramCount = member.parameters.filter(
              (parameter) =>
                ts.isIdentifier(parameter.name) && !["self", "cls"].includes(parameter.name.text),
            ).length;
            if (paramCount > 0 && !memberDoc.includes("@param"))
              failures.push(`${relative}:${node.name.text}.${methodName} missing Args`);
            const returnsVoid = !member.type || member.type.kind === ts.SyntaxKind.VoidKeyword;
            const returnsPromiseVoid = member.type?.getText(sourceFile) === "Promise<void>";
            if (
              !returnsVoid &&
              !returnsPromiseVoid &&
              !memberDoc.includes("@returns") &&
              !memberDoc.includes("@yields")
            ) {
              failures.push(`${relative}:${node.name.text}.${methodName} missing Returns/Yields`);
            }
          }
        }
      }
    }
  }

  return failures;
}

test("public sdk APIs have docstrings", () => {
  const failures = iterFailures();
  assert.deepEqual(failures, []);
});
