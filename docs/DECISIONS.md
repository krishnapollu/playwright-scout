# Decisions

| Date | Question | Choice | Reason |
|---|---|---|---|
| 2026-09-28 | How to scaffold? | Used bash script | Simplest way to generate initial structure |
| 2026-09-29 | What does `helperDirs.count` represent? | Count distinct helper-bearing files in each directory | Keeps the map summary useful for choosing a destination directory and matches the documented sample output |
| 2026-09-29 | Does the indexer work on public Playwright projects? | Mapped [Microsoft Playwright examples](https://github.com/microsoft/playwright-examples) and [Checkly Playwright examples](https://github.com/checkly/playwright-examples) without executing their tests | Both completed without crashes; Microsoft: 4 specs, 15 tests, 1 helper; Checkly: 13 specs, 12 tests, 4 helpers, 10 fixtures; wall time rounded to 0.0s for each |
| 2026-09-29 | Are package tarballs ready for a user smoke test? | Packed both 0.1.0 workspaces and installed them in a fresh temporary project | `map`, `find`, `show`, and `install-skill` all worked; npm publish remains a human-only step |
