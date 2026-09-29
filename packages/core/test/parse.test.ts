import { describe, expect, it } from 'vitest';
import { getParseErrors, parseFile } from '../src/parse.js';

describe('parseFile', () => {
  it('selects the source kind from the file extension', () => {
    expect(getParseErrors(parseFile('component.tsx', 'const View = () => <div />;'))).toHaveLength(0);
    expect(getParseErrors(parseFile('legacy.js', 'const value = 1;'))).toHaveLength(0);
  });

  it('reports syntax errors with their source positions', () => {
    const source = parseFile('broken.ts', 'const value = ;');
    const errors = getParseErrors(source);
    expect(errors.length).toBeGreaterThan(0);
    expect(source.getLineAndCharacterOfPosition(errors[0]!.start ?? 0).line).toBe(0);
  });

  it('handles CRLF source without shifting line coordinates', () => {
    const source = parseFile('crlf.ts', 'const before = 1;\r\nconst value = ;');
    const error = getParseErrors(source)[0];
    expect(error).toBeDefined();
    expect(source.getLineAndCharacterOfPosition(error!.start ?? 0).line + 1).toBe(2);
  });
});
