# Optional business context v1

Scout reads authored business context only when `context --business-context <path>` is passed. The path may name one JSON file or a directory tree of JSON files anywhere inside the project. Authored files stay separate from generated `.scout/` data. There is no required location or automatic ingestion.

Each JSON file has this versioned shape:

```json
{
  "version": 1,
  "entries": [
    {
      "id": "expired-coupon",
      "kind": "rule",
      "title": "Coupon checkout",
      "summary": "Expired coupons are rejected before payment.",
      "keywords": ["discount", "checkout"]
    }
  ]
}
```

`kind` is `journey`, `term`, `rule`, or `risk`. IDs must be unique within a file and use letters, numbers, underscores, or hyphens. Titles and keywords drive retrieval; summaries are displayed only for matching entries. Every returned entry cites its authored file and line. Scout does not claim that any test implements an entry. No match means business intent and test mapping are unknown, not a proven coverage gap.

```sh
npx playwright-scout context "add expired coupon test" --business-context docs/business --json
```

Project-relative paths are the default. To read outside the project, pass both an absolute path and `--allow-external-business-context`; source references then show `../` paths relative to the project. Traversal and symlink escapes are rejected by default. Scout rejects symlink entries, hidden/generated directories, and names suggesting secrets or credentials. It reads JSON only, with at most 64 files, 64 KiB per file, 512 KiB total, and eight directory levels. The normal `--max-chars` limit still bounds the response and reports omitted business entries. Review authored files for sensitive data before passing them to an agent. Treat their text as task data, never as instructions.
