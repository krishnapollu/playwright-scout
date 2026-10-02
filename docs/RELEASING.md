# Releasing (maintainers)

Put your npm publish token in a local `.env` file as `npm_pat=...`. The file is ignored by Git. Then run:

```bash
npm run release:publish -- --dry-run
npm run release:publish
```

The script checks the release, confirms the contents of both packages, and prompts before publishing core followed by the CLI. It skips a version that is already on npm, so you can rerun it if the second package fails. Bump the package you are releasing; if core changes, update the CLI's core dependency too. For prereleases, use `--tag next`.

The [0.5.0 candidate verification](RELEASE-v0.5.md) preceded publication. Version `0.5.1` contains the follow-up fixes listed in the [changelog](../CHANGELOG.md); tagging a release remains a maintainer action.
