# v0.2 context evaluation

This is a local, deterministic smoke evaluation of relevance and output size. Reproduce the five checked-in sample tasks with `npm run build` and `node scripts/evaluate-context.mjs`. The baseline is the v0.1-style `buildContext()` JSON serialization; the new result is the v0.2 task brief JSON at a 6000-character limit. Character counts include the brief's final newline. The rough token estimate is `ceil(UTF-8 bytes / 4)` and is **not** a model tokenizer count.

| Task                         | Expected evidence found                                  | Baseline chars | v0.2 chars | Rough v0.2 tokens |
| ---------------------------- | -------------------------------------------------------- | -------------: | ---------: | ----------------: |
| Reuse checkout POM method    | Yes: `CheckoutPage.applyCoupon`, analogous checkout test |           1399 |       1152 |               288 |
| Author through login fixture | Yes: `LoginPage.login`, analogous login test             |           1703 |       1337 |               335 |
| Modify email helper          | Yes: `uniqueEmail`, linked login spec                    |            376 |        677 |               170 |
| Modify fixture               | Yes: linked login spec                                   |           1747 |       1207 |               302 |
| Assess checkout file impact  | Yes: linked checkout spec                                |           1216 |       1011 |               253 |

All five evidence checks passed. Four of five task briefs were shorter than the baseline; the helper task was longer because it included explicit limits and source-backed fields. These measurements do **not** establish lower agent token usage or better changes. A controlled agent run with and without Scout is still needed for that claim. The script reports in-process context calculation times (about 0.2–0.9 ms on this run); these are not steady-state benchmarks.

Public-suite smoke checks used shallow checkouts of [Microsoft Playwright examples](https://github.com/microsoft/playwright-examples) at `4eb82ae` and [Checkly Playwright examples](https://github.com/checkly/playwright-examples) at `a42e8e4`. No tests or analyzed project code were executed.

| Suite              | Indexed specs / tests / helpers | Query   | Brief chars | One-off CLI time | One-off map time |
| ------------------ | ------------------------------- | ------- | ----------: | ---------------: | ---------------: |
| Microsoft examples | 4 / 15 / 1                      | `clock` |         450 |           0.14 s |           0.15 s |
| Checkly examples   | 13 / 18 / 4                     | `api`   |         516 |           0.14 s |           0.16 s |

Both public queries returned a cited analogous test. Neither yielded a reusable helper for its query, so Scout left that section empty rather than inventing one. Times are one-off `/usr/bin/time -p` wall times, including Node startup, on the maintainer's machine; they should not be interpreted as comparative performance data.

The v0.2 package smoke test packed both workspaces, installed both local tarballs into a fresh temporary consumer, rebuilt a copied v1 sample index with `map --if-stale`, ran `context` and `impact --file`, and verified that `install-skill` produced a byte-identical skill file. No package was published.
