# P4 measurement support (offline)

Status: **instrumentation ready; controlled agent runs paused by the user**. No new efficacy data was collected. The two earlier same-task feasibility pairs remain in [PILOT-v0.4.md](PILOT-v0.4.md), and the unchanged main-study decision thresholds remain in [SPEC-v0.4.md](SPEC-v0.4.md).

The opt-in `bench/run-codex-pilot.mjs` runner now records, per arm:

| Field | Meaning |
| --- | --- |
| `usage.input_tokens`, `output_tokens`, `cached_input_tokens` | Provider-reported usage from completed turns. Total is input plus output; cached input is a subset of input. Missing completed turns mean unmeasured. |
| `usage.command_count`, `scout_command_count`, `command_output_chars` | Completed shell commands and observed output volume. Output characters are diagnostic, not model tokens. Missing output fields are counted. |
| `commands[]` | Safe command class/name, exit code, output characters, and observed wall time. It omits raw command text and output from the summary; raw JSONL stays in the temporary pilot directory. |
| `wall.scout_commands_ms`, `other_commands_ms` | Event-received intervals between command start and completion, split by Scout and other commands. Missing intervals are counted. |
| `wall.model_or_unattributed_ms`, `turn_span_ms` | Agent elapsed time after observed command intervals, and turn spans for diagnostics. Turn spans include commands and must not be added to command time. The residual includes model activity and any unobserved work, so it is not an exact model latency measure. |
| `wall.evaluator_check_ms`, `total_ms` | Local post-agent typecheck duration and full arm duration through hashing. Setup before the arm and later manual runtime checks are outside this number. |

`typecheck_pass`, `typecheck_exit`, and `typecheck_output_chars` describe only the runner's local TypeScript check. A task-specific Playwright runtime result and blind review must be recorded separately. The harness does not turn a missing runtime check into a pass.

When runs resume, freeze a varied public-suite task set and checks before seeing outputs. Score every scheduled run, including failures and timeouts, for qualified completion and major defects first. Record two reviewers' behavior/maintainability/duplication judgments before unblinding. Only then compare paired total model tokens, cached and uncached input, output, wall time, retries, Scout abstention, and command/output behavior by suite and task type. A smaller capsule or command output alone is not evidence of efficiency. The v0.4 thresholds remain unchanged.

The parser and summary fields have synthetic fixture tests run by `npm run check`; they are not a substitute for the paused 4–6-task pilot or 48-run main evaluation.
