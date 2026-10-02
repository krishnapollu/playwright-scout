export type ScoutErrorCode =
  | 'ROOT_NOT_FOUND'
  | 'NO_TESTS_FOUND'
  | 'INDEX_MISSING'
  | 'INDEX_INVALID'
  | 'INDEX_SCHEMA_MISMATCH'
  | 'NOT_FOUND'
  | 'AMBIGUOUS'
  | 'USAGE';

export class ScoutError extends Error {
  constructor(
    public code: ScoutErrorCode,
    message?: string,
  ) {
    super(message || code);
    this.name = 'ScoutError';
  }
}
