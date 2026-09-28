import { z } from 'zod';

export const SCHEMA_VERSION = 1;

export const DiagnosticCodeSchema = z.enum([
  'CONFIG_NOT_FOUND',
  'CONFIG_DYNAMIC',
  'PARSE_ERROR',
  'FILE_TOO_LARGE',
  'UNRESOLVED_IMPORT',
  'DYNAMIC_TITLE',
  'CJS_UNSUPPORTED',
  'NO_TESTS_FOUND',
]);
export type DiagnosticCode = z.infer<typeof DiagnosticCodeSchema>;

export const DiagnosticSchema = z.object({
  code: DiagnosticCodeSchema,
  severity: z.enum(['info', 'warn', 'error']),
  message: z.string(),
  file: z.string().nullable(),
  line: z.number().nullable(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export const TagEntrySchema = z.object({
  tag: z.string(),
  testCount: z.number(),
});
export type TagEntry = z.infer<typeof TagEntrySchema>;

export const FixtureEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  file: z.string(),
  line: z.number(),
  scope: z.enum(['test', 'worker']),
  auto: z.boolean(),
  option: z.boolean(),
  dependsOn: z.array(z.string()),
  testObject: z.string().nullable(),
});
export type FixtureEntry = z.infer<typeof FixtureEntrySchema>;

export const MethodEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  params: z.string().nullable(),
  returns: z.string().nullable(),
  isAsync: z.boolean(),
  isStatic: z.boolean(),
  visibility: z.enum(['public', 'protected']),
  doc: z.string().nullable(),
  line: z.number(),
});
export type MethodEntry = z.infer<typeof MethodEntrySchema>;

export const HelperEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(['function', 'class', 'constant']),
  name: z.string(),
  exportName: z.string(),
  file: z.string(),
  line: z.number(),
  endLine: z.number(),
  isAsync: z.boolean(),
  params: z.string().nullable(),
  returns: z.string().nullable(),
  valuePreview: z.string().nullable(),
  extends: z.string().nullable(),
  category: z.enum(['page-object', 'helper']),
  doc: z.string().nullable(),
  methods: z.array(MethodEntrySchema),
  navigatesTo: z.array(z.string()),
  usedBySpecCount: z.number(),
  referencedByFiles: z.array(z.string()),
  referencedByTruncated: z.boolean(),
});
export type HelperEntry = z.infer<typeof HelperEntrySchema>;

export const TestEntrySchema = z.object({
  id: z.string(),
  file: z.string(),
  line: z.number(),
  column: z.number(),
  endLine: z.number(),
  title: z.string().nullable(),
  titleDynamic: z.boolean(),
  titleSource: z.string().nullable(),
  suitePath: z.array(z.string()),
  modifiers: z.array(z.enum(['fail', 'fixme', 'only', 'skip', 'slow'])),
  tags: z.array(z.string()),
  fixtures: z.array(z.string()),
  calls: z.array(z.string()),
  navigatesTo: z.array(z.string()),
  inLoop: z.boolean(),
});
export type TestEntry = z.infer<typeof TestEntrySchema>;

export const SpecEntrySchema = z.object({
  id: z.string(),
  file: z.string(),
  testCount: z.number(),
  tags: z.array(z.string()),
});
export type SpecEntry = z.infer<typeof SpecEntrySchema>;

export const StatsSchema = z.object({
  specFiles: z.number(),
  tests: z.number(),
  helpers: z.number(),
  methods: z.number(),
  pageObjects: z.number(),
  fixtures: z.number(),
  tags: z.number(),
  filesParsed: z.number(),
  filesSkipped: z.number(),
});
export type Stats = z.infer<typeof StatsSchema>;

export const ProjectInfoSchema = z.object({
  configFile: z.string().nullable(),
  testDir: z.string(),
  testMatch: z.array(z.string()).nullable(),
  playwrightProjects: z.array(z.string()),
  language: z.enum(['typescript', 'javascript', 'mixed']),
  helperDirs: z.array(
    z.object({
      dir: z.string(),
      count: z.number(),
    })
  ),
});
export type ProjectInfo = z.infer<typeof ProjectInfoSchema>;

export const IndexSchema = z.object({
  schemaVersion: z.literal(1),
  generator: z.object({
    name: z.literal('playwright-scout-core'),
    version: z.string(),
  }),
  generatedAt: z.string().nullable(),
  project: ProjectInfoSchema,
  stats: StatsSchema,
  specs: z.array(SpecEntrySchema),
  tests: z.array(TestEntrySchema),
  helpers: z.array(HelperEntrySchema),
  fixtures: z.array(FixtureEntrySchema),
  tags: z.array(TagEntrySchema),
  diagnostics: z.array(DiagnosticSchema),
});
export type Index = z.infer<typeof IndexSchema>;
