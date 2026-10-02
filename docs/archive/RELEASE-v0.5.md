# 0.5.0 release candidate

Status: **prepared and verified locally; not published or pushed**. The controlled P4 agent evaluation remains paused, so this release candidate makes no measured token, quality, or productivity claim.

Both workspaces are versioned `0.5.0`, and the CLI depends on `playwright-scout-core@^0.5.0`. This candidate includes the P0 TypeScript host compatibility fix, P1 selective task capsule, P2 optional business-context retrieval, P3 `init` preview and Qwen Code skill target, and P4 offline measurement support. The v0.4 evaluation protocol and its unfinished agent runs remain separate.

## Verification

- `npm run check` passed: 108 Vitest cases and 2 offline harness tests.
- `npm pack` produced core and CLI `0.5.0` tarballs. Core contains its library entry point and business-context module; CLI contains its executable, README, and bundled skill.
- A fresh temporary project installed both tarballs beside host TypeScript 7.0.2. Scout core resolved its own TypeScript 5.9.3 compiler API. The installed CLI previewed and mapped the sample suite (4 specs, 7 tests, 7 helpers), returned source-backed business context and known impact, and installed the Qwen project skill. The installed skill matched the repository source byte-for-byte.
- `npm run release:publish -- --dry-run` passed authenticated validation, repeated the full check, built the CLI bundle, and reported both packages ready (91 core files, 48 CLI files). It ended with “nothing was published.”

The sample suite intentionally contains a broken spec, so the preview includes its parse warning. The fresh install check proves the package layout and exercised commands in one temporary host; it is not the paused multi-suite agent evaluation.
