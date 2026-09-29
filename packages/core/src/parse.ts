import ts from 'typescript';

const SCRIPT_KIND_BY_EXT: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
  '.mts': ts.ScriptKind.TS,
  '.cts': ts.ScriptKind.TS,
  '.js': ts.ScriptKind.JS,
  '.jsx': ts.ScriptKind.JSX,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
};

export function parseFile(relPath: string, text: string): ts.SourceFile {
  const ext = relPath.includes('.') ? relPath.slice(relPath.lastIndexOf('.')) : '';
  const kind = SCRIPT_KIND_BY_EXT[ext] ?? ts.ScriptKind.TS;
  return ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, kind);
}

/**
 * TypeScript keeps parse diagnostics on an internal field, so we read it through a narrow
 * compatibility shim instead of reaching into a type that is not part of the public API.
 */
export function getParseErrors(sf: ts.SourceFile): readonly ts.Diagnostic[] {
  return (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
}
